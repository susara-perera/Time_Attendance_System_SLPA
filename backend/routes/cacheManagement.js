/**
 * Cache Management Routes
 * 
 * Provides endpoints for monitoring and managing Employee Management cache
 */

const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const redisCacheService = require('../services/redisCacheService');
const cacheController = require('../controllers/cacheController');
const { 
  invalidateEmployeeCaches,
  invalidateEmployeeCache,
  getCacheStats 
} = require('../middleware/employeeCacheMiddleware');

/**
 * @route   GET /api/cache/stats
 * @desc    Get cache statistics
 * @access  Private (Admin only)
 */
router.get('/stats', auth, authorize('super_admin', 'admin'), (req, res) => {
  try {
    const stats = getCacheStats();
    
    res.status(200).json({
      success: true,
      stats,
      message: 'Cache statistics retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting cache stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get cache statistics',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/cache/clear
 * @desc    Clear all employee-related caches
 * @access  Private (Admin only)
 */
router.post('/clear', auth, authorize('super_admin', 'admin'), async (req, res) => {
  try {
    const result = await invalidateEmployeeCaches();
    
    if (result) {
      res.status(200).json({
        success: true,
        message: 'All employee caches cleared successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to clear caches - Redis may not be connected'
      });
    }
  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear caches',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/cache/clear/employee/:empId
 * @desc    Clear cache for specific employee
 * @access  Private (Admin only)
 */
router.post('/clear/employee/:empId', auth, authorize('super_admin', 'admin'), async (req, res) => {
  try {
    const { empId } = req.params;
    const result = await invalidateEmployeeCache(empId);
    
    if (result) {
      res.status(200).json({
        success: true,
        message: `Cache cleared for employee ${empId}`
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to clear employee cache - Redis may not be connected'
      });
    }
  } catch (error) {
    console.error('Error clearing employee cache:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear employee cache',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/cache/health
 * @desc    Check Redis cache health
 * @access  Private
 */
router.get('/health', auth, (req, res) => {
  try {
    const isConnected = redisCacheService.isConnected;
    
    res.status(200).json({
      success: true,
      isConnected,
      message: isConnected 
        ? 'Redis cache is connected and operational' 
        : 'Redis cache is not connected'
    });
  } catch (error) {
    console.error('Error checking cache health:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check cache health',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/cache/reset-stats
 * @desc    Reset cache statistics
 * @access  Private (Admin only)
 */
router.post('/reset-stats', auth, authorize('super_admin', 'admin'), (req, res) => {
  try {
    redisCacheService.resetStats();
    
    res.status(200).json({
      success: true,
      message: 'Cache statistics reset successfully'
    });
  } catch (error) {
    console.error('Error resetting cache stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset cache statistics',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/cache/warmup
 * @desc    Warmup attendance data cache
 * @access  Private (Admin only) - TEMPORARILY REMOVED FOR TESTING
 */
router.post('/warmup', cacheController.warmupCache);

module.exports = router;
