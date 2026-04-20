const puppeteer = require('puppeteer');
const cloudinary = require('cloudinary').v2;
const admin = require('firebase-admin');

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
  console.log("🚀 BASEKEY_GHOST_VAULT: Starting Deep Mirror for Specific IDs...");
  const browser = await puppeteer.launch({ 
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox'] 
  });
  
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1');

  try {
    const cookies = JSON.parse(process.env.INSTA_COOKIES);
    await page.setCookie(...cookies);

    // 1. Tumhari requested IDs
    const targetUsers = [
      "_anshu_2101", 
      "_cool_butterfly_.6284", 
      "dee_pu3477", 
      "ritu_singh785903"
    ];

    for (const user of targetUsers) {
      console.log(`\n📂 Scraping @${user} (Private Access)`);
      await page.goto(`https://www.instagram.com/${user}/`, { waitUntil: 'networkidle2' });
      await new Promise(r => setTimeout(r, 5000));

      // 2. Profile Picture (DP)
      const dpUrl = await page.evaluate(() => {
        const img = document.querySelector('header img') || document.querySelector('img[alt*="profile picture"]');
        return img ? img.src : null;
      });
      if(dpUrl) await safeUpload(dpUrl, user, 'profile_pic');

      // 3. Saved Stories (Highlights) - Following button ke niche wale
      console.log(`  └─ Extracting Highlights (Saved Stories)...`);
      const highlightUrls = await page.evaluate(() => {
        // Highlights ke circles aksar images hote hain
        const circles = Array.from(document.querySelectorAll('canvas')).map(c => c.closest('div')?.querySelector('img')?.src);
        return circles.filter(src => src && src.includes('cdninstagram.com'));
      });
      for (const hUrl of highlightUrls) await safeUpload(hUrl, user, 'highlights');

      // 4. Posts (Auto-Scroll)
      console.log(`  └─ Mirroring All Posts...`);
      let postUrls = new Set();
      for (let i = 0; i < 3; i++) { // Scroll limit as per requirement
        const imgs = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('article img'))
                      .map(img => img.src)
                      .filter(src => src.includes('cdninstagram.com'));
        });
        imgs.forEach(url => postUrls.add(url));
        await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
        await new Promise(r => setTimeout(r, 2000));
      }

      for (const pUrl of Array.from(postUrls)) {
        await safeUpload(pUrl, user, 'posts');
      }
      
      console.log(`✅ @${user} Data Organized in Cloudinary.`);
    }

  } catch (error) {
    console.error("❌ Fatal Error:", error.message);
  } finally {
    await browser.close();
  }
}

// SAFE UPLOAD WITH DEDUPLICATION (Ek photo bar-bar change/repeat nahi hogi)
async function safeUpload(url, username, category) {
  try {
    // Unique ID based on URL filename (Instagram generates unique IDs for every media)
    const mediaId = url.split('?')[0].split('/').pop(); 
    const docId = `${username}_${mediaId}`;

    const docRef = db.collection("archives").doc(docId);
    const doc = await docRef.get();

    // Check if already archived to prevent repetition
    if (doc.exists) return; 

    const upload = await cloudinary.uploader.upload(url, {
      folder: `insta_vault/${username}/${category}`, // Folder structure by User
      resource_type: "auto"
    });

    await docRef.set({
      owner: username,
      url: upload.secure_url,
      type: category,
      media_id: mediaId,
      time: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`  ➕ New ${category} saved for ${username}`);
  } catch (e) {
    // Skip on error
  }
}

runBot();
