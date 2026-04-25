import os
import json
import asyncio
import cloudinary
import cloudinary.uploader
import firebase_admin
from firebase_admin import credentials, firestore
from google import genai 
from playwright.async_api import async_playwright
import requests

# 🔥 Robust Stealth Import
try:
    from playwright_stealth import stealth_async
except ImportError:
    # Agar direct import fail ho, toh module se try karo
    import playwright_stealth
    stealth_async = playwright_stealth.stealth_async

# ⚙️ CONFIG
cloudinary.config(
    cloud_name=os.environ.get('CLOUDINARY_NAME'),
    api_key=os.environ.get('CLOUDINARY_API_KEY'),
    api_secret=os.environ.get('CLOUDINARY_API_SECRET')
)

client = genai.Client(api_key=os.environ.get('GEMINI_API_KEY'))

if not firebase_admin._apps:
    cred_json = json.loads(os.environ.get('FIREBASE_KEY'))
    firebase_admin.initialize_app(credentials.Certificate(cred_json))
db = firestore.client()

captured_media_urls = {}

async def analyze_with_gemini(image_url):
    try:
        response = requests.get(image_url)
        if response.status_code == 200:
            result = client.models.generate_content(
                model="gemini-1.5-flash",
                contents=["Identify Area and Describe: [Area] - [Action]", response.content]
            )
            return result.text
    except Exception as e:
        print(f"      ⚠️ AI Error: {e}")
    return "AI analysis unavailable."

async def safe_sync(url, username, category, is_video):
    try:
        media_id = url.split('?')[0].split('/')[-1][:45]
        doc_id = f"V28_PY_{username}_{media_id}"
        doc_ref = db.collection("archives").document(doc_id)
        if doc_ref.get().exists: return False, None

        print(f"      📤 Uploading to Cloudinary...")
        upload = cloudinary.uploader.upload(
            url, folder=f"insta_vault_v28/{username}/{category}",
            resource_type="video" if is_video else "image"
        )
        doc_ref.set({
            "owner": username, "url": upload['secure_url'], "type": category,
            "is_video": is_video, "time": firestore.SERVER_TIMESTAMP, "version": "V28_PY"
        })
        return True, doc_id
    except Exception as e:
        print(f"      ❌ Sync Error: {e}")
        return False, None

async def handle_request(request):
    url = request.url
    if "instagram.com" in url and (".mp4" in url or "video" in url or ".jpg" in url):
        if "profile_pic" not in url and "data:image" not in url:
            is_video = ".mp4" in url or "video" in url
            captured_media_urls[url] = {"type": "video" if is_video else "image"}

async def run_bot():
    async with async_playwright() as p:
        print("🚀 GHOST_ENGINE: V28.2 - MISSION RE-START...")
        browser = await p.chromium.launch(headless=True, args=["--no-sandbox"])
        context = await browser.new_context(viewport={'width': 1080, 'height': 1920})
        page = await context.new_page()
        
        # 🔥 Fixed Stealth Call
        await stealth_async(page)

        cookies_env = os.environ.get('INSTA_COOKIES')
        if cookies_env:
            await context.add_cookies(json.loads(cookies_env))

        page.on("request", handle_request)
        targets = ["_anshu_2101", "_cool_butterfly_.6284", "dee_pu3477", "ritu_singh785903"]

        for user in targets:
            print(f"\n🕵️ Target Locked: @{user}")
            try:
                response = await page.goto(f"https://www.instagram.com/stories/{user}/")
                if response.status in [403, 429]:
                    print(f"🚨 IP BLOCK detected (Status: {response.status})")
                    break
                
                await asyncio.sleep(5)
                if "login" in page.url:
                    print("🚨 COOKIES EXPIRED HAIN!")
                    break

                for slide in range(10):
                    if "/stories/" not in page.url: break
                    await page.mouse.click(540, 960)
                    await asyncio.sleep(2)

                    if captured_media_urls:
                        latest_url = list(captured_media_urls.keys())[-1]
                        media = captured_media_urls[latest_url]
                        is_new, doc_id = await safe_sync(latest_url, user, "stories", media['type'] == 'video')
                        if is_new and media['type'] == 'image':
                            ai_report = await analyze_with_gemini(latest_url)
                            db.collection("archives").document(doc_id).update({"ai_report": ai_report})

                    await page.keyboard.press("ArrowRight")
                    await asyncio.sleep(3)
            except Exception as e:
                print(f"❌ Error scanning @{user}: {e}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run_bot())
    
