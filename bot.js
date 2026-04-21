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

const MAX_WAIT_FOR_MEDIA = 40000; // 40 seconds max wait (only if network fallback hasn't fired)
const POLL_INTERVAL = 800; // Check every 800ms for faster detection
const NETWORK_CHECK_INTERVAL = 500; // Check network captures every 500ms

async function runBot() {
  console.log("🚀 GHOST_ENGINE: V28 - FAST-TRACK NETWORK FALLBACK & SCREEN SMASH ACTIVATED...");
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
  const capturedMediaUrls = new Map(); // Changed to Map to track URLs with metadata
  
  page.on('request', (request) => {
    const url = request.url();
    // Capture video/image URLs from network requests with metadata
    if (url.startsWith('http') && !url.includes('profile_pic') && !url.includes('data:image')) {
      if (url.includes('.mp4') || url.includes('video')) {
        capturedMediaUrls.set(url, { type: 'video', timestamp: Date.now() });
        console.log(`         🌐 Network captured VIDEO: ${url.substring(0, 80)}...`);
      } else if (url.includes('.jpg') || url.includes('.jpeg') || url.includes('.png') || url.includes('image')) {
        // Only capture large images (filter out tiny icons)
        if (!url.includes('s150x150') && !url.includes('s320x320') && !url.includes('44x44')) {
          capturedMediaUrls.set(url, { type: 'image', timestamp: Date.now() });
          console.log(`         🌐 Network captured IMAGE: ${url.substring(0, 80)}...`);
        }
      }
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
      await sniperCapture(page, user, 'stories_v28', capturedMediaUrls);

      // 3. Highlights Scan
      for (const hUrl of highlightLinks) {
          console.log(`   🔗 Entering Highlight: ${hUrl}`);
          await page.goto(hUrl, { waitUntil: 'networkidle2' });
          await sniperCapture(page, user, 'highlights_v28', capturedMediaUrls);
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

        console.log(`\n   🎯 SLIDE ${slideIndex + 1}: DEPLOYING V28 FAST-TRACK SYSTEM...`);

        // ========================================
        // 🎮 THE KEYBOARD/SCREEN SMASH HACK
        // ========================================
        console.log(`      🥊 SCREEN SMASH: Dismissing all overlays...`);
        try {
            // Click dead center to dismiss overlays (Sensitive content, 18+, Watch story, etc.)
            await page.mouse.click(540, 960);
            await new Promise(r => setTimeout(r, 800));
            
            // Force play if paused
            await page.keyboard.press('Space');
            await new Promise(r => setTimeout(r, 500));
            
            // Accept generic warnings
            await page.keyboard.press('Enter');
            await new Promise(r => setTimeout(r, 1000));
            
            console.log(`      ✅ Screen smash complete. Overlays should be dismissed.`);
        } catch (e) {
            console.log(`      ⚠️ Screen smash error: ${e.message}`);
        }

        // Clear old network captures (keep only fresh ones from this slide)
        const previousCaptureCount = capturedMediaUrls.size;
        const cutoffTime = Date.now() - 5000; // Keep captures from last 5 seconds
        for (const [url, data] of capturedMediaUrls.entries()) {
            if (data.timestamp < cutoffTime) {
                capturedMediaUrls.delete(url);
            }
        }
        console.log(`      🗑️ Cleared ${previousCaptureCount - capturedMediaUrls.size} old network captures`);

        // ========================================
        // 🚀 FAST-TRACK NETWORK FALLBACK
        // ========================================
        let foundMedia = null;
        let usedFastTrack = false;
        const fastTrackStartTime = Date.now();
        const maxFastTrackWait = 8000; // Max 8 seconds for network capture

        console.log(`      🚀 Fast-Track Phase: Monitoring network captures...`);
        
        // Fast-track loop: Check network captures frequently
        while (Date.now() - fastTrackStartTime < maxFastTrackWait && !foundMedia) {
            if (capturedMediaUrls.size > 0) {
                // Get the most recent capture
                const entries = Array.from(capturedMediaUrls.entries());
                const [url, data] = entries[entries.length - 1];
                
                console.log(`      🎯 FAST-TRACK HIT! Network captured ${data.type} after ${((Date.now() - fastTrackStartTime) / 1000).toFixed(1)}s`);
                foundMedia = {
                    url: url,
                    type: data.type,
                    pathway: 'FAST_TRACK_NETWORK',
                    log: [`Network capture fired instantly, bypassing 40s DOM hunt`]
                };
                usedFastTrack = true;
                break;
            }
            
            // Wait a bit before checking again
            await new Promise(r => setTimeout(r, NETWORK_CHECK_INTERVAL));
        }

        // ========================================
        // 🎯 MULTI-PATHWAY FALLBACK (IF FAST-TRACK FAILED)
        // ========================================
        if (!foundMedia) {
            console.log(`      ⏳ Fast-track timeout (${(maxFastTrackWait/1000)}s). Falling back to DOM hunt...`);
            
            foundMedia = await page.evaluate(async (maxWait, pollInterval) => {
                const startTime = Date.now();
                let attemptCount = 0;
                const detectionLog = [];

                while (Date.now() - startTime < maxWait) {
                    attemptCount++;
                    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                    
                    // ========================================
                    // RASTA 1: AUTO-PLAY & PRIVACY POPUP BYPASS
                    // ========================================
                    try {
                        // 1A. Bypass "View story" privacy warning
                        const viewStoryBtn = Array.from(document.querySelectorAll('div[role="button"], button'))
                            .find(el => el.innerText && el.innerText.includes('View story'));

                        if (viewStoryBtn) {
                            detectionLog.push(`[${elapsed}s] RASTA 1A: 'View story' privacy button detected, clicking...`);
                            viewStoryBtn.click();
                            await new Promise(r => setTimeout(r, 2500));
                        }

                        // 1B. Normal Play button bypass
                        const playButton = document.querySelector('button[aria-label="Play"]') || 
                                         document.querySelector('svg[aria-label="Play"]')?.closest('button') ||
                                         document.querySelector('button svg[aria-label="Play"]')?.parentElement;
                        
                        if (playButton) {
                            detectionLog.push(`[${elapsed}s] RASTA 1B: Play button detected, clicking...`);
                            playButton.click();
                            await new Promise(r => setTimeout(r, 1500));
                        }

                        // 1C. Click any generic "Continue" or "OK" buttons
                        const continueBtn = Array.from(document.querySelectorAll('button, div[role="button"]'))
                            .find(el => el.innerText && (el.innerText.includes('Continue') || el.innerText.includes('OK')));
                        
                        if (continueBtn) {
                            detectionLog.push(`[${elapsed}s] RASTA 1C: Generic continue button found, clicking...`);
                            continueBtn.click();
                            await new Promise(r => setTimeout(r, 1500));
                        }
                    } catch (e) {
                        detectionLog.push(`[${elapsed}s] RASTA 1: Bypass check failed: ${e.message}`);
                    }

                    // ========================================
                    // RASTA 2: MULTI-LAYER VIDEO HUNTER
                    // ========================================
                    try {
                        const videoElements = Array.from(document.querySelectorAll('video'));
                        
                        for (let vidIndex = 0; vidIndex < videoElements.length; vidIndex++) {
                            const video = videoElements[vidIndex];
                            
                            // Method A: Check all possible src locations
                            const possibleSources = [
                                video.currentSrc,
                                video.src,
                                video.querySelector('source')?.src,
                                video.getAttribute('src')
                            ].filter(Boolean);

                            for (const src of possibleSources) {
                                // Method B: Blob detection and rejection
                                if (src.includes('blob:')) {
                                    detectionLog.push(`[${elapsed}s] RASTA 2B: BLOB DETECTED - Skipping`);
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
                        
                        // Loop backwards to catch foreground images first
                        for (let imgIndex = imageElements.length - 1; imgIndex >= 0; imgIndex--) {
                            const img = imageElements[imgIndex];
                            
                            // Method A: Get bounding box for visible size check
                            const rect = img.getBoundingClientRect();
                            const isLargeEnough = rect.width > 200 && rect.height > 200;
                            
                            if (!isLargeEnough) {
                                continue;
                            }

                            // Method B: Check src attribute
                            let imgSrc = img.src || img.getAttribute('src');
                            
                            // Skip data URIs
                            if (imgSrc && imgSrc.startsWith('data:image')) {
                                continue;
                            }

                            // Method C: Check srcset if src is missing or invalid
                            if (!imgSrc || !imgSrc.startsWith('http')) {
                                const srcset = img.getAttribute('srcset');
                                if (srcset) {
                                    const sources = srcset.split(',').map(s => s.trim().split(' ')[0]);
                                    imgSrc = sources[sources.length - 1];
                                    detectionLog.push(`[${elapsed}s] RASTA 3C: Using srcset`);
                                }
                            }

                            // Final validation
                            if (imgSrc && imgSrc.startsWith('http') && !imgSrc.includes('profile_pic')) {
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
        }

        // ========================================
        // 📊 LOG DETECTION RESULTS
        // ========================================
        if (foundMedia && foundMedia.log) {
            console.log(`      📊 Detection Log:`);
            foundMedia.log.forEach(entry => console.log(`         ${entry}`));
        }

        // ========================================
        // 🎬 HANDLE DETECTION RESULTS
        // ========================================
        if (foundMedia && foundMedia.error === 'LOGIN_REQUIRED') {
            console.log(`      ⛔ CRITICAL: Instagram blocked access. Cookies expired or invalid!`);
            console.log(`      💡 Check the hunting_debug.mp4 video to see login prompts.`);
            break; 
        } else if (foundMedia && foundMedia.error === 'TIMEOUT') {
            console.log(`      ⚠️ SLIDE ${slideIndex + 1}: All pathways exhausted. Checking final network fallback...`);
            
            // Final check of network captured URLs
            if (capturedMediaUrls.size > 0) {
                const entries = Array.from(capturedMediaUrls.entries());
                const [networkUrl, networkData] = entries[entries.length - 1];
                console.log(`      🌐 FINAL FALLBACK: Using network-captured ${networkData.type}`);
                console.log(`      📍 URL: ${networkUrl.substring(0, 80)}...`);
                
                const isNew = await safeSync(networkUrl, username, category, networkData.type === 'video');
                if (isNew && networkData.type === 'image') {
                    const aiResponse = await analyzeWithGemini(networkUrl);
                    await updateAIDesc(username, networkUrl, aiResponse);
                }
            } else {
                console.log(`      ❌ No media found via any pathway. Skipping slide.`);
            }
        } else if (foundMedia && foundMedia.url) {
            console.log(`      🎯 ${foundMedia.pathway}: TARGET LOCKED!`);
            console.log(`      📍 URL: ${foundMedia.url.substring(0, 100)}...`);
            if (usedFastTrack) {
                console.log(`      ⚡ Fast-track saved ${((MAX_WAIT_FOR_MEDIA - (Date.now() - fastTrackStartTime)) / 1000).toFixed(1)}s by bypassing DOM hunt!`);
            }

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
                console.log(`      ❤️ Like attempt failed: ${e.message}`);
            }

            // 💾 IMMEDIATE SYNC - STRICT WAIT BEFORE MOVING FORWARD
            console.log(`      ⏸️ PAUSING HUNT - Starting immediate sync to Cloudinary...`);
            const isVideo = foundMedia.type === 'video';
            const isNew = await safeSync(foundMedia.url, username, category, isVideo);
            
            if (isNew && foundMedia.type === 'image') {
                console.log(`      🤖 Running Gemini AI Analysis...`);
                const aiResponse = await analyzeWithGemini(foundMedia.url);
                await updateAIDesc(username, foundMedia.url, aiResponse);
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
        
        const docId = `V28_${username}_${mediaId}`;
        const docRef = db.collection("archives").doc(docId);
        
        const doc = await docRef.get();
        if (doc.exists) {
            console.log(`      ⏩ Already archived in database. Skipping duplicate.`);
            return false;
        }

        console.log(`      📤 Uploading to Cloudinary...`);
        const upload = await cloudinary.uploader.upload(url, { 
            folder: `insta_vault_v28/${username}/${category}`, 
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
            version: 'V28_FAST_TRACK'
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
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" }); // Fixed model name
        const prompt = "Identify Area and Describe: [Area] - [Action]";
        
        const response = await fetch(imageUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
        }
        
        // Fixed deprecation warning: Changed from response.buffer() to arrayBuffer
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
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
        
        await db.collection("archives").doc(`V28_${username}_${mediaId}`).update({ 
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
