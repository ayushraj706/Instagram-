const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const { PuppeteerScreenRecorder } = require('puppeteer-screen-recorder');
const cloudinary = require('cloudinary').v2;
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_KEY))
  });
}
const db = admin.firestore();

// Settings
const MAX_WAIT_FOR_MEDIA = 45000; // Ek slide ke liye 45 sec tak wait karega (Slow net fix)
const FORCE_RE_SYNC = true; // Dubara high quality mein lene ke liye

async function runBot() {
  console.log("🚀 GHOST_ENGINE: V21 - The Ultimate Audio-Video Deep Archiver...");
  
  const browser = await puppeteer.launch({ 
    headless: "new", 
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ] 
  });
  
  const page = await browser.newPage();
  // HD Viewport for high-res content
  await page.setViewport({ width: 1080, height: 1920 }); 
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1');

  const videoPath = path.join(__dirname, 'ghost_master_evidence.mp4');
  const recorder = new PuppeteerScreenRecorder(page, {
    followNewTab: true,
    fps: 30,
    videoFrame: { width: 1080, height: 1920 },
    aspectRatio: '9:16',
  });

  try {
    await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 5000));
    await recorder.start(videoPath);
    console.log("⏺️ Evidence Recording Started...");

    if (process.env.INSTA_COOKIES) {
        console.log("🍪 Injecting Fresh Session Cookies...");
        await page.setCookie(...JSON.parse(process.env.INSTA_COOKIES));
        await page.reload({ waitUntil: 'networkidle2' });
    }

    const targets = ["_anshu_2101", "_cool_butterfly_.6284", "dee_pu3477", "ritu_singh785903"];

    for (const user of targets) {
      console.log(`\n🕵️ Target Locked: @${user}`);
      
      // 1. Profile Discovery (Highlight Links)
      await page.goto(`https://www.instagram.com/${user}/`, { waitUntil: 'networkidle2' });
      await new Promise(r => setTimeout(r, 5000));

      const highlightLinks = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('a[href*="/stories/highlights/"]')).map(a => a.href);
      });
      console.log(`✨ Found ${highlightLinks.length} Highlights for @${user}`);

      // 2. Active Stories Scan
      console.log(`📸 Checking Stories for @${user}...`);
      await page.goto(`https://www.instagram.com/stories/${user}/`, { waitUntil: 'networkidle2' });
      await captureDeepMedia(page, user, 'stories_master');

      // 3. Highlights Deep Scan
      for (const hUrl of highlightLinks) {
          console.log(`🔗 Scanning Highlight Link: ${hUrl}`);
          await page.goto(hUrl, { waitUntil: 'networkidle2' });
          await captureDeepMedia(page, user, 'highlights_master');
      }
    }

  } catch (error) {
    console.error("❌ CRITICAL ERROR:", error.message);
  } finally {
    await recorder.stop();
    await browser.close();
    console.log("⏹️ Mission Finished. Check Cloudinary for 'insta_vault_v21' folder.");
  }
}

/**
 * 🔥 SMART DEEP CAPTURE: Wait for link, check audio/video, then sync
 */
async function captureDeepMedia(page, username, category) {
    for (let i = 0; i < 30; i++) {
        console.log(`   🎞️ Processing Slide ${i+1}...`);

        const media = await page.evaluate(async (maxWait) => {
            const start = Date.now();
            while (Date.now() - start < maxWait) {
                const video = document.querySelector('video');
                const img = document.querySelector('img[decode="sync"]') || document.querySelector('img[alt*="Story"]');

                // 📹 VIDEO + AUDIO Check: Instagram music images are technically videos
                if (video && video.readyState >= 3) {
                    const src = video.currentSrc || video.src || video.querySelector('source')?.src;
                    if (src && src.startsWith('http')) return { url: src, type: 'video' };
                }

                // 🖼️ PURE IMAGE Check: naturalWidth ensures it's fully loaded
                if (img && img.complete && img.naturalWidth > 200) {
                    if (img.src && !img.src.includes('data:image')) return { url: img.src, type: 'image' };
                }

                await new Promise(r => setTimeout(r, 600)); // Check every 600ms
            }
            return null;
        }, MAX_WAIT_FOR_MEDIA);

        if (media && media.url) {
            console.log(`      ✅ Found ${media.type.toUpperCase()}. Syncing...`);
            await safeSync(media.url, username, category, media.type === 'video');
        }

        // Navigation
        await page.keyboard.press('ArrowRight');
        await new Promise(r => setTimeout(r, 2000));

        const active = await page.evaluate(() => window.location.href.includes('/stories/'));
        if (!active) break;
    }
}

async function safeSync(url, username, category, isVideo = false) {
  try {
    const mediaId = url.split('?')[0].split('/').pop().substring(0, 40); 
    const docId = `V21_${username}_${mediaId}`; 
    const docRef = db.collection("archives").doc(docId);
    
    if (!FORCE_RE_SYNC) {
        const doc = await docRef.get();
        if (doc.exists) return;
    }

    // 🚀 Force Cloudinary to treat as video if audio is expected
    const upload = await cloudinary.uploader.upload(url, { 
        folder: `insta_vault_v21/${username}/${category}`, 
        resource_type: isVideo ? "video" : "image",
        invalidate: true
    });

    await docRef.set({ 
        owner: username, url: upload.secure_url, type: category, 
        has_audio: isVideo, time: admin.firestore.FieldValue.serverTimestamp() 
    });
    console.log(`      ✨ [SYNCED] ${isVideo ? '📹 Video/Music Status' : '🖼️ Clean Photo'}`);
  } catch (e) {
    console.log("      ❌ Sync Failed: " + e.message);
  }
}

runBot();
