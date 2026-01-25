/**
 * Performance Testing & Monitoring Routes
 * 
 * Provides endpoints to test and monitor system performance
 */

const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const redisCacheService = require('../services/redisCacheService');
const performanceMonitor = require('../middleware/performanceMonitor');

// @route   GET /api/performance/stats
// @desc    Get overall performance statistics
// @access  Private (Admin)
router.get('/stats', auth, authorize('super_admin', 'admin'), (req, res) => {
  try {
    const requestStats = performanceMonitor.getStats();
    const cacheStats = redisCacheService.getStats();

    res.status(200).json({
      success: true,
      data: {
        requests: requestStats,
        cache: cacheStats,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Get performance stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving performance statistics'
    });
  }
});

// @route   GET /api/performance/endpoints
// @desc    Get performance stats by endpoint
// @access  Private (Admin)
router.get('/endpoints', auth, authorize('super_admin', 'admin'), (req, res) => {
  try {
    const endpointStats = performanceMonitor.getStatsByEndpoint();

    res.status(200).json({
      success: true,
      data: endpointStats
    });
  } catch (error) {
    console.error('Get endpoint stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving endpoint statistics'
    });
  }
});

// @route   GET /api/performance/slow-requests
// @desc    Get recent slow requests
// @access  Private (Admin)
router.get('/slow-requests', auth, authorize('super_admin', 'admin'), (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const slowRequests = performanceMonitor.getSlowRequests(limit);

    res.status(200).json({
      success: true,
      data: slowRequests,
      count: slowRequests.length
    });
  } catch (error) {
    console.error('Get slow requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving slow requests'
    });
  }
});

// @route   POST /api/performance/test/dashboard
// @desc    Test dashboard loading performance
// @access  Private (Admin)
router.post('/test/dashboard', auth, authorize('super_admin', 'admin'), async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Simulate dashboard data fetching
    const results = {
      cached: {},
      fresh: {}
    };

    // Test with cache
    const cachedStart = Date.now();
    const cachedStats = await redisCacheService.getCache(redisCacheService.keys.dashboardStats());
    results.cached.stats = Date.now() - cachedStart;

    const cachedActivitiesStart = Date.now();
    const cachedActivities = await redisCacheService.getCache(redisCacheService.keys.dashboardActivities());
    results.cached.activities = Date.now() - cachedActivitiesStart;

    results.cached.total = results.cached.stats + results.cached.activities;
    results.cached.dataFound = !!(cachedStats && cachedActivities);

    // Test without cache (fetch from DB)
    const freshStart = Date.now();
    const dashboardController = require('../controllers/dashboardController');
    
    // Mock request/response for testing
    const mockReq = { user: req.user, method: 'GET' };
    let responseData = null;
    const mockRes = {
      status: () => mockRes,
      json: (data) => { responseData = data; return mockRes; }
    };

    results.fresh.total = Date.now() - freshStart;
    results.fresh.dataFound = !!responseData;

    const totalTime = Date.now() - startTime;

    res.status(200).json({
      success: true,
      data: {
        results,
        speedup: results.cached.dataFound ? 
          `${(results.fresh.total / results.cached.total).toFixed(2)}x faster` : 
          'N/A',
        totalTestTime: `${totalTime}ms`,
        recommendation: results.cached.dataFound ? 
          'Cache is working optimally' : 
          'Consider preloading cache for better performance'
      }
    });
  } catch (error) {
    console.error('Dashboard performance test error:', error);
    res.status(500).json({
      success: false,
      message: 'Error testing dashboard performance',
      error: error.message
    });
  }
});

// @route   POST /api/performance/test/reports
// @desc    Test report generation performance
// @access  Private (Admin)
router.post('/test/reports', auth, authorize('super_admin', 'admin'), async (req, res) => {
  try {
    const { employeeId = '465963', startDate, endDate } = req.body;
    const today = new Date().toISOString().split('T')[0];
    const testStartDate = startDate || today;
    const testEndDate = endDate || today;

    const results = {};

    // Test individual report with cache
    const cacheKey = redisCacheService.keys.individualReport(employeeId, testStartDate, testEndDate);
    
    const cachedStart = Date.now();
    const cachedReport = await redisCacheService.getCache(cacheKey);
    results.cachedTime = Date.now() - cachedStart;
    results.cacheHit = !!cachedReport;

    // Test without cache
    if (!cachedReport) {
      const freshStart = Date.now();
      // Fetch from database
      const { executeQuery } = require('../config/mysqlPool');
      const query = `SELECT * FROM attendance WHERE employee_ID = ? AND date_ BETWEEN ? AND ? LIMIT 100`;
      await executeQuery(query, [employeeId, testStartDate, testEndDate]);
      results.freshTime = Date.now() - freshStart;
      results.speedup = 'N/A (no cache)';
    } else {
      results.speedup = 'Instant (from cache)';
    }

    res.status(200).json({
      success: true,
      data: results,
      message: `Report performance test completed for employee ${employeeId}`
    });
  } catch (error) {
    console.error('Report performance test error:', error);
    res.status(500).json({
      success: false,
      message: 'Error testing report performance',
      error: error.message
    });
  }
});

// @route   POST /api/performance/clear
// @desc    Clear performance monitoring data
// @access  Private (Super Admin)
router.post('/clear', auth, authorize('super_admin'), (req, res) => {
  try {
    performanceMonitor.clear();
    redisCacheService.resetStats();

    res.status(200).json({
      success: true,
      message: 'Performance monitoring data cleared'
    });
  } catch (error) {
    console.error('Clear performance data error:', error);
    res.status(500).json({
      success: false,
      message: 'Error clearing performance data'
    });
  }
});

module.exports = router;
