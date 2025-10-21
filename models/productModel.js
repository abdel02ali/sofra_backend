const { db } = require("../config/firebase");
const collection = db.collection("products");
const counterCollection = db.collection("counters");

// Get next sequential ID with leading zeros
const getNextProductId = async () => {
  const counterRef = counterCollection.doc("products");
  
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
    
    // Format with leading zeros (001, 002, ..., 010, 011, etc.)
    const formattedNumber = result.toString().padStart(3, '0');
    return `prod-${formattedNumber}`;
    
  } catch (error) {
    console.error("Error getting sequential ID:", error);
    // Fallback to timestamp if transaction fails
    const timestamp = Date.now().toString(36);
    return `prod-${timestamp}`;
  }
};

exports.createProduct = async (data) => {
  try {
    // Input validation
    if (!data.name || !data.name.trim()) {
      throw new Error('Product name is required');
    }

    if (!data.categories || !Array.isArray(data.categories) || data.categories.length === 0) {
      throw new Error('At least one category is required');
    }

    // Check for duplicate product name
    const productsSnapshot = await collection
      .where('name', '==', data.name.trim())
      .get();

    if (!productsSnapshot.empty) {
      const existingProduct = productsSnapshot.docs[0].data();
      throw new Error(`Product "${data.name}" already exists with ID: ${productsSnapshot.docs[0].id}`);
    }

    // Create the product
    const productId = await getNextProductId();
    
    const productData = {
      imageUrl: data.imageUrl || null,
      name: data.name.trim(),
      unit: data.unit || "unit",
      quantity: parseInt(data.quantity) || 0, // Keep both for compatibility
      categories: data.categories, // Array of categories
      primaryCategory: data.primaryCategory || data.categories[0], // First category as primary
      description: data.description || "",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastUsed: null, // Will be updated when product is actually used
      usageHistory: [], // Array to track usage events
      totalUsed: 0, // Total quantity used historically
    };
    
    await collection.doc(productId).set(productData);
    
    return { 
      id: productId,
      message: 'Product created successfully'
    };
  } catch (error) {
    console.error('Error creating product:', error);
    throw error;
  }
};
exports.getAllProducts = async () => {
  const snapshot = await collection.get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};
// Track when a product is used/distributed to departments
exports.recordProductUsage = async (productId, usageData) => {
  try {
    const productRef = collection.doc(productId);
    const productDoc = await productRef.get();
    
    if (!productDoc.exists) {
      throw new Error('Product not found');
    }

    const product = productDoc.data();
    const usageQuantity = parseInt(usageData.quantity) || 0;
    
    // Validate sufficient stock
    if (usageQuantity > product.q) {
      throw new Error(`Insufficient stock. Available: ${product.q}, Requested: ${usageQuantity}`);
    }

    const usageRecord = {
      id: generateId(), // Simple ID generator
      quantity: usageQuantity,
      department: usageData.department,
      purpose: usageData.purpose || 'General use',
      usedBy: usageData.usedBy || 'System',
      usedAt: new Date(),
      notes: usageData.notes || ''
    };

    // Update product with atomic operations
    await productRef.update({
      
      quantity: admin.firestore.FieldValue.increment(-usageQuantity),
      lastUsed: new Date(),
      totalUsed: admin.firestore.FieldValue.increment(usageQuantity),
      usageHistory: admin.firestore.FieldValue.arrayUnion(usageRecord),
      updatedAt: new Date()
    });

    return {
      message: 'Product usage recorded successfully',
      remainingStock: product.q - usageQuantity,
      usageRecord: usageRecord
    };
  } catch (error) {
    console.error('Error recording product usage:', error);
    throw error;
  }
};
exports.getProductById = async (id) => {
  const doc = await collection.doc(id).get();
  if (!doc.exists) throw new Error("Product not found");
  return { id: doc.id, ...doc.data() };
};

exports.updateProduct = async (productId, updateData) => {
  try {
    const productRef = collection.doc(productId);
    const productDoc = await productRef.get();
    
    if (!productDoc.exists) {
      throw new Error('Product not found');
    }

    const allowedFields = ['name', 'unit', 'description', 'categories', 'primaryCategory', 'imageUrl'];
    const updates = {
      updatedAt: new Date()
    };

    // Only allow specific fields to be updated
    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        if (field === 'name' && updateData.name) {
          updates.name = updateData.name.trim();
        } else if (field === 'categories' && updateData.categories) {
          if (!Array.isArray(updateData.categories) || updateData.categories.length === 0) {
            throw new Error('Categories must be a non-empty array');
          }
          updates.categories = updateData.categories;
          updates.primaryCategory = updateData.primaryCategory || updateData.categories[0];
        } else {
          updates[field] = updateData[field];
        }
      }
    });

    // If name is being updated, check for duplicates (excluding current product)
    if (updateData.name) {
      const productsSnapshot = await collection
        .where('name', '==', updateData.name.trim())
        .get();

      const duplicate = productsSnapshot.docs.find(doc => doc.id !== productId);
      if (duplicate) {
        throw new Error(`Product name "${updateData.name}" is already in use`);
      }
    }

    await productRef.update(updates);

    return {
      message: 'Product updated successfully',
      updatedFields: Object.keys(updates).filter(key => key !== 'updatedAt')
    };
  } catch (error) {
    console.error('Error updating product:', error);
    throw error;
  }
};

exports.deleteProduct = async (id) => {
  await collection.doc(id).delete();
  return { success: true };
};

// Add quantities function (keep your existing implementation)
exports.addQuantitiesToProducts = async (products) => {
  const results = [];
  const batch = db.batch();
  
  for (const product of products) {
    try {
      const docRef = collection.doc(product.productId);
      const doc = await docRef.get();
      
      if (!doc.exists) {
        results.push({
          productId: product.productId,
          success: false,
          error: 'Product not found'
        });
        continue;
      }
      
      const currentProduct = { id: doc.id, ...doc.data() };
      const currentQuantity = currentProduct.q || 0;
      const newQuantity = currentQuantity + product.quantityToAdd;
      
      batch.update(docRef, { 
        q: newQuantity,
        updatedAt: new Date() 
      });
      
      results.push({
        productId: product.productId,
        productName: currentProduct.name,
        oldQuantity: currentQuantity,
        quantityAdded: product.quantityToAdd,
        newQuantity: newQuantity,
        success: true
      });
      
    } catch (error) {
      results.push({
        productId: product.productId,
        success: false,
        error: error.message
      });
    }
  }
  
  await batch.commit();
  return results;
};
exports.removeQuantitiesFromProducts = async (products) => {
  const results = [];
  const batch = db.batch();
  
  for (const product of products) {
    try {
      const docRef = db.collection('products').doc(product.productId); // Fixed: added db.collection
      const doc = await docRef.get();
      
      if (!doc.exists) {
        results.push({
          productId: product.productId,
          success: false,
          error: 'Product not found'
        });
        continue;
      }
      
      const currentProduct = { id: doc.id, ...doc.data() };
      const currentQuantity = currentProduct.q || currentProduct.quantity || 0;
      
      // Check if enough stock exists
      if (currentQuantity < product.quantityToRemove) {
        results.push({
          productId: product.productId,
          productName: currentProduct.name,
          success: false,
          error: `Insufficient stock. Available: ${currentQuantity}, Requested to remove: ${product.quantityToRemove}`
        });
        continue;
      }
      
      const newQuantity = currentQuantity - product.quantityToRemove;
      
      batch.update(docRef, { 
        q: newQuantity,
        quantity: newQuantity, // Also update quantity field for consistency
        updatedAt: new Date() 
      });
      
      results.push({
        productId: product.productId,
        productName: currentProduct.name,
        oldQuantity: currentQuantity,
        quantityRemoved: product.quantityToRemove,
        newQuantity: newQuantity,
        success: true
      });
      
    } catch (error) {
      results.push({
        productId: product.productId,
        success: false,
        error: error.message
      });
    }
  }
  
  await batch.commit();
  return results;
};