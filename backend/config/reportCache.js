/**
 * Redis Cache Module for Attendance Reports
 * Provides instant responses for repeated queries
 * Falls back gracefully if Redis is unavailable
 */

const redis = require('redis');

class ReportCache {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.isEnabled = process.env.REDIS_ENABLED !== 'false'; // Enabled by default
    this.config = {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB || '0'),
      // Default TTL: 5 minutes (adjustable)
      defaultTTL: parseInt(process.env.CACHE_TTL || '300'),
      connectTimeout: 5000,
      retryStrategy: (times) => {
        if (times > 3) return null; // Stop retrying after 3 attempts
        return Math.min(times * 100, 2000); // Exponential backoff
      }
    };
    
    // Statistics
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0
    };
  }

  /**
   * Initialize Redis connection
   */
  async connect() {
    if (!this.isEnabled) {
      console.log('⚠️  Redis cache is disabled (set REDIS_ENABLED=true to enable)');
      return false;
    }

    if (this.isConnected) return true;

    try {
      console.log('🔌 Connecting to Redis cache...');
      
      this.client = redis.createClient({
        socket: {
          host: this.config.host,
          port: this.config.port,
          connectTimeout: this.config.connectTimeout
        },
        password: this.config.password,
        database: this.config.db
      });

      // Error handler
      this.client.on('error', (err) => {
        console.error('❌ Redis error:', err.message);
        this.stats.errors++;
        this.isConnected = false;
      });

      // Connection handler
      this.client.on('connect', () => {
        console.log('✅ Redis cache connected');
        this.isConnected = true;
      });

      // Reconnect handler
      this.client.on('reconnecting', () => {
        console.log('🔄 Redis cache reconnecting...');
      });

      await this.client.connect();
      return true;

    } catch (error) {
      console.error('❌ Failed to connect to Redis:', error.message);
      console.log('⚠️  Cache disabled - reports will run without caching');
      this.isEnabled = false;
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Get underlying redis client (ensures connected)
   */
  async getClient() {
    if (!this.isEnabled) return null;
    if (!this.isConnected) {
      await this.connect();
    }
    return this.client;
  }

  /**
   * Generate cache key from report parameters
   */
  generateKey(type, params = {}) {
    const { from_date = '', to_date = '', division_id = '', section_id = '', sub_section_id = '', employee_id = '', grouping = '' } = params;
    
    if (type === 'individual') {
      return `report:individual:${employee_id}:${from_date}:${to_date}`;
    }
    
    if (type === 'audit') {
      return `report:audit:${from_date}:${to_date}:${grouping}:${division_id}:${section_id}:${sub_section_id}`;
    }
    
    // Group report key
    return `report:group:${from_date}:${to_date}:${division_id}:${section_id}:${sub_section_id}`;
  }

  /**
   * Get cached report
   */
  async get(typeOrKey, params) {
    if (!this.isEnabled || !this.isConnected) return null;

    try {
      // Overload: if called with a full cache key string, use it directly
      let key;
      if (typeof params === 'undefined' && typeof typeOrKey === 'string' && (typeOrKey.includes(':') || typeOrKey.startsWith('cache:') || typeOrKey.startsWith('report:'))) {
        key = typeOrKey;
      } else {
        key = this.generateKey(typeOrKey, params);
      }

      const cached = await this.client.get(key);
      
      if (cached) {
        this.stats.hits++;
        console.log(`✅ Cache HIT: ${key}`);
        // Return raw cached string - callers should JSON.parse as appropriate
        return cached;
      }
      
      this.stats.misses++;
      console.log(`⚠️  Cache MISS: ${key}`);
      return null;

    } catch (error) {
      console.error('❌ Cache get error:', error.message);
      this.stats.errors++;
      return null;
    }
  }

  /**
   * Set cached report
   */
  async set(typeOrKey, paramsOrData, dataOrTtl, ttl = null) {
    if (!this.isEnabled || !this.isConnected) return false;

    try {
      let key;
      let value;
      let ttlSeconds;

      // Overload: set(cacheKey, data, ttl)
      if (typeof typeOrKey === 'string' && (typeOrKey.includes(':') || typeOrKey.startsWith('cache:') || typeOrKey.startsWith('report:'))) {
        key = typeOrKey;
        value = paramsOrData;
        ttlSeconds = (typeof dataOrTtl === 'number') ? dataOrTtl : ttl || this.config.defaultTTL;
      } else {
        // set(type, params, data, ttl)
        key = this.generateKey(typeOrKey, paramsOrData);
        value = dataOrTtl;
        ttlSeconds = ttl || this.config.defaultTTL;
      }

      const payload = (typeof value === 'string') ? value : JSON.stringify(value);
      await this.client.setEx(key, ttlSeconds, payload);
      
      this.stats.sets++;
      console.log(`💾 Cache SET: ${key} (TTL: ${ttlSeconds}s)`);
      return true;

    } catch (error) {
      console.error('❌ Cache set error:', error.message);
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Clear specific report cache
   */
  async clear(typeOrKey, params) {
    if (!this.isEnabled || !this.isConnected) return false;

    try {
      let key;
      if (typeof params === 'undefined' && typeof typeOrKey === 'string' && (typeOrKey.includes(':') || typeOrKey.startsWith('cache:') || typeOrKey.startsWith('report:'))) {
        key = typeOrKey;
      } else {
        key = this.generateKey(typeOrKey, params);
      }

      await this.client.del(key);
      
      this.stats.deletes++;
      console.log(`🗑️  Cache CLEAR: ${key}`);
      return true;

    } catch (error) {
      console.error('❌ Cache clear error:', error.message);
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Clear all report caches
   */
  async clearAll(pattern = 'report:*') {
    if (!this.isEnabled || !this.isConnected) return 0;

    try {
      const keys = await this.client.keys(pattern);
      
      if (keys.length === 0) {
        console.log('ℹ️  No cache keys to clear');
        return 0;
      }

      const deleted = await this.client.del(keys);
      this.stats.deletes += deleted;
      
      console.log(`🗑️  Cache CLEARED: ${deleted} keys deleted`);
      return deleted;

    } catch (error) {
      console.error('❌ Cache clearAll error:', error.message);
      this.stats.errors++;
      return 0;
    }
  }

  /**
   * Clear all caches for a specific date range
   * (e.g., when new attendance data is added)
   */
  async clearDateRange(from_date, to_date) {
    if (!this.isEnabled || !this.isConnected) return 0;

    try {
      // Pattern to match any report containing these dates
      const pattern = `report:*:${from_date}:${to_date}:*`;
      const keys = await this.client.keys(pattern);
      
      if (keys.length === 0) {
        console.log(`ℹ️  No cache keys for date range ${from_date} to ${to_date}`);
        return 0;
      }

      const deleted = await this.client.del(keys);
      this.stats.deletes += deleted;
      
      console.log(`🗑️  Cache CLEARED for dates ${from_date}-${to_date}: ${deleted} keys`);
      return deleted;

    } catch (error) {
      console.error('❌ Cache clearDateRange error:', error.message);
      this.stats.errors++;
      return 0;
    }
  }

  /**
   * Clear all caches for a specific division/section/subsection
   * (e.g., when org structure changes)
   */
  async clearOrganization(division_id = '', section_id = '', sub_section_id = '') {
    if (!this.isEnabled || !this.isConnected) return 0;

    try {
      const pattern = `report:group:*:${division_id}:${section_id}:${sub_section_id}`;
      const keys = await this.client.keys(pattern);
      
      if (keys.length === 0) {
        console.log(`ℹ️  No cache keys for org: div=${division_id}, sec=${section_id}, sub=${sub_section_id}`);
        return 0;
      }

      const deleted = await this.client.del(keys);
      this.stats.deletes += deleted;
      
      console.log(`🗑️  Cache CLEARED for organization: ${deleted} keys`);
      return deleted;

    } catch (error) {
      console.error('❌ Cache clearOrganization error:', error.message);
      this.stats.errors++;
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
      : 0;

    return {
      enabled: this.isEnabled,
      connected: this.isConnected,
      hits: this.stats.hits,
      misses: this.stats.misses,
      sets: this.stats.sets,
      deletes: this.stats.deletes,
      errors: this.stats.errors,
      hitRate: `${hitRate}%`,
      totalRequests: this.stats.hits + this.stats.misses
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0
    };
    console.log('📊 Cache statistics reset');
  }

  /**
   * Get cached keys count
   */
  async getKeysCount(pattern = 'report:*') {
    if (!this.isEnabled || !this.isConnected) return 0;

    try {
      const keys = await this.client.keys(pattern);
      return keys.length;
    } catch (error) {
      console.error('❌ Cache getKeysCount error:', error.message);
      return 0;
    }
  }

  /**
   * Get cache info
   */
  async getInfo() {
    if (!this.isEnabled || !this.isConnected) {
      return {
        enabled: this.isEnabled,
        connected: false,
        message: 'Cache is disabled or not connected'
      };
    }

    try {
      const info = await this.client.info('stats');
      const keysCount = await this.getKeysCount();
      
      return {
        enabled: true,
        connected: true,
        host: this.config.host,
        port: this.config.port,
        db: this.config.db,
        defaultTTL: this.config.defaultTTL,
        cachedReports: keysCount,
        stats: this.getStats(),
        redisInfo: info
      };
    } catch (error) {
      console.error('❌ Cache getInfo error:', error.message);
      return {
        enabled: true,
        connected: this.isConnected,
        error: error.message
      };
    }
  }

  /**
   * Redis ZADD operation
   */
  async zadd(key, score, member) {
    if (!this.isEnabled || !this.isConnected) return false;

    try {
      await this.client.zAdd(key, { score, value: member });
      return true;
    } catch (error) {
      console.error('❌ Cache zadd error:', error.message);
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Redis SADD operation
   */
  async sadd(key, member) {
    if (!this.isEnabled || !this.isConnected) return false;

    try {
      await this.client.sAdd(key, member);
      return true;
    } catch (error) {
      console.error('❌ Cache sadd error:', error.message);
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Redis DEL operation
   */
  async del(key) {
    if (!this.isEnabled || !this.isConnected) return false;

    try {
      await this.client.del(key);
      this.stats.deletes++;
      return true;
    } catch (error) {
      console.error('❌ Cache del error:', error.message);
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Redis KEYS operation
   */
  async keys(pattern) {
    if (!this.isEnabled || !this.isConnected) return [];

    try {
      const keys = await this.client.keys(pattern);
      return keys;
    } catch (error) {
      console.error('❌ Cache keys error:', error.message);
      this.stats.errors++;
      return [];
    }
  }

  /**
   * Get keys count
   */
  async getKeysCount() {
    if (!this.isEnabled || !this.isConnected) return 0;

    try {
      const keys = await this.client.keys('cache:*');
      return keys.length;
    } catch (error) {
      console.error('❌ Cache keys count error:', error.message);
      this.stats.errors++;
      return 0;
    }
  }

  /**
   * Get Redis info
   */
  async getInfo() {
    if (!this.isEnabled || !this.isConnected) return null;

    try {
      const info = await this.client.info();
      return info;
    } catch (error) {
      console.error('❌ Cache info error:', error.message);
      this.stats.errors++;
      return null;
    }
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0
    };
  }

  /**
   * Close Redis connection
   */
  async disconnect() {
    if (this.client && this.isConnected) {
      await this.client.quit();
      console.log('🔒 Redis cache disconnected');
      this.isConnected = false;
    }
  }
}

// Singleton instance
let cacheInstance = null;

/**
 * Get or create cache instance
 */
const getCache = () => {
  if (!cacheInstance) {
    cacheInstance = new ReportCache();
  }
  return cacheInstance;
};

module.exports = {
  ReportCache,
  getCache
};
