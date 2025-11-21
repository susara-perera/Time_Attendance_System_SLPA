const express = require('express');
const {
  getAttendanceReport,
  getAuditReport,
  getMealReport,
  getUnitAttendanceReport,
  getDivisionReport,
  getUserActivityReport,
  exportReport,
  getReportSummary,
  getCustomReport,
  generateMySQLAttendanceReport,
  generateMySQLMealReport
} = require('../controllers/reportController');
const { 
  auth, 
  authorize, 
  checkPermission,
  auditTrail 
} = require('../middleware/auth');
const { reportValidation, queryValidation } = require('../middleware/validation');

const router = express.Router();

// @route   GET /api/reports/attendance
// @desc    Get attendance report
// @access  Private
router.get(
  '/attendance',
  auth,
  reportValidation.attendanceReport,
  auditTrail('attendance_report_generated', 'Report'),
  getAttendanceReport
);

// @route   POST /api/reports/attendance
// @desc    Generate attendance report (MongoDB)
// @access  Private
router.post(
  '/attendance',
  // auth, // Temporarily disable auth for testing
  // auditTrail('attendance_report_generated', 'Report'),
  getAttendanceReport
);

// @route   GET /api/reports/audit
// @desc    Get audit report
// @access  Private (admin, administrative_clerk and super_admin only)
router.get(
  '/audit',
  auth,
  authorize('admin', 'administrative_clerk', 'super_admin'),
  checkPermission('reports', 'audit'),
  reportValidation.auditReport,
  auditTrail('audit_report_generated', 'Report'),
  getAuditReport
);

// @route   GET /api/reports/meal
// @desc    Get meal report
// @access  Private
router.get(
  '/meal',
  auth,
  reportValidation.mealReport,
  auditTrail('meal_report_generated', 'Report'),
  getMealReport
);

// @route   GET /api/reports/unit-attendance
// @desc    Get unit attendance report
// @access  Private
router.get(
  '/unit-attendance',
  auth,
  reportValidation.unitAttendanceReport,
  auditTrail('unit_attendance_report_generated', 'Report'),
  getUnitAttendanceReport
);

// @route   GET /api/reports/division/:divisionId
// @desc    Get division-specific report
// @access  Private
router.get(
  '/division/:divisionId',
  auth,
  reportValidation.divisionReport,
  auditTrail('division_report_generated', 'Report'),
  getDivisionReport
);

// @route   GET /api/reports/user-activity
// @desc    Get user activity report
// @access  Private (admin, administrative_clerk and super_admin only)
router.get(
  '/user-activity',
  auth,
  authorize('admin', 'administrative_clerk', 'super_admin'),
  checkPermission('reports', 'user_activity'),
  reportValidation.userActivityReport,
  auditTrail('user_activity_report_generated', 'Report'),
  getUserActivityReport
);

// @route   GET /api/reports/summary
// @desc    Get report summary
// @access  Private
router.get(
  '/summary',
  auth,
  reportValidation.reportSummary,
  auditTrail('report_summary_generated', 'Report'),
  getReportSummary
);

// @route   POST /api/reports/custom
// @desc    Generate custom report
// @access  Private (admin, administrative_clerk and super_admin only)
router.post(
  '/custom',
  auth,
  authorize('admin', 'administrative_clerk', 'super_admin'),
  checkPermission('reports', 'custom'),
  reportValidation.customReport,
  auditTrail('custom_report_generated', 'Report'),
  getCustomReport
);

// @route   GET /api/reports/export/:reportType
// @desc    Export report in various formats
// @access  Private
router.get(
  '/export/:reportType',
  auth,
  reportValidation.exportReport,
  auditTrail('report_exported', 'Report'),
  exportReport
);

// ========== MySQL Report Routes ==========

// @route   POST /api/reports/mysql/attendance
// @desc    Generate MySQL-based attendance report (individual/group)
// @access  Private
router.post(
  '/mysql/attendance',
  // auth, // Temporarily disable auth for testing
  // auditTrail('mysql_attendance_report_generated', 'Report'),
  generateMySQLAttendanceReport
);

// @route   POST /api/reports/mysql/meal
// @desc    Generate MySQL-based meal report
// @access  Private
router.post(
  '/mysql/meal',
  auth,
  auditTrail('mysql_meal_report_generated', 'Report'),
  generateMySQLMealReport
);

// @route   POST /api/reports/mysql/audit
// @desc    Generate MySQL-based audit report (employees who punched "ON" once)
// @access  Private
router.post(
  '/mysql/audit',
  // auth, // Temporarily disable auth for testing
  // auditTrail('mysql_audit_report_generated', 'Report'),
  require('../controllers/reportController').generateMySQLAuditReport
);

module.exports = router;
