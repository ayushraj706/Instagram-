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
  console.log("🚀 GHOST_ENGINE: Auto-Login Sniper Mode Activated...");
  
  const browser = await puppeteer.launch({ 
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'] 
  });
  
  const page = await browser.newPage();
  // iPhone Simulation for Mobile UI
  await page.setViewport({ width: 390, height: 844 });
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1');

  try {
    // --- STEP 1: DIRECT LOGIN ---
    console.log(`🔑 Logging in as: ${process.env.INSTA_USER}`);
    await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 5000));

    // Username aur Password type karna
    await page.type('input[name="username"]', process.env.INSTA_USER, { delay: 150 });
    await page.type('input[name="password"]', process.env.INSTA_PASS, { delay: 150 });
    
    // Login button click
    await Promise.all([
        page.click('button[type="submit"]'),
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 })
    ]);

    console.log("⏳ Checking Login Status...");
    await new Promise(r => setTimeout(r, 10000)); // Buffer for redirects

    // Login Verification
    const loginCheck = await page.evaluate(() => !document.body.innerText.includes('Log In'));
    if (!loginCheck) {
        console.log("❌ LOGIN FAILED: Instagram security blocked the login.");
        // Debug Screenshot if failed
        const failImg = await page.screenshot();
        await cloudinary.uploader.upload_stream({ folder: "debug", public_id: "login_failed" }, (e, r) => {}).end(failImg);
        return;
    }
    console.log("✅ LOGIN SUCCESS: Ghost is inside!");

    // --- STEP 2: TARGET SCANNING ---
    const targetUsers = ["_anshu_2101", "_cool_butterfly_.6284", "dee_pu3477", "ritu_singh785903"];

    for (const user of targetUsers) {
      console.log(`\n📡 TARGETING: @${user}`);
      await page.goto(`https://www.instagram.com/${user}/`, { waitUntil: 'networkidle2' });
      await new Promise(r => setTimeout(r, 6000));

      // Media Scraper (Posts/Reels/Stories)
      const mediaFound = await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('img[srcset], article img, video, div._aagv img'))
                           .map(el => el.src || el.srcset?.split(' ')[0] || el.querySelector('source')?.src)
                           .filter(src => src && src.includes('cdninstagram.com'));
        return [...new Set(items)];
      });

      console.log(`   📊 Found ${mediaFound.length} items for @${user}`);
      for (const mUrl of mediaFound) {
        await safeUpload(mUrl, user, mUrl.includes('.mp4') ? 'videos' : 'posts');
      }

      // Special Highlights Snipe for dee_pu3477
      if (user === "dee_pu3477") {
          console.log(`   └─ Sniping Highlights...`);
          await page.goto(`https://www.instagram.com/stories/highlights/18059274617459516/`, { waitUntil: 'networkidle2' });
          await new Promise(r => setTimeout(r, 5000));
          const hMedia = await page.evaluate(() => {
            const s = Array.from(document.querySelectorAll('img[srcset], video source')).map(el => el.src || el.srcset?.split(' ')[0]);
            return s.filter(src => src && src.includes('cdninstagram'));
          });
          for (const hmUrl of hMedia) await safeUpload(hmUrl, user, 'highlights');
      }
    }

  } catch (error) {
    console.error("❌ Fatal Sniper Error:", error.message);
  } finally {
    await browser.close();
    console.log("🏁 All targets cleared. Ghost Engine Standby.");
  }
}

// deduplication upload logic
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
    console.log(`      ✅ Saved [${category}]`);
  } catch (e) {}
}

runBot();
