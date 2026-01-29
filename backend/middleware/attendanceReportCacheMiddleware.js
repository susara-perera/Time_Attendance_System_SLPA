/**
 * Redis Cache Middleware for Attendance Reports
 * Individual & Group Attendance Reports
 * 
 * Caching strategy:
 * - Individual reports: 5 min TTL (frequently accessed)
 * - Group reports: 10 min TTL (larger data)
 * - Cache key includes all filter params for precision
 */

const redisCacheService = require('../services/redisCacheService');
const crypto = require('crypto');

// Cache TTLs (in seconds)
const CACHE_TTL = {
  INDIVIDUAL: 300,     // 5 minutes (individual employee reports)
  GROUP_SMALL: 600,    // 10 minutes (< 100 employees)
  GROUP_MEDIUM: 900,   // 15 minutes (100-500 employees)
  GROUP_LARGE: 1200    // 20 minutes (> 500 employees)
};

/**
 * Generate cache key for attendance reports
 */
function generateAttendanceReportCacheKey(params) {
  const {
    startDate,
    endDate,
    from_date,
    to_date,
    employee_id,
    division_id,
    section_id,
    subsection_id,
    report_type,
    format
  } = params;

  // Normalize dates
  const start = startDate || from_date;
  const end = endDate || to_date;

  // Build key parts
  const keyParts = ['attendance-report'];
  
  // Report type
  if (employee_id) {
    keyParts.push('individual');
    keyParts.push(`emp:${employee_id}`);
  } else {
    keyParts.push('group');
    if (division_id && division_id !== 'all') keyParts.push(`div:${division_id}`);
    if (section_id && section_id !== 'all') keyParts.push(`sec:${section_id}`);
    if (subsection_id && subsection_id !== 'all') keyParts.push(`subsec:${subsection_id}`);
  }
  
  // Date range (always included)
  keyParts.push(`${start}:${end}`);
  
  // Report format
  if (format && format !== 'json') keyParts.push(`fmt:${format}`);
  
  return keyParts.join(':');
}

/**
 * Determine TTL based on report size
 */
function determineTTL(params, dataSize = 0) {
  // Individual reports get shorter TTL (more specific, change often)
  if (params.employee_id) {
    return CACHE_TTL.INDIVIDUAL;
  }
  
  // Group reports - longer TTL for larger datasets
  if (dataSize > 500) {
    return CACHE_TTL.GROUP_LARGE;
  } else if (dataSize > 100) {
    return CACHE_TTL.GROUP_MEDIUM;
  } else {
    return CACHE_TTL.GROUP_SMALL;
  }
}

/**
 * Cache middleware for attendance reports
 */
const cacheAttendanceReport = () => {
  return async (req, res, next) => {
    try {
      // Get params from either query or body
      const params = req.method === 'GET' ? req.query : req.body;
      
      // Generate cache key
      const cacheKey = generateAttendanceReportCacheKey(params);
      
      // Try to get from cache
      const cachedData = await redisCacheService.getCache(cacheKey);
      
      if (cachedData) {
        // Return cached response
        return res.status(200).json({
          ...cachedData,
          source: 'Redis Cache',
          cached: true,
          cacheKey: cacheKey
        });
      }

      // Store original res.json
      const originalJson = res.json.bind(res);
      
      // Override res.json to cache the response
      res.json = function(data) {
        if (res.statusCode === 200 && data.success) {
          // Determine appropriate TTL
          const dataSize = data.data?.length || data.reportData?.length || 0;
          const ttl = determineTTL(params, dataSize);
          
          // Cache in background (non-blocking)
          redisCacheService.setCache(cacheKey, data, ttl)
            .then(() => {
              console.log(`✅ Cached attendance report: ${cacheKey} (${dataSize} records, TTL: ${ttl}s)`);
            })
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
 * Invalidate attendance report caches
 */
async function invalidateAttendanceReportCaches(type = 'all') {
  try {
    const patterns = [];
    
    if (type === 'all' || type === 'individual') {
      patterns.push('attendance-report:individual*');
    }
    
    if (type === 'all' || type === 'group') {
      patterns.push('attendance-report:group*');
    }
    
    for (const pattern of patterns) {
      await redisCacheService.deleteCachePattern(pattern);
    }
    
    console.log(`✅ Attendance report caches invalidated (${type})`);
  } catch (error) {
    console.error('❌ Cache invalidation error:', error.message);
  }
}

/**
 * Invalidate specific employee's attendance cache
 */
async function invalidateEmployeeAttendanceCache(employeeId) {
  try {
    await redisCacheService.deleteCachePattern(`attendance-report:individual:emp:${employeeId}*`);
    console.log(`✅ Employee ${employeeId} attendance cache invalidated`);
  } catch (error) {
    console.error(`❌ Employee cache invalidation error:`, error.message);
  }
}

/**
 * Invalidate organization hierarchy caches (division/section/subsection)
 */
async function invalidateOrganizationAttendanceCache(divisionId, sectionId = null, subsectionId = null) {
  try {
    let pattern = 'attendance-report:group';
    
    if (divisionId) pattern += `:div:${divisionId}`;
    if (sectionId) pattern += `:sec:${sectionId}`;
    if (subsectionId) pattern += `:subsec:${subsectionId}`;
    
    pattern += '*';
    
    await redisCacheService.deleteCachePattern(pattern);
    console.log(`✅ Organization attendance cache invalidated: ${pattern}`);
  } catch (error) {
    console.error('❌ Organization cache invalidation error:', error.message);
  }
}

module.exports = {
  cacheAttendanceReport,
  invalidateAttendanceReportCaches,
  invalidateEmployeeAttendanceCache,
  invalidateOrganizationAttendanceCache,
  generateAttendanceReportCacheKey
};
