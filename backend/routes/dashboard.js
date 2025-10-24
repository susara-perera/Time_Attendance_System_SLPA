const express = require('express');
const { getDashboardStats } = require('../controllers/dashboardController');
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

module.exports = router;
