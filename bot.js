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
  console.log("🚀 GHOST_ENGINE: Stealth Sniper Mode (Fixing 429)...");
  
  const browser = await puppeteer.launch({ 
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'] 
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1');

  try {
    // 1. Cookies Load Karo
    if (process.env.INSTA_COOKIES) {
      console.log("🍪 Loading cookies to bypass login wall...");
      await page.setCookie(...JSON.parse(process.env.INSTA_COOKIES));
    }

    console.log("🔑 Opening Instagram Login Page...");
    const response = await page.goto('https://www.instagram.com/accounts/login/', { 
      waitUntil: 'networkidle2',
      timeout: 60000 
    });
    
    // --- 429 ERROR CHECK ---
    if (response.status() === 429) {
      console.log("❌ RATE LIMITED (429): Instagram ne IP block kiya hai. GitHub Actions ko thodi der rest chahiye.");
      const shot = await page.screenshot();
      await new Promise(res => cloudinary.uploader.upload_stream({ folder: "debug", public_id: "error_429_view" }, res).end(shot));
      return;
    }

    await new Promise(r => setTimeout(r, 10000)); // Thoda zyada wait loading ke liye

    // 2. Account Choose Logic (Pichle screenshot wala jugaad)
    const targetUser = process.env.INSTA_USER || "ayush_raj6888";
    const accountClicked = await page.evaluate((user) => {
      const btn = Array.from(document.querySelectorAll('*')).find(el => el.textContent.trim().includes(user));
      if (btn) {
        const clickable = btn.closest('button') || btn.closest('div[role="button"]') || btn;
        clickable.click();
        return true;
      }
      return false;
    }, targetUser);

    if (accountClicked) {
      console.log(`   🖱️ Account ${targetUser} clicked. Waiting for password field...`);
      await new Promise(r => setTimeout(r, 8000));
    }

    // 3. Password Entry
    const passwordBox = await page.$('input[name="password"]');
    if (passwordBox) {
      await page.type('input[name="password"]', process.env.INSTA_PASS, { delay: 200 });
      await page.click('button[type="submit"]');
      console.log("🚀 Submit clicked. Waiting for Dashboard...");
      await new Promise(r => setTimeout(r, 15000));
    }

    // 4. STRICT LOGIN VERIFICATION
    const isLoggedIn = await page.evaluate(() => {
        // Sirf "Log In" text na hona kaafi nahi h, humein feed ya profile icon dhoondhna hoga
        return !document.body.innerText.includes('Log In') && 
               (!!document.querySelector('nav') || !!document.querySelector('a[href*="/direct/inbox/"]'));
    });

    if (!isLoggedIn) {
      console.log("❌ LOGIN FAILED: Page didn't redirect to home.");
      const failShot = await page.screenshot();
      await new Promise(res => cloudinary.uploader.upload_stream({ folder: "debug", public_id: "final_login_fail" }, res).end(failShot));
      return;
    }
    console.log("✅ LOGIN VERIFIED: Ghost is inside. Scanning targets...");

    // 5. Target Scanning
    const targetUsers = ["_anshu_2101", "_cool_butterfly_.6284", "dee_pu3477", "ritu_singh785903"];
    for (const user of targetUsers) {
      console.log(`\n📡 SCANNING: @${user}`);
      await page.goto(`https://www.instagram.com/${user}/`, { waitUntil: 'networkidle2' });
      await new Promise(r => setTimeout(r, 8000)); // Thoda slow scan taaki block na ho

      const media = await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('img[srcset], article img, video, div._aagv img'))
                           .map(el => el.src || el.srcset?.split(' ')[0] || el.querySelector('source')?.src)
                           .filter(src => src && src.includes('cdninstagram.com'));
        return [...new Set(items)];
      });

      console.log(`   📊 @${user}: Found ${media.length} items.`);
      for (const mUrl of media) {
        await safeUpload(mUrl, user, mUrl.includes('.mp4') ? 'videos' : 'posts');
      }
    }

  } catch (error) {
    console.error("❌ ERROR:", error.message);
  } finally {
    await browser.close();
    console.log("🏁 Cycle Complete.");
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
    console.log(`      ✅ Saved [${category}]`);
  } catch (e) {}
}

runBot();
