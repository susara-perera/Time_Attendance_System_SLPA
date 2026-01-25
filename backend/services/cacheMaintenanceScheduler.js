/**
 * Cache Maintenance Scheduler
 * 
 * Automated background tasks for cache optimization:
 * - Periodic cleanup of stale data
 * - Memory usage monitoring
 * - Performance optimization
 * - Usage pattern analysis
 * - Automatic eviction of least-used data
 */

const cron = require('node-cron');
const smartCacheService = require('./smartCacheService');
const { getCache } = require('../config/reportCache');
const { sequelize } = require('../config/mysql');

class CacheMaintenanceScheduler {
  constructor() {
    this.cache = getCache();
    this.jobs = [];
    this.metrics = {
      cleanups: 0,
      optimizations: 0,
      lastCleanup: null,
      lastOptimization: null,
      memoryFreed: 0
    };
  }

  /**
   * Start all maintenance jobs
   */
  start() {
    console.log('🔧 Starting cache maintenance scheduler...');

    // Job 1: Quick cleanup every 15 minutes
    const quickCleanup = cron.schedule('*/15 * * * *', async () => {
      await this.quickCleanup();
    });
    this.jobs.push({ name: 'Quick Cleanup', schedule: 'Every 15 min', cron: quickCleanup });

    // Job 2: Deep cleanup every hour
    const deepCleanup = cron.schedule('0 * * * *', async () => {
      await this.deepCleanup();
    });
    this.jobs.push({ name: 'Deep Cleanup', schedule: 'Every hour', cron: deepCleanup });

    // Job 3: Memory optimization every 30 minutes
    const memoryOptimization = cron.schedule('*/30 * * * *', async () => {
      await this.optimizeMemory();
    });
    this.jobs.push({ name: 'Memory Optimization', schedule: 'Every 30 min', cron: memoryOptimization });

    // Job 4: Usage analysis every 6 hours
    const usageAnalysis = cron.schedule('0 */6 * * *', async () => {
      await this.analyzeUsagePatterns();
    });
    this.jobs.push({ name: 'Usage Analysis', schedule: 'Every 6 hours', cron: usageAnalysis });

    // Job 5: Nightly full optimization at 2 AM
    const nightlyOptimization = cron.schedule('0 2 * * *', async () => {
      await this.nightlyFullOptimization();
    });
    this.jobs.push({ name: 'Nightly Optimization', schedule: 'Daily at 2 AM', cron: nightlyOptimization });

    // Job 6: Save usage statistics every hour
    const saveStats = cron.schedule('0 * * * *', async () => {
      await smartCacheService.saveUsageStats();
    });
    this.jobs.push({ name: 'Save Statistics', schedule: 'Every hour', cron: saveStats });

    // Job 7: Health check every 5 minutes
    const healthCheck = cron.schedule('*/5 * * * *', async () => {
      await this.healthCheck();
    });
    this.jobs.push({ name: 'Health Check', schedule: 'Every 5 min', cron: healthCheck });

    console.log(`✅ Started ${this.jobs.length} maintenance jobs`);
    this.jobs.forEach(job => {
      console.log(`   📅 ${job.name}: ${job.schedule}`);
    });
  }

  /**
   * Stop all maintenance jobs
   */
  stop() {
    this.jobs.forEach(job => {
      job.cron.stop();
    });
    console.log('🛑 Cache maintenance scheduler stopped');
  }

  /**
   * Quick cleanup: Remove expired keys
   */
  async quickCleanup() {
    try {
      console.log('🧹 Running quick cleanup...');
      const startTime = Date.now();
      
      const client = await this.cache.getClient();
      if (!client) return;

      // Get all keys
      const keys = await client.keys('*');
      let cleaned = 0;

      for (const key of keys) {
        try {
          const ttl = await client.ttl(key);
          // Remove keys that are about to expire (< 60 seconds TTL)
          if (ttl > 0 && ttl < 60) {
            await client.del(key);
            cleaned++;
          }
        } catch (error) {
          // Skip errors for individual keys
        }
      }

      const duration = Date.now() - startTime;
      this.metrics.cleanups++;
      this.metrics.lastCleanup = new Date();

      console.log(`✅ Quick cleanup completed: ${cleaned} keys removed in ${duration}ms`);
      
    } catch (error) {
      console.error('Quick cleanup error:', error);
    }
  }

  /**
   * Deep cleanup: Remove stale and unused data
   */
  async deepCleanup() {
    try {
      console.log('🔍 Running deep cleanup...');
      const startTime = Date.now();

      const client = await this.cache.getClient();
      if (!client) return;

      // Pattern-based cleanup
      const patterns = [
        'lazy:*',      // Lazy-loaded entities
        'search:*',    // Search results
        'report:*'     // Report cache
      ];

      let totalCleaned = 0;

      for (const pattern of patterns) {
        const keys = await client.keys(pattern);
        let cleaned = 0;

        for (const key of keys) {
          try {
            const ttl = await client.ttl(key);
            // Remove expired or very old keys
            if (ttl < 0 || ttl < 300) { // Remove if no TTL or < 5 min remaining
              await client.del(key);
              cleaned++;
            }
          } catch (error) {
            // Skip individual key errors
          }
        }

        totalCleaned += cleaned;
        console.log(`   Cleaned ${cleaned} keys matching ${pattern}`);
      }

      const duration = Date.now() - startTime;
      this.metrics.cleanups++;
      this.metrics.lastCleanup = new Date();

      console.log(`✅ Deep cleanup completed: ${totalCleaned} keys removed in ${duration}ms`);

    } catch (error) {
      console.error('Deep cleanup error:', error);
    }
  }

  /**
   * Optimize memory usage
   */
  async optimizeMemory() {
    try {
      console.log('💾 Running memory optimization...');
      const startTime = Date.now();

      const client = await this.cache.getClient();
      if (!client) return;

      // Get memory info
      const info = await client.info('memory');
      const usedMemoryMatch = info.match(/used_memory:(\d+)/);
      const maxMemoryMatch = info.match(/maxmemory:(\d+)/);
      
      const usedMemory = usedMemoryMatch ? parseInt(usedMemoryMatch[1]) : 0;
      const maxMemory = maxMemoryMatch ? parseInt(maxMemoryMatch[1]) : 0;

      console.log(`   Memory usage: ${Math.round(usedMemory / 1024 / 1024)}MB ${maxMemory ? `/ ${Math.round(maxMemory / 1024 / 1024)}MB` : ''}`);

      // If memory usage > 80%, trigger eviction
      if (maxMemory && (usedMemory / maxMemory) > 0.8) {
        console.log('   ⚠️ High memory usage detected, triggering eviction...');
        await smartCacheService.evictIfNeeded();
      }

      // Defragment if needed
      const fragRatioMatch = info.match(/mem_fragmentation_ratio:([\d.]+)/);
      const fragRatio = fragRatioMatch ? parseFloat(fragRatioMatch[1]) : 0;

      if (fragRatio > 1.5) {
        console.log(`   ⚠️ High fragmentation (${fragRatio.toFixed(2)}), consider restarting Redis`);
      }

      const duration = Date.now() - startTime;
      this.metrics.optimizations++;
      this.metrics.lastOptimization = new Date();

      console.log(`✅ Memory optimization completed in ${duration}ms`);

    } catch (error) {
      console.error('Memory optimization error:', error);
    }
  }

  /**
   * Analyze usage patterns
   */
  async analyzeUsagePatterns() {
    try {
      console.log('📊 Analyzing usage patterns...');
      const startTime = Date.now();

      const stats = smartCacheService.getStats();
      console.log('   Current stats:', stats);

      // Identify hot vs cold data
      const usageMap = smartCacheService.usageStats;
      const entries = Array.from(usageMap.entries());
      
      const hotThreshold = 50;  // Accessed more than 50 times
      const coldThreshold = 5;  // Accessed less than 5 times

      const hotData = entries.filter(([_, count]) => count >= hotThreshold);
      const coldData = entries.filter(([_, count]) => count < coldThreshold);

      console.log(`   Hot data: ${hotData.length} items (${Math.round(hotData.length / entries.length * 100)}%)`);
      console.log(`   Cold data: ${coldData.length} items (${Math.round(coldData.length / entries.length * 100)}%)`);
      console.log(`   Hit rate: ${stats.hitRate.toFixed(2)}%`);

      // Recommend optimizations
      if (stats.hitRate < 70) {
        console.log('   💡 Recommendation: Consider preloading more frequently accessed data');
      }

      if (coldData.length > entries.length * 0.5) {
        console.log('   💡 Recommendation: Too much cold data, consider reducing TTL');
      }

      const duration = Date.now() - startTime;
      console.log(`✅ Usage analysis completed in ${duration}ms`);

    } catch (error) {
      console.error('Usage analysis error:', error);
    }
  }

  /**
   * Nightly full optimization
   */
  async nightlyFullOptimization() {
    try {
      console.log('🌙 Starting nightly full optimization...');
      const startTime = Date.now();

      // 1. Deep cleanup
      await this.deepCleanup();

      // 2. Rebuild indexes and relationships
      console.log('   Rebuilding frequently accessed data...');
      // TEMPORARILY DISABLED: await smartCacheService.smartPreload();
      console.log('   🚫 Smart preload temporarily disabled in nightly optimization');

      // 3. Compact memory
      await this.optimizeMemory();

      // 4. Save statistics
      await smartCacheService.saveUsageStats();

      // 5. Generate performance report
      await this.generatePerformanceReport();

      const duration = Date.now() - startTime;
      console.log(`✅ Nightly optimization completed in ${Math.round(duration / 1000)}s`);

    } catch (error) {
      console.error('Nightly optimization error:', error);
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const client = await this.cache.getClient();
      if (!client) {
        console.warn('⚠️ Cache client not available');
        return;
      }

      // Check connectivity
      const pong = await client.ping();
      if (pong !== 'PONG') {
        console.error('❌ Redis health check failed');
        // Attempt reconnect
        await this.cache.connect();
      }

      // Check memory
      const info = await client.info('memory');
      const usedMemoryMatch = info.match(/used_memory:(\d+)/);
      const usedMemory = usedMemoryMatch ? parseInt(usedMemoryMatch[1]) : 0;

      // Warn if memory usage is very high
      if (usedMemory > 1024 * 1024 * 1024) { // > 1GB
        console.warn(`⚠️ High cache memory usage: ${Math.round(usedMemory / 1024 / 1024)}MB`);
      }

    } catch (error) {
      console.error('Health check error:', error);
    }
  }

  /**
   * Generate performance report
   */
  async generatePerformanceReport() {
    try {
      const stats = smartCacheService.getStats();
      const report = {
        timestamp: new Date(),
        cache_stats: stats,
        maintenance_metrics: this.metrics,
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          cache_enabled: this.cache.isEnabled,
          cache_connected: this.cache.isConnected
        }
      };

      // Log to file
      const fs = require('fs');
      const path = require('path');
      const logDir = path.join(__dirname, '..', 'logs');
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      const reportPath = path.join(logDir, 'cache_performance_reports.jsonl');
      fs.appendFileSync(reportPath, JSON.stringify(report) + '\n');

      console.log('📋 Performance report generated');

    } catch (error) {
      console.error('Failed to generate performance report:', error);
    }
  }

  /**
   * Get maintenance status
   */
  getStatus() {
    return {
      active: this.jobs.length > 0,
      jobs: this.jobs.map(j => ({ name: j.name, schedule: j.schedule })),
      metrics: this.metrics,
      cache_stats: smartCacheService.getStats()
    };
  }
}

module.exports = new CacheMaintenanceScheduler();
