/**
 * Distributed locking mechanism for idempotency and duplicate protection
 * Uses Firebase Realtime Database for distributed locks in serverless environment
 */

const crypto = require('crypto');
const { getDatabaseRef } = require('../firebase');

// Lock configuration
const DEFAULT_LOCK_TIMEOUT = 30000; // 30 seconds
const LOCK_CLEANUP_INTERVAL = 60000; // 1 minute
const MAX_LOCK_ATTEMPTS = 3;
const LOCK_RETRY_DELAY = 1000; // 1 second

// In-memory lock cache for faster checks (with TTL)
const lockCache = new Map();
let cleanupInterval;

/**
 * Start lock cleanup interval
 */
function startLockCleanup() {
  if (!cleanupInterval) {
    cleanupInterval = setInterval(cleanupExpiredLocks, LOCK_CLEANUP_INTERVAL);
    console.log('🔒 Lock cleanup interval started');
  }
}

/**
 * Stop lock cleanup interval
 */
function stopLockCleanup() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    console.log('🔒 Lock cleanup interval stopped');
  }
}

/**
 * Cleanup expired locks from memory cache
 */
function cleanupExpiredLocks() {
  const now = Date.now();
  let cleanedCount = 0;
  
  for (const [key, lockData] of lockCache.entries()) {
    if (lockData.expiresAt < now) {
      lockCache.delete(key);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`🔒 Cleaned ${cleanedCount} expired locks from memory cache`);
  }
}

/**
 * Generate a unique lock token
 * @returns {string} Unique lock token
 */
function generateLockToken() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Acquire a distributed lock
 * @param {string} lockKey - Lock identifier
 * @param {number} timeoutMs - Lock timeout in milliseconds
 * @param {number} maxAttempts - Maximum acquisition attempts
 * @returns {Promise<boolean|string>} Lock token if acquired, false otherwise
 */
async function acquireLock(lockKey, timeoutMs = DEFAULT_LOCK_TIMEOUT, maxAttempts = MAX_LOCK_ATTEMPTS) {
  const lockRef = getDatabaseRef(`system/locks/${lockKey}`);
  const lockToken = generateLockToken();
  const lockExpiresAt = Date.now() + timeoutMs;
  
  // First check memory cache for quick fail
  const cachedLock = lockCache.get(lockKey);
  if (cachedLock && cachedLock.expiresAt > Date.now()) {
    console.log(`🔒 Lock ${lockKey} already held in memory cache`);
    return false;
  }
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Try to acquire lock using Firebase transaction
      const result = await lockRef.transaction((currentLock) => {
        if (currentLock === null) {
          // Lock is available
          return {
            token: lockToken,
            acquiredAt: Date.now(),
            expiresAt: lockExpiresAt,
            owner: 'server',
            timeoutMs
          };
        }
        
        // Check if existing lock has expired
        if (currentLock.expiresAt < Date.now()) {
          // Lock has expired, we can take it
          return {
            token: lockToken,
            acquiredAt: Date.now(),
            expiresAt: lockExpiresAt,
            owner: 'server',
            timeoutMs,
            previousToken: currentLock.token
          };
        }
        
        // Lock is still held by someone else
        return currentLock;
      });
      
      if (result.committed && result.snapshot.val()?.token === lockToken) {
        // Lock acquired successfully
        console.log(`🔒 Lock ${lockKey} acquired with token ${lockToken.substring(0, 8)}...`);
        
        // Store in memory cache
        lockCache.set(lockKey, {
          token: lockToken,
          expiresAt: lockExpiresAt,
          acquiredAt: Date.now()
        });
        
        // Ensure cleanup interval is running
        startLockCleanup();
        
        return lockToken;
      }
      
      if (attempt < maxAttempts) {
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, LOCK_RETRY_DELAY * attempt));
      }
      
    } catch (error) {
      console.error(`🔒 Error acquiring lock ${lockKey} (attempt ${attempt}):`, error);
      if (attempt === maxAttempts) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, LOCK_RETRY_DELAY * attempt));
    }
  }
  
  console.log(`🔒 Failed to acquire lock ${lockKey} after ${maxAttempts} attempts`);
  return false;
}

/**
 * Release a distributed lock
 * @param {string} lockKey - Lock identifier
 * @param {string} lockToken - Lock token to validate ownership
 * @returns {Promise<boolean>} True if released successfully
 */
async function releaseLock(lockKey, lockToken = null) {
  const lockRef = getDatabaseRef(`system/locks/${lockKey}`);
  
  try {
    // First check memory cache
    const cachedLock = lockCache.get(lockKey);
    if (cachedLock && cachedLock.token === lockToken) {
      lockCache.delete(lockKey);
    }
    
    // Release lock in Firebase
    const result = await lockRef.transaction((currentLock) => {
      if (currentLock === null) {
        // Lock doesn't exist (already released)
        return null;
      }
      
      // If lockToken is provided, verify ownership
      if (lockToken && currentLock.token !== lockToken) {
        // Not the owner, don't release
        return currentLock;
      }
      
      // Release the lock
      return null;
    });
    
    if (result.committed) {
      console.log(`🔒 Lock ${lockKey} released`);
      return true;
    }
    
    console.log(`🔒 Lock ${lockKey} could not be released (may be held by another process)`);
    return false;
    
  } catch (error) {
    console.error(`🔒 Error releasing lock ${lockKey}:`, error);
    throw error;
  }
}

/**
 * Check if a lock is currently held
 * @param {string} lockKey - Lock identifier
 * @returns {Promise<boolean>} True if lock is held
 */
async function isLocked(lockKey) {
  // First check memory cache
  const cachedLock = lockCache.get(lockKey);
  if (cachedLock && cachedLock.expiresAt > Date.now()) {
    return true;
  }
  
  // Check Firebase
  try {
    const lockRef = getDatabaseRef(`system/locks/${lockKey}`);
    const snapshot = await lockRef.once('value');
    
    if (!snapshot.exists()) {
      return false;
    }
    
    const lockData = snapshot.val();
    const isExpired = lockData.expiresAt < Date.now();
    
    // Auto-cleanup expired locks
    if (isExpired) {
      await releaseLock(lockKey);
      return false;
    }
    
    return true;
    
  } catch (error) {
    console.error(`🔒 Error checking lock ${lockKey}:`, error);
    // If we can't check, assume locked to be safe
    return true;
  }
}

/**
 * Get lock information
 * @param {string} lockKey - Lock identifier
 * @returns {Promise<Object|null>} Lock information or null
 */
async function getLockInfo(lockKey) {
  try {
    const lockRef = getDatabaseRef(`system/locks/${lockKey}`);
    const snapshot = await lockRef.once('value');
    
    if (!snapshot.exists()) {
      return null;
    }
    
    const lockData = snapshot.val();
    const now = Date.now();
    
    return {
      ...lockData,
      isExpired: lockData.expiresAt < now,
      remainingMs: Math.max(0, lockData.expiresAt - now),
      ageMs: now - lockData.acquiredAt
    };
    
  } catch (error) {
    console.error(`🔒 Error getting lock info for ${lockKey}:`, error);
    return null;
  }
}

/**
 * Force release a lock (admin function)
 * @param {string} lockKey - Lock identifier
 * @returns {Promise<boolean>} True if forced release successful
 */
async function forceReleaseLock(lockKey) {
  console.warn(`⚠️ Force releasing lock: ${lockKey}`);
  
  try {
    const lockRef = getDatabaseRef(`system/locks/${lockKey}`);
    await lockRef.remove();
    
    // Clear from memory cache
    lockCache.delete(lockKey);
    
    console.log(`🔒 Lock ${lockKey} force released`);
    return true;
    
  } catch (error) {
    console.error(`🔒 Error force releasing lock ${lockKey}:`, error);
    return false;
  }
}

/**
 * Acquire lock with automatic release after operation
 * @param {string} lockKey - Lock identifier
 * @param {Function} operation - Async function to execute while lock is held
 * @param {number} timeoutMs - Lock timeout in milliseconds
 * @returns {Promise<*>} Result of the operation
 */
async function withLock(lockKey, operation, timeoutMs = DEFAULT_LOCK_TIMEOUT) {
  const lockToken = await acquireLock(lockKey, timeoutMs);
  
  if (!lockToken) {
    throw new Error(`Failed to acquire lock: ${lockKey}`);
  }
  
  try {
    // Execute the operation while lock is held
    const result = await operation();
    return result;
  } finally {
    // Always release the lock
    await releaseLock(lockKey, lockToken);
  }
}

/**
 * Idempotency key validation and tracking
 * @param {string} idempotencyKey - Idempotency key
 * @param {Function} operation - Async function to execute if key is not seen
 * @returns {Promise<*>} Cached result or new result
 */
async function withIdempotency(idempotencyKey, operation) {
  const idempotencyRef = getDatabaseRef(`system/idempotency/${idempotencyKey}`);
  
  // First check memory cache
  const memoryKey = `idempotency:${idempotencyKey}`;
  const cachedResult = lockCache.get(memoryKey);
  if (cachedResult) {
    console.log(`🔄 Idempotency hit for key: ${idempotencyKey.substring(0, 16)}...`);
    return cachedResult.result;
  }
  
  // Check Firebase for existing result
  const snapshot = await idempotencyRef.once('value');
  if (snapshot.exists()) {
    const data = snapshot.val();
    // Check if result is still valid (within TTL)
    if (data.expiresAt > Date.now()) {
      console.log(`🔄 Idempotency hit in Firebase for key: ${idempotencyKey.substring(0, 16)}...`);
      
      // Cache in memory
      lockCache.set(memoryKey, {
        result: data.result,
        expiresAt: data.expiresAt
      });
      
      return data.result;
    }
  }
  
  // Execute the operation and store result
  const result = await operation();
  const expiresAt = Date.now() + (5 * 60 * 1000); // 5 minute TTL
  
  // Store in Firebase
  await idempotencyRef.set({
    result,
    expiresAt,
    storedAt: Date.now(),
    key: idempotencyKey.substring(0, 32) // Store partial key for reference
  });
  
  // Store in memory cache
  lockCache.set(memoryKey, {
    result,
    expiresAt
  });
  
  console.log(`🔄 Idempotency result stored for key: ${idempotencyKey.substring(0, 16)}...`);
  return result;
}

/**
 * Cleanup all expired idempotency keys
 * @returns {Promise<number>} Number of keys cleaned up
 */
async function cleanupIdempotencyKeys() {
  try {
    const idempotencyRef = getDatabaseRef('system/idempotency');
    const snapshot = await idempotencyRef.once('value');
    
    if (!snapshot.exists()) {
      return 0;
    }
    
    const now = Date.now();
    const updates = {};
    let cleanupCount = 0;
    
    snapshot.forEach((childSnapshot) => {
      const data = childSnapshot.val();
      if (data.expiresAt < now) {
        updates[childSnapshot.key] = null; // Mark for deletion
        cleanupCount++;
      }
    });
    
    if (cleanupCount > 0) {
      await idempotencyRef.update(updates);
      console.log(`🔄 Cleaned up ${cleanupCount} expired idempotency keys`);
    }
    
    return cleanupCount;
    
  } catch (error) {
    console.error('Error cleaning up idempotency keys:', error);
    return 0;
  }
}

module.exports = {
  acquireLock,
  releaseLock,
  isLocked,
  getLockInfo,
  forceReleaseLock,
  withLock,
  withIdempotency,
  cleanupIdempotencyKeys,
  startLockCleanup,
  stopLockCleanup,
  generateLockToken,
  DEFAULT_LOCK_TIMEOUT,
  LOCK_CLEANUP_INTERVAL,
  MAX_LOCK_ATTEMPTS
};
