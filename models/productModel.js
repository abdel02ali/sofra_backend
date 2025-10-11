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

    if (!data.price || data.price <= 0) {
      throw new Error('Valid product price is required');
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
    
    await collection.doc(productId).set({
      imageUrl: data.imageUrl || null,
      name: data.name.trim(),
      price: parseFloat(data.price),
      q: parseInt(data.quantity) || 0,
      description: data.description || "",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    
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

exports.getProductById = async (id) => {
  const doc = await collection.doc(id).get();
  if (!doc.exists) throw new Error("Product not found");
  return { id: doc.id, ...doc.data() };
};

exports.updateProduct = async (id, data) => {
  await collection.doc(id).update({
    ...data,
    updatedAt: new Date()
  });
  return { success: true };
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