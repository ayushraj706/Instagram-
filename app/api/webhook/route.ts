import { NextResponse } from 'next/server';
import { db } from '../../../lib/firebase';
import { doc, setDoc, serverTimestamp, collection, addDoc } from 'firebase/firestore';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.INSTAGRAM_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }
  return new Response('Error', { status: 403 });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const entry = body.entry?.[0];
    const messaging = entry?.messaging?.[0];
    const senderId = messaging?.sender?.id;

    // 1. Live Status Update (Dashboard par green light ke liye)
    await setDoc(doc(db, "system", "status"), {
      last_active: serverTimestamp(),
      connection: "active"
    }, { merge: true });

    // 2. Feature Detection & Handling
    if (messaging) {
      const logRef = collection(db, "automation_logs");

      // --- FEATURE: Story Mentions ---
      if (messaging.message?.reply_to?.story) {
        await addDoc(logRef, { type: 'story_mention', senderId, data: messaging, time: serverTimestamp() });
        // Yahan tum automatic "Thanks for mentioning!" bhej sakte ho
      }

      // --- FEATURE: Media (Images/Video) ---
      else if (messaging.message?.attachments) {
        await addDoc(logRef, { type: 'media_received', senderId, attachments: messaging.message.attachments, time: serverTimestamp() });
      }

      // --- FEATURE: Quick Replies / Buttons ---
      else if (messaging.postback || messaging.message?.quick_reply) {
        const payload = messaging.postback?.payload || messaging.message?.quick_reply?.payload;
        await addDoc(logRef, { type: 'button_click', senderId, payload, time: serverTimestamp() });
        // Payload ke basis par alag-alag automation trigger hogi
      }

      // --- FEATURE: Normal Text ---
      else if (messaging.message?.text) {
        await addDoc(logRef, { type: 'text_message', senderId, text: messaging.message.text, time: serverTimestamp() });
      }
    }

    return NextResponse.json({ status: 'success' });
  } catch (error) {
    console.error("Webhook Error:", error);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
