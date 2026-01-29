/**
 * Redis Cache Middleware for Management Pages
 * Divisions, Sections, Sub-Sections
 * 
 * Implements intelligent caching with hierarchy awareness
 */

const redisCacheService = require('../services/redisCacheService');

// Cache TTLs (in seconds)
const CACHE_TTL = {
  DIVISIONS: 600,      // 10 minutes (divisions change rarely)
  SECTIONS: 600,       // 10 minutes (sections change rarely)
  SUBSECTIONS: 600,    // 10 minutes (subsections change rarely)
  HIERARCHY: 900       // 15 minutes (full hierarchy cache)
};

/**
 * Generate cache key for management data
 */
function generateManagementCacheKey(type, filters = {}) {
  const baseKey = `management:${type}`;
  
  // Add filters to key
  const filterParts = [];
  if (filters.search) filterParts.push(`search:${filters.search}`);
  if (filters.divisionCode) filterParts.push(`div:${filters.divisionCode}`);
  if (filters.sectionCode) filterParts.push(`sec:${filters.sectionCode}`);
  if (filters.status) filterParts.push(`status:${filters.status}`);
  if (filters.page) filterParts.push(`page:${filters.page}`);
  if (filters.limit) filterParts.push(`limit:${filters.limit}`);
  
  return filterParts.length > 0 
    ? `${baseKey}:${filterParts.join(':')}`
    : baseKey;
}

/**
 * Cache middleware for divisions
 */
const cacheDivisions = () => {
  return async (req, res, next) => {
    try {
      // Generate cache key from query params
      const cacheKey = generateManagementCacheKey('divisions', {
        search: req.query.search,
        status: req.query.status,
        page: req.query.page,
        limit: req.query.limit
      });

      // Try to get from cache
      const cachedData = await redisCacheService.getCache(cacheKey);
      
      if (cachedData) {
        return res.status(200).json({
          ...cachedData,
          source: 'Redis Cache',
          cached: true
        });
      }

      // Store original res.json
      const originalJson = res.json.bind(res);
      
      // Override res.json to cache the response
      res.json = function(data) {
        if (res.statusCode === 200 && data.success) {
          // Cache in background (non-blocking)
          redisCacheService.setCache(cacheKey, data, CACHE_TTL.DIVISIONS)
            .catch(err => console.error('Cache save error:', err.message));
        }
        return originalJson(data);
      };

      next();
    } catch (error) {
      console.error('⚠️  Cache middleware error:', error.message);
      next(); // Continue without cache on error
    }
  };
};

/**
 * Cache middleware for sections
 */
const cacheSections = () => {
  return async (req, res, next) => {
    try {
      const cacheKey = generateManagementCacheKey('sections', {
        search: req.query.search,
        divisionCode: req.query.divisionCode,
        status: req.query.status,
        page: req.query.page,
        limit: req.query.limit
      });

      const cachedData = await redisCacheService.getCache(cacheKey);
      
      if (cachedData) {
        return res.status(200).json({
          ...cachedData,
          source: 'Redis Cache',
          cached: true
        });
      }

      const originalJson = res.json.bind(res);
      
      res.json = function(data) {
        if (res.statusCode === 200 && data.success) {
          redisCacheService.setCache(cacheKey, data, CACHE_TTL.SECTIONS)
            .catch(err => console.error('Cache save error:', err.message));
        }
        return originalJson(data);
      };

      next();
    } catch (error) {
      console.error('⚠️  Cache middleware error:', error.message);
      next();
    }
  };
};

/**
 * Cache middleware for subsections
 */
const cacheSubSections = () => {
  return async (req, res, next) => {
    try {
      const cacheKey = generateManagementCacheKey('subsections', {
        search: req.query.search,
        divisionCode: req.query.divisionCode,
        sectionCode: req.query.sectionCode,
        page: req.query.page,
        limit: req.query.limit
      });

      const cachedData = await redisCacheService.getCache(cacheKey);
      
      if (cachedData) {
        return res.status(200).json({
          ...cachedData,
          source: 'Redis Cache',
          cached: true
        });
      }

      const originalJson = res.json.bind(res);
      
      res.json = function(data) {
        if (res.statusCode === 200 && data.success) {
          redisCacheService.setCache(cacheKey, data, CACHE_TTL.SUBSECTIONS)
            .catch(err => console.error('Cache save error:', err.message));
        }
        return originalJson(data);
      };

      next();
    } catch (error) {
      console.error('⚠️  Cache middleware error:', error.message);
      next();
    }
  };
};

/**
 * Invalidate all management caches
 */
async function invalidateManagementCaches() {
  try {
    const patterns = [
      'management:divisions*',
      'management:sections*',
      'management:subsections*'
    ];

    for (const pattern of patterns) {
      await redisCacheService.deleteCachePattern(pattern);
    }

    console.log('✅ Management caches invalidated');
  } catch (error) {
    console.error('❌ Cache invalidation error:', error.message);
  }
}

/**
 * Invalidate specific hierarchy cache
 */
async function invalidateHierarchyCache(type) {
  try {
    await redisCacheService.deleteCachePattern(`management:${type}*`);
    console.log(`✅ ${type} caches invalidated`);
  } catch (error) {
    console.error(`❌ ${type} cache invalidation error:`, error.message);
  }
}

module.exports = {
  cacheDivisions,
  cacheSections,
  cacheSubSections,
  invalidateManagementCaches,
  invalidateHierarchyCache
};
