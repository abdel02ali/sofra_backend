// models/invoiceModel.js
const { db } = require("../config/firebase");

const invoicesCollection = db.collection("invoices");

/**
 * CREATE - Create a new invoice with custom ID
 */
exports.createInvoice = async (invoiceId, data) => {
  try {
    console.log(`🔄 Creating invoice with custom ID: ${invoiceId}`);
    
    // Use custom ID instead of auto-generated Firestore ID
    await invoicesCollection.doc(invoiceId).set({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    console.log('✅ Invoice created with custom ID:', invoiceId);
    return { 
      id: invoiceId,
      ...data 
    };
  } catch (err) {
    console.error('❌ Error creating invoice:', err);
    throw new Error(err.message);
  }
};

/**
 * READ - Get all invoices
 */
exports.getAllInvoices = async () => {
  try {
    const snapshot = await invoicesCollection.orderBy("createdAt", "desc").get();
    const invoices = snapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.() || doc.data().updatedAt,
    }));
    
    console.log(`✅ Retrieved ${invoices.length} invoices`);
    return invoices;
  } catch (error) {
    console.error('❌ Error fetching invoices:', error);
    throw new Error(error.message);
  }
};

/**
 * READ - Get single invoice by ID
 */
exports.getInvoiceById = async (id) => {
  try {
    const doc = await invoicesCollection.doc(id).get();
    if (!doc.exists) throw new Error("Invoice not found");
    
    const invoiceData = doc.data();
    return { 
      id: doc.id, 
      ...invoiceData,
      createdAt: invoiceData.createdAt?.toDate?.() || invoiceData.createdAt,
      updatedAt: invoiceData.updatedAt?.toDate?.() || invoiceData.updatedAt,
    };
  } catch (error) {
    console.error('❌ Error fetching invoice:', error);
    throw new Error(error.message);
  }
};

/**
 * UPDATE - Update an invoice
 */
exports.updateInvoice = async (id, data) => {
  try {
    await invoicesCollection.doc(id).update({
      ...data,
      updatedAt: new Date()
    });
    
    console.log('✅ Invoice updated:', id);
    return { success: true, message: "Invoice updated", invoiceId: id };
  } catch (error) {
    console.error('❌ Error updating invoice:', error);
    throw new Error(error.message);
  }
};

/**
 * DELETE - Delete an invoice
 */
exports.deleteInvoice = async (id) => {
  try {
    await invoicesCollection.doc(id).delete();
    console.log('✅ Invoice deleted:', id);
    return { success: true, message: "Invoice deleted", invoiceId: id };
  } catch (error) {
    console.error('❌ Error deleting invoice:', error);
    throw new Error(error.message);
  }
};

/**
 * Check if invoice exists
 */
exports.invoiceExists = async (id) => {
  try {
    const doc = await invoicesCollection.doc(id).get();
    return doc.exists;
  } catch (error) {
    console.error('❌ Error checking invoice existence:', error);
    throw new Error(error.message);
  }
};