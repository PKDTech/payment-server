/**
 * Utility functions for time, date, and expiry calculations
 * All time operations use server time to prevent client manipulation
 */

const ORDER_ID_PREFIX = 'TRN';
const ORDER_ID_DATE_FORMAT = 'YYYYMMDD';

/**
 * Generate a unique order ID with timestamp
 * Format: TRN-YYYYMMDD-XXXXXX (where XXXXXX is random alphanumeric)
 * @returns {string} Unique order ID
 */
function generateOrderId() {
  const now = new Date();
  const datePart = now.getFullYear().toString() + 
    String(now.getMonth() + 1).padStart(2, '0') + 
    String(now.getDate()).padStart(2, '0');
  
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
  
  return `${ORDER_ID_PREFIX}-${datePart}-${randomPart}`;
}

/**
 * Get current server timestamp in milliseconds
 * @returns {number} Current timestamp
 */
function getCurrentTimestamp() {
  return Date.now();
}

/**
 * Get current server time in ISO format
 * @returns {string} ISO timestamp
 */
function getCurrentISOTimestamp() {
  return new Date().toISOString();
}

/**
 * Format timestamp to human-readable date
 * @param {number} timestamp - Timestamp in milliseconds
 * @param {string} format - Output format (default: 'YYYY-MM-DD HH:mm:ss')
 * @returns {string} Formatted date string
 */
function formatTimestamp(timestamp, format = 'YYYY-MM-DD HH:mm:ss') {
  const date = new Date(timestamp);
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
}

/**
 * Calculate expiry time from creation timestamp
 * @param {number} createdAt - Creation timestamp
 * @param {number} expiryMinutes - Expiry time in minutes
 * @returns {number} Expiry timestamp
 */
function calculateExpiryTime(createdAt, expiryMinutes) {
  return createdAt + (expiryMinutes * 60 * 1000);
}

/**
 * Check if a timestamp has expired
 * @param {number} createdAt - Creation timestamp
 * @param {number} expiryMinutes - Expiry time in minutes
 * @returns {boolean} True if expired
 */
function checkExpiry(createdAt, expiryMinutes) {
  const currentTime = getCurrentTimestamp();
  const expiryTime = calculateExpiryTime(createdAt, expiryMinutes);
  return currentTime > expiryTime;
}

/**
 * Calculate remaining time until expiry
 * @param {number} createdAt - Creation timestamp
 * @param {number} expiryMinutes - Expiry time in minutes
 * @returns {Object} Remaining time in different units
 */
function getRemainingTime(createdAt, expiryMinutes) {
  const currentTime = getCurrentTimestamp();
  const expiryTime = calculateExpiryTime(createdAt, expiryMinutes);
  const remainingMs = Math.max(0, expiryTime - currentTime);
  
  const seconds = Math.floor((remainingMs / 1000) % 60);
  const minutes = Math.floor((remainingMs / (1000 * 60)) % 60);
  const hours = Math.floor((remainingMs / (1000 * 60 * 60)) % 24);
  
  return {
    totalMs: remainingMs,
    seconds,
    minutes,
    hours,
    formatted: `${hours}h ${minutes}m ${seconds}s`,
    isExpired: remainingMs === 0,
    expiryTime: expiryTime
  };
}

/**
 * Validate timestamp is within acceptable range (not in future, not too old)
 * @param {number} timestamp - Timestamp to validate
 * @param {number} maxAgeHours - Maximum age in hours (default: 24)
 * @returns {Object} Validation result
 */
function validateTimestamp(timestamp, maxAgeHours = 24) {
  const currentTime = getCurrentTimestamp();
  const timestampDate = new Date(timestamp);
  const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
  
  const isFuture = timestamp > currentTime;
  const isTooOld = currentTime - timestamp > maxAgeMs;
  const isValid = !isFuture && !isTooOld;
  
  return {
    isValid,
    isFuture,
    isTooOld,
    ageMs: currentTime - timestamp,
    maxAgeMs,
    timestamp: timestamp,
    currentTime
  };
}

/**
 * Generate a time-based unique identifier
 * @param {string} prefix - Identifier prefix
 * @returns {string} Time-based unique ID
 */
function generateTimeBasedId(prefix = 'ID') {
  const now = new Date();
  const timestamp = now.getTime();
  const random = Math.random().toString(36).substring(2, 10);
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Sleep/delay function
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} Promise that resolves after delay
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Debounce function to limit frequent calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function to limit call frequency
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} Throttled function
 */
function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Parse duration string to milliseconds
 * @param {string} duration - Duration string (e.g., "5m", "2h", "1d")
 * @returns {number} Duration in milliseconds
 */
function parseDuration(duration) {
  const regex = /^(\d+)([smhd])$/;
  const match = duration.match(regex);
  
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}. Use format like "5m", "2h", "1d"`);
  }
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: throw new Error(`Unknown time unit: ${unit}`);
  }
}

/**
 * Get start and end of day for a timestamp
 * @param {number} timestamp - Timestamp
 * @returns {Object} Start and end of day timestamps
 */
function getDayBoundaries(timestamp) {
  const date = new Date(timestamp);
  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const endOfDay = startOfDay + (24 * 60 * 60 * 1000) - 1;
  
  return {
    startOfDay,
    endOfDay,
    date: date.toISOString().split('T')[0]
  };
}

/**
 * Get start and end of month for a timestamp
 * @param {number} timestamp - Timestamp
 * @returns {Object} Start and end of month timestamps
 */
function getMonthBoundaries(timestamp) {
  const date = new Date(timestamp);
  const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
  const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
  
  return {
    startOfMonth,
    endOfMonth,
    month: date.getMonth() + 1,
    year: date.getFullYear()
  };
}

/**
 * Check if current time is within business hours
 * @param {number} startHour - Start hour (0-23)
 * @param {number} endHour - End hour (0-23)
 * @returns {boolean} True if within business hours
 */
function isWithinBusinessHours(startHour = 9, endHour = 17) {
  const now = new Date();
  const currentHour = now.getHours();
  return currentHour >= startHour && currentHour < endHour;
}

module.exports = {
  generateOrderId,
  getCurrentTimestamp,
  getCurrentISOTimestamp,
  formatTimestamp,
  calculateExpiryTime,
  checkExpiry,
  getRemainingTime,
  validateTimestamp,
  generateTimeBasedId,
  sleep,
  debounce,
  throttle,
  parseDuration,
  getDayBoundaries,
  getMonthBoundaries,
  isWithinBusinessHours,
  ORDER_ID_PREFIX,
  ORDER_ID_DATE_FORMAT
};
