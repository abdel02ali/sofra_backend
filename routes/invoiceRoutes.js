// routes/invoiceRoutes.js
const express = require("express");
const router = express.Router();
const invoiceController = require("../controllers/invoiceCon");

// CREATE - Create a new invoice

router.post("/create-confirmed", async (req, res) => {
  try {
    console.log('📥 Received create-confirmed invoice request:', req.body);
    const result = await invoiceController.createConfirmedInvoice(req, res);
  } catch (error) {
    console.error('❌ Route error creating confirmed invoice:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.post("/", async (req, res) => {
  try {
    console.log('📥 Received invoice creation request:', req.body);
    
    // Validate required fields
    if (!req.body.clientId || !req.body.clientName || !req.body.products) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: clientId, clientName, and products are required"
      });
    }

    const invoice = await invoiceController.createInvoice(req.body);
    
    res.status(201).json({
      success: true,
      message: "Invoice created successfully",
      data: invoice
    });
  } catch (error) {
    console.error('❌ Route error creating invoice:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// READ - Get all invoices
router.get("/", async (req, res) => {
  try {
    const filters = req.query;
    const invoices = await invoiceController.getAllInvoices(filters);
    
    res.json({
      success: true,
      data: invoices
    });
  } catch (error) {
    console.error('❌ Error fetching invoices:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// READ - Get invoice by ID
router.get("/:id", async (req, res) => {
  try {
    const invoice = await invoiceController.getInvoiceById(req.params.id);
    
    res.json({
      success: true,
      data: invoice
    });
  } catch (error) {
    console.error('❌ Error fetching invoice:', error);
    res.status(404).json({
      success: false,
      message: error.message
    });
  }
});

// UPDATE - Update invoice
router.put("/:id", async (req, res) => {
  try {
    const result = await invoiceController.updateInvoice(req.params.id, req.body);
    
    res.json({
      success: true,
      message: result.message,
      data: { invoiceId: result.invoiceId }
    });
  } catch (error) {
    console.error('❌ Error updating invoice:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// CONFIRM - Confirm invoice
router.patch("/:id/confirm", async (req, res) => {
  try {
    const result = await invoiceController.confirmInvoice(req.params.id);
    
    res.json({
      success: true,
      message: result.message,
      data: { invoiceId: result.invoiceId }
    });
  } catch (error) {
    console.error('❌ Error confirming invoice:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// DELETE - Delete invoice
router.delete("/:id", async (req, res) => {
  try {
    const result = await invoiceController.deleteInvoice(req.params.id);
    
    res.json({
      success: true,
      message: result.message,
      data: { invoiceId: result.invoiceId }
    });
  } catch (error) {
    console.error('❌ Error deleting invoice:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// STATS - Get invoice statistics
router.get("/stats/summary", async (req, res) => {
  try {
    const stats = await invoiceController.getInvoiceStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('❌ Error fetching stats:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// SEARCH - Search invoices
router.get("/search/:term", async (req, res) => {
  try {
    const invoices = await invoiceController.searchInvoices(req.params.term);
    
    res.json({
      success: true,
      data: invoices
    });
  } catch (error) {
    console.error('❌ Error searching invoices:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});
// In your backend routes
router.patch('/:id/status', invoiceController.updateInvoiceStatus);

module.exports = router;