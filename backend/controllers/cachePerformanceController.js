/**
 * Cache Performance Monitor
 * 
 * Real-time performance monitoring and auto-optimization
 * for cache system with 50M+ records
 */

const smartCacheService = require('../services/smartCacheService');
const cacheMaintenanceScheduler = require('../services/cacheMaintenanceScheduler');
const { getCache } = require('../config/reportCache');

/**
 * @desc    Get real-time cache performance metrics
 * @route   GET /api/cache/performance
 * @access  Private (Admin)
 */
const getPerformanceMetrics = async (req, res) => {
  try {
    const cache = getCache();
    const client = await cache.getClient();

    // Get Redis info
    let redisInfo = {};
    if (client) {
      const info = await client.info();
      const memory = await client.info('memory');
      const stats = await client.info('stats');
      
      redisInfo = {
        version: (info.match(/redis_version:([\d.]+)/) || [])[1],
        uptime: parseInt((info.match(/uptime_in_seconds:(\d+)/) || [])[1] || 0),
        connected_clients: parseInt((info.match(/connected_clients:(\d+)/) || [])[1] || 0),
        used_memory: parseInt((memory.match(/used_memory:(\d+)/) || [])[1] || 0),
        used_memory_human: (memory.match(/used_memory_human:(.+)/) || [])[1],
        used_memory_peak: parseInt((memory.match(/used_memory_peak:(\d+)/) || [])[1] || 0),
        mem_fragmentation_ratio: parseFloat((memory.match(/mem_fragmentation_ratio:([\d.]+)/) || [])[1] || 0),
        total_connections_received: parseInt((stats.match(/total_connections_received:(\d+)/) || [])[1] || 0),
        total_commands_processed: parseInt((stats.match(/total_commands_processed:(\d+)/) || [])[1] || 0),
        instantaneous_ops_per_sec: parseInt((stats.match(/instantaneous_ops_per_sec:(\d+)/) || [])[1] || 0),
        keyspace_hits: parseInt((stats.match(/keyspace_hits:(\d+)/) || [])[1] || 0),
        keyspace_misses: parseInt((stats.match(/keyspace_misses:(\d+)/) || [])[1] || 0)
      };
      
      // Calculate hit rate
      const totalRequests = redisInfo.keyspace_hits + redisInfo.keyspace_misses;
      redisInfo.hit_rate = totalRequests > 0 
        ? ((redisInfo.keyspace_hits / totalRequests) * 100).toFixed(2) 
        : 0;
    }

    // Get smart cache stats
    const smartStats = smartCacheService.getStats();

    // Get maintenance status
    const maintenanceStatus = cacheMaintenanceScheduler.getStatus();

    // System metrics
    const systemMetrics = {
      node_version: process.version,
      uptime: Math.round(process.uptime()),
      memory_usage: process.memoryUsage(),
      cpu_usage: process.cpuUsage()
    };

    // Performance grade
    const hitRate = parseFloat(redisInfo.hit_rate || 0);
    let performanceGrade = 'F';
    if (hitRate >= 95) performanceGrade = 'A+';
    else if (hitRate >= 90) performanceGrade = 'A';
    else if (hitRate >= 85) performanceGrade = 'B';
    else if (hitRate >= 75) performanceGrade = 'C';
    else if (hitRate >= 60) performanceGrade = 'D';

    res.json({
      success: true,
      data: {
        redis: redisInfo,
        smart_cache: smartStats,
        maintenance: maintenanceStatus,
        system: systemMetrics,
        performance_grade: performanceGrade,
        timestamp: new Date()
      }
    });

  } catch (error) {
    console.error('Get performance metrics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get performance metrics',
      error: error.message
    });
  }
};

/**
 * @desc    Get cache analytics and recommendations
 * @route   GET /api/cache/analytics
 * @access  Private (Admin)
 */
const getCacheAnalytics = async (req, res) => {
  try {
    const smartStats = smartCacheService.getStats();
    const cache = getCache();

    // Analyze performance
    const analytics = {
      efficiency: {
        hit_rate: smartStats.hitRate,
        status: smartStats.hitRate >= 80 ? 'excellent' : smartStats.hitRate >= 60 ? 'good' : 'needs_improvement'
      },
      usage: {
        total_tracked: smartStats.usageTracked,
        most_accessed: await getTopAccessedEntities(10)
      },
      recommendations: []
    };

    // Generate recommendations
    if (smartStats.hitRate < 70) {
      analytics.recommendations.push({
        type: 'performance',
        priority: 'high',
        message: 'Cache hit rate is below 70%. Consider increasing preload frequency or TTL values.'
      });
    }

    if (smartStats.evictions > 100) {
      analytics.recommendations.push({
        type: 'memory',
        priority: 'medium',
        message: `${smartStats.evictions} cache evictions detected. Consider increasing cache memory limit.`
      });
    }

    if (smartStats.isWarming) {
      analytics.recommendations.push({
        type: 'info',
        priority: 'low',
        message: 'Cache is currently warming up. Performance will improve once complete.'
      });
    }

    if (!smartStats.lastWarmupTime) {
      analytics.recommendations.push({
        type: 'optimization',
        priority: 'high',
        message: 'Cache has not been preloaded. Run smart preload for better performance.'
      });
    }

    res.json({
      success: true,
      data: analytics
    });

  } catch (error) {
    console.error('Get cache analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get analytics',
      error: error.message
    });
  }
};

/**
 * @desc    Trigger auto-optimization
 * @route   POST /api/cache/optimize
 * @access  Private (Admin)
 */
const triggerOptimization = async (req, res) => {
  try {
    const { type = 'smart' } = req.body;

    console.log(`🔧 Triggering ${type} optimization...`);

    let result = {};

    if (type === 'smart' || type === 'full') {
      // Run smart preload
      // TEMPORARILY DISABLED: await smartCacheService.smartPreload();
      console.log('🚫 Smart preload temporarily disabled in optimization');
      result.smart_preload = 'disabled';
    }

    if (type === 'memory' || type === 'full') {
      // Optimize memory
      await smartCacheService.evictIfNeeded();
      result.memory_optimization = 'completed';
    }

    if (type === 'cleanup' || type === 'full') {
      // Run cleanup
      await cacheMaintenanceScheduler.deepCleanup();
      result.cleanup = 'completed';
    }

    res.json({
      success: true,
      message: `${type} optimization completed`,
      data: result
    });

  } catch (error) {
    console.error('Trigger optimization error:', error);
    res.status(500).json({
      success: false,
      message: 'Optimization failed',
      error: error.message
    });
  }
};

/**
 * @desc    Get performance history
 * @route   GET /api/cache/performance/history
 * @access  Private (Admin)
 */
const getPerformanceHistory = async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const readline = require('readline');

    const logPath = path.join(__dirname, '..', 'logs', 'cache_performance_reports.jsonl');

    if (!fs.existsSync(logPath)) {
      return res.json({
        success: true,
        data: []
      });
    }

    const reports = [];
    const fileStream = fs.createReadStream(logPath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      try {
        const report = JSON.parse(line);
        reports.push(report);
      } catch (err) {
        // Skip invalid lines
      }
    }

    // Get last 24 hours of data
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentReports = reports.filter(r => new Date(r.timestamp) > dayAgo);

    res.json({
      success: true,
      data: recentReports.slice(-100) // Last 100 reports
    });

  } catch (error) {
    console.error('Get performance history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get history',
      error: error.message
    });
  }
};

/**
 * @desc    Get cache size breakdown
 * @route   GET /api/cache/size-breakdown
 * @access  Private (Admin)
 */
const getCacheSizeBreakdown = async (req, res) => {
  try {
    const cache = getCache();
    const client = await cache.getClient();

    if (!client) {
      return res.json({
        success: true,
        data: { error: 'Cache client not available' }
      });
    }

    const patterns = [
      { name: 'Lazy Load', pattern: 'lazy:*' },
      { name: 'Search Results', pattern: 'search:*' },
      { name: 'Reports', pattern: 'report:*' },
      { name: 'System', pattern: 'system:*' },
      { name: 'Cache Data', pattern: 'cache:*' }
    ];

    const breakdown = [];

    for (const { name, pattern } of patterns) {
      const keys = await client.keys(pattern);
      let totalSize = 0;

      // Sample 100 keys to estimate size
      const sample = keys.slice(0, 100);
      for (const key of sample) {
        try {
          const value = await client.get(key);
          if (value) {
            totalSize += value.length;
          }
        } catch (err) {
          // Skip
        }
      }

      // Extrapolate to all keys
      const avgSize = sample.length > 0 ? totalSize / sample.length : 0;
      const estimatedTotal = avgSize * keys.length;

      breakdown.push({
        category: name,
        key_count: keys.length,
        estimated_size_bytes: Math.round(estimatedTotal),
        estimated_size_mb: (estimatedTotal / 1024 / 1024).toFixed(2)
      });
    }

    res.json({
      success: true,
      data: breakdown
    });

  } catch (error) {
    console.error('Get cache size breakdown error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get size breakdown',
      error: error.message
    });
  }
};

/**
 * Helper: Get top accessed entities
 */
async function getTopAccessedEntities(limit = 10) {
  const usageMap = smartCacheService.usageStats;
  const entries = Array.from(usageMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, count]) => ({ entity: key, access_count: count }));
  
  return entries;
}

module.exports = {
  getPerformanceMetrics,
  getCacheAnalytics,
  triggerOptimization,
  getPerformanceHistory,
  getCacheSizeBreakdown
};
