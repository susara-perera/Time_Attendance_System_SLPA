const express = require('express');
const extremeSpeedController = require('../controllers/extremeSpeedController');

const router = express.Router();

/**
 * EXTREME SPEED API ROUTES
 * 
 * All routes use:
 * - Triple-tier caching (Memory + Redis + Database)
 * - Query parallelization
 * - Response compression
 * - ETag validation
 * - Connection pool optimization
 */

// Division report with extreme caching
router.get('/division-extreme', extremeSpeedController.getDivisionReportExtreme);

// Section report with extreme caching
router.get('/section-extreme', extremeSpeedController.getSectionReportExtreme);

// Employee report with pagination and extreme caching
router.get('/employee-extreme', extremeSpeedController.getEmployeeReportExtreme);

// Dashboard with parallelized queries
router.get('/dashboard-extreme', extremeSpeedController.getDashboardExtreme);

// Cache statistics and health
router.get('/cache-stats', extremeSpeedController.getCacheStats);

// Clear caches (for testing)
router.post('/clear-caches', extremeSpeedController.clearCaches);

module.exports = router;
