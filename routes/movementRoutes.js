const express = require('express');
const router = express.Router();
const { 
  createStockMovement, 
  getStockHistory, 
  getDepartmentStock,
  getMovementStatistics,
  getStockMovementById,
  updateStockMovement,
  deleteMovementController,
  canDeleteMovement
} = require('../controllers/stockMovementController');

// Input validation middleware
const validateMovementCreation = (req, res, next) => {
  const { type, department, stockManager, products } = req.body;
  
  if (!type || !stockManager || !products || !Array.isArray(products) || products.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: type, stockManager, products'
    });
  }
  
  if (type === 'distribution' && !department) {
    return res.status(400).json({
      success: false,
      message: 'Department is required for distribution movements'
    });
  }
  
  // Validate each product
  for (const product of products) {
    if (!product.productId || !product.productName || !product.quantity || !product.unit) {
      return res.status(400).json({
        success: false,
        message: 'Each product must have productId, productName, quantity, and unit'
      });
    }
    
    if (typeof product.quantity !== 'number' || product.quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Product quantity must be a positive number'
      });
    }
  }
  
  next();
};

// Routes
router.post('/', validateMovementCreation, createStockMovement);
router.get('/history', getStockHistory);
router.get('/departments/:department', getDepartmentStock);
router.get('/statistics', getMovementStatistics);
router.get('/:movementId', getStockMovementById);
router.put('/:movementId', updateStockMovement);
router.delete('/:id', deleteMovementController);

// GET /api/movements/:id/can-delete - Check if movement can be deleted
router.get('/movements/:id/can-delete', canDeleteMovement);

module.exports = router;