// controllers/invoiceController.js
const invoiceModel = require("../models/invoiceModel");
const { db } = require("../config/firebase");

const clientsCollection = db.collection("clients");
const productsCollection = db.collection("products");

/**
 * Generate sequential invoice ID (inv-001, inv-002, etc.)
 */
const generateInvoiceId = async () => {
  try {
    console.log('🔄 Generating invoice ID...');
    
    // Get all invoices to find the highest number
    const invoices = await invoiceModel.getAllInvoices();
    
    let nextCount = 1;

    if (invoices.length > 0) {
      // Find the highest invoice number - now looking for INV- prefix
      let highestNumber = 0;
      
      invoices.forEach(invoice => {
        // Look for both uppercase and lowercase patterns
        const match = invoice.id.match(/(?:INV-|inv-)(\d+)/i);
        if (match && match[1]) {
          const currentNumber = parseInt(match[1], 10);
          if (currentNumber > highestNumber) {
            highestNumber = currentNumber;
          }
        }
      });
      
      if (highestNumber > 0) {
        nextCount = highestNumber + 1;
      } else {
        // Fallback: use count of invoices
        nextCount = invoices.length + 1;
      }
    }

    // Format with leading zeros and use UPPERCASE
    const formattedNumber = nextCount.toString().padStart(3, '0');
    const invoiceId = `INV-${formattedNumber}`; // UPPERCASE
    
    console.log(`✅ Generated invoice ID: ${invoiceId}`);
    return invoiceId;
    
  } catch (error) {
    console.error('❌ Error generating invoice ID:', error);
    // Emergency fallback - also uppercase
    const timestamp = Date.now().toString(36);
    return `INV-${timestamp}`; // UPPERCASE
  }
};

/**
 * Validate invoice data before creation
 */
const validateInvoiceData = (data) => {
  const errors = [];
  
  if (!data.clientId) errors.push("Client ID is required");
  if (!data.clientName) errors.push("Client name is required");
  if (!data.products || !Array.isArray(data.products) || data.products.length === 0) {
    errors.push("Products array is required");
  } else {
    data.products.forEach((product, index) => {
      if (!product.productId) errors.push(`Product ${index + 1}: productId is required`);
      if (!product.name) errors.push(`Product ${index + 1}: name is required`);
      if (typeof product.quantity !== 'number' || product.quantity <= 0) {
        errors.push(`Product ${index + 1}: valid quantity is required`);
      }
      if (typeof product.unitPrice !== 'number' || product.unitPrice < 0) {
        errors.push(`Product ${index + 1}: valid unitPrice is required`);
      }
    });
  }
  
  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors.join(', ')}`);
  }
};

/**
 * CREATE - Create a new invoice
 */
/**
 * CREATE - Create a new invoice
 */
exports.createInvoice = async (data) => {
  try {
    console.log('🔄 Creating invoice...');
    console.log('📦 Received data:', JSON.stringify(data, null, 2));
    
    // Validate input
    validateInvoiceData(data);
    
    console.log('✅ Data validation passed');
    
    // Verify client exists
    console.log(`🔍 Verifying client: ${data.clientId}`);
    const clientDoc = await clientsCollection.doc(data.clientId).get();
    if (!clientDoc.exists) {
      throw new Error(`Client ${data.clientId} not found`);
    }
    console.log('✅ Client verified');

    // Calculate totals
    console.log('🧮 Calculating totals...');
    let total = 0;
    const productsWithTotals = data.products.map(product => {
      const productTotal = product.unitPrice * product.quantity;
      total += productTotal;
      return {
        ...product,
        total: productTotal
      };
    });

    const remise = data.remise || 0;
    const advance = data.advance || 0;
    const totalAfterDiscount = total - remise;
    const rest = totalAfterDiscount - advance;

    console.log('💰 Totals calculated:', { total, remise, advance, totalAfterDiscount, rest });

    // Generate custom invoice ID
    const invoiceId = await generateInvoiceId();

    // Format current date as dd/mm/yyyy
    const now = new Date();
    const formattedDate = `${String(now.getDate()).padStart(2, '0')}/${String(
      now.getMonth() + 1
    ).padStart(2, '0')}/${now.getFullYear()}`;

    // Prepare invoice data
    const invoiceData = {
      invoiceId, // Store as field for reference
      clientId: data.clientId,
      clientName: data.clientName,
      products: productsWithTotals,
      remise,
      advance,
      total,
      totalAfterDiscount,
      rest,
      status: "pending", // Default status
      date: formattedDate, // ✅ Add formatted date
    };

    console.log('📄 Invoice data prepared:', JSON.stringify(invoiceData, null, 2));

    // Use the model to create invoice with custom ID
    const invoice = await invoiceModel.createInvoice(invoiceId, invoiceData);

    console.log('✅ Invoice created with custom ID:', invoiceId);
    return invoice;
    
  } catch (error) {
    console.error('❌ Error creating invoice:', error);
    console.error('❌ Error stack:', error.stack);
    throw new Error(`Failed to create invoice: ${error.message}`);
  }
};

/**
 * READ - Get all invoices with optional filtering
 */
exports.getAllInvoices = async (filters = {}) => {
  try {
    console.log('🔄 Fetching invoices...');
    
    let invoices = await invoiceModel.getAllInvoices();
    
    // Apply filters
    if (filters.status) {
      invoices = invoices.filter(invoice => invoice.status === filters.status);
    }
    if (filters.clientId) {
      invoices = invoices.filter(invoice => invoice.clientId === filters.clientId);
    }
    
    console.log(`✅ Retrieved ${invoices.length} invoices`);
    return invoices;
    
  } catch (error) {
    console.error('❌ Error fetching invoices:', error);
    throw new Error(`Failed to fetch invoices: ${error.message}`);
  }
};

/**
 * READ - Get single invoice by ID
 */
exports.getInvoiceById = async (id) => {
  try {
    console.log(`🔄 Fetching invoice: ${id}`);
    
    if (!id) throw new Error("Invoice ID is required");
    
    const invoice = await invoiceModel.getInvoiceById(id);
    
    console.log('✅ Invoice found');
    return invoice;
    
  } catch (error) {
    console.error('❌ Error fetching invoice:', error);
    throw new Error(`Failed to fetch invoice: ${error.message}`);
  }
};

/**
 * UPDATE - Update an invoice (only if pending)
 */

// In your api.ts file - Updated updateInvoice function
exports.updateInvoice = async (id, data) => {
  try {
    console.log(`🔄 Updating invoice: ${id}`);
    
    if (!id) throw new Error("Invoice ID is required");

    const invoiceId = id.toUpperCase().trim();
    
    console.log(`🔍 Looking for invoice: ${invoiceId}`);

    const invoiceDoc = await db.collection('invoices').doc(invoiceId).get();
    if (!invoiceDoc.exists) {
      throw new Error(`Invoice ${invoiceId} not found`);
    }
    
    const currentInvoice = {
      id: invoiceDoc.id,
      ...invoiceDoc.data()
    };

    console.log(`📄 Found invoice: ${currentInvoice.id}, Status: ${currentInvoice.status}`);
    console.log('📦 Current invoice products:', currentInvoice.products);

    let total = currentInvoice.total;
    let productsWithTotals = currentInvoice.products;
    let stockUpdates = [];

    // If products are being updated, handle stock changes
    if (data.products) {
      if (!Array.isArray(data.products) || data.products.length === 0) {
        throw new Error("Products array cannot be empty");
      }

      console.log('📦 Processing product updates...');
      console.log('🆕 New products data:', data.products);
      
      // Validate products and calculate new totals
      total = 0;
      productsWithTotals = [];
      const validationErrors = [];

      for (const newProduct of data.products) {
        // Skip empty products
        if (!newProduct.name) {
          validationErrors.push(`Product name is required`);
          continue;
        }

        let productId = newProduct.productId;
        let productData = null;
        let currentStock = 0;

        // If productId is provided, get the product
        if (productId) {
          console.log(`🔍 Looking for product with ID: ${productId}`);
          const productDoc = await db.collection('products').doc(productId).get();
          if (productDoc.exists) {
            productData = productDoc.data();
            // FIX: Use the same field names as createConfirmedInvoice
            currentStock = productData.q || productData.quantity || productData.currentStock || 0;
            console.log(`✅ Found product: ${productData.name}, Current stock (q): ${currentStock}`);
          } else {
            console.log(`❌ Product not found with ID: ${productId}`);
            validationErrors.push(`Product "${newProduct.name}" not found`);
            continue;
          }
        } else {
          // If no productId, try to find product by name
          console.log(`🔍 Searching for product by name: "${newProduct.name}"`);
          const productsSnapshot = await db.collection('products')
            .where('name', '==', newProduct.name)
            .limit(1)
            .get();
          
          if (!productsSnapshot.empty) {
            const productDoc = productsSnapshot.docs[0];
            productId = productDoc.id;
            productData = productDoc.data();
            // FIX: Use the same field names as createConfirmedInvoice
            currentStock = productData.q || productData.quantity || productData.currentStock || 0;
            console.log(`✅ Found product by name: ${productId}, Current stock (q): ${currentStock}`);
          } else {
            console.log(`❌ Product "${newProduct.name}" not found in database`);
            validationErrors.push(`Product "${newProduct.name}" not found in database`);
            continue;
          }
        }

        // Find original product in current invoice to calculate stock difference
        const originalProduct = currentInvoice.products.find(
          p => p.productId === productId || p.name === newProduct.name
        );

        const originalQuantity = originalProduct ? originalProduct.quantity : 0;
        const quantityDifference = newProduct.quantity - originalQuantity;

        console.log(`📊 Stock calculation for ${newProduct.name}:`);
        console.log(`   Original quantity: ${originalQuantity}`);
        console.log(`   New quantity: ${newProduct.quantity}`);
        console.log(`   Quantity difference: ${quantityDifference}`);
        console.log(`   Current stock (q): ${currentStock}`);

        // Check stock for increases (if we're adding more items)
        if (quantityDifference > 0 && currentStock < quantityDifference) {
          validationErrors.push(
            `Insufficient stock for ${newProduct.name}. Available: ${currentStock}, Needed additional: ${quantityDifference}`
          );
          continue;
        }

        // Use the price from the update data or product data
        const productPrice = newProduct.unitPrice || newProduct.price || (productData ? productData.price : 0) || 0;
        if (productPrice <= 0) {
          validationErrors.push(`Product "${newProduct.name}" has invalid price: $${productPrice}`);
        }

        // Calculate product total
        const productTotal = productPrice * newProduct.quantity;
        total += productTotal;

        // Add to products array
        productsWithTotals.push({
          productId: productId,
          name: newProduct.name,
          quantity: newProduct.quantity,
          unitPrice: productPrice,
          price: productPrice,
          total: productTotal
        });

        // Prepare stock update if quantity changed
        if (quantityDifference !== 0) {
          const newStock = currentStock - quantityDifference;
          console.log(`🔄 Stock update for ${newProduct.name}: ${currentStock} - ${quantityDifference} = ${newStock}`);
          
          stockUpdates.push({
            productId: productId,
            productName: newProduct.name,
            productRef: db.collection('products').doc(productId),
            currentStock: currentStock,
            quantityDifference: quantityDifference,
            newStock: newStock
          });
        } else {
          console.log(`➖ No stock change for ${newProduct.name}`);
        }
      }

      // If validation errors, throw them
      if (validationErrors.length > 0) {
        throw new Error(`Product validation failed: ${validationErrors.join('; ')}`);
      }

      console.log('✅ Product validations passed');
    }

    // Calculate financial totals
    const remise = data.remise ?? currentInvoice.remise;
    const advance = data.advance ?? currentInvoice.advance;
    const totalAfterDiscount = total - remise;
    const rest = Math.max(0, totalAfterDiscount - advance);

    // Update status
    const status = rest === 0 ? "paid" : "not paid";

    // Prepare update data
    const updateData = {
      products: productsWithTotals,
      total,
      totalAfterDiscount,
      rest,
      status,
      paid: rest === 0,
      updatedAt: new Date()
    };

    // Add optional fields
    if (data.remise !== undefined) updateData.remise = remise;
    if (data.advance !== undefined) updateData.advance = advance;

    console.log('📊 Final update data:', updateData);
    console.log('📦 Stock updates to apply:', stockUpdates);

    // Use batch write
    const batch = db.batch();

    // Update stock levels - FIX: Use the same field name 'q' as createConfirmedInvoice
    if (stockUpdates.length > 0) {
      console.log('📦 Applying stock updates using field "q":');
      for (const update of stockUpdates) {
        console.log(`   ${update.productName}: ${update.currentStock} -> ${update.newStock}`);
        
        // FIX: Use 'q' field instead of 'currentStock'
        batch.update(update.productRef, {
          q: update.newStock, // CHANGED: Use 'q' to match createConfirmedInvoice
          updatedAt: new Date()
        });
      }
    } else {
      console.log('📦 No stock updates needed');
    }

    // Update the invoice
    const invoiceRef = db.collection('invoices').doc(invoiceId);
    batch.update(invoiceRef, updateData);

    // Commit changes
    await batch.commit();

    console.log('✅ Invoice updated successfully with stock adjustments');
    return { 
      success: true, 
      message: "Invoice updated successfully! Stock quantities have been adjusted.", 
      invoiceId: invoiceId,
      stockUpdates: stockUpdates.length
    };
    
  } catch (error) {
    console.error('❌ Error updating invoice:', error);
    throw new Error(`Failed to update invoice: ${error.message}`);
  }
};
/**
 * CONFIRM - Confirm invoice and reduce stock
 */
exports.confirmInvoice = async (id) => {
  try {
    console.log(`🔄 Confirming invoice: ${id}`);
    
    if (!id) throw new Error("Invoice ID is required");

    const invoice = await invoiceModel.getInvoiceById(id);
    
    if (invoice.status === "confirmed") {
      throw new Error("Invoice already confirmed");
    }

    // Check stock availability first
    for (const item of invoice.products) {
      const productDoc = await productsCollection.doc(item.productId).get();
      if (!productDoc.exists) {
        throw new Error(`Product ${item.productId} not found`);
      }

      const product = productDoc.data();
      const currentStock = product.q || product.quantity || 0;
      
      if (currentStock < item.quantity) {
        throw new Error(`Insufficient stock for ${item.name}. Available: ${currentStock}, Needed: ${item.quantity}`);
      }
    }

    // Update stock and invoice status in batch
    const batch = db.batch();

    // Reduce stock for each product
    for (const item of invoice.products) {
      const productRef = productsCollection.doc(item.productId);
      const productDoc = await productRef.get();
      const product = productDoc.data();
      const currentStock = product.q || product.quantity || 0;

      batch.update(productRef, {
        q: currentStock - item.quantity,
        updatedAt: new Date()
      });
    }

    // Mark invoice as confirmed
    batch.update(db.collection("invoices").doc(id), { 
      status: "confirmed",
      confirmedAt: new Date(),
      updatedAt: new Date()
    });

    await batch.commit();

    console.log('✅ Invoice confirmed and stock updated');
    return { success: true, message: "Invoice confirmed", invoiceId: id };
    
  } catch (error) {
    console.error('❌ Error confirming invoice:', error);
    throw new Error(`Failed to confirm invoice: ${error.message}`);
  }
};
// In your backend invoice controller
// // Add this function to your existing invoice controller
// In controllers/invoiceController.js - FIX the createConfirmedInvoice function
exports.createConfirmedInvoice = async (req, res) => {
  try {
    const invoiceData = req.body;
    console.log('🔄 Creating confirmed invoice:', invoiceData);
    
    // Validate required fields
    if (!invoiceData.clientId || !invoiceData.products || !invoiceData.products.length) {
      return res.status(400).json({
        success: false,
        message: "Client ID and products are required"
      });
    }

    // Verify client exists
    console.log(`🔍 Verifying client: ${invoiceData.clientId}`);
    const clientDoc = await clientsCollection.doc(invoiceData.clientId).get();
    if (!clientDoc.exists) {
      return res.status(400).json({
        success: false,
        message: `Client ${invoiceData.clientId} not found`
      });
    }
    console.log('✅ Client verified');

    // Check product availability (stock and expiry)
    const validationErrors = [];
    const productsWithDetails = [];

    for (const item of invoiceData.products) {
      const productDoc = await productsCollection.doc(item.productId).get();
      
      if (!productDoc.exists) {
        validationErrors.push(`Product "${item.name || item.productId}" not found`);
        continue;
      }

      const product = productDoc.data();
      productsWithDetails.push({ ...product, docId: productDoc.id });

      // Check stock availability
      const currentStock = product.q || product.quantity || 0;
      if (currentStock < item.quantity) {
        validationErrors.push(`Insufficient stock for ${item.name}. Available: ${currentStock}, Requested: ${item.quantity}`);
      }

      // Check expiry date
      if (product.expiryDate) {
        const expiryDate = new Date(product.expiryDate);
        const today = new Date();
        if (expiryDate < today) {
          validationErrors.push(`Product "${item.name}" has expired (Expiry: ${product.expiryDate})`);
        }
      }

      // Check if product has valid price
      const productPrice = product.price || product.unitPrice || 0;
      if (productPrice <= 0) {
        validationErrors.push(`Product "${item.name}" has invalid price: $${productPrice}`);
      }
    }

    // If any validation errors, return them
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Product validation failed",
        errors: validationErrors
      });
    }

    console.log('✅ All product validations passed');

    // Generate sequential invoice ID (like createInvoice does)
    const invoiceId = await generateInvoiceId();
    console.log(`✅ Generated invoice ID: ${invoiceId}`);

    // Calculate totals (in case frontend didn't send them or they need recalculation)
    console.log('🧮 Calculating totals...');
    let total = 0;
    const productsWithTotals = invoiceData.products.map((product, index) => {
      const productDetail = productsWithDetails[index];
      const productPrice = productDetail.price || productDetail.unitPrice || product.unitPrice || 0;
      const productTotal = productPrice * product.quantity;
      total += productTotal;
      
      return {
        productId: product.productId,
        name: product.name,
        quantity: product.quantity,
        unitPrice: productPrice,
        total: productTotal
      };
    });

    const remise = invoiceData.remise || 0;
    const advance = invoiceData.advance || 0;
    const totalAfterDiscount = total - remise;
    const rest = totalAfterDiscount - advance;

    console.log('💰 Totals calculated:', { total, remise, advance, totalAfterDiscount, rest });

    // Determine status based on payment
    // CHANGED: Use "paid" if rest is 0, otherwise "not paid"
    const status = rest === 0 ? "paid" : "not paid";
    console.log(`💰 Invoice status set to: ${status} (rest: ${rest})`);

    // Update stock and create invoice in batch (atomic operation)
    const batch = db.batch();

    // Reduce stock for each product
    for (let i = 0; i < invoiceData.products.length; i++) {
      const item = invoiceData.products[i];
      const productDetail = productsWithDetails[i];
      
      const productRef = productsCollection.doc(item.productId);
      const currentStock = productDetail.q || productDetail.quantity || 0;

      batch.update(productRef, {
        q: currentStock - item.quantity,
        updatedAt: new Date()
      });

      console.log(`📦 Updated stock for ${item.name}: ${currentStock} -> ${currentStock - item.quantity}`);
    }

    // Format current date as dd/mm/yyyy (like createInvoice does)
    const now = new Date();
    const formattedDate = `${String(now.getDate()).padStart(2, '0')}/${String(
      now.getMonth() + 1
    ).padStart(2, '0')}/${now.getFullYear()}`;

    // Create invoice with paid/not paid status
    // CHANGED: Use "paid"/"not paid" instead of "confirmed"
    const confirmedInvoice = {
      id: invoiceId,
      invoiceId: invoiceId,
      clientId: invoiceData.clientId,
      clientName: invoiceData.clientName,
      products: productsWithTotals,
      remise: remise,
      advance: advance,
      total: total,
      totalAfterDiscount: totalAfterDiscount,
      rest: rest,
      status: status, // CHANGED: Use "paid" or "not paid"
      paid: rest === 0, // CHANGED: Set paid based on rest amount
      date: formattedDate,
      confirmedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const invoiceRef = db.collection("invoices").doc(invoiceId);
    batch.set(invoiceRef, confirmedInvoice);

    await batch.commit();

    console.log('✅ Invoice created successfully with status:', status);
    
    return res.status(201).json({
      success: true,
      message: `Invoice created successfully with status: ${status}`,
      data: [confirmedInvoice]
    });
    
  } catch (error) {
    console.error('❌ Error creating invoice:', error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create invoice"
    });
  }
};
/**
 * DELETE - Delete an invoice
 */
exports.deleteInvoice = async (id) => {
  try {
    console.log(`🔄 Deleting invoice: ${id}`);
    
    if (!id) throw new Error("Invoice ID is required");

    const invoice = await invoiceModel.getInvoiceById(id);
    const batch = db.batch();

    // Restore stock if invoice was confirmed
    if (invoice.status === "confirmed") {
      for (const item of invoice.products) {
        const productRef = productsCollection.doc(item.productId);
        const productDoc = await productRef.get();

        if (productDoc.exists) {
          const product = productDoc.data();
          const currentStock = product.q || product.quantity || 0;
          batch.update(productRef, {
            q: currentStock + item.quantity,
            updatedAt: new Date()
          });
        }
      }
    }

    // Delete the invoice using the model
    await invoiceModel.deleteInvoice(id);

    console.log('✅ Invoice deleted');
    return { success: true, message: "Invoice deleted", invoiceId: id };
    
  } catch (error) {
    console.error('❌ Error deleting invoice:', error);
    throw new Error(`Failed to delete invoice: ${error.message}`);
  }
};

/**
 * Get invoice statistics
 */
exports.getInvoiceStats = async () => {
  try {
    console.log('🔄 Fetching invoice statistics...');
    
    const invoices = await invoiceModel.getAllInvoices();
    
    const pendingInvoices = invoices.filter(inv => inv.status === 'pending');
    const confirmedInvoices = invoices.filter(inv => inv.status === 'confirmed');

    // Calculate total revenue from confirmed invoices
    const totalRevenue = invoices.reduce((sum, invoice) => {
      return invoice.status === 'confirmed' ? sum + (invoice.total || 0) : sum;
    }, 0);

    const stats = {
      total: invoices.length,
      pending: pendingInvoices.length,
      confirmed: confirmedInvoices.length,
      totalRevenue
    };

    console.log('✅ Statistics retrieved');
    return stats;
    
  } catch (error) {
    console.error('❌ Error fetching statistics:', error);
    throw new Error(`Failed to fetch statistics: ${error.message}`);
  }
};

/**
 * Search invoices by client name or invoice ID
 */
exports.searchInvoices = async (searchTerm) => {
  try {
    console.log(`🔍 Searching invoices for: ${searchTerm}`);
    
    if (!searchTerm || searchTerm.trim() === '') {
      return await exports.getAllInvoices();
    }

    const invoices = await invoiceModel.getAllInvoices();
    
    const filteredInvoices = invoices.filter(invoice => 
      invoice.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (invoice.invoiceId && invoice.invoiceId.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    console.log(`✅ Found ${filteredInvoices.length} invoices matching search`);
    return filteredInvoices;
    
  } catch (error) {
    console.error('❌ Error searching invoices:', error);
    throw new Error(`Failed to search invoices: ${error.message}`);
  }
};

/**
 * Get invoices by client ID
 */
exports.getInvoicesByClient = async (clientId) => {
  try {
    console.log(`🔄 Fetching invoices for client: ${clientId}`);
    
    if (!clientId) throw new Error("Client ID is required");

    const invoices = await invoiceModel.getAllInvoices();
    const clientInvoices = invoices.filter(invoice => invoice.clientId === clientId);
    
    console.log(`✅ Found ${clientInvoices.length} invoices for client`);
    return clientInvoices;
    
  } catch (error) {
    console.error('❌ Error fetching client invoices:', error);
    throw new Error(`Failed to fetch client invoices: ${error.message}`);
  }
};

/**
 * Update invoice status
 */
// Around line 638 in your invoiceCon.js file, update the validation
exports.updateInvoiceStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const { id } = req.params;
    
    console.log(`🔄 Updating invoice ${id} status to: ${status}`);
    
    // Validate status
    const validStatuses = ['not paid', 'paid'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be: ${validStatuses.join(', ')}`
      });
    }

    // Check if invoice exists using Firebase
    const invoiceRef = db.collection('invoices').doc(id);
    const invoiceDoc = await invoiceRef.get();
    
    if (!invoiceDoc.exists) {
      return res.status(404).json({
        success: false,
        message: `Invoice ${id} not found`
      });
    }

    const invoiceData = invoiceDoc.data();
    console.log(`✅ Invoice ${id} found, current data:`, {
      status: invoiceData.status,
      rest: invoiceData.rest,
      total: invoiceData.total
    });

    // Prepare update data
    const updateData = {
      status: status,
      paid: status === 'paid',
      updatedAt: new Date()
    };

    // If marking as paid, set rest to 0 and ensure paid is true
    if (status === 'paid') {
      updateData.rest = 0;
      updateData.paid = true;
      console.log(`💰 Setting rest to 0 for paid invoice ${id}`);
    } else {
      // If marking as not paid, recalculate rest based on original values
      // or keep the current rest value
      const total = invoiceData.total || 0;
      const advance = invoiceData.advance || 0;
      const remise = invoiceData.remise || 0;
      const totalAfterDiscount = total - remise;
      const calculatedRest = totalAfterDiscount - advance;
      
      updateData.rest = Math.max(0, calculatedRest);
      updateData.paid = false;
      console.log(`📊 Recalculated rest for not paid invoice ${id}: ${updateData.rest}`);
    }

    console.log(`🔄 Update data for invoice ${id}:`, updateData);

    // Update the invoice
    await invoiceRef.update(updateData);

    console.log(`✅ Invoice ${id} successfully updated to:`, {
      status: status,
      rest: updateData.rest,
      paid: updateData.paid
    });
    
    // Return success response
    res.json({
      success: true,
      message: `Invoice status updated to ${status}${status === 'paid' ? ' and amount due set to $0' : ''}`,
      data: { 
        invoiceId: id,
        status: status,
        rest: updateData.rest,
        paid: updateData.paid
      }
    });
    
  } catch (error) {
    console.error(`❌ Error updating invoice status for ${req.params.id}:`, error);
    
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update invoice status"
    });
  }
};