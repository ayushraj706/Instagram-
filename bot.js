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
  console.log("🚀 GHOST_ENGINE: Evidence Mode Activated. Checking 4 Targets...");
  const browser = await puppeteer.launch({ 
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'] 
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 }); // iPhone Size
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1');

  try {
    const cookies = JSON.parse(process.env.INSTA_COOKIES);
    await page.setCookie(...cookies);

    const targetUsers = ["_anshu_2101", "_cool_butterfly_.6284", "dee_pu3477", "ritu_singh785903"];

    for (const user of targetUsers) {
      console.log(`\n📡 TARGETING: @${user}`);
      
      // 1. Profile Page
      await page.goto(`https://www.instagram.com/${user}/`, { waitUntil: 'networkidle2', timeout: 60000 });
      await new Promise(r => setTimeout(r, 7000)); // Wait for full render

      // --- DEBUG SCREENSHOT (Cloudinary par jayega) ---
      const screenshot = await page.screenshot({ fullPage: false });
      await new Promise((resolve) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: `insta_vault/debug_view`, public_id: `view_${user}`, resource_type: "image" },
          (error, result) => { 
            if(!error) console.log(`   📸 Screenshot saved to Cloudinary (debug_view folder)`);
            resolve();
          }
        );
        stream.end(screenshot);
      });

      // 2. CHECK: Login Wall ya Error?
      const checkStatus = await page.evaluate(() => {
        if(document.body.innerText.includes('Log In')) return 'LOGIN_BLOCKED';
        if(document.querySelector('header img') === null) return 'EMPTY_OR_PRIVATE';
        return 'READY';
      });
      console.log(`   🔎 Page Status: ${checkStatus}`);

      // 3. MEDIA SCRAPING (Aggressive Selectors)
      const mediaUrls = await page.evaluate(() => {
        const results = [];
        // Har wo cheez jo image ya video ho sakti hai (Posts/Reels)
        const allMedia = document.querySelectorAll('img[srcset], article img, video, div._aagv img');
        allMedia.forEach(el => {
          const src = el.src || el.srcset?.split(' ')[0] || el.querySelector('source')?.src;
          if (src && src.includes('cdninstagram.com')) results.push(src);
        });
        return [...new Set(results)];
      });

      console.log(`   📊 Found ${mediaUrls.length} items for @${user}`);
      for (const mUrl of mediaUrls) {
        await safeUpload(mUrl, user, mUrl.includes('.mp4') ? 'videos' : 'posts');
      }

      // 4. HIGHLIGHTS (Specific Link Provided by You)
      if (user === "dee_pu3477") { // Target specific highlight link
          console.log(`   └─ Sniping Specific Highlights...`);
          const highlightUrl = `https://www.instagram.com/stories/highlights/18059274617459516/`;
          await page.goto(highlightUrl, { waitUntil: 'networkidle2' });
          await new Promise(r => setTimeout(r, 5000));
          
          const hMedia = await page.evaluate(() => {
            const s = Array.from(document.querySelectorAll('img[srcset], video source')).map(el => el.src || el.srcset?.split(' ')[0]);
            return s.filter(src => src && src.includes('cdninstagram'));
          });
          console.log(`   🎬 Highlights items found: ${hMedia.length}`);
          for (const hmUrl of hMedia) await safeUpload(hmUrl, user, 'highlights');
      }
    }

  } catch (error) {
    console.error("❌ Fatal Error:", error.message);
  } finally {
    await browser.close();
    console.log("🏁 All targets cleared.");
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
    console.log(`      ✅ Saved [${category}] - ${mediaId.substring(0,10)}`);
  } catch (e) { console.log(`      ⚠️ Upload Failed: ${e.message}`); }
}

runBot();
