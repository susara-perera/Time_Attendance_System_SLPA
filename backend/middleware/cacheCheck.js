const { isCacheInitialized } = require('../services/hrisApiService');

/**
 * Middleware to ensure HRIS cache is initialized before processing requests
 * This is particularly important for login requests that might need HRIS data
 */
const ensureCacheInitialized = async (req, res, next) => {
  try {
    // Check if cache is initialized
    if (!isCacheInitialized()) {
      return res.status(503).json({
        success: false,
        message: 'System is initializing. Please try again in a few moments.',
        error: 'HRIS cache is not yet initialized'
      });
    }
    
    // Cache is initialized, proceed to next middleware
    next();
  } catch (error) {
    console.error('Error checking cache initialization:', error);
    // Don't block the request if there's an error checking cache status
    next();
  }
};

module.exports = {
  ensureCacheInitialized
};
