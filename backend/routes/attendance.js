const express = require('express');
const {
  checkIn,
  checkOut,
  startBreak,
  endBreak,
  getTodayAttendance,
  getAttendance,
  getAttendanceById,
  updateAttendance,
  deleteAttendance,
  getAttendanceSummary
} = require('../controllers/attendanceController');
const { 
  auth, 
  authorize, 
  checkPermission,
  auditTrail 
} = require('../middleware/auth');
const { attendanceValidation, queryValidation } = require('../middleware/validation');

const router = express.Router();

// @route   POST /api/attendance/checkin
// @desc    Check in
// @access  Private
router.post(
  '/checkin',
  auth,
  attendanceValidation.checkIn,
  auditTrail('check_in', 'Attendance'),
  checkIn
);

// @route   POST /api/attendance/checkout
// @desc    Check out
// @access  Private
router.post(
  '/checkout',
  auth,
  attendanceValidation.checkOut,
  auditTrail('check_out', 'Attendance'),
  checkOut
);

// @route   POST /api/attendance/break/start
// @desc    Start break
// @access  Private
router.post(
  '/break/start',
  auth,
  auditTrail('break_start', 'Attendance'),
  startBreak
);

// @route   POST /api/attendance/break/end
// @desc    End break
// @access  Private
router.post(
  '/break/end',
  auth,
  auditTrail('break_end', 'Attendance'),
  endBreak
);

// @route   GET /api/attendance/today
// @desc    Get today's attendance
// @access  Private
router.get(
  '/today',
  auth,
  getTodayAttendance
);

// @route   GET /api/attendance/summary
// @desc    Get attendance summary
// @access  Private
router.get(
  '/summary',
  auth,
  queryValidation.dateRange,
  getAttendanceSummary
);

// @route   GET /api/attendance
// @desc    Get attendance records
// @access  Private
router.get(
  '/',
  auth,
  authorize('super_admin', 'admin', 'clerk', 'administrative_clerk', 'employee'),
  queryValidation.pagination,
  queryValidation.dateRange,
  auditTrail('attendance_viewed', 'Attendance'),
  getAttendance
);

// @route   GET /api/attendance/:id
// @desc    Get single attendance record
// @access  Private
router.get(
  '/:id',
  auth,
  auditTrail('attendance_detail_viewed', 'Attendance'),
  getAttendanceById
);

// @route   PUT /api/attendance/:id
// @desc    Update attendance record
// @access  Private (admin, super_admin, clerk)
router.put(
  '/:id',
  auth,
  authorize('super_admin', 'admin', 'clerk', 'administrative_clerk'),
  checkPermission('attendance', 'update'),
  attendanceValidation.update,
  auditTrail('attendance_updated', 'Attendance'),
  updateAttendance
);

// @route   DELETE /api/attendance/:id
// @desc    Delete attendance record
// @access  Private (super_admin only)
router.delete(
  '/:id',
  auth,
  authorize('super_admin'),
  checkPermission('attendance', 'delete'),
  auditTrail('attendance_deleted', 'Attendance'),
  deleteAttendance
);

module.exports = router;
