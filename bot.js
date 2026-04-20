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
  console.log("🚀 GHOST_ENGINE: V14 - Force Typing & Mobile Layout Fix...");
  
  const browser = await puppeteer.launch({ 
    headless: false, // Xvfb monitor ke liye false zaroori h
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ] 
  });
  
  const page = await browser.newPage();
  
  // Viewport ko Mobile (iPhone) size par force karo taaki Desktop layout na aaye
  await page.setViewport({ width: 390, height: 844 }); 
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1');

  const videoPath = path.join(__dirname, 'ghost_action.mp4');
  const recorder = new PuppeteerScreenRecorder(page, {
    followNewTab: true,
    fps: 15,
    videoFrame: { width: 390, height: 844 },
    aspectRatio: '9:16',
  });

  try {
    await recorder.start(videoPath);
    console.log("⏺️ Recording Started...");

    // 1. Visit Login
    console.log("🔑 Navigating to Login Page...");
    await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 10000));

    const targetUser = process.env.INSTA_USER || "ayush_raj6888";
    const targetPass = process.env.INSTA_PASS;

    // --- 👤 USERNAME ENTRY ---
    console.log("👤 Typing Username...");
    await page.waitForSelector('input[name="username"]', { visible: true });
    await page.click('input[name="username"]'); 
    await page.focus('input[name="username"]'); 
    await page.type('input[name="username"]', targetUser, { delay: 150 });

    // --- 🔑 PASSWORD ENTRY ---
    console.log("🔑 Typing Password...");
    await page.waitForSelector('input[name="password"]', { visible: true });
    await page.click('input[name="password"]');
    await page.focus('input[name="password"]');
    await page.type('input[name="password"]', targetPass, { delay: 150 });

    // --- 👁️ JAVASCRIPT FALLBACK (Agar typing fail hui toh force paste) ---
    await page.evaluate((u, p) => {
        const uInp = document.querySelector('input[name="username"]');
        const pInp = document.querySelector('input[name="password"]');
        if (uInp && !uInp.value) uInp.value = u;
        if (pInp && !pInp.value) pInp.value = p;
        if (pInp) pInp.type = "text"; // Video verification ke liye unhide
    }, targetUser, targetPass);

    await new Promise(r => setTimeout(r, 3000));

    // --- 🚀 LOGIN CLICK ---
    console.log("🚀 Clicking Log In Button...");
    await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const loginBtn = btns.find(b => 
            b.type === 'submit' || 
            b.innerText.toLowerCase().includes('log')
        );
        if (loginBtn) {
            loginBtn.style.border = "5px solid red"; 
            loginBtn.click();
        }
    });

    console.log("⏳ Waiting 30s for Dashboard...");
    await new Promise(r => setTimeout(r, 30000));

    // 4. Verification Check
    const isLoggedIn = await page.evaluate(() => {
        return !document.body.innerText.includes('Log In') && 
               (!!document.querySelector('nav') || !!document.querySelector('svg[aria-label="Home"]'));
    });

    if (!isLoggedIn) {
      console.log("❌ LOGIN FAIL: Video check karo, kya hua.");
    } else {
      console.log("✅ LOGIN SUCCESS! Starting sync...");
      
      const targets = ["_anshu_2101", "_cool_butterfly_.6284", "dee_pu3477", "ritu_singh785903"];
      for (const user of targets) {
        console.log(`📡 Scanning: @${user}`);
        await page.goto(`https://www.instagram.com/${user}/`, { waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 8000));
        
        const media = await page.evaluate(() => {
          const results = [];
          const items = document.querySelectorAll('img[srcset], article img, video, div._aagv img');
          items.forEach(el => {
            const src = el.src || el.srcset?.split(' ')[0] || el.querySelector('source')?.src;
            if (src && src.includes('cdninstagram.com')) results.push(src);
          });
          return [...new Set(results)];
        });

        console.log(`📊 Found ${media.length} items for @${user}`);
        for (const mUrl of media) await safeUpload(mUrl, user, mUrl.includes('.mp4') ? 'videos' : 'posts');
      }
    }

  } catch (error) {
    console.error("❌ ERROR:", error.message);
  } finally {
    await recorder.stop();
    await browser.close();
    console.log("⏹️ Recording Finished. Uploading...");
    
    if (fs.existsSync(videoPath)) {
      await cloudinary.uploader.upload(videoPath, { 
        resource_type: "video", 
        folder: "debug/recordings",
        public_id: `v14_force_fix_${Date.now()}`
      }).catch(e => console.log("Upload Error:", e.message));
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
    console.log(`      ✅ Saved: ${category}`);
  } catch (e) {}
}

runBot();
