const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const { 
  refreshCache, 
  clearCache, 
  isCacheInitialized,
  getCacheStatus,
  getCachedSubSections,
  getCachedUsers,
  getCachedAttendanceCount,
  getCachedMealsCount,
  refreshSubSectionsCache,
  refreshUsersCache
} = require('../services/mongodbCacheService');

// @route   GET /api/mongodb-cache/status
// @desc    Get MongoDB cache status
// @access  Private
router.get('/status', auth, async (req, res) => {
  try {
    const status = getCacheStatus();

    res.status(200).json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Get MongoDB cache status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting MongoDB cache status'
    });
  }
});

// @route   POST /api/mongodb-cache/refresh
// @desc    Manually refresh MongoDB cache
// @access  Private (super_admin only)
router.post('/refresh', auth, authorize('super_admin'), async (req, res) => {
  try {
    console.log('🔄 Manual MongoDB cache refresh requested by:', req.user.email);
    const success = await refreshCache();

    if (success) {
      res.status(200).json({
        success: true,
        message: 'MongoDB cache refreshed successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to refresh MongoDB cache'
      });
    }
  } catch (error) {
    console.error('Refresh MongoDB cache error:', error);
    res.status(500).json({
      success: false,
      message: 'Error refreshing MongoDB cache'
    });
  }
});

// @route   POST /api/mongodb-cache/clear
// @desc    Clear MongoDB cache
// @access  Private (super_admin only)
router.post('/clear', auth, authorize('super_admin'), async (req, res) => {
  try {
    console.log('🗑️ MongoDB cache clear requested by:', req.user.email);
    clearCache();

    res.status(200).json({
      success: true,
      message: 'MongoDB cache cleared successfully'
    });
  } catch (error) {
    console.error('Clear MongoDB cache error:', error);
    res.status(500).json({
      success: false,
      message: 'Error clearing MongoDB cache'
    });
  }
});

// @route   GET /api/mongodb-cache/subsections
// @desc    Get all cached sub sections from MongoDB
// @access  Private
router.get('/subsections', auth, async (req, res) => {
  try {
    const subSections = getCachedSubSections();

    if (!subSections) {
      return res.status(503).json({
        success: false,
        message: 'MongoDB cache not initialized yet'
      });
    }

    res.status(200).json({
      success: true,
      data: subSections
    });
  } catch (error) {
    console.error('Get cached sub sections error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting cached sub sections'
    });
  }
});

// @route   GET /api/mongodb-cache/users
// @desc    Get all cached users from MongoDB
// @access  Private
router.get('/users', auth, async (req, res) => {
  try {
    const users = getCachedUsers();

    if (!users) {
      return res.status(503).json({
        success: false,
        message: 'MongoDB cache not initialized yet'
      });
    }

    res.status(200).json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Get cached users error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting cached users'
    });
  }
});

module.exports = router;