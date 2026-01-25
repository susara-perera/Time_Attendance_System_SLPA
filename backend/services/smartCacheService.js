/**
 * Smart Cache Service
 * 
 * Intelligent background cache management for 50M+ record databases
 * Features:
 * - Lazy loading (load data on-demand)
 * - Smart preloading (based on usage patterns)
 * - Background refresh (non-blocking updates)
 * - Memory-efficient streaming
 * - Automatic optimization
 */

const { getCache } = require('../config/reportCache');
const { sequelize } = require('../config/mysql');
const EventEmitter = require('events');

class SmartCacheService extends EventEmitter {
  constructor() {
    super();
    this.cache = getCache();
    this.isWarming = false;
    this.lastWarmupTime = null;
    this.usageStats = new Map(); // Track which data is accessed most
    this.config = {
      // Lazy loading thresholds
      maxBatchSize: 1000,          // Process 1000 records at a time
      streamingEnabled: true,       // Use streaming for large datasets
      
      // Smart preloading
      preloadTopN: 100,            // Preload top 100 most accessed items
      usageTrackingWindow: 7,      // Track usage over 7 days
      
      // Background refresh
      refreshInterval: 30 * 60 * 1000,  // Refresh every 30 minutes
      refreshPriority: ['divisions', 'sections', 'employees'], // Order of refresh
      
      // Memory management
      maxCacheSize: 500 * 1024 * 1024,  // 500MB max cache size
      evictionPolicy: 'LRU',             // Least Recently Used
      
      // Performance
      compressionEnabled: true,     // Compress cached data
      ttlDynamic: true,            // Adjust TTL based on access frequency
    };
    
    this.refreshTimer = null;
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      refreshes: 0,
      loadTime: 0
    };
  }

  /**
   * Initialize smart cache system
   */
  async initialize() {
    try {
      await this.cache.connect();
      console.log('✅ Smart cache service initialized');
      
      // Start background refresh
      this.startBackgroundRefresh();
      
      // Load usage statistics from cache
      await this.loadUsageStats();
      
      return true;
    } catch (error) {
      console.error('❌ Smart cache initialization failed:', error);
      return false;
    }
  }

  /**
   * LAZY LOADING: Load data on-demand
   * Only loads what's needed when it's needed
   */
  async lazyLoad(entityType, id, fetchFn) {
    const cacheKey = `lazy:${entityType}:${id}`;
    
    try {
      // Try cache first
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        this.stats.hits++;
        this.trackUsage(entityType, id);
        return JSON.parse(cached);
      }
      
      // Cache miss - load from database
      this.stats.misses++;
      const data = await fetchFn();
      
      if (data) {
        // Calculate TTL based on access frequency
        const ttl = this.calculateDynamicTTL(entityType, id);
        await this.cache.set(cacheKey, JSON.stringify(data), ttl);
        this.trackUsage(entityType, id);
      }
      
      return data;
    } catch (error) {
      console.error(`Lazy load error for ${entityType}:${id}:`, error);
      return null;
    }
  }

  /**
   * STREAMING LOADER: Load large datasets in batches
   * Memory-efficient for 50M+ records
   */
  async* streamingLoad(entityType, queryFn, batchSize = 1000) {
    let offset = 0;
    let hasMore = true;
    
    while (hasMore) {
      try {
        const batch = await queryFn(offset, batchSize);
        
        if (!batch || batch.length === 0) {
          hasMore = false;
          break;
        }
        
        // Yield batch for processing
        yield batch;
        
        // Cache individual items in batch
        await this.cacheBatch(entityType, batch);
        
        offset += batch.length;
        hasMore = batch.length === batchSize;
        
        // Give event loop a chance to breathe
        await this.sleep(10);
      } catch (error) {
        console.error(`Streaming load error at offset ${offset}:`, error);
        hasMore = false;
      }
    }
  }

  /**
   * SMART PRELOAD: Load frequently accessed data in background
   */
  async smartPreload() {
    // TEMPORARILY DISABLE SMART PRELOAD SYSTEM
    console.log('🚫 Smart preload system is temporarily disabled');
    return { success: false, message: 'Smart preload system is temporarily disabled', disabled: true };

    if (this.isWarming) {
      console.log('⏳ Smart preload already in progress');
      return;
    }
    
    this.isWarming = true;
    const startTime = Date.now();
    
    try {
      console.log('🧠 Starting smart preload based on usage patterns...');
      
      // Get top accessed entities
      const topDivisions = await this.getTopAccessed('division', this.config.preloadTopN);
      const topSections = await this.getTopAccessed('section', this.config.preloadTopN);
      const topEmployees = await this.getTopAccessed('employee', this.config.preloadTopN);
      
      // Preload in parallel (non-blocking)
      await Promise.all([
        this.preloadEntities('division', topDivisions),
        this.preloadEntities('section', topSections),
        this.preloadEntities('employee', topEmployees)
      ]);
      
      this.lastWarmupTime = new Date();
      const duration = Date.now() - startTime;
      this.stats.loadTime = duration;
      
      console.log(`✅ Smart preload completed in ${duration}ms`);
      this.emit('preload:complete', { duration, timestamp: new Date() });
      
    } catch (error) {
      console.error('❌ Smart preload failed:', error);
      this.emit('preload:error', error);
    } finally {
      this.isWarming = false;
    }
  }

  /**
   * BACKGROUND REFRESH: Update cache without blocking
   */
  startBackgroundRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
    
    this.refreshTimer = setInterval(async () => {
      try {
        console.log('🔄 Background cache refresh starting...');
        
        // Refresh in priority order
        for (const entityType of this.config.refreshPriority) {
          await this.refreshEntity(entityType);
          await this.sleep(100); // Small delay between refreshes
        }
        
        this.stats.refreshes++;
        console.log('✅ Background refresh completed');
        
      } catch (error) {
        console.error('Background refresh error:', error);
      }
    }, this.config.refreshInterval);
    
    console.log(`🔄 Background refresh scheduled every ${this.config.refreshInterval / 60000} minutes`);
  }

  /**
   * MEMORY MANAGEMENT: Evict old entries when cache is full
   */
  async evictIfNeeded() {
    try {
      const cacheSize = await this.getCacheSize();
      
      if (cacheSize > this.config.maxCacheSize) {
        console.log(`⚠️ Cache size ${cacheSize} exceeds limit, evicting...`);
        
        // Get all keys with access times
        const keys = await this.cache.keys('lazy:*');
        const keyStats = [];
        
        for (const key of keys) {
          const accessTime = this.usageStats.get(key) || 0;
          keyStats.push({ key, accessTime });
        }
        
        // Sort by LRU
        keyStats.sort((a, b) => a.accessTime - b.accessTime);
        
        // Evict bottom 20%
        const evictCount = Math.floor(keyStats.length * 0.2);
        for (let i = 0; i < evictCount; i++) {
          await this.cache.del(keyStats[i].key);
          this.stats.evictions++;
        }
        
        console.log(`✅ Evicted ${evictCount} entries`);
      }
    } catch (error) {
      console.error('Eviction error:', error);
    }
  }

  /**
   * Get division with lazy loading
   */
  async getDivision(code) {
    return await this.lazyLoad('division', code, async () => {
      const [results] = await sequelize.query(
        'SELECT * FROM divisions_sync WHERE division_code = ?',
        { replacements: [code] }
      );
      return results[0] || null;
    });
  }

  /**
   * Get section with lazy loading
   */
  async getSection(code) {
    return await this.lazyLoad('section', code, async () => {
      const [results] = await sequelize.query(
        'SELECT * FROM sections_sync WHERE section_code = ?',
        { replacements: [code] }
      );
      return results[0] || null;
    });
  }

  /**
   * Get employee with lazy loading
   */
  async getEmployee(id) {
    return await this.lazyLoad('employee', id, async () => {
      const [results] = await sequelize.query(
        'SELECT * FROM employees_sync WHERE id = ?',
        { replacements: [id] }
      );
      return results[0] || null;
    });
  }

  /**
   * Search with smart caching and pagination
   */
  async search(entityType, filters, page = 1, limit = 50) {
    const cacheKey = `search:${entityType}:${JSON.stringify(filters)}:${page}:${limit}`;
    
    try {
      // Check cache
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        this.stats.hits++;
        return JSON.parse(cached);
      }
      
      // Build query based on entity type
      let query, countQuery, replacements = [];
      
      if (entityType === 'division') {
        query = 'SELECT * FROM divisions_sync WHERE 1=1';
        countQuery = 'SELECT COUNT(*) as total FROM divisions_sync WHERE 1=1';
        
        if (filters.search) {
          query += ' AND (division_code LIKE ? OR division_name LIKE ?)';
          countQuery += ' AND (division_code LIKE ? OR division_name LIKE ?)';
          replacements.push(`%${filters.search}%`, `%${filters.search}%`);
        }
      } else if (entityType === 'section') {
        query = 'SELECT * FROM sections_sync WHERE 1=1';
        countQuery = 'SELECT COUNT(*) as total FROM sections_sync WHERE 1=1';
        
        if (filters.division) {
          query += ' AND division_code = ?';
          countQuery += ' AND division_code = ?';
          replacements.push(filters.division);
        }
        if (filters.search) {
          query += ' AND (section_code LIKE ? OR section_name LIKE ?)';
          countQuery += ' AND (section_code LIKE ? OR section_name LIKE ?)';
          replacements.push(`%${filters.search}%`, `%${filters.search}%`);
        }
      } else if (entityType === 'employee') {
        query = 'SELECT * FROM employees_sync WHERE 1=1';
        countQuery = 'SELECT COUNT(*) as total FROM employees_sync WHERE 1=1';
        
        if (filters.division) {
          query += ' AND division = ?';
          countQuery += ' AND division = ?';
          replacements.push(filters.division);
        }
        if (filters.section) {
          query += ' AND section = ?';
          countQuery += ' AND section = ?';
          replacements.push(filters.section);
        }
        if (filters.search) {
          query += ' AND (emp_no LIKE ? OR name LIKE ?)';
          countQuery += ' AND (emp_no LIKE ? OR name LIKE ?)';
          replacements.push(`%${filters.search}%`, `%${filters.search}%`);
        }
      }
      
      // Add pagination
      const offset = (page - 1) * limit;
      query += ` LIMIT ${limit} OFFSET ${offset}`;
      
      // Execute queries
      const [[countResult], [results]] = await Promise.all([
        sequelize.query(countQuery, { replacements }),
        sequelize.query(query, { replacements })
      ]);
      
      const data = {
        results,
        pagination: {
          page,
          limit,
          total: countResult[0].total,
          pages: Math.ceil(countResult[0].total / limit)
        }
      };
      
      // Cache results (5 minute TTL for searches)
      await this.cache.set(cacheKey, JSON.stringify(data), 300);
      this.stats.misses++;
      
      return data;
      
    } catch (error) {
      console.error(`Search error for ${entityType}:`, error);
      throw error;
    }
  }

  /**
   * Helper methods
   */
  
  trackUsage(entityType, id) {
    const key = `${entityType}:${id}`;
    const count = this.usageStats.get(key) || 0;
    this.usageStats.set(key, count + 1);
  }

  async getTopAccessed(entityType, limit) {
    const pattern = `${entityType}:`;
    const entries = Array.from(this.usageStats.entries())
      .filter(([key]) => key.startsWith(pattern))
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([key]) => key.replace(pattern, ''));
    
    return entries;
  }

  calculateDynamicTTL(entityType, id) {
    if (!this.config.ttlDynamic) {
      return 3600; // Default 1 hour
    }
    
    const usage = this.usageStats.get(`${entityType}:${id}`) || 0;
    
    // More frequently accessed = longer TTL
    if (usage > 100) return 7200;  // 2 hours
    if (usage > 50) return 3600;   // 1 hour
    if (usage > 10) return 1800;   // 30 minutes
    return 900;                     // 15 minutes
  }

  async cacheBatch(entityType, batch) {
    const promises = batch.map(async (item) => {
      const id = item.id || item.code || item.division_code || item.section_code;
      if (id) {
        const cacheKey = `lazy:${entityType}:${id}`;
        const ttl = this.calculateDynamicTTL(entityType, id);
        await this.cache.set(cacheKey, JSON.stringify(item), ttl);
      }
    });
    
    await Promise.all(promises);
  }

  async preloadEntities(entityType, ids) {
    for (const id of ids) {
      try {
        if (entityType === 'division') {
          await this.getDivision(id);
        } else if (entityType === 'section') {
          await this.getSection(id);
        } else if (entityType === 'employee') {
          await this.getEmployee(id);
        }
        await this.sleep(5); // Small delay
      } catch (error) {
        console.error(`Preload error for ${entityType}:${id}:`, error);
      }
    }
  }

  async refreshEntity(entityType) {
    // Refresh top accessed entities
    const topIds = await this.getTopAccessed(entityType, 50);
    await this.preloadEntities(entityType, topIds);
  }

  async getCacheSize() {
    try {
      const client = await this.cache.getClient();
      if (!client) return 0;
      
      const info = await client.info('memory');
      const match = info.match(/used_memory:(\d+)/);
      return match ? parseInt(match[1]) : 0;
    } catch (error) {
      return 0;
    }
  }

  async loadUsageStats() {
    try {
      const cached = await this.cache.get('system:usage_stats');
      if (cached) {
        this.usageStats = new Map(JSON.parse(cached));
        console.log(`📊 Loaded ${this.usageStats.size} usage statistics`);
      }
    } catch (error) {
      console.error('Failed to load usage stats:', error);
    }
  }

  async saveUsageStats() {
    try {
      const data = JSON.stringify(Array.from(this.usageStats.entries()));
      await this.cache.set('system:usage_stats', data, 86400); // 24 hours
    } catch (error) {
      console.error('Failed to save usage stats:', error);
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getStats() {
    return {
      ...this.stats,
      isWarming: this.isWarming,
      lastWarmupTime: this.lastWarmupTime,
      usageTracked: this.usageStats.size,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) * 100 || 0
    };
  }

  async shutdown() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
    await this.saveUsageStats();
    console.log('✅ Smart cache service shutdown complete');
  }
}

module.exports = new SmartCacheService();
