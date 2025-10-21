// routes/departmentRoutes.js
const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/departmentsController');

// Import middleware


// Routes
router.get('/',  getDepartments);
router.get('/all',  getAllDepartments);
router.get('/stats/summary',  getDepartmentStats);
router.get('/search/:query',  searchDepartments);
router.get('/:id',  getDepartment);

router.post('/',  createDepartment);
router.patch('/bulk',  bulkUpdateDepartments);

router.put('/:id',  updateDepartment);
router.delete('/:id',  deleteDepartment);
router.delete('/:id/hard',  hardDeleteDepartment);

module.exports = router;