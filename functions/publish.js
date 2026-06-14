/**
 * publish.js  —  ExternAI app hosting via Firebase Storage
 *
 * Mirrors the Lovable one-click deploy model:
 *  1. Client calls publishApp (callable fn) with base64-encoded project files.
 *  2. Files land in Cloud Storage under  published_apps/{appId}/...
 *  3. Metadata is stored in Firestore  published_apps/{appId}
 *  4. serveApp (HTTP fn) reads Storage and streams files to the browser.
 *
 * URL format:  https://externai-desktop.web.app/app/{appId}[/path/to/file]
 */

const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const path = require('path');

// Initialise Admin SDK (guard against double-init)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Lazily create Storage bucket reference
let _bucket = null;
const bucket = () => {
  if (!_bucket) _bucket = admin.storage().bucket();
  return _bucket;
};

// ── MIME types ────────────────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.ts': 'text/plain; charset=utf-8',
  '.tsx': 'text/plain; charset=utf-8',
  '.jsx': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'font/otf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.map': 'application/json',
};

// ─────────────────────────────────────────────────────────────────────────────
//  serveApp  —  HTTP function  (URL: /app/{appId}[/path/to/file])
// ─────────────────────────────────────────────────────────────────────────────
exports.serveApp = onRequest(
  { region: 'us-central1', memory: '256MiB', timeoutSeconds: 30 },
  async (req, res) => {
    // CORS
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'GET');
      res.set('Access-Control-Max-Age', '3600');
      return res.status(204).send('');
    }

    try {
      // Parse  /app/{appId}[/path/to/file]
      const parts = req.path.split('/').filter(Boolean); // ['app', appId, ...rest]
      if (parts.length < 2 || parts[0] !== 'app') {
        return res.redirect('/');
      }

      const appId = parts[1];
      const filePath = parts.slice(2).join('/') || 'index.html';

      // Verify app exists & is live
      const appDoc = await db.collection('published_apps').doc(appId).get();
      if (!appDoc.exists || appDoc.data().status !== 'live') {
        return sendNotFound(res, appId);
      }

      // Try the requested file
      const storePath = `published_apps/${appId}/${filePath}`;
      const file = bucket().file(storePath);
      const [exists] = await file.exists();

      if (!exists) {
        // SPA fallback → index.html
        const index = bucket().file(`published_apps/${appId}/index.html`);
        const [indexExists] = await index.exists();
        if (indexExists) return serveFile(res, index, 'index.html', appId);
        return res.status(404).send('File not found');
      }

      return serveFile(res, file, filePath, appId);
    } catch (err) {
      console.error('[serveApp] error:', err);
      return res.status(500).send('Internal server error');
    }
  }
);

/** Stream a Storage file to the HTTP response. */
async function serveFile(res, file, filePath, appId) {
  let [content] = await file.download();
  const ext = path.extname(filePath).toLowerCase();

  // Rewrite absolute paths in HTML so assets resolve under /app/{appId}/
  if (ext === '.html') {
    let html = content.toString('utf-8');
    const base = `/app/${appId}/`;
    // Rewrite src="/..." and src="./..." to be relative to the app base
    html = html.replace(/(src|href|action)="\.?\//g, `$1="${base}`);
    content = Buffer.from(html, 'utf-8');
  }

  res.set('Content-Type', MIME[ext] || 'application/octet-stream');
  res.set('Cache-Control', 'public, max-age=3600');
  res.set('X-Powered-By', 'ExternAI');

  // Track page views (fire-and-forget)
  if (filePath === 'index.html' || filePath.endsWith('/index.html')) {
    db.collection('published_apps').doc(appId).update({
      visits: admin.firestore.FieldValue.increment(1),
      lastVisitedAt: admin.firestore.FieldValue.serverTimestamp(),
    }).catch(() => { });
  }

  return res.send(content);
}

/** 404 page. */
function sendNotFound(res, appId) {
  res.set('Content-Type', 'text/html; charset=utf-8');
  return res.status(404).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>App Not Found — ExternAI</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);
      min-height: 100vh;
      display: flex; align-items: center; justify-content: center;
      color: #fff;
    }
    .box { text-align:center; padding:40px }
    h1  { font-size:2rem; margin-bottom:1rem }
    p   { opacity:.6; margin-bottom:2rem }
    a   { color:#6c63ff; text-decoration:none }
    a:hover { text-decoration:underline }
  </style>
</head>
<body>
  <div class="box">
    <h1>App Not Found</h1>
    <p>This app may have been unpublished or never existed.</p>
    <a href="https://externai-desktop.web.app">Create your own app with ExternAI →</a>
  </div>
</body>
</html>`);
}

// ─────────────────────────────────────────────────────────────────────────────
//  publishApp  —  Callable function
// ─────────────────────────────────────────────────────────────────────────────
exports.publishApp = onCall(
  { region: 'us-central1', memory: '512MiB', timeoutSeconds: 300 },
  async (request) => {
    // Auth guard
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'You must be signed in to publish.');
    }

    const userId = request.auth.uid;
    const { projectName, files, buildOutput } = request.data;

    if (!files || Object.keys(files).length === 0) {
      throw new HttpsError('invalid-argument', 'No files were provided.');
    }

    // Sanitise project name → URL-safe slug (max 20 chars)
    const slug = (projectName || 'my-app')
      .toLowerCase()
      .replace(/[^a-z0-9-\s]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 20)
      .replace(/^-|-$/g, '') || 'my-app';

    // Check whether this user already has a project with identical slug
    const existing = await db.collection('published_apps')
      .where('userId', '==', userId)
      .where('projectName', '==', slug)
      .limit(1)
      .get();

    let appId;
    let isUpdate = false;

    if (!existing.empty) {
      appId = existing.docs[0].id;
      isUpdate = true;

      // Delete old Storage files
      try {
        const [oldFiles] = await bucket().getFiles({ prefix: `published_apps/${appId}/` });
        await Promise.all(oldFiles.map(f => f.delete().catch(() => { })));
      } catch (_) { /* best-effort */ }
    } else {
      const rand = Math.random().toString(36).substring(2, 10);
      appId = `${slug}-${rand}`;
    }

    // ── Upload files to Storage ──────────────────────────────────────────────
    await Promise.all(
      Object.entries(files).map(async ([filePath, b64]) => {
        const storagePath = `published_apps/${appId}/${filePath}`;
        const fileRef = bucket().file(storagePath);
        const content = Buffer.from(b64, 'base64');
        const ext = path.extname(filePath).toLowerCase();

        await fileRef.save(content, {
          metadata: { contentType: MIME[ext] || 'application/octet-stream' },
        });
      })
    );

    // ── Write Firestore metadata ─────────────────────────────────────────────
    const ts = admin.firestore.FieldValue.serverTimestamp();
    const appData = {
      appId,
      userId,
      projectName: slug,
      displayName: (projectName || 'My App').substring(0, 60),
      buildOutput: buildOutput || '',
      fileCount: Object.keys(files).length,
      updatedAt: ts,
      status: 'live',
    };

    if (isUpdate) {
      await db.collection('published_apps').doc(appId).update(appData);
    } else {
      appData.visits = 0;
      appData.createdAt = ts;
      await db.collection('published_apps').doc(appId).set(appData);
    }

    // ── Return public URL ────────────────────────────────────────────────────
    const projectId = process.env.GCLOUD_PROJECT
      || process.env.FIREBASE_CONFIG && JSON.parse(process.env.FIREBASE_CONFIG).projectId
      || 'externai-desktop';

    const publicUrl = `https://${projectId}.web.app/app/${appId}`;

    return {
      success: true,
      appId,
      url: publicUrl,
      isUpdate,
      message: isUpdate
        ? `Your app has been updated! Share: ${publicUrl}`
        : `Your app is now live! Share: ${publicUrl}`,
    };
  }
);

// ─────────────────────────────────────────────────────────────────────────────
//  getMyApps  —  Callable function
// ─────────────────────────────────────────────────────────────────────────────
exports.getMyApps = onCall(
  { region: 'us-central1', memory: '256MiB' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'You must be signed in.');
    }

    const userId = request.auth.uid;
    const projectId = process.env.GCLOUD_PROJECT
      || process.env.FIREBASE_CONFIG && JSON.parse(process.env.FIREBASE_CONFIG).projectId
      || 'externai-desktop';

    const snap = await db.collection('published_apps')
      .where('userId', '==', userId)
      .orderBy('updatedAt', 'desc')
      .get();

    const apps = snap.docs.map(doc => {
      const d = doc.data();
      return {
        appId: doc.id,
        displayName: d.displayName,
        projectName: d.projectName,
        url: `https://${projectId}.web.app/app/${doc.id}`,
        status: d.status,
        visits: d.visits || 0,
        fileCount: d.fileCount || 0,
        publishedAt: d.publishedAt?.toDate?.()?.toISOString() || null,
        updatedAt: d.updatedAt?.toDate?.()?.toISOString() || null,
      };
    });

    return { apps };
  }
);

// ─────────────────────────────────────────────────────────────────────────────
//  unpublishApp  —  Callable function
// ─────────────────────────────────────────────────────────────────────────────
exports.unpublishApp = onCall(
  { region: 'us-central1', memory: '256MiB' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'You must be signed in.');
    }

    const { appId } = request.data;
    const userId = request.auth.uid;

    const appDoc = await db.collection('published_apps').doc(appId).get();

    if (!appDoc.exists) {
      throw new HttpsError('not-found', 'App not found.');
    }
    if (appDoc.data().userId !== userId) {
      throw new HttpsError('permission-denied', 'You do not own this app.');
    }

    // Delete Storage files
    try {
      const [files] = await bucket().getFiles({ prefix: `published_apps/${appId}/` });
      await Promise.all(files.map(f => f.delete().catch(() => { })));
    } catch (_) { /* best-effort */ }

    // Delete Firestore document
    await db.collection('published_apps').doc(appId).delete();

    return { success: true, message: 'App unpublished successfully.' };
  }
);
