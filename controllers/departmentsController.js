// controllers/departmentController.js
const { admin, db } = require('../config/firebase');
const FieldValue = admin.firestore.FieldValue;

// Utility function to handle errors
const handleError = (res, error, message = 'Server error') => {
  console.error('Error:', error);
  return res.status(500).json({
    success: false,
    message,
    error: error.message
  });
};

// @desc    Get all departments
// @route   GET /api/departments
// @access  Private
const getDepartments = async (req, res) => {
  try {
    const departmentsRef = db.collection('departments');
    const snapshot = await departmentsRef
      .where('isActive', '==', true)
      .orderBy('name')
      .get();

    if (snapshot.empty) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: []
      });
    }

    const departments = [];
    snapshot.forEach(doc => {
      departments.push({
        id: doc.id,
        ...doc.data()
      });
    });

    res.status(200).json({
      success: true,
      count: departments.length,
      data: departments
    });
  } catch (error) {
    handleError(res, error, 'Error fetching departments');
  }
};

// @desc    Get all departments (including inactive)
// @route   GET /api/departments/all
// @access  Private
const getAllDepartments = async (req, res) => {
  try {
    const departmentsRef = db.collection('departments');
    const snapshot = await departmentsRef.orderBy('name').get();

    if (snapshot.empty) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: []
      });
    }

    const departments = [];
    snapshot.forEach(doc => {
      departments.push({
        id: doc.id,
        ...doc.data()
      });
    });

    res.status(200).json({
      success: true,
      count: departments.length,
      data: departments
    });
  } catch (error) {
    handleError(res, error, 'Error fetching all departments');
  }
};

// @desc    Get single department
// @route   GET /api/departments/:id
// @access  Private
const getDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const departmentRef = db.collection('departments').doc(id);
    const doc = await departmentRef.get();

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }

    const department = {
      id: doc.id,
      ...doc.data()
    };

    res.status(200).json({
      success: true,
      data: department
    });
  } catch (error) {
    handleError(res, error, 'Error fetching department');
  }
};

// @desc    Create new department
// @route   POST /api/departments
// @access  Private
const createDepartment = async (req, res) => {
  try {
    const { name, description, icon, color } = req.body;

    // Validation
    if (!name || !icon || !color) {
      return res.status(400).json({
        success: false,
        message: 'Name, icon, and color are required fields'
      });
    }

    // Check if department already exists (case insensitive)
    const departmentsRef = db.collection('departments');
    const snapshot = await departmentsRef
      .where('name', '==', name.trim())
      .where('isActive', '==', true)
      .get();

    if (!snapshot.empty) {
      return res.status(400).json({
        success: false,
        message: 'Department with this name already exists'
      });
    }

    // Create department data
    const departmentData = {
      name: name.trim(),
      description: description ? description.trim() : '',
      icon: icon.trim(),
      color: color.trim(),
      isActive: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };

    // Add department to Firestore
    const docRef = await departmentsRef.add(departmentData);
    
    // Get the created department
    const doc = await docRef.get();
    const department = {
      id: doc.id,
      ...doc.data()
    };

    res.status(201).json({
      success: true,
      message: 'Department created successfully',
      data: department
    });
  } catch (error) {
    handleError(res, error, 'Error creating department');
  }
};

// @desc    Update department
// @route   PUT /api/departments/:id
// @access  Private
const updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, icon, color, isActive } = req.body;

    const departmentRef = db.collection('departments').doc(id);
    const doc = await departmentRef.get();

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }

    const currentData = doc.data();

    // Check if name is being updated and if it conflicts with another department
    if (name && name !== currentData.name) {
      const departmentsRef = db.collection('departments');
      const snapshot = await departmentsRef
        .where('name', '==', name.trim())
        .where('isActive', '==', true)
        .get();

      // Check if any other department has the same name
      let nameExists = false;
      snapshot.forEach(doc => {
        if (doc.id !== id) {
          nameExists = true;
        }
      });

      if (nameExists) {
        return res.status(400).json({
          success: false,
          message: 'Department with this name already exists'
        });
      }
    }

    // Prepare update data
    const updateData = {
      updatedAt: FieldValue.serverTimestamp()
    };

    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description.trim();
    if (icon !== undefined) updateData.icon = icon.trim();
    if (color !== undefined) updateData.color = color.trim();
    if (isActive !== undefined) updateData.isActive = isActive;

    // Update department
    await departmentRef.update(updateData);

    // Get updated department
    const updatedDoc = await departmentRef.get();
    const department = {
      id: updatedDoc.id,
      ...updatedDoc.data()
    };

    res.status(200).json({
      success: true,
      message: 'Department updated successfully',
      data: department
    });
  } catch (error) {
    handleError(res, error, 'Error updating department');
  }
};

// @desc    Delete department (soft delete)
// @route   DELETE /api/departments/:id
// @access  Private
const deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const departmentRef = db.collection('departments').doc(id);
    const doc = await departmentRef.get();

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }

    // Check if department is being used in stock movements
    const stockMovementsRef = db.collection('stockMovements');
    const snapshot = await stockMovementsRef
      .where('departmentId', '==', id)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete department. It is being used in stock movements.'
      });
    }

    // Soft delete by setting isActive to false
    await departmentRef.update({
      isActive: false,
      updatedAt: FieldValue.serverTimestamp()
    });

    res.status(200).json({
      success: true,
      message: 'Department deleted successfully'
    });
  } catch (error) {
    handleError(res, error, 'Error deleting department');
  }
};

// @desc    Hard delete department (use with caution)
// @route   DELETE /api/departments/:id/hard
// @access  Private
const hardDeleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const departmentRef = db.collection('departments').doc(id);
    const doc = await departmentRef.get();

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }

    // Check if department is being used in stock movements
    const stockMovementsRef = db.collection('stockMovements');
    const snapshot = await stockMovementsRef
      .where('departmentId', '==', id)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete department. It is being used in stock movements.'
      });
    }

    // Hard delete
    await departmentRef.delete();

    res.status(200).json({
      success: true,
      message: 'Department permanently deleted'
    });
  } catch (error) {
    handleError(res, error, 'Error hard deleting department');
  }
};

// @desc    Get departments statistics
// @route   GET /api/departments/stats/summary
// @access  Private
const getDepartmentStats = async (req, res) => {
  try {
    const departmentsRef = db.collection('departments');
    
    // Get total departments
    const activeSnapshot = await departmentsRef
      .where('isActive', '==', true)
      .get();
    
    const totalSnapshot = await departmentsRef.get();

    // Get departments with stock movements count (if you have stock movements)
    const stockMovementsRef = db.collection('stockMovements');
    const movementsSnapshot = await stockMovementsRef.get();
    
    const departmentUsage = {};
    movementsSnapshot.forEach(doc => {
      const movement = doc.data();
      if (movement.departmentId) {
        departmentUsage[movement.departmentId] = (departmentUsage[movement.departmentId] || 0) + 1;
      }
    });

    res.status(200).json({
      success: true,
      data: {
        totalDepartments: totalSnapshot.size,
        activeDepartments: activeSnapshot.size,
        inactiveDepartments: totalSnapshot.size - activeSnapshot.size,
        departmentUsage
      }
    });
  } catch (error) {
    handleError(res, error, 'Error fetching department statistics');
  }
};

// @desc    Search departments
// @route   GET /api/departments/search/:query
// @access  Private
const searchDepartments = async (req, res) => {
  try {
    const { query } = req.params;
    const departmentsRef = db.collection('departments');
    
    // Since Firestore doesn't support full-text search natively,
    // we'll search by name (case insensitive would require additional work)
    const snapshot = await departmentsRef
      .where('isActive', '==', true)
      .orderBy('name')
      .get();

    const departments = [];
    snapshot.forEach(doc => {
      const department = doc.data();
      if (department.name.toLowerCase().includes(query.toLowerCase())) {
        departments.push({
          id: doc.id,
          ...department
        });
      }
    });

    res.status(200).json({
      success: true,
      count: departments.length,
      data: departments
    });
  } catch (error) {
    handleError(res, error, 'Error searching departments');
  }
};

// @desc    Bulk update departments
// @route   PATCH /api/departments/bulk
// @access  Private
const bulkUpdateDepartments = async (req, res) => {
  try {
    const { departmentIds, updateData } = req.body;

    if (!departmentIds || !Array.isArray(departmentIds) || departmentIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'departmentIds array is required'
      });
    }

    const batch = db.batch();
    const validUpdates = ['name', 'description', 'icon', 'color', 'isActive'];

    // Filter valid update fields
    const filteredUpdateData = {};
    Object.keys(updateData).forEach(key => {
      if (validUpdates.includes(key)) {
        filteredUpdateData[key] = updateData[key];
      }
    });

    if (Object.keys(filteredUpdateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    filteredUpdateData.updatedAt = FieldValue.serverTimestamp();

    // Add updates to batch
    departmentIds.forEach(departmentId => {
      const departmentRef = db.collection('departments').doc(departmentId);
      batch.update(departmentRef, filteredUpdateData);
    });

    // Commit batch
    await batch.commit();

    res.status(200).json({
      success: true,
      message: `${departmentIds.length} departments updated successfully`
    });
  } catch (error) {
    handleError(res, error, 'Error bulk updating departments');
  }
};

module.exports = {
  getDepartments,
  getAllDepartments,
  getDepartment,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  hardDeleteDepartment,
  getDepartmentStats,
  searchDepartments,
  bulkUpdateDepartments
};