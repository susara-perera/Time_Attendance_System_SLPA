const express = require('express');
const { getDashboardStats, getDashboardTotalCounts, refreshDashboardTotalCounts, getRecentActivities } = require('../controllers/dashboardController');
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

// @route   GET /api/dashboard/total-counts
// @desc    Get dashboard total counts (fast cached)
// @access  Private
router.get(
  '/total-counts',
  // auth, // Temporarily disable auth for testing
  getDashboardTotalCounts
);

// @route   POST /api/dashboard/total-counts/refresh
// @desc    Refresh dashboard total counts
// @access  Private
router.post(
  '/total-counts/refresh',
  // auth, // Temporarily disable auth for testing
  refreshDashboardTotalCounts
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