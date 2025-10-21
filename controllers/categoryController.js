// controllers/categoryController.js
const { admin, db } = require('../config/firebase');
const FieldValue = admin.firestore.FieldValue;

// @desc    Get all categories
// @route   GET /api/categories
// @access  Public
const getCategories = async (req, res) => {
  try {
    const categoriesRef = db.collection('categories');
    const snapshot = await categoriesRef.orderBy('name').get();

    if (snapshot.empty) {
      return res.status(200).json({
        success: true,
        data: []
      });
    }

    const categories = [];
    snapshot.forEach(doc => {
      categories.push({
        id: doc.id,
        ...doc.data()
      });
    });

    res.status(200).json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching categories'
    });
  }
};

// @desc    Create new category
// @route   POST /api/categories
// @access  Private
const createCategory = async (req, res) => {
  try {
    const { name, type = 'custom' } = req.body;

    // Validation
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required'
      });
    }

    // Check if category already exists
    const categoriesRef = db.collection('categories');
    const snapshot = await categoriesRef
      .where('name', '==', name.trim())
      .get();

    if (!snapshot.empty) {
      return res.status(400).json({
        success: false,
        message: 'Category already exists'
      });
    }

    // Create category
    const categoryData = {
      name: name.trim(),
      type: type,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };

    const docRef = await categoriesRef.add(categoryData);
    
    // Get the created category
    const doc = await docRef.get();
    const category = {
      id: doc.id,
      ...doc.data()
    };

    res.status(201).json({
      success: true,
      data: category
    });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating category'
    });
  }
};

// @desc    Update category
// @route   PUT /api/categories/:id
// @access  Private
const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    const categoryRef = db.collection('categories').doc(id);
    const doc = await categoryRef.get();

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Check if new name already exists
    if (name) {
      const categoriesRef = db.collection('categories');
      const snapshot = await categoriesRef
        .where('name', '==', name.trim())
        .get();

      let nameExists = false;
      snapshot.forEach(doc => {
        if (doc.id !== id) {
          nameExists = true;
        }
      });

      if (nameExists) {
        return res.status(400).json({
          success: false,
          message: 'Category name already exists'
        });
      }
    }

    // Update category
    const updateData = {
      updatedAt: FieldValue.serverTimestamp()
    };

    if (name) updateData.name = name.trim();

    await categoryRef.update(updateData);

    // Get updated category
    const updatedDoc = await categoryRef.get();
    const category = {
      id: updatedDoc.id,
      ...updatedDoc.data()
    };

    res.status(200).json({
      success: true,
      data: category
    });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating category'
    });
  }
};

// @desc    Delete category
// @route   DELETE /api/categories/:id
// @access  Private
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const categoryRef = db.collection('categories').doc(id);
    const doc = await categoryRef.get();

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Delete category
    await categoryRef.delete();

    res.status(200).json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting category'
    });
  }
};

module.exports = {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory
};