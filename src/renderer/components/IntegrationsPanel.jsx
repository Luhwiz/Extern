import React, { useState, useEffect } from 'react';
import { FiX, FiArrowLeft, FiCheck, FiExternalLink, FiZap, FiCopy, FiSave, FiAlertCircle } from 'react-icons/fi';
import IntegrationCredentialsService from '../services/IntegrationCredentialsService';
import './IntegrationsPanel.css';

// ─── Brand Logos ─────────────────────────────────────────────────────────────

const StripeLogo = () => (
  <svg viewBox="0 0 40 40" width="36" height="36" fill="none">
    <rect width="40" height="40" rx="10" fill="#635BFF"/>
    <path d="M20.1 15.2c0-.8.7-1.1 1.8-1.1 1.6 0 3.6.5 5.1 1.4v-4.8c-1.7-.7-3.4-1-5.1-1-4.2 0-7 2.2-7 5.8 0 5.7 7.8 4.8 7.8 7.3 0 .9-.8 1.2-2 1.2-1.7 0-3.9-.7-5.6-1.7v4.9c1.9.8 3.8 1.2 5.6 1.2 4.3 0 7.2-2.1 7.2-5.8-.1-6.1-7.8-5.1-7.8-7.4z" fill="white"/>
  </svg>
);

const VercelLogo = () => (
  <svg viewBox="0 0 40 40" width="36" height="36" fill="none">
    <rect width="40" height="40" rx="10" fill="var(--vscode-fg)"/>
    <path d="M20 8L34 32H6L20 8Z" fill="white"/>
  </svg>
);

const OpenAILogo = () => (
  <svg viewBox="0 0 40 40" width="36" height="36" fill="none">
    <rect width="40" height="40" rx="10" fill="#10a37f"/>
    <path d="M29.4 17.3a7.2 7.2 0 0 0-.6-5.9 7.3 7.3 0 0 0-7.8-3.5 7.3 7.3 0 0 0-5.5-2.4 7.3 7.3 0 0 0-7 5 7.3 7.3 0 0 0-4.8 3.5 7.3 7.3 0 0 0 .9 8.5 7.3 7.3 0 0 0 .6 5.9 7.3 7.3 0 0 0 7.8 3.5 7.3 7.3 0 0 0 5.5 2.4 7.3 7.3 0 0 0 6.9-5 7.3 7.3 0 0 0 4.9-3.5 7.3 7.3 0 0 0-.9-8.5zm-10.9 15a5.4 5.4 0 0 1-3.5-1.3l.2-.1 5.8-3.3a.9.9 0 0 0 .5-.8v-8.1l2.5 1.4v6.6a5.4 5.4 0 0 1-5.5 5.6zm-11.7-5a5.4 5.4 0 0 1-.6-3.7l.2.1 5.8 3.4a.9.9 0 0 0 .9 0l7.1-4.1v2.8l-7.2 4.1a5.4 5.4 0 0 1-6.2-.6zm-1.5-12.6a5.4 5.4 0 0 1 2.8-2.4v6.8a.9.9 0 0 0 .5.8l7 4-2.4 1.4-5.8-3.4a5.4 5.4 0 0 1-2.1-7.2zm19.7 4.6L18 15.2l2.5-1.4 5.8 3.3a5.4 5.4 0 0 1-.8 9.8v-6.8a.9.9 0 0 0-.5-.8zm2.4-3.7l-.2-.1-5.8-3.4a.9.9 0 0 0-.9 0l-7.1 4.1v-2.8l7.2-4.2a5.4 5.4 0 0 1 6.8 7zm-15.4 5l-2.5-1.4v-6.6a5.4 5.4 0 0 1 8.8-4.1l-.2.1-5.8 3.4a.9.9 0 0 0-.5.8l.2 7.8zm1.3-2.9l3.1-1.8 3.2 1.8v3.6l-3.2 1.8-3.1-1.8v-3.6z" fill="white"/>
  </svg>
);

const FirebaseLogo = () => (
  <svg viewBox="0 0 40 40" width="36" height="36" fill="none">
    <rect width="40" height="40" rx="10" fill="#FF6D00"/>
    <path d="M12 30l3.5-20.5 5.8 10.8L12 30z" fill="#FFA000"/>
    <path d="M24.5 16.5L21.3 20.3 15.5 9.5l9 7z" fill="#F57C00"/>
    <path d="M12 30l7-4.2 7 4.2-7-21L12 30z" fill="#FFCA28"/>
    <path d="M19 8.8l7 21.2-7-4.2V8.8z" fill="#FFA000"/>
  </svg>
);

const ResendLogo = () => (
  <svg viewBox="0 0 40 40" width="36" height="36" fill="none">
    <rect width="40" height="40" rx="10" fill="var(--vscode-fg)"/>
    <path d="M10 28V12h10a8 8 0 0 1 0 16h-4l5 0" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <circle cx="28" cy="28" r="3" fill="#ff4444"/>
  </svg>
);

const CloudinaryLogo = () => (
  <svg viewBox="0 0 40 40" width="36" height="36" fill="none">
    <rect width="40" height="40" rx="10" fill="#3448C5"/>
    <path d="M28 23a5 5 0 0 0-4-8.9A7 7 0 0 0 10 18a4 4 0 0 0 1 8h17z" fill="white" opacity="0.9"/>
    <path d="M16 28l4-5 4 5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <line x1="20" y1="23" x2="20" y2="32" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
);

const NetlifyLogo = () => (
  <svg viewBox="0 0 40 40" width="36" height="36" fill="none">
    <rect width="40" height="40" rx="10" fill="#00AD9F"/>
    <path d="M15 25h10M15 20h10M15 15h10" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
    <path d="M25 12l5 8-5 8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <path d="M15 12l-5 8 5 8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </svg>
);

const TwilioLogo = () => (
  <svg viewBox="0 0 40 40" width="36" height="36" fill="none">
    <rect width="40" height="40" rx="10" fill="#F22F46"/>
    <circle cx="20" cy="20" r="10" stroke="white" strokeWidth="2.2" fill="none"/>
    <circle cx="16" cy="16" r="2.2" fill="white"/>
    <circle cx="24" cy="16" r="2.2" fill="white"/>
    <circle cx="16" cy="24" r="2.2" fill="white"/>
    <circle cx="24" cy="24" r="2.2" fill="white"/>
  </svg>
);

const GAnalyticsLogo = () => (
  <svg viewBox="0 0 40 40" width="36" height="36" fill="none">
    <rect width="40" height="40" rx="10" fill="#E37400"/>
    <rect x="10" y="24" width="5" height="8" rx="2.5" fill="white"/>
    <rect x="17.5" y="17" width="5" height="15" rx="2.5" fill="white" opacity="0.8"/>
    <rect x="25" y="10" width="5" height="22" rx="2.5" fill="white" opacity="0.6"/>
  </svg>
);

const SendGridLogo = () => (
  <svg viewBox="0 0 40 40" width="36" height="36" fill="none">
    <rect width="40" height="40" rx="10" fill="#1A82E2"/>
    <rect x="9" y="9" width="10" height="10" rx="2" fill="white"/>
    <rect x="21" y="9" width="10" height="10" rx="2" fill="white" opacity="0.5"/>
    <rect x="9" y="21" width="10" height="10" rx="2" fill="white" opacity="0.5"/>
    <rect x="21" y="21" width="10" height="10" rx="2" fill="white"/>
  </svg>
);

const MailchimpLogo = () => (
  <svg viewBox="0 0 40 40" width="36" height="36" fill="none">
    <rect width="40" height="40" rx="10" fill="#FFE01B"/>
    <path d="M20 10c-5 0-9 3.5-9 8 0 2.5 1.2 4.7 3 6.2l-.5 3.3 3.2-1.5c1 .3 2 .5 3.3.5 5 0 9-3.5 9-8s-4-8.5-9-8.5z" fill="#241C15"/>
    <circle cx="17" cy="18" r="1.2" fill="#FFE01B"/>
    <circle cx="23" cy="18" r="1.2" fill="#FFE01B"/>
    <path d="M17.5 22c.5.8 1.5 1.3 2.5 1.3s2-.5 2.5-1.3" stroke="#FFE01B" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
  </svg>
);

const GoogleMapsLogo = () => (
  <svg viewBox="0 0 40 40" width="36" height="36" fill="none">
    <rect width="40" height="40" rx="10" fill="#4285F4"/>
    <path d="M20 10a8 8 0 0 0-6.4 12.8L20 30l6.4-7.2A8 8 0 0 0 20 10z" fill="white"/>
    <circle cx="20" cy="18" r="3" fill="#4285F4"/>
  </svg>
);

const TailwindLogo = () => (
  <svg viewBox="0 0 40 40" width="36" height="36" fill="none">
    <rect width="40" height="40" rx="10" fill="#06B6D4"/>
    <path d="M20 13c-3.3 0-5.4 1.7-6.3 5 1.3-1.7 2.7-2.3 4.2-1.8.9.3 1.6 1 2.3 1.8 1.2 1.2 2.5 2.6 5.5 2.6 3.3 0 5.4-1.7 6.3-5-1.3 1.7-2.7 2.3-4.2 1.8-.9-.3-1.6-1-2.3-1.8-1.2-1.2-2.5-2.6-5.5-2.6zm-6.3 8.3c-3.3 0-5.4 1.7-6.3 5 1.3-1.7 2.7-2.3 4.2-1.8.9.3 1.6 1 2.3 1.8 1.2 1.2 2.5 2.6 5.5 2.6 3.3 0 5.4-1.7 6.3-5-1.3 1.7-2.7 2.3-4.2 1.8-.9-.3-1.6-1-2.3-1.8-1.2-1.2-2.5-2.6-5.5-2.6z" fill="white"/>
  </svg>
);

const PayFastLogo = () => (
  <svg viewBox="0 0 40 40" width="36" height="36" fill="none">
    <rect width="40" height="40" rx="10" fill="#0070BA"/>
    <path d="M8 20c0-6.6 5.4-12 12-12s12 5.4 12 12-5.4 12-12 12S8 26.6 8 20z" fill="#00B0F0" opacity="0.3"/>
    <path d="M13 16h8c2.2 0 4 1.8 4 4s-1.8 4-4 4h-4v4h-4V16z" fill="white"/>
    <rect x="13" y="19" width="7" height="2.5" rx="1.2" fill="#0070BA"/>
  </svg>
);

const AnthropicLogo = () => (
  <svg viewBox="0 0 40 40" width="36" height="36" fill="none">
    <rect width="40" height="40" rx="10" fill="#CC785C"/>
    <path d="M23.6 11h-3.6l7 18h3.6L23.6 11zM16.4 11H12.8l-3.8 10h3.5l.9-2.5h4.2l.9 2.5H22L16.4 11zm-2 5.2 1.3 3.5h-2.6l1.3-3.5z" fill="white"/>
  </svg>
);

// Export logos for use in other components
export { StripeLogo, OpenAILogo, FirebaseLogo, AnthropicLogo };

// ─── Integration Data ─────────────────────────────────────────────────────────

const INTEGRATIONS = [
  {
    id: 'stripe',
    name: 'Stripe',
    tagline: 'Accept payments online',
    description: 'Charge your customers online in minutes. Stripe handles credit cards, Apple Pay, and 135+ currencies — completely secure, no technical knowledge needed. Trusted by Amazon, Shopify, and millions more.',
    category: 'Payments',
    color: '#635BFF',
    bg: 'rgba(99,91,255,0.12)',
    hot: true,
    Logo: StripeLogo,
    npm: 'npm install @stripe/stripe-js',
    envKeys: ['VITE_STRIPE_PUBLISHABLE_KEY'],
    docsUrl: 'https://stripe.com/docs',
    signupUrl: 'https://dashboard.stripe.com/register',
    code: `import { loadStripe } from '@stripe/stripe-js'

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)

// Redirect to Stripe checkout
export async function checkout(priceId) {
  const stripe = await stripePromise
  await stripe.redirectToCheckout({
    lineItems: [{ price: priceId, quantity: 1 }],
    mode: 'payment',
    successUrl: window.location.origin + '/success',
    cancelUrl: window.location.origin + '/cancel',
  })
}`,
    steps: [
      '👉 Go to stripe.com and click "Start now" — sign up is free, no card needed',
      '🔑 Once inside, click "Developers" in the top menu, then "API keys"',
      '📋 Find the row labeled "Publishable key" and click the copy icon next to it',
      '📥 Paste that key into the field below and click "Save to project"',
      '🤖 Tell the AI: "Add a Stripe payment button" — it handles all the code for you!',
    ],
  },
  {
    id: 'vercel',
    name: 'Vercel',
    tagline: 'Deploy your site in seconds',
    description: 'Put your app online for free in about 60 seconds. Connect it to GitHub and your site updates automatically every time you make a change — no manual uploading ever again.',
    category: 'Deploy',
    color: 'var(--vscode-fg)',
    bg: 'rgba(255,255,255,0.07)',
    hot: true,
    Logo: VercelLogo,
    npm: 'npm install -g vercel',
    envKeys: ['VERCEL_TOKEN'],
    docsUrl: 'https://vercel.com/docs',
    signupUrl: 'https://vercel.com/signup',
    code: `# Deploy with Vercel CLI:
vercel --token $VERCEL_TOKEN --prod

# Or deploy programmatically:
import { vercel } from '@vercel/client'

const deployment = await vercel({
  token: import.meta.env.VERCEL_TOKEN,
  path: './dist',
})`,
    steps: [
      '👉 Go to vercel.com/account/tokens and sign up/login free',
      '🔑 Click "Create Token" and give it a name like "MyApp"',
      '📋 Copy the token that appears (starts with "vercel_...") and paste it above',
      '💾 Click "Save to project" and the AI will set up deployment for you',
      '🚀 The AI will create deployment scripts and configure everything automatically',
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    tagline: 'Add AI to your app',
    description: 'Give your app the same AI brain that powers ChatGPT. Write emails for users, answer questions, summarize text, translate — anything language-related. Your users will be amazed.',
    category: 'AI',
    color: '#10a37f',
    bg: 'rgba(16,163,127,0.12)',
    hot: true,
    Logo: OpenAILogo,
    npm: 'npm install openai',
    envKeys: ['OPENAI_API_KEY'],
    docsUrl: 'https://platform.openai.com/docs',
    signupUrl: 'https://platform.openai.com/signup',
    code: `import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: import.meta.env.OPENAI_API_KEY,
  dangerouslyAllowBrowser: true, // for frontend use
})

// Ask a question
export async function ask(question) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: question }],
  })
  return response.choices[0].message.content
}`,
    steps: [
      '👉 Go to platform.openai.com and create a free account',
      '🔑 Click your profile icon (top right) → "API keys" → "Create new secret key"',
      '📋 Give it a name like "My App" → click Create → copy the key that appears',
      '⚠️ Paste it below NOW — OpenAI only shows you this key once!',
      '🤖 Tell the AI what you want: "Add a chatbot" or "Summarise text with AI" — done!',
    ],
  },
  {
    id: 'firebase',
    name: 'Firebase',
    tagline: 'Database, auth & storage',
    description: "Google's free backend for your app. Save user data, let people sign in with Google, and store files — all without needing a server or any backend knowledge. Free tier is very generous.",
    category: 'Database',
    color: '#FF6D00',
    bg: 'rgba(255,109,0,0.12)',
    hot: false,
    Logo: FirebaseLogo,
    npm: 'npm install firebase',
    envKeys: ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID'],
    docsUrl: 'https://firebase.google.com/docs',
    signupUrl: 'https://console.firebase.google.com',
    code: `import { initializeApp } from 'firebase/app'
import { getFirestore, collection, addDoc } from 'firebase/firestore'
import { getAuth, signInWithPopup, GoogleAuthProvider } from 'firebase/auth'

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
})

export const db = getFirestore(app)
export const auth = getAuth(app)

// Save data
export const save = (table, data) => addDoc(collection(db, table), data)

// Sign in with Google
export const signIn = () => signInWithPopup(auth, new GoogleAuthProvider())`,
    steps: [
      '👉 Go to console.firebase.google.com and sign in with your Google account',
      '➕ Click "Add project", give it a name (e.g. "My App"), click through the steps',
      '🌐 On the left sidebar, click the </> icon to "Add Firebase to your web app"',
      '📋 You\'ll see a config block — copy the 3 values shown into the fields below',
      '🤖 Tell the AI "Add Google login" or "Save user data to Firebase" — it does the rest!',
    ],
  },
  {
    id: 'resend',
    name: 'Resend',
    tagline: 'Send emails from your app',
    description: 'Send automatic emails from your app — welcome messages, password resets, order confirmations. Resend makes sure your emails actually land in the inbox, not spam. Free for up to 3,000 emails/month.',
    category: 'Email',
    color: '#ff4444',
    bg: 'rgba(255,68,68,0.1)',
    hot: false,
    Logo: ResendLogo,
    npm: 'npm install resend',
    envKeys: ['RESEND_API_KEY'],
    docsUrl: 'https://resend.com/docs',
    signupUrl: 'https://resend.com/signup',
    code: `import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

// Send an email
export async function sendEmail({ to, subject, html }) {
  const data = await resend.emails.send({
    from: 'Your App <hello@yourdomain.com>',
    to,
    subject,
    html,
  })
  return data
}

// Example usage:
// sendEmail({
//   to: 'user@example.com',
//   subject: 'Welcome!',
//   html: '<h1>Thanks for signing up!</h1>'
// })`,
    steps: [
      '👉 Go to resend.com and sign up free — takes 30 seconds',
      '🔑 Click "API Keys" in the left menu → "Create API Key" → copy it',
      '📥 Paste the key in the field below and click "Save to project"',
      '📧 While testing, emails go to your own address for free — no domain needed yet',
      '🤖 Tell the AI "Send a welcome email when someone signs up" — it builds it for you!',
    ],
  },
  {
    id: 'cloudinary',
    name: 'Cloudinary',
    tagline: 'Upload & manage images',
    description: 'Let your users upload profile pictures, product photos, or videos straight into your app. Cloudinary stores everything safely in the cloud and makes images load fast. Free plan gives you 25GB of storage.',
    category: 'Media',
    color: '#3448C5',
    bg: 'rgba(52,72,197,0.12)',
    hot: false,
    Logo: CloudinaryLogo,
    npm: 'npm install cloudinary',
    envKeys: ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'],
    docsUrl: 'https://cloudinary.com/documentation',
    signupUrl: 'https://cloudinary.com/users/register_free',
    code: `import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

// Upload an image (returns the URL)
export async function uploadImage(filePath) {
  const result = await cloudinary.uploader.upload(filePath, {
    folder: 'my-app',
  })
  return result.secure_url
}`,
    steps: [
      '👉 Go to cloudinary.com and sign up free — no credit card needed',
      '🏠 After signing in, you land on your Dashboard — 3 values are shown right at the top',
      '📋 Copy "Cloud name", "API Key", and "API Secret" into the 3 fields below',
      '💾 Click "Save to project" — that\'s all the setup you need to do!',
      '🤖 Tell the AI "Let users upload a profile photo" and it builds the upload button for you',
    ],
  },
  {
    id: 'netlify',
    name: 'Netlify',
    tagline: 'Free hosting with one click',
    description: 'Get your app online by literally dragging a folder onto a webpage. No technical setup, no credit card, no complicated steps. Your site gets a free URL instantly and stays live forever on their free plan.',
    category: 'Deploy',
    color: '#00AD9F',
    bg: 'rgba(0,173,159,0.12)',
    hot: false,
    Logo: NetlifyLogo,
    npm: 'npm install -g netlify-cli',
    envKeys: ['NETLIFY_AUTH_TOKEN'],
    docsUrl: 'https://docs.netlify.com',
    signupUrl: 'https://app.netlify.com/signup',
    code: `# Deploy with Netlify CLI:
netlify deploy --prod --auth $NETLIFY_AUTH_TOKEN

# Or deploy programmatically:
import { NetlifyAPI } from 'netlify'

const client = new NetlifyAPI(import.meta.env.NETLIFY_AUTH_TOKEN)
const site = await client.createSiteDeploy({
  site_id: 'your-site-id',
  body: { /* files */ }
})`,
    steps: [
      '👉 Go to app.netlify.com/user/applications#personal-access-tokens and login',
      '🔑 Click "New access token", give it a name, and create it',
      '📋 Copy the token that appears and paste it above',
      '💾 Click "Save to project" and the AI will set up deployment',
      '🚀 The AI will create deployment scripts and can deploy your site automatically',
    ],
  },
  {
    id: 'twilio',
    name: 'Twilio',
    tagline: 'Send SMS text messages',
    description: 'Your app gets its own phone number and can text your users automatically — perfect for login codes, order updates, or reminders. Trial is free and includes $15 credit to get started.',
    category: 'SMS',
    color: '#F22F46',
    bg: 'rgba(242,47,70,0.12)',
    hot: false,
    Logo: TwilioLogo,
    npm: 'npm install twilio',
    envKeys: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER'],
    docsUrl: 'https://www.twilio.com/docs',
    signupUrl: 'https://www.twilio.com/try-twilio',
    code: `import Twilio from 'twilio'

const client = Twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

// Send a text message
export async function sendSMS(to, message) {
  return client.messages.create({
    body: message,
    from: process.env.TWILIO_PHONE_NUMBER,
    to,
  })
}

// Usage:
// sendSMS('+1234567890', 'Your code is: 4829')`,
    steps: [
      '👉 Go to twilio.com and sign up free — you get $15 credit automatically',
      '🏠 Once logged in, you\'re in the "Console" — you\'ll see Account SID and Auth Token right there',
      '📞 Click "Phone Numbers" → "Get a Number" → pick any number → click "Buy" (it\'s free with trial)',
      '📋 Paste the Account SID, Auth Token, and phone number into the 3 fields below',
      '🤖 Tell the AI "Send an SMS when a user signs up" and it wires everything up!',
    ],
  },
  {
    id: 'analytics',
    name: 'Google Analytics',
    tagline: 'See who visits your site',
    description: 'See exactly how many people visit your app, where they found it, which pages they love, and where they leave. Completely free from Google — essential knowledge for any founder growing their product.',
    category: 'Analytics',
    color: '#E37400',
    bg: 'rgba(227,116,0,0.12)',
    hot: false,
    Logo: GAnalyticsLogo,
    npm: null,
    envKeys: ['VITE_GA_MEASUREMENT_ID'],
    docsUrl: 'https://developers.google.com/analytics',
    signupUrl: 'https://analytics.google.com',
    code: `<!-- Add this to your index.html <head> section -->
<!-- Replace GA_MEASUREMENT_ID with your real ID -->

<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
<script>
  window.dataLayer = window.dataLayer || []
  function gtag(){ dataLayer.push(arguments) }
  gtag('js', new Date())
  gtag('config', 'GA_MEASUREMENT_ID')
</script>

<!-- Or in a React/Vite app, paste your Measurement ID below
     and add this to your main.jsx: -->

// gtag('config', import.meta.env.VITE_GA_MEASUREMENT_ID)`,
    steps: [
      '👉 Go to analytics.google.com and sign in with your normal Google account',
      '📊 Click "Start measuring", give your account a name, then add your website\'s URL',
      '🔢 Google gives you a "Measurement ID" — it looks like G-ABC123456',
      '📋 Copy that ID and paste it into the field below, then click Save',
      '🤖 Tell the AI "Add Google Analytics tracking" — within 24hrs you\'ll see live visitor data!',
    ],
  },
  {
    id: 'sendgrid',
    name: 'SendGrid',
    tagline: 'Reliable email delivery',
    description: 'Send automated emails to your users — 100 a day completely free, forever. Great for contact forms, password resets, and receipts. Twilio\'s email platform trusted by 80,000+ businesses worldwide.',
    category: 'Email',
    color: '#1A82E2',
    bg: 'rgba(26,130,226,0.12)',
    hot: false,
    Logo: SendGridLogo,
    npm: 'npm install @sendgrid/mail',
    envKeys: ['SENDGRID_API_KEY'],
    docsUrl: 'https://docs.sendgrid.com',
    signupUrl: 'https://signup.sendgrid.com',
    code: `import sgMail from '@sendgrid/mail'

sgMail.setApiKey(process.env.SENDGRID_API_KEY)

// Send an email
export async function sendEmail({ to, subject, text, html }) {
  return sgMail.send({
    to,
    from: 'your@email.com', // must be verified in SendGrid
    subject,
    text,
    html,
  })
}

// Usage:
// sendEmail({
//   to: 'customer@example.com',
//   subject: 'Order confirmed!',
//   html: '<p>Your order is on its way!</p>'
// })`,
    steps: [
      '👉 Go to sendgrid.com and click "Start for Free" — no credit card needed',
      '⚙️ Once logged in, go to Settings (left menu) → API Keys → "Create API Key"',
      '📋 Name it "My App", choose "Full Access", click Create — copy the key shown',
      '⚠️ Paste it below NOW — SendGrid only shows you this key once!',
      '✉️ Also go to Settings → Sender Authentication and verify the email you\'ll send from',
    ],
  },
  {
    id: 'mailchimp',
    name: 'Mailchimp',
    tagline: 'Build an email newsletter',
    description: 'Build your email list and keep customers coming back with beautiful newsletters. Mailchimp\'s drag-and-drop campaign builder needs zero coding. Free for up to 500 contacts — perfect to start.',
    category: 'Marketing',
    color: '#F2C31A',
    bg: 'rgba(242,195,26,0.12)',
    hot: false,
    Logo: MailchimpLogo,
    npm: 'npm install @mailchimp/mailchimp_marketing',
    envKeys: ['MAILCHIMP_API_KEY', 'MAILCHIMP_LIST_ID'],
    docsUrl: 'https://mailchimp.com/developer',
    signupUrl: 'https://login.mailchimp.com/signup',
    code: `import mailchimp from '@mailchimp/mailchimp_marketing'

mailchimp.setConfig({
  apiKey: process.env.MAILCHIMP_API_KEY,
  server: 'us1', // replace with your server prefix
})

// Subscribe someone to your list
export async function subscribe(email) {
  return mailchimp.lists.addListMember(
    process.env.MAILCHIMP_LIST_ID,
    {
      email_address: email,
      status: 'subscribed',
    }
  )
}

// Usage:
// subscribe('visitor@example.com')`,
    steps: [
      '👉 Go to mailchimp.com and create your free account',
      '🔑 Click your name (bottom-left) → Account & billing → Extras → API Keys → "Create A Key"',
      '👥 Find your Audience ID: click Audience → All contacts → Settings → scroll to "Audience ID"',
      '📋 Paste both the API Key and Audience ID into the fields below',
      '🤖 Tell the AI "Add an email newsletter signup form" — visitors can subscribe with one click!',
    ],
  },
  {
    id: 'googlemaps',
    name: 'Google Maps',
    tagline: 'Add maps to your app',
    description: 'Add a real, interactive Google Map to any page of your app. Let users find your location, browse nearby spots, or drop a pin on their address. Free for up to 28,000 map views per month.',
    category: 'Maps',
    color: '#4285F4',
    bg: 'rgba(66,133,244,0.12)',
    hot: false,
    Logo: GoogleMapsLogo,
    npm: 'npm install @googlemaps/js-api-loader',
    envKeys: ['VITE_GOOGLE_MAPS_API_KEY'],
    docsUrl: 'https://developers.google.com/maps',
    signupUrl: 'https://console.cloud.google.com',
    code: `import { Loader } from '@googlemaps/js-api-loader'

const loader = new Loader({
  apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  version: 'weekly',
})

// Show a map in a div
export async function showMap(elementId, lat, lng) {
  await loader.load()
  const map = new google.maps.Map(document.getElementById(elementId), {
    center: { lat, lng },
    zoom: 14,
  })
  // Add a marker
  new google.maps.Marker({ position: { lat, lng }, map })
  return map
}

// Usage:
// showMap('map-container', 40.7128, -74.0060)`,
    steps: [
      '👉 Go to console.cloud.google.com and sign in with your Google account',
      '➕ Click "Create Project", give it a name, then click "Enable APIs & Services"',
      '🔍 Search for "Maps JavaScript API" in the search box and click Enable',
      '🔑 Go to Credentials → "Create Credentials" → "API Key" — copy the key shown',
      '🤖 Paste it below, then tell the AI "Add a map showing [your location]" — it does the rest!',
    ],
  },
  {
    id: 'payfast',
    name: 'PayFast',
    tagline: 'Accept payments in South Africa',
    description: "The go-to payment gateway for South African businesses. Customers can pay with credit card, instant EFT, SnapScan, Mobicred and more. Used by 60,000+ SA businesses with fast local payouts in ZAR.",
    category: 'Payments',
    color: '#0070BA',
    bg: 'rgba(0,112,186,0.12)',
    hot: false,
    Logo: PayFastLogo,
    npm: 'npm install payfast-node',
    envKeys: ['PAYFAST_MERCHANT_ID', 'PAYFAST_MERCHANT_KEY', 'PAYFAST_PASSPHRASE'],
    docsUrl: 'https://developers.payfast.co.za',
    signupUrl: 'https://www.payfast.co.za/registration',
    code: `import crypto from 'crypto'

// Build a PayFast payment form
export function buildPayFastForm({ amount, itemName, returnUrl, cancelUrl, notifyUrl }) {
  const data = {
    merchant_id: process.env.PAYFAST_MERCHANT_ID,
    merchant_key: process.env.PAYFAST_MERCHANT_KEY,
    return_url: returnUrl,
    cancel_url: cancelUrl,
    notify_url: notifyUrl,
    amount: parseFloat(amount).toFixed(2),
    item_name: itemName,
  }

  // Generate signature
  const str = Object.entries(data)
    .map(([k, v]) => \`\${k}=\${encodeURIComponent(v).replace(/%20/g, '+')}\`)
    .join('&') + \`&passphrase=\${encodeURIComponent(process.env.PAYFAST_PASSPHRASE)}\`

  data.signature = crypto.createHash('md5').update(str).digest('hex')
  return data
}

// Usage: POST the returned object to https://www.payfast.co.za/eng/process`,
    steps: [
      '👉 Go to payfast.co.za and click "Register" — choose the Merchant account type',
      '🪪 Complete identity verification with your ID number and bank account details (required by law)',
      '🏠 Once approved, log in to your Dashboard → Settings to find your Merchant ID and Merchant Key',
      '🔐 Go to Settings → Security and set a secret Passphrase (like a strong password — write it down!)',
      '📋 Paste all 3 values below, then tell the AI "Add a PayFast checkout button" — done!',
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    tagline: 'Claude AI for your app',
    description: 'Add Claude — widely regarded as the best AI for writing, thinking, and analysis — directly into your app. Perfect for customer support bots, content generation, or any feature that needs smart AI responses.',
    category: 'AI',
    color: '#CC785C',
    bg: 'rgba(204,120,92,0.12)',
    hot: true,
    Logo: AnthropicLogo,
    npm: 'npm install @anthropic-ai/sdk',
    envKeys: ['ANTHROPIC_API_KEY'],
    docsUrl: 'https://docs.anthropic.com',
    signupUrl: 'https://console.anthropic.com',
    code: `import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Ask Claude a question
export async function askClaude(prompt) {
  const message = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })
  return message.content[0].text
}

// Usage:
// const reply = await askClaude('Explain this code: ' + myCode)
// console.log(reply)`,
    steps: [
      '👉 Go to console.anthropic.com and create a free account',
      '🔑 Click "API Keys" in the left sidebar → "Create Key" → name it "My App"',
      '📋 Copy the key that appears — it starts with sk-ant-',
      '⚠️ Paste it below NOW — you only get to see this key once!',
      '🤖 Tell the AI "Add a Claude-powered chat assistant" or "Summarise content with AI" — it builds it!',
    ],
  },
];


// ─── Component ────────────────────────────────────────────────────────────────

function IntegrationsPanel({ workspaceFolder, onClose, onSendToAI }) {
  const [selected, setSelected] = useState(null);
  const [apiInputs, setApiInputs] = useState({});
  const [copied, setCopied] = useState('');
  const [savedEnv, setSavedEnv] = useState({});
  const [savedCode, setSavedCode] = useState({});
  const [savedIntegrations, setSavedIntegrations] = useState([]);

  // Load saved credentials on mount
  useEffect(() => {
    loadSavedCredentials();
  }, []);

  // Load credentials when an integration is selected
  useEffect(() => {
    if (selected) {
      loadIntegrationCredentials(selected);
    }
  }, [selected]);

  const loadSavedCredentials = async () => {
    try {
      const saved = await IntegrationCredentialsService.getSavedIntegrations();
      setSavedIntegrations(saved);
    } catch (error) {
      console.error('Failed to load saved integrations:', error);
    }
  };

  const loadIntegrationCredentials = async (integration) => {
    try {
      const credentials = await IntegrationCredentialsService.getCredentials(integration.id);
      if (credentials) {
        const newInputs = {};
        integration.envKeys?.forEach(key => {
          if (credentials[key]) {
            newInputs[`${integration.id}_${key}`] = credentials[key];
          }
        });
        setApiInputs(prev => ({ ...prev, ...newInputs }));
      }
    } catch (error) {
      console.error('Failed to load integration credentials:', error);
    }
  };

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(''), 2000);
  };

  const handleSaveEnv = async (integration) => {
    if (!workspaceFolder || !integration.envKeys) return;
    
    // Prepare credentials object for database
    const credentials = {};
    integration.envKeys.forEach(k => {
      credentials[k] = apiInputs[`${integration.id}_${k}`] || '';
    });

    // Save to database
    try {
      await IntegrationCredentialsService.saveCredentials(integration.id, credentials);
      await loadSavedCredentials(); // Refresh saved integrations list
    } catch (error) {
      console.error('Failed to save credentials to database:', error);
    }

    // Save to .env file
    const lines = integration.envKeys
      .map(k => `${k}=${apiInputs[`${integration.id}_${k}`] || ''}`)
      .join('\n');
    try {
      const existing = await window.electronAPI.fs.readFile(`${workspaceFolder}/.env`);
      const content = existing.success
        ? existing.content.trim() + '\n\n# ' + integration.name + '\n' + lines
        : '# ' + integration.name + '\n' + lines;
      await window.electronAPI.fs.writeFile(`${workspaceFolder}/.env`, content + '\n');
    } catch {
      await window.electronAPI.fs.writeFile(`${workspaceFolder}/.env`, '# ' + integration.name + '\n' + lines + '\n');
    }
    setSavedEnv(prev => ({ ...prev, [integration.id]: true }));
    setTimeout(() => setSavedEnv(prev => ({ ...prev, [integration.id]: false })), 3000);
    
    // Send AI prompt to set up the integration
    if (onSendToAI) {
      const keysList = integration.envKeys.map(k => k.replace(/_/g, ' ')).join(', ');
      const prompt = `I've just saved my ${integration.name} credentials to the .env file (${keysList}). Please integrate ${integration.name} into my project now. ${integration.description}

Install the required packages, set up the configuration using the credentials from .env, and implement the integration properly with error handling. Make it ready to use in the app.`;
      onSendToAI(prompt);
    }
  };

  const handleSaveCode = async (integration) => {
    if (!workspaceFolder) return;
    const path = `${workspaceFolder}/src/${integration.id}.js`;
    try {
      await window.electronAPI.fs.writeFile(path, integration.code);
    } catch { /* ignore */ }
    setSavedCode(prev => ({ ...prev, [integration.id]: true }));
    setTimeout(() => setSavedCode(prev => ({ ...prev, [integration.id]: false })), 3000);
  };

  const stripEmoji = s => s.replace(/^[^a-zA-Z("']+/, '').trim();
  const renderStepText = (text) => {
    const urlRegex = /(https?:\/\/[^\s]+|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?)/g;
    const parts = text.split(urlRegex);
    return parts.map((part, i) => {
      if (urlRegex.test(part)) {
        urlRegex.lastIndex = 0;
        const href = part.startsWith('http') ? part : `https://${part}`;
        return (
          <a key={i} className="itp-step-link" href={href}
            onClick={e => { e.preventDefault(); window.electronAPI.shell.openExternal(href); }}>
            {part}
          </a>
        );
      }
      urlRegex.lastIndex = 0;
      return part;
    });
  };
  // ── Grid view ──────────────────────────────────────────────────────────────
  if (!selected) {
    return (
      <div className="itp-root">
        <button className="itp-close" onClick={onClose}><FiX size={16} /></button>

        <div className="itp-header">
          <h1 className="itp-title">Integrations</h1>
          <p className="itp-subtitle">Add powerful features to your app in minutes — no experience needed</p>
        </div>

        <div className="itp-grid">
          {INTEGRATIONS.map(integration => {
            const { Logo } = integration;
            return (
              <div
                key={integration.id}
                className="itp-card"
                onClick={() => setSelected(integration)}
              >
                {integration.hot && <span className="itp-hot-badge">⚡ Popular</span>}
                {savedIntegrations.includes(integration.id) && (
                  <span className="itp-saved-badge" title="Credentials saved">
                    <FiCheck size={12} /> Saved
                  </span>
                )}
                <div className="itp-card-logo-wrap">
                  <Logo />
                </div>
                <div className="itp-card-name">{integration.name}</div>
                <div className="itp-card-tagline">{integration.tagline}</div>
                <div className="itp-card-add">Add to project →</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Detail view ────────────────────────────────────────────────────────────
  const { Logo } = selected;
  return (
    <div className="itp-root itp-root--detail">
      <button className="itp-close" onClick={onClose}><FiX size={16} /></button>

      <div className="itp-detail-topbar">
        <button className="itp-back" onClick={() => setSelected(null)}>
          <FiArrowLeft size={13} /> All Integrations
        </button>
      </div>

      <div className="itp-detail-hero">
        <div className="itp-detail-logo" style={{ background: selected.bg, borderColor: selected.color + '44' }}>
          <Logo />
        </div>
        <div className="itp-detail-hero-text">
          <div className="itp-detail-hero-row">
            <h2 className="itp-detail-name">{selected.name}</h2>
            {selected.hot && <span className="itp-hot-badge">⚡ Popular</span>}
          </div>
          <p className="itp-detail-desc">{selected.description}</p>
        </div>
      </div>

      <div className="itp-detail-body">

        {/* Left column */}
        <div className="itp-detail-left">

          <div className="itp-section">
            <h3 className="itp-section-title">How to set up</h3>
            <div className="itp-steps">
              {selected.steps.map((step, i) => (
                <div key={i} className="itp-step-row">
                  <span className="itp-step-num" style={{ background: selected.bg, color: selected.color, borderColor: selected.color + '44' }}>{i + 1}</span>
                  <span className="itp-step-text">{renderStepText(stripEmoji(step))}</span>
                </div>
              ))}
            </div>
          </div>

          {selected.envKeys && (
            <div className="itp-section">
              <h3 className="itp-section-title">Your API Keys</h3>
              {savedIntegrations.includes(selected.id) ? (
                <p className="itp-section-hint" style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FiCheck size={14} /> Credentials saved — loaded automatically
                </p>
              ) : (
                <p className="itp-section-hint">Saved securely to your account and reused across projects</p>
              )}
              {selected.envKeys.map(k => (
                <div key={k} className="itp-env-field">
                  <label>{k.replace(/_/g, ' ')}</label>
                  <input
                    type="password"
                    placeholder={`Paste your ${k.split('_').pop().toLowerCase()} here`}
                    value={apiInputs[`${selected.id}_${k}`] || ''}
                    onChange={e => setApiInputs(prev => ({ ...prev, [`${selected.id}_${k}`]: e.target.value }))}
                    spellCheck={false}
                    autoComplete="off"
                  />
                </div>
              ))}
              <button
                className="itp-save-env-btn"
                style={{ '--btn-color': selected.color, '--btn-bg': selected.bg }}
                onClick={() => handleSaveEnv(selected)}
                disabled={!workspaceFolder}
              >
                {savedEnv[selected.id]
                  ? <><FiCheck size={13} /> Saved to project!</>
                  : <><FiSave size={13} /> Save to project</>}
              </button>
              {!workspaceFolder && (
                <p className="itp-warn"><FiAlertCircle size={12} /> Always check whether the folder is opened</p>
              )}
            </div>
          )}

          <div className="itp-link-row">
            <a
              className="itp-link-primary"
              href={selected.signupUrl}
              onClick={e => { e.preventDefault(); window.electronAPI.shell.openExternal(selected.signupUrl); }}
            >
              <FiExternalLink size={13} /> Get started free
            </a>
            <a
              className="itp-link-ghost"
              href={selected.docsUrl}
              onClick={e => { e.preventDefault(); window.electronAPI.shell.openExternal(selected.docsUrl); }}
            >
              <FiExternalLink size={13} /> View docs
            </a>
          </div>
        </div>

      </div>
    </div>
  );
}

export default IntegrationsPanel;
