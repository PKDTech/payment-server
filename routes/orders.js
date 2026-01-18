const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { 
  getUPIDetails, 
  savePaymentOrder, 
  getPaymentOrder, 
  updatePaymentOrder 
} = require('../firebase');
const { generateOrderId, checkExpiry } = require('../utils/time');
const { acquireLock, releaseLock, isLocked } = require('../utils/lock');
const config = require('../config');

/**
 * POST /api/order/create
 * Create a new payment order
 */
router.post('/create', async (req, res, next) => {
  try {
    const { amount, userId, userPhone, userName } = req.body;
    
    // Validate required fields
    if (!amount || !userId) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Amount and userId are required fields'
      });
    }
    
    // Validate amount
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Amount must be a positive number'
      });
    }
    
    // Check amount limits
    if (amountNum < config.MIN_AMOUNT || amountNum > config.MAX_AMOUNT) {
      return res.status(400).json({
        success: false,
        error: 'AMOUNT_LIMIT_ERROR',
        message: `Amount must be between ₹${config.MIN_AMOUNT} and ₹${config.MAX_AMOUNT}`,
        minAmount: config.MIN_AMOUNT,
        maxAmount: config.MAX_AMOUNT
      });
    }
    
    // Generate unique order ID
    const orderId = generateOrderId();
    
    // Get UPI details from Firebase
    let upiDetails;
    try {
      upiDetails = await getUPIDetails();
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'UPI_FETCH_ERROR',
        message: 'Failed to fetch UPI payment details'
      });
    }
    
    // Create order object
    const orderData = {
      orderId,
      amount: amountNum,
      userId,
      userPhone: userPhone || '',
      userName: userName || '',
      upiId: upiDetails.upiId,
      upiName: upiDetails.name || '',
      status: 'PENDING',
      createdAt: Date.now(),
      expiresAt: Date.now() + (config.ORDER_EXPIRY_MINUTES * 60 * 1000),
      metadata: {
        note: `Tournament Payment - Order ${orderId}`,
        currency: 'INR',
        paymentMethod: 'UPI'
      }
    };
    
    // Save order to Firebase
    try {
      await savePaymentOrder(orderId, orderData);
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'ORDER_SAVE_ERROR',
        message: 'Failed to save payment order'
      });
    }
    
    // Calculate expiry time in minutes
    const expiryMinutes = config.ORDER_EXPIRY_MINUTES;
    const expiryTimestamp = orderData.expiresAt;
    
    // Prepare payment instructions
    const paymentInstructions = {
      upiId: orderData.upiId,
      upiName: orderData.upiName,
      amount: orderData.amount,
      note: orderData.metadata.note,
      // Generate UPI payment URL (standard format)
      upiUrl: `upi://pay?pa=${encodeURIComponent(orderData.upiId)}&pn=${encodeURIComponent(orderData.upiName)}&am=${orderData.amount}&tn=${encodeURIComponent(orderData.metadata.note)}&cu=INR`
    };
    
    res.status(201).json({
      success: true,
      message: 'Payment order created successfully',
      data: {
        orderId,
        amount: orderData.amount,
        status: orderData.status,
        createdAt: orderData.createdAt,
        expiresAt: orderData.expiresAt,
        expiryMinutes,
        paymentInstructions,
        timestamp: Date.now()
      }
    });
    
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/order/:orderId
 * Fetch order details and check expiry
 */
router.get('/:orderId', async (req, res, next) => {
  try {
    const { orderId } = req.params;
    
    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Order ID is required'
      });
    }
    
    // Get order from Firebase
    const order = await getPaymentOrder(orderId);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'ORDER_NOT_FOUND',
        message: 'Payment order not found'
      });
    }
    
    // Check if order is locked (cancelled/expired)
    if (await isLocked(`order:${orderId}`)) {
      return res.status(400).json({
        success: false,
        error: 'ORDER_LOCKED',
        message: 'This order has been cancelled or expired',
        status: order.status || 'LOCKED'
      });
    }
    
    // Calculate remaining time
    const currentTime = Date.now();
    const expiresAt = order.expiresAt || (order.createdAt + (config.ORDER_EXPIRY_MINUTES * 60 * 1000));
    const remainingTime = Math.max(0, expiresAt - currentTime);
    const remainingMinutes = Math.ceil(remainingTime / (60 * 1000));
    const isExpired = remainingTime === 0;
    
    // Auto-expire if time has passed
    if (isExpired && order.status === 'PENDING') {
      try {
        await acquireLock(`order:${orderId}`, config.ORDER_LOCK_TIMEOUT);
        await updatePaymentOrder(orderId, 'EXPIRED', {
          autoExpiredAt: currentTime
        });
        order.status = 'EXPIRED';
      } catch (lockError) {
        // Another process might be handling expiry
        console.log('Lock acquisition failed for auto-expiry:', lockError);
      }
    }
    
    // Prepare response
    const response = {
      success: true,
      data: {
        orderId: order.orderId,
        amount: order.amount,
        status: order.status,
        createdAt: order.createdAt,
        expiresAt: expiresAt,
        remainingTime,
        remainingMinutes,
        isExpired,
        userId: order.userId,
        upiId: order.upiId,
        upiName: order.upiName,
        metadata: order.metadata || {}
      }
    };
    
    // Include payment instructions for pending orders
    if (order.status === 'PENDING' && !isExpired) {
      response.data.paymentInstructions = {
        upiId: order.upiId,
        upiName: order.upiName,
        amount: order.amount,
        note: order.metadata?.note || `Tournament Payment - Order ${orderId}`,
        upiUrl: `upi://pay?pa=${encodeURIComponent(order.upiId)}&pn=${encodeURIComponent(order.upiName)}&am=${order.amount}&tn=${encodeURIComponent(order.metadata?.note || `Tournament Payment - Order ${orderId}`)}&cu=INR`
      };
    }
    
    res.status(200).json(response);
    
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/order/cancel
 * Cancel a pending order
 */
router.post('/cancel', async (req, res, next) => {
  let lockAcquired = false;
  let lockKey = '';
  
  try {
    const { orderId, userId } = req.body;
    
    if (!orderId || !userId) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Order ID and user ID are required'
      });
    }
    
    // Acquire lock to prevent concurrent operations
    lockKey = `order:${orderId}`;
    lockAcquired = await acquireLock(lockKey, config.ORDER_LOCK_TIMEOUT);
    
    if (!lockAcquired) {
      return res.status(409).json({
        success: false,
        error: 'ORDER_BEING_PROCESSED',
        message: 'Order is currently being processed. Please try again.'
      });
    }
    
    // Get order from Firebase
    const order = await getPaymentOrder(orderId);
    
    if (!order) {
      await releaseLock(lockKey);
      return res.status(404).json({
        success: false,
        error: 'ORDER_NOT_FOUND',
        message: 'Payment order not found'
      });
    }
    
    // Verify user owns the order
    if (order.userId !== userId) {
      await releaseLock(lockKey);
      return res.status(403).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'You are not authorized to cancel this order'
      });
    }
    
    // Check if order can be cancelled
    if (order.status !== 'PENDING') {
      await releaseLock(lockKey);
      return res.status(400).json({
        success: false,
        error: 'ORDER_NOT_CANCELLABLE',
        message: `Order cannot be cancelled. Current status: ${order.status}`,
        currentStatus: order.status
      });
    }
    
    // Check if order is already expired
    const isExpired = checkExpiry(order.createdAt, config.ORDER_EXPIRY_MINUTES);
    if (isExpired) {
      await releaseLock(lockKey);
      return res.status(400).json({
        success: false,
        error: 'ORDER_EXPIRED',
        message: 'Order has already expired'
      });
    }
    
    // Cancel the order
    await updatePaymentOrder(orderId, 'CANCELLED', {
      cancelledAt: Date.now(),
      cancelledBy: userId
    });
    
    // Release lock
    await releaseLock(lockKey);
    lockAcquired = false;
    
    res.status(200).json({
      success: true,
      message: 'Order cancelled successfully',
      data: {
        orderId,
        status: 'CANCELLED',
        cancelledAt: Date.now(),
        timestamp: Date.now()
      }
    });
    
  } catch (error) {
    // Ensure lock is released on error
    if (lockAcquired && lockKey) {
      try {
        await releaseLock(lockKey);
      } catch (lockError) {
        console.error('Error releasing lock:', lockError);
      }
    }
    next(error);
  }
});

/**
 * POST /api/order/expire
 * Manually expire orders (for cron jobs or manual triggers)
 */
router.post('/expire', async (req, res, next) => {
  try {
    const { batchSize = 100 } = req.body;
    
    // This endpoint should be protected in production
    // For now, we'll implement basic protection
    if (process.env.NODE_ENV === 'production' && req.headers['x-cron-secret'] !== process.env.CRON_SECRET) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Unauthorized access'
      });
    }
    
    await expirePendingOrders(batchSize);
    
    res.status(200).json({
      success: true,
      message: 'Order expiry process completed',
      timestamp: Date.now()
    });
    
  } catch (error) {
    next(error);
  }
});

/**
 * Helper function to expire pending orders
 */
async function expirePendingOrders(batchSize = 100) {
  try {
    const { getDatabaseRef } = require('../firebase');
    const db = getDatabaseRef('payments');
    
    const snapshot = await db
      .orderByChild('status')
      .equalTo('PENDING')
      .limitToFirst(batchSize)
      .once('value');
    
    if (!snapshot.exists()) {
      console.log('No pending orders to expire');
      return { expired: 0 };
    }
    
    const orders = snapshot.val();
    const currentTime = Date.now();
    let expiredCount = 0;
    
    for (const orderId in orders) {
      const order = orders[orderId];
      const orderAge = currentTime - order.createdAt;
      const expiryTime = config.ORDER_EXPIRY_MINUTES * 60 * 1000;
      
      if (orderAge > expiryTime) {
        try {
          // Acquire lock before updating
          const lockKey = `order:${orderId}`;
          const lockAcquired = await acquireLock(lockKey, config.ORDER_LOCK_TIMEOUT);
          
          if (lockAcquired) {
            await updatePaymentOrder(orderId, 'EXPIRED', {
              autoExpiredAt: currentTime,
              expiryReason: 'AUTO_EXPIRED_BY_SYSTEM'
            });
            await releaseLock(lockKey);
            expiredCount++;
            console.log(`✅ Order ${orderId} auto-expired`);
          }
        } catch (error) {
          console.error(`Failed to expire order ${orderId}:`, error);
        }
      }
    }
    
    console.log(`✅ Expired ${expiredCount} pending orders`);
    return { expired: expiredCount };
    
  } catch (error) {
    console.error('Error in expirePendingOrders:', error);
    throw error;
  }
}

module.exports = router;
