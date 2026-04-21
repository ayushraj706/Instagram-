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
  console.log("🚀 GHOST_ENGINE: V15 - Cookie Injection & High-Def Recording...");
  
  const browser = await puppeteer.launch({ 
    headless: "new", // GitHub Actions ke liye 'new' best h
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1280,720'
    ] 
  });
  
  const page = await browser.newPage();
  
  // Mobile Viewport Force (iPhone 13 Pro layout)
  await page.setViewport({ width: 390, height: 844 }); 
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1');

  const videoPath = path.join(__dirname, 'ghost_action.mp4');
  const recorder = new PuppeteerScreenRecorder(page, {
    followNewTab: true,
    fps: 25, // Strong video ke liye FPS badha diya
    videoFrame: { width: 390, height: 844 },
    aspectRatio: '9:16',
  });

  try {
    // 1. Start Recording BEFORE anything else
    await recorder.start(videoPath);
    console.log("⏺️ Recording Started...");

    // --- 🍪 STEP: COOKIE INJECTION (Tumhare App wala Data) ---
    if (process.env.INSTA_COOKIES) {
        console.log("🍪 Injecting Secret Cookies from App...");
        const cookies = JSON.parse(process.env.INSTA_COOKIES);
        await page.setCookie(...cookies);
    }

    // 2. Visit Instagram
    console.log("🌐 Opening Instagram...");
    await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 5000)); // Render hone ka wait karo

    // 3. Verification: Kya hum login ho chuke hain?
    let isLoggedIn = await page.evaluate(() => {
        return !!document.querySelector('svg[aria-label="Home"]') || !!document.querySelector('nav');
    });

    // --- 🛠️ FALLBACK: Agar Cookie kaam nahi ki toh Manual Login ---
    if (!isLoggedIn && process.env.INSTA_PASS) {
        console.log("⚠️ Cookies failed or expired. Trying Manual Login...");
        await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'networkidle2' });
        
        const targetUser = process.env.INSTA_USER || "ayush_raj6888";
        const targetPass = process.env.INSTA_PASS;

        await page.waitForSelector('input[name="username"]', { visible: true });
        await page.type('input[name="username"]', targetUser, { delay: 100 });
        await page.type('input[name="password"]', targetPass, { delay: 100 });
        
        await page.click('button[type="submit"]');
        console.log("⏳ Waiting for manual login redirect...");
        await new Promise(r => setTimeout(r, 15000));
        
        isLoggedIn = await page.evaluate(() => !!document.querySelector('nav'));
    }

    if (!isLoggedIn) {
      console.log("❌ LOGIN FAIL: Check the video later.");
    } else {
      console.log("✅ LOGIN SUCCESS! Bot is in.");

      const targets = ["_anshu_2101", "_cool_butterfly_.6284", "dee_pu3477", "ritu_singh785903"];
      
      for (const user of targets) {
        console.log(`📡 Scanning: @${user}`);
        await page.goto(`https://www.instagram.com/${user}/`, { waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 5000)); // Strong video ke liye wait
        
        // Screenshot for debug
        console.log(`📸 Capturing @${user}`);
        
        const media = await page.evaluate(() => {
          const results = [];
          const items = document.querySelectorAll('img[srcset], article img, video, div._aagv img');
          items.forEach(el => {
            const src = el.src || el.srcset?.split(' ')[0];
            if (src && src.includes('cdninstagram.com')) results.push(src);
          });
          return [...new Set(results)];
        });

        console.log(`📊 Found ${media.length} items for @${user}`);
        for (const mUrl of media) {
            await safeUpload(mUrl, user, mUrl.includes('.mp4') ? 'videos' : 'posts');
        }
      }
    }

  } catch (error) {
    console.error("❌ CRITICAL ERROR:", error.message);
  } finally {
    console.log("⏹️ Mission Complete. Stopping Recorder...");
    await recorder.stop();
    await browser.close();
    
    // Video upload to Cloudinary for proof
    if (fs.existsSync(videoPath)) {
      console.log("☁️ Uploading Evidence Video...");
      await cloudinary.uploader.upload(videoPath, { 
        resource_type: "video", 
        folder: "ghost/sessions",
        public_id: `session_${Date.now()}`
      }).then(res => console.log("🎬 Video Link:", res.secure_url))
      .catch(e => console.log("Video Upload Error:", e.message));
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

    const upload = await cloudinary.uploader.upload(url, { 
        folder: `insta_vault/${username}/${category}`, 
        resource_type: "auto" 
    });

    await docRef.set({ 
        owner: username, 
        url: upload.secure_url, 
        type: category, 
        time: admin.firestore.FieldValue.serverTimestamp() 
    });
    console.log(`      ✅ Saved to Vault: ${category}`);
  } catch (e) {
    console.log("      ❌ Upload Skip");
  }
}

runBot();
