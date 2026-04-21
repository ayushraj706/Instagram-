const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const { PuppeteerScreenRecorder } = require('puppeteer-screen-recorder');
const cloudinary = require('cloudinary').v2;
const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const fs = require('fs');

// ⚙️ CONFIG
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_KEY)) });
}
const db = admin.firestore();

const MAX_WAIT_FOR_MEDIA = 40000; // 40 seconds max wait

async function runBot() {
  console.log("🚀 GHOST_ENGINE: V25 - Login Debugger, Universal Links & Immediate Sync...");
  const browser = await puppeteer.launch({ 
    headless: "new", 
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'] 
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1920 });

  try {
    await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle2' });
    
    if (process.env.INSTA_COOKIES) {
        console.log("🍪 Applying Cookies...");
        await page.setCookie(...JSON.parse(process.env.INSTA_COOKIES));
        await page.reload({ waitUntil: 'networkidle2' });
    }

    // 🎥 1 MINUTE DEBUG VIDEO RECORDING
    console.log("🎥 Starting 60-second screen record to check Login/Cookies status...");
    const recorder = new PuppeteerScreenRecorder(page);
    await recorder.start('login_debug.mp4');
    await new Promise(r => setTimeout(r, 60000)); // 1 minute hold
    await recorder.stop();
    console.log("📤 Uploading debug video to Cloudinary...");
    try {
        const debugUpload = await cloudinary.uploader.upload('login_debug.mp4', { 
            folder: 'insta_debug', 
            resource_type: 'video' 
        });
        console.log(`✅ Debug Video Link (Check this to see what bot sees): ${debugUpload.secure_url}`);
    } catch(e) {
        console.log("❌ Debug video upload failed:", e.message);
    }

    const targets = ["_anshu_2101", "_cool_butterfly_.6284", "dee_pu3477", "ritu_singh785903"];

    for (const user of targets) {
      console.log(`\n🕵️ Target Locked: @${user}`);
      
      // 1. Profile Page scan for Highlights
      await page.goto(`https://www.instagram.com/${user}/`, { waitUntil: 'networkidle2' });
      const highlightLinks = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('a[href*="/stories/highlights/"]')).map(a => a.href);
      });

      // 2. Stories Scan
      console.log(`   📸 Checking Active Stories...`);
      await page.goto(`https://www.instagram.com/stories/${user}/`, { waitUntil: 'networkidle2' });
      await sniperCapture(page, user, 'stories_v25');

      // 3. Highlights Scan
      for (const hUrl of highlightLinks) {
          console.log(`   🔗 Entering Highlight: ${hUrl}`);
          await page.goto(hUrl, { waitUntil: 'networkidle2' });
          await sniperCapture(page, user, 'highlights_v25');
      }
    }
  } catch (error) {
    console.error("❌ ERROR:", error.message);
  } finally {
    await browser.close();
    console.log("⏹️ Mission Finished.");
  }
}

async function sniperCapture(page, username, category) {
    await new Promise(r => setTimeout(r, 6000));

    for (let i = 0; i < 40; i++) {
        const currentUrl = page.url();
        if (!currentUrl.includes('/stories/')) {
            console.log(`   ⏹️ Exited Viewer (Back on Profile).`);
            break;
        }

        console.log(`   🎞️ Slide ${i+1}: Hunting Media...`);

        // --- 🎯 THE SNIPER POLLING (UNIVERSAL LINKS) ---
        const media = await page.evaluate(async (maxWait) => {
            const start = Date.now();
            while (Date.now() - start < maxWait) {
                
                // 1. Hunt for Videos (Any valid HTTP video link, ignore blobs)
                const videos = Array.from(document.querySelectorAll('video'));
                for (const v of videos) {
                    const src = v.currentSrc || v.src || v.querySelector('source')?.src;
                    if (src && src.startsWith('http') && !src.includes('blob:')) {
                        return { url: src, type: 'video' };
                    }
                }

                // 2. Hunt for Images (Check reverse order for latest, any domain, >300px)
                const imgs = Array.from(document.querySelectorAll('img'));
                for (let j = imgs.length - 1; j >= 0; j--) {
                    const img = imgs[j];
                    if (img.src && img.src.startsWith('http') && img.naturalWidth > 300 && !img.src.includes('data:image')) {
                        return { url: img.src, type: 'image' };
                    }
                }

                // 3. Login Block Check
                const isLoginPopup = document.body.innerText.includes('Log in to Instagram') || document.body.innerText.includes('Log In');
                if (isLoginPopup) {
                    return { error: 'LOGIN_REQUIRED' };
                }

                await new Promise(r => setTimeout(r, 1000));
            }
            return null;
        }, MAX_WAIT_FOR_MEDIA);

        if (media && media.error === 'LOGIN_REQUIRED') {
            console.log(`      ⛔ WARNING: Instagram blocked access. Cookies are expired or Invalid!`);
            break; 
        } else if (media && media.url) {
            // ❤️ Like (Optional)
            await page.evaluate(() => {
                const likeBtn = document.querySelector('span[role="button"] svg[aria-label="Like"]')?.closest('button');
                if (likeBtn) likeBtn.click();
            });

            // 💾 IMMEDIATE UPLOAD (Ruk kar upload karega, phir aage badhega)
            console.log(`      🎯 Target Spotted! Syncing to Cloudinary immediately...`);
            const isNew = await safeSync(media.url, username, category, media.type === 'video');
            
            if (isNew && media.type === 'image') {
                const aiResponse = await analyzeWithGemini(media.url);
                await updateAIDesc(username, media.url, aiResponse);
            }
        } else {
            console.log(`      ⚠️ Slide ${i+1}: Hunting failed (Timeout). Media not found.`);
        }

        // Move to next slide ONLY AFTER upload is complete
        await page.keyboard.press('ArrowRight');
        await new Promise(r => setTimeout(r, 2500)); 
    }
}

async function safeSync(url, username, category, isVideo) {
    try {
        const mediaId = url.split('?')[0].split('/').pop().substring(0, 45); 
        const docId = `V25_${username}_${mediaId}`;
        const docRef = db.collection("archives").doc(docId);
        
        const doc = await docRef.get();
        if (doc.exists) {
            console.log(`      ⏩ Already Exists in Database. Skipping upload.`);
            return false;
        }

        const upload = await cloudinary.uploader.upload(url, { 
            folder: `insta_vault_v25/${username}/${category}`, 
            resource_type: isVideo ? "video" : "image"
        });

        await docRef.set({ 
            owner: username, url: upload.secure_url, type: category, is_video: isVideo, 
            time: admin.firestore.FieldValue.serverTimestamp() 
        });
        console.log(`      ✅ [BULLSEYE] Archived to Cloudinary. URL: ${upload.secure_url}`);
        return true;
    } catch (e) {
        console.log(`      ❌ Sync Error: ${e.message}`);
        return false;
    }
}

async function analyzeWithGemini(imageUrl) {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = "Identify Area and Describe: [Area] - [Action]";
        const response = await fetch(imageUrl);
        const buffer = await response.buffer();
        const result = await model.generateContent([prompt, { inlineData: { data: buffer.toString('base64'), mimeType: "image/jpeg" } }]);
        return result.response.text();
    } catch (e) { return "AI Skip."; }
}

async function updateAIDesc(username, url, desc) {
    const mediaId = url.split('?')[0].split('/').pop().substring(0, 45);
    await db.collection("archives").doc(`V25_${username}_${mediaId}`).update({ ai_report: desc });
}

runBot();
