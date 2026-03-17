# ExternAI — Complete Application Documentation

> **Version:** 1.1.77  
> **Author:** Sonelise Pakade  
> **License:** Restricted (No commercial gain or modification)  
> **Platform:** macOS · Windows (cross-platform Electron app)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture Overview](#2-architecture-overview)
3. [Project Structure](#3-project-structure)
4. [Technology Stack](#4-technology-stack)
5. [Getting Started](#5-getting-started)
   - [Prerequisites](#prerequisites)
   - [Installation](#installation)
   - [Environment Variables](#environment-variables)
   - [Running in Development](#running-in-development)
   - [Building for Production](#building-for-production)
6. [Frontend (Renderer Process)](#6-frontend-renderer-process)
   - [App Entry Point](#app-entry-point)
   - [Components](#components)
   - [Services](#services)
7. [Backend (Express API Server)](#7-backend-express-api-server)
   - [Server Setup](#server-setup)
   - [API Routes](#api-routes)
   - [Middleware](#middleware)
8. [Electron Main Process](#8-electron-main-process)
   - [Window Creation](#window-creation)
   - [IPC Handlers](#ipc-handlers)
   - [Terminal Support](#terminal-support)
   - [File System Operations](#file-system-operations)
9. [AI Integration](#9-ai-integration)
   - [Claude AI (Anthropic)](#claude-ai-anthropic)
   - [Streaming Architecture](#streaming-architecture)
   - [Context Memory System](#context-memory-system)
   - [System Prompt](#system-prompt)
10. [Authentication & User Management](#10-authentication--user-management)
    - [Firebase Authentication](#firebase-authentication)
    - [Usage Tracking & Limits](#usage-tracking--limits)
    - [Subscription Tiers](#subscription-tiers)
11. [Database Schema (Firestore)](#11-database-schema-firestore)
12. [Analytics](#12-analytics)
13. [Keyboard Shortcuts](#13-keyboard-shortcuts)
14. [Distribution & Releases](#14-distribution--releases)
15. [Deployment](#15-deployment)
16. [Environment Variable Reference](#16-environment-variable-reference)
17. [Known Limitations & Future Roadmap](#17-known-limitations--future-roadmap)

---

## 1. Overview

**ExternAI** (internally codenamed *eletr0*) is a cross-platform **AI-powered desktop IDE** built with Electron, React, and the Anthropic Claude API. It delivers a VS Code-like development experience with deep AI integration — allowing developers to write code, run terminals, manage files, and get AI-assisted code generation all from within one application.

### Core Features at a Glance

| Feature | Description |
|---|---|
| **Monaco Editor** | Full VS Code editor with syntax highlighting for 50+ languages |
| **Integrated Terminal** | Multi-session XTerm.js terminal powered by node-pty |
| **AI Assistant** | Claude-powered code generation and debugging with streaming responses |
| **File Explorer** | Full file/folder CRUD with live file watching via Chokidar |
| **Firebase Auth** | Email/password authentication with session persistence |
| **Usage Tracking** | Per-user daily and lifetime AI request limits |
| **Bottom Panels** | Output, Problems, and Debug Console panels |
| **Source Control** | Built-in Git status and diff viewer |
| **Publishing** | Deploy projects via Firebase Functions |

---

## 2. Architecture Overview

ExternAI follows a **three-process Electron architecture** with a separate backend API server:

```
┌──────────────────────────────────────────────────────────────────┐
│                       Desktop Application                        │
│                                                                  │
│  ┌─────────────────────────────────┐    ┌─────────────────────┐ │
│  │     Renderer Process (React)    │    │   Main Process      │ │
│  │                                 │◄──►│   (Node.js)         │ │
│  │  - UI Components                │IPC │   - Window Manager  │ │
│  │  - AI Assistant Chat            │    │   - File System     │ │
│  │  - Monaco Editor                │    │   - Terminals       │ │
│  │  - File Explorer                │    │   - File Watchers   │ │
│  │  - Sidebar / Panels             │    │   - IPC Handlers    │ │
│  │  - Firebase Auth (client)       │    │   - Auto-Updater    │ │
│  └─────────────────────────────────┘    └─────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
                               │ HTTPS
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                  Backend API Server (Express)                     │
│                     Port 5000 (dev) / Railway                    │
│                                                                  │
│  - POST /api/claude/stream   → Anthropic streaming proxy         │
│  - POST /api/claude/summarize → Conversation summarization       │
│  - GET  /api/claude/usage    → Usage & subscription stats        │
│  - POST /api/payment/*       → Stripe payment processing         │
│  - GET  /health              → Health check                      │
│                                                                  │
│  Middleware: Firebase Admin token verification, rate limiting,   │
│             helmet security headers, CORS                        │
└──────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│               Firebase / Google Cloud                            │
│                                                                  │
│  - Firebase Auth    → User authentication                        │
│  - Firestore        → User usage, subscription, preferences      │
│  - Firebase Functions → Project publishing                       │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. Project Structure

```
eletr0/
├── src/
│   ├── main/                       # Electron main process
│   │   ├── main.js                 # Window creation, IPC handlers, pty management
│   │   ├── preload.js              # Secure IPC bridge (contextIsolation)
│   │   ├── ClaudeProxy.js          # (Legacy) Local Claude proxy helper
│   │   └── contentPolicy.js        # Content moderation rules
│   └── renderer/                   # React renderer process
│       ├── App.jsx                 # Root app component & state orchestration
│       ├── main.jsx                # React entry point (mounts App)
│       ├── index.css               # Global base styles
│       ├── App.css                 # App-level styles
│       ├── components/
│       │   ├── AIAssistant.jsx     # Main AI chat panel (large, 111 KB)
│       │   ├── AIAssistant.css     # AI panel styles (36 KB)
│       │   ├── ActivityBar.jsx     # Left icon bar (File, Search, Git, etc.)
│       │   ├── AuthScreen.jsx      # Login / Sign-up screen
│       │   ├── EditorArea.jsx      # Monaco editor tab management
│       │   ├── FileNameModal.jsx   # Prompt dialog for new file/folder names
│       │   ├── NodeJsRequiredModal.jsx  # Node.js install prompt
│       │   ├── NodeWarning.jsx     # Inline Node.js warning banner
│       │   ├── Panel.jsx           # Bottom panel container (tabs)
│       │   ├── PricingPlans.jsx    # Subscription plans UI
│       │   ├── PublishModal.jsx    # Deploy project modal
│       │   ├── PublishedApps.jsx   # List of user-published apps
│       │   ├── Sidebar.jsx         # Left sidebar container
│       │   ├── SplashScreen.jsx    # Loading/splash screen
│       │   ├── StatusBar.jsx       # Bottom status bar
│       │   ├── panels/
│       │   │   ├── OutputPanel.jsx     # Build/task output logs
│       │   │   ├── ProblemsPanel.jsx   # Code diagnostics viewer
│       │   │   └── DebugConsole.jsx    # Interactive JS debug console
│       │   └── sidebar/
│       │       ├── Explorer.jsx        # File tree browser
│       │       ├── Search.jsx          # In-project text search
│       │       ├── SourceControl.jsx   # Git status & diffs
│       │       ├── RunDebug.jsx        # Run & Debug panel
│       │       ├── Settings.jsx        # App settings UI
│       │       └── ImageSearch.jsx     # Image search panel
│       ├── services/
│       │   ├── FirebaseService.js      # Firebase Auth + Firestore client
│       │   ├── ClaudeService.js        # Anthropic API client (via backend)
│       │   ├── DatabaseService.js      # Firestore CRUD operations
│       │   ├── AnalyticsService.js     # Google Analytics 4 integration
│       │   ├── ProjectStateService.js  # AI context: project state (Layer 2)
│       │   ├── PublishService.js       # Project publishing logic
│       │   ├── VercelService.js        # Vercel deployment integration
│       │   └── openai.js              # (Legacy) OpenAI client
│       └── templates/                  # Project scaffold templates
│
├── backend/                        # Express.js API server (deployed to Railway)
│   ├── server.js                   # Express app setup & entry point
│   ├── routes/
│   │   ├── claude.js               # Claude API proxy & usage tracking
│   │   └── payment.js              # Stripe payment endpoints
│   ├── middleware/
│   │   └── auth.js                 # Firebase Admin token verification
│   ├── models/
│   │   └── database.js             # Firestore model helpers
│   ├── config/                     # Configuration files
│   ├── Dockerfile                  # Docker container definition
│   ├── railway.json                # Railway deployment config
│   └── package.json                # Backend dependencies
│
├── functions/                      # Firebase Cloud Functions
├── website/                        # Marketing / landing page
├── assets/                         # App icons and build assets
│   ├── icon.icns                   # macOS app icon
│   ├── icon.ico                    # Windows app icon
│   └── entitlements.mac.plist      # macOS entitlements
├── scripts/                        # Build helper scripts
├── .github/
│   └── workflows/                  # GitHub Actions CI/CD
├── index.html                      # Vite HTML entry point
├── vite.config.js                  # Vite build configuration
├── package.json                    # Root package & electron-builder config
└── start.sh                       # Development startup script
```

---

## 4. Technology Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| **Electron** | ^28.0.0 | Desktop app framework (cross-platform) |
| **React** | ^18.2.0 | UI library |
| **Vite** | ^5.0.7 | Dev server and build tool |
| **@monaco-editor/react** | ^4.6.0 | VS Code editor component |
| **@xterm/xterm** | ^5.3.0 | Terminal emulator |
| **@xterm/addon-fit** | ^0.10.0 | Terminal auto-resize |
| **@xterm/addon-web-links** | ^0.11.0 | Clickable links in terminal |
| **node-pty** | ^1.0.0 | Native terminal process (shell spawning) |
| **react-icons** | ^5.0.1 | Icon library |
| **firebase** | ^12.6.0 | Firebase client SDK (Auth + Firestore) |

### Backend
| Technology | Version | Purpose |
|---|---|---|
| **Express** | ^5.1.0 | HTTP API server |
| **@anthropic-ai/sdk** | latest | Claude API client |
| **firebase-admin** | ^13.6.0 | Server-side Firebase (token verification) |
| **helmet** | - | HTTP security headers |
| **express-rate-limit** | - | API rate limiting |
| **cors** | ^2.8.5 | Cross-origin resource sharing |

### Infrastructure
| Service | Purpose |
|---|---|
| **Firebase Auth** | User authentication (email/password) |
| **Firestore** | User data, usage tracking, subscriptions |
| **Firebase Functions** | Project publishing |
| **Railway** | Backend API hosting |
| **GitHub Actions** | CI/CD and automated releases |
| **Google Analytics 4** | Usage analytics |
| **electron-updater** | Auto-update system |
| **chokidar** | File system watching |
| **electron-store** | Encrypted local storage (auth tokens) |

---

## 5. Getting Started

### Prerequisites

- **Node.js** 18 or higher (required for native module compilation)
- **npm** 8 or higher
- **Firebase account** (for Auth and Firestore)
- **Anthropic API key** (for Claude AI features)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/Luncedo1234/Extern.git
cd Extern

# 2. Install root (Electron + React) dependencies
npm install

# 3. Rebuild native modules (node-pty) for your Electron version
npx @electron/rebuild -f -m node_modules/node-pty

# 4. Install backend dependencies
cd backend
npm install
cd ..
```

### Environment Variables

**Root `.env`** (copied from `.env.example`):

```env
# Firebase Client SDK Configuration
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# Google Analytics (optional)
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX

# Backend URL
VITE_BACKEND_URL=http://localhost:5000
```

**`backend/.env`** (copied from `backend/.env.example`):

```env
# Firebase Admin SDK (Service Account)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=service-account@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Anthropic Claude API
ANTHROPIC_API_KEY=sk-ant-xxxxx

# Usage Limits
MAX_REQUESTS_PER_DAY=100
MAX_LIFETIME_REQUESTS=20

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```

### Running in Development

```bash
# Option A: Use the startup script (starts everything)
./start.sh

# Option B: Manual (three terminals)

# Terminal 1 — Backend API server
cd backend && npm run dev

# Terminal 2 — Vite dev server (React renderer)
npm run dev:renderer

# Terminal 3 — Electron main process
npm run dev:electron
```

The Vite server starts on **port 3000** (with fallbacks to 3001, 3002, 5173).  
The backend API server starts on **port 5000**.

### Building for Production

```bash
# Build all platforms
npm run dist:all

# macOS only (produces .zip and .dmg for x64 + arm64)
npm run dist:mac

# Windows only (produces .exe installer + portable)
npm run dist:win

# Build without packaging (just compile)
npm run build
```

Build output goes to the `dist/` directory.

---

## 6. Frontend (Renderer Process)

### App Entry Point

**`src/renderer/main.jsx`** — React root mount:
```jsx
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
```

**`src/renderer/App.jsx`** — Root component (~19 KB). This is the main orchestrator and manages:
- Authentication state (listen for Firebase auth changes)
- Open file tabs & active editor state
- Sidebar panel selection (Explorer, Search, Git, Settings)
- Terminal session management
- Bottom panel visibility (Output, Problems, Debug Console)
- AI assistant panel state
- File watcher integration

### Components

#### Core Layout

| Component | File | Description |
|---|---|---|
| `ActivityBar` | `ActivityBar.jsx` | Vertical icon bar on the far left (File, Search, Git, Run, Settings icons) |
| `Sidebar` | `Sidebar.jsx` | Left sidebar container that renders the active panel |
| `EditorArea` | `EditorArea.jsx` | Monaco editor instance with tab bar; handles multi-file editing |
| `Panel` | `Panel.jsx` | Bottom panel container with Output / Problems / Debug Console tabs |
| `StatusBar` | `StatusBar.jsx` | Bottom thin status bar showing file info, branch, notifications |
| `SplashScreen` | `SplashScreen.jsx` | Animated loading screen shown on app startup |
| `AuthScreen` | `AuthScreen.jsx` | Login and signup form (shown when user is unauthenticated) |

#### Sidebar Panels

| Component | File | Description |
|---|---|---|
| `Explorer` | `sidebar/Explorer.jsx` | File tree browser with CRUD (create, rename, delete files & folders) |
| `Search` | `sidebar/Search.jsx` | Text search across all project files |
| `SourceControl` | `sidebar/SourceControl.jsx` | Git status, staged/unstaged changes, diff viewer |
| `RunDebug` | `sidebar/RunDebug.jsx` | Run configurations and debug tools |
| `Settings` | `sidebar/Settings.jsx` | App preferences panel |
| `ImageSearch` | `sidebar/ImageSearch.jsx` | Image search and asset browser |

#### Bottom Panels

| Component | File | Description |
|---|---|---|
| `OutputPanel` | `panels/OutputPanel.jsx` | Displays real-time logs from build tasks and commands; supports multiple channels, filtering, auto-scroll |
| `ProblemsPanel` | `panels/ProblemsPanel.jsx` | Code diagnostics viewer; shows errors/warnings/info per file; clicking navigates to the issue |
| `DebugConsole` | `panels/DebugConsole.jsx` | Interactive JavaScript REPL with command history (↑/↓ arrows) |

#### AI & Modals

| Component | File | Description |
|---|---|---|
| `AIAssistant` | `AIAssistant.jsx` | Full chat interface with Claude. Handles streaming, file creation from AI responses, auto-command execution, voice input, conversation memory. (~111 KB) |
| `FileNameModal` | `FileNameModal.jsx` | Dialog to prompt for file or folder name |
| `NodeJsRequiredModal` | `NodeJsRequiredModal.jsx` | Full modal warning shown when Node.js is not detected |
| `NodeWarning` | `NodeWarning.jsx` | Inline banner variant of the Node.js warning |
| `PricingPlans` | `PricingPlans.jsx` | Subscription plan selector (Free, Pro tiers) |
| `PublishModal` | `PublishModal.jsx` | Step-by-step UI to publish a project to Firebase hosting |
| `PublishedApps` | `PublishedApps.jsx` | List and manage previously deployed apps |

### Services

All services live in `src/renderer/services/`. They run in the **renderer process** and communicate with Firebase directly or with the backend via HTTP.

#### `FirebaseService.js`

Wraps the Firebase JS SDK v12. Provides:
- `signUp(email, password, name)` — Creates a new user + sets display name
- `signIn(email, password)` — Signs in an existing user
- `logout()` — Signs out
- `getIdToken()` — Gets a fresh Firebase ID token (attached to backend API calls as `Bearer` token)
- `onAuthChange(callback)` — Subscribe to auth state changes
- `getCurrentUser()` — Synchronously returns current user object
- `db` — Initialized Firestore instance

#### `ClaudeService.js`

Wraps HTTP calls to the backend `/api/claude` endpoints. All calls include a Firebase `Bearer` token in the `Authorization` header.

| Method | Endpoint | Description |
|---|---|---|
| `getClaudeCompletion(prompt, maxTokens, timeout)` | `POST /api/claude/stream` | One-shot completion (reads full SSE stream and returns complete text) |
| `getClaudeStream(prompt, onChunk, maxTokens, signal, systemPrompt, projectState, conversationSummary)` | `POST /api/claude/stream` | Streaming completion; calls `onChunk(chunkText, fullText)` for each token |
| `getUsage()` | `GET /api/claude/usage` | Returns current user's usage statistics and remaining prompts |
| `summarizeConversation(messages)` | `POST /api/claude/summarize` | Summarizes conversation messages for context compression |

**Stream parsing** follows the Anthropic SSE format: lines prefixed with `data: ` containing JSON objects of type `content_block_delta`.

**Abort signal support**: Pass an `AbortController.signal` to cancel an in-progress stream.

#### `DatabaseService.js`

Direct Firestore access from the client (uses `FirebaseService.db`). Organized into:

- **User Management**: `createUserProfile`, `getUserProfile`, `updateUserProfile`
- **Subscription Management**: `updateSubscription`, `getSubscription`, `incrementUsage`
- **Payment History**: `addPayment`, `getPaymentHistory`
- **Conversation History**: `saveConversation`, `updateConversation`, `getConversations`, `deleteConversation`
- **User Preferences**: `savePreferences`, `getPreferences`
- **Analytics**: `logActivity`

#### `ProjectStateService.js`

Implements **Layer 2** of the AI context memory system. Persists project metadata to `localStorage` and injects it into every AI request as structured system prompt context.

Managed state fields:
```js
{
  project_goal: string,       // Extracted from first user message
  architecture: string,       // Detected from messages (e.g., "web app")
  tech_stack: string[],       // Auto-detected keywords (React, Node.js, etc.)
  decisions: { text, timestamp }[],
  constraints: string[],
  created_at: ISO string,
  updated_at: ISO string
}
```

Key methods:
- `extractFromMessages(messages)` — Auto-extracts tech stack and architecture from conversation
- `toSystemPrompt()` — Returns a formatted string block injected into the system prompt
- `reset()` — Clears state for a new project

#### `AnalyticsService.js`

Singleton service wrapping **Google Analytics 4** (gtag.js). Dynamically injects the GA script and queues events that fire before the script loads.

Tracked events:
| Method | GA Event | When Used |
|---|---|---|
| `trackPageView(pageName)` | `page_view` | Screen navigation |
| `trackSession(userId, name)` | `session` | User login |
| `trackAIRequest(action, metadata)` | `ai_interaction` | Every Claude request |
| `trackFileOperation(op, type, name)` | `file_operation` | File CRUD |
| `trackCommand(cmd, success, time)` | `command_execution` | Terminal commands |
| `trackError(type, msg, ctx)` | `exception` | Caught errors |
| `trackFeatureUsage(feature, action, value)` | `feature_usage` | Feature interactions |
| `trackSubscription(event, tier, remaining)` | `subscription` | Plan events |
| `trackPublish(projectName, success)` | `publish` | Deploy events |

---

## 7. Backend (Express API Server)

The backend lives in `backend/` and is a standalone **Express 5** app. It is deployed to **Railway** in production and runs on port 5000 locally.

### Server Setup (`backend/server.js`)

On startup, the server:
1. Validates all required env vars (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `ANTHROPIC_API_KEY`) — exits with error if any are missing.
2. Initializes **Firebase Admin SDK** for server-side token verification.
3. Applies middleware: `helmet`, `cors`, `express-rate-limit` (100 req / 15 min per IP), body parser (10 MB limit).
4. Logs all incoming requests.
5. Mounts routes and a `/health` endpoint.

### API Routes

#### `POST /api/claude/stream`

Authenticated streaming proxy to Anthropic's Claude API.

**Request body:**
```json
{
  "messages": [{ "role": "user", "content": "..." }],
  "max_tokens": 20000,
  "system": "optional extra system prompt",
  "projectState": "optional project state string",
  "conversationSummary": "optional summary string"
}
```

**Flow:**
1. Verifies Firebase ID token → extracts `userId`
2. Fetches user usage from Firestore
3. Checks against lifetime limit (default: 20 free prompts) and daily limit
4. Constructs the final system prompt by merging: default dev prompt + project state + conversation summary + optional caller-provided system prompt
5. Streams the Anthropic response using SSE (`data: {...}\n\n`)
6. On stream end, increments `requestsToday`, `tokensToday`, `totalRequests`, `totalTokens` in Firestore

**Response:** SSE stream with events of shape:
```json
{ "type": "content_block_delta", "delta": { "text": "..." } }
// Final:
{ "done": true, "tokens": 1234 }
```

**Error responses:**
- `403` — Lifetime limit exhausted
- `429` — Daily limit exceeded or upstream rate limit
- `500` — API or server error

#### `POST /api/claude/summarize`

Calls Claude (non-streaming) to generate a compact summary of a conversation array. Used by Layer 3 of the context memory system.

**Request body:**
```json
{ "messages": [{ "role": "user", "content": "..." }, ...] }
```

**Response:**
```json
{ "summary": "Technical summary text under 300 words..." }
```

#### `GET /api/claude/usage`

Returns the authenticated user's current usage statistics.

**Response:**
```json
{
  "usage": { "requestsToday": 5, "tokensToday": 12000, "totalRequests": 12, "totalTokens": 45000 },
  "limits": { "maxRequestsPerDay": 100, "maxLifetimeRequests": 20 },
  "remaining": { "requests": 95, "tokens": "Infinity" },
  "subscription": { "tier": "free", "freePromptsRemaining": 8, "maxFreePrompts": 20 }
}
```

#### `GET /health`

Health check endpoint for Railway and uptime monitoring.

```json
{ "status": "healthy", "timestamp": "...", "uptime": 3600, "environment": "production" }
```

### Middleware

**`backend/middleware/auth.js`** — `authenticateToken`

Extracts the `Bearer` token from the `Authorization` header, verifies it with `admin.auth().verifyIdToken()`, and attaches `req.userId` to the request. Returns `401` if the token is missing or invalid.

---

## 8. Electron Main Process

The main process (`src/main/main.js`, ~1,382 lines) is the heart of the desktop app.

### Window Creation

```javascript
mainWindow = new BrowserWindow({
  width: 1400, height: 900,
  minWidth: 800, minHeight: 600,
  backgroundColor: '#1e1e1e',
  titleBarStyle: 'hiddenInset',         // macOS traffic lights inside window
  webPreferences: {
    preload: 'preload.js',
    contextIsolation: true,             // Secure IPC bridge
    nodeIntegration: false,             // No direct Node in renderer
    sandbox: false,                     // Needed for node-pty via IPC
  }
});
```

A **Content Security Policy** is applied via response headers, with separate relaxed (dev) and strict (production) policies. The CSP allows:
- Monaco editor (needs `unsafe-eval` in dev)
- Firebase SDK domains
- Google Analytics domains
- Railway backend API (`*.up.railway.app`)

### IPC Handlers

All renderer-to-main communication goes through the preload bridge. Handlers are registered with `ipcMain.handle(channel, handler)`.

#### File System

| IPC Channel | Description |
|---|---|
| `fs:readFile` | Read file content as UTF-8 string |
| `fs:writeFile` | Write string content to a file |
| `fs:readDir` | List directory contents with metadata |
| `fs:createFile` | Create an empty file |
| `fs:createDir` | Create a directory (recursive) |
| `fs:delete` | Delete a file or directory recursively |
| `fs:rename` | Rename / move a file or directory |

#### Dialogs

| IPC Channel | Description |
|---|---|
| `dialog:openFile` | Native file picker |
| `dialog:openFolder` | Native folder picker |
| `dialog:saveFile` | Native save dialog |

#### Terminal

| IPC Channel | Description |
|---|---|
| `terminal:create` | Spawn a new shell process (node-pty), returns `terminalId` |
| `terminal:write` | Send input to a terminal |
| `terminal:resize` | Resize terminal columns/rows |
| `terminal:kill` | Kill a terminal process |
| `terminal:getOutput` | Get last 500 lines of terminal output buffer |

#### Output Channels

| IPC Channel | Description |
|---|---|
| `output:log` | Log a message to a named output channel |
| `output:clear` | Clear messages from a channel |
| `output:get` | Get all messages from a channel |
| `process:run` | Run a shell command and stream stdout/stderr to output panel |

#### Diagnostics

| IPC Channel | Description |
|---|---|
| `diagnostics:analyze` | Static analysis of a file; detects: `console.log` warnings, `debugger` statements, `var` usage, TODO/FIXME comments, Python `print()`, CSS `!important` |

#### System

| IPC Channel | Description |
|---|---|
| `system:checkNodeJs` | Detect if Node.js is installed via shell |
| `system:dismissNodeJsModal` | Permanently dismiss the Node.js modal |
| `system:downloadNodeJs` | Open the Node.js download page in browser |

#### File Watcher

| IPC Channel | Description |
|---|---|
| `watch:start` | Start watching a directory with Chokidar; emits `file:added`, `file:changed`, `file:removed`, `dir:added`, `dir:removed` |
| `watch:stop` | Stop a directory watcher |

### Terminal Support

The terminal environment is constructed carefully to ensure that tools installed via NVM, Homebrew, and other shell managers are accessible:

1. An **interactive login shell** is spawned once (`zsh -ilc "echo $PATH"`) to capture the full user PATH.
2. This path is **cached** for the lifetime of the app to avoid repeated shell spawns.
3. Additional fallback paths are merged in (e.g., `/opt/homebrew/bin`, `/usr/local/bin`).
4. The project's local `node_modules/.bin` is prepended.

Each terminal session:
- Gets a unique `terminalId` (timestamp-based)
- Has an output buffer of up to **1,000 chunks** (for AI to read terminal output)
- Cleans up automatically on exit

### File System Operations

All file system operations run in the main process and are exposed to the renderer via IPC. Operations are `async` and return `{ success: boolean, ...data }` objects. Failed operations return `{ success: false, error: error.message }`.

---

## 9. AI Integration

### Claude AI (Anthropic)

ExternAI uses **Anthropic's Claude** (`claude-sonnet-4-20250514`) as its AI engine. All requests flow through the backend to protect the API key.

### Streaming Architecture

Responses are delivered as **Server-Sent Events (SSE)**:

```
Renderer (ClaudeService.js)
  │ fetch POST /api/claude/stream
  │
  ▼
Backend (routes/claude.js)
  │ anthropic.messages.stream({...})
  │ stream.on('text', ...) → res.write(`data: ${JSON.stringify(...)}\n\n`)
  │
  ▼
Renderer
  │ ReadableStream → TextDecoder → line-by-line SSE parser
  │ onChunk(chunkText, fullText) called per token
  │
  ▼
AIAssistant.jsx
  │ React state updated per chunk → live streaming UI
```

**Buffering**: The client maintains a `buffer` string for incomplete SSE lines split across network chunks, ensuring robust multi-byte character handling.

**Abort**: Requests support cancellation via `AbortController.signal`, which is passed directly to `fetch()`.

### Context Memory System

ExternAI implements a **3-layer context memory system** to maintain AI awareness across a long session:

| Layer | What | Where |
|---|---|---|
| **Layer 1** | Live conversation messages | In-memory (React state), sent each request |
| **Layer 2** | Project state (goal, tech stack, architecture, decisions) | `localStorage` via `ProjectStateService`; injected into system prompt |
| **Layer 3** | Conversation summary | Triggered when conversation grows large; generated by Claude itself; appended to system prompt |

**Layer 3 Summarization** is triggered at configurable thresholds. The `ClaudeService.summarizeConversation(messages)` endpoint asks Claude to produce a ≤300-word technical summary focused on:
- Key decisions made
- Technical choices and rationale
- Open tasks
- Important context to remember

The summary is then stored and re-injected on subsequent requests as:
```
## CONVERSATION HISTORY SUMMARY

[summary text]
```

### System Prompt

The default system prompt (embedded in `backend/routes/claude.js`) configures Claude as a **software developer AI** with strict output rules:

- **File format**: All code must use ` ```language filename=path/to/file.ext ``` ` format so the frontend can automatically create/update files
- **Completeness**: Every file must be 100% complete — no truncation, no placeholders, no TODOs
- **Pacing**: Max 3 files or 2 commands per response; wait for user confirmation
- **Default stack**: Vite + React + Tailwind CSS frontend, Node.js + Express backend
- **Error handling**: Structured auto-fix process when commands fail
- **Forbidden**: Asking for confirmation, partial files, syntax errors, absolute paths

---

## 10. Authentication & User Management

### Firebase Authentication

ExternAI uses Firebase Auth with **email/password** sign-in:

- **Sign up**: Creates a user account, sets `displayName` via `updateProfile`
- **Sign in**: Returns a `UserCredential` and stores the session
- **Session persistence**: Firebase SDK persists auth state in `IndexedDB` by default (survives app restarts)
- **Token**: `getIdToken()` returns a short-lived (1h) JWT. Firebase auto-refreshes it. The backend verifies this token on every API call.
- **Electron-store**: Auth tokens are also stored in encrypted electron-store for offline mode

Error codes are translated to friendly messages (e.g., `auth/weak-password` → "Password is too weak (minimum 6 characters)").

### Usage Tracking & Limits

Usage is tracked in **Firestore** under `users/{userId}`:

```json
{
  "usage": {
    "requestsToday": 5,
    "tokensToday": 12345,
    "lastResetDate": "2025-01-15",
    "totalRequests": 12,
    "totalTokens": 45678,
    "isLifetimeLimited": true
  },
  "limits": {
    "maxRequestsPerDay": 100,
    "maxTokensPerDay": "Infinity",
    "maxLifetimeRequests": 20
  }
}
```

**Reset logic**: `requestsToday` and `tokensToday` are reset daily when `lastResetDate` doesn't match today's date.

**Limit enforcement** (backend, before each Claude request):
1. If `totalRequests >= maxLifetimeRequests` → `403 Free prompts exhausted`
2. If `requestsToday >= maxRequestsPerDay` → `429 Daily limit exceeded`

**After each successful request**, the backend increments `requestsToday`, `tokensToday`, `totalRequests`, `totalTokens` using Firestore's `FieldValue.increment()` (atomic).

### Subscription Tiers

| Tier | Free Prompts | Daily Limit |
|---|---|---|
| **Free** | 20 lifetime prompts | 100/day |
| **Pro** *(in development)* | Unlimited | Configurable |

---

## 11. Database Schema (Firestore)

### `users/{userId}`
```json
{
  "createdAt": "Timestamp",
  "usage": {
    "requestsToday": "number",
    "tokensToday": "number",
    "lastResetDate": "YYYY-MM-DD",
    "totalRequests": "number",
    "totalTokens": "number",
    "isLifetimeLimited": "boolean"
  },
  "limits": {
    "maxRequestsPerDay": "number",
    "maxTokensPerDay": "number | Infinity",
    "maxLifetimeRequests": "number"
  }
}
```

### `subscriptions/{userId}`
```json
{
  "userId": "string",
  "tier": "free | pro",
  "requestsUsed": "number",
  "requestsLimit": "number",
  "lastUsed": "Timestamp",
  "resetDate": "Timestamp",
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}
```

### `conversations/{conversationId}`
```json
{
  "userId": "string",
  "messages": "array",
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}
```

### `payments/{paymentId}`
```json
{
  "userId": "string",
  "amount": "number",
  "currency": "string",
  "status": "string",
  "timestamp": "Timestamp"
}
```

### `preferences/{userId}`
```json
{
  "userId": "string",
  "theme": "string",
  "updatedAt": "Timestamp"
}
```

### `analytics/{logId}`
```json
{
  "userId": "string",
  "event": "string",
  "timestamp": "Timestamp"
}
```

---

## 12. Analytics

Google Analytics 4 is integrated via `AnalyticsService.js`. The GA measurement ID is set via `VITE_GA_MEASUREMENT_ID`.

**The gtag.js script is injected dynamically** — events fired before the script loads are queued in `pendingEvents[]` and flushed once GA is ready.

The CSP in `main.js` explicitly allows GA domains both for script loading and network connections (including DoubleClick for event forwarding).

If the measurement ID is not set, all tracking calls silently no-op.

---

## 13. Keyboard Shortcuts

### File Operations
| Shortcut | Action |
|---|---|
| `Cmd/Ctrl + N` | New File |
| `Cmd/Ctrl + O` | Open File |
| `Cmd/Ctrl + Shift + O` | Open Folder |
| `Cmd/Ctrl + S` | Save |
| `Cmd/Ctrl + Shift + S` | Save As |

### View
| Shortcut | Action |
|---|---|
| `` Cmd/Ctrl + ` `` | Toggle Terminal |
| `Cmd/Ctrl + B` | Toggle Sidebar |
| `F11` / `Cmd + Ctrl + F` | Toggle Fullscreen |

### Terminal
| Shortcut | Action |
|---|---|
| `` Cmd/Ctrl + Shift + ` `` | New Terminal |
| `Cmd/Ctrl + \` | Split Terminal |

### Edit
| Shortcut | Action |
|---|---|
| `Cmd/Ctrl + Z` | Undo |
| `Cmd/Ctrl + Shift + Z` | Redo |
| `Cmd/Ctrl + X` | Cut |
| `Cmd/Ctrl + C` | Copy |
| `Cmd/Ctrl + V` | Paste |
| `Cmd/Ctrl + A` | Select All |

---

## 14. Distribution & Releases

ExternAI is distributed as native desktop binaries via **GitHub Releases** and **electron-builder**.

### Build Targets

| Platform | Format | Architecture |
|---|---|---|
| **macOS** | `.zip` (recommended) | x64 (Intel) + arm64 (Apple Silicon) |
| **macOS** | `.dmg` | x64 + arm64 |
| **Windows** | `.exe` (NSIS Installer) | x64 |
| **Windows** | Portable `.exe` | x64 |

### GitHub Actions CI/CD

Workflows live in `.github/workflows/`. On a new release commit or tag:
1. electron-builder compiles the app for all targets
2. Artifacts are uploaded to a **GitHub Release**
3. `electron-updater` picks up the release manifest (`latest-mac.yml`, `latest.yml`) and notifies users in-app

### Auto-updater

`electron-updater` is initialized only when the app is packaged (`app.isPackaged`). In development, a dummy stub is used to prevent crashes. The `publish` config in `package.json` points to:

```json
{
  "provider": "github",
  "owner": "luncedo202",
  "repo": "-externai-Desktop",
  "timeout": 600000
}
```

---

## 15. Deployment

### Backend (Railway)

The Express backend includes a `railway.json` and `railway.toml` for one-click Railway deployment.

Set the following environment variables in Railway:
```
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
ANTHROPIC_API_KEY
MAX_REQUESTS_PER_DAY
MAX_LIFETIME_REQUESTS
ALLOWED_ORIGINS
PORT  (Railway sets this automatically)
```

### Backend (Azure)

A `Dockerfile`, `azure-deploy.yml`, and `deploy-azure.sh` are included for Azure Container App deployment. See `AZURE_DEPLOYMENT_GUIDE.md` for step-by-step instructions.

### Firebase Functions

Project publishing functionality is implemented as a **Firebase Cloud Function** in the `functions/` directory. Deploy with:

```bash
firebase deploy --only functions
```

---

## 16. Environment Variable Reference

### Client (Root `.env`)

| Variable | Required | Description |
|---|---|---|
| `VITE_FIREBASE_API_KEY` | ✅ | Firebase Web API Key |
| `VITE_FIREBASE_AUTH_DOMAIN` | ✅ | Firebase Auth domain |
| `VITE_FIREBASE_PROJECT_ID` | ✅ | Firebase Project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | ✅ | Firebase Storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | ✅ | Firebase Messaging sender ID |
| `VITE_FIREBASE_APP_ID` | ✅ | Firebase App ID |
| `VITE_BACKEND_URL` | ✅ | Backend API base URL (e.g., `http://localhost:5000`) |
| `VITE_GA_MEASUREMENT_ID` | ⚪ | Google Analytics 4 measurement ID |

### Server (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `FIREBASE_PROJECT_ID` | ✅ | Firebase Project ID (same as client) |
| `FIREBASE_CLIENT_EMAIL` | ✅ | Service account email |
| `FIREBASE_PRIVATE_KEY` | ✅ | Service account private key |
| `ANTHROPIC_API_KEY` | ✅ | Anthropic API key (starts with `sk-ant-`) |
| `MAX_REQUESTS_PER_DAY` | ⚪ | Daily request limit per user (default: 100) |
| `MAX_LIFETIME_REQUESTS` | ⚪ | Lifetime free prompt limit (default: 20) |
| `ALLOWED_ORIGINS` | ⚪ | Comma-separated CORS origins |
| `PORT` | ⚪ | Server port (default: 5000) |
| `NODE_ENV` | ⚪ | `development` or `production` |

---

## 17. Known Limitations & Future Roadmap

### Current Limitations

- **Free tier**: 20 lifetime prompts per account (hard-coded in backend env)
- **Max tokens**: Capped at 20,000 tokens per request
- **No offline AI**: All AI features require an internet connection and a valid user session
- **node-pty**: Must be rebuilt for each Electron version (`npx @electron/rebuild`)
- **macOS only signed**: App is not code-signed (Gatekeeper may block on first launch; right-click → Open to bypass)

### Roadmap (Features in Development)

- [ ] **Git integration** — Full commit/push/pull from within the IDE
- [ ] **Pro subscription tier** — Unlimited AI prompts via Stripe billing
- [ ] **Extension marketplace** — Plugin system for third-party extensions
- [ ] **Theme customization** — User-selectable editor and UI themes
- [ ] **Live preview** — In-app preview pane for web projects
- [ ] **Mobile app preview** — React Native simulator integration
- [ ] **Game canvas preview** — HTML5 Canvas / Phaser live preview
- [ ] **Collaborative editing** — Real-time multi-user editing
- [ ] **Docker dev containers** — Project isolation via Docker

---

*Documentation generated for ExternAI v1.1.77 — February 2026*
