import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    // Agar tum Realtime Database use kar rahe ho toh yahan URL ayega
    // databaseURL: "https://your-project-id.firebaseio.com" 
  });
}

export const db = admin.firestore();
export const auth = admin.auth();

