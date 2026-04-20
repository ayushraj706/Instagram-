import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { db } from '../../../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(req: Request) {
  try {
    const data = await req.json();

    // 1. Agar Media (Story/Post) hai toh Cloudinary par upload karo
    if (data.type === 'media') {
      const upload = await cloudinary.uploader.upload(data.url, {
        folder: "basekey_vault",
        resource_type: "auto"
      });
      await addDoc(collection(db, "archives"), {
        url: upload.secure_url,
        type: 'story_auto',
        time: serverTimestamp()
      });
    }

    // 2. Agar Message hai toh Firestore mein save karo (Anti-Delete)
    if (data.type === 'chat_capture') {
      await addDoc(collection(db, "automation_logs"), {
        text: data.text,
        sender: data.sender,
        type: 'captured_msg',
        time: serverTimestamp()
      });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

