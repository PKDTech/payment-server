/**
 * Configuration constants and limits for the tournament payment server
 * All values are in INR (Indian Rupees) unless specified otherwise
 */

const config = {
  // Application Information
  APP_NAME: 'Payment Server',
  APP_VERSION: '1.0.0',
  APP_ENV: process.env.NODE_ENV || 'development',
  
  // Server Configuration
  SERVER_PORT: process.env.PORT || 3000,
  SERVER_TIMEOUT: 30000, // 30 seconds
  SERVER_MAX_BODY_SIZE: '10mb',
  
  // Payment Configuration
  CURRENCY: 'INR',
  CURRENCY_SYMBOL: '₹',
  
  // Amount Limits (in INR)
  MIN_AMOUNT: 10, // Minimum ₹10
  MAX_AMOUNT: 10000, // Maximum ₹10,000
  DEFAULT_AMOUNT: 100,
  
  // Order Configuration
  ORDER_EXPIRY_MINUTES: 5, // Orders expire after 5 minutes
  ORDER_LOCK_TIMEOUT: 30000, // 30 seconds lock for order operations
  ORDER_CLEANUP_INTERVAL: 60000, // 1 minute
  
  // Payment Verification
  PAYMENT_VERIFICATION_TIMEOUT: 45000, // 45 seconds for payment verification lock
  PAYMENT_RETRY_ATTEMPTS: 3,
  PAYMENT_RETRY_DELAY: 2000, // 2 seconds between retries
  
  // UPI Configuration
  UPI_ID_PATTERN: /^[a-zA-Z0-9.\-_]+@[a-zA-Z0-9]+$/,
  UPI_MIN_LENGTH: 3,
  UPI_MAX_LENGTH: 50,
  
  // Wallet Configuration
  WALLET_MIN_BALANCE: 0,
  WALLET_MAX_BALANCE: 50000, // Maximum wallet balance ₹50,000
  WALLET_TRANSACTION_LIMIT: 10000, // Maximum single transaction ₹10,000
  WALLET_DAILY_LIMIT: 50000, // Daily limit ₹50,000
  
  // User Configuration
  USER_ID_MIN_LENGTH: 3,
  USER_ID_MAX_LENGTH: 50,
  USER_PHONE_PATTERN: /^[6-9]\d{9}$/, // Indian mobile numbers
  
  // Security Configuration
  API_RATE_LIMIT_WINDOW: 15 * 60 * 1000, // 15 minutes
  API_RATE_LIMIT_MAX_REQUESTS: 100, // 100 requests per window
  JWT_SECRET: process.env.JWT_SECRET || 'tournament-payment-server-secret-key-2026',
  JWT_EXPIRY: '24h',
  
  // Firebase Configuration
  FIREBASE_DATABASE_URL: 'https://pkdtech-1-default-rtdb.firebaseio.com',
  FIREBASE_TIMEOUT: 10000, // 10 seconds
  FIREBASE_MAX_RETRIES: 3,
  
  // Cache Configuration
  CACHE_TTL: 5 * 60 * 1000, // 5 minutes
  CACHE_MAX_SIZE: 1000,
  
  // Logging Configuration
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  LOG_FILE: process.env.LOG_FILE || 'server.log',
  LOG_MAX_SIZE: '10m',
  LOG_MAX_FILES: 5,
  
  // Cron Job Configuration
  CRON_SECRET: process.env.CRON_SECRET || 'cron-secret-key-2026',
  CRON_EXPIRE_ORDERS: '*/5 * * * *', // Every 5 minutes
  CRON_CLEANUP_LOCKS: '*/15 * * * *', // Every 15 minutes
  CRON_CLEANUP_IDEMPOTENCY: '0 */1 * * *', // Every hour
  
  // API Response Configuration
  API_SUCCESS_CODE: 200,
  API_CREATED_CODE: 201,
  API_ERROR_CODE: 400,
  API_UNAUTHORIZED_CODE: 401,
  API_FORBIDDEN_CODE: 403,
  API_NOT_FOUND_CODE: 404,
  API_CONFLICT_CODE: 409,
  API_SERVER_ERROR_CODE: 500,
  
  // Error Messages
  ERROR_MESSAGES: {
    VALIDATION_ERROR: 'Request validation failed',
    ORDER_NOT_FOUND: 'Payment order not found',
    ORDER_EXPIRED: 'Payment order has expired',
    ORDER_CANCELLED: 'Payment order has been cancelled',
    ORDER_INVALID_STATUS: 'Order is in an invalid state for this operation',
    AMOUNT_MISMATCH: 'Payment amount does not match order amount',
    UPI_MISMATCH: 'Payment UPI ID does not match expected UPI ID',
    WALLET_CREDIT_ERROR: 'Failed to credit wallet',
    INSUFFICIENT_BALANCE: 'Insufficient wallet balance',
    DUPLICATE_TRANSACTION: 'Duplicate transaction detected',
    RATE_LIMIT_EXCEEDED: 'Rate limit exceeded',
    SERVER_ERROR: 'Internal server error',
    UNAUTHORIZED: 'Unauthorized access',
    FORBIDDEN: 'Access forbidden'
  },
  
  // Success Messages
  SUCCESS_MESSAGES: {
    ORDER_CREATED: 'Payment order created successfully',
    ORDER_CANCELLED: 'Order cancelled successfully',
    PAYMENT_VERIFIED: 'Payment verified successfully',
    WALLET_CREDITED: 'Wallet credited successfully',
    WALLET_UPDATED: 'Wallet updated successfully'
  },
  
  // Status Codes
  STATUS: {
    PENDING: 'PENDING',
    SUCCESS: 'SUCCESS',
    FAILED: 'FAILED',
    CANCELLED: 'CANCELLED',
    EXPIRED: 'EXPIRED',
    REFUNDED: 'REFUNDED',
    PROCESSING: 'PROCESSING'
  },
  
  // Transaction Types
  TRANSACTION_TYPES: {
    CREDIT: 'CREDIT',
    DEBIT: 'DEBIT',
    REFUND: 'REFUND',
    BONUS: 'BONUS',
    PENALTY: 'PENALTY'
  },
  
  // Payment Methods
  PAYMENT_METHODS: {
    UPI: 'UPI',
    WALLET: 'WALLET',
    CASH: 'CASH',
    BANK_TRANSFER: 'BANK_TRANSFER'
  },
  
  // Feature Flags
  FEATURES: {
    ENABLE_UPI_PAYMENTS: true,
    ENABLE_WALLET_TRANSFERS: false, // Future feature
    ENABLE_REFUNDS: false, // Future feature
    ENABLE_MULTIPLE_UPI_IDS: false, // Future feature
    ENABLE_PAYMENT_WEBHOOKS: false, // Future feature
    ENABLE_SMS_NOTIFICATIONS: false, // Future feature
    ENABLE_EMAIL_NOTIFICATIONS: false // Future feature
  },
  
  // Notification Configuration
  NOTIFICATION: {
    SMS_PROVIDER: 'TWILIO', // Future implementation
    EMAIL_PROVIDER: 'SENDGRID', // Future implementation
    PUSH_PROVIDER: 'FCM' // Future implementation
  },
  
  // Audit Configuration
  AUDIT_LOG_RETENTION_DAYS: 90,
  AUDIT_ENABLED: true,
  
  // Monitoring Configuration
  METRICS_ENABLED: true,
  METRICS_PORT: 9090,
  
  // Health Check Configuration
  HEALTH_CHECK_INTERVAL: 30000, // 30 seconds
  HEALTH_CHECK_TIMEOUT: 5000, // 5 seconds
  
  // Development Configuration
  DEVELOPMENT: {
    ENABLE_MOCK_PAYMENTS: process.env.NODE_ENV === 'development',
    MOCK_PAYMENT_SUCCESS_RATE: 0.95, // 95% success rate for mock payments
    SKIP_UPI_VERIFICATION: process.env.NODE_ENV === 'development',
    LOG_RAW_REQUESTS: process.env.NODE_ENV === 'development'
  }
};

// Environment-specific overrides
if (config.APP_ENV === 'production') {
  config.MIN_AMOUNT = 50; // Higher minimum in production
  config.ORDER_EXPIRY_MINUTES = 10; // Longer expiry in production
  config.API_RATE_LIMIT_MAX_REQUESTS = 50; // Stricter rate limiting
  config.DEVELOPMENT.ENABLE_MOCK_PAYMENTS = false;
  config.DEVELOPMENT.SKIP_UPI_VERIFICATION = false;
}

if (config.APP_ENV === 'staging') {
  config.MIN_AMOUNT = 1; // Lower minimum for testing
  config.MAX_AMOUNT = 1000; // Lower maximum for testing
  config.ORDER_EXPIRY_MINUTES = 2; // Shorter expiry for testing
}

// Validation functions
config.validateAmount = function(amount) {
  const amountNum = parseFloat(amount);
  return !isNaN(amountNum) && 
         amountNum >= this.MIN_AMOUNT && 
         amountNum <= this.MAX_AMOUNT;
};

config.validateUserId = function(userId) {
  return typeof userId === 'string' && 
         userId.length >= this.USER_ID_MIN_LENGTH && 
         userId.length <= this.USER_ID_MAX_LENGTH;
};

config.validatePhone = function(phone) {
  return typeof phone === 'string' && 
         this.USER_PHONE_PATTERN.test(phone);
};

config.validateUPIId = function(upiId) {
  return typeof upiId === 'string' && 
         upiId.length >= this.UPI_MIN_LENGTH && 
         upiId.length <= this.UPI_MAX_LENGTH && 
         this.UPI_ID_PATTERN.test(upiId);
};

config.getAmountRange = function() {
  return {
    min: this.MIN_AMOUNT,
    max: this.MAX_AMOUNT,
    currency: this.CURRENCY,
    symbol: this.CURRENCY_SYMBOL
  };
};

config.getOrderExpiryInfo = function() {
  return {
    minutes: this.ORDER_EXPIRY_MINUTES,
    milliseconds: this.ORDER_EXPIRY_MINUTES * 60 * 1000,
    description: `${this.ORDER_EXPIRY_MINUTES} minutes`
  };
};

// Export configuration
module.exports = config;
