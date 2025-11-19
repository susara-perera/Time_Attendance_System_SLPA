const express = require('express');
const { getDashboardStats } = require('../controllers/dashboardController');
const { getRecentActivities } = require('../controllers/activityController');
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

// @route   GET /api/dashboard/activities/recent
// @desc    Get recent activities (audit logs)
// @access  Private
router.get(
  '/activities/recent',
  // auth, // Temporarily disable auth for testing
  getRecentActivities
);

module.exports = router;
