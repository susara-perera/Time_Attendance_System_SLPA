const express = require('express');
const {
  getDivisions,
  getDivision,
  createDivision,
  updateDivision,
  deleteDivision,
  getDivisionEmployees,
  getDivisionSections,
  getDivisionMySQLSections,
  getDivisionStats,
  toggleDivisionStatus,
  getSyncDivisions,
  getHrisDivisions,
  getCombinedDivisions
} = require('../controllers/divisionController');
const { 
  auth, 
  authorize, 
  checkPermission,
  auditTrail 
} = require('../middleware/auth');
const { divisionValidation, queryValidation } = require('../middleware/validation');
const { cacheDivisions } = require('../middleware/managementCacheMiddleware');

const router = express.Router();

// Static routes first (before parameterized routes)
// @route   GET /api/divisions/hris
// @desc    Get all divisions from HRIS API
// @access  Public (for now)
router.get('/hris', getHrisDivisions);

// @route   GET /api/divisions/combined
// @desc    Get divisions from both local DB and HRIS API
// @access  Public (for now)
router.get('/combined', getCombinedDivisions);

// @route   GET /api/divisions/sync
// @desc    Get divisions directly from divisions_sync table
// @access  Private
router.get(
  '/sync',
  auth,
  getSyncDivisions
);

// @route   GET /api/divisions
// @desc    Get all divisions (supports ?source=hris for HRIS data)
// @access  Private (with Redis caching)
router.get(
  '/',
  cacheDivisions(),
  // auth,
  // queryValidation.pagination,
  getDivisions
);

// @route   GET /api/divisions/:id
// @desc    Get single division
// @access  Private
router.get(
  '/:id',
  auth,
  auditTrail('division_viewed', 'Division'),
  getDivision
);

// @route   GET /api/divisions/:id/employees
// @desc    Get division employees
// @access  Private
router.get(
  '/:id/employees',
  auth,
  queryValidation.pagination,
  auditTrail('division_employees_viewed', 'Division'),
  getDivisionEmployees
);

// @route   GET /api/divisions/:id/sections
// @desc    Get division sections
// @access  Private
router.get(
  '/:id/sections',
  // auth, // Temporarily disable auth for testing
  // queryValidation.pagination,
  // auditTrail('division_sections_viewed', 'Division'),
  getDivisionSections
);

// @route   GET /api/divisions/:id/mysql-sections
// @desc    Get division sections from MySQL for attendance reports
// @access  Private
router.get(
  '/:id/mysql-sections',
  // auth, // Temporarily disable auth for testing
  getDivisionMySQLSections
);

// @route   GET /api/divisions/:id/stats
// @desc    Get division statistics
// @access  Private
router.get(
  '/:id/stats',
  auth,
  auditTrail('division_stats_viewed', 'Division'),
  getDivisionStats
);

// @route   POST /api/divisions
// @desc    Create division
// @access  Private
router.post(
  '/',
  auth,
  divisionValidation.create,
  createDivision
);

// @route   PUT /api/divisions/:id
// @desc    Update division
// @access  Private
router.put(
  '/:id',
  auth,
  divisionValidation.update,
  updateDivision
);

// @route   DELETE /api/divisions/:id
// @desc    Delete division
// @access  Private
router.delete(
  '/:id',
  auth,
  deleteDivision
);

// @route   PATCH /api/divisions/:id/toggle-status
// @desc    Toggle division status
// @access  Private (super_admin only)
router.patch(
  '/:id/toggle-status',
  auth,
  authorize('super_admin'),
  checkPermission('divisions', 'update'),
  auditTrail('division_status_toggled', 'Division'),
  toggleDivisionStatus
);

module.exports = router;
