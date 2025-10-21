const movementModel = require('../models/movementModel');
const ProductModel = require("../models/productModel");

// Validation schemas
const validateMovementData = (data) => {
  const requiredFields = ['type', 'stockManager', 'products'];
  const missingFields = requiredFields.filter(field => !data[field]);
  
  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
  }
  
  if (!Array.isArray(data.products) || data.products.length === 0) {
    throw new Error('Products must be a non-empty array');
  }
  
  if (typeof data.stockManager !== 'string' || data.stockManager.trim() === '') {
    throw new Error('Stock manager name is required');
  }
  
  const validMovementTypes = ['stock_in', 'distribution'];
  if (!validMovementTypes.includes(data.type)) {
    throw new Error(`Invalid movement type. Must be one of: ${validMovementTypes.join(', ')}`);
  }
  
  if (data.type === 'distribution' && !data.department) {
    throw new Error('Department is required for distribution movements');
  }
  
  // Validate each product
  data.products.forEach((product, index) => {
    if (!product.productId || !product.productName || product.quantity == null || !product.unit) {
      throw new Error(`Product ${index + 1} is missing required fields: productId, productName, quantity, or unit`);
    }
    
    if (typeof product.quantity !== 'number' || product.quantity <= 0) {
      throw new Error(`Product ${index + 1} quantity must be a positive number`);
    }
  });
};

exports.createStockMovement = async (req, res) => {
  try {
    const movementData = req.body;
    console.log('🔄 Creating stock movement:', { 
      type: movementData.type,
      productsCount: movementData.products?.length,
      department: movementData.department
    });
    
    // Validate input data
    validateMovementData(movementData);
    
    const result = await movementModel.createStockMovement(movementData);
    
    console.log('✅ Stock movement created successfully:', {
      movementId: result.id,
      type: movementData.type
    });
    
    return res.status(201).json({
      success: true,
      message: result.message,
      data: result.data,
      movementId: result.id
    });
    
  } catch (error) {
    console.error('❌ Error creating stock movement:', error.message);
    
    const statusCode = error.message.includes('validation') || 
                      error.message.includes('Missing') || 
                      error.message.includes('Invalid') ? 400 : 500;
    
    return res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

// FIXED: getStockHistory with better error handling
exports.getStockHistory = async (req, res) => {
  try {
    const filters = req.query;
    console.log('📊 Fetching stock history with filters:', filters);
    
    const result = await movementModel.getAllMovements(filters);
    
    console.log(`✅ Found ${result.data.length} stock movements`);
    
    return res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });
    
  } catch (error) {
    console.error('❌ Error fetching stock history:', error.message);
    
    // Provide specific error messages for index issues
    if (error.message.includes('index') || error.message.includes('FAILED_PRECONDITION')) {
      return res.status(400).json({
        success: false,
        message: 'Database index required for this query. Please try using only one filter (type OR department) at a time.',
        error: 'Index required'
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'Internal server error while fetching stock history'
    });
  }
};

// FIXED: getDepartmentStock
exports.getDepartmentStock = async (req, res) => {
  try {
    const { department } = req.params;
    
    if (!department) {
      return res.status(400).json({
        success: false,
        message: 'Department parameter is required'
      });
    }
    
    console.log(`📊 Fetching stock history for department: ${department}`);
    
    const result = await movementModel.getMovementsByDepartment(department);
    
    console.log(`✅ Found ${result.totalDistributions} distributions for ${department}`);
    
    return res.status(200).json({
      success: true,
      data: result,
      department: department
    });
    
  } catch (error) {
    console.error('❌ Error fetching department stock:', error.message);
    
    if (error.message.includes('index')) {
      return res.status(400).json({
        success: false,
        message: 'Database index not ready. Please try again in a few minutes.'
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'Internal server error while fetching department stock'
    });
  }
};

exports.getMovementStatistics = async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    
    // Validate period parameter
    const validPeriods = ['today', 'week', 'month', 'year'];
    if (!validPeriods.includes(period)) {
      return res.status(400).json({
        success: false,
        message: `Invalid period. Must be one of: ${validPeriods.join(', ')}`
      });
    }
    
    console.log(`📈 Fetching movement statistics for period: ${period}`);
    
    const statistics = await movementModel.getMovementStatistics(period);
    
    return res.status(200).json({
      success: true,
      data: statistics,
      period: period
    });
    
  } catch (error) {
    console.error('❌ Error fetching movement statistics:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while generating statistics'
    });
  }
};

exports.getStockMovementById = async (req, res) => {
  try {
    const { movementId } = req.params;
    
    if (!movementId) {
      return res.status(400).json({
        success: false,
        message: 'Movement ID is required'
      });
    }
    
    console.log(`📋 Fetching stock movement: ${movementId}`);
    
    const movement = await movementModel.getMovementById(movementId);
    
    return res.status(200).json({
      success: true,
      data: movement
    });
    
  } catch (error) {
    console.error('❌ Error fetching stock movement:', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: 'Stock movement not found'
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'Internal server error while fetching stock movement'
    });
  }
};

exports.updateStockMovement = async (req, res) => {
  try {
    const { movementId } = req.params;
    const updateData = req.body;
    
    if (!movementId) {
      return res.status(400).json({
        success: false,
        message: 'Movement ID is required'
      });
    }
    
    console.log('🔄 Updating stock movement:', { movementId });
    
    // For now, return not implemented
    return res.status(501).json({
      success: false,
      message: 'Update movement functionality not implemented yet'
    });
    
  } catch (error) {
    console.error('❌ Error updating stock movement:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
// controllers/stockMovementController.js

const { db } = require('../config/firebase');


/**
 * Controller for deleting stock movements
 * - Validates if movement is within 24 hours
 * - Restores stock levels based on movement type
 * - Deletes the movement document
 */
exports.deleteMovementController = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log("🗑️ Controller: Starting movement deletion for ID:", id);

    // Validate movement ID
    if (!id || typeof id !== 'string') {
      return res.status(400).json({
        success: false,
        message: "Valid movement ID is required",
        errors: ["Movement ID is missing or invalid"]
      });
    }

    // Call the model function that contains all the business logic
    const result = await movementModel.deleteMovement(id);

    // If successful, return success response
    if (result.success) {
      return res.status(200).json({
        success: true,
        message: result.message,
        data: result.data
      });
    }

    // If not successful, handle different error cases
    if (result.code === "MOVEMENT_TOO_OLD") {
      return res.status(400).json({
        success: false,
        message: result.message,
        code: result.code,
        errors: result.errors || [result.message]
      });
    }

    if (result.code === "MOVEMENT_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: result.message,
        code: result.code,
        errors: result.errors || [result.message]
      });
    }

    if (result.code === "STOCK_RESTORATION_FAILED") {
      return res.status(409).json({
        success: false,
        message: result.message,
        code: result.code,
        errors: result.errors || [result.message]
      });
    }

    // Generic error response
    return res.status(500).json({
      success: false,
      message: result.message || 'Failed to delete movement',
      code: result.code || "INTERNAL_ERROR",
      errors: result.errors || [result.message]
    });

  } catch (error) {
    console.error('❌ Controller error in deleteMovement:', error);
    
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error while deleting movement',
      code: "INTERNAL_ERROR",
      errors: [error.message || 'An unexpected error occurred']
    });
  }
};
/**
 * Utility function to check if a movement can be deleted (within 24 hours)
 * This can be used by the frontend to show/hide delete button
 */
exports.canDeleteMovement = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({
        success: false,
        message: "Valid movement ID is required"
      });
    }

    const movementDoc = await db.collection("stockMovements").doc(id).get();
    
    if (!movementDoc.exists) {
      return res.status(404).json({
        success: false,
        message: "Movement not found"
      });
    }

    const movement = movementDoc.data();
    const movementTimestamp = movement.timestamp?.toDate 
      ? movement.timestamp.toDate() 
      : new Date(movement.timestamp || movement.createdAt);
    
    const now = new Date();
    const timeDiff = now - movementTimestamp;
    const hoursDiff = timeDiff / (1000 * 60 * 60);
    const canDelete = hoursDiff <= 24;

    return res.status(200).json({
      success: true,
      data: {
        canDelete,
        movementId: movement.movementId,
        movementTime: movementTimestamp.toISOString(),
        currentTime: now.toISOString(),
        hoursDifference: hoursDiff.toFixed(2),
        timeRemaining: canDelete ? (24 - hoursDiff).toFixed(2) : 0
      }
    });

  } catch (error) {
    console.error('❌ Error in canDeleteMovement:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};