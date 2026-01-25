/**
 * Performance Monitoring Middleware
 * 
 * Tracks request timing and cache performance across the system
 */

const performanceMonitor = {
  // Store timing data
  timings: [],
  maxTimings: 1000, // Keep last 1000 requests

  /**
   * Middleware to track request performance
   */
  middleware(req, res, next) {
    const startTime = Date.now();
    const startHrTime = process.hrtime();

    // Store original end function
    const originalEnd = res.end;

    // Override end function to capture timing
    res.end = function(...args) {
      const endTime = Date.now();
      const hrDiff = process.hrtime(startHrTime);
      const responseTime = (hrDiff[0] * 1000 + hrDiff[1] / 1000000).toFixed(2);
      
      // Store timing data
      const timingData = {
        method: req.method,
        path: req.path,
        url: req.originalUrl,
        statusCode: res.statusCode,
        responseTime: parseFloat(responseTime),
        timestamp: new Date().toISOString(),
        fromCache: res.fromCache || false,
        cacheKey: res.cacheKey || null,
        userId: req.user?.id || req.user?._id || 'anonymous'
      };

      performanceMonitor.addTiming(timingData);

      // Log slow requests (> 1000ms)
      if (responseTime > 1000) {
        console.warn(`⚠️  SLOW REQUEST: ${req.method} ${req.originalUrl} - ${responseTime}ms`);
      }

      // Log cache hits in green
      if (res.fromCache) {
        console.log(`⚡ \x1b[32mCACHE HIT\x1b[0m: ${req.method} ${req.originalUrl} - ${responseTime}ms`);
      } else {
        console.log(`📡 ${req.method} ${req.originalUrl} - ${responseTime}ms`);
      }

      // Call original end
      return originalEnd.apply(this, args);
    };

    next();
  },

  /**
   * Add timing data
   */
  addTiming(data) {
    this.timings.push(data);
    
    // Keep only recent timings
    if (this.timings.length > this.maxTimings) {
      this.timings.shift();
    }
  },

  /**
   * Get performance statistics
   */
  getStats() {
    if (this.timings.length === 0) {
      return {
        totalRequests: 0,
        avgResponseTime: 0,
        minResponseTime: 0,
        maxResponseTime: 0,
        cacheHitRate: 0,
        slowRequests: 0
      };
    }

    const responseTimes = this.timings.map(t => t.responseTime);
    const cacheHits = this.timings.filter(t => t.fromCache).length;
    const slowRequests = this.timings.filter(t => t.responseTime > 1000).length;

    return {
      totalRequests: this.timings.length,
      avgResponseTime: (responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length).toFixed(2),
      minResponseTime: Math.min(...responseTimes).toFixed(2),
      maxResponseTime: Math.max(...responseTimes).toFixed(2),
      cacheHitRate: ((cacheHits / this.timings.length) * 100).toFixed(2) + '%',
      cacheHits,
      cacheMisses: this.timings.length - cacheHits,
      slowRequests,
      slowRequestRate: ((slowRequests / this.timings.length) * 100).toFixed(2) + '%'
    };
  },

  /**
   * Get stats by endpoint
   */
  getStatsByEndpoint() {
    const endpointMap = {};

    this.timings.forEach(timing => {
      const key = `${timing.method} ${timing.path}`;
      
      if (!endpointMap[key]) {
        endpointMap[key] = {
          count: 0,
          totalTime: 0,
          minTime: Infinity,
          maxTime: 0,
          cacheHits: 0,
          slowRequests: 0
        };
      }

      const endpoint = endpointMap[key];
      endpoint.count++;
      endpoint.totalTime += timing.responseTime;
      endpoint.minTime = Math.min(endpoint.minTime, timing.responseTime);
      endpoint.maxTime = Math.max(endpoint.maxTime, timing.responseTime);
      
      if (timing.fromCache) endpoint.cacheHits++;
      if (timing.responseTime > 1000) endpoint.slowRequests++;
    });

    // Convert to array and calculate averages
    return Object.entries(endpointMap).map(([endpoint, stats]) => ({
      endpoint,
      requests: stats.count,
      avgTime: (stats.totalTime / stats.count).toFixed(2) + 'ms',
      minTime: stats.minTime.toFixed(2) + 'ms',
      maxTime: stats.maxTime.toFixed(2) + 'ms',
      cacheHitRate: ((stats.cacheHits / stats.count) * 100).toFixed(2) + '%',
      slowRequests: stats.slowRequests
    })).sort((a, b) => parseFloat(b.avgTime) - parseFloat(a.avgTime));
  },

  /**
   * Get recent slow requests
   */
  getSlowRequests(limit = 50) {
    return this.timings
      .filter(t => t.responseTime > 1000)
      .slice(-limit)
      .sort((a, b) => b.responseTime - a.responseTime);
  },

  /**
   * Clear timing data
   */
  clear() {
    this.timings = [];
    console.log('📊 Performance monitoring data cleared');
  }
};

module.exports = performanceMonitor;
