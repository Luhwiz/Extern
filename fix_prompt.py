with open('backend/routes/claude.js', 'r') as f:
    content = f.read()

system_prompt_addition = """
AUTOMATED BACKEND & NAMESPACING (CRITICAL):
Extern AI uses a shared Master Firebase Backend. To ensure data isolation, you MUST namespace all Firestore collections using the app's unique VITE_APP_ID.
Never use global collections like `collection(db, 'users')`.
Always use namespaced collections like `collection(db, \`apps/${import.meta.env.VITE_APP_ID}/users\`)`.

AUTH ISOLATION RULE (IF AUTH IS REQUESTED):
Because apps share a Master Firebase Auth pool, you must prevent cross-app logins.
1. When a user signs up, save their VITE_APP_ID in a namespaced Firestore profile (e.g. `apps/${import.meta.env.VITE_APP_ID}/userProfiles/${uid}`).
2. On login, immediately fetch this profile. If the profile doesn't exist in THIS app's namespace, force a logout (`signOut(auth)`) and show an "Invalid credentials" error.

REQUIRED FILES TO ALWAYS CREATE (ON THE SECOND PROMPT):

1. Automated Backend Setup (Firebase) — src/firebase.js:
```javascript filename=src/firebase.js
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
```

2. AI proxy service — src/services/aiService.js:
```javascript filename=src/services/aiService.js
const AI_PROXY_URL = import.meta.env.VITE_AI_PROXY_URL || 'http://localhost:5000';
const APP_ID = import.meta.env.VITE_APP_ID || 'default-app';

const headers = () => ({
  'Content-Type': 'application/json',
  'X-App-Id': APP_ID,
});

export async function chat(messages, systemPrompt = '') {
  const res  = await fetch(`${AI_PROXY_URL}/api/generated-app/chat`, { method: 'POST', headers: headers(), body: JSON.stringify({ messages, systemPrompt }) });
  const data = await res.json();
  if (res.status === 402) throw { code: 'TOKEN_LIMIT_REACHED', ...data };
  if (!res.ok) throw new Error(data.error || 'AI request failed');
  return data;
}

export async function uploadDocument(file) {
  const form  = new FormData();
  form.append('file', file);
  const res  = await fetch(`${AI_PROXY_URL}/api/generated-app/documents`, { method: 'POST', headers: { 'X-App-Id': APP_ID }, body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Upload failed');
  return data;
}

export async function queryDocuments(question, documentId = null) {
  const res  = await fetch(`${AI_PROXY_URL}/api/generated-app/query`, { method: 'POST', headers: headers(), body: JSON.stringify({ question, documentId }) });
  const data = await res.json();
  if (res.status === 402) throw { code: 'TOKEN_LIMIT_REACHED', ...data };
  if (!res.ok) throw new Error(data.error || 'Query failed');
  return data;
}

export async function getUsage() {
  const res  = await fetch(`${AI_PROXY_URL}/api/generated-app/usage`, { headers: headers() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not fetch usage');
  return data;
}
```

3. ON THE SECOND PROMPT ONLY: add firebase to package.json dependencies:
   "firebase": "^10.0.0"

4. Always create a .env file with these placeholders:
```text filename=.env
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_APP_ID=your_unique_app_id_here
VITE_AI_PROXY_URL=http://localhost:5000
```
*(Replace "your_unique_app_id_here" with a newly generated random 16-character string so each app has its own usage pool)*

5. Always include an AiChat component (src/components/AiChat.jsx) with:
   - A scrollable message history showing user + AI messages
   - A token usage bar (tokensUsed / 20000 free tokens)
   - A "Upgrade to Pro" banner when the free limit is reached
   - A textarea input with Send button
   - All API calls go through aiService.chat()

TOKEN LIMIT RULE:
• Free users get 20,000 tokens. When limit is hit, the proxy returns HTTP 402 with { code: 'TOKEN_LIMIT_REACHED' }
• Always catch this error and show the upgrade banner — never crash
"""

if "AUTOMATED BACKEND & NAMESPACING" not in content:
    content = content.replace(
        "═══════════════════════════════════════════\nDEFAULT TECH STACK",
        system_prompt_addition + "\n\n═══════════════════════════════════════════\nDEFAULT TECH STACK"
    )

with open('backend/routes/claude.js', 'w') as f:
    f.write(content)

print("Done python script 2")
