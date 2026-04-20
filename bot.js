const puppeteer = require('puppeteer');
const cloudinary = require('cloudinary').v2;
const admin = require('firebase-admin');

// 1. Cloudinary Config
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
  console.log("🚀 BASEKEY_GHOST_VAULT: Starting Bulk Sync...");
  const browser = await puppeteer.launch({ 
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox'] 
  });
  
  const page = await browser.newPage();
  // Mobile View simulate karna zaroori hai fast loading ke liye
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/04.1');

  try {
    // 3. Set Cookies for Login
    const cookies = JSON.parse(process.env.INSTA_COOKIES);
    await page.setCookie(...cookies);
    
    console.log("📸 Logged in. Fetching Follower list...");
    // Direct Following/Followers list par jana
    await page.goto('https://www.instagram.com/reels/contacts/', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 5000));

    // 4. Followers ke Usernames nikalna
    const followers = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="/"]'));
      const names = links.map(l => l.getAttribute('href').replace(/\//g, ''));
      return [...new Set(names)].filter(n => n.length > 3 && !['explore', 'reels', 'direct'].includes(n));
    });

    console.log(`Found ${followers.length} targets. Starting Individual Mirroring...`);

    // 5. Ek-ek follower ki profile par ja kar data archive karna
    for (const user of followers.slice(0, 10)) { // Safety ke liye ek baar mein 10 users
      console.log(`📡 Mirroring User: @${user}`);
      await page.goto(`https://www.instagram.com/${user}/`, { waitUntil: 'networkidle2' });
      await new Promise(r => setTimeout(r, 3000));

      const mediaUrls = await page.evaluate(() => {
        const imgs = Array.from(document.querySelectorAll('img')).map(i => i.src);
        const vids = Array.from(document.querySelectorAll('video')).map(v => v.src);
        return [...new Set([...imgs, ...vids])].filter(url => url.includes('cdninstagram.com'));
      });

      for (const url of mediaUrls) {
        try {
          const upload = await cloudinary.uploader.upload(url, {
            folder: `insta_vault/${user}`, // Har user ka alag folder banega
            resource_type: "auto"
          });

          await db.collection("archives").add({
            owner: user,
            url: upload.secure_url,
            type: url.includes('.mp4') ? 'video' : 'image',
            time: admin.firestore.FieldValue.serverTimestamp()
          });
        } catch (err) {
          console.log(`⏩ Item skipped for ${user}`);
        }
      }
    }

    console.log("✅ Bulk Sync Finished. Check Cloudinary Folders.");

  } catch (error) {
    console.error("❌ Fatal Error:", error.message);
  } finally {
    await browser.close();
  }
}

runBot();
