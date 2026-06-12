require('dotenv').config();
const admin = require('firebase-admin');

try {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    })
  });
  console.log('Firebase initialized');
} catch (e) {
  console.log('Firebase init error:', e);
}

const db = admin.firestore();

async function run() {
  try {
    console.log('Fetching from Firestore...');
    // Create a timeout promise to see if it hangs
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 5000));
    
    const fetchPromise = db.collection('users').limit(1).get();
    
    const snapshot = await Promise.race([fetchPromise, timeout]);
    console.log('Firestore fetch success:', snapshot.empty ? 'Empty' : 'Has data');
  } catch (e) {
    console.log('Firestore fetch error:', e.message);
  }
}

run();
