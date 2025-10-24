const express = require('express');
const {
  getSections,
  getSection,
  createSection,
  updateSection,
  deleteSection,
  getSectionEmployees,
  getSectionStats,
  toggleSectionStatus,
  assignEmployeeToSection,
  removeEmployeeFromSection,
  getHrisSections
} = require('../controllers/sectionController');
const { 
  auth, 
  authorize, 
  checkPermission,
  auditTrail 
} = require('../middleware/auth');
const { sectionValidation, queryValidation } = require('../middleware/validation');

const router = express.Router();

// Static routes first (before parameterized routes)
// @route   GET /api/sections/hris
// @desc    Get all sections from HRIS API
// @access  Public (for now)
router.get('/hris', getHrisSections);

// @route   GET /api/sections
// @desc    Get all sections
// @access  Private
router.get(
  '/',
  // auth,
  // queryValidation.pagination,
  // auditTrail('sections_viewed', 'Section'),
  getSections
);

// @route   GET /api/sections/:id
// @desc    Get single section
// @access  Private
router.get(
  '/:id',
  auth,
  auditTrail('section_viewed', 'Section'),
  getSection
);

// @route   GET /api/sections/:id/employees
// @desc    Get section employees
// @access  Private
router.get(
  '/:id/employees',
  auth,
  queryValidation.pagination,
  auditTrail('section_employees_viewed', 'Section'),
  getSectionEmployees
);

// @route   GET /api/sections/:id/stats
// @desc    Get section statistics
// @access  Private
router.get(
  '/:id/stats',
  auth,
  auditTrail('section_stats_viewed', 'Section'),
  getSectionStats
);

// @route   POST /api/sections
// @desc    Create section
// @access  Private (administrator and super_admin only)
router.post(
  '/',
  auth,
  // authorize(['administrator', 'super_admin']), // Temporarily comment out for testing
  // checkPermission('sections', 'create'), // Temporarily comment out for testing
  sectionValidation.create,
  auditTrail('section_created', 'Section'),
  createSection
);

// @route   PUT /api/sections/:id
// @desc    Update section
// @access  Private (administrator and super_admin only)
router.put(
  '/:id',
  auth,
  // authorize(['administrator', 'super_admin']), // Temporarily comment out for testing
  // checkPermission('sections', 'update'), // Temporarily comment out for testing
  sectionValidation.update,
  auditTrail('section_updated', 'Section'),
  updateSection
);

// @route   DELETE /api/sections/:id
// @desc    Delete section
// @access  Private (super_admin only)
router.delete(
  '/:id',
  auth,
  // authorize('super_admin'), // Temporarily comment out for testing
  // checkPermission('sections', 'delete'), // Temporarily comment out for testing
  auditTrail('section_deleted', 'Section'),
  deleteSection
);

// @route   PATCH /api/sections/:id/toggle-status
// @desc    Toggle section status
// @access  Private (administrator and super_admin only)
router.patch(
  '/:id/toggle-status',
  auth,
  authorize(['administrator', 'super_admin']),
  checkPermission('sections', 'update'),
  auditTrail('section_status_toggled', 'Section'),
  toggleSectionStatus
);

// @route   POST /api/sections/:id/employees/:employeeId
// @desc    Assign employee to section
// @access  Private (administrator and super_admin only)
router.post(
  '/:id/employees/:employeeId',
  auth,
  authorize(['administrator', 'super_admin']),
  checkPermission('sections', 'assign_employee'),
  auditTrail('employee_assigned_to_section', 'Section'),
  assignEmployeeToSection
);

// @route   DELETE /api/sections/:id/employees/:employeeId
// @desc    Remove employee from section
// @access  Private (administrator and super_admin only)
router.delete(
  '/:id/employees/:employeeId',
  auth,
  authorize(['administrator', 'super_admin']),
  checkPermission('sections', 'remove_employee'),
  auditTrail('employee_removed_from_section', 'Section'),
  removeEmployeeFromSection
);

module.exports = router;
