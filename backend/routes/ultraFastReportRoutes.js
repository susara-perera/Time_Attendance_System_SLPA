/**
 * Ultra-Fast Report Routes
 * These endpoints provide 10-100x faster report generation
 */

const express = require('express');
const UltraFastReportController = require('../controllers/ultraFastReportController');

const router = express.Router();

/**
 * @route GET /api/reports/ultra-fast/division
 * @desc Division-level attendance report (cached)
 * @query startDate, endDate
 * @example GET /api/reports/ultra-fast/division?startDate=2025-12-11&endDate=2026-01-10
 */
router.get('/division', UltraFastReportController.getDivisionReport);

/**
 * @route GET /api/reports/ultra-fast/section
 * @desc Section-level attendance report
 * @query divisionCode, startDate, endDate
 * @example GET /api/reports/ultra-fast/section?divisionCode=DIV001&startDate=2025-12-11&endDate=2026-01-10
 */
router.get('/section', UltraFastReportController.getSectionReport);

/**
 * @route GET /api/reports/ultra-fast/employee
 * @desc Employee-level report with pagination
 * @query divisionCode, sectionCode, startDate, endDate, page, pageSize
 * @example GET /api/reports/ultra-fast/employee?divisionCode=DIV001&sectionCode=SEC001&startDate=2025-12-11&endDate=2026-01-10&page=1&pageSize=50
 */
router.get('/employee', UltraFastReportController.getEmployeeReport);

/**
 * @route GET /api/reports/ultra-fast/summary
 * @desc Pre-aggregated daily summary report (100x faster!)
 * @query startDate, endDate, [divisionCode], [sectionCode]
 * @example GET /api/reports/ultra-fast/summary?startDate=2025-12-11&endDate=2026-01-10
 */
router.get('/summary', UltraFastReportController.getSummaryReport);

/**
 * @route POST /api/reports/ultra-fast/rebuild-summary
 * @desc Rebuild the daily summary table (admin only)
 * @desc Used to refresh pre-aggregated data after bulk attendance updates
 */
router.post('/rebuild-summary', UltraFastReportController.rebuildSummaryTable);

module.exports = router;
