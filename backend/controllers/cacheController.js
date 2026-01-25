/**
 * Cache Controller
 * Manages Redis cache for attendance reports and data preloading
 */

const { getCache } = require('../config/reportCache');
const cachePreloadService = require('../services/cachePreloadService');
const cacheDataService = require('../services/cacheDataService');
const { CacheMetadata, CacheSyncLog } = require('../models/mysql');

/**
 * @desc    Get cache statistics
 * @route   GET /api/cache/stats
 * @access  Private (Admin only)
 */
const getCacheStats = async (req, res) => {
  try {
    const cache = getCache();
    const stats = cache.getStats();
    const keysCount = await cache.getKeysCount();
    
    res.json({
      success: true,
      stats: {
        ...stats,
        cachedReports: keysCount
      }
    });
  } catch (error) {
    console.error('Get cache stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving cache statistics',
      error: error.message
    });
  }
};

/**
 * @desc    Get cache info
 * @route   GET /api/cache/info
 * @access  Private (Admin only)
 */
const getCacheInfo = async (req, res) => {
  try {
    const cache = getCache();
    const info = await cache.getInfo();
    
    res.json({
      success: true,
      info
    });
  } catch (error) {
    console.error('Get cache info error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving cache info',
      error: error.message
    });
  }
};

/**
 * @desc    Clear cache
 * @route   POST /api/cache/clear
 * @access  Private (Admin only)
 */
const clearCache = async (req, res) => {
  try {
    const { type, from_date, to_date, division_id, section_id, sub_section_id, employee_id } = req.body;
    
    const cache = getCache();
    const params = { from_date, to_date, division_id, section_id, sub_section_id, employee_id };
    
    const cleared = await cache.clear(type || 'group', params);
    
    res.json({
      success: true,
      message: 'Cache cleared successfully',
      cleared
    });
  } catch (error) {
    console.error('Clear cache error:', error);
    res.status(500).json({
      success: false,
      message: 'Error clearing cache',
      error: error.message
    });
  }
};

/**
 * @desc    Clear all report caches
 * @route   POST /api/cache/clear-all
 * @access  Private (Admin only)
 */
const clearAllCache = async (req, res) => {
  try {
    const cache = getCache();
    const deleted = await cache.clearAll();
    
    res.json({
      success: true,
      message: `Cleared ${deleted} cached reports`,
      deleted
    });
  } catch (error) {
    console.error('Clear all cache error:', error);
    res.status(500).json({
      success: false,
      message: 'Error clearing all caches',
      error: error.message
    });
  }
};

/**
 * @desc    Clear caches for specific date range
 * @route   POST /api/cache/clear-date-range
 * @access  Private (Admin only)
 */
const clearDateRangeCache = async (req, res) => {
  try {
    const { from_date, to_date } = req.body;
    
    if (!from_date || !to_date) {
      return res.status(400).json({
        success: false,
        message: 'from_date and to_date are required'
      });
    }
    
    const cache = getCache();
    const deleted = await cache.clearDateRange(from_date, to_date);
    
    res.json({
      success: true,
      message: `Cleared ${deleted} cached reports for date range ${from_date} to ${to_date}`,
      deleted,
      dateRange: { from_date, to_date }
    });
  } catch (error) {
    console.error('Clear date range cache error:', error);
    res.status(500).json({
      success: false,
      message: 'Error clearing date range cache',
      error: error.message
    });
  }
};

/**
 * @desc    Clear caches for specific organization unit
 * @route   POST /api/cache/clear-organization
 * @access  Private (Admin only)
 */
const clearOrganizationCache = async (req, res) => {
  try {
    const { division_id, section_id, sub_section_id } = req.body;
    
    const cache = getCache();
    const deleted = await cache.clearOrganization(division_id, section_id, sub_section_id);
    
    res.json({
      success: true,
      message: `Cleared ${deleted} cached reports for organization`,
      deleted,
      filters: { division_id, section_id, sub_section_id }
    });
  } catch (error) {
    console.error('Clear organization cache error:', error);
    res.status(500).json({
      success: false,
      message: 'Error clearing organization cache',
      error: error.message
    });
  }
};

/**
 * @desc    Reset cache statistics
 * @route   POST /api/cache/reset-stats
 * @access  Private (Admin only)
 */
const resetCacheStats = async (req, res) => {
  try {
    const cache = getCache();
    cache.resetStats();
    
    res.json({
      success: true,
      message: 'Cache statistics reset successfully'
    });
  } catch (error) {
    console.error('Reset cache stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error resetting cache statistics',
      error: error.message
    });
  }
};

/**
 * @desc    Connect/Initialize cache
 * @route   POST /api/cache/connect
 * @access  Private (Admin only)
 */
const connectCache = async (req, res) => {
  try {
    const cache = getCache();
    const connected = await cache.connect();
    
    res.json({
      success: connected,
      message: connected ? 'Cache connected successfully' : 'Failed to connect to cache',
      info: await cache.getInfo()
    });
  } catch (error) {
    console.error('Connect cache error:', error);
    res.status(500).json({
      success: false,
      message: 'Error connecting to cache',
      error: error.message
    });
  }
};

/**
 * ========================================
 * NEW CACHE PRELOAD ENDPOINTS
 * ========================================
 */

/**
 * @desc    Trigger cache preload
 * @route   POST /api/cache/preload
 * @access  Private (super_admin, admin)
 */
async function triggerCachePreload(req, res) {
  try {
    const triggeredBy = req.user?.id || req.user?._id || 'manual';
    
    console.log(`🔥 Manual cache preload triggered by: ${triggeredBy}`);

    // Run preload asynchronously
    const preloadPromise = cachePreloadService.preloadAll(triggeredBy);

    res.status(202).json({
      success: true,
      message: 'Cache preload triggered successfully. This may take a few seconds.',
      data: {
        triggeredBy,
        triggeredAt: new Date(),
        note: 'Check /api/cache/status for progress'
      }
    });

    // Wait for completion in background
    const result = await preloadPromise;
    console.log('✅ Cache preload completed:', result);

  } catch (error) {
    console.error('Trigger cache preload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to trigger cache preload',
      error: error.message
    });
  }
}

/**
 * @desc    Start full-system cache activation (for login UI)
 * @route   POST /api/cache/preload/login
 * @access  Private
 */
async function startLoginCacheActivation(req, res) {
  try {
    const triggeredBy = req.user?.id || req.user?._id || 'login';
    const result = cachePreloadService.startFullSystemPreloadJob(String(triggeredBy));
    
    // result can be { job, isNew } or just the job object
    const job = result.job || result;
    const isNew = result.isNew !== undefined ? result.isNew : true;

    return res.status(202).json({
      success: true,
      message: isNew ? 'Cache activation started' : 'Cache activation already in progress',
      data: {
        jobId: job.id,
        status: job.status,
        percent: job.percent,
        currentStep: job.currentStep,
        isNew: isNew,
        stepIndex: job.stepIndex,
        steps: job.steps
      }
    });
  } catch (error) {
    console.error('Start login cache activation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to start cache activation',
      error: error.message
    });
  }
}

/**
 * @desc    Start page-wise cache activation
 * @route   POST /api/cache/preload/pages
 * @access  Private
 */
async function startPageWiseCacheActivation(req, res) {
  try {
    const triggeredBy = req.user?.id || req.user?._id || 'user';
    const result = cachePreloadService.startPageWiseCacheJob(String(triggeredBy));
    
    const job = result.job || result;
    const isNew = result.isNew !== undefined ? result.isNew : true;

    return res.status(202).json({
      success: true,
      message: isNew ? 'Page-wise cache activation started' : 'Page-wise cache activation already in progress',
      data: {
        jobId: job.id,
        status: job.status,
        percent: job.percent,
        currentStep: job.currentStep,
        isNew: isNew,
        stepIndex: job.stepIndex,
        steps: job.steps,
        type: 'page-wise'
      }
    });
  } catch (error) {
    console.error('Start page-wise cache activation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to start page-wise cache activation',
      error: error.message
    });
  }
}

/**
 * @desc    Get cache status and statistics
 * @route   GET /api/cache/status
 * @access  Private
 */
async function getCacheStatus(req, res) {
  try {
    const stats = await cachePreloadService.getStats();
    const health = await cacheDataService.checkHealth();
    const isWarm = await cachePreloadService.isCacheWarm();

    res.status(200).json({
      success: true,
      data: {
        is_warm: isWarm,
        health,
        statistics: stats,
        timestamp: new Date()
      }
    });

  } catch (error) {
    console.error('Get cache status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve cache status',
      error: error.message
    });
  }
}

/**
 * @desc    Invalidate all cache
 * @route   POST /api/cache/invalidate
 * @access  Private (super_admin only)
 */
async function invalidateCache(req, res) {
  try {
    await cachePreloadService.invalidateAll();

    res.status(200).json({
      success: true,
      message: 'Cache invalidated successfully',
      data: {
        invalidatedAt: new Date(),
        note: 'Cache will be rebuilt on next login or manual trigger'
      }
    });

  } catch (error) {
    console.error('Invalidate cache error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to invalidate cache',
      error: error.message
    });
  }
}

/**
 * @desc    Get cache sync history
 * @route   GET /api/cache/sync-history
 * @access  Private
 */
async function getSyncHistory(req, res) {
  try {
    const { limit = 20 } = req.query;

    const history = await CacheSyncLog.findAll({
      limit: parseInt(limit),
      order: [['started_at', 'DESC']]
    });

    res.status(200).json({
      success: true,
      data: history,
      count: history.length
    });

  } catch (error) {
    console.error('Get sync history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve sync history',
      error: error.message
    });
  }
}

/**
 * @desc    Get cache metadata
 * @route   GET /api/cache/metadata
 * @access  Private
 */
async function getCacheMetadata(req, res) {
  try {
    const metadata = await CacheMetadata.findAll({
      where: { is_valid: true },
      order: [['last_sync_at', 'DESC']]
    });

    res.status(200).json({
      success: true,
      data: metadata,
      count: metadata.length
    });

  } catch (error) {
    console.error('Get cache metadata error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve cache metadata',
      error: error.message
    });
  }
}

/**
 * @desc    Search entities in cache
 * @route   GET /api/cache/search
 * @access  Private
 */
async function searchCache(req, res) {
  try {
    const { entityType, indexKey, searchValue } = req.query;

    if (!entityType || !indexKey || !searchValue) {
      return res.status(400).json({
        success: false,
        message: 'entityType, indexKey, and searchValue are required'
      });
    }

    const results = await cacheDataService.searchByIndex(
      entityType,
      indexKey,
      searchValue
    );

    res.status(200).json({
      success: true,
      data: results,
      count: results.length
    });

  } catch (error) {
    console.error('Search cache error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search cache',
      error: error.message
    });
  }
}

/**
 * @desc    Warm up cache (preload without invalidating)
 * @route   POST /api/cache/warmup
 * @access  Private (super_admin, admin)
 */
async function warmupCache(req, res) {
  try {
    const triggeredBy = req.user?.id || req.user?._id || 'manual';
    
    // Check if already warm
    const isWarm = await cachePreloadService.isCacheWarm();
    
    if (isWarm) {
      return res.status(200).json({
        success: true,
        message: 'Cache is already warm',
        data: {
          is_warm: true,
          timestamp: new Date()
        }
      });
    }

    // Trigger preload
    const result = await cachePreloadService.preloadAll(triggeredBy);

    res.status(200).json({
      success: true,
      message: 'Cache warmed up successfully',
      data: result
    });

  } catch (error) {
    console.error('Warmup cache error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to warm up cache',
      error: error.message
    });
  }
}

/**
 * @desc    Start cache activation process
 * @route   POST /api/cache/activate
 * @access  Private
 */
const startCacheActivation = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    // Start a full-system preload job and return the job descriptor
    const job = cachePreloadService.startFullSystemPreloadJob(String(userId));

    res.status(202).json({
      success: true,
      message: "Cache activation started",
      jobId: job.id,
      status: job.status,
      percent: job.percent,
      steps: job.steps,
      stepIndex: job.stepIndex
    });

  } catch (error) {
    console.error("Start cache activation error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to start cache activation",
      error: error.message
    });
  }
};

/**
 * @desc    Get cache activation progress
 * @route   GET /api/cache/activation/:jobId
 * @access  Private
 */
const getCacheActivationProgress = async (req, res) => {
  try {
    const { jobId } = req.params;

    const job = cachePreloadService.getPreloadJob(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Cache activation job not found"
      });
    }

    res.json({
      success: true,
      job: {
        id: job.id,
        status: job.status,
        percent: job.percent,
        message: job.message,
        currentStep: job.currentStep,
        stepIndex: job.stepIndex,
        steps: job.steps,
        stepTotals: job.stepTotals || [],
        stepProgress: job.stepProgress || [],
        stepLabels: job.stepLabels || job.steps || [],
        totalWork: job.totalWork || 0,
        cumulativeCompleted: job.cumulativeCompleted || 0,
        attendance: job.attendance || null,
        startedAt: job.startedAt,
        completedAt: job.completedAt
      }
    });

  } catch (error) {
    console.error("Get cache activation progress error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get cache activation progress",
      error: error.message
    });
  }
};

/**
 * @desc    Retry cache activation
 * @route   POST /api/cache/activation/:jobId/retry
 * @access  Private
 */
const retryCacheActivation = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    // Cancel existing job if running
    const existingJob = cachePreloadService.getPreloadJob(jobId);
    if (existingJob && existingJob.status === "running") {
      // Mark as cancelled
      existingJob.status = "cancelled";
      existingJob.completedAt = new Date().toISOString();
      existingJob.message = "Job cancelled for retry";
    }

    // Start new cache preload process
    const job = await cachePreloadService.preloadAll(userId);

    res.json({
      success: true,
      message: "Cache activation restarted",
      jobId: job.id,
      status: job.status
    });

  } catch (error) {
    console.error("Retry cache activation error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retry cache activation",
      error: error.message
    });
  }
};

module.exports = {
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
  startPageWiseCacheActivation,
  getCacheActivationProgress,
  getCacheStatus,
  invalidateCache,
  getSyncHistory,
  getCacheMetadata,
  searchCache,
  warmupCache,
  // Cache activation endpoints
  startCacheActivation,
  retryCacheActivation
};
