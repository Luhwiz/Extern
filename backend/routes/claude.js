const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const admin = require('firebase-admin');
const { authenticateToken } = require('../middleware/auth');
const database = require('../models/database');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const db = admin.firestore();

// Helper to get/create user usage document
async function getUserUsage(userId) {
  const userRef = db.collection('users').doc(userId);
  const userDoc = await userRef.get();

  const now = new Date();
  const today = now.toISOString().split('T')[0];

  if (!userDoc.exists) {
    // Create new user document
    const userData = {
      createdAt: now,
      usage: {
        requestsToday: 0,
        tokensToday: 0,
        lastResetDate: today,
        totalRequests: 0,
        totalTokens: 0,
        isLifetimeLimited: true
      },
      limits: {
        maxRequestsPerDay: parseInt(process.env.MAX_REQUESTS_PER_DAY) || 100,
        maxTokensPerDay: Infinity, // Unlimited
        maxLifetimeRequests: parseInt(process.env.MAX_LIFETIME_REQUESTS) || 20
      }
    };
    await userRef.set(userData);
    return userData;
  }


  const userData = userDoc.data();

  // Reset daily usage if it's a new day
  let needsUpdate = false;

  if (userData.usage.lastResetDate !== today) {
    userData.usage.requestsToday = 0;
    userData.usage.tokensToday = 0;
    userData.usage.lastResetDate = today;
    needsUpdate = true;
  }

  // MIGRATION: Reset totalRequests for existing users to give them a fresh 30 prompts
  if (!userData.usage.isLifetimeLimited) {
    console.log(`[Migration] Resetting totalRequests for user ${userId} to start 30 prompt limit`);
    userData.usage.totalRequests = 0;
    userData.usage.isLifetimeLimited = true;
    needsUpdate = true;
  }

  if (needsUpdate) {
    await userRef.update({ usage: userData.usage });
  }

  return userData;
}

// Summarization endpoint (Layer 3: Conversation pruning)
router.post('/summarize', authenticateToken, async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Invalid messages format' });
    }

    console.log(`[Summarize] Generating summary for ${messages.length} messages`);

    // Call Claude to summarize
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1000,
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
      ],
    });

    const summary = msg.content[0].text;
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

    // Get user usage
    const userData = await getUserUsage(userId);

    // Check if user has exceeded limits
    const maxLifetimeRequests = parseInt(process.env.MAX_LIFETIME_REQUESTS) || 20;

    // Ensure limits object has the lifetime limit
    if (!userData.limits.maxLifetimeRequests) {
      userData.limits.maxLifetimeRequests = maxLifetimeRequests;
    }

    if (userData.usage.totalRequests >= maxLifetimeRequests) {
      return res.status(403).json({
        error: 'Free prompts exhausted',
        message: 'You have used all 20 free prompts. Please upgrade to continue.',
        usage: userData.usage,
        limits: userData.limits
      });
    }

    if (userData.usage.requestsToday >= userData.limits.maxRequestsPerDay ||
      userData.usage.tokensToday >= userData.limits.maxTokensPerDay) {
      return res.status(429).json({
        error: 'Daily limit exceeded',
        usage: userData.usage,
        limits: userData.limits
      });
    }

    // Get request body
    const { messages, max_tokens = 20000, system, projectState, conversationSummary } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid messages format' });
    }

    // Optimized System Prompt - AI as Software Developer
    let defaultSystemPrompt = `You are a software developer. Execute instructions immediately. No confirmations needed.

═══════════════════════════════════════════
CRITICAL RULES (READ FIRST)
═══════════════════════════════════════════


1. BRIEF EXPLANATION
   • You MAY briefly explain what you are about to do before the code.
   • Keep it concise and helpful.

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

ONE STEP AT A TIME:
• Max 3 files OR 2 commands per response
• Stop and wait after each batch
• Each file must be 100% complete - no partial files

• User says anything (continue/next/ok/yes) → proceed
• User gives new instruction → switch to that

IMPORTANT:
• If a file is too long for one response, split into multiple smaller files
• Better to have 3 complete small files than 1 incomplete large file
• Every file you write must be immediately runnable

RESPONSE FORMAT (mandatory at end of every response):

(Brief explanation)
(Code blocks/Commands here)

---
**Summary**
[Recap of what was done]

**Next Step**
[Propose next step] - Shall I proceed?

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
• First response MUST include ONLY 'npm install' and the start command in the bash block.
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

    // Start Anthropic stream
    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: Math.min(max_tokens, 20000),
      system: finalSystemPrompt,
      messages: messages,
    });

    let totalTokens = 0;

    // Handle stream events
    stream.on('text', (text) => {
      res.write(`data: ${JSON.stringify({ type: 'content_block_delta', delta: { text } })}\n\n`);
    });

    stream.on('message', (message) => {
      if (message.usage) {
        totalTokens = message.usage.output_tokens || 0;
      }
    });

    stream.on('end', async () => {
      // Update user usage in Firestore
      const userRef = db.collection('users').doc(userId);
      await userRef.update({
        'usage.requestsToday': admin.firestore.FieldValue.increment(1),
        'usage.tokensToday': admin.firestore.FieldValue.increment(totalTokens),
        'usage.totalRequests': admin.firestore.FieldValue.increment(1),
        'usage.totalTokens': admin.firestore.FieldValue.increment(totalTokens)
      });

      res.write(`data: ${JSON.stringify({ done: true, tokens: totalTokens })}\n\n`);
      res.end();
    });

    stream.on('error', (error) => {
      console.error('SERVER LOG: Stream error:', error);
      res.write(`data: ${JSON.stringify({ error: error.message || 'Stream error' })}\n\n`);
      res.end();
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
      model_used: 'claude-sonnet-4-5-20250929'
    });
  }
});

// Get user usage stats
router.get('/usage', authenticateToken, async (req, res) => {
  try {
    const userData = await getUserUsage(req.userId);

    const maxLifetimeRequests = userData.limits.maxLifetimeRequests || 20;
    const totalRequests = userData.usage.totalRequests || 0;
    const remainingRequests = Math.max(0, maxLifetimeRequests - totalRequests);

    res.json({
      usage: userData.usage,
      limits: userData.limits,
      remaining: {
        requests: userData.limits.maxRequestsPerDay - userData.usage.requestsToday,
        tokens: userData.limits.maxTokensPerDay - userData.usage.tokensToday
      },
      subscription: {
        tier: 'free',
        freePromptsRemaining: remainingRequests,
        maxFreePrompts: maxLifetimeRequests
      }
    });
  } catch (error) {
    console.error('Usage fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch usage' });
  }
});

module.exports = router;
