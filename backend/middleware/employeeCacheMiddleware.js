/**
 * Employee Cache Middleware
 * 
 * Provides intelligent Redis caching for Employee Management page
 * - Caches employee data with different filters
 * - Fast lookups based on division, section, search terms
 * - Automatic cache invalidation on data updates
 */

const redisCacheService = require('../services/redisCacheService');

/**
 * Generate cache key based on query parameters
 */
const generateEmployeeCacheKey = (query) => {
  const {
    divisionCode,
    sectionCode,
    search,
    designation,
    page = 1,
    limit = 1000
  } = query;

  // Build cache key components
  const parts = ['employees'];
  
  if (divisionCode) parts.push(`div:${divisionCode}`);
  if (sectionCode) parts.push(`sec:${sectionCode}`);
  if (search) parts.push(`search:${search.toLowerCase()}`);
  if (designation) parts.push(`desig:${designation}`);
  if (page > 1 || limit !== 1000) parts.push(`page:${page}:limit:${limit}`);
  
  return parts.join(':');
};

/**
 * Generate cache key for divisions with employee counts
 */
const generateDivisionsCacheKey = (query) => {
  const { includeEmployeeCount } = query;
  return includeEmployeeCount === 'true' 
    ? 'divisions:with-counts' 
    : 'divisions:all';
};

/**
 * Generate cache key for sections
 */
const generateSectionsCacheKey = (query) => {
  const { divisionCode } = query;
  return divisionCode 
    ? `sections:div:${divisionCode}` 
    : 'sections:all';
};

/**
 * Middleware: Cache employee data
 * Use this BEFORE the controller to check cache
 */
const cacheEmployeeData = (type = 'employees') => {
  return async (req, res, next) => {
    try {
      // Check if Redis is connected
      if (!redisCacheService.isConnected) {
        console.log('⚠️  Redis not connected, skipping cache');
        return next();
      }

      // Generate appropriate cache key based on type
      let cacheKey;
      switch (type) {
        case 'employees':
          cacheKey = generateEmployeeCacheKey(req.query);
          break;
        case 'divisions':
          cacheKey = generateDivisionsCacheKey(req.query);
          break;
        case 'sections':
          cacheKey = generateSectionsCacheKey(req.query);
          break;
        case 'subsections':
          cacheKey = 'subsections:all';
          break;
        default:
          return next();
      }

      // Try to get from cache
      const cachedData = await redisCacheService.getCache(cacheKey);

      if (cachedData) {
        // Cache hit - return cached data immediately
        console.log(`🚀 Cache HIT: Serving ${type} from Redis`);
        
        return res.status(200).json({
          success: true,
          data: cachedData.data || cachedData,
          count: cachedData.count || cachedData.data?.length || cachedData.length,
          source: 'Redis Cache',
          cached: true,
          timestamp: new Date().toISOString(),
          ...cachedData.metadata
        });
      }

      // Cache miss - continue to controller
      console.log(`⚠️  Cache MISS: ${cacheKey} - Fetching from database`);
      
      // Store cache key in request for later use
      req.cacheKey = cacheKey;
      req.cacheType = type;
      
      next();

    } catch (error) {
      console.error('❌ Cache middleware error:', error);
      // On error, bypass cache and continue
      next();
    }
  };
};

/**
 * Middleware: Save response to cache
 * Use this AFTER sending response to store data
 */
const saveToCache = (ttl = 300) => {
  return (req, res, next) => {
    // Capture the original json method
    const originalJson = res.json.bind(res);

    // Override res.json to intercept response
    res.json = async function(data) {
      // Call original json method first
      originalJson(data);

      // Then try to cache the data
      try {
        if (
          redisCacheService.isConnected && 
          req.cacheKey && 
          data.success && 
          data.data
        ) {
          // Prepare cache data
          const cacheData = {
            data: data.data,
            count: data.count || data.data.length,
            metadata: {
              source: data.source,
              message: data.message,
              cachedAt: new Date().toISOString()
            }
          };

          // Save to cache with TTL
          await redisCacheService.setCache(req.cacheKey, cacheData, ttl);
          console.log(`💾 Cached ${req.cacheType} data: ${req.cacheKey}`);
        }
      } catch (error) {
        console.error('❌ Error saving to cache:', error);
      }
    };

    next();
  };
};

/**
 * Invalidate employee-related caches
 * Call this after any employee data modification
 */
const invalidateEmployeeCaches = async () => {
  try {
    if (!redisCacheService.isConnected) {
      return false;
    }

    // Clear all employee-related caches
    await redisCacheService.deleteCachePattern('employees:*');
    await redisCacheService.deleteCachePattern('divisions:*');
    await redisCacheService.deleteCachePattern('sections:*');
    await redisCacheService.deleteCachePattern('subsections:*');
    
    console.log('🔄 Employee caches invalidated successfully');
    return true;

  } catch (error) {
    console.error('❌ Error invalidating employee caches:', error);
    return false;
  }
};

/**
 * Invalidate specific employee cache
 */
const invalidateEmployeeCache = async (empId) => {
  try {
    if (!redisCacheService.isConnected) {
      return false;
    }

    await redisCacheService.deleteCache(`employee:${empId}`);
    // Also invalidate list caches as they may include this employee
    await redisCacheService.deleteCachePattern('employees:*');
    
    console.log(`🔄 Cache invalidated for employee: ${empId}`);
    return true;

  } catch (error) {
    console.error('❌ Error invalidating employee cache:', error);
    return false;
  }
};

/**
 * Get cache statistics
 */
const getCacheStats = () => {
  return redisCacheService.getStats();
};

module.exports = {
  cacheEmployeeData,
  saveToCache,
  invalidateEmployeeCaches,
  invalidateEmployeeCache,
  getCacheStats,
  generateEmployeeCacheKey,
  generateDivisionsCacheKey,
  generateSectionsCacheKey
};
