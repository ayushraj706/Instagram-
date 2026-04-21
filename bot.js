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
  console.log("🚀 GHOST_ENGINE: V17 - Auto-Pilot Highlight & Story Deep Player...");
  
  const browser = await puppeteer.launch({ 
    headless: "new", 
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ] 
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 }); 
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1');

  const videoPath = path.join(__dirname, 'ghost_deep_archives.mp4');
  const recorder = new PuppeteerScreenRecorder(page, {
    followNewTab: true,
    fps: 25,
    videoFrame: { width: 390, height: 844 },
    aspectRatio: '9:16',
  });

  try {
    // Recording setup
    await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle2' });
    await recorder.start(videoPath);
    console.log("⏺️ Recording Started...");

    if (process.env.INSTA_COOKIES) {
        console.log("🍪 Injecting Fresh Cookies...");
        await page.setCookie(...JSON.parse(process.env.INSTA_COOKIES));
        await page.reload({ waitUntil: 'networkidle2' });
    }

    const targets = ["_anshu_2101", "_cool_butterfly_.6284", "dee_pu3477", "ritu_singh785903"];

    for (const user of targets) {
      console.log(`\n🔍 [MISSION: @${user}] Deep Archiving Starts...`);
      
      // --- STEP 1: DP & Profile Scan ---
      await page.goto(`https://www.instagram.com/${user}/`, { waitUntil: 'networkidle2' });
      await new Promise(r => setTimeout(r, 4000));

      const dpUrl = await page.evaluate(() => document.querySelector('header img')?.src);
      if (dpUrl) await safeUpload(dpUrl, user, 'profile_pic');

      // --- STEP 2: ACTIVE STORIES (Status) ---
      console.log(`📸 Checking Active Stories...`);
      await page.goto(`https://www.instagram.com/stories/${user}/`, { waitUntil: 'networkidle2' });
      await new Promise(r => setTimeout(r, 5000));
      
      // Story ke andar ki saari slides capture karna
      await captureViewerSlides(page, user, 'stories');

      // --- STEP 3: HIGHLIGHTS (Deep Click & Play) ---
      console.log(`📂 Scanning Highlights...`);
      await page.goto(`https://www.instagram.com/${user}/`, { waitUntil: 'networkidle2' });
      
      // Highlights ke bubbles dhoondho
      const highlightIndices = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('ul li div[role="link"], ul li[role="checkbox"]')).map((_, i) => i);
      });

      console.log(`✨ Found ${highlightIndices.length} Highlight Groups. Playing each...`);

      for (const index of highlightIndices) {
          try {
              // Har highlight group ke liye wapas profile par aana zaroori h
              await page.goto(`https://www.instagram.com/${user}/`, { waitUntil: 'networkidle2' });
              const bubbles = await page.$$('ul li div[role="link"], ul li[role="checkbox"]');
              
              if (bubbles[index]) {
                  await bubbles[index].click();
                  await new Promise(r => setTimeout(r, 3000));
                  await captureViewerSlides(page, user, 'highlights');
              }
          } catch (err) {
              console.log("   ⚠️ Highlight group skip hua.");
          }
      }

      // --- STEP 4: FEED SCAN ---
      console.log(`🎞️ Final Feed Check...`);
      await page.goto(`https://www.instagram.com/${user}/`, { waitUntil: 'networkidle2' });
      const feedMedia = await page.evaluate(() => {
          const items = [];
          document.querySelectorAll('img[srcset], article img, video').forEach(el => {
              const src = el.src || el.srcset?.split(' ')[0];
              if (src && src.includes('cdninstagram.com')) items.push(src);
          });
          return [...new Set(items)];
      });
      for (const mUrl of feedMedia) await safeUpload(mUrl, user, mUrl.includes('.mp4') ? 'videos' : 'posts');
    }

  } catch (error) {
    console.error("❌ CRITICAL ERROR:", error.message);
  } finally {
    await recorder.stop();
    await browser.close();
    console.log("⏹️ Bot Mission Finished.");
  }
}

/**
 * Story/Highlight Viewer mein "Next" daba kar har slide capture karne ka logic
 */
async function captureViewerSlides(page, username, category) {
    for (let i = 0; i < 15; i++) { // Max 15 slides per story/highlight (safety)
        const slideMedia = await page.evaluate(() => {
            const vid = document.querySelector('video source')?.src;
            const img = document.querySelector('img[decode="sync"]')?.src;
            return vid || img;
        });

        if (slideMedia) {
            await safeUpload(slideMedia, username, category);
        }

        // "Next" button dhoondho aur click karo
        const hasNext = await page.evaluate(() => {
            const nextBtn = document.querySelector('button[aria-label="Next"], ._ac3b');
            if (nextBtn) {
                nextBtn.click();
                return true;
            }
            return false;
        });

        if (!hasNext) break; 
        await new Promise(r => setTimeout(r, 2500)); // Slide change hone ka wait
    }
}

async function safeUpload(url, username, category) {
  try {
    const mediaId = url.split('?')[0].split('/').pop().substring(0, 50); 
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
    console.log(`      ✨ [NEW] Saved to ${category}`);
  } catch (e) {}
}

runBot();
