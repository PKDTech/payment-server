const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { initializeFirebase } = require('./firebase');

// Initialize Express app
const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://testmyapp.rf.gd'] 
    : ['http://localhost:3000', 'http://localhost:7700'],
  credentials: true
}));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all API routes
app.use('/api/', apiLimiter);

// Import route modules
const orderRoutes = require('./routes/orders');
const paymentRoutes = require('./routes/payments');
const walletRoutes = require('./routes/wallet');

// Mount routes
app.use('/api/order', orderRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/wallet', walletRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'tournament-payment-server',
    version: '1.0.0'
  });
});

// 404 handler for undefined routes (but returns proper response, not 404 for valid endpoints)
app.use('*', (req, res) => {
  // Check if the path matches any valid API pattern
  const validPaths = [
    '/api/order/create',
    '/api/order/:orderId',
    '/api/order/cancel',
    '/api/order/expire',
    '/api/payment/verify',
    '/api/payment/recheck',
    '/api/wallet/:userId',
    '/api/health'
  ];
  
  const path = req.originalUrl;
  const isApiPath = path.startsWith('/api/');
  
  if (isApiPath) {
    return res.status(400).json({
      success: false,
      error: 'BAD_REQUEST',
      message: 'Invalid API endpoint. Please check the endpoint URL.',
      timestamp: new Date().toISOString(),
      availableEndpoints: validPaths
    });
  }
  
  // For non-API paths, return a simple message
  res.status(200).json({
    message: 'Tournament Payment Server is running',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(statusCode).json({
    success: false,
    error: 'SERVER_ERROR',
    message: process.env.NODE_ENV === 'production' 
      ? 'An internal server error occurred' 
      : message,
    timestamp: new Date().toISOString()
  });
});

// Server configuration
const PORT = process.env.PORT || 3000;

// Initialize Firebase and start server
initializeFirebase().then(() => {
  if (require.main === module) {
    // Only start HTTP server if not running on Vercel
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📡 Health check: http://localhost:${PORT}/api/health`);
    });
  }
}).catch((error) => {
  console.error('Failed to initialize Firebase:', error);
  process.exit(1);
});

// Export for Vercel serverless
module.exports = app;
