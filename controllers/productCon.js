const ProductModel = require("../models/productModel");

exports.addProduct = async (req, res) => {
  try {
    const result = await ProductModel.createProduct(req.body);
    res.status(201).send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};

exports.getProducts = async (req, res) => {
  try {
    const products = await ProductModel.getAllProducts();
    res.send(products);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};

exports.getProduct = async (req, res) => {
  try {
    const product = await ProductModel.getProductById(req.params.id);
    res.send(product);
  } catch (err) {
    res.status(404).send({ error: err.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    await ProductModel.updateProduct(req.params.id, req.body);
    res.send({ success: true });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    await ProductModel.deleteProduct(req.params.id);
    res.send({ success: true });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};
exports.addProductQuantities = async (req, res) => {
  try {
    console.log('📦 Received add quantities request:', req.body);
    
    const { products } = req.body;
    
    if (!products || !Array.isArray(products) || products.length === 0) {
      console.log('❌ Invalid products array');
      return res.status(400).send({ error: "Products array is required and cannot be empty" });
    }

    // Validate each product in the array
    for (const product of products) {
      if (!product.productId || product.quantityToAdd === undefined || product.quantityToAdd === null) {
        console.log('❌ Missing productId or quantityToAdd');
        return res.status(400).send({ 
          error: "Each product must have productId and quantityToAdd" 
        });
      }
      if (product.quantityToAdd < 0) {
        console.log('❌ Negative quantity');
        return res.status(400).send({ 
          error: "quantityToAdd cannot be negative" 
        });
      }
    }

    console.log('✅ Validation passed, updating quantities...');
    const results = await ProductModel.addQuantitiesToProducts(products);
    
    console.log('✅ Quantities updated successfully');
    res.send({ 
      success: true, 
      message: `Successfully updated quantities for ${results.length} products`,
      results 
    });
    
  } catch (err) {
    console.error('❌ Error in addProductQuantities:', err);
    res.status(500).send({ error: err.message });
  }
};
// Remove quantities from products
// Remove quantities from products
exports.removeProductQuantities = async (req, res) => {
  try {
    console.log('📤 Received remove quantities request:', req.body);
    
    const { products } = req.body;

    if (!products || !Array.isArray(products) || products.length === 0) {
      console.log('❌ Invalid products array');
      return res.status(400).json({ 
        success: false, 
        message: 'Products array is required and cannot be empty' 
      });
    }

    console.log('🔄 Removing quantities from products...');
    
    // Use the model function
    const results = await ProductModel.removeQuantitiesFromProducts(products);
    
    console.log('✅ Quantities removed successfully');
    
    res.json({
      success: true,
      message: `Processed ${results.length} products`,
      results: results
    });

  } catch (error) {
    console.error('❌ Error in removeProductQuantities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove quantities',
      error: error.message
    });
  }
};