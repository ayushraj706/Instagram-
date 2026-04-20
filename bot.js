const puppeteer = require('puppeteer');
const cloudinary = require('cloudinary').v2;
const admin = require('firebase-admin');

// 1. Cloudinary Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 2. Firebase Admin Setup
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_KEY))
  });
}
const db = admin.firestore();

async function runBot() {
  console.log("🚀 Ghost Engine Starting...");
  const browser = await puppeteer.launch({ 
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox'] 
  });
  
  const page = await browser.newPage();
  
  try {
    // 3. Set Cookies for Login
    const cookies = JSON.parse(process.env.INSTA_COOKIES);
    await page.setCookie(...cookies);
    
    console.log("📸 Accessing Instagram...");
    await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle2' });

    // 4. Logic: Capture Media (Stories/Posts)
    const mediaUrls = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img[srcset]')).map(img => img.src);
      const videos = Array.from(document.querySelectorAll('video')).map(v => v.src);
      return [...new Set([...images, ...videos])];
    });

    console.log(`Found ${mediaUrls.length} media items. Archiving...`);

    for (const url of mediaUrls) {
      if (url.startsWith('http')) {
        // Cloudinary par upload
        const upload = await cloudinary.uploader.upload(url, {
          folder: "basekey_ghost_archives",
          resource_type: "auto"
        });

        // Firestore mein entry
        await db.collection("archives").add({
          url: upload.secure_url,
          type: 'auto_capture',
          time: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    }

    // 5. Anti-Delete: Capture Messages
    await page.goto('https://www.instagram.com/direct/inbox/', { waitUntil: 'networkidle2' });
    const messages = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('div[dir="auto"]')).map(m => m.innerText);
    });

    for (const text of messages) {
       await db.collection("automation_logs").add({
         text: text,
         type: 'captured_msg',
         time: admin.firestore.FieldValue.serverTimestamp()
       });
    }

    console.log("✅ Session Finished Successfully.");

  } catch (error) {
    console.error("❌ Error during automation:", error);
  } finally {
    await browser.close();
  }
}

runBot();

