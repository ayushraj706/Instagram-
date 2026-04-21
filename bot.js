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

async function runBot() {
  console.log("🚀 GHOST_ENGINE: V16 - Deep Story & Highlight Archiver...");
  
  const browser = await puppeteer.launch({ 
    headless: "new", 
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ] 
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 }); 
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1');

  const videoPath = path.join(__dirname, 'ghost_deep_scan.mp4');
  const recorder = new PuppeteerScreenRecorder(page, {
    followNewTab: true,
    fps: 25,
    videoFrame: { width: 390, height: 844 },
    aspectRatio: '9:16',
  });

  try {
    // Recording shuru karne se pehle warm up
    await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle2' });
    await recorder.start(videoPath);
    console.log("⏺️ Recording Started...");

    // 1. COOKIE INJECTION
    if (process.env.INSTA_COOKIES) {
        console.log("🍪 Injecting Fresh Cookies...");
        await page.setCookie(...JSON.parse(process.env.INSTA_COOKIES));
        await page.reload({ waitUntil: 'networkidle2' });
    }

    // 2. LOGIN CHECK
    const isLoggedIn = await page.evaluate(() => !!document.querySelector('nav') || !!document.querySelector('svg[aria-label="Home"]'));

    if (!isLoggedIn) {
      console.log("❌ LOGIN FAIL: Cookies expired or invalid.");
      return;
    }

    const targets = ["_anshu_2101", "_cool_butterfly_.6284", "dee_pu3477", "ritu_singh785903"];

    for (const user of targets) {
      console.log(`\n🔍 [TARGET: @${user}] Starting Deep Scan...`);
      
      // --- STEP A: PROFILE & DP ---
      await page.goto(`https://www.instagram.com/${user}/`, { waitUntil: 'networkidle2' });
      await new Promise(r => setTimeout(r, 5000));

      const dpUrl = await page.evaluate(() => {
          const img = document.querySelector('header img');
          return img ? img.src : null;
      });
      if (dpUrl) await safeUpload(dpUrl, user, 'profile_pic');

      // --- STEP B: STORIES (Private accounts ki jaan) ---
      console.log(`📸 Checking @${user}'s Live Story...`);
      await page.goto(`https://www.instagram.com/stories/${user}/`, { waitUntil: 'networkidle2' });
      await new Promise(r => setTimeout(r, 6000));

      const storyMedia = await page.evaluate(() => {
          const res = [];
          const video = document.querySelector('video source');
          const img = document.querySelector('img[decode="sync"]');
          if (video) res.push(video.src);
          if (img) res.push(img.src);
          return res;
      });
      for (const sUrl of storyMedia) await safeUpload(sUrl, user, 'active_stories');

      // --- STEP C: HIGHLIGHTS (Hidden Stories) ---
      console.log(`📂 Checking Highlights for @${user}...`);
      await page.goto(`https://www.instagram.com/${user}/`, { waitUntil: 'networkidle2' });
      
      const highlights = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('ul li[role="checkbox"] img'))
                .map(img => img.src);
      });

      console.log(`📊 Found ${highlights.length} Highlight groups.`);
      for (const hThumb of highlights) {
          await safeUpload(hThumb, user, 'highlight_thumbnails');
      }

      // --- STEP D: FEED POSTS & REELS ---
      console.log(`🎞️ Checking Feed items...`);
      const feedMedia = await page.evaluate(() => {
          const items = [];
          document.querySelectorAll('img[srcset], article img, video').forEach(el => {
              const src = el.src || el.srcset?.split(' ')[0];
              if (src && src.includes('cdninstagram.com')) items.push(src);
          });
          return [...new Set(items)];
      });

      for (const mUrl of feedMedia) {
          const type = mUrl.includes('.mp4') ? 'videos' : 'posts';
          await safeUpload(mUrl, user, type);
      }
    }

  } catch (error) {
    console.error("❌ CRITICAL ERROR:", error.message);
  } finally {
    await recorder.stop();
    await browser.close();
    
    if (fs.existsSync(videoPath)) {
      await cloudinary.uploader.upload(videoPath, { 
        resource_type: "video", 
        folder: "ghost/deep_archives",
        public_id: `scan_${Date.now()}`
      }).then(res => console.log("🎬 Session Movie Uploaded:", res.secure_url));
    }
    console.log("⏹️ Bot Finished.");
  }
}

async function safeUpload(url, username, category) {
  try {
    // Generate Unique ID from URL
    const mediaId = url.split('?')[0].split('/').pop().substring(0, 50); 
    const docId = `${username}_${mediaId}`;
    const docRef = db.collection("archives").doc(docId);
    
    // 🔥 DEDUPLICATION: Kya ye humare paas pehle se h?
    const doc = await docRef.get();
    if (doc.exists) {
        // Agar h, toh skip (Taki Cloudinary space bache)
        return; 
    }

    // Naya item mila!
    const upload = await cloudinary.uploader.upload(url, { 
        folder: `insta_vault/${username}/${category}`, 
        resource_type: "auto" 
    });

    await docRef.set({ 
        owner: username, 
        url: upload.secure_url, 
        type: category, 
        raw_id: mediaId,
        time: admin.firestore.FieldValue.serverTimestamp() 
    });
    console.log(`      ✨ [NEW CONTENT] Saved to ${category}`);
  } catch (e) {
    // Console mein error nahi dikhayenge taki log clean rahe
  }
}

runBot();
