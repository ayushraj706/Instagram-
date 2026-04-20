const puppeteer = require('puppeteer');
const { PuppeteerScreenRecorder } = require('puppeteer-screen-recorder'); // Naya package
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
  console.log("🚀 GHOST_ENGINE: Video Recording Mode Activated...");
  
  const browser = await puppeteer.launch({ 
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'] 
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1');

  // --- 🎥 VIDEO RECORDER SETUP ---
  const videoPath = path.join(__dirname, 'ghost_action.mp4');
  const recorder = new PuppeteerScreenRecorder(page, {
    followNewTab: true,
    fps: 15,
    ffmpeg_Path: null, // Default system ffmpeg use karega
    videoFrame: { width: 390, height: 844 },
    aspectRatio: '9:16',
  });

  try {
    await recorder.start(videoPath);
    console.log("⏺️ Recording Started...");

    // 1. Initial Load
    await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 8000));

    // 2. Account Check & Login
    const targetUser = process.env.INSTA_USER || "ayush_raj6888";
    
    // Choose Account (if modal exists)
    await page.evaluate((user) => {
      const elements = Array.from(document.querySelectorAll('*'));
      const target = elements.find(el => el.textContent.trim() === user);
      if (target) {
        const btn = target.closest('button') || target.closest('div[role="button"]') || target;
        btn.click();
      }
    }, targetUser);
    await new Promise(r => setTimeout(r, 5000));

    // Fill Credentials
    const userField = await page.$('input[name="username"]');
    if (userField) {
      const currentVal = await page.evaluate(el => el.value, userField);
      if (!currentVal) await page.type('input[name="username"]', targetUser, { delay: 100 });
    }

    const passField = await page.$('input[name="password"]');
    if (passField) {
      await page.type('input[name="password"]', process.env.INSTA_PASS, { delay: 100 });
      
      // Password Unhide (Verification ke liye)
      await page.evaluate(() => {
        const passInput = document.querySelector('input[name="password"]');
        if (passInput) passInput.type = "text";
      });
      await new Promise(r => setTimeout(r, 3000));
      
      // Login Click
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const loginBtn = btns.find(b => b.textContent.includes('Log In') || b.type === 'submit');
        if (loginBtn) loginBtn.click();
      });
    }

    console.log("⏳ Processing Login... Recording in progress.");
    await new Promise(r => setTimeout(r, 20000)); // Dashboard load hone ka wait

    // 3. Targeting
    const targets = ["_anshu_2101", "_cool_butterfly_.6284", "dee_pu3477", "ritu_singh785903"];
    for (const user of targets) {
      console.log(`📡 Scanning: @${user}`);
      await page.goto(`https://www.instagram.com/${user}/`, { waitUntil: 'networkidle2' });
      await new Promise(r => setTimeout(r, 7000));
      
      // Media Scrape logic (Pichle bot jaisa hi h)
      const media = await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('img[srcset], article img, video, div._aagv img'))
                           .map(el => el.src || el.srcset?.split(' ')[0] || el.querySelector('source')?.src)
                           .filter(src => src && src.includes('cdninstagram.com'));
        return [...new Set(items)];
      });
      for (const mUrl of media) await safeUpload(mUrl, user, mUrl.includes('.mp4') ? 'videos' : 'posts');
    }

  } catch (error) {
    console.error("❌ ERROR:", error.message);
  } finally {
    await recorder.stop();
    await browser.close();
    console.log("⏹️ Recording Stopped. Uploading to Cloudinary...");
    
    // --- ☁️ VIDEO UPLOAD TO CLOUDINARY ---
    if (fs.existsSync(videoPath)) {
      await cloudinary.uploader.upload(videoPath, { 
        resource_type: "video", 
        folder: "debug/recordings",
        public_id: `ghost_session_${Date.now()}`
      }).then(() => console.log("✅ Video Uploaded Successfully!"))
        .catch(e => console.log("❌ Video Upload Failed:", e.message));
    }
  }
}

async function safeUpload(url, username, category) {
  try {
    const mediaId = url.split('?')[0].split('/').pop().substring(0, 45); 
    const docId = `${username}_${mediaId}`;
    const docRef = db.collection("archives").doc(docId);
    const doc = await docRef.get();
    if (doc.exists) return; 
    const upload = await cloudinary.uploader.upload(url, { folder: `insta_vault/${username}/${category}`, resource_type: "auto" });
    await docRef.set({ owner: username, url: upload.secure_url, type: category, time: admin.firestore.FieldValue.serverTimestamp() });
  } catch (e) {}
}

runBot();
                          
