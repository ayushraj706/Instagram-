const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const { PuppeteerScreenRecorder } = require('puppeteer-screen-recorder');
const cloudinary = require('cloudinary').v2;
const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const path = require('path');
const fs = require('fs');

// ⚙️ CONFIGURATIONS
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_KEY))
  });
}
const db = admin.firestore();

const MAX_WAIT_FOR_MEDIA = 30000; 

async function runBot() {
  console.log("🚀 GHOST_ENGINE: V23 - Serial Upload & Aggressive Detection...");
  
  const browser = await puppeteer.launch({ 
    headless: "new", 
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'] 
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1920 });

  try {
    await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle2' });
    if (process.env.INSTA_COOKIES) {
        await page.setCookie(...JSON.parse(process.env.INSTA_COOKIES));
        await page.reload({ waitUntil: 'networkidle2' });
    }

    const targets = ["_anshu_2101", "_cool_butterfly_.6284", "dee_pu3477", "ritu_singh785903"];

    for (const user of targets) {
      console.log(`\n🕵️ [TARGET: @${user}]`);
      
      await page.goto(`https://www.instagram.com/${user}/`, { waitUntil: 'networkidle2' });
      await trackProfileChanges(page, user);

      const highlightLinks = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('a[href*="/stories/highlights/"]')).map(a => a.href);
      });

      // 📸 Stories Scan
      await page.goto(`https://www.instagram.com/stories/${user}/`, { waitUntil: 'networkidle2' });
      await captureSerialHD(page, user, 'stories_v23');

      // 🔗 Highlights Scan
      for (const hUrl of highlightLinks) {
          await page.goto(hUrl, { waitUntil: 'networkidle2' });
          await captureSerialHD(page, user, 'highlights_v23');
      }
    }
  } catch (error) {
    console.error("❌ CRITICAL ERROR:", error.message);
  } finally {
    await browser.close();
    console.log("⏹️ Mission Finished.");
  }
}

/**
 * 🔥 SERIAL UPLOAD: Har slide par turant action
 */
async function captureSerialHD(page, username, category) {
    for (let i = 0; i < 35; i++) {
        // --- 🛡️ AGGRESSIVE POLLING ---
        const media = await page.evaluate(async (maxWait) => {
            const start = Date.now();
            while (Date.now() - start < maxWait) {
                // Video Check
                const video = document.querySelector('video');
                if (video && video.readyState >= 2) {
                    const src = video.currentSrc || video.src || video.querySelector('source')?.src;
                    if (src && src.startsWith('http')) return { url: src, type: 'video' };
                }

                // Aggressive Image Check (Story main content image)
                const storyImg = document.querySelector('img[srcset*="cdninstagram"], img[style*="object-fit: cover"]');
                if (storyImg && storyImg.complete && storyImg.naturalWidth > 200) {
                    return { url: storyImg.src, type: 'image' };
                }

                await new Promise(r => setTimeout(r, 800));
            }
            return null;
        }, MAX_WAIT_FOR_MEDIA);

        if (media && media.url) {
            console.log(`      🎯 Media Found! Starting immediate upload...`);
            
            // ❤️ Like
            await page.evaluate(() => {
                const likeBtn = document.querySelector('span[role="button"] svg[aria-label="Like"]')?.closest('button');
                if (likeBtn) likeBtn.click();
            });

            // 💾 Upload (Serial: Agla kaam tabhi hoga jab ye khatam hoga)
            const isNew = await safeSync(media.url, username, category, media.type === 'video');
            
            if (isNew && media.type === 'image') {
                const aiResponse = await analyzeWithGemini(media.url);
                await updateAIDesc(username, media.url, aiResponse);
            }
        } else {
            console.log(`      ⚠️ Slide ${i+1}: Skip (No media detected)`);
        }

        // Next Slide
        await page.keyboard.press('ArrowRight');
        await new Promise(r => setTimeout(r, 2000));
        if (!await page.evaluate(() => window.location.href.includes('/stories/'))) break;
    }
}

async function safeSync(url, username, category, isVideo) {
    try {
        const mediaId = url.split('?')[0].split('/').pop().substring(0, 40); 
        const docId = `V23_${username}_${mediaId}`;
        const docRef = db.collection("archives").doc(docId);
        
        const doc = await docRef.get();
        if (doc.exists) {
            console.log(`      ⏭️ Already archived: ${docId}`);
            return false;
        }

        // Cloudinary Upload
        const upload = await cloudinary.uploader.upload(url, { 
            folder: `insta_vault_v23/${username}/${category}`, 
            resource_type: isVideo ? "video" : "image"
        });

        await docRef.set({ 
            owner: username, url: upload.secure_url, type: category, is_video: isVideo, 
            time: admin.firestore.FieldValue.serverTimestamp() 
        });
        console.log(`      ✅ Archived: ${isVideo ? '📹 Video' : '🖼️ HD Photo'}`);
        return true;
    } catch (e) {
        console.log(`      ❌ Upload Failed: ${e.message}`);
        return false;
    }
}

async function trackProfileChanges(page, username) {
    const profile = await page.evaluate(() => ({
        bio: document.querySelector('header section div:nth-child(3) span')?.innerText || "",
        dp: document.querySelector('header img')?.src || ""
    }));
    await db.collection("profile_tracking").doc(username).set({ ...profile, last_seen: admin.firestore.FieldValue.serverTimestamp() });
}

async function analyzeWithGemini(imageUrl) {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `Identify area and describe action: [Area] - [Description]`;
        const response = await fetch(imageUrl);
        const buffer = await response.buffer();
        const result = await model.generateContent([prompt, { inlineData: { data: buffer.toString('base64'), mimeType: "image/jpeg" } }]);
        return result.response.text();
    } catch (e) { return "AI analysis skip."; }
}

async function updateAIDesc(username, url, desc) {
    const mediaId = url.split('?')[0].split('/').pop().substring(0, 40);
    await db.collection("archives").doc(`V23_${username}_${mediaId}`).update({ ai_report: desc });
}

runBot();
