import { NextResponse } from 'next/server';

// 1. Meta Verification (GET Request)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  // Yeh token wahi hona chahiye jo tum Vercel Env ya Meta Dashboard mein daloge
  const MY_SECRET_TOKEN = process.env.INSTAGRAM_VERIFY_TOKEN || "basekey_secret_123";

  if (mode === 'subscribe' && token === MY_SECRET_TOKEN) {
    console.log('WEBHOOK_VERIFIED_SUCCESSFULLY');
    return new Response(challenge, { status: 200 });
  }

  return new Response('Verification Failed: Token Mismatch', { status: 403 });
}

// 2. Receiving Messages (POST Request)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Yahan Instagram ke messages ka data aata hai
    console.log('Incoming Instagram Data:', JSON.stringify(body, null, 2));

    // Abhi ke liye hum sirf Success return karenge
    return NextResponse.json({ status: 'received' }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
}
