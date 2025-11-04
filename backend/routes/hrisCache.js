const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const { 
  refreshCache, 
  clearCache, 
  isCacheInitialized,
  getCachedDivisions,
  getCachedSections,
  getCachedEmployees
} = require('../services/hrisApiService');

// @route   GET /api/hris-cache/status
// @desc    Get HRIS cache status
// @access  Private
router.get('/status', auth, async (req, res) => {
  try {
    const isInitialized = isCacheInitialized();
    const divisions = getCachedDivisions();
    const sections = getCachedSections();
    const employees = getCachedEmployees();

    res.status(200).json({
      success: true,
      data: {
        isInitialized,
        divisionsCount: divisions ? divisions.length : 0,
        sectionsCount: sections ? sections.length : 0,
        employeesCount: employees ? employees.length : 0,
        hasDivisions: !!divisions,
        hasSections: !!sections,
        hasEmployees: !!employees
      }
    });
  } catch (error) {
    console.error('Get cache status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting cache status'
    });
  }
});

// @route   POST /api/hris-cache/refresh
// @desc    Manually refresh HRIS cache
// @access  Private (super_admin only)
router.post('/refresh', auth, authorize('super_admin'), async (req, res) => {
  try {
    console.log('🔄 Manual cache refresh requested by:', req.user.email);
    const success = await refreshCache();

    if (success) {
      res.status(200).json({
        success: true,
        message: 'HRIS cache refreshed successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to refresh HRIS cache'
      });
    }
  } catch (error) {
    console.error('Refresh cache error:', error);
    res.status(500).json({
      success: false,
      message: 'Error refreshing cache'
    });
  }
});

// @route   POST /api/hris-cache/clear
// @desc    Clear HRIS cache
// @access  Private (super_admin only)
router.post('/clear', auth, authorize('super_admin'), async (req, res) => {
  try {
    console.log('🗑️ Cache clear requested by:', req.user.email);
    clearCache();

    res.status(200).json({
      success: true,
      message: 'HRIS cache cleared successfully'
    });
  } catch (error) {
    console.error('Clear cache error:', error);
    res.status(500).json({
      success: false,
      message: 'Error clearing cache'
    });
  }
});

// @route   GET /api/hris-cache/employees
// @desc    Get all cached employees from HRIS
// @access  Private
router.get('/employees', auth, async (req, res) => {
  try {
    const employees = getCachedEmployees();

    if (!employees) {
      return res.status(503).json({
        success: false,
        message: 'HRIS cache not initialized yet'
      });
    }

    res.status(200).json({
      success: true,
      data: employees
    });
  } catch (error) {
    console.error('Get cached employees error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting cached employees'
    });
  }
});

module.exports = router;
