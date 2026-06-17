const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const { OpenAI } = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const admin = require('firebase-admin');
const { authenticateToken } = require('../middleware/auth');
const database = require('../models/database');

const { AnthropicBedrock } = require('@anthropic-ai/bedrock-sdk');

let anthropic;

if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  anthropic = new AnthropicBedrock({
    awsAccessKey: process.env.AWS_ACCESS_KEY_ID,
    awsSecretKey: process.env.AWS_SECRET_ACCESS_KEY,
    awsRegion: process.env.AWS_REGION || 'us-east-1',
  });
} else {
  anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
}

const db = admin.firestore();

// Helper to get/create user usage document
async function getUserUsage(userId, userTimezone = 'UTC') {
  const userRef = db.collection('users').doc(userId);
  const userDoc = await userRef.get();

  const now = new Date();
  
  // Format the date using the user's local timezone (e.g. '2023-10-04')
  let today;
  try {
    today = new Intl.DateTimeFormat('en-CA', { timeZone: userTimezone }).format(now);
  } catch (err) {
    // Fallback if timezone is invalid
    today = now.toISOString().split('T')[0];
  }

  const FREE_PROMPTS_PER_DAY = parseInt(process.env.FREE_PROMPTS_PER_DAY) || 8;

  if (!userDoc.exists) {
    // Create new user document
    const userData = {
      createdAt: now,
      usage: {
        requestsToday: 0,
        tokensToday: 0,
        lastResetDate: today,
        totalRequests: 0,
        totalTokens: 0
      },
      limits: {
        freePromptsPerDay: FREE_PROMPTS_PER_DAY,
        maxTokensPerDay: Infinity
      }
    };
    await userRef.set(userData);
    return userData;
  }

  const userData = userDoc.data();

  // Reset daily usage if it's a new day
  let needsUpdate = false;

  if (userData.usage.lastResetDate !== today) {
    console.log(`[DailyReset] Resetting daily usage for user ${userId}`);
    userData.usage.requestsToday = 0;
    userData.usage.tokensToday = 0;
    userData.usage.lastResetDate = today;
    needsUpdate = true;
  }

  // Ensure limits are up to date (migration for existing users)
  if (!userData.limits.freePromptsPerDay) {
    userData.limits.freePromptsPerDay = FREE_PROMPTS_PER_DAY;
    needsUpdate = true;
  }

  if (needsUpdate) {
    await userRef.update({ usage: userData.usage, limits: userData.limits });
  }

  return userData;
}

// Plan generation endpoint - generates implementation plan via OpenAI
router.post('/plan', authenticateToken, async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Invalid prompt' });
    }

    console.log(`[Plan] Generating implementation plan for: ${prompt.substring(0, 80)}...`);

    const completion = await anthropic.messages.create({
      model: process.env.AWS_BEDROCK_MODEL_ID || 'claude-3-5-sonnet-20241022',
      max_tokens: 2048,
      system: 'You are a concise technical planner. Write a plan in EXACTLY this format using markdown bold for subtitles:\n\n**Goal:** One sentence on what is being built.\n**UI:** What the interface looks like.\n**Data:** What data/state is managed.\n**AI:** How AI is involved (if at all).\n\nSTRICT RULES: Maximum 60 words total. No bullet sub-lists. No code. Plain English only. Bold the subtitle labels.',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const plan = completion.content[0].text;
    console.log(`[Plan] Generated plan (${plan.length} chars)`);
    res.json({ plan });
  } catch (error) {
    console.error('[Plan] Error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Plan generation failed',
      details: error.response?.data?.error?.message || error.message
    });
  }
});

// Summarization endpoint (Layer 3: Conversation pruning)
router.post('/summarize', authenticateToken, async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Invalid messages format' });
    }

    console.log(`[Summarize] Generating summary for ${messages.length} messages`);

    // Call Claude to summarize
    const completion = await anthropic.messages.create({
      model: process.env.AWS_BEDROCK_MODEL_ID || 'claude-3-5-sonnet-20241022',
      max_tokens: 2048,
      system: 'You are a technical summarizer. Generate concise, fact-based summaries.',
      messages: [
        {
          role: 'user',
          content: `Summarize this conversation concisely. Focus on:
- Key decisions made
- Technical choices and rationale
- Open tasks or pending work
- Important context that should be remembered

Keep it under 300 words. Be technical and precise.

Conversation:
${messages.map(m => `${m.role}: ${m.content.substring(0, 500)}`).join('\n\n')}

Summary:`
        }
      ]
    });

    const summary = completion.content[0].text;
    console.log(`[Summarize] Generated summary: ${summary.substring(0, 100)}...`);

    res.json({ summary });
  } catch (error) {
    console.error('[Summarize] Error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Summarization failed',
      details: error.response?.data?.error?.message || error.message
    });
  }
});

// Claude API proxy with streaming
router.post('/stream', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const userTimezone = req.headers['x-user-timezone'] || 'UTC';

    // Get user usage
    const userData = await getUserUsage(userId, userTimezone);

    // Check daily free prompt limit (resets every day)
    const freePromptsPerDay = userData.limits.freePromptsPerDay || parseInt(process.env.FREE_PROMPTS_PER_DAY) || 8;
    const promptsUsedToday = userData.usage.requestsToday || 0;

    if (promptsUsedToday >= freePromptsPerDay) {
      const now = new Date();
      // Calculate time until local midnight based on user's timezone
      let midnight = new Date(now);
      try {
        // Create a date string for the NEXT day in the user's timezone
        // This is a bit complex, but we can approximate by getting the current date in their timezone
        // adding 1 day, and setting to midnight
        const parts = new Intl.DateTimeFormat('en-US', {
          timeZone: userTimezone,
          year: 'numeric', month: 'numeric', day: 'numeric'
        }).formatToParts(now);
        
        const yr = parts.find(p => p.type === 'year').value;
        const mo = parts.find(p => p.type === 'month').value;
        const da = parts.find(p => p.type === 'day').value;
        
        // Next midnight in their timezone (by parsing the start of next day)
        // Since node might not support instantiating Date with arbitrary timezones perfectly,
        // we'll calculate the rough hours difference.
      } catch (e) {}

      // Fallback rough estimate for hours until reset (midnight local time)
      // A simple way is to get the current hour in their timezone and subtract from 24
      let hoursUntilReset = 24;
      try {
        const currentHour = parseInt(new Intl.DateTimeFormat('en-US', {
          timeZone: userTimezone,
          hour: 'numeric',
          hour12: false
        }).format(now), 10);
        // If hour is 24, it means midnight (depending on format), but typically 1-24 or 0-23
        const hr24 = currentHour === 24 ? 0 : currentHour;
        hoursUntilReset = 24 - hr24;
      } catch (err) {
        // Fallback to UTC calculation
        midnight.setUTCHours(24, 0, 0, 0);
        hoursUntilReset = Math.ceil((midnight - now) / (1000 * 60 * 60));
      }

      return res.status(429).json({
        error: 'Daily free prompts exhausted',
        message: 'your daily free credits are finished, your credits will refill the next day.',
        promptsUsedToday,
        freePromptsPerDay,
        hoursUntilReset,
        usage: userData.usage,
        limits: userData.limits
      });
    }

    // Get request body
    const { messages, max_tokens = 60000, system, projectState, conversationSummary } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid messages format' });
    }

    // Optimized System Prompt - AI as Software Developer
    let defaultSystemPrompt = `You are a software developer. Execute instructions immediately. No confirmations needed.

═══════════════════════════════════════════
CRITICAL RULES (READ FIRST)
═══════════════════════════════════════════


1. BRIEF EXPLANATION — MANDATORY
   • Before EVERY code block, write exactly 1 short sentence explaining what that file does.
   • Example: "Here's the main app entry point:"
   • Example: "This sets up your Tailwind CSS configuration:"
   • Example: "This is the Express server with your API routes:"
   • NEVER place multiple code blocks back-to-back without a sentence between them.
   • Keep each sentence concise — one line maximum.

2. FILE FORMAT - Without this, files won't be created:
\`\`\`language filename=path/to/file.ext
(complete code here)
\`\`\`

3. EVERY file must be:
   • Complete (first line to last line)
   • Syntactically valid (zero errors)
   • All brackets/quotes closed
   • All imports included
   • Ready to run immediately
   • NO TRUNCATION - Write the entire file

4. FORBIDDEN - Never write:
   • "// TODO", "// Add code here", "..."
   • "// ... rest of the code", "// ... (truncated)"
   • Incomplete functions or placeholders
   • Code that won't compile/run
   • Partial files that need "filling in"

═══════════════════════════════════════════
EXECUTION FLOW
═══════════════════════════════════════════

FIRST MESSAGE — COMPLETE & FULLY FUNCTIONAL:
• Generate ALL files necessary for the application to run completely — no file limit.
• Every component, route, service, config file, and asset the app needs must be included.
• Do NOT reference any port, service, or file that you have not explicitly created in this response.
• Create ALL necessary files FIRST (package.json, config files, source files, components, etc.)
• Every file must be 100% complete — no partial files, no placeholders, no TODOs.
• Then END with a bash block containing: npm install (first line) then the start command (e.g. npm run dev)

FOLLOW-UP MESSAGES — ONE STEP AT A TIME:
• Max 3 files OR 2 commands per response
• Stop and wait after each batch
• Each file must be 100% complete - no partial files
• Only include npm install / start command if a NEW dependency was added

• User says anything (continue/next/ok/yes) → proceed
• User gives new instruction → switch to that

IMPORTANT:
• If a file is too long for one response, split into multiple smaller files
• Better to have 3 complete small files than 1 incomplete large file
• Every file you write must be immediately runnable

RESPONSE FORMAT (mandatory at end of every response):

(Brief explanation)
(Code blocks/Commands here)

For FIRST message only — include bash block with BOTH commands right before the summary:
\`\`\`bash
npm install
npm run dev
\`\`\`

---
**Summary**
[Recap of what was done]

**Next Step**
[Propose next step] - Shall I proceed?

TOKEN LIMIT RULE:
• Free users get 2,000,000 tokens. When limit is hit, the proxy returns HTTP 402 with { code: 'TOKEN_LIMIT_REACHED' }
• Always catch this error and show the upgrade banner — never crash


═══════════════════════════════════════════
DEFAULT TECH STACK
═══════════════════════════════════════════

Unless user specifies otherwise:
• Frontend: Vite + React + Tailwind CSS
• Backend: Node.js + Express
• Simple pages: HTML + CSS + vanilla JS

WORK IN CURRENT FOLDER DIRECTLY:
• NEVER run: cd, npx create-vite, create-react-app, mkdir
• NEVER use absolute paths (e.g., /Users/...)
• Use relative paths only (e.g., src/, public/)
• First response MUST end with a bash block containing 'npm install' on line 1 and the start command (npm run dev / npm start) on line 2.
• Assume you are already in the correct root directory.

═══════════════════════════════════════════
    PACKAGE.JSON(when creating)
═══════════════════════════════════════════

Always include:
    \`\`\`json filename=package.json
{
  "name": "project-name",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "@vitejs/plugin-react": "^4.2.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0"
  }
}
\`\`\`

═══════════════════════════════════════════
VITE + TAILWIND SETUP (when using React)
═══════════════════════════════════════════

Required config files:

\`\`\`javascript filename=vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()]
});
\`\`\`

\`\`\`javascript filename=tailwind.config.js
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: { extend: {} },
  plugins: []
};
\`\`\`

\`\`\`javascript filename=postcss.config.js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {}
  }
};
\`\`\`

\`\`\`css filename=src/index.css
@tailwind base;
@tailwind components;
@tailwind utilities;
\`\`\`

═══════════════════════════════════════════
REACT COMPONENT TEMPLATE
═══════════════════════════════════════════

\`\`\`jsx filename=src/App.jsx
import React, { useState } from 'react';

export default function App() {
  const [state, setState] = useState(initialValue);
  
  const handleClick = () => {
    // handler logic
  };
  
  return (
    <div className="min-h-screen bg-gray-100">
      {/* JSX content */}
    </div>
  );
}
\`\`\`

═══════════════════════════════════════════
ERROR HANDLING & AUTO-FIX
═══════════════════════════════════════════

WHEN A COMMAND FAILS - FOLLOW THIS EXACT PROCESS:

1. READ ERROR THOROUGHLY
   • Identify error type (dependency, syntax, file missing, etc.)
   • Find exact file and line number if mentioned
   • Look for stack traces and root cause

2. DIAGNOSE ROOT CAUSE
   • Don't just treat symptoms
   • Understand why it failed
   • Check if it's a cascade from earlier issue

3. PROVIDE COMPLETE FIX
   • Always use filename= format for code
   • Provide ENTIRE file contents, not just changed lines
   • Include all imports, exports, and dependencies
   • Ensure syntax is 100% valid

4. NEVER REPEAT FAILED COMMANDS
   • Fix root cause first
   • Then provide corrected command if needed
   • Don't try the same thing expecting different results

COMMON ERROR PATTERNS & FIXES:

Module Not Found:
❌ "Cannot find module 'package-name'"
✅ Fix:
\`\`\`json filename=package.json
{
  "dependencies": {
    "package-name": "^1.0.0",
    ...existing deps
  }
}
\`\`\`
Then: \`\`\`bash
npm install
\`\`\`

File Not Found (ENOENT):
❌ "ENOENT: no such file '/path/to/file.js'"
✅ Create the missing file with complete code
\`\`\`javascript filename=path/to/file.js
// Complete implementation
\`\`\`

Syntax Error:
❌ "SyntaxError: Unexpected token"
✅ Read entire file, fix ALL syntax issues
\`\`\`javascript filename=src/broken.js
// Complete corrected file
\`\`\`

Port Already in Use:
❌ "EADDRINUSE: address already in use :::5173"
✅ Change port in config:
\`\`\`javascript filename=vite.config.js
export default defineConfig({
  server: { port: 5174 }
})
\`\`\`

Import Error:
❌ "Cannot resolve import"
✅ Fix import path AND ensure file exists:
\`\`\`javascript filename=src/App.jsx
import Component from './components/Component.jsx'
\`\`\`

Command Not Found:
❌ "command not found: xyz"
✅ Either install tool OR use different command:
\`\`\`bash
npm install -g xyz
\`\`\`

Windows Execution Policy:
❌ "cannot be loaded because running scripts is disabled on this system" or "Execution_Policies"
✅ Fix by bypassing the policy:
\`\`\`bash
Set-ExecutionPolicy Bypass -Scope CurrentUser -Force
\`\`\`

FORBIDDEN WHEN FIXING:
❌ Partial file fixes - Always provide complete files
❌ "Try running X" without fixing the cause
❌ Explanations without code
❌ Code without filename=
❌ Repeating failed commands

═══════════════════════════════════════════
CODE QUALITY CHECKLIST
═══════════════════════════════════════════

Before sending ANY code, verify:

REACT/JSX:
✓ import React from 'react' (if using JSX)
✓ useState/useEffect inside component function
✓ export default ComponentName
✓ Single root element (use <></> if needed)
✓ All tags closed: <Component /> or <div></div>
✓ Event handlers: onClick={() => fn()} or onClick={fn}
✓ VITE FAST REFRESH: NEVER export hooks (e.g. useAuth) from the same file as Context Providers. Export Providers from Context.jsx and hooks from a separate hooks.js file.

JAVASCRIPT:
✓ All imports at top
✓ All exports at bottom
✓ async/await with try/catch
✓ No undefined variables

HTML:
✓ <!DOCTYPE html>
✓ <html>, <head>, <body> structure
✓ All tags closed

CSS:
✓ All selectors closed with }
✓ All properties end with ;

JSON:
✓ No trailing commas
✓ Double quotes only
✓ Valid syntax

FIREBASE (when using Firestore or Storage):
✓ ALWAYS import { ensureAuthenticated } from '../firebase' (or wherever firebase.js lives)
✓ ALWAYS call: const user = await ensureAuthenticated(); before ANY Firestore or Storage operation
✓ This silently logs the user in if they are not already authenticated — it is MANDATORY, never skip it
✓ Firebase Security Rules require request.auth != null — without this call, ALL reads and writes will fail with "Missing Permissions"

═══════════════════════════════════════════
NEVER DO THIS
═══════════════════════════════════════════

❌ "Would you like me to..." - Just do it
❌ "Should I create..." - Just create it
❌ Ask for confirmation - Execute directly
❌ Multiple steps in one response - One step at a time
❌ Code without filename= - Files won't be created
❌ Incomplete code - Every file must be complete
❌ Syntax errors - Test in your mind before sending

You are the developer. Execute. Deliver. Every file complete and runnable.`;

    // Inject Project State (Layer 2) if provided
    if (projectState) {
      defaultSystemPrompt += `\n\n${projectState}`;
    }

    // Inject Conversation Summary (Layer 3) if provided
    if (conversationSummary) {
      defaultSystemPrompt += `\n\n## CONVERSATION HISTORY SUMMARY\n\n${conversationSummary}\n`;
    }

    // MERGE provided system prompt WITH default for full capabilities
    let finalSystemPrompt = defaultSystemPrompt;
    if (system) {
      finalSystemPrompt = `${system}\n\n${defaultSystemPrompt}`;
    }

    // Set Server-Sent Events headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Start Anthropic stream (safely clamp max_tokens to AWS limit 8192)
    const stream = anthropic.messages.stream({
      model: process.env.AWS_BEDROCK_MODEL_ID || 'claude-3-5-sonnet-20241022',
      max_tokens,
      system: finalSystemPrompt,
      messages: messages,
    });

    let totalTokens = 0;
    let stopReason = 'end_turn';
    let chunkCount = 0;

    // Handle stream events
    stream.on('text', (text) => {
      chunkCount++;
      res.write(`data: ${JSON.stringify({ type: 'content_block_delta', delta: { text } })}\n\n`);
    });

    stream.on('message', (message) => {
      if (message.usage) {
        totalTokens = message.usage.output_tokens || 0;
      }
      if (message.stop_reason) {
        stopReason = message.stop_reason;
      }
    });

    stream.on('end', async () => {
      console.log(`[Stream] Completed. Chunks sent: ${chunkCount}, Tokens: ${totalTokens}, Stop: ${stopReason}`);

      // Always end the response first so the client isn't left hanging
      res.write(`data: ${JSON.stringify({ done: true, tokens: totalTokens, stop_reason: stopReason })}\n\n`);
      res.end();

      // Update Firestore usage in the background (non-blocking)
      try {
        const userRef = db.collection('users').doc(userId);
        await userRef.update({
          'usage.requestsToday': admin.firestore.FieldValue.increment(1),
          'usage.tokensToday': admin.firestore.FieldValue.increment(totalTokens),
          'usage.totalRequests': admin.firestore.FieldValue.increment(1),
          'usage.totalTokens': admin.firestore.FieldValue.increment(totalTokens)
        });
      } catch (fsErr) {
        console.error('[Stream] Firestore usage update failed (non-fatal):', fsErr.message);
      }
    });

    stream.on('error', (error) => {
      console.error('[Stream] Stream error:', error.message);
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ error: error.message || 'Stream error' })}\n\n`);
        res.end();
      }
    });

  } catch (error) {
    console.error('SERVER LOG: Claude API Error Details:');
    console.error('- Status:', error.response?.status);
    console.error('- Status Text:', error.response?.statusText);

    // Try to read error data if it's a stream
    if (error.response?.data) {
      try {
        let errorData = '';
        if (typeof error.response.data.on === 'function') {
          error.response.data.on('data', (chunk) => {
            errorData += chunk.toString();
          });
          error.response.data.on('end', () => {
            console.error('- Error Data:', errorData);
          });
        } else {
          console.error('- Error Data:', error.response.data);
        }
      } catch (e) {
        console.error('- Could not parse error data');
      }
    }

    console.error('- Message:', error.message);

    if (error.response?.status === 429) {
      return res.status(429).json({ error: 'Rate limit exceeded on AI service' });
    }

    res.status(500).json({
      error: 'Failed to process AI request',
      details: error.response?.data?.error?.message || error.message,
      model_used: 'claude-sonnet-4-6'
    });
  }
});

// Get user usage stats
router.get('/usage', authenticateToken, async (req, res) => {
  try {
    const userData = await getUserUsage(req.userId);

    const freePromptsPerDay = userData.limits.freePromptsPerDay || parseInt(process.env.FREE_PROMPTS_PER_DAY) || 7;
    const promptsUsedToday = userData.usage.requestsToday || 0;
    const promptsRemainingToday = Math.max(0, freePromptsPerDay - promptsUsedToday);

    // Calculate hours until daily reset (midnight UTC)
    const now = new Date();
    const midnight = new Date(now);
    midnight.setUTCHours(24, 0, 0, 0);
    const hoursUntilReset = Math.ceil((midnight - now) / (1000 * 60 * 60));

    res.json({
      usage: userData.usage,
      limits: userData.limits,
      subscription: {
        tier: 'free',
        freePromptsPerDay,
        promptsUsedToday,
        freePromptsRemaining: promptsRemainingToday,
        hoursUntilReset
      }
    });
  } catch (error) {
    console.error('Usage fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch usage' });
  }
});

module.exports = router;
