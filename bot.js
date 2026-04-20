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
  console.log("🚀 GHOST_ENGINE: Sniper Mode V12 (Ultra-Slow Stealth)...");
  
  const browser = await puppeteer.launch({ 
    headless: "new",
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox', 
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-blink-features=AutomationControlled'
    ] 
  });
  
  const page = await browser.newPage();
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
    console.log("🔑 Opening Login Page...");
    await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 5000)); // Page load hone ka wait

    // 2. Typing with Slow Delay (350ms per character)
    const targetUser = process.env.INSTA_USER || "ayush_raj6888";
    const targetPass = process.env.INSTA_PASS;

    console.log("👤 Typing Username (Slow)...");
    await page.type('input[name="username"]', targetUser, { delay: 350 });
    await new Promise(r => setTimeout(r, 3000)); // Gap between fields
    
    console.log("🔑 Typing Password (Slow)...");
    await page.type('input[name="password"]', targetPass, { delay: 350 });
    await new Promise(r => setTimeout(r, 3000));

    // Password Unhide (Verification ke liye zaroori h)
    await page.evaluate(() => {
      const p = document.querySelector('input[name="password"]');
      if (p) p.type = "text";
    });
    await new Promise(r => setTimeout(r, 2000));

    // 3. AGGRESSIVE CLICK LOGIC
    console.log("🚀 Attempting to Click Login Button...");
    const loginClicked = await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => 
            b.type === 'submit' || 
            b.innerText.toLowerCase().includes('log') || 
            b.textContent.toLowerCase().includes('log')
        );
        if (btn) {
            btn.style.backgroundColor = "red"; // Video mein dikhega ki target hua
            btn.click();
            return true;
        }
        return false;
    });

    if (!loginClicked) {
        console.log("⚠️ Button direct nahi mila, forcing submit...");
        await page.keyboard.press('Enter');
    }

    console.log("⏳ Waiting for Dashboard (30 seconds)...");
    await new Promise(r => setTimeout(r, 30000)); // Redirect ke liye zyada wait

    // 4. Verification Check
    const loginSuccess = await page.evaluate(() => {
        return !document.body.innerText.includes('Log In') && 
               (!!document.querySelector('nav') || !!document.querySelector('a[href*="/direct/inbox/"]'));
    });

    if (!loginSuccess) {
      console.log("❌ LOGIN FAIL: Check the video if it asked for OTP or just refreshed.");
    } else {
      console.log("✅ LOGIN SUCCESS! Starting targets...");
      
      const targets = ["_anshu_2101", "_cool_butterfly_.6284", "dee_pu3477", "ritu_singh785903"];
      for (const user of targets) {
        console.log(`📡 Scanning: @${user}`);
        await page.goto(`https://www.instagram.com/${user}/`, { waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 10000)); // Profile load hone ka wait
        
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
        public_id: `stealth_v12_${Date.now()}`
      }).catch(e => console.log("Video Upload Error:", e.message));
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
    console.log(`✅ Saved: ${category}`);
  } catch (e) {}
}

runBot();
