import os
import json
import requests
import cloudinary
import cloudinary.uploader
import firebase_admin
from firebase_admin import credentials, firestore
import google.generativeai as genai
import instaloader
import random  # Naya import proxy ke liye

# ==========================================
# ⚙️ CONFIG & SECRETS (Aapke Puraane Names)
# ==========================================
cloudinary.config(
  cloud_name = os.environ.get('CLOUDINARY_NAME'),
  api_key = os.environ.get('CLOUDINARY_API_KEY'),
  api_secret = os.environ.get('CLOUDINARY_API_SECRET')
)

genai.configure(api_key=os.environ.get('GEMINI_API_KEY'))

# Firebase Setup
if not firebase_admin._apps:
    cred_json = json.loads(os.environ.get('FIREBASE_KEY'))
    cred = credentials.Certificate(cred_json)
    firebase_admin.initialize_app(cred)
db = firestore.client()

# ==========================================
# 🌐 FREE PROXY FETCHER (ANTI-BLOCK SYSTEM)
# ==========================================
def get_free_proxy():
    print("      🔍 Searching for a working free proxy to bypass IP Block...")
    try:
        # Free proxy API se proxies uthana
        res = requests.get("https://proxylist.geonode.com/api/proxy-list?limit=10&page=1&sort_by=lastChecked&sort_type=desc&protocols=http%2Chttps")
        if res.status_code == 200:
            proxies = res.json().get('data', [])
            if proxies:
                # Koi bhi ek random proxy select karna
                p = random.choice(proxies)
                proxy_url = f"http://{p['ip']}:{p['port']}"
                print(f"      ✅ Proxy Found: {proxy_url}")
                return proxy_url
    except Exception as e:
        print(f"      ⚠️ Proxy fetch failed: {e}")
    return None

# ==========================================
# 🧠 GEMINI AI LOGIC
# ==========================================
def analyze_with_gemini(image_url):
    try:
        print(f"      🤖 Fetching image for AI analysis...")
        model = genai.GenerativeModel('gemini-1.5-flash-latest')
        prompt = "Identify Area and Describe: [Area] - [Action]"
        
        response = requests.get(image_url)
        if response.status_code != 200:
            raise Exception(f"Fetch failed: {response.status_code}")
            
        result = model.generate_content([
            prompt,
            {"mime_type": "image/jpeg", "data": response.content}
        ])
        return result.text
    except Exception as e:
        print(f"      ⚠️ AI Error: {e}")
        return "AI analysis unavailable."

# ==========================================
# 💾 FIREBASE & CLOUDINARY SYNC LOGIC
# ==========================================
def safe_sync(media_url, username, category, is_video):
    try:
        url_parts = media_url.split('?')[0].split('/')
        media_id = url_parts[-1][:45]
        
        doc_id = f"V29_{username}_{media_id}" 
        doc_ref = db.collection("archives").document(doc_id)
        
        if doc_ref.get().exists:
            print(f"      ⏩ Already archived in database. Skipping duplicate.")
            return False, None
            
        print(f"      📤 Uploading to Cloudinary...")
        upload = cloudinary.uploader.upload(
            media_url, 
            folder=f"insta_vault_v29/{username}/{category}", 
            resource_type="video" if is_video else "image",
            timeout=120000
        )
        
        doc_ref.set({
            "owner": username,
            "url": upload['secure_url'],
            "original_url": media_url,
            "type": category,
            "is_video": is_video,
            "time": firestore.SERVER_TIMESTAMP,
            "version": "V29_INSTALOADER_FAST_TRACK"
        })
        print(f"      ✅ [BULLSEYE] Archived: {upload['secure_url']}")
        return True, doc_id
        
    except Exception as e:
        print(f"      ❌ Sync Error: {e}")
        return False, None

def update_ai_desc(doc_id, desc):
    try:
        db.collection("archives").document(doc_id).update({
            "ai_report": desc,
            "ai_analyzed_at": firestore.SERVER_TIMESTAMP
        })
        print(f"      📝 AI description saved to Firebase.")
    except Exception as e:
        print(f"      ⚠️ Failed to update AI DB: {e}")

# ==========================================
# 🚀 MAIN GHOST ENGINE V29
# ==========================================
def main():
    print("🚀 GHOST_ENGINE: V29 - API FAST-TRACK ACTIVATED (WITH PROXY)...")
    
    L = instaloader.Instaloader()
    session_id = os.environ.get('IG_SESSIONID')
    
    # ----------------------------------------
    # 🔥 ANTI-BLOCK LOGIC (HEADERS + COOKIES)
    # ----------------------------------------
    L.context._session.cookies.set('sessionid', session_id, domain='.instagram.com')
    L.context._session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'X-IG-App-ID': '936619743392459' # Meta ko lagne do ki app se request aayi hai
    })
    
    # 🔥 PROXY APPLY KARNA
    proxy = get_free_proxy()
    if proxy:
        L.context._session.proxies = {
            "http": proxy,
            "https": proxy
        }
    
    targets = ["_anshu_2101", "_cool_butterfly_.6284", "dee_pu3477", "ritu_singh785903"]
    
    for username in targets:
        print(f"\n🕵️ Target Locked: @{username}")
        try:
            profile = instaloader.Profile.from_username(L.context, username)
            
            print(f"   📸 Checking Active Stories...")
            for story in L.get_stories([profile.userid]):
                for item in story.get_items():
                    print(f"\n   🎯 Story Found: {item.date_utc}")
                    media_url = item.video_url if item.is_video else item.url
                    
                    is_new, doc_id = safe_sync(media_url, username, "stories_v29", item.is_video)
                    
                    if is_new and not item.is_video:
                        ai_desc = analyze_with_gemini(media_url)
                        update_ai_desc(doc_id, ai_desc)
                        print(f"      ✅ AI Analysis Complete: {ai_desc[:60]}...")
            
            print(f"   ✨ Checking Highlights...")
            for highlight in L.get_highlights(profile.userid):
                print(f"   🔗 Entering Highlight: {highlight.title}")
                for item in highlight.get_items():
                    media_url = item.video_url if item.is_video else item.url
                    
                    is_new, doc_id = safe_sync(media_url, username, "highlights_v29", item.is_video)
                    
                    if is_new and not item.is_video:
                        ai_desc = analyze_with_gemini(media_url)
                        update_ai_desc(doc_id, ai_desc)
            
        except Exception as e:
            print(f"❌ Error scanning @{username} (Account private ho sakta hai ya session expire): {e}")

if __name__ == "__main__":
    main()
