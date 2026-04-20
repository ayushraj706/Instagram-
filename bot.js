const puppeteer = require('puppeteer');
const cloudinary = require('cloudinary').v2;
const admin = require('firebase-admin');

// Cloudinary Config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Firebase Setup
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_KEY))
  });
}
const db = admin.firestore();

async function runBot() {
  console.log("🚀 GHOST_ENGINE: Sniper Mode Activated. Scanning 4 Targets...");
  const browser = await puppeteer.launch({ 
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox'] 
  });
  
  const page = await browser.newPage();
  // Mobile iPhone view simulate karna zaroori hai
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1');

  try {
    const cookies = JSON.parse(process.env.INSTA_COOKIES);
    await page.setCookie(...cookies);

    const targetUsers = ["_anshu_2101", "_cool_butterfly_.6284", "dee_pu3477", "ritu_singh785903"];

    for (const user of targetUsers) {
      console.log(`\n---------------------------------`);
      console.log(`📡 TARGETING: @${user}`);
      console.log(`---------------------------------`);

      // STEP 1: PROFILE & POSTS (Deep Scan)
      await page.goto(`https://www.instagram.com/${user}/`, { waitUntil: 'networkidle2' });
      await new Promise(r => setTimeout(r, 4000));

      const dpUrl = await page.evaluate(() => {
        const img = document.querySelector('header img') || document.querySelector('img[alt*="profile picture"]');
        return img ? img.src : null;
      });
      if(dpUrl) await safeUpload(dpUrl, user, 'profile_pic');

      console.log(`  └─ Scanning Posts & Reels...`);
      let posts = new Set();
      for (let i = 0; i < 4; i++) { // Scroll to get more content
        const found = await page.evaluate(() => {
          const imgs = Array.from(document.querySelectorAll('article img')).map(el => el.src);
          const vids = Array.from(document.querySelectorAll('article video')).map(el => el.src || el.querySelector('source')?.src);
          return [...imgs, ...vids].filter(src => src && src.includes('cdninstagram.com'));
        });
        found.forEach(item => posts.add(item));
        await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
        await new Promise(r => setTimeout(r, 2000));
      }
      for (const url of Array.from(posts)) await safeUpload(url, user, url.includes('.mp4') ? 'videos' : 'posts');

      // STEP 2: ACTIVE STORIES
      console.log(`  └─ Checking Active Stories...`);
      await page.goto(`https://www.instagram.com/stories/${user}/`, { waitUntil: 'networkidle2' });
      await new Promise(r => setTimeout(r, 3000));
      const stories = await page.evaluate(() => {
        const media = Array.from(document.querySelectorAll('img[srcset], video source')).map(el => el.src || el.srcset);
        return media.filter(m => m && m.includes('cdninstagram'));
      });
      for (const sUrl of stories) await safeUpload(sUrl, user, 'stories');

      // STEP 3: HIGHLIGHTS (SAVED STORIES)
      // Ye highlights ke section ko target karega
      console.log(`  └─ Checking Highlights...`);
      await page.goto(`https://www.instagram.com/${user}/`, { waitUntil: 'networkidle2' });
      const highlightLinks = await page.evaluate(() => {
          // Highlights ke circles ka link nikalna
          return Array.from(document.querySelectorAll('a[href*="/stories/highlights/"]')).map(a => a.href);
      });

      for (const hLink of highlightLinks.slice(0, 5)) { // Top 5 highlights scan
          await page.goto(hLink, { waitUntil: 'networkidle2' });
          await new Promise(r => setTimeout(r, 3000));
          const hMedia = await page.evaluate(() => {
              const items = Array.from(document.querySelectorAll('img[srcset], video source')).map(el => el.src || el.srcset);
              return items.filter(m => m && m.includes('cdninstagram'));
          });
          for (const hmUrl of hMedia) await safeUpload(hmUrl, user, 'highlights');
      }
    }

  } catch (error) {
    console.error("❌ Fatal Sniper Error:", error.message);
  } finally {
    await browser.close();
    console.log("🏁 All targets cleared. Ghost Engine going to sleep.");
  }
}

// THE SMART BRAIN: No duplicates allowed
async function safeUpload(url, username, category) {
  try {
    // Unique ID generation (Filename filter)
    const mediaId = url.split('?')[0].split('/').pop().substring(0, 45); 
    const docId = `${username}_${mediaId}`;

    const docRef = db.collection("archives").doc(docId);
    const doc = await docRef.get();

    // Agar Firebase mein ye ID hai, toh bot ise ignore kar dega
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

    console.log(`    ➕ NEW DATA SAVED: [${category}] @${username}`);
  } catch (e) {
    // Fail silently to keep the loop running
  }
}

runBot();
