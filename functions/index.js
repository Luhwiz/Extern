const { onRequest } = require("firebase-functions/v2/https");
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Load environment variables for local development
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: '.env.local' });
}

// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp();
}

const app = express();

// Security and middleware
app.use(helmet());
app.use(cors({ origin: true }));
app.use(express.json());

// Request logging (Cloud Functions automatically logs console.log)
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
});

// Rate limiting middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});

// Apply rate limiting to all API routes
app.use('/api/', limiter);

// Import routes
const claudeRoutes = require('./routes/claude');
const paymentRoutes = require('./routes/payment');
const openaiRoutes = require('./routes/openai');

// Apply routes
app.use('/api/claude', claudeRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/openai', openaiRoutes);
app.use('/api/generated-app', require('./routes/generatedAppAi'));

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Export the app as a Cloud Function
exports.api = onRequest({
    memory: "512MiB",
    timeoutSeconds: 300, // Important for long AI responses
    region: "us-central1", // You can change this to your preferred region
    secrets: ["ANTHROPIC_API_KEY", "OPENAI_API_KEY"] // Add secrets here
}, app);

// Import and export publish functions
const { serveApp, publishApp, getMyApps, unpublishApp } = require('./publish');
exports.serveApp = serveApp;
exports.publishApp = publishApp;
exports.getMyApps = getMyApps;
exports.unpublishApp = unpublishApp;