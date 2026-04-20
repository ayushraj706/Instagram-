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
  console.log("🚀 GHOST_ENGINE: Sniper Mode V3 (Debug Active)...");
  const browser = await puppeteer.launch({ 
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox'] 
  });
  
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1');

  try {
    const cookies = JSON.parse(process.env.INSTA_COOKIES);
    await page.setCookie(...cookies);

    const targetUsers = ["_anshu_2101", "_cool_butterfly_.6284", "dee_pu3477", "ritu_singh785903"];

    for (const user of targetUsers) {
      console.log(`\n📡 SCANNING TARGET: @${user}`);
      
      // 1. Profile Page Load Check
      await page.goto(`https://www.instagram.com/${user}/`, { waitUntil: 'networkidle2', timeout: 60000 });
      await new Promise(r => setTimeout(r, 5000));

      const pageTitle = await page.title();
      console.log(`   📄 Page Title: ${pageTitle}`);

      // Check if Login Wall is blocking us
      const isBlocked = await page.evaluate(() => document.body.innerText.includes('Log In') || document.body.innerText.includes('Sign Up'));
      if(isBlocked) {
        console.log(`   ❌ ALERT: Cookies Expired ya Account Blocked! Bot ko Login screen dikh rahi hai.`);
        continue;
      }

      // 2. Profile Pic
      const dpUrl = await page.evaluate(() => {
        const img = document.querySelector('header img') || document.querySelector('img[alt*="profile picture"]');
        return img ? img.src : null;
      });
      if(dpUrl) await safeUpload(dpUrl, user, 'profile_pic');

      // 3. Posts & Reels (Using more aggressive selectors)
      console.log(`   └─ Searching for Posts...`);
      let mediaFound = new Set();
      
      for (let i = 0; i < 3; i++) {
        const batch = await page.evaluate(() => {
          // Instagram posts often use 'img[srcset]' for high quality
          const imgs = Array.from(document.querySelectorAll('article img, div._aagv img, img[srcset]')).map(el => el.src);
          const vids = Array.from(document.querySelectorAll('video')).map(el => el.src || el.querySelector('source')?.src);
          return [...imgs, ...vids].filter(src => src && src.includes('cdninstagram.com'));
        });
        batch.forEach(url => mediaFound.add(url));
        
        if(i < 2) {
          await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
          await new Promise(r => setTimeout(r, 2000));
        }
      }

      console.log(`   📊 Found ${mediaFound.size} total items for @${user}`);

      for (const mUrl of Array.from(mediaFound)) {
        await safeUpload(mUrl, user, mUrl.includes('.mp4') ? 'videos' : 'posts');
      }

      // 4. Active Stories
      console.log(`   └─ Checking Stories...`);
      await page.goto(`https://www.instagram.com/stories/${user}/`, { waitUntil: 'networkidle2' });
      await new Promise(r => setTimeout(r, 3000));
      
      const stories = await page.evaluate(() => {
        const s = Array.from(document.querySelectorAll('img[srcset], video source')).map(el => el.src || el.srcset?.split(' ')[0]);
        return s.filter(src => src && src.includes('cdninstagram'));
      });
      
      console.log(`   🎬 Found ${stories.length} active stories.`);
      for (const sUrl of stories) await safeUpload(sUrl, user, 'stories');
    }

  } catch (error) {
    console.error("❌ SNIPER FATAL ERROR:", error.message);
  } finally {
    await browser.close();
    console.log("\n🏁 All targets processed. System Standby.");
  }
}

// FIXED SAFE UPLOAD (Logging ke saath)
async function safeUpload(url, username, category) {
  try {
    const mediaId = url.split('?')[0].split('/').pop().substring(0, 40); 
    const docId = `${username}_${mediaId}`;

    const docRef = db.collection("archives").doc(docId);
    const doc = await docRef.get();

    if (doc.exists) return; // Silent skip for duplicates

    // Upload to Cloudinary
    const upload = await cloudinary.uploader.upload(url, {
      folder: `insta_vault/${username}/${category}`,
      resource_type: "auto"
    });

    // Save to Firebase
    await docRef.set({
      owner: username,
      url: upload.secure_url,
      type: category,
      time: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`      ✅ SAVED: [${category}] - ID: ${mediaId.substring(0,10)}...`);
  } catch (e) {
    console.log(`      ⚠️ UPLOAD FAILED: ${e.message}`);
  }
}

runBot();
