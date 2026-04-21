const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const { PuppeteerScreenRecorder } = require('puppeteer-screen-recorder');
const cloudinary = require('cloudinary').v2;
const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const fs = require('fs');

// ⚙️ CONFIG
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_KEY)) });
}
const db = admin.firestore();

const MAX_WAIT_FOR_MEDIA = 40000; // 40 seconds max wait
const POLL_INTERVAL = 800; // Check every 800ms for faster detection

async function runBot() {
  console.log("🚀 GHOST_ENGINE: V26 - MULTI-PATHWAY FALLBACK SYSTEM ACTIVATED...");
  const browser = await puppeteer.launch({ 
    headless: "new", 
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox', 
      '--disable-blink-features=AutomationControlled',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process'
    ] 
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1920 });

  // Enable request interception to catch media URLs
  await page.setRequestInterception(true);
  const capturedMediaUrls = new Set();
  
  page.on('request', (request) => {
    const url = request.url();
    // Capture video/image URLs from network requests
    if ((url.includes('.mp4') || url.includes('.jpg') || url.includes('.jpeg') || url.includes('.png')) && 
        url.startsWith('http') && 
        !url.includes('profile_pic')) {
      capturedMediaUrls.add(url);
    }
    request.continue();
  });

  try {
    await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle2' });
    
    if (process.env.INSTA_COOKIES) {
        console.log("🍪 Applying Cookies...");
        await page.setCookie(...JSON.parse(process.env.INSTA_COOKIES));
        await page.reload({ waitUntil: 'networkidle2' });
    }

    const targets = ["_anshu_2101", "_cool_butterfly_.6284", "dee_pu3477", "ritu_singh785903"];

    // 🎥 START RECORDING BEFORE FIRST TARGET (X-RAY DEBUGGER)
    console.log("🎥 Starting X-Ray Debug Recording (First Target Hunt)...");
    const recorder = new PuppeteerScreenRecorder(page);
    await recorder.start('hunting_debug.mp4');
    let recordingStopped = false;

    for (let targetIndex = 0; targetIndex < targets.length; targetIndex++) {
      const user = targets[targetIndex];
      console.log(`\n🕵️ Target Locked: @${user}`);
      
      // 1. Profile Page scan for Highlights
      await page.goto(`https://www.instagram.com/${user}/`, { waitUntil: 'networkidle2' });
      await new Promise(r => setTimeout(r, 3000));
      
      const highlightLinks = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('a[href*="/stories/highlights/"]')).map(a => a.href);
      });
      console.log(`   🔍 Found ${highlightLinks.length} Highlights for @${user}`);

      // 2. Stories Scan
      console.log(`   📸 Checking Active Stories...`);
      await page.goto(`https://www.instagram.com/stories/${user}/`, { waitUntil: 'networkidle2' });
      await sniperCapture(page, user, 'stories_v26', capturedMediaUrls);

      // 3. Highlights Scan
      for (const hUrl of highlightLinks) {
          console.log(`   🔗 Entering Highlight: ${hUrl}`);
          await page.goto(hUrl, { waitUntil: 'networkidle2' });
          await sniperCapture(page, user, 'highlights_v26', capturedMediaUrls);
      }

      // Stop recording after first target is completely scanned
      if (targetIndex === 0 && !recordingStopped) {
        console.log("🎬 Stopping X-Ray Debug Recording...");
        await recorder.stop();
        recordingStopped = true;
        console.log("📤 Uploading hunting debug video to Cloudinary...");
        try {
            const debugUpload = await cloudinary.uploader.upload('hunting_debug.mp4', { 
                folder: 'insta_debug', 
                resource_type: 'video' 
            });
            console.log(`✅ X-Ray Debug Video (Shows actual hunt): ${debugUpload.secure_url}`);
        } catch(e) {
            console.log("❌ Debug video upload failed:", e.message);
        }
      }
    }
  } catch (error) {
    console.error("❌ FATAL ERROR:", error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
    console.log("⏹️ Mission Finished.");
  }
}

async function sniperCapture(page, username, category, capturedMediaUrls) {
    console.log(`   ⏱️ Initializing hunter... waiting 6 seconds for story viewer to load...`);
    await new Promise(r => setTimeout(r, 6000));

    for (let slideIndex = 0; slideIndex < 40; slideIndex++) {
        const currentUrl = page.url();
        if (!currentUrl.includes('/stories/')) {
            console.log(`   ⏹️ Exited Viewer (No longer in stories mode).`);
            break;
        }

        console.log(`\n   🎯 SLIDE ${slideIndex + 1}: DEPLOYING MULTI-PATHWAY HUNTER...`);

        // Clear network captured URLs for this slide
        capturedMediaUrls.clear();

        // --- 🎯 THE MULTI-PATHWAY FALLBACK SYSTEM ---
        const media = await page.evaluate(async (maxWait, pollInterval) => {
            const startTime = Date.now();
            let attemptCount = 0;
            const detectionLog = [];

            while (Date.now() - startTime < maxWait) {
                attemptCount++;
                const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                
                // ========================================
                // RASTA 1: AUTO-PLAY BYPASS (CRITICAL FOR HIGHLIGHTS)
                // ========================================
                try {
                    const playButton = document.querySelector('button[aria-label="Play"]') || 
                                     document.querySelector('svg[aria-label="Play"]')?.closest('button') ||
                                     document.querySelector('button svg[aria-label="Play"]')?.parentElement;
                    
                    if (playButton) {
                        detectionLog.push(`[${elapsed}s] RASTA 1: Play button detected, clicking...`);
                        playButton.click();
                        await new Promise(r => setTimeout(r, 1500)); // Wait for video to start
                    }
                } catch (e) {
                    detectionLog.push(`[${elapsed}s] RASTA 1: Play button check failed: ${e.message}`);
                }

                // ========================================
                // RASTA 2: MULTI-LAYER VIDEO HUNTER
                // ========================================
                try {
                    const videoElements = Array.from(document.querySelectorAll('video'));
                    detectionLog.push(`[${elapsed}s] RASTA 2: Found ${videoElements.length} video elements`);
                    
                    for (let vidIndex = 0; vidIndex < videoElements.length; vidIndex++) {
                        const video = videoElements[vidIndex];
                        
                        // Method A: Check all possible src locations
                        const possibleSources = [
                            video.currentSrc,
                            video.src,
                            video.querySelector('source')?.src,
                            video.getAttribute('src')
                        ].filter(Boolean);

                        detectionLog.push(`[${elapsed}s] RASTA 2A: Video ${vidIndex} has ${possibleSources.length} sources`);

                        for (const src of possibleSources) {
                            // Method B: Blob detection and rejection
                            if (src.includes('blob:')) {
                                detectionLog.push(`[${elapsed}s] RASTA 2B: BLOB DETECTED (${src.substring(0, 50)}...) - Skipping blob URL`);
                                continue;
                            }

                            if (src.startsWith('http') && (src.includes('.mp4') || src.includes('video'))) {
                                detectionLog.push(`[${elapsed}s] RASTA 2: ✅ VALID VIDEO URL FOUND!`);
                                return { 
                                    url: src, 
                                    type: 'video', 
                                    pathway: 'RASTA_2_VIDEO',
                                    log: detectionLog 
                                };
                            }
                        }
                    }
                } catch (e) {
                    detectionLog.push(`[${elapsed}s] RASTA 2: Video hunt error: ${e.message}`);
                }

                // ========================================
                // RASTA 3: MULTI-LAYER IMAGE HUNTER
                // ========================================
                try {
                    const imageElements = Array.from(document.querySelectorAll('img'));
                    detectionLog.push(`[${elapsed}s] RASTA 3: Found ${imageElements.length} image elements`);
                    
                    // Loop backwards to catch foreground images first
                    for (let imgIndex = imageElements.length - 1; imgIndex >= 0; imgIndex--) {
                        const img = imageElements[imgIndex];
                        
                        // Method A: Get bounding box for visible size check
                        const rect = img.getBoundingClientRect();
                        const isLargeEnough = rect.width > 200 && rect.height > 200;
                        
                        if (!isLargeEnough) {
                            continue; // Skip small icons and profile pics
                        }

                        detectionLog.push(`[${elapsed}s] RASTA 3A: Image ${imgIndex} size check passed (${rect.width}x${rect.height})`);

                        // Method B: Check src attribute
                        let imgSrc = img.src || img.getAttribute('src');
                        
                        // Skip data URIs
                        if (imgSrc && imgSrc.startsWith('data:image')) {
                            detectionLog.push(`[${elapsed}s] RASTA 3B: Skipping data URI`);
                            continue;
                        }

                        // Method C: Check srcset if src is missing or invalid
                        if (!imgSrc || !imgSrc.startsWith('http')) {
                            const srcset = img.getAttribute('srcset');
                            if (srcset) {
                                // Parse srcset and get the largest image
                                const sources = srcset.split(',').map(s => s.trim().split(' ')[0]);
                                imgSrc = sources[sources.length - 1]; // Usually the largest
                                detectionLog.push(`[${elapsed}s] RASTA 3C: Using srcset: ${imgSrc?.substring(0, 50)}...`);
                            }
                        }

                        // Final validation
                        if (imgSrc && imgSrc.startsWith('http') && !imgSrc.includes('profile_pic')) {
                            // Additional check: naturalWidth (if loaded)
                            if (img.naturalWidth > 300 || rect.width > 300) {
                                detectionLog.push(`[${elapsed}s] RASTA 3: ✅ VALID IMAGE URL FOUND!`);
                                return { 
                                    url: imgSrc, 
                                    type: 'image', 
                                    pathway: 'RASTA_3_IMAGE',
                                    log: detectionLog 
                                };
                            }
                        }
                    }
                } catch (e) {
                    detectionLog.push(`[${elapsed}s] RASTA 3: Image hunt error: ${e.message}`);
                }

                // ========================================
                // LOGIN BLOCK DETECTION
                // ========================================
                const bodyText = document.body.innerText || '';
                if (bodyText.includes('Log in to Instagram') || 
                    bodyText.includes('Log In') || 
                    bodyText.includes('Sign Up')) {
                    detectionLog.push(`[${elapsed}s] ⛔ LOGIN WALL DETECTED`);
                    return { 
                        error: 'LOGIN_REQUIRED', 
                        log: detectionLog 
                    };
                }

                // Wait before next polling attempt
                await new Promise(r => setTimeout(r, pollInterval));
            }

            detectionLog.push(`[${maxWait/1000}s] ⏰ TIMEOUT - No media found after ${attemptCount} attempts`);
            return { 
                error: 'TIMEOUT', 
                log: detectionLog 
            };
        }, MAX_WAIT_FOR_MEDIA, POLL_INTERVAL);

        // Log the detection process for debugging
        if (media && media.log) {
            console.log(`      📊 Detection Log:`);
            media.log.forEach(entry => console.log(`         ${entry}`));
        }

        // Handle detection results
        if (media && media.error === 'LOGIN_REQUIRED') {
            console.log(`      ⛔ CRITICAL: Instagram blocked access. Cookies expired or invalid!`);
            console.log(`      💡 Check the hunting_debug.mp4 video to see login prompts.`);
            break; 
        } else if (media && media.error === 'TIMEOUT') {
            console.log(`      ⚠️ SLIDE ${slideIndex + 1}: All pathways exhausted. No media extracted.`);
            
            // Check network captured URLs as last resort
            if (capturedMediaUrls.size > 0) {
                console.log(`      🌐 FALLBACK: Found ${capturedMediaUrls.size} URLs from network capture`);
                const networkUrl = Array.from(capturedMediaUrls)[0];
                const isVideo = networkUrl.includes('.mp4');
                console.log(`      🎯 Using network-captured ${isVideo ? 'video' : 'image'}: ${networkUrl.substring(0, 80)}...`);
                
                const isNew = await safeSync(networkUrl, username, category, isVideo);
                if (isNew && !isVideo) {
                    const aiResponse = await analyzeWithGemini(networkUrl);
                    await updateAIDesc(username, networkUrl, aiResponse);
                }
            }
        } else if (media && media.url) {
            console.log(`      🎯 ${media.pathway}: TARGET LOCKED!`);
            console.log(`      📍 URL: ${media.url.substring(0, 100)}...`);

            // ❤️ Like the story (optional)
            try {
                await page.evaluate(() => {
                    const likeBtn = document.querySelector('span[role="button"] svg[aria-label="Like"]')?.closest('button') ||
                                   document.querySelector('button[aria-label="Like"]') ||
                                   document.querySelector('svg[aria-label="Like"]')?.parentElement;
                    if (likeBtn) {
                        likeBtn.click();
                    }
                });
            } catch (e) {
                console.log(`      ❤️ Like button not found or error: ${e.message}`);
            }

            // 💾 IMMEDIATE SYNC - STRICT WAIT BEFORE MOVING FORWARD
            console.log(`      ⏸️ PAUSING HUNT - Starting immediate sync to Cloudinary...`);
            const isVideo = media.type === 'video';
            const isNew = await safeSync(media.url, username, category, isVideo);
            
            if (isNew && media.type === 'image') {
                console.log(`      🤖 Running Gemini AI Analysis...`);
                const aiResponse = await analyzeWithGemini(media.url);
                await updateAIDesc(username, media.url, aiResponse);
                console.log(`      ✅ AI Analysis Complete: ${aiResponse.substring(0, 60)}...`);
            }
            
            console.log(`      ✅ Sync complete. Ready to move to next slide.`);
        }

        // Move to next slide ONLY AFTER all processing is complete
        console.log(`      ➡️ Moving to next slide...`);
        await page.keyboard.press('ArrowRight');
        await new Promise(r => setTimeout(r, 2500)); // Wait for transition
    }

    console.log(`   🏁 Completed scan for @${username} in ${category}`);
}

async function safeSync(url, username, category, isVideo) {
    try {
        // Create a more robust ID from URL
        const urlParts = url.split('?')[0].split('/');
        const mediaId = urlParts[urlParts.length - 1].substring(0, 45) || 
                       url.split('?')[0].split('/').filter(p => p.length > 10).pop()?.substring(0, 45) ||
                       Date.now().toString();
        
        const docId = `V26_${username}_${mediaId}`;
        const docRef = db.collection("archives").doc(docId);
        
        const doc = await docRef.get();
        if (doc.exists) {
            console.log(`      ⏩ Already archived in database. Skipping duplicate.`);
            return false;
        }

        console.log(`      📤 Uploading to Cloudinary...`);
        const upload = await cloudinary.uploader.upload(url, { 
            folder: `insta_vault_v26/${username}/${category}`, 
            resource_type: isVideo ? "video" : "image",
            timeout: 120000 // 2 minute timeout for large files
        });

        await docRef.set({ 
            owner: username, 
            url: upload.secure_url, 
            original_url: url,
            type: category, 
            is_video: isVideo, 
            time: admin.firestore.FieldValue.serverTimestamp(),
            version: 'V26_MULTI_PATHWAY'
        });
        
        console.log(`      ✅ [BULLSEYE] Archived successfully!`);
        console.log(`      🔗 Cloudinary URL: ${upload.secure_url}`);
        return true;
    } catch (e) {
        console.log(`      ❌ Sync Error: ${e.message}`);
        if (e.stack) {
            console.log(`      📋 Stack trace: ${e.stack.substring(0, 200)}`);
        }
        return false;
    }
}

async function analyzeWithGemini(imageUrl) {
    try {
        console.log(`      🤖 Fetching image for AI analysis...`);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = "Identify Area and Describe: [Area] - [Action]";
        
        const response = await fetch(imageUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
        }
        
        const buffer = await response.buffer();
        const result = await model.generateContent([
            prompt, 
            { 
                inlineData: { 
                    data: buffer.toString('base64'), 
                    mimeType: "image/jpeg" 
                } 
            }
        ]);
        
        return result.response.text();
    } catch (e) { 
        console.log(`      ⚠️ Gemini AI analysis failed: ${e.message}`);
        return "AI analysis unavailable."; 
    }
}

async function updateAIDesc(username, url, desc) {
    try {
        const urlParts = url.split('?')[0].split('/');
        const mediaId = urlParts[urlParts.length - 1].substring(0, 45) || 
                       url.split('?')[0].split('/').filter(p => p.length > 10).pop()?.substring(0, 45) ||
                       Date.now().toString();
        
        await db.collection("archives").doc(`V26_${username}_${mediaId}`).update({ 
            ai_report: desc,
            ai_analyzed_at: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`      📝 AI description saved to Firebase.`);
    } catch (e) {
        console.log(`      ⚠️ Failed to update AI description: ${e.message}`);
    }
}

// Start the bot
runBot().catch(err => {
    console.error("💥 UNHANDLED ERROR IN MAIN:", err);
    process.exit(1);
});
