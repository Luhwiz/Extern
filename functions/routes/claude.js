const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const admin = require('firebase-admin');
const { authenticateToken } = require('../middleware/auth');

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

  // MIGRATION: Ensure isLifetimeLimited is set
  if (!userData.usage.isLifetimeLimited) {
    userData.usage.totalRequests = 0;
    userData.usage.isLifetimeLimited = true;
    needsUpdate = true;
  }

  if (needsUpdate) {
    await userRef.update({ usage: userData.usage });
  }

  return userData;
}

// Summarization endpoint
router.post('/summarize', authenticateToken, async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Invalid messages format' });
    }

    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1000,
      system: 'You are a technical summarizer. Generate concise, fact-based summaries.',
      messages: [
        {
          role: 'user',
          content: `Summarize this conversation concisely...\n\nConversation:\n${messages.map(m => `${m.role}: ${m.content.substring(0, 500)}`).join('\n\n')}\n\nSummary:`
        }
      ],
    });

    res.json({ summary: msg.content[0].text });
  } catch (error) {
    console.error('[Summarize] Error:', error.message);
    res.status(500).json({ error: 'Summarization failed' });
  }
});

// Claude API proxy with streaming
router.post('/stream', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const userData = await getUserUsage(userId);
    const maxLifetimeRequests = parseInt(process.env.MAX_LIFETIME_REQUESTS) || 20;

    if (userData.usage.totalRequests >= maxLifetimeRequests) {
      return res.status(403).json({
        error: 'Free prompts exhausted',
        message: 'You have used all free prompts.',
        usage: userData.usage,
        limits: userData.limits
      });
    }

    if (userData.usage.requestsToday >= userData.limits.maxRequestsPerDay) {
      return res.status(429).json({
        error: 'Daily limit exceeded',
        usage: userData.usage,
        limits: userData.limits
      });
    }

    const { messages, max_tokens = 20000, system, projectState, conversationSummary } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid messages format' });
    }

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
ERROR HANDLING & AUTO-FIX
═══════════════════════════════════════════

WHEN A COMMAND FAILS - FOLLOW THIS EXACT PROCESS:

1. READ ERROR THOROUGHLY
2. DIAGNOSE ROOT CAUSE
3. PROVIDE COMPLETE FIX (ENRE FILE)
4. NEVER REPEAT FAILED COMMANDS

You are the developer. Execute. Deliver. Every file complete and runnable.`;

    if (projectState) {
      defaultSystemPrompt += `\n\n${projectState}`;
    }

    if (conversationSummary) {
      defaultSystemPrompt += `\n\n## CONVERSATION HISTORY SUMMARY\n\n${conversationSummary}\n`;
    }

    let finalSystemPrompt = defaultSystemPrompt;
    if (system) {
      finalSystemPrompt = `${system}\n\n${defaultSystemPrompt}`;
    }

    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: Math.min(max_tokens, 20000),
      system: finalSystemPrompt,
      messages: messages,
    });

    let totalTokens = 0;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    stream.on('text', (text) => {
      res.write(`data: ${JSON.stringify({ type: 'content_block_delta', delta: { text } })}\n\n`);
    });

    stream.on('message', (message) => {
      if (message.usage) {
        totalTokens = message.usage.output_tokens || 0;
      }
    });

    stream.on('end', async () => {
      await db.collection('users').doc(userId).update({
        'usage.requestsToday': admin.firestore.FieldValue.increment(1),
        'usage.tokensToday': admin.firestore.FieldValue.increment(totalTokens),
        'usage.totalRequests': admin.firestore.FieldValue.increment(1)
      });
      res.write(`data: ${JSON.stringify({ done: true, tokens: totalTokens })}\n\n`);
      res.end();
    });

    stream.on('error', (error) => {
      res.write(`data: ${JSON.stringify({ error: error.message || 'Stream error' })}\n\n`);
      res.end();
    });

  } catch (error) {
    res.status(500).json({ error: 'Failed to process AI request', details: error.message });
  }
});

router.get('/usage', authenticateToken, async (req, res) => {
  try {
    const userData = await getUserUsage(req.userId);
    const maxLifetimeRequests = userData.limits.maxLifetimeRequests || 20;
    const remainingRequests = Math.max(0, maxLifetimeRequests - userData.usage.totalRequests);

    res.json({
      usage: userData.usage,
      limits: userData.limits,
      subscription: {
        tier: 'free',
        freePromptsRemaining: remainingRequests,
        maxFreePrompts: maxLifetimeRequests
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
});

module.exports = router;
