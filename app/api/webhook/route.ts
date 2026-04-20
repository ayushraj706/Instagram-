import { NextResponse } from 'next/server';
import { db } from '../../../lib/firebase';
import { 
  doc, getDoc, setDoc, serverTimestamp, collection, addDoc 
} from 'firebase/firestore';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { v2 as cloudinary } from 'cloudinary';

// Cloudinary Config (Make sure these are in Vercel Env)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 1. META VERIFICATION (GET)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  try {
    const configSnap = await getDoc(doc(db, "config", "meta"));
    const dbVerifyToken = configSnap.exists() ? configSnap.data().verifyToken : null;

    if (mode === 'subscribe' && token === dbVerifyToken) {
      await setDoc(doc(db, "system", "status"), {
        verified: true,
        last_verified: serverTimestamp(),
        connection: "active"
      }, { merge: true });
      return new Response(challenge, { status: 200 });
    }
    return new Response('Verification Failed', { status: 403 });
  } catch (error) {
    return new Response('Server Error', { status: 500 });
  }
}

// 2. MAIN ENGINE (POST)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const entry = body.entry?.[0];
    const messaging = entry?.messaging?.[0];
    if (!messaging) return NextResponse.json({ status: 'no_msg' });

    const senderId = messaging.sender.id;

    // A. Check Automation Toggle (Dashboard wala Switch)
    const statusSnap = await getDoc(doc(db, "system", "status"));
    const isEnabled = statusSnap.data()?.enabled;

    // B. Get Meta & Gemini Config
    const configSnap = await getDoc(doc(db, "config", "meta"));
    const config = configSnap.data();

    // System Activity Update
    await setDoc(doc(db, "system", "status"), {
      last_active: serverTimestamp(),
      connection: "active"
    }, { merge: true });

    if (isEnabled && config?.accessToken) {
      const logRef = collection(db, "automation_logs");
      const chatRef = collection(db, `chats/${senderId}/messages`);

      // --- FEATURE: Media to Cloudinary ---
      if (messaging.message?.attachments) {
        for (const attachment of messaging.message.attachments) {
          const uploadRes = await cloudinary.uploader.upload(attachment.payload.url, {
            folder: `basekey/user_${senderId}`,
            resource_type: "auto"
          });

          await addDoc(logRef, { type: 'media', senderId, url: uploadRes.secure_url, time: serverTimestamp() });
          await addDoc(chatRef, { type: 'media', content: uploadRes.secure_url, sender: 'user', time: serverTimestamp() });
        }
      }

      // --- FEATURE: Text & Gemini AI ---
      if (messaging.message?.text) {
        const userText = messaging.message.text;

        // 1. Save User Message for PDF
        await addDoc(chatRef, { type: 'text', content: userText, sender: 'user', time: serverTimestamp() });

        // 2. Call Gemini AI
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        
        const result = await model.generateContent(`Aap ek advance Instagram Assistant ho. Friendly baat karo. User: ${userText}`);
        const aiReply = result.response.text();

        // 3. Send Reply to Instagram
        await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${config.accessToken}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient: { id: senderId },
            message: { text: aiReply }
          })
        });

        // 4. Save AI Reply for PDF
        await addDoc(chatRef, { type: 'text', content: aiReply, sender: 'bot', time: serverTimestamp() });
        await addDoc(logRef, { type: 'ai_reply', senderId, text: aiReply, time: serverTimestamp() });
      }

      // --- FEATURE: Buttons / Postbacks ---
      if (messaging.postback) {
        const payload = messaging.postback.payload;
        await addDoc(logRef, { type: 'button_click', senderId, payload, time: serverTimestamp() });
        // Yahan specific buttons ka logic add kar sakte ho
      }
    }

    return NextResponse.json({ status: 'success' });
  } catch (error) {
    console.error("Webhook Error:", error);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
