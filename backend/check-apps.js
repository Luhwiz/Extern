require('dotenv').config();
const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  }),
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'externai-desktop.firebasestorage.app'
});

const db = admin.firestore();

async function check() {
  const apps = await db.collection('published_apps').orderBy('updatedAt', 'desc').limit(1).get();
  if (apps.empty) {
    console.log("No apps found");
    return;
  }
  const app = apps.docs[0];
  console.log("Latest App ID:", app.id);
  console.log("Data:", app.data());
  
  // List files in storage
  const bucket = admin.storage().bucket();
  const [files] = await bucket.getFiles({ prefix: `published_apps/${app.id}/` });
  console.log("Files in storage:");
  files.forEach(f => console.log(f.name));

  const jsFile = bucket.file(`published_apps/${app.id}/assets/index-CQzuxwgQ.js`);
  const [jsContent] = await jsFile.download();
  console.log("\\n--- index.js ---");
  console.log(jsContent.toString('utf-8').substring(0, 500)); // Print just the beginning to see if there are any obvious issues.
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
