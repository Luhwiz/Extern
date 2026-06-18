import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { FiX, FiSend, FiAlertCircle, FiDownload, FiFileText, FiFilePlus, FiEdit3, FiEye, FiCheck, FiLoader, FiCode, FiSettings, FiImage, FiFile, FiZap, FiChevronRight, FiMic, FiPlus, FiTool } from 'react-icons/fi';
import { SiJavascript, SiReact, SiHtml5, SiCss3, SiJson, SiMarkdown, SiPython, SiTypescript, SiNodedotjs } from 'react-icons/si';
import ClaudeService from '../services/ClaudeService';
import AnalyticsService from '../services/AnalyticsService';
import ProjectStateService from '../services/ProjectStateService';
import AiFeatureTemplates from '../templates/AiFeatureTemplate';
import './AIAssistant.css';

// Debug flag - set to false to disable verbose logging in production
const DEBUG = false;
const debug = (...args) => DEBUG && console.log(...args);

// Helper function to get file type icon based on extension
const getFileIcon = (filename) => {
  if (!filename) return <FiFile size={14} />;
  
  const ext = filename.split('.').pop().toLowerCase();
  const iconProps = { size: 14, style: { flexShrink: 0 } };
  
  const iconMap = {
    'js': <SiJavascript {...iconProps} color="#f7df1e" />,
    'jsx': <SiReact {...iconProps} color="#61dafb" />,
    'ts': <SiTypescript {...iconProps} color="#3178c6" />,
    'tsx': <SiReact {...iconProps} color="#61dafb" />,
    'html': <SiHtml5 {...iconProps} color="#e34f26" />,
    'css': <SiCss3 {...iconProps} color="#1572b6" />,
    'json': <SiJson {...iconProps} color="#5a5a5a" />,
    'md': <SiMarkdown {...iconProps} color="#ffffff" />,
    'py': <SiPython {...iconProps} color="#3776ab" />,
    'config': <FiSettings {...iconProps} />,
    'png': <FiImage {...iconProps} />,
    'jpg': <FiImage {...iconProps} />,
    'jpeg': <FiImage {...iconProps} />,
    'svg': <FiImage {...iconProps} />,
    'gif': <FiImage {...iconProps} />,
  };
  
  return iconMap[ext] || <FiFile {...iconProps} />;
};

// STRICT CODE SANITIZER - Removes ALL code-like content from text
// But preserves Summary section and markdown formatting
const sanitizeTextContent = (text) => {
  if (!text || typeof text !== 'string') return '';

  // Split by lines and filter aggressively
  const lines = text.split('\n');
  const cleanLines = [];

  // Track if we're in the Summary section (preserve everything there)
  let inSummarySection = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines but preserve spacing
    if (!trimmed) {
      cleanLines.push('');
      continue;
    }

    // Detect Summary section start
    if (trimmed === '---' || trimmed.includes('**Summary**') || trimmed.includes('## Summary')) {
      inSummarySection = true;
      cleanLines.push(line);
      continue;
    }

    // Detect end of Summary section (Next Step is part of summary)
    if (inSummarySection && (trimmed.startsWith('Ready?') || trimmed.includes('give new instructions'))) {
      cleanLines.push(line);
      inSummarySection = false;
      continue;
    }

    // Always preserve Summary section content
    if (inSummarySection) {
      cleanLines.push(line);
      continue;
    }

    // Always preserve these patterns (markdown, lists, headers)
    if (
      trimmed.startsWith('#') ||           // Headers
      trimmed.startsWith('**') ||          // Bold text
      trimmed.startsWith('- ') ||          // Lists
      trimmed.startsWith('* ') ||          // Lists
      trimmed.startsWith(' ') ||          // Bullet points
      trimmed.match(/^\d+\.?\s/) ||         // Numbered lists
      trimmed.startsWith('>') ||           // Blockquotes
      trimmed.startsWith('Files:') ||      // Summary fields
      trimmed.startsWith('Commands:') ||   // Summary fields
      trimmed.startsWith('Result:') ||     // Summary fields
      trimmed.startsWith('Next Step') ||   // Summary fields
      trimmed === '---'                     // Horizontal rules
    ) {
      cleanLines.push(line);
      continue;
    }

    // AGGRESSIVE CODE DETECTION - Skip ANY line that looks like code
    const isCode =
      // JavaScript/TypeScript patterns
      /^(import|export|const|let|var|function|class|interface|type|enum|async|await|return|throw|try|catch|finally|if|else|for|while|switch|case|default|break|continue|new|this|super|static|public|private|protected|readonly|get|set|yield)\s/.test(trimmed) ||
      /^(import|export)\s*\{/.test(trimmed) ||
      /^(import|export)\s+\*/.test(trimmed) ||
      /^from\s+['"]/.test(trimmed) ||
      // JSX/HTML tags
      /^<[a-zA-Z][a-zA-Z0-9]*[\s>\/]/.test(trimmed) ||
      /^<\/[a-zA-Z]/.test(trimmed) ||
      // Brackets and braces alone
      /^[\{\}\[\]\(\)]+;?\s*$/.test(trimmed) ||
      /^[\}\]\)]+[,;]?\s*$/.test(trimmed) ||
      // Object/array syntax (but not summary fields)
      /^\w+:\s*[\{\[\('"<]/.test(trimmed) ||
      // Function calls and definitions
      /^\w+\s*\([^)]*\)\s*[{;=]/.test(trimmed) ||
      /^=>\s*[\{\(]/.test(trimmed) ||
      /^\([^)]*\)\s*=>/.test(trimmed) ||
      // CSS patterns
      /^\.[a-zA-Z_-]+[\s\{:]/.test(trimmed) ||
      /^#[a-zA-Z_-]+[\s\{]/.test(trimmed) ||
      /^@(import|media|keyframes|font-face|tailwind|apply|layer|screen)/.test(trimmed) ||
      /^\w+\s*:\s*[^;]+;/.test(trimmed) && !trimmed.startsWith('http') ||
      // Assignment patterns
      /^(const|let|var)\s+\w+\s*=/.test(trimmed) ||
      // React hooks and patterns
      /^use[A-Z]\w*\s*\(/.test(trimmed) ||
      /^setState|^dispatch|^navigate/.test(trimmed) ||
      // Comments
      /^\/\//.test(trimmed) ||
      /^\/\*/.test(trimmed) ||
      /^\*\/?\s*$/.test(trimmed) ||
      // Module patterns
      /^module\.exports/.test(trimmed) ||
      /^require\s*\(/.test(trimmed) ||
      // DOCTYPE and HTML boilerplate
      /^<!DOCTYPE/i.test(trimmed) ||
      /^<html|^<head|^<body|^<meta|^<link|^<script|^<style/i.test(trimmed) ||
      // Config patterns
      /^"?\w+"?\s*:\s*\[/.test(trimmed) ||
      /^\w+\s*:\s*\{/.test(trimmed) ||
      // Ends with code-like characters (but not short lines or lists)
      /[{}\[\]();]$/.test(trimmed) && trimmed.length > 50 ||
      // Contains too many special code characters
      (trimmed.match(/[{}\[\]();=<>]/g) || []).length > 4 ||
      // className or style attributes
      /className\s*=/.test(trimmed) ||
      /style\s*=\s*\{/.test(trimmed) ||
      // Looks like a file path or import path
      /^['"]\.?\.?\//.test(trimmed) ||
      // Package.json patterns
      /^"(name|version|scripts|dependencies|devDependencies)"/.test(trimmed);

    if (isCode) {
      continue; // Skip this line entirely
    }

    // Allow the line if it passes all checks
    cleanLines.push(line);
  }

  // Join and clean up excessive whitespace
  return cleanLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
};

// Constants for timing
const TYPING_DELAY_MIN = 10; // ms - faster response speed
const TYPING_DELAY_MAX = 30; // ms - faster response speed

// Component to simulate command execution progress
const CommandProgress = ({ isExecuting }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isExecuting) {
      setProgress(100);
      return;
    }
    
    setProgress(0);
    const interval = setInterval(() => {
      setProgress(p => {
        if (p < 80) return p + (Math.random() * 5);
        if (p < 95) return p + (Math.random() * 2);
        if (p < 99) return p + 0.1;
        return p;
      });
    }, 500);

    return () => clearInterval(interval);
  }, [isExecuting]);

  if (!isExecuting && progress === 100) return null;

  return (
    <div className="command-progress-container" style={{ marginTop: '8px', width: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ width: '100%', background: 'rgba(255,255,255,0.1)', height: '4px', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(99.9, progress)}%`, height: '100%', background: '#4d9eff', transition: 'width 0.5s ease-out' }} />
      </div>
      <div style={{ fontSize: '10px', color: '#888', marginTop: '4px', textAlign: 'right' }}>
        {Math.floor(Math.min(99, progress))}%
      </div>
    </div>
  );
};

const AILoadingProgress = () => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setProgress(0);
    const interval = setInterval(() => {
      setProgress(p => {
        if (p < 50) return p + (Math.random() * 8);
        if (p < 85) return p + (Math.random() * 3);
        if (p < 99) return p + 0.2;
        return p;
      });
    }, 400);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="message assistant" style={{ background: 'transparent', padding: '16px 0', borderBottom: 'none' }}>
      <div className="message-header">
        <span className="sender-name">ExternAI</span>
      </div>
      <div className="message-content">
        <div style={{ color: '#888', marginBottom: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FiLoader className="spinning" size={12} /> Thinking...
        </div>
        <div style={{ width: '100%', background: 'rgba(255,255,255,0.05)', height: '4px', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(99.9, progress)}%`, height: '100%', background: '#4d9eff', transition: 'width 0.4s ease-out' }} />
        </div>
        <div style={{ fontSize: '10px', color: '#888', marginTop: '4px', textAlign: 'right' }}>
          {Math.floor(Math.min(99, progress))}%
        </div>
      </div>
    </div>
  );
};
const COMMAND_EXECUTION_DELAY = 1000; // ms between commands
const WORKSPACE_SCAN_DELAY = 500; // ms before scanning workspace
const STREAM_BUFFER_CHECK_DELAY = 50; // ms when waiting for content
const DISPLAY_COMPLETION_CHECK_DELAY = 100; // ms when waiting for display to finish

const ONE_SHOT_SYSTEM_PROMPT = `You are an AI assistant created by Extern AI.
Your goal is to provide COMPLETE, WORKING solutions in a SINGLE response.

═══════════════════════════════════════════
⚠️ CONTENT POLICY - READ FIRST ⚠️
═══════════════════════════════════════════

EXTERN AI CANNOT AND WILL NOT:
❌ Build code editors, text editors, or IDEs
❌ Build AI coding assistants or copilot-style tools
❌ Build clones or replicas of VS Code, Sublime, Atom, or any IDE
❌ Build online coding environments (like Replit, CodeSandbox)
❌ Build platforms that help users write or generate code
❌ Build clones or replicas of Extern AI itself

If a user asks for any of these, IMMEDIATELY respond with:
"I'm sorry, but I cannot help build code editors, IDEs, or AI coding assistants as it violates our content policy. I can, however, help you build web applications, mobile apps, games, and other software."

═══════════════════════════════════════════
⚡ PHASE 1 — FULL STACK FROM DAY ONE ⚡
═══════════════════════════════════════════

This is the FIRST response. Build the COMPLETE full-stack app immediately:

✅ DO install and configure Firebase (firebase, firebase/app, firebase/firestore, firebase/storage) — it is REQUIRED in every first response.
✅ DO create src/firebase.js using the FIREBASE_INIT_TEMPLATE provided below.
✅ DO include the built-in AI features immediately using the AI proxy API templates provided. DO NOT install openai, anthropic, or langchain.
✅ ONLY use the provided AI_SERVICE_TEMPLATE. Do NOT write your own fetch to OpenAI directly.
✅ All AI chat history MUST be saved to Firestore using the template as shown.
✅ Use only standard front-end packages (React, Vite, Tailwind CSS, Firebase).

❌ DO NOT run 'npm install openai' or any other AI SDK.
❌ DO NOT create any backend server files (server.js, express routes, etc.).
❌ DO NOT write your own fetch calls to api.openai.com — use the provided AI proxy template.

The .env file MUST include the Extern AI Firebase credentials and AI function URL exactly as shown in the ENV_TEMPLATE.

═══════════════════════════════════════════
STRICT RULES for ONE-SHOT PROJECT CREATION
═══════════════════════════════════════════

1. NO FILE LIMIT: Create ALL necessary files in a single response to scaffold the entire project. Do not leave any missing dependencies.
2. PREVENT CRASHES: Ensure that EVERY component imported in App.jsx or main.jsx is actually created. Never import a file that you haven't generated.
3. BRIEF SENTENCE BEFORE EACH FILE — MANDATORY: Write exactly 1 short sentence before every code block to explain what that file is.
   - Example: "Here's the main app entry point:"
   - Example: "This configures Tailwind CSS:"
   - NEVER place two code blocks back-to-back with no text between them.
4. AUTOMATIC SETUP & START (BASH BLOCK): ALWAYS include a bash code block at the END of your response with the EXACT setup commands:
   - YOU MUST generate a complete package.json file containing ALL dependencies (including firebase, react, vite, etc.)
   - Run a single command to install everything: npm install
   - Start the application so the user sees it instantly: npm run dev (or npm start)
   - NO 'cd' commands or absolute paths — you are already in the project root
   - List commands sequentially, one per line in the bash block
5. ABSOLUTE COMPLETENESS & PREMIUM STYLING:
   - Your first response MUST be fully functional and VISUALLY STUNNING.
   - Use Tailwind CSS + modern CSS for premium aesthetics (Gradients, Glassmorphism).
   - ALWAYS include 'src/index.css' with @tailwind directives.
   - ALWAYS include necessary config files (tailwind.config.js, postcss.config.js).
   - NEVER use placeholders.
   - UI DESIGN INSPIRATION — MANDATORY: Draw visual and UX inspiration from these world-class products:
     * Framer & Webflow — fluid layouts, smooth motion, editorial whitespace
     * Tesla & Pitch — bold dark themes, cinematic hero sections, high contrast
     * Dropbox & Slack — clean hierarchy, friendly spacing, trustworthy color palettes
     * Typeform & Superhuman — focused single-purpose views, distraction-free UX, keyboard-first feel
     * Revolut & Shopify — sharp data presentation, premium card components, conversion-optimized layouts
     * Grammarly — subtle AI-powered highlights, non-intrusive suggestions, polished micro-interactions
   - Combine the best of these: Bold typography (large, weighted headings), refined color systems (deep backgrounds with vibrant accents), generous spacing, purposeful animations, and pixel-perfect component design.
   - Every UI you build must feel like it belongs in a $10M-funded SaaS product.
6. MOBILE-FIRST — MANDATORY:
   - Every application MUST be fully mobile-friendly. Design mobile-first, then scale up.
   - Use responsive Tailwind classes (sm:, md:, lg:) on EVERY layout element. No fixed widths.
   - Study and replicate the mobile excellence of: Airbnb (fluid cards, thumb-friendly nav, bottom sheets), Dropbox (clean stacked layouts, large tap targets), Apple (full-bleed hero images, elegant scroll), Figma (compact toolbars, swipe gestures, adaptive panels), Stripe (crisp mobile docs, readable code blocks, smooth accordions), Notion (seamless mobile editing, collapsible blocks, floating action buttons), Spotify (bold imagery, tab-bar navigation, horizontal scroll carousels), Instagram (edge-to-edge media, gesture-driven UI, sticky headers), Uber (map-first layout, bottom drawer pattern, one-thumb reachability), Linear (minimal mobile dashboard, swipeable lists, keyboard shortcuts), Vercel (responsive deploy cards, dark-mode-first, status indicators), Medium (typography-focused reading, distraction-free mobile layout, pull-to-refresh).
   - Viewport meta tag is REQUIRED: <meta name="viewport" content="width=device-width, initial-scale=1.0">
   - Touch targets must be minimum 44×44px. Use mobile-friendly navigation (bottom nav bar or hamburger menu, never wide horizontal navbars on small screens).
   - Test every layout mentally at 375px width. If it would break or require horizontal scroll, fix it.
   - Images must use max-w-full and responsive sizing. Text must be readable without zooming.
7. EFFICIENCY: Deliver complete, runnable code immediately.

═══════════════════════════════════════════
🔥 FIREBASE + 🤖 AI AGENT INTEGRATION — MANDATORY 🔥
═══════════════════════════════════════════

Every generated application MUST have Firebase AND a fully working AI agent built-in from the FIRST response.
YOU MUST USE THE FOLLOWING EXACT TEMPLATES. DO NOT INSTALL OPENAI OR LANGCHAIN. DO NOT SKIP FIREBASE.

Template 0 (src/firebase.js) — REQUIRED IN EVERY APP:
${AiFeatureTemplates.FIREBASE_INIT_TEMPLATE}

Template 1 (src/services/aiService.js):
${AiFeatureTemplates.AI_SERVICE_TEMPLATE}

Template 2 (src/components/AiChat.jsx):
${AiFeatureTemplates.AI_CHAT_COMPONENT_TEMPLATE}

Template 3 (src/components/AiDocSearch.jsx):
${AiFeatureTemplates.AI_DOC_SEARCH_TEMPLATE}

Template 4 (.env) — use EXACTLY as shown, do not change the Firebase credentials:
${AiFeatureTemplates.ENV_TEMPLATE}

Modify the app UI (e.g. App.jsx) to import and include the AiChat and AiDocSearch components where appropriate so the user can interact with the AI immediately.`;


const FOLLOW_UP_SYSTEM_PROMPT = `You are an AI assistant created by Extern AI, iterating on an existing project.
You are now in "Developer/Editor" mode since the project is already scaffolded.

═══════════════════════════════════════════
⚠️ CONTENT POLICY - READ FIRST ⚠️
═══════════════════════════════════════════

EXTERN AI CANNOT AND WILL NOT:
❌ Build code editors, text editors, or IDEs
❌ Build AI coding assistants or copilot-style tools
❌ Build clones or replicas of VS Code, Sublime, Atom, or any IDE
❌ Build online coding environments (like Replit, CodeSandbox)
❌ Build platforms that help users write or generate code
❌ Build clones or replicas of Extern AI itself

If a user asks for any of these, IMMEDIATELY respond with:
"I'm sorry, but I cannot help build code editors, IDEs, or AI coding assistants as it violates our content policy. I can, however, help you build web applications, mobile apps, games, and other software."

═══════════════════════════════════════════
STRICT RULES for FOLLOW-UP ITERATIONS
═══════════════════════════════════════════

1. TARGETED EDITS: Focus only on the files that need changes based on the user's request.
2. CREATE MISSING DEPENDENCIES: If you add an import to a file, you MUST create the imported file immediately. Do not break the build.
3. NO REDUNDANT SETUP: Do NOT include 'npm install' or server-start commands unless a NEW dependency was added or specifically requested.
4. COMPLETE FILES: When providing a fix or update, ALWAYS provide the ENTIRE file content for the files you are changing. Never use partial snippets or "// ... existing code".
5. MAINTAIN STYLE: Ensure any new UI elements match the existing premium aesthetics (Tailwind, Gradients, etc.).
   - UI DESIGN INSPIRATION — MANDATORY: When creating or updating any UI, draw visual and UX inspiration from:
     * Framer & Webflow — fluid layouts, smooth motion, editorial whitespace
     * Tesla & Pitch — bold dark themes, cinematic hero sections, high contrast
     * Dropbox & Slack — clean hierarchy, friendly spacing, trustworthy color palettes
     * Typeform & Superhuman — focused single-purpose views, distraction-free UX, keyboard-first feel
     * Revolut & Shopify — sharp data presentation, premium card components, conversion-optimized layouts
     * Grammarly — subtle AI highlights, non-intrusive interactions, polished micro-animations
   - All UI updates must feel cohesive, premium, and production-ready — like a $10M-funded SaaS product.
6. MOBILE-FIRST — MANDATORY:
   - All UI changes MUST remain fully mobile-friendly. Never break mobile responsiveness.
   - Use responsive Tailwind classes (sm:, md:, lg:) on layout elements. No fixed widths.
   - Replicate the mobile UX quality of: Airbnb (fluid cards, thumb-friendly nav), Dropbox (clean stacked layouts, large tap targets), Apple (full-bleed heroes, elegant scroll), Figma (compact toolbars, adaptive panels), Stripe (crisp mobile docs, smooth accordions), Notion (collapsible blocks, floating action buttons), Spotify (tab-bar nav, horizontal scroll carousels), Instagram (edge-to-edge media, gesture-driven UI), Uber (bottom drawer pattern, one-thumb reachability), Linear (swipeable lists, minimal dashboards), Vercel (responsive cards, dark-mode-first), Medium (typography-focused, distraction-free reading).
   - Touch targets minimum 44×44px. Navigation must work on 375px screens.
   - If adding new sections or components, ensure they stack properly on mobile.
7. NO DIRECTORY NAVIGATION: Do not use 'cd' or absolute paths.
8. BRIEF SENTENCE BEFORE EACH FILE — MANDATORY: Write exactly 1 short sentence before every code block.
   - Example: "Updating the navbar to add your new menu item:"
   - NEVER place two code blocks back-to-back with no text between them.

Format code blocks as \`\`\`javascript:path/to/file.js\`\`\`. If a command is needed, use a separate bash block.

═══════════════════════════════════════════
🤖 REQUIRED AI AGENT INTEGRATION 🤖
═══════════════════════════════════════════

If the user asks to modify the AI features, YOU MUST USE THE FOLLOWING EXACT TEMPLATES as reference. DO NOT INSTALL OPENAI OR LANGCHAIN.

Template 1 (src/services/aiService.js):
${AiFeatureTemplates.AI_SERVICE_TEMPLATE}

Template 2 (src/components/AiChat.jsx):
${AiFeatureTemplates.AI_CHAT_COMPONENT_TEMPLATE}

Template 3 (src/components/AiDocSearch.jsx):
${AiFeatureTemplates.AI_DOC_SEARCH_TEMPLATE}

Template 4 (.env):
${AiFeatureTemplates.ENV_TEMPLATE}`;


const AIAssistant = forwardRef(({
  onClose,
  onUpgradeClick,
  workspaceFolder,
  currentUser,
  onOpenFolder,
  onFileCreated,
  onDevServerDetected,
  onUpdateTerminalStatus,
  onFileUpdate,
  onAddTask,
  onUpdateTask,
  explorerRefreshTrigger,
  onFirstResponse,
  visible,
  devServerUrl,
  onAIGenerationStart,
  onPlanGenerated
}, ref) => {
  // Load messages from localStorage if available, but reset if workspaceFolder changes
  const userName = currentUser?.displayName
    ? currentUser.displayName.split(' ')[0]
    : currentUser?.email
      ? currentUser.email.split('@')[0]
      : null;

  const defaultWelcome = {
    role: 'assistant',
    content: `Hey${userName ? ` ${userName}` : ''}! Tell me what you want to build and I'll handle everything — no coding knowledge needed.\n\nTry something like:\n- "I want a website where people can book appointments"\n- "Build me an online store that takes payments"\n- "Make a platform where users can sign up and post content"\n- "I need a dashboard to track my business metrics"\n\nJust describe your idea in plain English. I'll take care of the rest.`,
  };

  const [messages, setMessages] = useState(() => {
    // Try to load project-specific history
    if (workspaceFolder) {
      try {
        const projectKey = `ai-chat-${workspaceFolder}`;
        const saved = localStorage.getItem(projectKey);
        if (saved) return JSON.parse(saved);
      } catch { }
    }
    return []; // Start with empty state to show suggestions card
  });

  // Save and restore chat history per project when workspaceFolder changes
  useEffect(() => {
    if (!workspaceFolder) return;

    // Prevent saving while we're loading
    isLoadingHistory.current = true;
    currentWorkspaceRef.current = workspaceFolder;

    const projectKey = `ai-chat-${workspaceFolder}`;
    const stored = localStorage.getItem(projectKey);

    if (stored) {
      // Restore history for this project
      try {
        const savedMessages = JSON.parse(stored);
        setMessages(savedMessages);

        // Restore conversation history (only user/assistant messages for API)
        conversationHistory.current = savedMessages
          .filter(msg => msg.role === 'user' || msg.role === 'assistant')
          .map(msg => ({ role: msg.role, content: msg.content }));
      } catch (err) {
        console.error('Failed to restore chat history:', err);
        setMessages([]);
        conversationHistory.current = [];
      }
    } else {
      // New project - start fresh
      setMessages([]);
      conversationHistory.current = [];
    }

    // Allow saving after a short delay to ensure state has settled
    setTimeout(() => {
      isLoadingHistory.current = false;
    }, 100);
  }, [workspaceFolder]);

  // Persist messages to localStorage per project on every update
  useEffect(() => {
    // Don't save if no workspace, or if we're in the middle of loading history
    if (!workspaceFolder || isLoadingHistory.current) return;
    
    // Don't save if workspace changed (stale closure protection)
    if (workspaceFolder !== currentWorkspaceRef.current) return;

    // Don't save if it's just the default welcome (no user interaction yet)
    if (messages.length === 1 && messages[0].role === 'assistant') return;

    try {
      const projectKey = `ai-chat-${workspaceFolder}`;
      localStorage.setItem(projectKey, JSON.stringify(messages));
    } catch (err) {
      console.error('Failed to save chat history:', err);
    }
  }, [messages, workspaceFolder]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTerminalBusy, setIsTerminalBusy] = useState(false);
  const [error, setError] = useState(null);

  // Guard to prevent saving during load
  const isLoadingHistory = useRef(false);
  const currentWorkspaceRef = useRef(workspaceFolder);

  const [subscription, setSubscription] = useState(null); // Track user subscription
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const conversationHistory = useRef([]);
  const autoScrollEnabled = useRef(true);
  const [codeBlockStates, setCodeBlockStates] = useState({}); // Track code block creation status
  const [expandedBlocks, setExpandedBlocks] = useState({}); // Track which blocks are expanded
  const [attachedImages, setAttachedImages] = useState([]); // Track dropped images
  const [isDraggingOver, setIsDraggingOver] = useState(false); // Visual feedback for drag
  const [justDropped, setJustDropped] = useState(false); // Show success feedback after drop
  const abortControllerRef = useRef(null); // Track abort controller for cancelling requests
  const isSubmittingRef = useRef(false); // Guard against double submissions
  const userPromptCountRef = useRef(0); // Track total prompts for plan update schedule
  const powershellPolicyChecked = useRef(false); // Only check PS execution policy once per session
  const lastSubmittedMessageRef = useRef(null); // Track last submitted message to prevent StrictMode duplicates
  const [retryContext, setRetryContext] = useState(null); // Store context for retry functionality
  const lastUserMessageRef = useRef(null); // Store last user message for retry on interruption
  const workspaceFolderRef = useRef(workspaceFolder);
  const isAutoFixingRef = useRef(false); // Ref-based guard for auto-fix (avoids stale closure)
  const autoFixCooldownRef = useRef(0); // Timestamp of last auto-fix attempt
  const isAutoFixCommandRef = useRef(false); // Track if current commands were triggered by auto-fix
  const AUTO_FIX_COOLDOWN_MS = 10000; // 10 second cooldown between auto-fix attempts

  // Keep ref in sync with state
  useEffect(() => {
    workspaceFolderRef.current = workspaceFolder;
  }, [workspaceFolder]);

  // Application detected notification removed by user request

  // Layer 3: Conversation pruning state
  const conversationSummary = useRef(''); // Store summary of old messages
  const CONVERSATION_THRESHOLD = 30; // Start pruning after 30 messages
  const KEEP_RECENT_MESSAGES = 25; // Keep last 25 messages
  const KEEP_INITIAL_MESSAGES = 3; // Keep first 3 messages (project setup)

  // Retry function for failed auto-fix attempts
  // Plan generation listener
  useEffect(() => {
    const handleTriggerPlan = () => {
      // Use the last user message, or conversation summary to generate plan
      const promptToUse = input.trim() || "Analyze the current project state and recent discussions to generate an implementation plan.";
      
      ClaudeService.generatePlan(promptToUse)
        .then(planText => {
          if (onPlanGenerated) {
            onPlanGenerated(planText);
          }
        })
        .catch(err => console.error('Manual plan generation failed:', err));
    };

    window.addEventListener('trigger-plan-generation', handleTriggerPlan);
    return () => window.removeEventListener('trigger-plan-generation', handleTriggerPlan);
  }, [input, onPlanGenerated]);

  const handleRetryAutoFix = async (context) => {
    if (!context) return;

    // Use the same ref-based guard as handleAutoFix
    if (isAutoFixingRef.current) {
      console.log(' Retry blocked: already auto-fixing');
      return;
    }

    console.log(' Retrying auto-fix...');
    isAutoFixingRef.current = true;

    // Remove the error message
    setMessages(prev => prev.filter(msg => !msg.isRetryError));

    // Show retrying status
    const retryStatusId = `retry-${Date.now()}`;
    setMessages(prev => [
      ...prev,
      {
        id: retryStatusId,
        role: 'system',
        content: '**Retrying auto-fix...**\n\nChecking backend connection and attempting fix again...',
        isWorking: true
      }
    ]);

    try {
      // Check backend health first
      const isDev = import.meta.env.DEV;
      const backendUrl = import.meta.env.VITE_BACKEND_URL || (isDev ? 'http://localhost:5000' : 'https://externai-backend-production.azurewebsites.net');
      const healthCheck = await fetch(`${backendUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000)
      });

      if (!healthCheck.ok) {
        throw new Error('Backend server is not responding');
      }

      // Remove retry status
      setMessages(prev => prev.filter(msg => msg.id !== retryStatusId));

      // Retry the fix request with full token budget
      const fixResponse = await ClaudeService.getClaudeCompletion(
        context.conversation,
        context.maxTokens || 64000,
        context.timeout || 120000
      );

      if (fixResponse && fixResponse.success && fixResponse.message) {
        // Add the fix message
        const fixMessage = {
          id: Date.now() + Math.random(),
          role: 'assistant',
          content: fixResponse.message
        };

        setMessages(prev => [...prev, fixMessage]);
        conversationHistory.current.push(fixMessage);

        // Process the fix
        try {
          const fixCodeBlocks = extractCodeBlocks(fixResponse.message);
          const fixCommands = extractCommands(fixResponse.message);

          if (fixCodeBlocks.length > 0) {
            await handleCreateFilesAutomatically(fixResponse.message, fixMessage.id);
            await new Promise(resolve => setTimeout(resolve, 500));
          }

          if (fixCommands.length > 0) {
            // Mark as auto-fix commands to prevent re-triggering
            isAutoFixCommandRef.current = true;
            try {
              await executeCommandsAutomatically(fixResponse.message);
            } finally {
              isAutoFixCommandRef.current = false;
            }
          }
        } catch (err) {
          console.error('Error processing retry fix:', err);
        }

        // Clear retry context
        setRetryContext(null);
      } else {
        throw new Error(fixResponse?.error || 'Invalid response from AI');
      }
    } catch (error) {
      console.error(' Retry failed:', error);

      // Remove retry status
      setMessages(prev => prev.filter(msg => msg.id !== retryStatusId));

      // Show updated error
      setMessages(prev => [
        ...prev,
        {
          id: Date.now(),
          role: 'assistant',
          content: createRetryErrorMessage(error.message, context.command),
          isRetryError: true,
          retryContext: context
        }
      ]);
    } finally {
      isAutoFixingRef.current = false;
    }
  };

  // Continue handler for interrupted/truncated responses
  const handleRetryInterrupted = async () => {
    if (isLoading) return;

    // Find the interrupted message to get its partial content
    const interruptedMsg = messages.find(msg => msg.isInterrupted);
    if (!interruptedMsg) return;

    // Clear the interrupted flag on the existing message
    setMessages(prev => prev.map(msg =>
      msg.isInterrupted ? { ...msg, isInterrupted: false } : msg
    ));

    // Send a continuation prompt with the tail of the partial response as context
    const lastChunk = interruptedMsg.content.slice(-300);
    const continuePrompt = `Your previous response was cut off due to length limits. Continue EXACTLY from where you left off. Here is the end of your last response for reference:\n\n...${lastChunk}\n\nContinue from there. Do NOT repeat anything already said.`;

    await sendMessage(continuePrompt);
  };

  // Automatic Fix logic when a command fails
  const handleAutoFix = async (command, errorOutput) => {
    if (!workspaceFolderRef.current) {
      debug(' handleAutoFix blocked: no workspace folder');
      return;
    }

    // Ref-based guard: prevents re-entry regardless of stale closures
    if (isAutoFixingRef.current) {
      debug(' Already auto-fixing (ref guard), skipping nested fix');
      return;
    }

    // Cooldown: prevent rapid-fire auto-fix attempts from multiple failing commands
    const now = Date.now();
    if (now - autoFixCooldownRef.current < AUTO_FIX_COOLDOWN_MS) {
      debug(` Auto-fix on cooldown (${Math.ceil((AUTO_FIX_COOLDOWN_MS - (now - autoFixCooldownRef.current)) / 1000)}s remaining), skipping`);
      return;
    }

    debug(' Triggering handleAutoFix for command:', command);
    isAutoFixingRef.current = true;
    autoFixCooldownRef.current = now;

    const statusId = `autofix-${Date.now()}`;
    setMessages(prev => [
      ...prev,
      {
        id: statusId,
        role: 'system',
        content: `**Command failed - Automatically fixing...**\n\nI detected an error and I'm analyzing it now.`,
        isAutoFixing: true,
        isWorking: true
      }
    ]);

    try {
      const history = conversationHistory.current.slice(-5);
      // Truncate error output to avoid overwhelming the AI with noise
      const truncatedError = errorOutput.length > 3000
        ? errorOutput.slice(0, 1500) + '\n... (truncated) ...\n' + errorOutput.slice(-1500)
        : errorOutput;

      const prompt = `The following command failed:\n\`\`\`bash\n${command}\n\`\`\`\n\nError output:\n\`\`\`\n${truncatedError}\n\`\`\`\n\nAnalyze this error and provide a fix. If files need changing, provide FULL file content with the filename= format. If missing dependencies, provide the installation command. Use the standard code block format. Do NOT repeat the same failing command without fixing the root cause first.`;

      const response = await ClaudeService.getClaudeCompletion(
        [...history, { role: 'user', content: prompt }],
        64000,
        120000
      );

      // Remove status message
      setMessages(prev => prev.filter(m => m.id !== statusId));

      if (response && response.success && response.message) {
        const fixMessage = {
          id: Date.now() + Math.random(),
          role: 'assistant',
          content: `### Auto-Fix Applied\n\nAnalyzed the error and generated a fix:\n\n${response.message}`
        };

        setMessages(prev => [...prev, fixMessage]);
        conversationHistory.current.push({ role: 'assistant', content: response.message });

        // Process the fix - mark commands as auto-fix-triggered to prevent re-triggering
        try {
          const fixCodeBlocks = extractCodeBlocks(response.message);
          const fixCommands = extractCommands(response.message);

          if (fixCodeBlocks.length > 0) {
            await handleCreateFilesAutomatically(response.message, fixMessage.id);
            // Wait for filesystem to sync
            await new Promise(resolve => setTimeout(resolve, 500));
          }

          if (fixCommands.length > 0) {
            // Flag that these commands are from auto-fix so failures don't re-trigger
            isAutoFixCommandRef.current = true;
            try {
              await executeCommandsAutomatically(response.message);
            } finally {
              isAutoFixCommandRef.current = false;
            }
          }
        } catch (err) {
          console.error('Error applying auto-fix:', err);
        }
      } else {
        throw new Error(response?.error || 'Empty response from AI');
      }
    } catch (err) {
      console.error('Auto-fix failed:', err);
      // Replace status with error message 
      setMessages(prev => {
        const hasStatus = prev.some(m => m.id === statusId);
        if (hasStatus) {
          return prev.map(m =>
            m.id === statusId
              ? {
                ...m,
                isWorking: false,
                isAutoFixing: false,
                content: `**Auto-fix analysis failed.**\n\nError: ${err.message}`,
                isError: true,
                isRetryError: true,
                retryContext: {
                  command,
                  conversation: [...conversationHistory.current.slice(-5)],
                  maxTokens: 64000,
                  timeout: 120000
                }
              }
              : m
          );
        }
        return [...prev, {
          id: Date.now(),
          role: 'assistant',
          content: createRetryErrorMessage(err.message, command),
          isRetryError: true,
          retryContext: {
            command,
            conversation: [...conversationHistory.current.slice(-5)],
            maxTokens: 64000,
            timeout: 120000
          }
        }];
      });
    } finally {
      isAutoFixingRef.current = false;
    }
  };

  // SupervisorAI placeholder to prevent reference errors during command execution
  const SupervisorAI = {
    monitorCommandExecution: async (command, success, output, error) => {
      debug(' SupervisorAI monitoring:', command);
      return {
        analysis: {
          success: success,
          message: success ? `Command executed: ${command}` : `Command failed: ${command}`,
          shouldPauseChatAI: !success,
          errorDetails: success ? null : {
            context: output || error || 'Unknown terminal error',
            suggestedFix: 'Try running npm install or check your code syntax.'
          }
        }
      };
    }
  };

  // Create enhanced error message
  const createRetryErrorMessage = (errorMsg, command) => {
    const isConnectionError = errorMsg.includes('connect') || errorMsg.includes('fetch') || errorMsg.includes('ECONNREFUSED');
    const isTimeout = errorMsg.includes('timeout') || errorMsg.includes('timed out');
    const isRateLimit = errorMsg.includes('rate limit') || errorMsg.includes('429');

    let specificGuidance = '';

    if (isConnectionError) {
      specificGuidance = `### Backend Connection Issue

The backend server is not reachable. To enable auto-fix:

\`\`\`bash
cd backend
npm install  # If first time
npm run dev  # To run locally
\`\`\`

Wait for "Server running on port 5000" message, then click **Retry** below.`;
    } else if (isTimeout) {
      specificGuidance = `###  Request Timeout

The AI service took too long to respond. This can happen with complex fixes.

**Try:**
1. Click **Retry** button below
2. Or simplify your question/command
3. Or fix the error manually`;
    } else if (isRateLimit) {
      specificGuidance = `### Rate Limit Exceeded

Too many requests to the AI service. Wait 1-2 minutes and try again.

**Options:**
1. Wait and click **Retry** button
2. Fix the error manually
3. Continue with your project and auto-fix will work after cooldown`;
    } else {
      specificGuidance = `### Suggestions

**Manual Fix Options:**
1. Read the error message above carefully
2. Fix the issue in your code directly
3. Or ask me: "How do I fix: ${command?.substring(0, 40) || 'this error'}?"

**Backend Issues:**
- Ensure backend is running: \`cd backend && npm start\`
- Check for firewall blocking port 5000
- Verify ANTHROPIC_API_KEY in backend/.env`;
    }

    return `## Auto-Fix Failed

**Error:** ${errorMsg}

${specificGuidance}

---

### What Is Auto-Fix?

When a command fails, auto-fix automatically:
1. Analyzes the error output
2. Reads relevant project files  
3. Generates and applies a complete fix

It requires the backend server to communicate with Claude AI.`;
  };



  // Fetch subscription status on mount
  useEffect(() => {
    const fetchSubscription = async () => {
      try {
        const response = await ClaudeService.getUsage();
        if (response.subscription) {
          setSubscription(response.subscription);
        }
      } catch (err) {
        console.error('Failed to fetch subscription:', err);
      }
    };

    fetchSubscription();
  }, []);

  const scrollToBottom = (behavior = 'smooth') => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  // Smooth auto-scroll during streaming - optimized version
  const smoothScrollToBottom = () => {
    if (messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      const scrollDiff = container.scrollHeight - container.scrollTop - container.clientHeight;

      // Always scroll during streaming, but smoothly
      if (scrollDiff > 0) {
        container.scrollTop = container.scrollHeight;
      }
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Core send message logic (can be called internally or externally)
  const sendMessage = async (messageText, attachedImgs = []) => {
    if (!messageText || messageText.replace(/\s/g, '') === '') {
      console.log(' sendMessage blocked: messageText is empty or whitespace only');
      return;
    }
    if (isLoading) {
      console.log(' sendMessage blocked: isLoading is true');
      return;
    }

    // Check if workspace is open before processing - use ref for most current value
    if (!workspaceFolderRef.current) {
      setMessages(prev => [...prev, {
        role: 'system',
        content: 'No workspace folder is open. Opening folder picker...'
      }]);

      try {
        // Use dialog.openFolder (not fs.openFolder) - returns { canceled, filePaths }
        const result = await window.electronAPI.dialog.openFolder();
        if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
          setMessages(prev => [...prev, {
            role: 'system',
            content: ' You must open a workspace folder to continue. Please click **File > Open Folder** from the menu.'
          }]);
          return;
        }
        // Update the workspace folder in parent component
        if (onOpenFolder) {
          await onOpenFolder(result.filePaths[0]);
        }
        // Wait a moment for the workspace to be fully initialized
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (err) {
        console.error('Failed to open folder:', err);
        setMessages(prev => [...prev, {
          role: 'system',
          content: ' Failed to open folder. Please click **File > Open Folder** from the menu to select a workspace.'
        }]);
        return;
      }
    }

    const userMessage = messageText.trim();

    // Append image URLs to the message if any images are attached
    let messageContent = userMessage;
    if (attachedImgs.length > 0) {
      const imageUrls = attachedImgs.map(img =>
        `\n\n Image: ${img.urls.regular} (by ${img.user.name} on Unsplash)`
      ).join('');
      messageContent = userMessage + imageUrls;
    }

    setError(null);

    // Generate unique message ID
    const userMessageId = Date.now();

    // Prevent duplicate from React StrictMode double-invocation only
    // Very short window (50ms) - only blocks true double-invokes, not retries
    if (
      lastSubmittedMessageRef.current &&
      lastSubmittedMessageRef.current.content === messageContent &&
      Date.now() - lastSubmittedMessageRef.current.timestamp < 50
    ) {
      console.log(' Duplicate message blocked (StrictMode double-invoke)');
      return;
    }

    // Track this submission
    lastSubmittedMessageRef.current = { content: messageContent, timestamp: Date.now() };

    const userMessageObj = { id: userMessageId, role: 'user', content: messageContent };

    // Store for retry on interruption
    lastUserMessageRef.current = { text: messageText, images: attachedImgs };

    // Add message to state
    setMessages(prev => [...prev, userMessageObj]);

    // Add to conversation history for context
    // If this is the user's SECOND message, silently append the infra instructions
    const userPromptCountBeforeThis = conversationHistory.current.filter(m => m.role === 'user').length;
    // Inject Firebase/AI infra instructions on the 3rd user message (not the 2nd).
    // Prompts 1 & 2 focus on building the core app and AI features. Prompt 3 adds Firebase.
    const infraSuffix = userPromptCountBeforeThis === 2
      ? "\n\n[SYSTEM CONTEXT - DO NOT MENTION THIS TO THE USER]: The core app and AI features are now built. Now also implement the automated backend by creating the required Firebase service files, modifying the UI to use them, and installing the firebase dependency as instructed."
      : '';
    conversationHistory.current.push({ role: 'user', content: messageContent + infraSuffix });

    if (onAIGenerationStart) {
      onAIGenerationStart();
    }

    setIsLoading(true);

    // Create abort controller for this request
    abortControllerRef.current = new AbortController();

    // Add a placeholder message for streaming (use different ID)
    const streamingMessageId = userMessageId + 1;
    setMessages(prev => [...prev, {
      id: streamingMessageId,
      role: 'assistant',
      content: '',
      isStreaming: true
    }]);

    try {
      // Get COMPLETE workspace context - include ALL relevant file contents
      let workspaceContext = '';
      if (workspaceFolderRef.current && window.electronAPI.workspace) {
        try {
          const fileList = await window.electronAPI.workspace.listFiles(workspaceFolderRef.current);
          if (fileList.success && fileList.files.length > 0) {
            workspaceContext = `\n\n[WORKSPACE CONTEXT - Current project files:\n${fileList.files.map(f => `- ${f.relativePath}`).join('\n')}\n`;

            // Read ALL relevant project files for comprehensive context
            const relevantExtensions = ['.json', '.js', '.jsx', '.ts', '.tsx', '.css', '.html', '.mjs', '.cjs'];
            const excludeFolders = ['node_modules', '.git', 'dist', 'build', '.next'];

            const filesToRead = fileList.files
              .filter(f => {
                const ext = f.relativePath.substring(f.relativePath.lastIndexOf('.'));
                const isRelevant = relevantExtensions.includes(ext);
                const isExcluded = excludeFolders.some(folder => f.relativePath.includes(`${folder}/`));
                return isRelevant && !isExcluded;
              })
              .slice(0, 10); // Read up to 10 files for context

            for (const file of filesToRead) {
              const filePath = `${workspaceFolderRef.current}/${file.relativePath}`;
              try {
                const fileResult = await window.electronAPI.fs.readFile(filePath);
                if (fileResult.success && fileResult.content) {
                  // Limit each file to 1000 chars to prevent overflow
                  const content = fileResult.content.length > 1000
                    ? fileResult.content.substring(0, 1000) + '\n... (truncated)'
                    : fileResult.content;
                  workspaceContext += `\n\n--- ${file.relativePath} ---\n${content}\n`;
                }
              } catch (err) {
                // File doesn't exist or can't be read, skip it
              }
            }

            workspaceContext += `\n\nUse this COMPLETE context to understand the project structure, dependencies, and existing code.]\n`;
          }
        } catch (err) {
          debug('Workspace context unavailable:', err);
        }
      }

      // Get terminal output context if available - last 6 commands
      let terminalContext = '';
      try {
        // Find the active terminal ID from the DOM
        const terminalElements = document.querySelectorAll('[data-terminal-id]');
        if (terminalElements.length > 0) {
          const terminalId = terminalElements[0].getAttribute('data-terminal-id');
          if (terminalId) {
            const outputResult = await window.electronAPI.terminal.getOutput(terminalId);
            if (outputResult.success && outputResult.output) {
              // Clean ANSI codes for cleaner context
              const cleanOutput = outputResult.output.replace(/\x1b\[[0-9;]*m/g, '');

              // Extract the last 6 command blocks (commands typically start with $ or > or after a newline with a path)
              const lines = cleanOutput.split('\n');
              const commandPattern = /^[\$\>]|.*[\$\>]\s*\w|^\s*\w+@|.*%\s*\w/;
              let commandBlocks = [];
              let currentBlock = [];

              for (const line of lines) {
                if (commandPattern.test(line) && currentBlock.length > 0) {
                  commandBlocks.push(currentBlock.join('\n'));
                  currentBlock = [line];
                } else {
                  currentBlock.push(line);
                }
              }
              if (currentBlock.length > 0) {
                commandBlocks.push(currentBlock.join('\n'));
              }

              // Get the last 6 command blocks
              const last6Commands = commandBlocks.slice(-6).join('\n\n---\n\n');

              terminalContext = `\n\n[TERMINAL OUTPUT - Last 6 commands and their results:\n${last6Commands || cleanOutput.slice(-3000)}\n\nUse this to understand what commands have been run and their results.]\n`;
            }
          }
        }
      } catch (err) {
        debug('Terminal context unavailable:', err);
        // Continue without terminal context
      }

      // Enhance user message with workspace and terminal context
      const enhancedPrompt = conversationHistory.current.map(msg => ({
        role: msg.role,
        content: msg.role === 'user' && msg === conversationHistory.current[conversationHistory.current.length - 1]
          ? `${msg.content}${workspaceContext}${terminalContext}`
          : msg.content
      }));

      // ============================================================
      // LAYER 2: Extract and update project state (first 3 messages)
      // ============================================================
      if (conversationHistory.current.length <= KEEP_INITIAL_MESSAGES &&
        !ProjectStateService.isInitialized()) {
        console.log(' [Layer 2] Extracting project state from initial messages...');
        ProjectStateService.extractFromMessages(conversationHistory.current);
      }

      // ============================================================
      // LAYER 3: Conversation pruning with summarization
      // ============================================================
      let prunedMessages = enhancedPrompt;

      if (conversationHistory.current.length > CONVERSATION_THRESHOLD) {
        console.log(` [Layer 3] Conversation has ${conversationHistory.current.length} messages, pruning...`);

        // Check if we need to generate a new summary
        const messagesToSummarize = conversationHistory.current.slice(
          KEEP_INITIAL_MESSAGES,
          -(KEEP_RECENT_MESSAGES)
        );

        if (messagesToSummarize.length > 0 && !conversationSummary.current) {
          try {
            console.log(` [Layer 3] Summarizing ${messagesToSummarize.length} old messages...`);
            const summary = await ClaudeService.summarizeConversation(messagesToSummarize);
            conversationSummary.current = summary;
            console.log(' [Layer 3] Summary generated:', summary.substring(0, 100) + '...');
          } catch (err) {
            console.warn(' [Layer 3] Summarization failed, continuing without summary:', err);
          }
        }

        // Build pruned message array: [initial messages] + [recent messages]
        const initialMessages = enhancedPrompt.slice(0, KEEP_INITIAL_MESSAGES);
        const recentMessages = enhancedPrompt.slice(-KEEP_RECENT_MESSAGES);
        prunedMessages = [...initialMessages, ...recentMessages];

        console.log(` [Layer 3] Pruned from ${enhancedPrompt.length} to ${prunedMessages.length} messages`);
      }

      console.log(' Starting Claude stream...');

      // Track AI request start
      const requestStartTime = Date.now();
      AnalyticsService.trackAIRequest('message_sent', {
        message_length: prunedMessages[prunedMessages.length - 1].content.length
      });

      // Get project state to inject (Layer 2)
      const projectStatePrompt = ProjectStateService.toSystemPrompt();

      // Select prompt based on conversation length
      const isFirstMessage = conversationHistory.current.filter(m => m.role === 'user').length <= 1;
      const activeSystemPrompt = isFirstMessage ? ONE_SHOT_SYSTEM_PROMPT : FOLLOW_UP_SYSTEM_PROMPT;

      console.log(` [Prompt Selection] Using ${isFirstMessage ? 'ONE-SHOT' : 'FOLLOW-UP'} mode`);

      // Call Claude API with streaming (with all 3 layers)
      const response = await ClaudeService.getClaudeStream(
        prunedMessages, // Layer 3: Pruned messages
        (chunk, fullText) => {
          // Update the streaming message with new content
          setMessages(prev => prev.map(msg =>
            msg.id === streamingMessageId
              ? { ...msg, content: fullText, isStreaming: true }
              : msg
          ));
        },
        60000,
        abortControllerRef.current.signal,
        activeSystemPrompt, // Use selected prompt
        projectStatePrompt, // Layer 2: Project state
        conversationSummary.current // Layer 3: Conversation summary
      );

      console.log(' Claude stream completed:', response);

      if (response && response.success) {
        console.log(' Stream successful, finalizing message...');
        console.log(' Response content length:', response.message?.length);

        // Finalize the streaming message - check if truncated
        const wasTruncated = response.stopReason === 'max_tokens';
        setMessages(prev => prev.map(msg =>
          msg.id === streamingMessageId
            ? { ...msg, content: response.message, isStreaming: false, isInterrupted: wasTruncated }
            : msg
        ));

        const assistantMessage = {
          id: streamingMessageId,
          role: 'assistant',
          content: response.message
        };

        conversationHistory.current.push(assistantMessage);

        if (workspaceFolderRef.current) {
          setTimeout(async () => {
            try {
              console.log('[AI Response Processing] Starting automatic file & command processing...');
              const codeBlocks = extractCodeBlocks(response.message);
              const commands = extractCommands(response.message);

              console.log(`[AI Response Processing] Found ${codeBlocks.length} code blocks to create`);
              console.log(`[AI Response Processing] Found ${commands.length} commands to execute`);

              // STEP 1: Create files FIRST (so commands can use them)
              if (codeBlocks.length > 0) {
                console.log(' Creating files first...');
                await handleCreateFilesAutomatically(response.message, assistantMessage.id);
                console.log(' Files created successfully');

                // Wait a bit for filesystem to sync
                await new Promise(resolve => setTimeout(resolve, 500));
              }

              // STEP 2: Execute commands AFTER files are created
              if (commands.length > 0) {
                console.log(' Executing commands now...');
                await executeCommandsAutomatically(response.message);
                console.log(' Commands executed successfully');
              }

              if (codeBlocks.length === 0 && commands.length === 0) {
                console.log(' No files or commands to process - AI provided explanation only');
              }
            } catch (error) {
              console.error(' Error processing response:', error);
              console.error(' Error stack:', error.stack);
            }
          }, WORKSPACE_SCAN_DELAY);
        }

        // No auto second prompt — infra instructions are injected into the user's own second message



        // Update subscription status after successful message
        try {
          const usage = await ClaudeService.getUsage();
          if (usage.subscription) {
            setSubscription(usage.subscription);

            // Track prompt usage in analytics
            AnalyticsService.trackSubscription(
              'prompt_used',
              usage.subscription.tier,
              usage.subscription.freePromptsRemaining
            );

            // Warn when approaching limit (5 prompts left)
            if (usage.subscription.tier === 'free' && usage.subscription.freePromptsRemaining <= 5) {
              AnalyticsService.trackSubscription(
                'approaching_limit',
                usage.subscription.tier,
                usage.subscription.freePromptsRemaining
              );
            }
          }
        } catch (err) {
          console.error('Failed to update subscription:', err);
        }
      } else {
        throw new Error(response && response.error ? response.error : 'ClaudeService failed');
      }
    } catch (error) {
      console.error('AI Error:', error);

      // Check if it's a daily limit / subscription error
      const isDailyLimit = error.isDailyLimit ||
        error.message.toLowerCase().includes('exhausted') ||
        error.message.includes('402') ||
        error.message.includes('429');

      if (isDailyLimit) {
        setError('subscription_required');
        
        // Combine filter and add in single setState call to avoid race conditions
        setMessages(prev => [
          ...prev.filter(msg => msg.id !== streamingMessageId),
          {
            id: Date.now(),
            role: 'system',
            isDailyLimitError: true,
            limitMessage: 'your daily free credits are finished, your credits will refill the next day.'
          }
        ]);

        // Track limit reached
        AnalyticsService.trackSubscription('limit_reached', 'free', 0);
      } else {
        // Check if response was interrupted (has partial content)
        const isInterrupted = error.message.includes('Stream') || 
                              error.message.includes('network') || 
                              error.message.includes('timeout') ||
                              error.message.includes('aborted') ||
                              error.name === 'AbortError';

        setError(error.message);
        
        // Mark the streaming message as interrupted instead of replacing it
        setMessages(prev => {
          const streamingMsg = prev.find(msg => msg.id === streamingMessageId);
          const hasPartialContent = streamingMsg && streamingMsg.content && streamingMsg.content.length > 0;
          
          if (hasPartialContent || isInterrupted) {
            // Keep partial content and mark as interrupted
            return prev.map(msg =>
              msg.id === streamingMessageId
                ? { ...msg, isStreaming: false, isInterrupted: true }
                : msg
            );
          } else {
            // No content, show error message
            const isConnectionErr = error.message.includes('Cannot connect') || error.message.includes('Failed to fetch');
            const errContent = isConnectionErr
              ? ` **Connection Error:** Cannot reach the backend server.\n\nMake sure the backend is running:\n\`\`\`bash\ncd backend && node server.js\n\`\`\`\nThen try again.`
              : ` **Error:** ${error.message}\n\nTry asking your question again!`;
            return [
              ...prev.filter(msg => msg.id !== streamingMessageId),
              {
                role: 'assistant',
                isError: true,
                content: errContent
              }
            ];
          }
        });
      }

      // Track error in analytics
      AnalyticsService.trackError('AI', error.message, 'sendMessage');
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  // Expose sendMessage method to parent via ref
  useImperativeHandle(ref, () => ({
    sendMessage: (messageText) => {
      sendMessage(messageText, []);
    },
    addSystemMessage: (messageText) => {
      const systemMessage = {
        role: 'system',
        content: messageText,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, systemMessage]);
    },
    focusInput: () => {
      const textarea = document.querySelector('.ai-input');
      if (textarea) {
        textarea.focus();
        textarea.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    },
    setInputAndFocus: (text) => {
      setInput(text);
      setTimeout(() => {
        const textarea = document.querySelector('.ai-input');
        if (textarea) {
          textarea.focus();
          textarea.setSelectionRange(text.length, text.length);
          textarea.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
      }, 50);
    }
  }));

  // Handle stopping AI generation and command execution
  const handleStopGeneration = () => {
    console.log(' Stopping AI generation and commands...');

    // Stop AI streaming
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);

      // Mark the streaming message as stopped
      setMessages(prev => prev.map(msg =>
        msg.isStreaming
          ? { ...msg, content: msg.content + '\n\n_[Generation stopped by user]_', isStreaming: false }
          : msg
      ));
    }

    // Stop executing commands
    setMessages(prev => prev.map(msg =>
      msg.isExecuting
        ? { ...msg, content: msg.content + '\n\n_[Command execution stopped by user]_', isExecuting: false }
        : msg
    ));

    // Stop working status (file creation)
    setMessages(prev => prev.map(msg =>
      msg.isWorking
        ? { ...msg, content: msg.content + '\n\n_[Operation stopped by user]_', isWorking: false }
        : msg
    ));

    // Reset terminal busy state
    setIsTerminalBusy(false);
    setIsLoading(false);
  };



  // Handle form submission

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    e.stopPropagation();

    if ((!input.trim() && attachedImages.length === 0) || isLoading || isTerminalBusy) return;

    const messageText = input.trim();
    const imgs = [...attachedImages];
    
    // Clear input and images immediately
    setInput('');
    setAttachedImages([]);
    
    try {
      // Send the standard chat message
      await sendMessage(messageText, imgs);
    } finally {
      isSubmittingRef.current = false;
    }
  };

  // Handle drag and drop for images
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set to false if leaving the form container itself
    const className = e.target.className || '';
    if (className.includes('ai-input-container') || className.includes('ai-input-form') || className.includes('ai-assistant')) {
      setIsDraggingOver(false);
    }
  };

  const cancelDrag = () => {
    setIsDraggingOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    try {
      // Get the image data from drag event
      const imageData = e.dataTransfer.getData('application/json');
      if (imageData) {
        const image = JSON.parse(imageData);
        // Add to attached images (prevent duplicates)
        setAttachedImages(prev => {
          const exists = prev.some(img => img.urls.regular === image.urls.regular);
          if (exists) return prev;

          // Show success feedback
          setJustDropped(true);
          setTimeout(() => setJustDropped(false), 1000);

          return [...prev, image];
        });
      }
    } catch (err) {
      console.error('Error handling dropped image:', err);
    }
  };

  const removeAttachedImage = (imageUrl) => {
    setAttachedImages(prev => prev.filter(img => img.urls.regular !== imageUrl));
  };

  const generateMockResponse = (query) => {
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('website') || lowerQuery.includes('web')) {
      return `I can help you create a website! Here's a basic HTML structure to get started:

\`\`\`html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My Website</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
        }
    </style>
</head>
<body>
    <h1>Welcome to My Website</h1>
    <p>This is a simple website template.</p>
</body>
</html>
\`\`\`

Would you like me to add more features like navigation, forms, or styling?`;
    }

    if (lowerQuery.includes('mobile') || lowerQuery.includes('app')) {
      return `For mobile app development, I recommend using React Native. Here's a basic setup:

\`\`\`javascript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Mobile App</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
});
\`\`\`

Would you like help setting up the development environment?`;
    }

    if (lowerQuery.includes('game')) {
      return `Let's create a simple game! Here's a basic HTML5 Canvas game template:

\`\`\`javascript
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

class Game {
  constructor() {
    this.player = { x: 50, y: 50, width: 30, height: 30 };
    this.update();
  }
  
  update() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'blue';
    ctx.fillRect(this.player.x, this.player.y, 
                 this.player.width, this.player.height);
    requestAnimationFrame(() => this.update());
  }
}

new Game();
\`\`\`

What type of game would you like to build?`;
    }

    return `I understand you're asking about "${query}". I'm here to help with:

 Web development (HTML, CSS, JavaScript, React)
 Mobile development (React Native)
 Game development (HTML5 Canvas, Phaser)
 Code explanations and debugging
 Project scaffolding

Could you provide more details about what you'd like to build?`;
  };

  const extractCodeBlocks = (content) => {
    const blocks = [];

    // Use a more reliable approach: split by ``` markers
    const parts = content.split('```');

    console.log(' Extracting code blocks, found', Math.floor(parts.length / 2), 'potential blocks');

    // Parts at odd indices (1, 3, 5...) are inside code blocks
    for (let i = 1; i < parts.length; i += 2) {
      const codeBlockContent = parts[i];
      if (!codeBlockContent) continue;

      // First line contains language and optional filename
      const firstNewline = codeBlockContent.indexOf('\n');
      if (firstNewline === -1) continue; // No newline = invalid block

      const firstLine = codeBlockContent.substring(0, firstNewline).trim();
      const code = codeBlockContent.substring(firstNewline + 1);

      // Parse first line: "language:path/to/file" or "language filename=path/to/file" or "language"
      let language = 'text';
      let filename = null;

      // 1. Check for language:path/to/file (Modern standard)
      const colonMatch = firstLine.match(/^([a-zA-Z0-9+_#-]+):([^\s\n]+)$/);
      // 2. Check for filename= in first line
      const filenameMatch = firstLine.match(/filename=([^\s]+)/);
      // 3. Check for language path/to/file (Space separated)
      const spaceMatch = firstLine.match(/^([a-zA-Z0-9+_#-]+)\s+([^\s\n/]+(?:\/[^\s\n/]+)*)$/);

      if (colonMatch) {
        language = colonMatch[1];
        filename = colonMatch[2];
      } else if (filenameMatch) {
        filename = filenameMatch[1];
        const langPart = firstLine.substring(0, firstLine.indexOf('filename=')).trim();
        language = langPart || 'text';
      } else if (spaceMatch) {
        language = spaceMatch[1];
        filename = spaceMatch[2];
      } else {
        // No filename detected in header, first word is language
        language = firstLine.split(/\s+/)[0] || 'text';
      }

      // Also try to extract filename from first line of code if not in header
      if (!filename && code) {
        const codeLines = code.split('\n');
        const codeFirstLine = codeLines[0].trim();

        const commentFilename = codeFirstLine.match(/^(?:\/\/|#|<!--)\s*(?:filename|path)[=:]\s*([^\s<>|:"*?]+)\s*(?:-->)?/i);
        if (commentFilename) {
          filename = commentFilename[1];
        }
      }

      // Clean up the code - remove only leading/trailing empty lines, preserve internal structure
      const cleanCode = code.replace(/^\n+/, '').replace(/\n+$/, '');

      console.log('[File Extraction] Found code block:', language, 'filename:', filename, 'code length:', cleanCode.length);

      blocks.push({
        language: language,
        filename: filename,
        code: cleanCode
      });
    }

    console.log('[File Extraction] Total blocks found:', blocks.length);
    return blocks;
  };

  // Extract terminal commands from AI response
  const extractCommands = (content) => {
    const commands = [];

    // Match various command patterns
    const patterns = [
      // Commands in bash/sh/terminal code blocks — primary source, highest priority
      /```(?:bash|sh|shell|terminal|zsh)\n([\s\S]*?)```/gi,
      // Commands with $ prefix in plain text
      /\$\s+(npm|yarn|node|python|pip|git|cd|mkdir|touch|rm|mv|cp)\s+[^\n]+/gi,
      // npm install / yarn install in plain text only
      /(?:^|\n)(npm (?:install|i\b|run dev|start|build|test)|yarn (?:install|add|start|build|dev)|git (?:clone|init|add|commit|push|pull))[^\n]*/gi
    ];

    patterns.forEach(pattern => {
      let match;
      const regex = new RegExp(pattern.source, pattern.flags);
      while ((match = regex.exec(content)) !== null) {
        let cmd = match[1] || match[0];
        cmd = cmd.trim().replace(/^\$\s*/, ''); // Remove $ prefix

        // Split multiline bash blocks into individual commands
        if (cmd.includes('\n')) {
          const lines = cmd.split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#')); // Remove comments
          commands.push(...lines);
        } else {
          if (!cmd.startsWith('#')) commands.push(cmd); // Skip comment lines
        }
      }
    });

    // Deduplicate and filter
    const seen = new Set();
    const filtered = commands.filter(cmd => {
      if (!cmd || cmd.length < 3 || seen.has(cmd)) return false;
      if (cmd.startsWith('#')) return false; // Skip shell comments
      seen.add(cmd);
      return true;
    });

    console.log('[Command Extraction] Found', filtered.length, 'commands:', filtered);
    return filtered;
  };

  // Execute terminal commands automatically with loading UI
  const executeCommandsAutomatically = async (messageContent) => {
    const commands = extractCommands(messageContent);
    console.log('[Command Auto-Execute] Commands to execute:', commands);
    if (commands.length === 0) {
      console.log('[Command Auto-Execute] No commands found in message');
      return;
    }

    // On Windows, check PowerShell execution policy once per session before running any commands
    const isWindows = navigator.platform.toLowerCase().includes('win') || navigator.userAgent.toLowerCase().includes('windows');
    if (isWindows && !powershellPolicyChecked.current) {
      powershellPolicyChecked.current = true;
      try {
        const policyResult = await window.electronAPI.terminalExecute('powershell -Command "Get-ExecutionPolicy"', workspaceFolderRef.current);
        const policyOutput = (policyResult.stdout || '').trim();
        if (policyOutput.toLowerCase().includes('restricted')) {
          setMessages(prev => [...prev, {
            role: 'system',
            content: '**Fixing PowerShell execution policy...** (Required to run npm commands on Windows)',
            isWorking: true,
            id: 'ps-policy-fix'
          }]);
          await window.electronAPI.terminalExecute(
            'powershell -Command "Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force"',
            workspaceFolderRef.current
          );
          setMessages(prev => prev.map(msg =>
            msg.id === 'ps-policy-fix'
              ? { ...msg, isWorking: false, content: '**PowerShell execution policy updated.** You can now run npm commands.' }
              : msg
          ));
        }
      } catch (err) {
        console.warn('PowerShell policy check failed:', err);
      }
    }

    setIsTerminalBusy(true);
    try {
      // Get the first available terminal ID from the app
      const terminalElements = document.querySelectorAll('.terminal-instance.active');
      const terminalId = terminalElements.length > 0 ? terminalElements[0].getAttribute('data-id') : 'initial-terminal';
      const backendId = terminalElements.length > 0 ? terminalElements[0].getAttribute('data-terminal-id') : null;

      if (!backendId && !terminalId) {
        console.warn('No terminal available to execute commands');
        setMessages(prev => [
          ...prev,
          {
            role: 'system',
            content: 'No terminal available. Please open a terminal to execute commands.',
            isError: true
          }
        ]);
        return;
      }

      // Use backendId for writing to physical terminal, terminalId for UI status
      const targetTerminalBackendId = backendId || terminalId;

      // Always ensure the terminal is in the correct working directory
      if (workspaceFolderRef.current) {
        await window.electronAPI.terminalWrite(targetTerminalBackendId, `cd "${workspaceFolderRef.current.replace(/"/g, '\\"')}"\r`);
      }

      for (let i = 0; i < commands.length; i++) {
        const command = commands[i];
        const commandId = Date.now() + Math.random();
        const statusMessageId = `status-${commandId}`;
        const isInstallCommand = command.includes('npm install') || command.includes('npm i ') ||
          command.includes('yarn install') || command.includes('pnpm install') || command.includes('pnpm i ');
        const isRunCommand =
          command.includes('npm run') || command.includes('npm start') ||
          command.includes('yarn dev') || command.includes('pnpm dev') || command.includes('pnpm run') ||
          command.includes('vite') || command.includes('next dev') ||
          command.includes('nodemon') || command.includes('serve') ||
          command.includes('watch') || (command.includes('.py') && command.includes('run'));

        let statusMessage = 'Running command...';
        if (isInstallCommand) {
          statusMessage = 'Installing dependencies... This may take a moment.';
        } else if (isRunCommand) {
          statusMessage = 'Starting application...';
        }

        // status message UI addition removed

        try {
          let result = { success: true, stdout: '', stderr: '' };

          // Background execution for commands that return (not servers)
          // This allows us to WAIT for them and know if they failed
          if (!isRunCommand) {
            console.log(' Executing sequential command:', command);
            result = await window.electronAPI.terminalExecute(command, workspaceFolderRef.current);
          } else {
            console.log(' Running persistent command (server):', command);
            // Servers MUST be run in the interactive terminal to stay alive and show output
            await window.electronAPI.terminalWrite(targetTerminalBackendId, command + '\r');
            // Give it some time to start before moving to next (though usually it's the last command)
            await new Promise(resolve => setTimeout(resolve, 3000));
          }

          // Update status to completed
          setMessages(prev => prev.map(msg =>
            msg.id === statusMessageId
              ? { ...msg, isWorking: false, isExecuting: false }
              : msg
          ));

          const executionTime = Date.now() - commandId;
          // Only trigger auto-fix if the command actually failed (non-zero exit code).
          // Checking stderr for "error" is too aggressive and catches warnings.
          const hasError = !result.success;

          AnalyticsService.trackCommand(command, !hasError, executionTime);

          // Update terminal status dot
          if (onUpdateTerminalStatus) {
            onUpdateTerminalStatus(terminalId, hasError ? 'error' : 'success');
          }

          // Auto-detection of dev server URL
          if (!hasError && (isRunCommand || result.stdout)) {
            const urlPatterns = [
              /(?:Local|\s+Local|Network|\s+Network):\s+(https?:\/\/[^\s]+)/i,
              /(?:running on|listening on|server running at|Application started at):\s+(https?:\/\/[^\s]+)/i,
              /https?:\/\/localhost:\d+/i,
              /http:\/\/127\.0\.0\.1:\d+/i,
              /https?:\/\/[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+:\d+/i
            ];

            let detectedUrl = null;
            const output = result.stdout + (result.stderr || '');

            for (const pattern of urlPatterns) {
              const match = output.match(pattern);
              if (match) {
                detectedUrl = (match[1] || match[0]);
                break;
              }
            }

            if (detectedUrl) {
              detectedUrl = detectedUrl.replace(/\x1b\[[0-9;]*m/g, '').trim();
              console.log(' Auto-detection for preview:', detectedUrl);

              if (onDevServerDetected) {
                onDevServerDetected(detectedUrl);
              }

              setTimeout(async () => {
                try {
                  await window.electronAPI.shell.openExternal(detectedUrl);
                  setMessages(prev => [
                    ...prev,
                    {
                      id: Date.now(),
                      role: 'system',
                      content: `**Application started!**\n\nPreview is now active in the editor. Also opened in browser: [${detectedUrl}](${detectedUrl})`,
                    }
                  ]);
                } catch (err) {
                  console.error('Failed to open browser:', err);
                }
              }, 2000);
            }
          }

          // Auto-fix logic if command failed — but NOT if this command was itself triggered by auto-fix
          if (hasError && !isAutoFixCommandRef.current) {
            debug(' Command failed, triggering handleAutoFix...');
            // Capture full output for analysis
            const errorOutput = (result.stderr || '') + '\n' + (result.stdout || '');
            const cleanedOutput = errorOutput.trim() || 'No output captured';
            handleAutoFix(command, cleanedOutput);
          } else if (hasError && isAutoFixCommandRef.current) {
            debug(' Command from auto-fix failed, NOT re-triggering auto-fix to avoid loop');
            setMessages(prev => [...prev, {
              id: Date.now(),
              role: 'system',
              content: `**Auto-fix command failed:** \`${command}\`\n\nThe auto-fix couldn't resolve the issue automatically. You can describe the problem to me and I'll help fix it.`,
              isError: true
            }]);
          }

          if (i < commands.length - 1) {
            await new Promise(resolve => setTimeout(resolve, COMMAND_EXECUTION_DELAY));
          }
        } catch (error) {
          console.error('Error executing command:', error);
          setMessages(prev => prev.map(msg =>
            msg.id === statusMessageId
              ? { ...msg, isWorking: false, isExecuting: false }
              : msg
          ));
        }
      }
    } finally {
      setIsTerminalBusy(false);
    }
  };

  // Intelligently generate filename from code content
  const generateSmartFilename = (code, language) => {
    const extensionMap = {
      'javascript': 'js',
      'js': 'js',
      'typescript': 'ts',
      'ts': 'ts',
      'jsx': 'jsx',
      'tsx': 'tsx',
      'html': 'html',
      'css': 'css',
      'python': 'py',
      'py': 'py',
      'json': 'json',
      'markdown': 'md',
      'md': 'md',
    };

    const ext = extensionMap[language.toLowerCase()] || 'txt';

    // Try to extract meaningful names from code

    // For HTML files, look for title or common names
    if (ext === 'html') {
      if (code.includes('<title>')) {
        const titleMatch = code.match(/<title>(.*?)<\/title>/i);
        if (titleMatch) {
          const title = titleMatch[1].toLowerCase().replace(/\s+/g, '-');
          return `${title}.html`;
        }
      }
      return 'index.html';
    }

    // For CSS files
    if (ext === 'css') {
      if (code.includes('@keyframe') || code.includes('animation')) {
        return 'animations.css';
      }
      if (code.includes('.btn') || code.includes('button')) {
        return 'buttons.css';
      }
      return 'styles.css';
    }

    // For JavaScript/JSX/React files
    if (ext === 'js' || ext === 'jsx') {
      // Look for React component
      const componentMatch = code.match(/(?:function|const|class)\s+([A-Z][a-zA-Z0-9]*)/);
      if (componentMatch) {
        return `${componentMatch[1]}.${ext}`;
      }

      // Look for common patterns
      if (code.includes('express') || code.includes('app.listen')) {
        return 'server.js';
      }
      if (code.includes('Router') || code.includes('routes')) {
        return 'routes.js';
      }
      if (code.includes('mongoose') || code.includes('Schema')) {
        return 'model.js';
      }
      if (code.includes('export default')) {
        return 'index.js';
      }

      return 'app.js';
    }

    // For Python files
    if (ext === 'py') {
      if (code.includes('Flask') || code.includes('app.run')) {
        return 'app.py';
      }
      if (code.includes('django')) {
        return 'views.py';
      }
      if (code.includes('class') && code.includes('def __init__')) {
        const classMatch = code.match(/class\s+([A-Z][a-zA-Z0-9]*)/);
        if (classMatch) {
          return `${classMatch[1].toLowerCase()}.py`;
        }
      }
      return 'main.py';
    }

    // For JSON files
    if (ext === 'json') {
      if (code.includes('"name"') && code.includes('"version"')) {
        return 'package.json';
      }
      if (code.includes('"compilerOptions"')) {
        return 'tsconfig.json';
      }
      return 'config.json';
    }

    // Default fallback
    return `file-${Date.now()}.${ext}`;
  };

  // Execute commands based on Commander AI's intelligent decisions
  const executeCommandsFromCommanderAI = async (commands) => {
    if (!workspaceFolderRef.current) {
      console.log(' No workspace folder - skipping command execution');
      return;
    }

    setIsTerminalBusy(true);
    try {
      console.log(' Executing', commands.length, 'commands from Commander AI analysis');

      // Sort commands by order
      const sortedCommands = [...commands].sort((a, b) => a.order - b.order);

      for (let i = 0; i < sortedCommands.length; i++) {
        const cmdSpec = sortedCommands[i];

        // Skip unsafe commands
        if (!cmdSpec.isSafe) {
          console.log(' Skipping unsafe command:', cmdSpec.command);
          continue;
        }

        console.log(` Executing command ${i + 1}/${sortedCommands.length}:`, cmdSpec.command);
        console.log(' Reason:', cmdSpec.reason);
        console.log(' Working directory:', workspaceFolderRef.current);

        // Create a system message showing the command being executed
        const commandId = `command-${Date.now()}-${i}`;
        setMessages(prev => [
          ...prev,
          {
            id: commandId,
            role: 'system',
            content: `${cmdSpec.reason} \`\`\`bash\n${cmdSpec.command}\n\`\`\``,
            isExecuting: true
          }
        ]);

        try {
          // Execute the command
          const result = await window.electronAPI.terminalExecute(cmdSpec.command, workspaceFolderRef.current);

          // Detect if a new project folder was created (npm create, vite, etc.)
          if (result.success && (
            cmdSpec.command.includes('npm create') ||
            cmdSpec.command.includes('npx create') ||
            cmdSpec.command.includes('yarn create') ||
            cmdSpec.command.match(/cd\s+[\w-]+\s*$/)  // Also detect "cd project-name"
          )) {
            // Extract project name from command
            let projectName = null;

            // Try npm/yarn create pattern
            const createMatch = cmdSpec.command.match(/(?:npm|yarn|npx)\s+create\s+\S+\s+(\S+)/);
            if (createMatch && createMatch[1]) {
              projectName = createMatch[1];
            }

            // Try cd pattern
            const cdMatch = cmdSpec.command.match(/cd\s+([\w-]+)\s*$/);
            if (cdMatch && cdMatch[1] && cdMatch[1] !== '..' && cdMatch[1] !== '.') {
              projectName = cdMatch[1];
            }

            if (projectName) {
              const newProjectPath = `${workspaceFolderRef.current}/${projectName}`;

              console.log(' New project detected:', projectName);
              console.log(' Project path:', newProjectPath);
              console.warn(' IMPORTANT: User needs to open the new project folder!');

              // Add prominent warning message
              setMessages(prev => [
                ...prev,
                {
                  id: Date.now() + Math.random(),
                  role: 'system',
                  content: `**IMPORTANT: New Project Folder Detected!**\n\n**Project created: \`${projectName}\`**\n\n**YOU MUST OPEN THE NEW FOLDER NOW**\n\nThe AI will try to work on the previous project if you don't switch folders.\n\n**Steps to switch:**\n1. Click **File  Open Folder** (top menu)\n2. Navigate to: \`${newProjectPath}\`\n3. Select the folder and click Open\n\n**OR** use the folder icon in the sidebar (left side)\n\nThis clears the AI's memory and ensures commands run in the correct directory.`,
                  isError: true  // Make it red/prominent
                }
              ]);
            }
          }

          // Let Supervisor AI analyze the result
          const supervision = await SupervisorAI.monitorCommandExecution(
            cmdSpec.command,
            result.success,
            result.output,
            result.error
          );

          console.log(' Supervisor AI command analysis:', supervision);

          // Auto-open browser if dev server command was successful
          if (result.success && (
            cmdSpec.command.match(/npm\s+(run\s+)?(dev|start|serve|watch)/) ||
            cmdSpec.command.match(/(yarn|npm|bun)\s+(run\s+dev|dev|start|serve|watch)/) ||
            cmdSpec.command.match(/(vite|next|nodemon|serve|python.*run)/)
          )) {
            console.log(' Dev server command detected, attempting to open browser...');

            // Wait a bit for server to start, then try to detect port from output
            setTimeout(async () => {
              let url = 'http://localhost:3000'; // Default

              // Try to extract port from command output
              const output = result.stdout || result.output || '';
              const portMatch = output.match(/localhost:(\d+)/i) || output.match(/:\s*(\d+)/);
              if (portMatch && portMatch[1]) {
                url = `http://localhost:${portMatch[1]}`;
              }

              // Check for Vite specific output
              const viteMatch = output.match(/Local:\s+(http:\/\/[^\s]+)/i);
              if (viteMatch && viteMatch[1]) {
                url = viteMatch[1];
              }

              console.log(' Opening browser at:', url);

              // ✅ Set devServerUrl in App.jsx → shows the banner above input
              if (onDevServerDetected) {
                onDevServerDetected(url);
              }

              // Open in default browser
              try {
                await window.electronAPI.shell.openExternal(url);

                // Add a system message
                setMessages(prev => [
                  ...prev,
                  {
                    id: Date.now() + Math.random(),
                    role: 'system',
                    content: `Browser opened automatically\n\nYour application is running at: ${url}\n\nIf the browser didn't open, click here: [${url}](${url})`
                  }
                ]);
              } catch (err) {
                console.error('Failed to open browser:', err);
              }
            }, 3000); // Wait 3 seconds for server to start
          }

          // Update terminal status dot - Commander AI uses initial-terminal or default
          if (onUpdateTerminalStatus) {
            onUpdateTerminalStatus('initial-terminal', result.success ? 'success' : 'error');
          }

          // Update the message with the result
          setMessages(prev => prev.map(msg => {
            if (msg.id === commandId) {
              if (result.success) {
                return {
                  ...msg,
                  content: supervision.analysis.message || `Completed: ${cmdSpec.command}`,
                  isExecuting: false
                };
              } else {
                return {
                  ...msg,
                  content: supervision.analysis.message || `Failed: ${cmdSpec.command}`,
                  isExecuting: false,
                  isError: true
                };
              }
            }
            return msg;
          }));

          // If Supervisor AI detected an error, pause and provide context
          if (supervision.analysis.shouldPauseChatAI && supervision.analysis.errorDetails) {
            console.log(' Supervisor AI pausing workflow due to error');

            // Add error context message for Chat AI
            setMessages(prev => [
              ...prev,
              {
                role: 'system',
                content: `Error Detected:\n\n${supervision.analysis.errorDetails.context}\n\nSuggested fix: ${supervision.analysis.errorDetails.suggestedFix}`,
                isError: true
              }
            ]);

            // Stop further execution
            break;
          }

          // Wait a bit between commands
          if (i < sortedCommands.length - 1) {
            await new Promise(resolve => setTimeout(resolve, COMMAND_EXECUTION_DELAY));
          }
        } catch (error) {
          console.error(' Error executing command:', error);
          setMessages(prev => prev.map(msg => {
            if (msg.id === commandId) {
              return {
                ...msg,
                content: `Error: ${error.message}`,
                isExecuting: false,
                isError: true
              };
            }
            return msg;
          }));
        }
      }
    } finally {
      setIsTerminalBusy(false);
      debug(' Commander AI command execution complete');
    }
  };

  // Create files based on Executor AI's intelligent decisions
  // Automatically create files in background - NO user interaction needed
  const handleCreateFilesAutomatically = async (messageContent, messageId) => {
    console.log(' handleCreateFilesAutomatically called');
    console.log(' Workspace folder (ref):', workspaceFolderRef.current);

    if (!workspaceFolderRef.current) {
      console.warn(' No workspace folder - skipping file creation. User needs to open a folder first.');
      return; // Silently fail if no workspace
    }

    const codeBlocks = extractCodeBlocks(messageContent);

    console.log(' Code blocks extracted:', codeBlocks.length);

    // Filter out command blocks (bash, sh, shell) - those are for execution, not file creation
    // Also filter out blocks without explicit filenames
    const fileBlocks = codeBlocks.filter(block => {
      const lang = block.language.toLowerCase();
      const isCommand = ['bash', 'sh', 'shell', 'zsh', 'fish', 'powershell', 'cmd'].includes(lang);
      const hasFilename = block.filename && block.filename.trim().length > 0;

      console.log(`  - Block: lang=${lang}, filename=${block.filename}, isCommand=${isCommand}, hasFilename=${hasFilename}`);

      // Only include if it's not a command AND has a filename
      return !isCommand && hasFilename;
    });

    console.log(' File blocks (after filtering):', fileBlocks.length);

    if (fileBlocks.length === 0) {
      console.warn(' No file code blocks found - AI response had no files with filename= attribute');
      return; // No code blocks for files, nothing to do
    }

    console.log(' Starting automatic file creation for', fileBlocks.length, 'code blocks');

    // Show AI working status
    const workingMessageId = `working-${Date.now()}`;
    // File creation happens silently - no status message in chat

    // Automatically create files with smart names
    let createdCount = 0;
    const createdFiles = [];

    for (let i = 0; i < fileBlocks.length; i++) {
      const block = fileBlocks[i];
      const blockId = `${messageId}-block-${i}`;

      // Mark as creating
      setCodeBlockStates(prev => ({
        ...prev,
        [blockId]: { status: 'creating', filename: null }
      }));

      debug(` Processing code block ${i + 1}/${fileBlocks.length}:`, block.language);

      try {
        // Use filename from the code block (already validated to exist in filter above)
        let fileName = block.filename;

        debug(' Using filename from AI:', fileName);

        // Update with filename
        setCodeBlockStates(prev => ({
          ...prev,
          [blockId]: { status: 'creating', filename: fileName }
        }));

        // Use the filename as-is - if file exists, it will be overwritten
        // This allows the AI to edit existing files by using the same filename
        let filePath = `${workspaceFolderRef.current}/${fileName}`;

        // Check if file exists (for logging only)
        const checkResult = await window.electronAPI.fs.readFile(filePath);
        if (checkResult.success) {
          debug(' File exists, will be overwritten:', fileName);
        } else {
          debug(' Creating new file:', fileName);
        }

        // Create parent directories if needed
        const dirPath = filePath.substring(0, filePath.lastIndexOf('/'));
        if (dirPath && dirPath !== workspaceFolderRef.current) {
          debug(' Creating parent directory:', dirPath);
          const dirResult = await window.electronAPI.fs.createDir(dirPath);
          if (!dirResult.success && !dirResult.error?.includes('EEXIST')) {
            console.error(' Failed to create directory:', dirResult.error);
            setCodeBlockStates(prev => ({
              ...prev,
              [blockId]: { status: 'failed', filename: fileName, error: `Failed to create directory: ${dirResult.error}` }
            }));
            continue;
          }
        }

        // Create the file
        debug(' Creating file:', filePath);
        const result = await window.electronAPI.fs.createFile(filePath);

        debug(' Create file result:', result);

        if (result.success) {
          debug(' Writing content to file...');
          
          let contentToWrite = block.code;
          if (fileName === '.env') {
            console.log(' [Master Backend] Intercepting .env to inject automated backend credentials...');
            // Generate a stable unique APP_ID for this project (used to separate data in Firestore)
            const generatedAppId = `app_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
            contentToWrite = contentToWrite
              .replace(/your_firebase_api_key/g, import.meta.env.VITE_FIREBASE_API_KEY || '')
              .replace(/your_project\.firebaseapp\.com/g, import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '')
              .replace(/your_project_id/g, import.meta.env.VITE_FIREBASE_PROJECT_ID || '')
              .replace(/your_bucket/g, import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '')
              .replace(/your_sender_id/g, import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '')
              .replace(/your_app_id/g, import.meta.env.VITE_FIREBASE_APP_ID || '')
              .replace(/your_unique_app_id_here/g, generatedAppId)
              .replace(/%%APP_ID%%/g, generatedAppId);
          }

          const writeResult = await window.electronAPI.fs.writeFile(filePath, contentToWrite);
          console.log(' Write result:', writeResult);
          if (writeResult.success) {
            createdCount++;
            createdFiles.push(fileName);
            console.log(' File created successfully:', fileName);
            setCodeBlockStates(prev => ({
              ...prev,
              [blockId]: { status: 'created', filename: fileName }
            }));
            // Add delay to ensure filesystem sync before notifying
            await new Promise(resolve => setTimeout(resolve, 300));
            if (onFileCreated) {
              console.log(' Calling onFileCreated callback for:', fileName);
              onFileCreated(filePath);
            } else {
              console.log(' No onFileCreated callback available');
            }
          } else {
            console.error(' Failed to write file:', writeResult.error, 'File:', filePath, 'Block:', block);
            alert(` Failed to write file: ${fileName}\nError: ${writeResult.error}`);
            setCodeBlockStates(prev => ({
              ...prev,
              [blockId]: { status: 'failed', filename: fileName, error: writeResult.error }
            }));
          }
        } else {
          console.error(' Failed to create file:', result.error);

          // Mark as failed
          setCodeBlockStates(prev => ({
            ...prev,
            [blockId]: { status: 'failed', filename: fileName || 'unknown', error: result.error }
          }));
        }
      } catch (error) {
        console.error(' Error creating file:', error);

        // Mark as failed
        setCodeBlockStates(prev => ({
          ...prev,
          [blockId]: { status: 'failed', filename: fileName || 'unknown', error: error.message }
        }));
      }
    }

    console.log(' File creation complete. Created:', createdCount, 'files');

    // CRITICAL: Force final refresh after ALL files are created
    if (createdCount > 0 && onFileCreated) {
      console.log(' Final explorer refresh after creating', createdCount, 'files');
      // Wait for filesystem to fully sync
      await new Promise(resolve => setTimeout(resolve, 500));
      // Trigger refresh for each created file to ensure all appear
      for (const fileName of createdFiles) {
        const filePath = `${workspaceFolderRef.current}/${fileName}`;
        console.log(' Refreshing explorer for:', fileName);
        onFileCreated(filePath);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      // One final refresh to catch anything missed
      await new Promise(resolve => setTimeout(resolve, 200));
      const lastFilePath = `${workspaceFolderRef.current}/${createdFiles[createdFiles.length - 1]}`;
      onFileCreated(lastFilePath);
    }

    // Files are created silently - no chat notification needed
    // Users can see them in the Explorer
  };

  // Create files from AI generated code - MANUAL (for button clicks)
  const handleCreateFiles = async (messageContent) => {
    if (!workspaceFolderRef.current) {
      alert('Please open a folder first to create files.');
      return;
    }

    const codeBlocks = extractCodeBlocks(messageContent);

    if (codeBlocks.length === 0) {
      alert('No code blocks found in this message.');
      return;
    }

    // Automatically create files with smart names
    let createdCount = 0;
    const createdFiles = [];

    for (let i = 0; i < codeBlocks.length; i++) {
      const block = codeBlocks[i];

      try {
        // Generate smart filename automatically
        let fileName = generateSmartFilename(block.code, block.language);

        // If file already exists, add a number
        let counter = 1;
        let originalName = fileName;
        let filePath = `${workspaceFolderRef.current}/${fileName}`;

        // Check if file exists and create unique name
        while (true) {
          const checkResult = await window.electronAPI.fs.readFile(filePath);
          if (!checkResult.success) {
            // File doesn't exist, we can use this name
            break;
          }
          // File exists, try with counter
          const nameParts = originalName.split('.');
          const ext = nameParts.pop();
          const baseName = nameParts.join('.');
          fileName = `${baseName}-${counter}.${ext}`;
          filePath = `${workspaceFolderRef.current}/${fileName}`;
          counter++;
        }

        // Create the file
        const result = await window.electronAPI.fs.createFile(filePath);

        if (result.success) {
          const writeResult = await window.electronAPI.fs.writeFile(filePath, block.code);

          if (writeResult.success) {
            createdCount++;
            createdFiles.push(fileName);

            // Open the first file automatically
            if (i === 0 && onFileCreated) {
              onFileCreated(filePath);
            }
          }
        }
      } catch (error) {
        console.error('Error creating file:', error);
      }
    }

    if (createdCount > 0) {
      const fileList = createdFiles.join(', ');
      alert(`Successfully created ${createdCount} file(s):\n${fileList}\n\nThe first file has been opened in the editor.`);
    }
  };

  // Save single code block - AUTOMATIC for non-technical users
  const handleSaveCodeBlock = async (code, language) => {
    if (!workspaceFolderRef.current) {
      alert('Please open a folder first to save files.');
      return;
    }

    try {
      // Generate smart filename automatically
      let fileName = generateSmartFilename(code, language);

      // If file already exists, add a number
      let counter = 1;
      let originalName = fileName;
      let filePath = `${workspaceFolderRef.current}/${fileName}`;

      // Check if file exists and create unique name
      while (true) {
        const checkResult = await window.electronAPI.fs.readFile(filePath);
        if (!checkResult.success) {
          // File doesn't exist, we can use this name
          break;
        }
        // File exists, try with counter
        const nameParts = originalName.split('.');
        const ext = nameParts.pop();
        const baseName = nameParts.join('.');
        fileName = `${baseName}-${counter}.${ext}`;
        filePath = `${workspaceFolderRef.current}/${fileName}`;
        counter++;
      }

      // Create the file
      const result = await window.electronAPI.fs.createFile(filePath);

      if (result.success) {
        const writeResult = await window.electronAPI.fs.writeFile(filePath, code);

        if (writeResult.success && onFileCreated) {
          onFileCreated(filePath);
          alert(`File created successfully: ${fileName}`);
        }
      }
    } catch (error) {
      console.error('Error saving file:', error);
      alert(`Error saving file: ${error.message}`);
    }
  };

  return (
    <div className="ai-assistant studio-assistant">
      {/* Hide old header in studio mode */}
      <div className="ai-header studio-hidden">
        <div className="ai-header-left">
          <div className="ai-header-logo">
            <FiZap size={16} color="#7c3aed" />
          </div>
          <div className="ai-header-info">
            <div className="ai-header-title">ExternAI</div>
            {subscription && subscription.tier === 'free' && (
              <div className="prompts-remaining">
                {subscription.freePromptsRemaining || 0} prompts left
              </div>
            )}
          </div>
        </div>
        <button className="ai-close" onClick={onClose}>
          <FiX size={18} />
        </button>
      </div>
      <div className={`ai-chat-card ${messages.length === 0 ? 'studio-empty' : ''}`}>

      <div className="ai-messages" ref={messagesContainerRef}>
        {messages.length === 0 && !isLoading && (
          <div className="studio-hero">
            <h1 className="studio-title">
            Build your ideas with Extern AI <span className="studio-sparkle">✧</span>
            </h1>
          </div>
        )}
        {(() => {
          // Filter out duplicate messages
          const uniqueMessages = messages.filter((msg, idx, arr) => {
            const firstIdx = arr.findIndex(m =>
              m.role === msg.role &&
              m.content === msg.content
            );
            return firstIdx === idx;
          });

          // Group consecutive system messages together
          const messageGroups = [];
          let currentSystemGroup = [];

          uniqueMessages.forEach((msg, idx) => {
            if (msg.role === 'system') {
              currentSystemGroup.push(msg);
            } else {
              // Non-system message - flush any pending system group first
              if (currentSystemGroup.length > 0) {
                messageGroups.push({ type: 'system-group', messages: currentSystemGroup });
                currentSystemGroup = [];
              }
              messageGroups.push({ type: 'single', message: msg });
            }
          });

          // Flush any remaining system messages
          if (currentSystemGroup.length > 0) {
            messageGroups.push({ type: 'system-group', messages: currentSystemGroup });
          }

          // Render message groups
          return messageGroups.map((group, groupIdx) => {
            if (group.type === 'system-group') {
              // Render system message group with shared container
              return (
                <div key={`system-group-${groupIdx}`} className="system-message-group">
                  {group.messages.map((msg, idx) => {
                    const messageKey = msg.id || `msg-${groupIdx}-${idx}`;
                    let messageClass = `ai-message ${msg.role}`;
                    if (msg.isStreaming) messageClass += ' streaming';
                    if (msg.isExecuting) messageClass += ' executing';
                    if (msg.isError) messageClass += ' error';

                    return (
                      <div
                        key={messageKey}
                        className={messageClass}
                        data-command-status={msg.commandStatus || ''}
                        data-scanning={msg.isScanning ? 'true' : 'false'}
                        data-working={msg.isWorking ? 'true' : 'false'}
                      >
                        <div className="message-content" data-working={msg.isWorking ? 'true' : 'false'}>
                  {(() => {
                    // Render special upgrade card for daily limit errors
                    if (msg.isDailyLimitError) {
                      return (
                        <div className="daily-limit-card">
                          <div className="daily-limit-icon">🔒</div>
                          <div className="daily-limit-body">
                            <div className="daily-limit-title">Daily Limit Reached</div>
                            <div className="daily-limit-desc">{msg.limitMessage || "You've used all your free prompts for today. Your limit resets at midnight UTC."}</div>
                            <button
                              className="daily-limit-upgrade-btn"
                              onClick={() => { if (onUpgradeClick) onUpgradeClick(); }}
                            >
                              ⚡ Upgrade for Unlimited Access
                            </button>
                          </div>
                        </div>
                      );
                    }

                    let fileBlockIndex = 0; // Track file blocks separately

                    // Helper to process bold text within a string
                    const processBoldText = (text, i, partIdx, lastIdx) => {
                      let boldIndex = 0;
                      const boldParts = [];
                      const boldRegexLocal = /\*\*(.+?)\*\*/g;
                      let match;

                      while ((match = boldRegexLocal.exec(text)) !== null) {
                        if (match.index > boldIndex) {
                          boldParts.push(text.substring(boldIndex, match.index));
                        }
                        boldParts.push(<strong key={`bold-${i}-${partIdx}-${lastIdx}-${match.index}`}>{match[1]}</strong>);
                        boldIndex = match.index + match[0].length;
                      }

                      if (boldIndex < text.length) {
                        boldParts.push(text.substring(boldIndex));
                      }

                      return boldParts.length > 0 ? boldParts : text;
                    };

                    return msg.content.split('```').map((part, i) => {
                      if (i % 2 === 1) {
                        // Extract language and filename from first line
                        const lines = part.split('\n');
                        const firstLine = lines[0].trim();
                        const code = lines.slice(1).join('\n');

                        // Extract language and filename
                        let language = 'code';
                        let displayFilename = null;
                        let blockState = null;
                        let blockStatus = null;
                        let blockId = null;

                        // Extract language from first line
                        const langMatch = firstLine.split(/\s+/)[0];
                        if (langMatch) {
                          language = langMatch;
                        }

                        // Check for filename= in the first line
                        if (firstLine.includes('filename=')) {
                          // Extract filename value
                          const filenameMatch = firstLine.match(/filename=([^\s]+)/);
                          if (filenameMatch) {
                            displayFilename = filenameMatch[1];
                            blockId = `${messageKey}-block-${fileBlockIndex}`;
                            blockState = blockId ? codeBlockStates[blockId] : null;
                            blockStatus = blockState?.status;
                            fileBlockIndex++;
                          }
                        }

                        // Determine if this is a command block based on language
                        const isCommand = ['bash', 'sh', 'shell', 'zsh', 'fish', 'powershell', 'cmd', 'terminal'].includes(language.toLowerCase());

                        // ALL code blocks (commands and files) - show only header, never code content
                        if (isCommand) {
                          // Command blocks - same pill style as file blocks but grey
                          const commandText = (code || part).trim().split('\n')[0];
                          const truncatedCommand = commandText.length > 50 ? commandText.substring(0, 50) + '...' : commandText;

                          return (
                            <span key={i} className="code-block-container collapsed command-block" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                              <span className="code-block-header" style={{ cursor: 'default', width: '100%' }}>
                                <span className="code-filename command-text">{truncatedCommand}</span>
                              </span>
                              {msg.isExecuting && <CommandProgress isExecuting={msg.isExecuting} />}
                            </span>
                          );
                        } else {
                          // File blocks - pill-sized inline badges
                          return (
                            <span key={i} className="code-block-container collapsed file-block">
                              <span className="code-block-header" style={{ cursor: 'default' }}>
                                {displayFilename && (
                                  <>
                                    {getFileIcon(displayFilename)}
                                    <span className="code-filename">{displayFilename}</span>
                                  </>
                                )}
                                {blockStatus === 'creating' && (
                                  <span className="code-status creating">
                                    <FiLoader className="spinning" size={10} />
                                  </span>
                                )}
                                {blockStatus === 'created' && (
                                  <span className="code-status created">
                                    <FiCheck size={10} />
                                  </span>
                                )}
                                {blockStatus === 'failed' && (
                                  <span className="code-status failed">!</span>
                                )}
                              </span>
                            </span>
                          );
                        }
                      }

                      // TEXT CONTENT - Use sanitizer to strip all code
                      const sanitizedText = sanitizeTextContent(part);
                      if (!sanitizedText) return null;

                      // Render sanitized text with markdown support
                      return sanitizedText.split('\n').map((line, j) => {
                        if (!line.trim()) return null;

                        // Handle headers
                        if (line.startsWith('### ')) {
                          return <h3 key={`${i}-${j}`} style={{ fontSize: '1.1em', fontWeight: 'bold', marginTop: '1em', marginBottom: '0.5em' }}>{line.substring(4)}</h3>;
                        }
                        if (line.startsWith('## ')) {
                          return <h2 key={`${i}-${j}`} style={{ fontSize: '1.3em', fontWeight: 'bold', marginTop: '1.2em', marginBottom: '0.6em', borderBottom: '1px solid #3a3a3a', paddingBottom: '0.3em' }}>{line.substring(3)}</h2>;
                        }
                        if (line.startsWith('# ')) {
                          return <h1 key={`${i}-${j}`} style={{ fontSize: '1.5em', fontWeight: 'bold', marginTop: '1.5em', marginBottom: '0.7em' }}>{line.substring(2)}</h1>;
                        }

                        // Handle lists
                        if (line.match(/^\d+\.\s/)) {
                          return <li key={`${i}-${j}`} style={{ marginLeft: '1.5em', marginBottom: '0.3em' }}>{line.replace(/^\d+\.\s/, '')}</li>;
                        }
                        if (line.startsWith('- ') || line.startsWith('* ')) {
                          return <li key={`${i}-${j}`} style={{ marginLeft: '1.5em', marginBottom: '0.3em', listStyleType: 'disc' }}>{line.substring(2)}</li>;
                        }

                        // Handle horizontal rule
                        if (line.trim() === '---' || line.trim() === '***') {
                          return <hr key={`${i}-${j}`} style={{ border: 'none', borderTop: '1px solid #3a3a3a', margin: '1.5em 0' }} />;
                        }

                        // Handle bold and inline code
                        const boldRegex = /\*\*(.+?)\*\*/g;
                        const inlineCodeRegex = /`([^`]+)`/g;
                        const parts = [];
                        let match;

                        // Process inline code first
                        const tempParts = [];
                        let tempIndex = 0;
                        while ((match = inlineCodeRegex.exec(line)) !== null) {
                          if (match.index > tempIndex) {
                            tempParts.push(line.substring(tempIndex, match.index));
                          }
                          // Only show inline code if it's short (like a filename or command)
                          const codeContent = match[1];
                          if (codeContent.length < 50 && !codeContent.includes('\n')) {
                            tempParts.push({ type: 'code', content: codeContent });
                          }
                          tempIndex = match.index + match[0].length;
                        }
                        if (tempIndex < line.length) {
                          tempParts.push(line.substring(tempIndex));
                        }

                        // Then handle links, bold and inline code
                        tempParts.forEach((part, partIdx) => {
                          if (typeof part === 'object' && part.type === 'code') {
                            parts.push(<code key={`code-${j}-${partIdx}`} style={{
                              background: 'rgba(255,255,255,0.1)',
                              padding: '2px 6px',
                              borderRadius: '3px',
                              fontFamily: 'monospace',
                              fontSize: '0.9em'
                            }}>{part.content}</code>);
                          } else if (typeof part === 'string') {
                            // Handle links [text](url)
                            const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
                            let lastIndex = 0;
                            let linkMatch;

                            while ((linkMatch = linkRegex.exec(part)) !== null) {
                              // Text before link
                              if (linkMatch.index > lastIndex) {
                                parts.push(processBoldText(part.substring(lastIndex, linkMatch.index), j, partIdx, lastIndex));
                              }

                              // The link itself
                              const linkText = linkMatch[1];
                              const linkUrl = linkMatch[2];

                              if (linkUrl === '#upgrade') {
                                parts.push(
                                  <button
                                    key={`link-${j}-${linkMatch.index}`}
                                    className="upgrade-link-btn"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      if (onUpgradeClick) onUpgradeClick();
                                    }}
                                  >
                                    {linkText}
                                  </button>
                                );
                              } else {
                                parts.push(
                                  <a
                                    key={`link-${j}-${linkMatch.index}`}
                                    href={linkUrl}
                                    onClick={(e) => {
                                      if (linkUrl.startsWith('#')) e.preventDefault();
                                    }}
                                  >
                                    {linkText}
                                  </a>
                                );
                              }

                              lastIndex = linkMatch.index + linkMatch[0].length;
                            }

                            // Remaining text after last link
                            if (lastIndex < part.length) {
                              parts.push(processBoldText(part.substring(lastIndex), j, partIdx, lastIndex));
                            } else if (lastIndex === 0) {
                              // No links found
                              parts.push(processBoldText(part, j, partIdx, 0));
                            }
                          }
                        });

                        if (parts.length === 0) {
                          parts.push(line);
                        }

                        return <p key={`${i}-${j}`}>{parts}</p>;
                      });
                    });
                  })()}
                </div>

                {/* Retry button for failed auto-fix */}
                {msg.isRetryError && msg.retryContext && (
                  <div className="retry-button-container">
                    <button
                      className="retry-button"
                      onClick={() => handleRetryAutoFix(msg.retryContext)}
                      disabled={isLoading}
                    >
                      <FiLoader className={isLoading ? 'spinning' : ''} size={16} />
                      {isLoading ? 'Retrying...' : 'Retry Auto-Fix'}
                    </button>
                  </div>
                )}

                {/* Interrupted response indicator */}
                {msg.isInterrupted && (
                  <div className="interrupted-indicator">
                    <span className="interrupted-text">Response was cut off — there may be remaining code or instructions</span>
                    <button
                      className="interrupted-retry-btn"
                      onClick={handleRetryInterrupted}
                      disabled={isLoading}
                    >
                      {isLoading ? 'Continuing...' : 'Continue'}
                    </button>
                  </div>
                )}


                      </div>
                    );
                  })}
                </div>
              );
            } else {
              // Render single message (user/assistant)
              const msg = group.message;
              const codeBlocks = extractCodeBlocks(msg.content);
              const hasCode = codeBlocks.length > 0;
              const messageKey = msg.id || `msg-${groupIdx}`;
              let messageClass = `ai-message ${msg.role}`;
              if (msg.isStreaming) messageClass += ' streaming';
              if (msg.isExecuting) messageClass += ' executing';
              if (msg.isError) messageClass += ' error';

              return (
                <div
                  key={messageKey}
                  className={messageClass}
                  data-command-status={msg.commandStatus || ''}
                  data-scanning={msg.isScanning ? 'true' : 'false'}
                  data-working={msg.isWorking ? 'true' : 'false'}
                >
                  <div className="message-content" data-working={msg.isWorking ? 'true' : 'false'}>
                    {(() => {
                      let fileBlockIndex = 0; // Track file blocks separately

                      // Helper to process bold text within a string
                      const processBoldText = (text, i, partIdx, lastIdx) => {
                        let boldIndex = 0;
                        const boldParts = [];
                        const boldRegexLocal = /\*\*(.+?)\*\*/g;
                        let match;

                        while ((match = boldRegexLocal.exec(text)) !== null) {
                          if (match.index > boldIndex) {
                            boldParts.push(text.substring(boldIndex, match.index));
                          }
                          boldParts.push(<strong key={`bold-${i}-${partIdx}-${lastIdx}-${match.index}`}>{match[1]}</strong>);
                          boldIndex = match.index + match[0].length;
                        }

                        if (boldIndex < text.length) {
                          boldParts.push(text.substring(boldIndex));
                        }

                        return boldParts.length > 0 ? boldParts : text;
                      };

                      return msg.content.split('```').map((part, i) => {
                        if (i % 2 === 1) {
                          // Extract language and filename from first line
                          const lines = part.split('\n');
                          const firstLine = lines[0].trim();
                          const code = lines.slice(1).join('\n');

                          // Extract language and filename
                          let language = 'code';
                          let displayFilename = null;
                          let blockState = null;
                          let blockStatus = null;
                          let blockId = null;

                          // Extract language from first line
                          const langMatch = firstLine.split(/\s+/)[0];
                          if (langMatch) {
                            language = langMatch;
                          }

                          // Check for filename= in the first line
                          if (firstLine.includes('filename=')) {
                            // Extract filename value
                            const filenameMatch = firstLine.match(/filename=([^\s]+)/);
                            if (filenameMatch) {
                              displayFilename = filenameMatch[1];
                              blockId = `${messageKey}-block-${fileBlockIndex}`;
                              blockState = blockId ? codeBlockStates[blockId] : null;
                              blockStatus = blockState?.status;
                              fileBlockIndex++;
                            }
                          }

                          // Determine if this is a command block based on language
                          const isCommand = ['bash', 'sh', 'shell', 'zsh', 'fish', 'powershell', 'cmd', 'terminal'].includes(language.toLowerCase());

                          // ALL code blocks (commands and files) - show only header, never code content
                          if (isCommand) {
                            // Command blocks - same pill style as file blocks but grey
                            const commandText = (code || part).trim().split('\n')[0];
                            const truncatedCommand = commandText.length > 50 ? commandText.substring(0, 50) + '...' : commandText;

                            return (
                              <span key={i} className="code-block-container collapsed command-block" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                                <span className="code-block-header" style={{ cursor: 'default', width: '100%' }}>
                                  <span className="code-filename command-text">{truncatedCommand}</span>
                                </span>
                                {msg.isExecuting && <CommandProgress isExecuting={msg.isExecuting} />}
                              </span>
                            );
                          } else {
                            // File blocks - pill-sized inline badges
                            return (
                              <span key={i} className="code-block-container collapsed file-block">
                                <span className="code-block-header" style={{ cursor: 'default' }}>
                                  {displayFilename && (
                                    <>
                                      {getFileIcon(displayFilename)}
                                      <span className="code-filename">{displayFilename}</span>
                                    </>
                                  )}
                                  {blockStatus === 'creating' && (
                                    <span className="code-status creating">
                                      <FiLoader className="spinning" size={10} />
                                    </span>
                                  )}
                                  {blockStatus === 'created' && (
                                    <span className="code-status created">
                                      <FiCheck size={10} />
                                    </span>
                                  )}
                                  {blockStatus === 'failed' && (
                                    <span className="code-status failed">!</span>
                                  )}
                                </span>
                              </span>
                            );
                          }
                        }

                        // TEXT CONTENT - Use sanitizer to strip all code
                        const sanitizedText = sanitizeTextContent(part);
                        if (!sanitizedText) return null;

                        // Render sanitized text with markdown support
                        return sanitizedText.split('\n').map((line, j) => {
                          if (!line.trim()) return null;

                          // Handle headers
                          if (line.startsWith('### ')) {
                            return <h3 key={`${i}-${j}`} style={{ fontSize: '1.1em', fontWeight: 'bold', marginTop: '1em', marginBottom: '0.5em' }}>{line.substring(4)}</h3>;
                          }
                          if (line.startsWith('## ')) {
                            return <h2 key={`${i}-${j}`} style={{ fontSize: '1.3em', fontWeight: 'bold', marginTop: '1.2em', marginBottom: '0.6em', borderBottom: '1px solid #3a3a3a', paddingBottom: '0.3em' }}>{line.substring(3)}</h2>;
                          }
                          if (line.startsWith('# ')) {
                            return <h1 key={`${i}-${j}`} style={{ fontSize: '1.5em', fontWeight: 'bold', marginTop: '1.5em', marginBottom: '0.7em' }}>{line.substring(2)}</h1>;
                          }

                          // Handle lists
                          if (line.match(/^\d+\.\s/)) {
                            return <li key={`${i}-${j}`} style={{ marginLeft: '1.5em', marginBottom: '0.3em' }}>{line.replace(/^\d+\.\s/, '')}</li>;
                          }
                          if (line.startsWith('- ') || line.startsWith('* ')) {
                            return <li key={`${i}-${j}`} style={{ marginLeft: '1.5em', marginBottom: '0.3em', listStyleType: 'disc' }}>{line.substring(2)}</li>;
                          }

                          // Handle horizontal rule
                          if (line.trim() === '---' || line.trim() === '***') {
                            return <hr key={`${i}-${j}`} style={{ border: 'none', borderTop: '1px solid #3a3a3a', margin: '1.5em 0' }} />;
                          }

                          // Handle bold and inline code
                          const boldRegex = /\*\*(.+?)\*\*/g;
                          const inlineCodeRegex = /`([^`]+)`/g;
                          const parts = [];
                          let match;

                          // Process inline code first
                          const tempParts = [];
                          let tempIndex = 0;
                          while ((match = inlineCodeRegex.exec(line)) !== null) {
                            if (match.index > tempIndex) {
                              tempParts.push(line.substring(tempIndex, match.index));
                            }
                            // Only show inline code if it's short (like a filename or command)
                            const codeContent = match[1];
                            if (codeContent.length < 50 && !codeContent.includes('\n')) {
                              tempParts.push({ type: 'code', content: codeContent });
                            }
                            tempIndex = match.index + match[0].length;
                          }
                          if (tempIndex < line.length) {
                            tempParts.push(line.substring(tempIndex));
                          }

                          // Then handle links, bold and inline code
                          tempParts.forEach((part, partIdx) => {
                            if (typeof part === 'object' && part.type === 'code') {
                              parts.push(<code key={`code-${j}-${partIdx}`} style={{
                                background: 'rgba(255,255,255,0.1)',
                                padding: '2px 6px',
                                borderRadius: '3px',
                                fontFamily: 'monospace',
                                fontSize: '0.9em'
                              }}>{part.content}</code>);
                            } else if (typeof part === 'string') {
                              // Handle links [text](url)
                              const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
                              let lastIndex = 0;
                              let linkMatch;

                              while ((linkMatch = linkRegex.exec(part)) !== null) {
                                // Text before link
                                if (linkMatch.index > lastIndex) {
                                  parts.push(processBoldText(part.substring(lastIndex, linkMatch.index), j, partIdx, lastIndex));
                                }

                                // The link itself
                                const linkText = linkMatch[1];
                                const linkUrl = linkMatch[2];

                                if (linkUrl === '#upgrade') {
                                  parts.push(
                                    <button
                                      key={`link-${j}-${linkMatch.index}`}
                                      className="upgrade-link-btn"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        if (onUpgradeClick) onUpgradeClick();
                                      }}
                                    >
                                      {linkText}
                                    </button>
                                  );
                                } else {
                                  parts.push(
                                    <a
                                      key={`link-${j}-${linkMatch.index}`}
                                      href={linkUrl}
                                      onClick={(e) => {
                                        if (linkUrl.startsWith('#')) e.preventDefault();
                                      }}
                                    >
                                      {linkText}
                                    </a>
                                  );
                                }

                                lastIndex = linkMatch.index + linkMatch[0].length;
                              }

                              // Remaining text after last link
                              if (lastIndex < part.length) {
                                parts.push(processBoldText(part.substring(lastIndex), j, partIdx, lastIndex));
                              } else if (lastIndex === 0) {
                                // No links found
                                parts.push(processBoldText(part, j, partIdx, 0));
                              }
                            }
                          });

                          if (parts.length === 0) {
                            parts.push(line);
                          }

                          return <p key={`${i}-${j}`}>{parts}</p>;
                        });
                      });
                    })()}
                  </div>

                  {/* Retry button for failed auto-fix */}
                  {msg.isRetryError && msg.retryContext && (
                    <div className="retry-button-container">
                      <button
                        className="retry-button"
                        onClick={() => handleRetryAutoFix(msg.retryContext)}
                        disabled={isLoading}
                      >
                        <FiLoader className={isLoading ? 'spinning' : ''} size={16} />
                        {isLoading ? 'Retrying...' : 'Retry Auto-Fix'}
                      </button>
                    </div>
                  )}

                  {/* Interrupted response indicator */}
                  {msg.isInterrupted && (
                    <div className="interrupted-indicator">
                      <span className="interrupted-text">Response interrupted</span>
                      <button
                        className="interrupted-retry-btn"
                        onClick={handleRetryInterrupted}
                        disabled={isLoading}
                      >
                        {isLoading ? 'Continuing...' : 'Continue'}
                    </button>
                  </div>
                )}


              </div>
            );
          }
        });
        })()}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="ai-input-controls-row" style={{ padding: '0 24px', display: 'flex', justifyContent: 'flex-end', marginBottom: '-8px' }}>
        {isTerminalBusy && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            fontSize: '11px',
            color: 'var(--vscode-descriptionForeground, #8a8a8a)',
            padding: '8px 12px',
            background: 'var(--vscode-editor-inactiveSelectionBackground, rgba(0,0,0,0.1))',
            borderRadius: '8px',
            border: '1px solid var(--vscode-widget-border, #333)',
            width: '240px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FiLoader className="spinning" size={12} />
              Wait a bit, a command is running...
            </div>
            <CommandProgress isExecuting={isTerminalBusy} />
          </div>
        )}
      </div>

      <form
        className={`ai-input-form ${isDraggingOver ? 'drag-over' : ''}`}
        onSubmit={handleSubmit}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Show success feedback after drop */}
        {justDropped && (
          <div className="drop-success">
            <FiCheck size={16} /> Image added!
          </div>
        )}

        {/* Display attached images */}
        {attachedImages.length > 0 && (
          <div className="attached-images">
            {attachedImages.map((image, idx) => (
              <div key={idx} className="attached-image-item">
                <img src={image.urls.thumb} alt={image.alt_description || 'Image'} />
                <button
                  type="button"
                  className="remove-image"
                  onClick={() => removeAttachedImage(image.urls.regular)}
                  title="Remove image"
                >
                  <FiX size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Removed working indicator UI */}

        {/* Dev server URL bar */}
        {devServerUrl && (
          <div className="dev-server-bar" onClick={() => {
            if (window.electronAPI?.shell?.openExternal) {
              window.electronAPI.shell.openExternal(devServerUrl);
            } else {
              window.open(devServerUrl, '_blank');
            }
          }}>
            <span className="dev-server-dot"></span>
            <span>Click to open</span>
            <span className="dev-server-url">{devServerUrl}</span>
          </div>
        )}
        {/* Drag overlay with cancel button */}
        {isDraggingOver && (
          <div className="drag-overlay">
            <div className="drag-overlay-content">
              <span>Drop image here...</span>
              <button
                type="button"
                className="drag-cancel-btn"
                onClick={() => setIsDraggingOver(false)}
                title="Cancel"
              >
                <FiX size={14} />
              </button>
            </div>
          </div>
        )}
        <div className="ai-input-inner studio-input-inner">
          <textarea
            className="ai-input studio-input"
            placeholder="Describe an app and let Gemini do the rest"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            disabled={isLoading || isTerminalBusy}
            rows={1}
          />
          <div className="studio-input-actions">
            <div className="studio-input-actions-left">
              {subscription && subscription.tier === 'free' && (
                <div 
                  className="studio-usage-badge" 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '6px', 
                    background: 'rgba(124, 58, 237, 0.15)', 
                    color: '#a78bfa', 
                    padding: '4px 10px', 
                    borderRadius: '12px', 
                    fontSize: '12px', 
                    fontWeight: '600' 
                  }}
                  title="Daily prompts remaining"
                >
                  <FiZap size={12} />
                  <span>{subscription.freePromptsRemaining || 0} prompts left</span>
                </div>
              )}
              <button type="button" className="studio-icon-btn" title="Voice Input (Coming Soon)"><FiMic size={18} /></button>
              <button 
                type="button" 
                className="studio-icon-btn"
                title="Fix Application Errors"
                style={{ width: 'auto', padding: '0 10px', gap: '6px', display: 'flex', alignItems: 'center', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '16px' }}
                disabled={isLoading || isTerminalBusy}
                onClick={(e) => {
                  e.preventDefault();
                  if (isLoading || isTerminalBusy) return;
                  sendMessage("The application is not running as expected, please fix the error in the application.", []);
                }}
              >
                <FiTool size={14} />
                <span style={{ fontSize: '13px', fontWeight: '500' }}>Fix</span>
              </button>
            </div>
            <button
              type="submit"
              className="ai-send-btn studio-send-btn"
              disabled={!input.trim() || isLoading || isTerminalBusy}
            >
              {isLoading || isTerminalBusy ? (
                <FiLoader className="spinning" size={16} />
              ) : (
                <>
                  <FiSend size={14} style={{ marginRight: '6px' }} />
                  Send
                </>
              )}
            </button>
          </div>
        </div>
        {messages.length === 0 && !isLoading && (
          <div className="studio-integrations">
            <div className="integration-pill">AI Chatbot</div>
            <div className="integration-pill">Analytics Dashboard</div>
            <div className="integration-pill">E-Commerce Store</div>
            <div className="integration-pill">Booking Platform</div>
            <div className="integration-pill">Portfolio Site</div>
          </div>
        )}
      </form>
    </div>
  </div>
  );
});

AIAssistant.displayName = 'AIAssistant';

export default AIAssistant;
