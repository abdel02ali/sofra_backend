const { db } = require("../config/firebase");
const collection = db.collection("stockMovements");
const counterCollection = db.collection("counters");
const ProductModel = require("../models/productModel");

// Get next sequential movement ID with leading zeros
const getNextMovementId = async () => {
  const counterRef = counterCollection.doc("stockMovements");
  
  try {
    // Use transaction to safely increment counter
    const result = await db.runTransaction(async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      
      let currentCount = 1;
      if (counterDoc.exists) {
        currentCount = counterDoc.data().count + 1;
      }
      
      transaction.set(counterRef, { count: currentCount });
      return currentCount;
    });
    
    // Format with leading zeros (000001, 000002, etc.)
    const formattedNumber = result.toString().padStart(6, '0');
    return `MOV${formattedNumber}`;
    
  } catch (error) {
    console.error("Error getting sequential movement ID:", error);
    // Fallback to timestamp if transaction fails
    const timestamp = Date.now().toString(36);
    return `MOV${timestamp}`;
  }
};

const removeUndefinedProperties = (obj) => {
  const cleaned = { ...obj };
  Object.keys(cleaned).forEach(key => {
    if (cleaned[key] === undefined) {
      delete cleaned[key];
    }
  });
  return cleaned;
};

exports.createStockMovement = async (data) => {
  try {
    console.log("🔄 Starting stock movement creation:", data);

    // 🧩 Validate required fields
    if (!data.type || !["stock_in", "distribution"].includes(data.type)) {
      throw new Error("Valid movement type is required (stock_in or distribution)");
    }

    if (!data.products || !Array.isArray(data.products) || data.products.length === 0) {
      throw new Error("At least one product is required");
    }

    if (!data.stockManager || !data.stockManager.trim()) {
      throw new Error("Stock manager is required");
    }

    if (data.type === "distribution" && !data.department) {
      throw new Error("Department is required for distributions");
    }

    if (data.type === "stock_in" && !data.supplier) {
      throw new Error("Supplier is required for stock in");
    }

    // 🧾 Validate products and get current stock levels
    const productsCollection = db.collection("products");
    const validationErrors = [];
    const validProducts = [];
    let totalValue = 0;

    for (const p of data.products) {
      if (!p.productId || !p.quantity || p.quantity <= 0) {
        validationErrors.push(`Invalid product or quantity: ${JSON.stringify(p)}`);
        continue;
      }

      const productSnap = await productsCollection.doc(p.productId).get();
      if (!productSnap.exists) {
        validationErrors.push(`Product not found: ${p.productId}`);
        continue;
      }

      const productData = productSnap.data();
      const currentStock = parseInt(productData.quantity || 0);
      const unitPrice = parseFloat(p.price || productData.price || 0);
      
      // Calculate new stock based on movement type
      let newStock;
      if (data.type === "stock_in") {
        newStock = currentStock + parseInt(p.quantity);
        totalValue += unitPrice * p.quantity;
      } else {
        newStock = currentStock - parseInt(p.quantity);
        // Validate stock availability for distributions
        if (newStock < 0) {
          validationErrors.push(`Insufficient stock for ${productData.name}. Available: ${currentStock}, Requested: ${p.quantity}`);
          continue;
        }
      }

      validProducts.push({
        ...p,
        name: productData.name,
        unit: productData.unit || "units",
        currentStock: currentStock,
        previousStock: currentStock,
        newStock: newStock,
        unitPrice: unitPrice,
      });
    }

    if (validationErrors.length > 0) {
      throw new Error(`Validation errors: ${validationErrors.join(", ")}`);
    }

    // 🧮 Movement ID
    const movementId = await getNextMovementId();
    console.log(`🎯 Generated movement ID: ${movementId}`);

    // 📦 Apply stock updates using your existing model functions
    if (data.type === "stock_in") {
      console.log("⬆️ Adding quantities to stock...");
      await ProductModel.addQuantitiesToProducts(
        validProducts.map((p) => ({
          productId: p.productId,
          quantityToAdd: p.quantity,
        }))
      );
    } else if (data.type === "distribution") {
      console.log("⬇️ Removing quantities from stock...");
      await ProductModel.removeQuantitiesFromProducts(
        validProducts.map((p) => ({
          productId: p.productId,
          quantityToRemove: p.quantity,
        }))
      );
    }

    // 🕒 Format date
    const now = new Date();
    const formattedDate = `${String(now.getDate()).padStart(2, "0")}/${String(
      now.getMonth() + 1
    ).padStart(2, "0")}/${now.getFullYear()}`;

    // 🧾 Prepare movement document with stock tracking
    const movementData = {
      id: movementId,
      movementId,
      type: data.type,
      department: data.department || null,
      supplier: data.supplier || null,
      stockManager: data.stockManager.trim(),
      products: validProducts.map((p) => ({
        productId: p.productId,
        productName: p.name,
        quantity: p.quantity,
        unit: p.unit,
        unitPrice: p.unitPrice,
        total: p.unitPrice * p.quantity,
        previousStock: p.previousStock,
        newStock: p.newStock
      })),
      totalValue: totalValue,
      totalItems: validProducts.reduce((sum, p) => sum + parseInt(p.quantity), 0),
      notes: data.notes || "",
      date: formattedDate,
      timestamp: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // 🗃️ Save movement
    await db.collection("stockMovements").doc(movementId).set(movementData);

    console.log("✅ Stock movement created successfully:", movementId);

    return {
      success: true,
      id: movementId,
      data: movementData,
      message:
        data.type === "stock_in"
          ? "Stock added successfully"
          : "Stock distributed successfully",
    };
  } catch (error) {
    console.error("❌ Error creating stock movement:", error);
    return {
      success: false,
      message: error.message,
    };
  }
};
// FIXED: getAllMovements function
exports.getAllMovements = async (filters = {}) => {
  try {
    console.log('📊 Model: Getting all movements with filters:', filters);
    
    let query = collection;
    
    // Apply filters carefully to avoid composite index issues
    if (filters.type && filters.type !== 'all' && filters.department && filters.department !== 'all') {
      // If both type and department are specified, we need the composite index
      query = query
        .where('type', '==', filters.type)
        .where('department', '==', filters.department)
        .orderBy('timestamp', 'desc');
    } 
    else if (filters.type && filters.type !== 'all') {
      // Only type filter
      query = query
        .where('type', '==', filters.type)
        .orderBy('timestamp', 'desc');
    }
    else if (filters.department && filters.department !== 'all') {
      // Only department filter
      query = query
        .where('department', '==', filters.department)
        .orderBy('timestamp', 'desc');
    }
    else {
      // No filters or just date filters - order by timestamp
      query = query.orderBy('timestamp', 'desc');
    }
    
    // Apply date filters if provided
    if (filters.startDate) {
      const start = new Date(filters.startDate);
      query = query.where('timestamp', '>=', start);
    }

    if (filters.endDate) {
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      query = query.where('timestamp', '<=', end);
    }

    // Pagination
    const limit = parseInt(filters.limit) || 50;
    const page = parseInt(filters.page) || 1;
    
    console.log('🔍 Executing Firestore query...');
    const snapshot = await query.limit(limit).get();

    if (snapshot.empty) {
      console.log('ℹ️  No movements found');
      return {
        data: [],
        pagination: {
          page,
          limit,
          total: 0,
          pages: 0,
          hasMore: false
        }
      };
    }

    const movements = snapshot.docs.map(doc => {
      const data = doc.data();
      // Convert Firestore timestamps to Date objects
      return {
        id: doc.id,
        ...data,
        timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp),
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt)
      };
    });

    // For simplicity, we'll return basic pagination info
    // In production, you might want to get total count separately
    console.log(`✅ Found ${movements.length} movements`);
    
    return {
      data: movements,
      pagination: {
        page,
        limit,
        total: movements.length, // This is just for current page
        pages: Math.ceil(movements.length / limit),
        hasMore: movements.length === limit
      }
    };
    
  } catch (error) {
    console.error('❌ Firestore error in getAllMovements:', error);
    console.error('❌ Error code:', error.code);
    console.error('❌ Error details:', error.details);
    
    // Provide more specific error messages
    if (error.code === 9) { // FAILED_PRECONDITION - index required
      throw new Error('Database index required for this query. Please try a simpler filter or wait for indexes to build.');
    }
    
    throw new Error(`Failed to fetch movements: ${error.message}`);
  }
};

exports.getMovementById = async (id) => {
  try {
    const doc = await collection.doc(id).get();
    if (!doc.exists) throw new Error("Stock movement not found");
    
    const data = doc.data();
    // Convert Firestore timestamps
    return {
      id: doc.id,
      ...data,
      timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp),
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
      updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt)
    };
  } catch (error) {
    console.error('Error getting movement by ID:', error);
    throw error;
  }
};

// FIXED: getMovementsByDepartment function
exports.getMovementsByDepartment = async (department) => {
  try {
    console.log('🔍 Getting movements for department:', department);
    
    // Simple query - only filter by department
    const movementsSnapshot = await collection
      .where('department', '==', department)
      .orderBy('timestamp', 'desc')
      .limit(50)
      .get();
    
    if (movementsSnapshot.empty) {
      console.log(`ℹ️  No movements found for department: ${department}`);
      return {
        department: department,
        totalDistributions: 0,
        totalProductsDistributed: 0,
        productBreakdown: [],
        recentMovements: []
      };
    }
    
    const movements = [];
    let totalDistributions = 0;
    let totalProductsDistributed = 0;
    const productBreakdownMap = new Map();
    
    movementsSnapshot.forEach(doc => {
      const data = doc.data();
      const movement = {
        id: doc.id,
        ...data,
        timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp),
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt)
      };
      movements.push(movement);
      
      // Count distributions and products
      if (movement.type === 'distribution') {
        totalDistributions++;
        totalProductsDistributed += movement.totalItems || 0;
        
        // Calculate product breakdown
        if (movement.products && Array.isArray(movement.products)) {
          movement.products.forEach(product => {
            const key = product.productId;
            if (!productBreakdownMap.has(key)) {
              productBreakdownMap.set(key, {
                productId: product.productId,
                productName: product.productName,
                totalQuantity: 0,
                unit: product.unit
              });
            }
            const existing = productBreakdownMap.get(key);
            existing.totalQuantity += product.quantity || 0;
          });
        }
      }
    });
    
    const productBreakdown = Array.from(productBreakdownMap.values());
    
    console.log(`✅ Found ${totalDistributions} distributions for ${department}`);
    
    return {
      department: department,
      totalDistributions,
      totalProductsDistributed,
      productBreakdown,
      recentMovements: movements.slice(0, 10) // Last 10 movements
    };
    
  } catch (error) {
    console.error('❌ Error in getMovementsByDepartment:', error);
    
    if (error.code === 9) { // FAILED_PRECONDITION
      throw new Error('Database index required. Please wait for indexes to build or try again later.');
    }
    
    throw new Error(`Failed to fetch department movements: ${error.message}`);
  }
};

// FIXED: getMovementStatistics function
exports.getMovementStatistics = async (period = 'month') => {
  try {
    const now = new Date();
    let startDate;

    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    console.log(`📈 Getting statistics for period: ${period}, from: ${startDate}`);
    
    const snapshot = await collection
      .where('timestamp', '>=', startDate)
      .orderBy('timestamp', 'desc')
      .get();

    if (snapshot.empty) {
      return {
        totalMovements: 0,
        stockInCount: 0,
        distributionCount: 0,
        totalStockIn: 0,
        totalDistribution: 0,
        totalValue: 0,
        departmentBreakdown: [],
        topProducts: []
      };
    }

    const movements = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp)
      };
    });

    const statistics = {
      totalMovements: movements.length,
      stockInCount: movements.filter(m => m.type === 'stock_in').length,
      distributionCount: movements.filter(m => m.type === 'distribution').length,
      totalStockIn: movements
        .filter(m => m.type === 'stock_in')
        .reduce((sum, m) => sum + (m.totalItems || 0), 0),
      totalDistribution: movements
        .filter(m => m.type === 'distribution')
        .reduce((sum, m) => sum + (m.totalItems || 0), 0),
      totalValue: movements
        .filter(m => m.type === 'stock_in')
        .reduce((sum, m) => sum + (m.totalValue || 0), 0),
      departmentBreakdown: {},
      topProducts: {}
    };

    // Calculate department breakdown
    movements.forEach(movement => {
      if (movement.type === 'distribution' && movement.department) {
        if (!statistics.departmentBreakdown[movement.department]) {
          statistics.departmentBreakdown[movement.department] = 0;
        }
        statistics.departmentBreakdown[movement.department] += movement.totalItems || 0;
      }
    });

    // Calculate top products
    movements.forEach(movement => {
      if (movement.products && Array.isArray(movement.products)) {
        movement.products.forEach(product => {
          if (product.productId) {
            if (!statistics.topProducts[product.productId]) {
              statistics.topProducts[product.productId] = {
                productName: product.productName || 'Unknown Product',
                totalQuantity: 0
              };
            }
            statistics.topProducts[product.productId].totalQuantity += product.quantity || 0;
          }
        });
      }
    });

    // Convert to arrays and sort
    statistics.departmentBreakdown = Object.entries(statistics.departmentBreakdown)
      .map(([department, quantity]) => ({ department, quantity }))
      .sort((a, b) => b.quantity - a.quantity);

    statistics.topProducts = Object.values(statistics.topProducts)
      .sort((a, b) => b.totalQuantity - a.totalQuantity)
      .slice(0, 10);

    console.log(`✅ Generated statistics: ${statistics.totalMovements} movements`);
    
    return statistics;
    
  } catch (error) {
    console.error('Error getting movement statistics:', error);
    throw error;
  }
};

// controllers/stockMovementController.js

 // Import your movement model

/**
 * Controller for deleting stock movements
 * Handles HTTP responses and errors from the model
 */
exports.deleteMovement = async (id) => {
  try {
    console.log("🗑️ Model: Starting movement deletion for ID:", id);

    // Get the movement document
    const movementDoc = await db.collection("stockMovements").doc(id).get();
    
    if (!movementDoc.exists) {
      return {
        success: false,
        message: "Movement not found",
        code: "MOVEMENT_NOT_FOUND",
        errors: [`Movement with ID ${id} does not exist`]
      };
    }

    const movement = {
      id: movementDoc.id,
      ...movementDoc.data()
    };

    // 24-hour check logic
    const movementTimestamp = movement.timestamp?.toDate 
      ? movement.timestamp.toDate() 
      : new Date(movement.timestamp || movement.createdAt);
    
    const now = new Date();
    const timeDiff = now - movementTimestamp;
    const hoursDiff = timeDiff / (1000 * 60 * 60);

    if (hoursDiff > 24) {
      return {
        success: false,
        message: "Cannot delete movement older than 24 hours",
        code: "MOVEMENT_TOO_OLD",
        errors: [
          `Movement was created ${hoursDiff.toFixed(2)} hours ago`,
          "Only movements from the last 24 hours can be deleted"
        ]
      };
    }

    // Stock restoration logic - FIXED: Handle array responses from ProductModel
    let stockRestorationResults;
    
    if (movement.type === "stock_in") {
      stockRestorationResults = await ProductModel.removeQuantitiesFromProducts(
        movement.products.map((p) => ({
          productId: p.productId,
          quantityToRemove: p.quantity,
        }))
      );
    } else if (movement.type === "distribution") {
      stockRestorationResults = await ProductModel.addQuantitiesToProducts(
        movement.products.map((p) => ({
          productId: p.productId,
          quantityToAdd: p.quantity,
        }))
      );
    }

    // Check if any product operations failed
    const failedOperations = stockRestorationResults.filter(result => !result.success);
    
    if (failedOperations.length > 0) {
      const errorMessages = failedOperations.map(op => 
        `Product ${op.productId}: ${op.error}`
      );
      
      return {
        success: false,
        message: "Failed to restore stock levels for some products",
        code: "STOCK_RESTORATION_FAILED",
        errors: errorMessages,
        details: {
          totalProducts: movement.products.length,
          successful: stockRestorationResults.filter(r => r.success).length,
          failed: failedOperations.length,
          failures: failedOperations
        }
      };
    }

    // All stock operations succeeded, now delete the movement
    await db.collection("stockMovements").doc(id).delete();

    console.log("✅ Movement deleted and stock restored successfully");

    return {
      success: true,
      message: 'Movement deleted successfully and stock levels restored',
      data: {
        movementId: movement.movementId,
        type: movement.type,
        deletedAt: new Date().toISOString(),
        productsAffected: movement.products.length,
        stockRestored: true,
        movementAgeHours: hoursDiff.toFixed(2),
        restorationDetails: {
          totalProducts: stockRestorationResults.length,
          allSuccessful: true,
          results: stockRestorationResults
        }
      }
    };

  } catch (error) {
    console.error('❌ Model error in deleteMovement:', error);
    return {
      success: false,
      message: error.message || 'Failed to delete movement',
      code: "INTERNAL_ERROR",
      errors: [error.message]
    };
  }
};

exports.checkMovementDeletable = async (id) => {
  try {
    const movementDoc = await db.collection("stockMovements").doc(id).get();
    
    if (!movementDoc.exists) {
      return {
        success: false,
        message: "Movement not found",
        errors: [`Movement with ID ${id} does not exist`]
      };
    }

    const movement = movementDoc.data();
    const movementTimestamp = movement.timestamp?.toDate 
      ? movement.timestamp.toDate() 
      : new Date(movement.timestamp || movement.createdAt);
    
    const now = new Date();
    const timeDiff = now - movementTimestamp;
    const hoursDiff = timeDiff / (1000 * 60 * 60);
    const canDelete = hoursDiff <= 24;
    const timeRemaining = canDelete ? (24 - hoursDiff) : 0;

    return {
      success: true,
      data: {
        canDelete,
        movementId: movement.movementId,
        movementTime: movementTimestamp.toISOString(),
        currentTime: now.toISOString(),
        hoursDifference: parseFloat(hoursDiff.toFixed(2)),
        timeRemaining: parseFloat(timeRemaining.toFixed(2)),
        timeRemainingFormatted: `${Math.floor(timeRemaining)}h ${Math.round((timeRemaining % 1) * 60)}m`,
        isExpired: !canDelete
      }
    };

  } catch (error) {
    console.error('❌ Model error in checkMovementDeletable:', error);
    return {
      success: false,
      message: error.message || 'Failed to check deletion status',
      errors: [error.message]
    };
  }
};