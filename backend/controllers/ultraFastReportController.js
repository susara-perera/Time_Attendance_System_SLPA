/**
 * Ultra-Fast Report Controller
 * Integrates with Express API for maximum performance
 */

const ultraFastService = require('../services/ultraFastReportService');

class UltraFastReportController {
  /**
   * GET /api/reports/ultra-fast/division
   * Division-level report with Redis caching
   */
  static async getDivisionReport(req, res) {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'startDate and endDate are required'
        });
      }

      console.log(`[REPORT] Division report: ${startDate} to ${endDate}`);

      const result = await ultraFastService.getOptimalReport('division', {
        startDate,
        endDate
      });

      return res.json({
        success: true,
        data: result.data,
        meta: {
          queryTime: `${result.queryTime}ms`,
          totalTime: `${result.totalExecutionTime}ms`,
          recordCount: result.recordCount,
          cached: result.cached || false,
          timestamp: result.timestamp
        }
      });
    } catch (error) {
      console.error('Division report error:', error);
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * GET /api/reports/ultra-fast/section
   * Section-level report with division filtering
   */
  static async getSectionReport(req, res) {
    try {
      const { divisionCode, startDate, endDate } = req.query;

      if (!divisionCode || !startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'divisionCode, startDate and endDate are required'
        });
      }

      console.log(`[REPORT] Section report: ${divisionCode} (${startDate} to ${endDate})`);

      const result = await ultraFastService.getOptimalReport('section', {
        divisionCode,
        startDate,
        endDate
      });

      return res.json({
        success: true,
        data: result.data,
        meta: {
          queryTime: `${result.queryTime}ms`,
          totalTime: `${result.totalExecutionTime}ms`,
          recordCount: result.recordCount,
          timestamp: result.timestamp
        }
      });
    } catch (error) {
      console.error('Section report error:', error);
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * GET /api/reports/ultra-fast/employee
   * Employee-level report with pagination
   */
  static async getEmployeeReport(req, res) {
    try {
      const { 
        divisionCode, 
        sectionCode, 
        startDate, 
        endDate, 
        page = 1, 
        pageSize = 100 
      } = req.query;

      if (!divisionCode || !sectionCode || !startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'divisionCode, sectionCode, startDate and endDate are required'
        });
      }

      console.log(`[REPORT] Employee report: ${divisionCode}/${sectionCode} page ${page}`);

      const result = await ultraFastService.getOptimalReport('employee', {
        divisionCode,
        sectionCode,
        startDate,
        endDate,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      });

      return res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
        meta: {
          queryTime: `${result.queryTime}ms`,
          totalTime: `${result.totalExecutionTime}ms`,
          recordCount: result.recordCount,
          timestamp: result.timestamp
        }
      });
    } catch (error) {
      console.error('Employee report error:', error);
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * GET /api/reports/ultra-fast/summary
   * Pre-aggregated summary report (100x faster!)
   */
  static async getSummaryReport(req, res) {
    try {
      const { startDate, endDate, divisionCode, sectionCode } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'startDate and endDate are required'
        });
      }

      console.log(`[REPORT] Summary report: ${startDate} to ${endDate}`);

      const result = await ultraFastService.getOptimalReport('summary', {
        startDate,
        endDate,
        divisionCode,
        sectionCode
      });

      return res.json({
        success: true,
        data: result.data,
        meta: {
          queryTime: `${result.queryTime}ms`,
          totalTime: `${result.totalExecutionTime}ms`,
          recordCount: result.recordCount,
          source: result.source,
          timestamp: result.timestamp
        }
      });
    } catch (error) {
      console.error('Summary report error:', error);
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * POST /api/reports/ultra-fast/rebuild-summary
   * Rebuild the daily summary table (admin only)
   */
  static async rebuildSummaryTable(req, res) {
    try {
      console.log('[ADMIN] Rebuilding summary table...');

      // Check admin permission
      if (req.user?.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Only admins can rebuild summary table'
        });
      }

      const success = await ultraFastService.createDailySummaryTable();

      return res.json({
        success,
        message: success ? 'Summary table rebuilt successfully' : 'Failed to rebuild summary table'
      });
    } catch (error) {
      console.error('Summary rebuild error:', error);
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = UltraFastReportController;
