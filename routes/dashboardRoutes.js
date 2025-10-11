const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardCon');

// Get dashboard statistics with date filtering
router.get('/stats', async (req, res) => {
  try {
    const { period = 'daily' } = req.query; // daily, weekly, monthly, all
    console.log(`📊 Fetching dashboard stats for period: ${period}`);
    
    const stats = await dashboardController.getDashboardStats(period);
    
    res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    console.error('❌ Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get recent invoices
router.get('/recent-invoices', async (req, res) => {
  try {
    const { limit = 5 } = req.query;
    console.log(`📋 Fetching recent invoices, limit: ${limit}`);
    
    const invoices = await dashboardController.getRecentInvoices(parseInt(limit));
    
    res.json({
      success: true,
      data: invoices
    });
    
  } catch (error) {
    console.error('❌ Error fetching recent invoices:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get out of stock products
router.get('/out-of-stock', async (req, res) => {
  try {
    console.log('📦 Fetching out of stock products');
    
    const products = await dashboardController.getOutOfStockProducts();
    
    res.json({
      success: true,
      data: products
    });
    
  } catch (error) {
    console.error('❌ Error fetching out of stock products:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;