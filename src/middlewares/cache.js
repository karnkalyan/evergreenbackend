const NodeCache = require('node-cache');

// Create cache instance with 5-minute default TTL
const cache = new NodeCache({ stdTTL: 300, checkperiod: 600 });

/**
 * Cache middleware
 * @param {number} duration - Cache duration in seconds
 */
const cacheMiddleware = (duration) => {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Create cache key from URL and query params
    const key = `__express__${req.originalUrl}` || req.url;
    
    // Try to get cached response
    const cachedResponse = cache.get(key);
    
    if (cachedResponse) {
      // Send cached response
      return res.json(cachedResponse);
    } else {
      // Override res.json to cache the response before sending
      const originalJson = res.json;
      res.json = function(data) {
        // Cache the successful responses only
        if (res.statusCode >= 200 && res.statusCode < 300) {
          cache.set(key, data, duration);
        }
        originalJson.call(this, data);
      };
      next();
    }
  };
};

module.exports = cacheMiddleware;