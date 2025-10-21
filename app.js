// app.js - CLEAN VERSION WITHOUT ROUTER
const express = require('express');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Import routes directly

const productRoutes = require('./routes/productRoutes');

const dashboardRoutes = require('./routes/dashboardRoutes');
const movementRoutes = require('./routes/movementRoutes');
const departmentRoutes = require('./routes/departmentsRoutes');
const categoriesRoutes = require('./routes/categoryRoutes');

app.use('/api/movements', movementRoutes);

// Use routes directly (no router.js needed)

app.use('/api/products', productRoutes);

app.use('/api/dashboard', dashboardRoutes);


app.use('/api/departments', departmentRoutes);
app.use('/api/categories', categoriesRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Lama Gest API is running on Vercel',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Root endpoint
app.get('/api', (req, res) => {
  res.json({ 
    message: 'Lama Gest Inventory Management API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      invoices: '/api/invoices',
      products: '/api/products',
      clients: '/api/clients',
      dashboard: '/api/dashboard'
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handler
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

// Export for Vercel
module.exports = app;

// Local development (won't run on Vercel)
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});