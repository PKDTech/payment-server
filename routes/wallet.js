const express = require('express');
const router = express.Router();
const { getWalletBalance } = require('../firebase');

/**
 * GET /api/wallet/:userId
 * Get user wallet balance and transaction history
 */
router.get('/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'User ID is required'
      });
    }
    
    // Get wallet balance from Firebase
    const walletData = await getWalletBalance(userId);
    
    if (!walletData) {
      // Return empty wallet if not found
      return res.status(200).json({
        success: true,
        message: 'Wallet not found for user, returning empty wallet',
        data: {
          userId,
          balance: 0,
          history: {},
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
        timestamp: Date.now()
      });
    }
    
    // Format transaction history
    let transactionHistory = [];
    if (walletData.history) {
      transactionHistory = Object.entries(walletData.history)
        .map(([orderId, transaction]) => ({
          orderId,
          ...transaction
        }))
        .sort((a, b) => b.timestamp - a.timestamp) // Most recent first
        .slice(0, 50); // Limit to 50 most recent transactions
    }
    
    // Calculate statistics
    const totalCredits = transactionHistory
      .filter(tx => tx.type === 'CREDIT')
      .reduce((sum, tx) => sum + tx.amount, 0);
    
    const totalDebits = transactionHistory
      .filter(tx => tx.type === 'DEBIT')
      .reduce((sum, tx) => sum + tx.amount, 0);
    
    const firstTransaction = transactionHistory.length > 0 
      ? Math.min(...transactionHistory.map(tx => tx.timestamp))
      : null;
    
    const lastTransaction = transactionHistory.length > 0
      ? Math.max(...transactionHistory.map(tx => tx.timestamp))
      : null;
    
    // Prepare response
    const response = {
      success: true,
      data: {
        userId,
        balance: walletData.balance || 0,
        currency: 'INR',
        walletCreatedAt: walletData.createdAt || Date.now(),
        lastUpdated: walletData.updatedAt || Date.now(),
        statistics: {
          totalCredits,
          totalDebits,
          netBalance: walletData.balance || 0,
          totalTransactions: transactionHistory.length,
          firstTransaction,
          lastTransaction
        },
        recentTransactions: transactionHistory,
        // Include pagination metadata if needed
        metadata: {
          transactionCount: transactionHistory.length,
          hasMore: walletData.history ? Object.keys(walletData.history).length > 50 : false
        }
      },
      timestamp: Date.now()
    };
    
    res.status(200).json(response);
    
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/wallet/:userId/transactions
 * Get detailed transaction history with pagination
 */
router.get('/:userId/transactions', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { limit = 20, offset = 0 } = req.query;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'User ID is required'
      });
    }
    
    // Get wallet data
    const walletData = await getWalletBalance(userId);
    
    if (!walletData || !walletData.history) {
      return res.status(200).json({
        success: true,
        message: 'No transaction history found',
        data: {
          userId,
          transactions: [],
          pagination: {
            total: 0,
            limit: parseInt(limit),
            offset: parseInt(offset),
            hasMore: false
          }
        },
        timestamp: Date.now()
      });
    }
    
    // Convert history object to array and sort
    let allTransactions = Object.entries(walletData.history)
      .map(([orderId, transaction]) => ({
        orderId,
        ...transaction
      }))
      .sort((a, b) => b.timestamp - a.timestamp); // Most recent first
    
    // Apply pagination
    const startIndex = parseInt(offset);
    const endIndex = startIndex + parseInt(limit);
    const paginatedTransactions = allTransactions.slice(startIndex, endIndex);
    
    // Prepare pagination metadata
    const pagination = {
      total: allTransactions.length,
      limit: parseInt(limit),
      offset: parseInt(offset),
      hasMore: endIndex < allTransactions.length,
      nextOffset: endIndex < allTransactions.length ? endIndex : null
    };
    
    res.status(200).json({
      success: true,
      data: {
        userId,
        transactions: paginatedTransactions,
        pagination
      },
      timestamp: Date.now()
    });
    
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/wallet/:userId/statement
 * Generate wallet statement (summary by day/week/month)
 */
router.get('/:userId/statement', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { period = 'month', startDate, endDate } = req.query;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'User ID is required'
      });
    }
    
    // Get wallet data
    const walletData = await getWalletBalance(userId);
    
    if (!walletData || !walletData.history) {
      return res.status(200).json({
        success: true,
        message: 'No transaction history found',
        data: {
          userId,
          statement: [],
          period,
          startDate: startDate || 'N/A',
          endDate: endDate || 'N/A',
          summary: {
            openingBalance: 0,
            closingBalance: 0,
            totalCredits: 0,
            totalDebits: 0
          }
        },
        timestamp: Date.now()
      });
    }
    
    // Convert history to array
    const allTransactions = Object.entries(walletData.history)
      .map(([orderId, transaction]) => ({
        orderId,
        ...transaction
      }))
      .sort((a, b) => a.timestamp - b.timestamp); // Oldest first for statement
    
    // Filter by date range if provided
    let filteredTransactions = allTransactions;
    if (startDate) {
      const startTimestamp = new Date(startDate).getTime();
      filteredTransactions = filteredTransactions.filter(tx => tx.timestamp >= startTimestamp);
    }
    if (endDate) {
      const endTimestamp = new Date(endDate).getTime();
      filteredTransactions = filteredTransactions.filter(tx => tx.timestamp <= endTimestamp);
    }
    
    // Generate statement based on period
    let statement = [];
    let summary = {
      openingBalance: 0,
      closingBalance: walletData.balance || 0,
      totalCredits: 0,
      totalDebits: 0,
      netChange: 0
    };
    
    if (filteredTransactions.length > 0) {
      // Calculate opening balance (balance before first transaction in period)
      // This would require full transaction history or a separate opening balance field
      // For now, we'll assume opening balance is 0
      summary.openingBalance = 0;
      
      // Calculate totals
      summary.totalCredits = filteredTransactions
        .filter(tx => tx.type === 'CREDIT')
        .reduce((sum, tx) => sum + tx.amount, 0);
      
      summary.totalDebits = filteredTransactions
        .filter(tx => tx.type === 'DEBIT')
        .reduce((sum, tx) => sum + tx.amount, 0);
      
      summary.netChange = summary.totalCredits - summary.totalDebits;
      
      // Group transactions by period
      const periodMap = {};
      filteredTransactions.forEach(transaction => {
        const date = new Date(transaction.timestamp);
        let periodKey;
        
        switch (period) {
          case 'day':
            periodKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
            break;
          case 'week':
            // Get week number
            const weekNumber = Math.ceil(date.getDate() / 7);
            periodKey = `${date.getFullYear()}-W${weekNumber}`;
            break;
          case 'month':
          default:
            periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
            break;
        }
        
        if (!periodMap[periodKey]) {
          periodMap[periodKey] = {
            period: periodKey,
            credits: 0,
            debits: 0,
            transactions: []
          };
        }
        
        if (transaction.type === 'CREDIT') {
          periodMap[periodKey].credits += transaction.amount;
        } else {
          periodMap[periodKey].debits += transaction.amount;
        }
        
        periodMap[periodKey].transactions.push({
          orderId: transaction.orderId,
          amount: transaction.amount,
          type: transaction.type,
          timestamp: transaction.timestamp,
          date: date.toISOString()
        });
      });
      
      // Convert to array and sort
      statement = Object.values(periodMap)
        .map(periodData => ({
          ...periodData,
          netChange: periodData.credits - periodData.debits,
          transactionCount: periodData.transactions.length
        }))
        .sort((a, b) => {
          // Sort by first transaction timestamp in period
          const aTime = a.transactions[0]?.timestamp || 0;
          const bTime = b.transactions[0]?.timestamp || 0;
          return bTime - aTime; // Most recent first
        });
    }
    
    res.status(200).json({
      success: true,
      data: {
        userId,
        statement,
        period,
        startDate: startDate || new Date(filteredTransactions[0]?.timestamp || Date.now()).toISOString(),
        endDate: endDate || new Date(filteredTransactions[filteredTransactions.length - 1]?.timestamp || Date.now()).toISOString(),
        summary
      },
      timestamp: Date.now()
    });
    
  } catch (error) {
    next(error);
  }
});

module.exports = router;
