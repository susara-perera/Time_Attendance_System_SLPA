/**
 * Comprehensive Redis Cache Service
 * 
 * Provides high-performance caching for all system data
 * with automatic invalidation and performance monitoring
 */

const redis = require('redis');
const { promisify } = require('util');

class RedisCacheService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      totalSaveTime: 0,
      totalRetrieveTime: 0
    };
  }

  /**
   * Initialize Redis connection
   */
  async connect() {
    try {
      if (this.isConnected) {
        return true;
      }

      const redisHost = process.env.REDIS_HOST || 'localhost';
      const redisPort = process.env.REDIS_PORT || 6379;
      const redisPassword = process.env.REDIS_PASSWORD || '';

      this.client = redis.createClient({
        host: redisHost,
        port: redisPort,
        password: redisPassword || undefined,
        retry_strategy: (options) => {
          if (options.error && options.error.code === 'ECONNREFUSED') {
            console.warn('⚠️  Redis connection refused');
            return new Error('Redis connection refused');
          }
          if (options.total_retry_time > 1000 * 60 * 60) {
            return new Error('Redis retry time exhausted');
          }
          if (options.attempt > 10) {
            return undefined;
          }
          return Math.min(options.attempt * 100, 3000);
        }
      });

      // Promisify Redis commands (check if methods exist first)
      if (this.client.get) this.get = promisify(this.client.get).bind(this.client);
      if (this.client.set) this.set = promisify(this.client.set).bind(this.client);
      if (this.client.del) this.del = promisify(this.client.del).bind(this.client);
      if (this.client.exists) this.exists = promisify(this.client.exists).bind(this.client);
      if (this.client.expire) this.expire = promisify(this.client.expire).bind(this.client);
      if (this.client.keys) this.keys = promisify(this.client.keys).bind(this.client);
      if (this.client.flushall) this.flushall = promisify(this.client.flushall).bind(this.client);
      if (this.client.ttl) this.ttl = promisify(this.client.ttl).bind(this.client);

      return new Promise((resolve, reject) => {
        this.client.on('connect', () => {
          console.log('✅ Redis cache connected successfully');
          this.isConnected = true;
          resolve(true);
        });

        this.client.on('error', (err) => {
          console.warn('⚠️  Redis cache error:', err.message);
          this.isConnected = false;
          resolve(false);
        });

        this.client.on('end', () => {
          console.log('🔌 Redis connection closed');
          this.isConnected = false;
        });
      });
    } catch (error) {
      console.error('❌ Redis connection failed:', error);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Get cached data with performance tracking
   */
  async getCache(key) {
    const startTime = Date.now();
    
    try {
      if (!this.isConnected) {
        return null;
      }

      const data = await this.get(key);
      const retrieveTime = Date.now() - startTime;
      
      this.stats.totalRetrieveTime += retrieveTime;

      if (data) {
        this.stats.hits++;
        console.log(`✅ Cache HIT: ${key} (${retrieveTime}ms)`);
        return JSON.parse(data);
      } else {
        this.stats.misses++;
        console.log(`❌ Cache MISS: ${key} (${retrieveTime}ms)`);
        return null;
      }
    } catch (error) {
      console.error(`❌ Cache GET error for ${key}:`, error.message);
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Set cache data with TTL and performance tracking
   */
  async setCache(key, data, ttl = 3600) {
    const startTime = Date.now();
    
    try {
      if (!this.isConnected) {
        return false;
      }

      const serialized = JSON.stringify(data);
      await this.set(key, serialized, 'EX', ttl);
      
      const saveTime = Date.now() - startTime;
      this.stats.sets++;
      this.stats.totalSaveTime += saveTime;

      console.log(`💾 Cache SET: ${key} (TTL: ${ttl}s, ${saveTime}ms, ${(serialized.length / 1024).toFixed(2)}KB)`);
      return true;
    } catch (error) {
      console.error(`❌ Cache SET error for ${key}:`, error.message);
      return false;
    }
  }

  /**
   * Delete cache entry
   */
  async deleteCache(key) {
    try {
      if (!this.isConnected) {
        return false;
      }

      await this.del(key);
      this.stats.deletes++;
      console.log(`🗑️  Cache DELETE: ${key}`);
      return true;
    } catch (error) {
      console.error(`❌ Cache DELETE error for ${key}:`, error.message);
      return false;
    }
  }

  /**
   * Delete multiple cache entries by pattern
   */
  async deleteCachePattern(pattern) {
    try {
      if (!this.isConnected) {
        return 0;
      }

      const keys = await this.keys(pattern);
      if (keys.length === 0) {
        return 0;
      }

      await Promise.all(keys.map(key => this.del(key)));
      this.stats.deletes += keys.length;
      console.log(`🗑️  Cache DELETE PATTERN: ${pattern} (${keys.length} keys)`);
      return keys.length;
    } catch (error) {
      console.error(`❌ Cache DELETE PATTERN error for ${pattern}:`, error.message);
      return 0;
    }
  }

  /**
   * Get or set cache (cache-aside pattern)
   */
  async getOrSet(key, fetchFunction, ttl = 3600) {
    const startTime = Date.now();
    
    // Try to get from cache
    const cached = await this.getCache(key);
    if (cached) {
      const totalTime = Date.now() - startTime;
      console.log(`⚡ Cache HIT total time: ${totalTime}ms`);
      return { data: cached, fromCache: true, timing: totalTime };
    }

    // Fetch from source
    console.log(`📡 Fetching from source: ${key}`);
    const fetchStart = Date.now();
    const data = await fetchFunction();
    const fetchTime = Date.now() - fetchStart;

    // Store in cache
    await this.setCache(key, data, ttl);
    
    const totalTime = Date.now() - startTime;
    console.log(`⚡ Total fetch + cache time: ${totalTime}ms (fetch: ${fetchTime}ms)`);
    
    return { data, fromCache: false, timing: totalTime, fetchTime };
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? ((this.stats.hits / totalRequests) * 100).toFixed(2) : 0;
    const avgRetrieveTime = this.stats.hits > 0 ? (this.stats.totalRetrieveTime / this.stats.hits).toFixed(2) : 0;
    const avgSaveTime = this.stats.sets > 0 ? (this.stats.totalSaveTime / this.stats.sets).toFixed(2) : 0;

    return {
      isConnected: this.isConnected,
      hits: this.stats.hits,
      misses: this.stats.misses,
      sets: this.stats.sets,
      deletes: this.stats.deletes,
      totalRequests,
      hitRate: `${hitRate}%`,
      avgRetrieveTime: `${avgRetrieveTime}ms`,
      avgSaveTime: `${avgSaveTime}ms`,
      totalSaveTime: `${this.stats.totalSaveTime}ms`,
      totalRetrieveTime: `${this.stats.totalRetrieveTime}ms`
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
      totalSaveTime: 0,
      totalRetrieveTime: 0
    };
    console.log('📊 Cache statistics reset');
  }

  /**
   * Clear all cache
   */
  async clearAll() {
    try {
      if (!this.isConnected) {
        return false;
      }

      await this.flushall();
      console.log('🗑️  All cache cleared');
      return true;
    } catch (error) {
      console.error('❌ Cache CLEAR ALL error:', error.message);
      return false;
    }
  }

  /**
   * Generate cache keys
   */
  keys = {
    // Dashboard
    dashboardStats: () => 'dashboard:stats',
    dashboardActivities: (limit = 50) => `dashboard:activities:${limit}`,
    
    // Employees
    employees: () => 'employees:all',
    employeeById: (id) => `employee:${id}`,
    employeesByDivision: (divisionId) => `employees:division:${divisionId}`,
    employeesBySection: (sectionId) => `employees:section:${sectionId}`,
    
    // Divisions
    divisions: () => 'divisions:all',
    divisionById: (id) => `division:${id}`,
    
    // Sections
    sections: () => 'sections:all',
    sectionById: (id) => `section:${id}`,
    sectionsByDivision: (divisionId) => `sections:division:${divisionId}`,
    
    // Sub-sections
    subSections: () => 'subsections:all',
    subSectionById: (id) => `subsection:${id}`,
    subSectionsBySection: (sectionId) => `subsections:section:${sectionId}`,
    
    // Attendance
    attendance: (date) => `attendance:${date}`,
    attendanceByEmployee: (empId, startDate, endDate) => `attendance:emp:${empId}:${startDate}:${endDate}`,
    attendanceByDivision: (divId, date) => `attendance:div:${divId}:${date}`,
    
    // Reports
    individualReport: (empId, startDate, endDate) => `report:individual:${empId}:${startDate}:${endDate}`,
    groupReport: (divId, secId, startDate, endDate) => `report:group:${divId}:${secId}:${startDate}:${endDate}`,
    auditReport: (startDate, endDate, filters) => `report:audit:${startDate}:${endDate}:${JSON.stringify(filters)}`,
    
    // IS Division specific
    isEmployees: () => 'is:employees',
    isAttendance: (date) => `is:attendance:${date}`
  };

  /**
   * Invalidation helpers
   */
  async invalidateEmployees() {
    await this.deleteCachePattern('employees:*');
    await this.deleteCachePattern('employee:*');
    console.log('🔄 Employees cache invalidated');
  }

  async invalidateDivisions() {
    await this.deleteCachePattern('divisions:*');
    await this.deleteCachePattern('division:*');
    console.log('🔄 Divisions cache invalidated');
  }

  async invalidateSections() {
    await this.deleteCachePattern('sections:*');
    await this.deleteCachePattern('section:*');
    console.log('🔄 Sections cache invalidated');
  }

  async invalidateAttendance(date = null) {
    if (date) {
      await this.deleteCachePattern(`attendance:*:${date}`);
    } else {
      await this.deleteCachePattern('attendance:*');
    }
    console.log('🔄 Attendance cache invalidated');
  }

  async invalidateReports() {
    await this.deleteCachePattern('report:*');
    console.log('🔄 Reports cache invalidated');
  }
}

// Export singleton instance
const redisCacheService = new RedisCacheService();

module.exports = redisCacheService;
