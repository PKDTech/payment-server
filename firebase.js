const admin = require('firebase-admin');

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCpQmcF_wZoON4x0DoLTYu87c7RMlFvOO8",
  authDomain: "pkdtech-1.firebaseapp.com",
  databaseURL: "https://pkdtech-1-default-rtdb.firebaseio.com",
  projectId: "pkdtech-1",
  storageBucket: "pkdtech-1.firebasestorage.app",
  messagingSenderId: "1032943248316",
  appId: "1:1032943248316:web:7f2e26c1128067c953c1b9"
};

// Service account from provided JSON (truncated for brevity, full key in separate config)
const serviceAccount = {
  "type": "service_account",
  "project_id": "pkdtech-1",
  "private_key_id": "23733c198299f4f61ea6a696979eb9624482b821",
  "private_key": process.env.FIREBASE_PRIVATE_KEY || "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDWzwdGQKcsbT7o\n0OhN9aR+6YZNhAwXEz2CBeWeEMp9hi2oxvT9k2g3EtfJJ6vtSdc8C8ePxCIinv+r\nOwMZ1Ypgzg3c7lnGsrKnQ3IwU98hhaFCP19MfesjLgVxUhn093BUUJ9RfVOHFgR+\n6i2BmiasEK83C7uLTMJ7zsmNuFO/yXVqJB/LCaAIHGLLzOw8IXvAxwhx9CKso7Gw\n2BFuljt0Piwl+DZ5LqC1VMHx6DLA/CcrjekiQIs3NOkH8m2fB2sVrUvwRu9d47kp\nVX1lePmpiLGVyu0IP/s1IgoXLcpvsqqI0QV2r6aUG9rACBp/XHuI90v7PVS9ezoy\nDZmelzaLAgMBAAECggEARbvs3SIlAzet6g/TsmdR0P+HoYeCE0WkPJ8kdUV3LvvN\nu9Jm+yEM/oAH/F38IurLTEt4rBPcjwe18UUVkx/vLdEG0Beynl4pwEIVglngAHZs\nrOB81Ay2tnN8wdaI5a0kUsLfjalVYe/EYt0sC7xa3JYIA6Mz7ZtsMZwmc3MJASPR\nZgJeu58dIpVKRS+LjftV4bCJGZsIMCj4Y8YP2Y0kDJtKXSRD2+cd+JK0xibt9Fv2\nW47qvWZvQdDblhTQFdfrgEFtBA5lGo5RcbjulDwNbTAm0VXzavJhRlvQhdWMhGuX\nXhc0zKjsGqPJ6AwgWNi6bW2MUoOzIgVp/b9NsCL7nQKBgQD8cwE7EyxHThvA56JL\nm0fF87qT4z2WnGAfIymsGiQrHFpg0O4L8PFNNa8GD04qg+xuBLMmr05jMPlRTvI3\n6uoUsto0XWQZ/d/QLmA2M7B5kzhPJgT8RBxKVRxNYB/lyPjR0FEw2Y2utvIHdZIk\nd6bev2w1z1rmWbI2MZE0ysV6dwKBgQDZ1H28np8+PxWKc7fHezhAiWoPQM5pCMWQ\n990ZVJojJCzw3/FWOgQKVoehUZ/M8DQ9WRA3h1IxW9A7mHvffnYJq4Is63u65drk\nEIKRSId/iWrHKverExBVcsh/oryAE7XJwYXdv4gB9u0vuK3fNF4aF9V2loqXYFG6\n6GYqFDEVjQKBgQDtR69Ndlz0/I6Lh2x9Qgt5HPgujrVRvdN/EM7Xa465UqIEQ/yr\nDqHPn3jN6k7fGTZ9xj8ZSkcUZnDAosJ6GnxATkdYVruCzqOyihR2fakO7HhNtH+V\nGPO6TjsW4xW4Jmjw1KurjaBlKqFcr35YdnpK/YNZJHfc8UvXMkm4ZCqvSwKBgBkM\nRikaVFVkC6YQCGH32VASfQ+j9Bg/2fgBiHsRL2g7EK/iEG5J3Y0SxiXWrPlz5Y3o\nX+UCuoDSfe9caWIZuJkED8P6kA9vp3bCCiMnogb1Rtx5WjWmFo7CLMkk2hm29CH\nYE1PaORQ8JU8N0IjU27Mrs8kIGunt742WwkbqUlBAoGAJ4/q1W+nJ3OwJMtqy9Kp\n3/CPb8PB3y86sRH2ykRs6TnyrzVb6GL+MSsjtKvXTZuMKQOIaXNT+3Vx1qHplWo7\nOPYFVDMtVUdWsglgE0diaIddSop1P6T0vYIkaYLxMjahAxw3W6BNli9Y+wuNlYen\nypJlEr5bzIojOJrZ5CWO8eE=\n-----END PRIVATE KEY-----",
  "client_email": "firebase-adminsdk-fbsvc@pkdtech-1.iam.gserviceaccount.com",
  "client_id": "106201466699462228120",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40pkdtech-1.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
};

let db = null;
let adminInitialized = false;

/**
 * Initialize Firebase Admin SDK
 */
const initializeFirebase = async () => {
  if (adminInitialized) {
    return db;
  }
  
  try {
    // Check if Firebase is already initialized
    if (!admin.apps.length) {
      // Initialize with service account
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: firebaseConfig.databaseURL
      });
    }
    
    // Get database reference
    db = admin.database();
    adminInitialized = true;
    
    console.log('✅ Firebase Admin SDK initialized successfully');
    return db;
  } catch (error) {
    console.error('❌ Firebase initialization error:', error);
    throw new Error(`Failed to initialize Firebase: ${error.message}`);
  }
};

/**
 * Get UPI details from Firebase Realtime Database
 * @returns {Promise<Object>} UPI details
 */
const getUPIDetails = async () => {
  try {
    await initializeFirebase();
    const upiRef = db.ref('settings/upiDetails');
    const snapshot = await upiRef.once('value');
    
    if (!snapshot.exists()) {
      throw new Error('UPI details not found in Firebase');
    }
    
    return snapshot.val();
  } catch (error) {
    console.error('Error fetching UPI details:', error);
    throw error;
  }
};

/**
 * Get database reference for a specific path
 * @param {string} path - Firebase path
 * @returns {DatabaseReference} Firebase reference
 */
const getDatabaseRef = (path) => {
  if (!db) {
    throw new Error('Firebase not initialized. Call initializeFirebase() first.');
  }
  return db.ref(path);
};

/**
 * Save payment order to Firebase
 * @param {string} orderId - Unique order ID
 * @param {Object} orderData - Order data
 * @returns {Promise<void>}
 */
const savePaymentOrder = async (orderId, orderData) => {
  try {
    await initializeFirebase();
    const orderRef = db.ref(`payments/${orderId}`);
    await orderRef.set(orderData);
    console.log(`✅ Order ${orderId} saved to Firebase`);
  } catch (error) {
    console.error('Error saving payment order:', error);
    throw error;
  }
};

/**
 * Get payment order from Firebase
 * @param {string} orderId - Order ID
 * @returns {Promise<Object|null>} Order data or null if not found
 */
const getPaymentOrder = async (orderId) => {
  try {
    await initializeFirebase();
    const orderRef = db.ref(`payments/${orderId}`);
    const snapshot = await orderRef.once('value');
    
    if (!snapshot.exists()) {
      return null;
    }
    
    return snapshot.val();
  } catch (error) {
    console.error('Error fetching payment order:', error);
    throw error;
  }
};

/**
 * Update payment order status
 * @param {string} orderId - Order ID
 * @param {string} status - New status
 * @param {Object} updateData - Additional data to update
 * @returns {Promise<void>}
 */
const updatePaymentOrder = async (orderId, status, updateData = {}) => {
  try {
    await initializeFirebase();
    const orderRef = db.ref(`payments/${orderId}`);
    const updates = {
      status,
      updatedAt: Date.now(),
      ...updateData
    };
    
    await orderRef.update(updates);
    console.log(`✅ Order ${orderId} updated to status: ${status}`);
  } catch (error) {
    console.error('Error updating payment order:', error);
    throw error;
  }
};

/**
 * Update user wallet balance
 * @param {string} userId - User ID
 * @param {number} amount - Amount to add (positive) or subtract (negative)
 * @param {string} orderId - Associated order ID
 * @param {string} transactionType - Type of transaction
 * @returns {Promise<Object>} Updated wallet data
 */
const updateWalletBalance = async (userId, amount, orderId, transactionType = 'CREDIT') => {
  try {
    await initializeFirebase();
    const walletRef = db.ref(`wallet/${userId}`);
    
    // Use transaction to prevent race conditions
    const result = await walletRef.transaction((currentWallet) => {
      if (currentWallet === null) {
        // Wallet doesn't exist, create new
        return {
          balance: amount,
          updatedAt: Date.now(),
          createdAt: Date.now()
        };
      }
      
      // Update existing wallet
      currentWallet.balance = (currentWallet.balance || 0) + amount;
      currentWallet.updatedAt = Date.now();
      
      return currentWallet;
    });
    
    if (!result.committed) {
      throw new Error('Wallet update transaction failed');
    }
    
    // Save transaction history
    const historyRef = db.ref(`wallet/${userId}/history/${orderId}`);
    await historyRef.set({
      orderId,
      amount,
      type: transactionType,
      timestamp: Date.now(),
      previousBalance: result.snapshot.val().balance - amount,
      newBalance: result.snapshot.val().balance
    });
    
    console.log(`✅ Wallet ${userId} updated by ${amount}. New balance: ${result.snapshot.val().balance}`);
    
    return result.snapshot.val();
  } catch (error) {
    console.error('Error updating wallet balance:', error);
    throw error;
  }
};

/**
 * Get user wallet balance
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} Wallet data or null if not found
 */
const getWalletBalance = async (userId) => {
  try {
    await initializeFirebase();
    const walletRef = db.ref(`wallet/${userId}`);
    const snapshot = await walletRef.once('value');
    
    if (!snapshot.exists()) {
      return null;
    }
    
    return snapshot.val();
  } catch (error) {
    console.error('Error fetching wallet balance:', error);
    throw error;
  }
};

module.exports = {
  initializeFirebase,
  getUPIDetails,
  getDatabaseRef,
  savePaymentOrder,
  getPaymentOrder,
  updatePaymentOrder,
  updateWalletBalance,
  getWalletBalance,
  db
};
