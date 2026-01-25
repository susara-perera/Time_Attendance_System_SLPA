const { MySQLAttendance: Attendance, MySQLUser: User, MySQLAuditLog: AuditLog } = require('../models/mysql');
const moment = require('moment');

// @desc    Check in
// @route   POST /api/attendance/checkin
// @access  Private
const checkIn = async (req, res) => {
  try {
    const userId = req.user._id;
    const { time, location, method = 'web', remarks } = req.body;

    const checkInTime = time ? new Date(time) : new Date();
    const today = new Date(checkInTime);
    today.setHours(0, 0, 0, 0);

    // Check if user already checked in today
    const existingAttendance = await Attendance.findOne({
      user: userId,
      date: today
    });

    if (existingAttendance && existingAttendance.checkIn.time) {
      return res.status(400).json({
        success: false,
        message: 'You have already checked in today'
      });
    }

    let attendance;

    if (existingAttendance) {
      // Update existing record
      existingAttendance.checkIn = {
        time: checkInTime,
        location,
        method,
        remarks
      };
      existingAttendance.status = 'present';
      attendance = await existingAttendance.save();
    } else {
      // Create new attendance record
      attendance = new Attendance({
        user: userId,
        date: today,
        checkIn: {
          time: checkInTime,
          location,
          method,
          remarks
        },
        status: 'present'
      });
      await attendance.save();
    }

    // Log check-in
    await AuditLog.createLog({
      user: userId,
      action: 'check_in',
      entity: { type: 'Attendance', id: attendance._id },
      category: 'data_modification',
      severity: 'low',
      description: 'User checked in',
      details: `Check-in at ${checkInTime.toLocaleString()}`,
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        method: req.method,
        endpoint: req.originalUrl
      }
    });

    // Log to recent activities table
    try {
      const { logRecentActivity } = require('../services/activityLogService');
      const moment = require('moment');

      await logRecentActivity({
        title: 'Check-in Recorded',
        description: `${req.user?.name || req.user?.username || 'User'} checked in`,
        activity_type: 'check_in',
        icon: 'bi bi-box-arrow-in-right',
        entity_id: attendance._id?.toString(),
        entity_name: `Check-in ${moment(checkInTime).format('HH:mm')}`,
        user_id: req.user?._id?.toString(),
        user_name: req.user?.name || req.user?.username || 'Unknown User'
      });

      console.log(`[MySQL] ✅ Recent activity logged for check-in: ${req.user?.name || req.user?.username}`);
    } catch (activityErr) {
      console.error('[RecentActivity] Failed to log check-in activity:', activityErr);
    }

    res.status(200).json({
      success: true,
      message: 'Check-in successful',
      data: attendance
    });

  } catch (error) {
    console.error('Check-in error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during check-in'
    });
  }
};

// @desc    Check out
// @route   POST /api/attendance/checkout
// @access  Private
const checkOut = async (req, res) => {
  try {
    const userId = req.user._id;
    const { time, location, method = 'web', remarks } = req.body;

    const checkOutTime = time ? new Date(time) : new Date();
    const today = new Date(checkOutTime);
    today.setHours(0, 0, 0, 0);

    // Find today's attendance record
    const attendance = await Attendance.findOne({
      user: userId,
      date: today
    });

    if (!attendance || !attendance.checkIn.time) {
      return res.status(400).json({
        success: false,
        message: 'You must check in before checking out'
      });
    }

    if (attendance.checkOut.time) {
      return res.status(400).json({
        success: false,
        message: 'You have already checked out today'
      });
    }

    // Validate check-out time is after check-in time
    if (checkOutTime <= attendance.checkIn.time) {
      return res.status(400).json({
        success: false,
        message: 'Check-out time must be after check-in time'
      });
    }

    // Update attendance record
    attendance.checkOut = {
      time: checkOutTime,
      location,
      method,
      remarks
    };

    await attendance.save();

    // Log check-out
    await AuditLog.createLog({
      user: userId,
      action: 'check_out',
      entity: { type: 'Attendance', id: attendance._id },
      category: 'data_modification',
      severity: 'low',
      description: 'User checked out',
      details: `Check-out at ${checkOutTime.toLocaleString()}`,
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        method: req.method,
        endpoint: req.originalUrl
      }
    });

    // Log to recent activities table
    try {
      const { logRecentActivity } = require('../services/activityLogService');
      const moment = require('moment');

      await logRecentActivity({
        title: 'Check-out Recorded',
        description: `${req.user?.name || req.user?.username || 'User'} checked out`,
        activity_type: 'check_out',
        icon: 'bi bi-box-arrow-right',
        entity_id: attendance._id?.toString(),
        entity_name: `Check-out ${moment(checkOutTime).format('HH:mm')}`,
        user_id: req.user?._id?.toString(),
        user_name: req.user?.name || req.user?.username || 'Unknown User'
      });

      console.log(`[MySQL] ✅ Recent activity logged for check-out: ${req.user?.name || req.user?.username}`);
    } catch (activityErr) {
      console.error('[RecentActivity] Failed to log check-out activity:', activityErr);
    }

    res.status(200).json({
      success: true,
      message: 'Check-out successful',
      data: attendance
    });

  } catch (error) {
    console.error('Check-out error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during check-out'
    });
  }
};

// @desc    Start break
// @route   POST /api/attendance/break/start
// @access  Private
const startBreak = async (req, res) => {
  try {
    const userId = req.user._id;
    const { breakType = 'personal', remarks } = req.body;

    const breakStart = new Date();
    const today = new Date(breakStart);
    today.setHours(0, 0, 0, 0);

    // Find today's attendance record
    const attendance = await Attendance.findOne({
      user: userId,
      date: today
    });

    if (!attendance || !attendance.checkIn.time) {
      return res.status(400).json({
        success: false,
        message: 'You must check in before taking a break'
      });
    }

    if (attendance.checkOut.time) {
      return res.status(400).json({
        success: false,
        message: 'Cannot start break after checking out'
      });
    }

    // Check if there's an ongoing break
    const ongoingBreak = attendance.breaks.find(b => !b.breakEnd);
    if (ongoingBreak) {
      return res.status(400).json({
        success: false,
        message: 'You are already on a break'
      });
    }

    // Add break to attendance record
    attendance.breaks.push({
      breakStart,
      breakType,
      remarks
    });

    await attendance.save();

    // Log break start
    await AuditLog.createLog({
      user: userId,
      action: 'break_start',
      entity: { type: 'Attendance', id: attendance._id },
      category: 'data_modification',
      severity: 'low',
      description: 'User started break',
      details: `Started ${breakType} break at ${breakStart.toLocaleString()}`,
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        method: req.method,
        endpoint: req.originalUrl
      }
    });

    res.status(200).json({
      success: true,
      message: 'Break started successfully',
      data: attendance
    });

  } catch (error) {
    console.error('Start break error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error starting break'
    });
  }
};

// @desc    End break
// @route   POST /api/attendance/break/end
// @access  Private
const endBreak = async (req, res) => {
  try {
    const userId = req.user._id;
    const { remarks } = req.body;

    const breakEnd = new Date();
    const today = new Date(breakEnd);
    today.setHours(0, 0, 0, 0);

    // Find today's attendance record
    const attendance = await Attendance.findOne({
      user: userId,
      date: today
    });

    if (!attendance || !attendance.checkIn.time) {
      return res.status(400).json({
        success: false,
        message: 'No attendance record found for today'
      });
    }

    // Find ongoing break
    const ongoingBreak = attendance.breaks.find(b => !b.breakEnd);
    if (!ongoingBreak) {
      return res.status(400).json({
        success: false,
        message: 'No ongoing break found'
      });
    }

    // End the break
    ongoingBreak.breakEnd = breakEnd;
    if (remarks) ongoingBreak.remarks = remarks;

    await attendance.save();

    // Log break end
    await AuditLog.createLog({
      user: userId,
      action: 'break_end',
      entity: { type: 'Attendance', id: attendance._id },
      category: 'data_modification',
      severity: 'low',
      description: 'User ended break',
      details: `Ended break at ${breakEnd.toLocaleString()}`,
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        method: req.method,
        endpoint: req.originalUrl
      }
    });

    res.status(200).json({
      success: true,
      message: 'Break ended successfully',
      data: attendance
    });

  } catch (error) {
    console.error('End break error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error ending break'
    });
  }
};

// @desc    Get today's attendance
// @route   GET /api/attendance/today
// @access  Private
const getTodayAttendance = async (req, res) => {
  try {
    const userId = req.user._id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await Attendance.findOne({
      user: userId,
      date: today
    }).populate('user', 'firstName lastName employeeId');

    res.status(200).json({
      success: true,
      data: attendance
    });

  } catch (error) {
    console.error('Get today attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting today\'s attendance'
    });
  }
};

// @desc    Get attendance records
// @route   GET /api/attendance
// @access  Private
const getAttendance = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      startDate,
      endDate,
      userId,
      status,
      division,
      section
    } = req.query;

    // Build query
    let query = {};

    // Role-based filtering
    if (req.user.role === 'employee') {
      query.user = req.user._id;
    } else if (req.user.role === 'clerk' && req.user.section) {
      // Get users in the same section
      const sectionUsers = await User.find({ section: req.user.section._id }).distinct('_id');
      query.user = { $in: sectionUsers };
    } else if (req.user.role === 'admin' && req.user.division) {
      // Get users in the same division
      const divisionUsers = await User.find({ division: req.user.division._id }).distinct('_id');
      query.user = { $in: divisionUsers };
    }

    // Date range filter
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    // Additional filters
    if (userId && ['super_admin', 'admin'].includes(req.user.role)) {
      query.user = userId;
    }
    if (status) query.status = status;

    // Division/Section filters for admin and super_admin
    if (['super_admin', 'admin'].includes(req.user.role)) {
      if (division || section) {
        let userFilter = {};
        if (division) userFilter.division = division;
        if (section) userFilter.section = section;
        
        const filteredUsers = await User.find(userFilter).distinct('_id');
        query.user = query.user ? { $in: query.user.$in.filter(id => filteredUsers.includes(id)) } : { $in: filteredUsers };
      }
    }

    // Execute query with pagination
    const skip = (page - 1) * limit;
    
    const [attendance, total] = await Promise.all([
      Attendance.find(query)
        .populate('user', 'firstName lastName employeeId')
        .populate('approvedBy', 'firstName lastName')
        .sort({ date: -1, 'checkIn.time': -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Attendance.countDocuments(query)
    ]);

    // Calculate pagination
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.status(200).json({
      success: true,
      data: attendance,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages,
        hasNextPage,
        hasPrevPage
      }
    });

  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting attendance records'
    });
  }
};

// @desc    Get single attendance record
// @route   GET /api/attendance/:id
// @access  Private
const getAttendanceById = async (req, res) => {
  try {
    const attendance = await Attendance.findById(req.params.id)
      .populate('user', 'firstName lastName employeeId division section')
      .populate('approvedBy', 'firstName lastName');

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found'
      });
    }

    // Check access permissions
    if (req.user.role === 'employee' && attendance.user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.status(200).json({
      success: true,
      data: attendance
    });

  } catch (error) {
    console.error('Get attendance by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting attendance record'
    });
  }
};

// @desc    Update attendance record
// @route   PUT /api/attendance/:id
// @access  Private (admin, super_admin, clerk)
const updateAttendance = async (req, res) => {
  try {
    const attendance = await Attendance.findById(req.params.id)
      .populate('user', 'firstName lastName employeeId');

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found'
      });
    }

    // Store old values for audit
    const oldValues = {
      checkIn: attendance.checkIn,
      checkOut: attendance.checkOut,
      status: attendance.status,
      remarks: attendance.remarks
    };

    const {
      checkIn,
      checkOut,
      status,
      remarks,
      reason
    } = req.body;

    // Update fields
    if (checkIn) attendance.checkIn = { ...attendance.checkIn, ...checkIn };
    if (checkOut) attendance.checkOut = { ...attendance.checkOut, ...checkOut };
    if (status) attendance.status = status;
    if (remarks) attendance.remarks = remarks;

    // Add to edit history
    attendance.editHistory.push({
      editedBy: req.user._id,
      changes: req.body,
      reason: reason || 'Manual edit'
    });

    await attendance.save();

    // Log attendance update
    await AuditLog.createLog({
      user: req.user._id,
      action: 'attendance_updated',
      entity: { type: 'Attendance', id: attendance._id },
      category: 'data_modification',
      severity: 'medium',
      description: 'Attendance record updated',
      details: `Updated attendance for ${attendance.user.firstName} ${attendance.user.lastName} (${attendance.user.employeeId})`,
      changes: {
        before: oldValues,
        after: req.body
      },
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        method: req.method,
        endpoint: req.originalUrl
      }
    });

    res.status(200).json({
      success: true,
      message: 'Attendance record updated successfully',
      data: attendance
    });

  } catch (error) {
    console.error('Update attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating attendance record'
    });
  }
};

// @desc    Delete attendance record
// @route   DELETE /api/attendance/:id
// @access  Private (super_admin only)
const deleteAttendance = async (req, res) => {
  try {
    const attendance = await Attendance.findById(req.params.id)
      .populate('user', 'firstName lastName employeeId');

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found'
      });
    }

    await Attendance.findByIdAndDelete(req.params.id);

    // Log attendance deletion
    await AuditLog.createLog({
      user: req.user._id,
      action: 'attendance_deleted',
      entity: { type: 'Attendance', id: attendance._id },
      category: 'data_modification',
      severity: 'high',
      description: 'Attendance record deleted',
      details: `Deleted attendance for ${attendance.user.firstName} ${attendance.user.lastName} (${attendance.user.employeeId})`,
      changes: {
        before: {
          date: attendance.date,
          checkIn: attendance.checkIn,
          checkOut: attendance.checkOut,
          status: attendance.status
        }
      },
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        method: req.method,
        endpoint: req.originalUrl
      },
      requiresReview: true
    });

    res.status(200).json({
      success: true,
      message: 'Attendance record deleted successfully'
    });

  } catch (error) {
    console.error('Delete attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting attendance record'
    });
  }
};

// @desc    Get attendance summary
// @route   GET /api/attendance/summary
// @access  Private
const getAttendanceSummary = async (req, res) => {
  try {
    const { userId, startDate, endDate, period = 'monthly' } = req.query;

    let targetUserId = userId;
    
    // If not admin/super_admin, can only get their own summary
    if (!['super_admin', 'admin'].includes(req.user.role)) {
      targetUserId = req.user._id;
    }

    // Default date range based on period
    let start, end;
    const now = moment();

    switch (period) {
      case 'daily':
        start = now.clone().startOf('day');
        end = now.clone().endOf('day');
        break;
      case 'weekly':
        start = now.clone().startOf('week');
        end = now.clone().endOf('week');
        break;
      case 'yearly':
        start = now.clone().startOf('year');
        end = now.clone().endOf('year');
        break;
      case 'monthly':
      default:
        start = now.clone().startOf('month');
        end = now.clone().endOf('month');
        break;
    }

    if (startDate) start = moment(startDate);
    if (endDate) end = moment(endDate);

    const summary = await Attendance.getAttendanceSummary(
      targetUserId,
      start.toDate(),
      end.toDate()
    );

    res.status(200).json({
      success: true,
      data: summary[0] || {
        totalDays: 0,
        presentDays: 0,
        absentDays: 0,
        lateDays: 0,
        totalWorkingHours: 0,
        totalOvertime: 0,
        totalLateMinutes: 0
      },
      period: {
        start: start.format('YYYY-MM-DD'),
        end: end.format('YYYY-MM-DD'),
        type: period
      }
    });

  } catch (error) {
    console.error('Get attendance summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting attendance summary'
    });
  }
};

module.exports = {
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
};
