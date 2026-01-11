/**
 * EXTREME SPEED MIDDLEWARE
 * 
 * Optimizations:
 * 1. Response compression for payloads >5KB
 * 2. ETag caching for HTTP-level caching
 * 3. Cache-Control headers for browser caching
 * 4. Response timing tracking
 * 5. Stream responses for large datasets
 */

const zlib = require('zlib');
const crypto = require('crypto');

class ExtremeSpeedMiddleware {
  /**
   * Response compression middleware
   * Compresses responses >5KB with gzip
   */
  static compressionMiddleware() {
    return (req, res, next) => {
      const originalJson = res.json;

      res.json = function(data) {
        // Add ETag for caching
        const etag = crypto.createHash('md5')
          .update(JSON.stringify(data))
          .digest('hex');

        res.setHeader('ETag', `"${etag}"`);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('X-Compression', 'gzip');

        // Check if client supports compression
        const acceptEncoding = req.get('accept-encoding') || '';
        
        if (acceptEncoding.includes('gzip')) {
          const payload = JSON.stringify(data);
          
          if (payload.length > 5120) { // >5KB - compress
            zlib.gzip(payload, (err, compressed) => {
              if (!err) {
                res.setHeader('Content-Encoding', 'gzip');
                res.setHeader('X-Compression-Ratio', 
                  (compressed.length / payload.length * 100).toFixed(1) + '%');
                res.setHeader('X-Original-Size', payload.length);
                res.setHeader('X-Compressed-Size', compressed.length);
                return res.send(compressed);
              }
              originalJson.call(this, data);
            });
          } else {
            res.setHeader('X-Compression-Status', 'Too small to compress');
            originalJson.call(this, data);
          }
        } else {
          originalJson.call(this, data);
        }
      };

      next();
    };
  }

  /**
   * Request timing middleware
   * Tracks total request time
   */
  static timingMiddleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      
      res.on('finish', () => {
        const totalTime = Date.now() - startTime;
        res.setHeader('X-Response-Time', totalTime + 'ms');
      });

      next();
    };
  }

  /**
   * Cache-Control middleware
   * Sets appropriate cache headers
   */
  static cacheControlMiddleware() {
    return (req, res, next) => {
      if (req.path.includes('/reports/')) {
        // Cache reports for 1 hour
        res.setHeader('Cache-Control', 'public, max-age=3600');
      } else if (req.path.includes('/summary/')) {
        // Cache summaries for 10 minutes
        res.setHeader('Cache-Control', 'public, max-age=600');
      } else {
        // No cache for dynamic data
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
      
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      next();
    };
  }

  /**
   * HTTP/2 Server Push Hint
   * Suggest to client what resources to push
   */
  static pushHintMiddleware() {
    return (req, res, next) => {
      if (req.path === '/api/dashboard') {
        // Hint that these sub-resources will be needed
        res.setHeader('Link', 
          '</api/reports/division>; rel=preload; as=fetch, ' +
          '</api/reports/section>; rel=preload; as=fetch'
        );
      }

      next();
    };
  }

  /**
   * Request deduplication middleware
   * Prevents duplicate requests within 1 second
   */
  static dedupMiddleware() {
    const recentRequests = new Map();

    return (req, res, next) => {
      const key = `${req.method}:${req.path}:${JSON.stringify(req.query)}`;
      
      if (recentRequests.has(key)) {
        const cached = recentRequests.get(key);
        res.setHeader('X-Dedup-Cache', 'true');
        return res.json(cached);
      }

      const originalJson = res.json;
      res.json = function(data) {
        // Cache this response for 1 second
        recentRequests.set(key, data);
        setTimeout(() => recentRequests.delete(key), 1000);

        originalJson.call(this, data);
      };

      next();
    };
  }

  /**
   * Combine all middleware
   */
  static applyAll(app) {
    app.use(this.timingMiddleware());
    app.use(this.compressionMiddleware());
    app.use(this.cacheControlMiddleware());
    app.use(this.pushHintMiddleware());
    app.use(this.dedupMiddleware());
    
    console.log('✅ All extreme speed middleware applied');
  }
}

module.exports = ExtremeSpeedMiddleware;
