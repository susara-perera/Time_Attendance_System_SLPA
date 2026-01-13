const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { authorize } = require('../middleware/auth');

const {
  getCacheStats,
  getCacheInfo,
  clearCache,
  clearAllCache,
  clearDateRangeCache,
  clearOrganizationCache,
  resetCacheStats,
  connectCache,
  // New cache preload endpoints
  triggerCachePreload,
  startLoginCacheActivation,
  getCacheActivationProgress,
  getCacheStatus,
  invalidateCache,
  getSyncHistory,
  getCacheMetadata,
  searchCache,
  warmupCache
} = require('../controllers/cacheController');

// All cache routes require admin or super_admin
const adminAuth = [auth, authorize('super_admin', 'admin')];

// @route   GET /api/cache/stats
// @desc    Get cache statistics
// @access  Private (Admin)
router.get('/stats', adminAuth, getCacheStats);

// @route   GET /api/cache/info
// @desc    Get cache info
// @access  Private (Admin)
router.get('/info', adminAuth, getCacheInfo);

// @route   POST /api/cache/clear
// @desc    Clear specific report cache
// @access  Private (Admin)
router.post('/clear', adminAuth, clearCache);

// @route   POST /api/cache/clear-all
// @desc    Clear all report caches
// @access  Private (Admin)
router.post('/clear-all', adminAuth, clearAllCache);

// @route   POST /api/cache/clear-date-range
// @desc    Clear caches for specific date range
// @access  Private (Admin)
router.post('/clear-date-range', adminAuth, clearDateRangeCache);

// @route   POST /api/cache/clear-organization
// @desc    Clear caches for specific organization unit
// @access  Private (Admin)
router.post('/clear-organization', adminAuth, clearOrganizationCache);

// @route   POST /api/cache/reset-stats
// @desc    Reset cache statistics
// @access  Private (Admin)
router.post('/reset-stats', adminAuth, resetCacheStats);

// @route   POST /api/cache/connect
// @desc    Connect/Initialize cache
// @access  Private (Admin)
router.post('/connect', adminAuth, connectCache);

// ========================================
// NEW CACHE PRELOAD ROUTES
// ========================================

// @route   POST /api/cache/preload
// @desc    Trigger full cache preload
// @access  Private (Admin)
router.post('/preload', adminAuth, triggerCachePreload);

// @route   POST /api/cache/preload/login
// @desc    Start full-system cache activation for login progress UI
// @access  Private
router.post('/preload/login', auth, startLoginCacheActivation);

// @route   GET /api/cache/preload/progress/:jobId
// @desc    Get cache activation progress for a given job
// @access  Private
router.get('/preload/progress/:jobId', auth, getCacheActivationProgress);

// @route   POST /api/cache/warmup
// @desc    Warm up cache (preload if cold)
// @access  Private (Admin)
router.post('/warmup', adminAuth, warmupCache);

// @route   GET /api/cache/status
// @desc    Get cache preload status and statistics
// @access  Private
router.get('/status', auth, getCacheStatus);

// @route   POST /api/cache/invalidate
// @desc    Invalidate all cache
// @access  Private (Super Admin only)
router.post('/invalidate', [auth, authorize('super_admin')], invalidateCache);

// @route   GET /api/cache/sync-history
// @desc    Get cache sync history
// @access  Private
router.get('/sync-history', auth, getSyncHistory);

// @route   GET /api/cache/metadata
// @desc    Get cache metadata
// @access  Private
router.get('/metadata', auth, getCacheMetadata);

// @route   GET /api/cache/search
// @desc    Search entities in cache
// @access  Private
router.get('/search', auth, searchCache);

// @route   POST /api/cache/connect
// @desc    Connect/Initialize cache
// @access  Private (Admin)
router.post('/connect', adminAuth, connectCache);

module.exports = router;
