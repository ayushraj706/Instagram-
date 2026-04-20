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
  console.log("🚀 BASEKEY_GHOST_MAX: Deep Archive Initiated...");
  const browser = await puppeteer.launch({ 
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] 
  });
  
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1');

  try {
    const cookies = JSON.parse(process.env.INSTA_COOKIES);
    await page.setCookie(...cookies);
    
    // 1. Unified Contact List (Followers + Following)
    console.log("🔗 Extracting Contact List...");
    await page.goto('https://www.instagram.com/reels/contacts/', { waitUntil: 'networkidle2' });
    
    const targets = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="/"]'));
      return [...new Set(links.map(l => l.getAttribute('href').replace(/\//g, '')))]
             .filter(n => n.length > 3 && !['explore', 'reels', 'direct', 'accounts', 'legal', 'emails'].includes(n));
    });

    console.log(`✅ Targets Identified: ${targets.length} users.`);

    for (const user of targets) {
      console.log(`\n📂 Processing: @${user}`);
      
      // A. Profile Picture (DP) Capture
      await page.goto(`https://www.instagram.com/${user}/`, { waitUntil: 'networkidle2' });
      const dpUrl = await page.evaluate(() => {
        const img = document.querySelector('header img') || document.querySelector('img[alt*="profile picture"]');
        return img ? img.src : null;
      });
      if(dpUrl) await safeUpload(dpUrl, user, 'profile_pic');

      // B. Stories Capture (Direct URL check)
      console.log(`  └─ Checking Stories...`);
      await page.goto(`https://www.instagram.com/stories/${user}/`, { waitUntil: 'networkidle2' });
      const storyMedia = await page.evaluate(() => {
        const media = Array.from(document.querySelectorAll('img[srcset], video source')).map(el => el.src || el.srcset);
        return media.filter(m => m && m.includes('cdninstagram'));
      });
      for (const sUrl of storyMedia) await safeUpload(sUrl, user, 'story');

      // C. Deep Posts Capture (Auto-Scroll for 1000+ posts)
      await page.goto(`https://www.instagram.com/${user}/`, { waitUntil: 'networkidle2' });
      console.log(`  └─ Extracting All Posts (Scrolling)...`);
      
      let lastHeight = 0;
      let postUrls = new Set();

      while (true) {
        const newPosts = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('article img, article video'))
                      .map(el => el.src)
                      .filter(src => src && src.includes('cdninstagram'));
        });
        newPosts.forEach(url => postUrls.add(url));

        // Scroll down
        await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
        await new Promise(r => setTimeout(r, 2000)); // Wait for load
        
        let newHeight = await page.evaluate('document.body.scrollHeight');
        if (newHeight === lastHeight || postUrls.size > 2000) break; // 2000 limit for safety
        lastHeight = newHeight;
        console.log(`     - Collected ${postUrls.size} media items...`);
      }

      for (const pUrl of Array.from(postUrls)) {
        await safeUpload(pUrl, user, 'post');
      }
    }

  } catch (error) {
    console.error("❌ Fatal System Error:", error.message);
  } finally {
    await browser.close();
    console.log("🏁 All Sync Tasks Completed.");
  }
}

// DUPLICATE PROTECTION LOGIC
async function safeUpload(url, username, type) {
  try {
    // Generate a unique fingerprint from URL to avoid repeats
    const fingerprint = url.split('?')[0].split('/').pop(); 
    
    // Check Firestore if already exists
    const docRef = db.collection("archives").doc(fingerprint);
    const doc = await docRef.get();

    if (doc.exists) {
      // console.log(`  ⏩ Duplicate skipped: ${fingerprint}`);
      return;
    }

    const upload = await cloudinary.uploader.upload(url, {
      folder: `insta_vault/${username}/${type}`,
      resource_type: "auto"
    });

    await docRef.set({
      owner: username,
      cloudinary_url: upload.secure_url,
      original_fingerprint: fingerprint,
      category: type,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`  ✅ Saved ${type}: ${fingerprint.substring(0,10)}...`);
  } catch (e) {
    // Silent skip for errors
  }
}

runBot();
