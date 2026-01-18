const express = require('express');
const router = express.Router();
const { 
  getPaymentOrder, 
  updatePaymentOrder,
  updateWalletBalance,
  getUPIDetails
} = require('../firebase');
const { checkExpiry } = require('../utils/time');
const { acquireLock, releaseLock, isLocked } = require('../utils/lock');
const config = require('../config');

/**
 * POST /api/payment/verify
 * Verify UPI payment and credit wallet
 */
router.post('/verify', async (req, res, next) => {
  let lockAcquired = false;
  let lockKey = '';
  
  try {
    const { 
      orderId, 
      transactionId, 
      transactionRef, 
      upiId, 
      amount, 
      userId,
      transactionNote 
    } = req.body;
    
    // Validate required fields
    const missingFields = [];
    if (!orderId) missingFields.push('orderId');
    if (!transactionId) missingFields.push('transactionId');
    if (!upiId) missingFields.push('upiId');
    if (!amount) missingFields.push('amount');
    if (!userId) missingFields.push('userId');
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: `Missing required fields: ${missingFields.join(', ')}`
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
    
    // Acquire lock to prevent duplicate verification
    lockKey = `payment:verify:${orderId}`;
    lockAcquired = await acquireLock(lockKey, config.PAYMENT_VERIFICATION_TIMEOUT);
    
    if (!lockAcquired) {
      return res.status(409).json({
        success: false,
        error: 'VERIFICATION_IN_PROGRESS',
        message: 'Payment verification is already in progress for this order'
      });
    }
    
    // Step 1: Verify order exists
    const order = await getPaymentOrder(orderId);
    if (!order) {
      await releaseLock(lockKey);
      return res.status(404).json({
        success: false,
        error: 'ORDER_NOT_FOUND',
        message: 'Payment order not found'
      });
    }
    
    // Step 2: Verify order status is PENDING
    if (order.status !== 'PENDING') {
      await releaseLock(lockKey);
      return res.status(400).json({
        success: false,
        error: 'ORDER_INVALID_STATUS',
        message: `Order cannot be verified. Current status: ${order.status}`,
        currentStatus: order.status
      });
    }
    
    // Step 3: Verify order is not expired
    const isExpired = checkExpiry(order.createdAt, config.ORDER_EXPIRY_MINUTES);
    if (isExpired) {
      // Auto-expire the order
      await updatePaymentOrder(orderId, 'EXPIRED', {
        autoExpiredAt: Date.now(),
        expiryReason: 'EXPIRED_BEFORE_VERIFICATION'
      });
      await releaseLock(lockKey);
      return res.status(400).json({
        success: false,
        error: 'ORDER_EXPIRED',
        message: 'Payment order has expired',
        expiredAt: order.expiresAt || (order.createdAt + (config.ORDER_EXPIRY_MINUTES * 60 * 1000))
      });
    }
    
    // Step 4: Verify order is not cancelled
    if (order.status === 'CANCELLED' || await isLocked(`order:${orderId}`)) {
      await releaseLock(lockKey);
      return res.status(400).json({
        success: false,
        error: 'ORDER_CANCELLED',
        message: 'Payment order has been cancelled'
      });
    }
    
    // Step 5: Verify amount matches
    const orderAmount = parseFloat(order.amount);
    if (Math.abs(amountNum - orderAmount) > 0.01) { // Allow small floating point differences
      await releaseLock(lockKey);
      return res.status(400).json({
        success: false,
        error: 'AMOUNT_MISMATCH',
        message: `Payment amount does not match order amount. Expected: ${orderAmount}, Received: ${amountNum}`,
        expectedAmount: orderAmount,
        receivedAmount: amountNum
      });
    }
    
    // Step 6: Verify UPI ID matches Firebase
    let currentUPIDetails;
    try {
      currentUPIDetails = await getUPIDetails();
    } catch (error) {
      await releaseLock(lockKey);
      return res.status(500).json({
        success: false,
        error: 'UPI_VERIFICATION_ERROR',
        message: 'Failed to verify UPI details'
      });
    }
    
    if (currentUPIDetails.upiId !== upiId) {
      await releaseLock(lockKey);
      return res.status(400).json({
        success: false,
        error: 'UPI_MISMATCH',
        message: 'Payment UPI ID does not match expected UPI ID',
        expectedUPI: currentUPIDetails.upiId,
        receivedUPI: upiId
      });
    }
    
    // Step 7: Verify transaction note contains order ID (optional but recommended)
    if (transactionNote && !transactionNote.includes(orderId)) {
      console.warn(`Transaction note does not contain order ID. Note: ${transactionNote}, Order: ${orderId}`);
      // We don't fail verification for this, just log warning
    }
    
    // Step 8: Check for duplicate transaction ID
    // This would require storing transaction IDs in a separate collection
    // For now, we'll rely on order status and locks
    
    // Step 9: Mark order as SUCCESS
    await updatePaymentOrder(orderId, 'SUCCESS', {
      verifiedAt: Date.now(),
      transactionId,
      transactionRef: transactionRef || transactionId,
      verifiedBy: 'SERVER_AUTO_VERIFY',
      upiIdUsed: upiId,
      amountReceived: amountNum
    });
    
    // Step 10: Credit user wallet
    let walletUpdate;
    try {
      walletUpdate = await updateWalletBalance(
        userId, 
        amountNum, 
        orderId, 
        'CREDIT'
      );
    } catch (walletError) {
      // If wallet credit fails, we need to rollback order status
      await updatePaymentOrder(orderId, 'PENDING', {
        verificationError: 'WALLET_CREDIT_FAILED',
        errorDetails: walletError.message
      });
      await releaseLock(lockKey);
      
      return res.status(500).json({
        success: false,
        error: 'WALLET_CREDIT_ERROR',
        message: 'Payment verified but failed to credit wallet. Please contact support.',
        orderId,
        transactionId
      });
    }
    
    // Step 11: Release lock
    await releaseLock(lockKey);
    lockAcquired = false;
    
    // Prepare success response
    const response = {
      success: true,
      message: 'Payment verified successfully and wallet credited',
      data: {
        orderId,
        transactionId,
        amount: amountNum,
        status: 'SUCCESS',
        verifiedAt: Date.now(),
        walletBalance: walletUpdate.balance,
        userId,
        timestamp: Date.now()
      }
    };
    
    res.status(200).json(response);
    
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
 * POST /api/payment/recheck
 * Recheck payment status (for app restarts or failed callbacks)
 */
router.post('/recheck', async (req, res, next) => {
  try {
    const { orderId, userId } = req.body;
    
    if (!orderId || !userId) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Order ID and user ID are required'
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
    
    // Verify user owns the order
    if (order.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'You are not authorized to check this order'
      });
    }
    
    // Check order status
    const currentStatus = order.status;
    const currentTime = Date.now();
    const orderAge = currentTime - order.createdAt;
    const expiryTime = config.ORDER_EXPIRY_MINUTES * 60 * 1000;
    
    // Handle different statuses
    switch (currentStatus) {
      case 'SUCCESS':
        // Payment already successful
        return res.status(200).json({
          success: true,
          message: 'Payment already verified successfully',
          data: {
            orderId,
            status: 'SUCCESS',
            verifiedAt: order.verifiedAt,
            transactionId: order.transactionId,
            walletCredited: true,
            timestamp: currentTime
          }
        });
        
      case 'PENDING':
        // Check if order is expired
        if (orderAge > expiryTime) {
          // Auto-expire
          try {
            const lockKey = `order:${orderId}`;
            const lockAcquired = await acquireLock(lockKey, config.ORDER_LOCK_TIMEOUT);
            
            if (lockAcquired) {
              await updatePaymentOrder(orderId, 'EXPIRED', {
                autoExpiredAt: currentTime,
                expiryReason: 'EXPIRED_ON_RECHECK'
              });
              await releaseLock(lockKey);
            }
            
            return res.status(400).json({
              success: false,
              error: 'ORDER_EXPIRED',
              message: 'Payment order has expired',
              data: {
                orderId,
                status: 'EXPIRED',
                expiredAt: currentTime,
                timestamp: currentTime
              }
            });
          } catch (lockError) {
            // Lock acquisition failed
            return res.status(200).json({
              success: true,
              message: 'Order is still pending',
              data: {
                orderId,
                status: 'PENDING',
                remainingTime: Math.max(0, expiryTime - orderAge),
                isExpired: orderAge > expiryTime,
                timestamp: currentTime
              }
            });
          }
        }
        
        // Order still pending and not expired
        return res.status(200).json({
          success: true,
          message: 'Order is still pending payment',
          data: {
            orderId,
            status: 'PENDING',
            remainingTime: expiryTime - orderAge,
            createdAt: order.createdAt,
            expiresAt: order.createdAt + expiryTime,
            timestamp: currentTime
          }
        });
        
      case 'CANCELLED':
        return res.status(400).json({
          success: false,
          error: 'ORDER_CANCELLED',
          message: 'Payment order has been cancelled',
          data: {
            orderId,
            status: 'CANCELLED',
            cancelledAt: order.cancelledAt,
            timestamp: currentTime
          }
        });
        
      case 'EXPIRED':
        return res.status(400).json({
          success: false,
          error: 'ORDER_EXPIRED',
          message: 'Payment order has expired',
          data: {
            orderId,
            status: 'EXPIRED',
            expiredAt: order.expiredAt || order.autoExpiredAt,
            timestamp: currentTime
          }
        });
        
      default:
        return res.status(200).json({
          success: true,
          message: 'Order status retrieved',
          data: {
            orderId,
            status: currentStatus,
            timestamp: currentTime
          }
        });
    }
    
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/payment/webhook
 * Webhook endpoint for payment gateway callbacks (if applicable)
 */
router.post('/webhook', async (req, res, next) => {
  try {
    // This endpoint would handle webhooks from payment gateways
    // For now, we'll implement a placeholder
    
    const webhookData = req.body;
    const signature = req.headers['x-webhook-signature'];
    
    // Verify webhook signature (implement based on your payment gateway)
    // const isValid = verifyWebhookSignature(webhookData, signature);
    
    // For now, just acknowledge receipt
    res.status(200).json({
      success: true,
      message: 'Webhook received',
      timestamp: Date.now()
    });
    
  } catch (error) {
    next(error);
  }
});

module.exports = router;
