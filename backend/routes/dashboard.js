const express = require('express');
const {
  getDashboardStats,
  getRecentActivities,
  refreshAttendanceTrend,
  syncPresentAbsentIS,
  refreshDashboardTotalCounts,
  getTotalDivisions,
  getTotalSections,
  getTotalSubSections,
  getTotalEmployees,
  getAttendanceTrend,
  getIsDivisionAttendance
} = require('../controllers/dashboardController');
const { auth } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/dashboard/stats
// @desc    Get dashboard statistics
// @access  Private
router.get(
  '/stats',
  // auth, // Temporarily disable auth for testing
  getDashboardStats
);

// Per-widget endpoints (dashboard reads from total_count_dashboard only)
router.get('/total-divisions', /* auth, */ getTotalDivisions);
router.get('/total-sections', /* auth, */ getTotalSections);
router.get('/total-subsections', /* auth, */ getTotalSubSections);
router.get('/total-employees', /* auth, */ getTotalEmployees);
router.get('/attendance-trend', /* auth, */ getAttendanceTrend);
router.get('/is-division-attendance', /* auth, */ getIsDivisionAttendance);

// Manual refresh for total_count_dashboard (used by Manual Sync page)
router.post('/total-counts/refresh', /* auth, */ refreshDashboardTotalCounts);

// @route   POST /api/dashboard/attendance-trend/refresh
// @desc    Refresh attendance trend data
// @access  Private
router.post(
  '/attendance-trend/refresh',
  // auth, // Temporarily disable auth for testing
  refreshAttendanceTrend
);

// @route   POST /api/dashboard/present-absent-sync
// @desc    Sync present/absent IS division employees into present_employees_IS
// @access  Private
router.post(
  '/present-absent-sync',
  // auth, // Temporarily disable auth for testing
  syncPresentAbsentIS
);

// @route   GET /api/dashboard/activities/recent
// @desc    Get recent activities (audit logs)
// @access  Private
router.get(
  '/activities/recent',
  // auth, // Temporarily disable auth for testing
  getRecentActivities
);

module.exports = router;