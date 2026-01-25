/**
 * HRIS Sync Routes
 * 
 * API endpoints for managing HRIS data synchronization
 */

const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const {
  getSyncStatusHandler,
  triggerFullSync,
  triggerDivisionsSync,
  triggerSectionsSync,
  triggerEmployeesSync,
  triggerEmpIndexSync,
  triggerSubSectionsSync,
  triggerAttendanceSync,
  triggerCacheSync,
  triggerAuditSync,
  getSyncedDivisions,
  getSyncedSections,
  getSyncedEmployees,
  updateSyncSchedule
} = require('../controllers/syncController');

// Protect all routes
router.use(auth);

// @route   GET /api/sync/status
// @desc    Get sync status and statistics
// @access  Private (super_admin, admin)
router.get('/status', authorize('super_admin', 'admin'), getSyncStatusHandler);

// @route   POST /api/sync/trigger/full
// @desc    Trigger manual full sync (divisions, sections, employees)
// @access  Private (super_admin only)
router.post('/trigger/full', authorize('super_admin'), triggerFullSync);

// @route   POST /api/sync/trigger/divisions
// @desc    Trigger divisions sync only
// @access  Private (super_admin, admin)
router.post('/trigger/divisions', authorize('super_admin', 'admin'), triggerDivisionsSync);

// @route   POST /api/sync/trigger/sections
// @desc    Trigger sections sync only
// @access  Private (super_admin, admin)
router.post('/trigger/sections', authorize('super_admin', 'admin'), triggerSectionsSync);

// @route   POST /api/sync/trigger/employees
// @desc    Trigger employees sync only
// @access  Private (super_admin, admin)
router.post('/trigger/employees', authorize('super_admin', 'admin'), triggerEmployeesSync);

// @route   POST /api/sync/trigger/emp-index
// @desc    Trigger emp_index_list sync only
// @access  Private (super_admin, admin)
router.post('/trigger/emp-index', authorize('super_admin', 'admin'), triggerEmpIndexSync);

// @route   POST /api/sync/trigger/subsections
// @desc    Trigger sub_sections sync only
// @access  Private (super_admin, admin)
router.post('/trigger/subsections', authorize('super_admin', 'admin'), triggerSubSectionsSync);

// @route   POST /api/sync/trigger/attendance
// @desc    Trigger attendance sync only
// @access  Private (super_admin, admin)
router.post('/trigger/attendance', authorize('super_admin', 'admin'), triggerAttendanceSync);

// @route   POST /api/sync/trigger/cache
// @desc    Trigger cache rebuild and preload
// @access  Private (super_admin, admin)
// router.post('/trigger/cache', authorize('super_admin', 'admin'), triggerCacheSync);

// @route   POST /api/sync/trigger/audit
// @desc    Trigger audit data sync (incomplete punches to audit_sync table)
// @access  Private (super_admin, admin)
router.post('/trigger/audit', authorize('super_admin', 'admin'), triggerAuditSync);

// @route   GET /api/sync/divisions
// @desc    Get synced divisions from MySQL
// @access  Private
router.get('/divisions', getSyncedDivisions);

// @route   GET /api/sync/sections
// @desc    Get synced sections from MySQL
// @access  Private
router.get('/sections', getSyncedSections);

// @route   GET /api/sync/employees
// @desc    Get synced employees from MySQL
// @access  Private
router.get('/employees', getSyncedEmployees);

// @route   PUT /api/sync/schedule
// @desc    Update sync schedule (cron expression)
// @access  Private (super_admin only)
router.put('/schedule', authorize('super_admin'), updateSyncSchedule);

module.exports = router;
