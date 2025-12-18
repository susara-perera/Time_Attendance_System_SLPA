const Attendance = require('../models/Attendance');
const User = require('../models/User');
const Division = require('../models/Division');
const Section = require('../models/Section');
const Meal = require('../models/Meal');
const AuditLog = require('../models/AuditLog');
const { createMySQLConnection } = require('../config/mysql');
const moment = require('moment');

// @desc    Generate attendance report
// @route   GET /api/reports/attendance or POST /api/reports/attendance
// @access  Private
const getAttendanceReport = async (req, res) => {
  try {
    // Handle both GET (query) and POST (body) requests
    const data = req.method === 'GET' ? req.query : req.body;
    
    const {
      startDate,
      endDate,
      from_date,
      to_date,
      report_type,
      division_id,
      section_id,
      employee_id,
      filters = {},
      format = 'json',
      groupBy = 'user'
    } = data;

    // Handle different date parameter names
    const start_date = startDate || from_date;
    const end_date = endDate || to_date;

    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }

    // Validate date range
    const start = moment(start_date).startOf('day');
    const end = moment(end_date).endOf('day');

    if (end.diff(start, 'days') > 365) {
      return res.status(400).json({
        success: false,
        message: 'Date range cannot exceed 365 days'
      });
    }

    // Build base query
    let attendanceQuery = {
      date: {
        $gte: start.toDate(),
        $lte: end.toDate()
      }
    };

    // Apply role-based filters (temporarily comment out for testing)
    let userFilter = {};
    // if (req.user && req.user.role !== 'super_admin') {
    //   if (req.user.role === 'admin' && req.user.division) {
    //     userFilter.division = req.user.division._id;
    //   } else if (req.user.role === 'clerk' && req.user.section) {
    //     userFilter.section = req.user.section._id;
    //   } else if (req.user.role === 'employee') {
    //     userFilter._id = req.user._id;
    //   }
    // }

    // Apply additional filters from request
    if (division_id && division_id !== 'all' && division_id !== '') {
      userFilter.division = division_id;
    }
    if (section_id && section_id !== 'all' && section_id !== '') {
      userFilter.section = section_id;
    }
    if (employee_id && employee_id !== '') {
      userFilter.employeeId = employee_id;
    }
    if (filters.division) userFilter.division = filters.division;
    if (filters.section) userFilter.section = filters.section;
    if (filters.users && filters.users.length > 0) {
      userFilter._id = { $in: filters.users };
    }
    if (filters.status) attendanceQuery.status = filters.status;

    // Get filtered users
    const users = await User.find(userFilter).select('_id');
    const userIds = users.map(user => user._id);
    
    if (userIds.length > 0) {
      attendanceQuery.user = { $in: userIds };
    }

    let reportData;

    // Handle group reports differently to match the required format
    if (report_type === 'group') {
      const sub_section_id = data.sub_section_id || '';
      reportData = await generateMySQLGroupAttendanceReport(start_date, end_date, division_id, section_id, sub_section_id);
    } else if (groupBy === 'division') {
      reportData = await generateDivisionReport(attendanceQuery, start, end);
    } else if (groupBy === 'section') {
      reportData = await generateSectionReport(attendanceQuery, start, end);
    } else if (groupBy === 'date') {
      reportData = await generateDateReport(attendanceQuery, start, end);
    } else {
      reportData = await generateUserReport(attendanceQuery, start, end);
    }

    // Log report generation (temporarily comment out for testing)
    if (req.user) {
      await AuditLog.createLog({
        user: req.user._id,
        action: 'report_generated',
        entity: { type: 'Report', id: req.user._id },
        category: 'data_modification',
        severity: 'low',
        description: 'Attendance report generated',
        details: `Generated attendance report for ${start.format('YYYY-MM-DD')} to ${end.format('YYYY-MM-DD')}`,
        metadata: {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          method: req.method,
          endpoint: req.originalUrl,
          reportType: 'attendance',
          dateRange: { start: start.format('YYYY-MM-DD'), end: end.format('YYYY-MM-DD') },
          groupBy,
          filters
        }
      });
    }

    if (format === 'csv') {
      return generateCSVResponse(res, reportData, 'attendance_report');
    } else if (format === 'excel') {
      return generateExcelResponse(res, reportData, 'attendance_report');
    }

    res.status(200).json({
      success: true,
      data: reportData,
      summary: {
        totalRecords: reportData.length,
        dateRange: {
          start: start.format('YYYY-MM-DD'),
          end: end.format('YYYY-MM-DD')
        },
        groupBy,
        filters
      }
    });

  } catch (error) {
    console.error('Generate attendance report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error generating attendance report'
    });
  }
};

// @desc    Generate meal report
// @route   GET /api/reports/meal
// @access  Private
const getMealReport = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      filters = {},
      format = 'json',
      groupBy = 'user'
    } = req.body;

    // Validate date range
    const start = moment(startDate).startOf('day');
    const end = moment(endDate).endOf('day');

    if (end.diff(start, 'days') > 365) {
      return res.status(400).json({
        success: false,
        message: 'Date range cannot exceed 365 days'
      });
    }

    // Build base query
    let mealQuery = {
      date: {
        $gte: start.toDate(),
        $lte: end.toDate()
      }
    };

    // Apply role-based filters
    let userFilter = {};
    if (req.user.role !== 'super_admin') {
      if (req.user.role === 'admin' && req.user.division) {
        userFilter.division = req.user.division._id;
      } else if (req.user.role === 'clerk' && req.user.section) {
        userFilter.section = req.user.section._id;
      } else if (req.user.role === 'employee') {
        userFilter._id = req.user._id;
      }
    }

    // Apply additional filters
    if (filters.divisionId) mealQuery.divisionId = filters.divisionId;
    if (filters.sectionId) mealQuery.sectionId = filters.sectionId;
    if (filters.employeeId) {
      // For individual employee reports
      const user = await User.findOne({ employeeId: filters.employeeId });
      if (user) {
        mealQuery.user = user._id;
      }
    }
    if (filters.division) userFilter.division = filters.division;
    if (filters.section) userFilter.section = filters.section;
    if (filters.users && filters.users.length > 0) {
      userFilter._id = { $in: filters.users };
    }
    if (filters.mealType) mealQuery.mealType = filters.mealType;
    if (filters.location) mealQuery.location = filters.location;
    if (filters.paymentStatus) mealQuery.paymentStatus = filters.paymentStatus;

    // Get filtered users (only if we need user-based filtering)
    if (Object.keys(userFilter).length > 0) {
      const users = await User.find(userFilter).select('_id');
      const userIds = users.map(user => user._id);
      
      if (userIds.length > 0) {
        mealQuery.user = { $in: userIds };
      }
    }

    let reportData;

    if (groupBy === 'mealType') {
      reportData = await generateMealTypeReport(mealQuery, start, end);
    } else if (groupBy === 'location') {
      reportData = await generateMealLocationReport(mealQuery, start, end);
    } else if (groupBy === 'date') {
      reportData = await generateMealDateReport(mealQuery, start, end);
    } else {
      // Default: return individual meal records with user info
      reportData = await Meal.find(mealQuery)
        .populate('user', 'firstName lastName employeeId email')
        .sort({ mealTime: -1 })
        .lean();
    }

    // Log report generation
    await AuditLog.createLog({
      user: req.user._id,
      action: 'report_generated',
      entity: { type: 'Report' },
      category: 'data_modification',
      severity: 'low',
      description: 'Meal report generated',
      details: `Generated meal report for ${start.format('YYYY-MM-DD')} to ${end.format('YYYY-MM-DD')}`,
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        method: req.method,
        endpoint: req.originalUrl,
        reportType: 'meal',
        dateRange: { start: start.format('YYYY-MM-DD'), end: end.format('YYYY-MM-DD') },
        groupBy,
        filters
      }
    });

    if (format === 'csv') {
      return generateCSVResponse(res, reportData, 'meal_report');
    } else if (format === 'excel') {
      return generateExcelResponse(res, reportData, 'meal_report');
    }

    res.status(200).json({
      success: true,
      data: reportData,
      summary: {
        totalRecords: reportData.length,
        dateRange: {
          start: start.format('YYYY-MM-DD'),
          end: end.format('YYYY-MM-DD')
        },
        groupBy,
        filters
      }
    });

  } catch (error) {
    console.error('Generate meal report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error generating meal report'
    });
  }
};

// @desc    Generate audit report
// @route   GET /api/reports/audit
// @access  Private (admin, super_admin)
const getAuditReport = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      filters = {},
      format = 'json',
      groupBy = 'action'
    } = req.body;

    // Validate date range
    const start = moment(startDate).startOf('day');
    const end = moment(endDate).endOf('day');

    if (end.diff(start, 'days') > 90) {
      return res.status(400).json({
        success: false,
        message: 'Date range for audit reports cannot exceed 90 days'
      });
    }

    // Build base query
    let auditQuery = {
      createdAt: {
        $gte: start.toDate(),
        $lte: end.toDate()
      }
    };

    // Apply filters
    if (filters.action) auditQuery.action = filters.action;
    if (filters.category) auditQuery.category = filters.category;
    if (filters.severity) auditQuery.severity = filters.severity;
    if (filters.user) auditQuery.user = filters.user;
    if (filters.entityType) auditQuery['entity.type'] = filters.entityType;
    if (filters.isSecurityRelevant !== undefined) auditQuery.isSecurityRelevant = filters.isSecurityRelevant;

    let reportData;

    if (groupBy === 'user') {
      reportData = await generateAuditUserReport(auditQuery, start, end);
    } else if (groupBy === 'category') {
      reportData = await generateAuditCategoryReport(auditQuery, start, end);
    } else if (groupBy === 'severity') {
      reportData = await generateAuditSeverityReport(auditQuery, start, end);
    } else if (groupBy === 'date') {
      reportData = await generateAuditDateReport(auditQuery, start, end);
    } else {
      reportData = await generateAuditActionReport(auditQuery, start, end);
    }

    // Log report generation
    await AuditLog.createLog({
      user: req.user._id,
      action: 'report_generated',
      entity: { type: 'Report' },
      category: 'data_modification',
      severity: 'medium',
      description: 'Audit report generated',
      details: `Generated audit report for ${start.format('YYYY-MM-DD')} to ${end.format('YYYY-MM-DD')}`,
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        method: req.method,
        endpoint: req.originalUrl,
        reportType: 'audit',
        dateRange: { start: start.format('YYYY-MM-DD'), end: end.format('YYYY-MM-DD') },
        groupBy,
        filters
      }
    });

    if (format === 'csv') {
      return generateCSVResponse(res, reportData, 'audit_report');
    } else if (format === 'excel') {
      return generateExcelResponse(res, reportData, 'audit_report');
    }

    res.status(200).json({
      success: true,
      data: reportData,
      summary: {
        totalRecords: reportData.length,
        dateRange: {
          start: start.format('YYYY-MM-DD'),
          end: end.format('YYYY-MM-DD')
        },
        groupBy,
        filters
      }
    });

  } catch (error) {
    console.error('Generate audit report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error generating audit report'
    });
  }
};

// Helper function to generate user-based attendance report
const generateUserReport = async (attendanceQuery, start, end) => {
  return await Attendance.aggregate([
    { $match: attendanceQuery },
    {
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'userInfo'
      }
    },
    { $unwind: '$userInfo' },
    {
      $lookup: {
        from: 'divisions',
        localField: 'userInfo.division',
        foreignField: '_id',
        as: 'divisionInfo'
      }
    },
    {
      $lookup: {
        from: 'sections',
        localField: 'userInfo.section',
        foreignField: '_id',
        as: 'sectionInfo'
      }
    },
    {
      $group: {
        _id: '$user',
        employeeInfo: { $first: '$userInfo' },
        divisionInfo: { $first: { $arrayElemAt: ['$divisionInfo', 0] } },
        sectionInfo: { $first: { $arrayElemAt: ['$sectionInfo', 0] } },
        totalDays: { $sum: 1 },
        presentDays: {
          $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] }
        },
        absentDays: {
          $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] }
        },
        lateDays: {
          $sum: { $cond: [{ $gt: ['$lateMinutes', 0] }, 1, 0] }
        },
        totalWorkingHours: { $sum: '$workingHours' },
        totalOvertime: { $sum: '$overtime' },
        totalLateMinutes: { $sum: '$lateMinutes' },
        averageCheckInTime: { $avg: '$checkIn.time' },
        averageCheckOutTime: { $avg: '$checkOut.time' }
      }
    },
    {
      $project: {
        employee: {
          id: '$employeeInfo._id',
          firstName: '$employeeInfo.firstName',
          lastName: '$employeeInfo.lastName',
          employeeId: '$employeeInfo.employeeId',
          email: '$employeeInfo.email'
        },
        division: {
          name: '$divisionInfo.name',
          code: '$divisionInfo.code'
        },
        section: {
          name: '$sectionInfo.name',
          code: '$sectionInfo.code'
        },
        attendance: {
          totalDays: 1,
          presentDays: 1,
          absentDays: 1,
          lateDays: 1,
          attendanceRate: {
            $round: [
              { $multiply: [{ $divide: ['$presentDays', '$totalDays'] }, 100] },
              2
            ]
          }
        },
        workHours: {
          totalWorkingHours: { $round: ['$totalWorkingHours', 2] },
          totalOvertime: { $round: ['$totalOvertime', 2] },
          totalLateMinutes: 1,
          averageWorkingHours: {
            $round: [{ $divide: ['$totalWorkingHours', '$totalDays'] }, 2]
          }
        },
        timing: {
          averageCheckInTime: 1,
          averageCheckOutTime: 1
        }
      }
    },
    { $sort: { 'employee.firstName': 1, 'employee.lastName': 1 } }
  ]);
};

// Helper function to generate division-based attendance report
const generateDivisionReport = async (attendanceQuery, start, end) => {
  return await Attendance.aggregate([
    { $match: attendanceQuery },
    {
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'userInfo'
      }
    },
    { $unwind: '$userInfo' },
    {
      $lookup: {
        from: 'divisions',
        localField: 'userInfo.division',
        foreignField: '_id',
        as: 'divisionInfo'
      }
    },
    { $unwind: '$divisionInfo' },
    {
      $group: {
        _id: '$userInfo.division',
        divisionInfo: { $first: '$divisionInfo' },
        totalRecords: { $sum: 1 },
        uniqueEmployees: { $addToSet: '$user' },
        presentDays: {
          $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] }
        },
        absentDays: {
          $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] }
        },
        lateDays: {
          $sum: { $cond: [{ $gt: ['$lateMinutes', 0] }, 1, 0] }
        },
        totalWorkingHours: { $sum: '$workingHours' },
        totalOvertime: { $sum: '$overtime' }
      }
    },
    {
      $project: {
        division: {
          id: '$divisionInfo._id',
          name: '$divisionInfo.name',
          code: '$divisionInfo.code'
        },
        statistics: {
          totalRecords: 1,
          employeeCount: { $size: '$uniqueEmployees' },
          presentDays: 1,
          absentDays: 1,
          lateDays: 1,
          attendanceRate: {
            $round: [
              { $multiply: [{ $divide: ['$presentDays', '$totalRecords'] }, 100] },
              2
            ]
          },
          totalWorkingHours: { $round: ['$totalWorkingHours', 2] },
          totalOvertime: { $round: ['$totalOvertime', 2] },
          averageWorkingHours: {
            $round: [{ $divide: ['$totalWorkingHours', '$totalRecords'] }, 2]
          }
        }
      }
    },
    { $sort: { 'division.name': 1 } }
  ]);
};

// Helper function to generate date-based attendance report
const generateDateReport = async (attendanceQuery, start, end) => {
  return await Attendance.aggregate([
    { $match: attendanceQuery },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$date' }
        },
        totalRecords: { $sum: 1 },
        uniqueEmployees: { $addToSet: '$user' },
        presentCount: {
          $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] }
        },
        absentCount: {
          $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] }
        },
        lateCount: {
          $sum: { $cond: [{ $gt: ['$lateMinutes', 0] }, 1, 0] }
        },
        totalWorkingHours: { $sum: '$workingHours' },
        totalOvertime: { $sum: '$overtime' }
      }
    },
    {
      $project: {
        date: '$_id',
        statistics: {
          totalRecords: 1,
          employeeCount: { $size: '$uniqueEmployees' },
          presentCount: 1,
          absentCount: 1,
          lateCount: 1,
          attendanceRate: {
            $round: [
              { $multiply: [{ $divide: ['$presentCount', '$totalRecords'] }, 100] },
              2
            ]
          },
          totalWorkingHours: { $round: ['$totalWorkingHours', 2] },
          totalOvertime: { $round: ['$totalOvertime', 2] }
        }
      }
    },
    { $sort: { date: 1 } }
  ]);
};

// Helper function to generate meal user report
// Helper function to generate meal date report
const generateMealDateReport = async (mealQuery, start, end) => {
  return await Meal.find(mealQuery)
    .populate('user', 'firstName lastName employeeId email')
    .sort({ mealTime: -1 })
    .lean();
};

// Helper function to generate meal user report
const generateMealUserReport = async (mealQuery, start, end) => {
  return await Meal.aggregate([
    { $match: mealQuery },
    {
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'userInfo'
      }
    },
    { $unwind: '$userInfo' },
    {
      $group: {
        _id: '$user',
        employeeInfo: { $first: '$userInfo' },
        totalMeals: { $sum: 1 },
        totalAmount: { $sum: '$totalAmount' },
        totalActualAmount: { $sum: '$actualAmount' },
        mealsByType: {
          $push: '$mealType'
        },
        avgRating: { $avg: '$rating.overall' }
      }
    },
    {
      $project: {
        employee: {
          id: '$employeeInfo._id',
          firstName: '$employeeInfo.firstName',
          lastName: '$employeeInfo.lastName',
          employeeId: '$employeeInfo.employeeId'
        },
        mealStats: {
          totalMeals: 1,
          totalAmount: { $round: ['$totalAmount', 2] },
          totalActualAmount: { $round: ['$totalActualAmount', 2] },
          averageAmount: {
            $round: [{ $divide: ['$totalActualAmount', '$totalMeals'] }, 2]
          },
          averageRating: { $round: ['$avgRating', 1] }
        }
      }
    },
    { $sort: { 'employee.firstName': 1 } }
  ]);
};

// Helper function to generate audit action report
const generateAuditActionReport = async (auditQuery, start, end) => {
  return await AuditLog.aggregate([
    { $match: auditQuery },
    {
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'userInfo'
      }
    },
    {
      $group: {
        _id: '$action',
        count: { $sum: 1 },
        users: { $addToSet: '$user' },
        categories: { $addToSet: '$category' },
        severities: { $addToSet: '$severity' },
        securityRelevantCount: {
          $sum: { $cond: ['$isSecurityRelevant', 1, 0] }
        },
        latestOccurrence: { $max: '$createdAt' },
        oldestOccurrence: { $min: '$createdAt' }
      }
    },
    {
      $project: {
        action: '$_id',
        statistics: {
          count: 1,
          uniqueUsers: { $size: '$users' },
          categories: 1,
          severities: 1,
          securityRelevantCount: 1,
          securityRelevantPercentage: {
            $round: [
              { $multiply: [{ $divide: ['$securityRelevantCount', '$count'] }, 100] },
              2
            ]
          },
          latestOccurrence: 1,
          oldestOccurrence: 1
        }
      }
    },
    { $sort: { 'statistics.count': -1 } }
  ]);
};

// Helper function to generate CSV response
const generateCSVResponse = (res, data, filename) => {
  // This is a simplified CSV generation
  // In production, use a proper CSV library like 'fast-csv'
  let csv = '';
  
  if (data.length > 0) {
    // Get headers from first object
    const headers = Object.keys(flattenObject(data[0]));
    csv += headers.join(',') + '\n';
    
    // Add data rows
    data.forEach(row => {
      const flatRow = flattenObject(row);
      const values = headers.map(header => 
        JSON.stringify(flatRow[header] || '')
      );
      csv += values.join(',') + '\n';
    });
  }
  
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}_${Date.now()}.csv"`);
  res.send(csv);
};

// Helper function to generate Excel response
const generateExcelResponse = (res, data, filename) => {
  // This would typically use a library like 'xlsx' or 'exceljs'
  // For now, return JSON with appropriate headers
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}_${Date.now()}.json"`);
  res.json({
    success: true,
    message: 'Excel export not implemented yet. Returning JSON data.',
    data
  });
};

// Helper function to flatten nested objects for CSV
const flattenObject = (obj, prefix = '') => {
  let flattened = {};
  
  for (let key in obj) {
    if (obj[key] !== null && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
      Object.assign(flattened, flattenObject(obj[key], prefix + key + '.'));
    } else {
      flattened[prefix + key] = obj[key];
    }
  }
  
  return flattened;
};

// @desc    Get unit attendance report
// @route   GET /api/reports/unit-attendance
// @access  Private
const getUnitAttendanceReport = async (req, res) => {
  try {
    const { date, division, section } = req.query;
    const targetDate = date ? moment(date) : moment();
    
    const filter = {
      date: {
        $gte: targetDate.startOf('day').toDate(),
        $lte: targetDate.endOf('day').toDate()
      }
    };

    if (division) filter.division = division;
    if (section) filter.section = section;

    const attendanceRecords = await Attendance.find(filter)
      .populate('user', 'firstName lastName employeeId')
      .populate('division', 'name')
      .populate('section', 'name');

    const unitSummary = {
      totalEmployees: attendanceRecords.length,
      present: attendanceRecords.filter(r => r.status === 'present').length,
      absent: attendanceRecords.filter(r => r.status === 'absent').length,
      late: attendanceRecords.filter(r => r.isLate).length
    };

    res.json({
      success: true,
      data: {
        date: targetDate.format('YYYY-MM-DD'),
        summary: unitSummary,
        records: attendanceRecords
      }
    });
  } catch (error) {
    console.error('Unit attendance report error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error generating unit attendance report'
    });
  }
};

// @desc    Get division report
// @route   GET /api/reports/division/:divisionId
// @access  Private
const getDivisionReport = async (req, res) => {
  try {
    const { divisionId } = req.params;
    const { startDate, endDate } = req.query;
    
    const start = startDate ? moment(startDate) : moment().subtract(30, 'days');
    const end = endDate ? moment(endDate) : moment();

    const division = await Division.findById(divisionId);
    if (!division) {
      return res.status(404).json({
        success: false,
        error: 'Division not found'
      });
    }

    const attendanceRecords = await Attendance.find({
      division: divisionId,
      date: { $gte: start.toDate(), $lte: end.toDate() }
    }).populate('user', 'firstName lastName');

    const summary = {
      totalDays: end.diff(start, 'days') + 1,
      totalRecords: attendanceRecords.length,
      averageAttendance: attendanceRecords.filter(r => r.status === 'present').length,
      division: division.name
    };

    res.json({
      success: true,
      data: {
        summary,
        records: attendanceRecords
      }
    });
  } catch (error) {
    console.error('Division report error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error generating division report'
    });
  }
};

// @desc    Get user activity report
// @route   GET /api/reports/user-activity
// @access  Private (administrator and super_admin only)
const getUserActivityReport = async (req, res) => {
  try {
    const { startDate, endDate, userId } = req.query;
    
    const start = startDate ? moment(startDate) : moment().subtract(30, 'days');
    const end = endDate ? moment(endDate) : moment();

    const filter = {
      timestamp: { $gte: start.toDate(), $lte: end.toDate() }
    };

    if (userId) filter.userId = userId;

    const activities = await AuditLog.find(filter)
      .populate('userId', 'firstName lastName')
      .sort({ timestamp: -1 });

    const summary = {
      totalActivities: activities.length,
      uniqueUsers: [...new Set(activities.map(a => a.userId?._id))].length,
      period: `${start.format('YYYY-MM-DD')} to ${end.format('YYYY-MM-DD')}`
    };

    res.json({
      success: true,
      data: {
        summary,
        activities
      }
    });
  } catch (error) {
    console.error('User activity report error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error generating user activity report'
    });
  }
};

// @desc    Export report
// @route   GET /api/reports/export/:reportType
// @access  Private
const exportReport = async (req, res) => {
  try {
    const { reportType } = req.params;
    const { format = 'pdf' } = req.query;

    // This is a simplified implementation
    // In a real application, you would generate actual PDF/Excel files
    const reportData = {
      type: reportType,
      format: format,
      generatedAt: new Date(),
      message: `${reportType} report in ${format} format would be generated here`
    };

    res.json({
      success: true,
      data: reportData,
      message: 'Report export initiated'
    });
  } catch (error) {
    console.error('Export report error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error exporting report'
    });
  }
};

// @desc    Get report summary
// @route   GET /api/reports/summary
// @access  Private
const getReportSummary = async (req, res) => {
  try {
    const { period = 'monthly', date } = req.query;
    const targetDate = date ? moment(date) : moment();

    let start, end;
    switch (period) {
      case 'daily':
        start = targetDate.clone().startOf('day');
        end = targetDate.clone().endOf('day');
        break;
      case 'weekly':
        start = targetDate.clone().startOf('week');
        end = targetDate.clone().endOf('week');
        break;
      case 'monthly':
        start = targetDate.clone().startOf('month');
        end = targetDate.clone().endOf('month');
        break;
      case 'yearly':
        start = targetDate.clone().startOf('year');
        end = targetDate.clone().endOf('year');
        break;
      default:
        start = targetDate.clone().startOf('month');
        end = targetDate.clone().endOf('month');
    }

    const attendanceCount = await Attendance.countDocuments({
      date: { $gte: start.toDate(), $lte: end.toDate() }
    });

    const mealCount = await Meal.countDocuments({
      date: { $gte: start.toDate(), $lte: end.toDate() }
    });

    const userCount = await User.countDocuments({
      createdAt: { $gte: start.toDate(), $lte: end.toDate() }
    });

    res.json({
      success: true,
      data: {
        period,
        dateRange: `${start.format('YYYY-MM-DD')} to ${end.format('YYYY-MM-DD')}`,
        summary: {
          attendance: attendanceCount,
          meals: mealCount,
          users: userCount
        }
      }
    });
  } catch (error) {
    console.error('Report summary error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error generating report summary'
    });
  }
};

// @desc    Generate custom report
// @route   POST /api/reports/custom
// @access  Private (administrator and super_admin only)
const getCustomReport = async (req, res) => {
  try {
    const { reportType, criteria, startDate, endDate } = req.body;
    
    const start = moment(startDate);
    const end = moment(endDate);

    // This is a simplified implementation
    // In a real application, you would build dynamic queries based on criteria
    const customData = {
      reportType,
      criteria,
      period: `${start.format('YYYY-MM-DD')} to ${end.format('YYYY-MM-DD')}`,
      generatedAt: new Date(),
      message: 'Custom report would be generated based on the provided criteria'
    };

    res.json({
      success: true,
      data: customData,
      message: 'Custom report generated successfully'
    });
  } catch (error) {
    console.error('Custom report error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error generating custom report'
    });
  }
};

// @desc    Generate MySQL-based attendance report (individual/group)
// @route   POST /api/reports/mysql/attendance
// @access  Private
const generateMySQLAttendanceReport = async (req, res) => {
  try {
    const {
      report_type = 'individual',
      employee_id = '',
      division_id = '',
      section_id = '',
      sub_section_id = '',
      from_date,
      to_date
    } = req.body;

    console.log('=== ATTENDANCE REPORT REQUEST ===');
    console.log('Report type:', report_type);
    console.log('Request body:', JSON.stringify(req.body, null, 2));

    // Validate required fields
    if (!from_date || !to_date) {
      return res.status(400).json({
        success: false,
        message: 'Date range is required'
      });
    }

    // Validate employee ID for individual reports
    if (report_type === 'individual' && !employee_id) {
      return res.status(400).json({
        success: false,
        message: 'Employee ID is required for individual reports'
      });
    }

    const hrisApiService = require('../services/hrisApiService');
    
    // Handle group reports differently to match the required format
    if (report_type === 'group') {
      console.log('Calling generateMySQLGroupAttendanceReport...');
      const groupReportData = await generateMySQLGroupAttendanceReport(from_date, to_date, division_id, section_id, sub_section_id);
      
      console.log(`Group report generated: ${groupReportData.employees.length} employees`);
      
      return res.status(200).json({
        success: true,
        data: groupReportData.employees, // Extract employees array
        summary: groupReportData.summary,
        dates: groupReportData.dates,
        reportType: 'group',
        message: 'Group attendance report generated successfully'
      });
    }

    // For individual reports: Get attendance from MySQL, employee data from HRIS
    const connection = await createMySQLConnection();
    
    // Get attendance records from MySQL (only attendance table, no joins)
    const sql = `SELECT 
              a.attendance_id,
              a.employee_ID,
              a.fingerprint_id,
              a.date_,
              a.time_,
              a.scan_type
             FROM attendance a
             WHERE a.date_ BETWEEN ? AND ? AND a.employee_ID = ?
             ORDER BY a.date_ ASC, a.time_ ASC`;
    
    const params = [from_date, to_date, employee_id];
    const [attendance_data] = await connection.execute(sql, params);
    await connection.end();

    if (attendance_data.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No employee found for the entered ID in the selected division/section.',
        data: [],
        employee_info: null
      });
    }

    // Fetch employee details from HRIS API
    console.log(`Fetching employee ${employee_id} details from HRIS API...`);
    let employeeInfo = null;
    try {
      const allEmployees = await hrisApiService.readData('hr_employee_v', {}, '', false);
      const employee = allEmployees.find(emp => {
        const empId = String(emp.emp_no || emp.employee_no || emp.employee_ID || '');
        return empId === String(employee_id);
      });

      if (employee) {
        employeeInfo = {
          employee_ID: String(employee.emp_no || employee.employee_no || employee.employee_ID || ''),
          employee_id: String(employee.emp_no || employee.employee_no || employee.employee_ID || ''),
          employee_name: employee.employee_name || employee.employeeName || 
                        (employee.first_name ? `${employee.first_name} ${employee.last_name || ''}`.trim() : 
                         employee.name || employee.full_name || 'Unknown'),
          name: employee.employee_name || employee.employeeName || 
                (employee.first_name ? `${employee.first_name} ${employee.last_name || ''}`.trim() : 
                 employee.name || employee.full_name || 'Unknown'),
          division_name: employee.division_name || employee.division || employee.division_code || '',
          section_name: employee.section_name || employee.section || employee.section_code || ''
        };
      }
    } catch (error) {
      console.error('Error fetching employee from HRIS:', error);
    }

    // Merge employee info into attendance records
    const enrichedData = attendance_data.map(record => ({
      ...record,
      employee_name: employeeInfo?.employee_name || 'Unknown',
      division_name: employeeInfo?.division_name || '',
      section_name: employeeInfo?.section_name || ''
    }));

    // Calculate summary statistics
    const summary = {
      total_records: enrichedData.length,
      unique_employees: 1,
      in_scans: enrichedData.filter(record => 
        record.scan_type && record.scan_type.toUpperCase() === 'IN'
      ).length,
      out_scans: enrichedData.filter(record => 
        record.scan_type && record.scan_type.toUpperCase() === 'OUT'
      ).length,
      date_range: {
        from: from_date,
        to: to_date
      }
    };

    // Prepare query parameters for export
    const query_params = {
      report_type,
      employee_id,
      division_id,
      section_id,
      from_date,
      to_date
    };

    // Return response
    res.status(200).json({
      success: true,
      data: enrichedData,
      employee_info: employeeInfo,
      summary,
      query_params,
      message: 'Report generated successfully'
    });

  } catch (error) {
    console.error('MySQL Attendance Report Error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while generating the report: ' + error.message
    });
  }
};

// @desc    Generate MySQL-based meal report
// @route   POST /api/reports/mysql/meal
// @access  Private
const generateMySQLMealReport = async (req, res) => {
  try {
    console.log('=== MEAL REPORT REQUEST ===');
    console.log('Request body:', req.body);

    const {
      from_date,
      to_date,
      division_id = '',
      section_id = '',
      sub_section_id = ''
    } = req.body;

    // Validate required fields
    if (!from_date || !to_date) {
      return res.status(400).json({
        success: false,
        message: 'Date range is required'
      });
    }

    console.log(`\n📊 MEAL REPORT GENERATION STARTED (GROUP SCOPE ONLY)`);
    console.log(`Date range: ${from_date} to ${to_date}`);
    console.log(`Division filter: ${division_id || 'All'}`);
    console.log(`Section filter: ${section_id || 'All'}`);
    console.log(`Sub Section filter: ${sub_section_id || 'All'}`);

    // Create MySQL connection
    const connection = await createMySQLConnection();
    console.log('✅ MySQL Connected successfully');

    // Build meal report query from attendance table
    // The MEAL-PKT-MNY column contains: 'I' or '1' for meal packet, 'mny' for meal money
    // Must use backticks with proper escaping for column name with hyphens
    let sql = `SELECT 
                employee_ID,
                date_,
                \`MEAL-PKT-MNY\` as meal_indicator
               FROM attendance 
               WHERE date_ BETWEEN ? AND ?
               AND \`MEAL-PKT-MNY\` IS NOT NULL 
               AND \`MEAL-PKT-MNY\` != ''`;
    
    let params = [from_date, to_date];

    // Add ordering
    sql += ` ORDER BY date_ DESC, employee_ID ASC`;

    console.log('Executing meal query from attendance table...');
    console.log('SQL:', sql);
    const [mealRecords] = await connection.execute(sql, params);
    console.log(`Found ${mealRecords.length} meal records`);

    if (mealRecords.length === 0) {
      await connection.end();
      return res.status(200).json({
        success: true,
        data: [],
        summary: {
          totalMealPacketEmployees: 0,
          totalMealMoneyEmployees: 0,
          totalBothTypesEmployees: 0,
          totalEmployees: 0,
          totalMealRecords: 0,
          dateRange: { from: from_date, to: to_date },
          filters: {
            division: division_id || 'All',
            section: section_id || 'All',
            subSection: sub_section_id || 'All'
          }
        },
        message: 'No meal records found for the specified date range'
      });
    }

    // Get unique employee IDs who have meal records
    const distinctEmployeeIds = [...new Set(mealRecords.map(r => String(r.employee_ID)))];
    console.log(`Distinct employees with meals: ${distinctEmployeeIds.length}`);

    // Fetch employee details from HRIS
    const hrisApiService = require('../services/hrisApiService');
    let allEmployees = hrisApiService.getCachedEmployees();
    
    if (!allEmployees || allEmployees.length === 0) {
      console.log('⚠️ Employee cache miss - fetching from HRIS...');
      if (!hrisApiService.isCacheInitialized()) {
        await hrisApiService.initializeCache();
      }
      allEmployees = hrisApiService.getCachedEmployees();
      if (!allEmployees || allEmployees.length === 0) {
        allEmployees = await hrisApiService.getCachedOrFetch('employee', {});
      }
    }
    
    console.log(`Fetched ${allEmployees.length} employees from HRIS`);

    // Filter employees by division/section if provided
    let filteredEmployees = allEmployees;

    if (sub_section_id && sub_section_id !== 'all') {
      console.log(`🔍 Filtering by sub section: "${sub_section_id}"`);
      try {
        const [transferredRows] = await connection.execute(
          'SELECT employee_id FROM subsection_transfers WHERE sub_section_id = ?',
          [String(sub_section_id)]
        );
        const transferredEmployeeIds = transferredRows.map(row => String(row.employee_id));
        console.log(`Found ${transferredEmployeeIds.length} transferred employees`);
        
        if (transferredEmployeeIds.length > 0) {
          filteredEmployees = filteredEmployees.filter(emp => {
            const empId = String(emp.EMP_NUMBER || emp.emp_no || emp.employee_no || '');
            return transferredEmployeeIds.includes(empId);
          });
        }
      } catch (err) {
        console.error('Error fetching subsection transfers:', err);
      }
    } else if (section_id && section_id !== 'all') {
      console.log(`🔍 Filtering by section: "${section_id}"`);
      filteredEmployees = filteredEmployees.filter(emp => {
        const empSectionName = (emp.currentwork?.HIE_NAME_4 || '').trim();
        const filterSectionName = String(section_id).trim();
        return empSectionName.toLowerCase() === filterSectionName.toLowerCase() ||
               empSectionName.toLowerCase().includes(filterSectionName.toLowerCase());
      });
      console.log(`✅ Found ${filteredEmployees.length} employees in section`);
    } else if (division_id && division_id !== 'all') {
      console.log(`🔍 Filtering by division: "${division_id}"`);
      filteredEmployees = filteredEmployees.filter(emp => {
        const empDivisionName = (emp.currentwork?.HIE_NAME_3 || '').trim();
        const empDivisionCode = String(emp.currentwork?.HIE_CODE_4 || '').trim();
        const filterDivisionName = String(division_id).trim().toLowerCase();

        const divExactMatch = empDivisionName.toLowerCase() === filterDivisionName || empDivisionCode.toLowerCase() === filterDivisionName;
        const divContainsMatch = empDivisionName.toLowerCase().includes(filterDivisionName) || empDivisionCode.toLowerCase().includes(filterDivisionName) ||
                                filterDivisionName.includes(empDivisionName.toLowerCase()) || filterDivisionName.includes(empDivisionCode.toLowerCase());

        return divExactMatch || divContainsMatch;
      });
      console.log(`✅ Found ${filteredEmployees.length} employees in division`);
    }

    // Match meal records with filtered employees
    const employeeMap = new Map();
    filteredEmployees.forEach(emp => {
      const empId = String(emp.EMP_NUMBER || emp.emp_no || emp.employee_no || '');
      employeeMap.set(empId, {
        employee_ID: empId,
        employee_name: emp.FULLNAME || emp.DISPLAY_NAME || 'Unknown',
        division_name: emp.currentwork?.HIE_NAME_3 || '',
        section_name: emp.currentwork?.HIE_NAME_4 || ''
      });
    });

    // Process meal records and count employees professionally
    // Track each employee's meal type across all dates
    const employeeMealTypes = new Map(); // employee_ID -> { hasMealPacket: boolean, hasMealMoney: boolean }
    const mealIndicatorSamples = new Set(); // Track unique meal indicators for debugging

    mealRecords.forEach(record => {
      const empId = String(record.employee_ID);
      const employeeInfo = employeeMap.get(empId);

      // Skip if employee not in filtered list (when filters are applied)
      if ((division_id || section_id || sub_section_id) && !employeeInfo) {
        return;
      }

      // Parse meal indicator from attendance table MEAL-PKT-MNY column
      // Values: 'I' or '1' = meal packet, 'mny' = meal money
      const mealIndicator = String(record.meal_indicator || '').trim().toLowerCase();
      mealIndicatorSamples.add(mealIndicator); // Collect samples for logging
      
      const isMealPacket = mealIndicator === 'i' || mealIndicator === '1';
      const isMealMoney = mealIndicator === 'mny' || mealIndicator.includes('mny');

      // Initialize employee meal tracking if not exists
      if (!employeeMealTypes.has(empId)) {
        employeeMealTypes.set(empId, {
          hasMealPacket: false,
          hasMealMoney: false
        });
      }

      // Update employee's meal type flags
      const mealData = employeeMealTypes.get(empId);
      if (isMealPacket) {
        mealData.hasMealPacket = true;
      }
      if (isMealMoney) {
        mealData.hasMealMoney = true;
      }
    });

    // Count employees by meal type
    let mealPacketCount = 0;
    let mealMoneyCount = 0;
    let bothTypesCount = 0;

    employeeMealTypes.forEach((mealData, empId) => {
      if (mealData.hasMealPacket && mealData.hasMealMoney) {
        bothTypesCount++;
      } else if (mealData.hasMealPacket) {
        mealPacketCount++;
      } else if (mealData.hasMealMoney) {
        mealMoneyCount++;
      }
    });

    // Calculate summary counts
    const summary = {
      totalMealPacketEmployees: mealPacketCount,
      totalMealMoneyEmployees: mealMoneyCount,
      totalBothTypesEmployees: bothTypesCount,
      totalEmployees: employeeMealTypes.size,
      totalMealRecords: mealRecords.length,
      dateRange: {
        from: from_date,
        to: to_date
      },
      filters: {
        division: division_id || 'All',
        section: section_id || 'All',
        subSection: sub_section_id || 'All'
      }
    };

    console.log(`\n📊 MEAL REPORT SUMMARY (PROFESSIONAL COUNT):`);
    console.log(`   Meal indicators found: [${Array.from(mealIndicatorSamples).join(', ')}]`);
    console.log(`   Employees with ONLY Meal Packets: ${summary.totalMealPacketEmployees}`);
    console.log(`   Employees with ONLY Meal Money: ${summary.totalMealMoneyEmployees}`);
    console.log(`   Employees with BOTH Types: ${summary.totalBothTypesEmployees}`);
    console.log(`   Total Unique Employees: ${summary.totalEmployees}`);
    console.log(`   Total Meal Records: ${summary.totalMealRecords}`);

    await connection.end();

    res.status(200).json({
      success: true,
      data: [],
      summary,
      message: 'Meal report generated successfully'
    });

  } catch (error) {
    console.error('MySQL Meal Report Error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while generating the meal report: ' + error.message
    });
  }
};

// Helper function to generate group attendance report (tabular format)
const generateGroupAttendanceReport = async (attendanceQuery, start, end, userFilter) => {
  try {
    // Get all users in the specified division/section
    const users = await User.find(userFilter)
      .populate('division', 'name code')
      .populate('section', 'name code')
      .select('firstName lastName employeeId division section')
      .sort({ employeeId: 1 });

    if (users.length === 0) {
      return [];
    }

    // Generate date range
    const dateRange = [];
    const currentDate = moment(start);
    while (currentDate.isSameOrBefore(end)) {
      dateRange.push(currentDate.format('YYYY-MM-DD'));
      currentDate.add(1, 'day');
    }

    // Get all attendance records for the period
    const attendanceRecords = await Attendance.find(attendanceQuery)
      .populate('user', 'employeeId firstName lastName')
      .select('user date checkIn checkOut status workingHours overtime')
      .sort({ date: 1 });

    // Create attendance map for quick lookup and normalize multiple records per day
    const attendanceMap = {};
    attendanceRecords.forEach(record => {
      if (!record.user) return;
      const dateKey = moment(record.date).format('YYYY-MM-DD');
      const userKey = record.user._id.toString();
      attendanceMap[userKey] = attendanceMap[userKey] || {};
      attendanceMap[userKey][dateKey] = attendanceMap[userKey][dateKey] || {
        checkIns: [],
        checkOuts: [],
        punches: [],
        statuses: [],
        workingHours: 0,
        overtime: 0
      };

      // Normalize checkIn/checkOut values (could be nested objects)
      const normalizeTime = (field) => {
        if (!field) return null;
        // If DB stored raw string keys like time or time_, prefer returning that raw string
        if (typeof field === 'object') {
          if (field.time_) return field.time_;
          if (field.time) return field.time;
        }
        // If it's a Date instance, format to HH:mm:ss
        if (field instanceof Date) return moment(field).format('HH:mm:ss');
        // If it's already a string that looks like a time, return as-is
        if (typeof field === 'string') {
          if (/^\d{1,2}:\d{2}:\d{2}$/.test(field) || /^\d{1,2}:\d{2}$/.test(field)) return field;
          // Try parsing ISO and return time portion
          const parsed = moment(field);
          if (parsed.isValid()) return parsed.format('HH:mm:ss');
        }
        return null;
      };

      const ckIn = normalizeTime(record.checkIn);
      const ckOut = normalizeTime(record.checkOut);
      if (ckIn) {
        attendanceMap[userKey][dateKey].checkIns.push(ckIn);
        attendanceMap[userKey][dateKey].punches.push({ time: ckIn, type: 'IN' });
      }
      if (ckOut) {
        attendanceMap[userKey][dateKey].checkOuts.push(ckOut);
        attendanceMap[userKey][dateKey].punches.push({ time: ckOut, type: 'OUT' });
      }
      if (record.status) attendanceMap[userKey][dateKey].statuses.push(record.status);
      attendanceMap[userKey][dateKey].workingHours += Number(record.workingHours || 0);
      attendanceMap[userKey][dateKey].overtime += Number(record.overtime || 0);
    });

    // Generate report data in tabular format
    const reportData = users.map(user => {
      const userAttendance = {
        employeeId: user.employeeId,
        employeeName: `${user.firstName} ${user.lastName}`,
        division: user.division?.name || 'N/A',
        section: user.section?.name || 'N/A',
        dailyAttendance: {}
      };

      // Add daily attendance data
      dateRange.forEach(date => {
        const userKey = user._id.toString();
        const attendanceRecord = attendanceMap[userKey] && attendanceMap[userKey][date];

        if (attendanceRecord) {
          // Build punches list sorted by time and a display string with all punch times
          const punches = (attendanceRecord.punches || []).slice().sort((a, b) => {
            if (!a.time) return -1;
            if (!b.time) return 1;
            return a.time.localeCompare(b.time);
          });

          const timesDisplay = punches.length > 0 ? punches.map(p => p.time).join('\n') : '';

          // Determine earliest checkIn and latest checkOut for backward-compatible fields
          const earliestIn = (attendanceRecord.checkIns || []).slice().sort()[0] || null;
          const latestOut = (attendanceRecord.checkOuts || []).slice().sort().reverse()[0] || null;

          const checkInMoment = earliestIn ? moment(earliestIn, 'HH:mm:ss') : null;
          const checkOutMoment = latestOut ? moment(latestOut, 'HH:mm:ss') : null;

          const workingHours = (checkInMoment && checkOutMoment && checkInMoment.isValid() && checkOutMoment.isValid())
            ? Number(checkOutMoment.diff(checkInMoment, 'hours', true).toFixed(2))
            : Number(attendanceRecord.workingHours || 0);

          // Prefer 'present' status if any of recorded statuses include it
          const status = (attendanceRecord.statuses || []).includes('present') ? 'present' : (attendanceRecord.statuses[0] || 'present');

          userAttendance.dailyAttendance[date] = {
            status,
            punches,
            timesDisplay,
            checkIn: checkInMoment ? checkInMoment.format('HH:mm:ss') : '',
            checkOut: checkOutMoment ? checkOutMoment.format('HH:mm:ss') : '',
            workingHours,
            overtime: Number(attendanceRecord.overtime || 0)
          };
        } else {
          userAttendance.dailyAttendance[date] = {
            status: 'absent',
            checkIn: '',
            checkOut: '',
            workingHours: 0,
            overtime: 0
          };
        }
      });

      return userAttendance;
    });

    return {
      reportType: 'group',
      dateRange: {
        from: start.format('YYYY-MM-DD'),
        to: end.format('YYYY-MM-DD')
      },
      dates: dateRange,
      employees: reportData,
      summary: {
        totalEmployees: users.length,
        totalDays: dateRange.length,
        divisionInfo: users[0]?.division || null,
        sectionInfo: users[0]?.section || null
      }
    };

  } catch (error) {
    console.error('Error generating group attendance report:', error);
    throw error;
  }
};

// Helper function to map MongoDB division ID to MySQL division ID
const mapMongoToMySQLDivisionId = async (divisionId) => {
  // Check if this is a MongoDB ObjectId (24 character hex string)
  const isMongoId = divisionId && divisionId.length === 24 && /^[0-9a-fA-F]{24}$/.test(divisionId);
  
  if (!isMongoId) {
    // Already a MySQL ID or invalid
    return divisionId;
  }

  try {
    console.log(`Mapping MongoDB division ID ${divisionId} to MySQL ID...`);
    
    // Get the division name from MongoDB
    const Division = require('../models/Division');
    const mongoDiv = await Division.findById(divisionId);
    
    if (!mongoDiv) {
      console.log('MongoDB division not found');
      return null;
    }

    console.log(`MongoDB division name: ${mongoDiv.name}`);

    // Find the corresponding MySQL division by name
    const connection = await createMySQLConnection();
    
    // Map common name variations
    let searchName = mongoDiv.name.trim().toUpperCase();
    if (searchName === 'INFORMATION SYSTEM') {
      searchName = 'INFORMATION SYSTEMS';
    }
    
    const [mysqlDivisions] = await connection.execute(`
      SELECT division_id, division_name 
      FROM divisions 
      WHERE UPPER(division_name) = ? OR UPPER(division_name) LIKE ?
      LIMIT 1
    `, [searchName, `%${searchName}%`]);

    await connection.end();

    if (mysqlDivisions.length === 0) {
      console.log(`No MySQL division found for name: ${searchName}`);
      return null;
    }

    const mysqlId = mysqlDivisions[0].division_id.toString();
    console.log(`Mapped to MySQL division ID: ${mysqlId}`);
    return mysqlId;
    
  } catch (error) {
    console.error('Error mapping division ID:', error);
    return null;
  }
};

// Helper function to generate MySQL-based group attendance report (tabular format)
const generateMySQLGroupAttendanceReport = async (from_date, to_date, division_id, section_id, sub_section_id = '') => {
  try {
    console.log('=== GROUP ATTENDANCE REPORT GENERATION STARTED ===');
    console.log(`Date range: ${from_date} to ${to_date}`);
    console.log(`Division filter: ${division_id || 'none'}`);
    console.log(`Section filter: ${section_id || 'none'}`);
    console.log(`Sub Section filter: ${sub_section_id || 'none'}`);
    
    const hrisApiService = require('../services/hrisApiService');
    
    // Create MySQL connection
    const connection = await createMySQLConnection();

    // Get distinct employee IDs from attendance for the date range
    let distinctEmployeeSql = `
      SELECT DISTINCT employee_ID
      FROM attendance
      WHERE date_ BETWEEN ? AND ?
      ORDER BY employee_ID ASC
    `;

    const [attendanceEmployees] = await connection.execute(distinctEmployeeSql, [from_date, to_date]);
    
    console.log(`Found ${attendanceEmployees.length} employees with attendance in date range`);
    
    if (attendanceEmployees.length === 0) {
      await connection.end();
      console.log('No attendance records found for the date range');
      return {
        reportType: 'group',
        dateRange: { from: from_date, to: to_date },
        dates: [],
        employees: [],
        summary: { totalEmployees: 0, totalDays: 0 }
      };
    }

    // Get employee IDs from attendance
    const distinctEmployeeIds = attendanceEmployees.map(emp => emp.employee_ID);
    console.log(`Distinct employee IDs from attendance:`, distinctEmployeeIds.slice(0, 5), '...'); // Show first 5
    
    // Fetch employee details from HRIS API
    console.log('Fetching employee details from HRIS API...');
    let allEmployees = [];
    try {
      console.log('Calling HRIS API for employees...');
      // Use getCachedOrFetch to get employees from cache or API
      const hrisResult = await hrisApiService.getCachedOrFetch('employee', {}, '', false);
      console.log('HRIS API raw result type:', typeof hrisResult);
      console.log('HRIS API raw result is array?', Array.isArray(hrisResult));
      console.log('HRIS API raw result length:', hrisResult ? hrisResult.length : 'null/undefined');
      
      allEmployees = hrisResult || [];
      console.log(`Fetched ${allEmployees.length} employees from HRIS API`);
      
      // Debug: Show sample employee structure
      if (allEmployees.length > 0) {
        console.log('Sample HRIS employee (full):', JSON.stringify(allEmployees[0], null, 2));
      }
    } catch (error) {
      console.error('Error fetching employees from HRIS:', error.message);
      if (error.response) {
        console.error('HRIS API error response:', error.response.data);
      }
      allEmployees = [];
    }
    
    // Step 1: Filter HRIS employees by division/section FIRST (before checking attendance)
    let filteredByDivisionSection = allEmployees;
    
    console.log(`\n🎯 FILTERING HRIS EMPLOYEES:`);
    console.log(`   Total HRIS employees: ${allEmployees.length}`);
    console.log(`   Division filter: "${division_id || 'none'}"`);
    console.log(`   Section filter: "${section_id || 'none'}"`);
    
    if (section_id) {
      // Filter by section name from HRIS  
      console.log(`\n🔍 Filtering by SECTION: "${section_id}"`);
      
      // Show unique section names in HRIS for debugging
      const uniqueSections = [...new Set(allEmployees.map(e => e.currentwork?.HIE_NAME_3).filter(Boolean))];
      console.log(`   📋 Available HRIS section names (${uniqueSections.length}):`, uniqueSections.sort().slice(0, 20));
      
      filteredByDivisionSection = filteredByDivisionSection.filter(emp => {
        const empSectionName = (emp.currentwork?.HIE_NAME_3 || '').trim();
        const filterSectionName = String(section_id).trim();
        
        // Try exact match first, then contains match
        const exactMatch = empSectionName.toLowerCase() === filterSectionName.toLowerCase();
        const containsMatch = empSectionName.toLowerCase().includes(filterSectionName.toLowerCase()) ||
                             filterSectionName.toLowerCase().includes(empSectionName.toLowerCase());
        
        return exactMatch || containsMatch;
      });
      console.log(`   ✅ Found ${filteredByDivisionSection.length} HRIS employees in section "${section_id}"`);
      
      if (filteredByDivisionSection.length > 0) {
        console.log(`   Sample employees:`, filteredByDivisionSection.slice(0, 3).map(e => ({
          id: e.EMP_NUMBER,
          name: e.FULLNAME,
          section: e.currentwork?.HIE_NAME_3
        })));
      } else {
        console.log(`   ⚠️  No match! Your filter "${section_id}" doesn't match any HRIS section names`);
        console.log(`   💡 Try using one of the available HRIS section names listed above`);
      }
    } else if (division_id) {
      // Filter by division name from HRIS - ONLY check division names, not sections
      console.log(`\n🔍 Filtering by DIVISION: "${division_id}"`);
      
      // Show unique division names for debugging
      const uniqueDivisions = [...new Set(allEmployees.map(e => e.currentwork?.HIE_NAME_3).filter(Boolean))];
      console.log(`   📋 Available HRIS division names (${uniqueDivisions.length}):`, uniqueDivisions.sort().slice(0, 10));
      
      filteredByDivisionSection = filteredByDivisionSection.filter(emp => {
        const empDivisionName = (emp.currentwork?.HIE_NAME_3 || '').trim();
        const empDivisionCode = String(emp.currentwork?.HIE_CODE_4 || '').trim();
        const filterName = String(division_id).trim().toLowerCase();
        
        // Check if filter matches division (HIE_NAME_3 or HIE_CODE_4) - exact match or contains
        const divExactMatch = empDivisionName.toLowerCase() === filterName || empDivisionCode.toLowerCase() === filterName;
        const divContainsMatch = empDivisionName.toLowerCase().includes(filterName) || empDivisionCode.toLowerCase().includes(filterName) ||
                                filterName.includes(empDivisionName.toLowerCase()) || filterName.includes(empDivisionCode.toLowerCase());
        
        return divExactMatch || divContainsMatch;
      });
      console.log(`   ✅ Found ${filteredByDivisionSection.length} HRIS employees in division "${division_id}"`);
      
      if (filteredByDivisionSection.length > 0) {
        console.log(`   Sample employees:`, filteredByDivisionSection.slice(0, 3).map(e => ({
          id: e.EMP_NUMBER,
          name: e.FULLNAME,
          division: e.currentwork?.HIE_NAME_3,
          section: e.currentwork?.HIE_NAME_4
        })));
      } else {
        console.log(`   ⚠️  No match! Your filter "${division_id}" doesn't match any HRIS division names`);
        console.log(`   💡 Try using one of the available division names listed above`);
      }
    } else {
      console.log(`   ℹ️  No division/section filter applied - using all employees`);
    }
    
    // Step 1.5: If sub section is selected, filter by transferred employees
    let transferredEmployeeIds = [];
    if (sub_section_id) {
      console.log(`\n🔄 FILTERING BY SUB SECTION TRANSFERS:`);
      console.log(`   Sub Section ID: "${sub_section_id}"`);
      
      try {
        // Get transferred employees for this sub section from MySQL
        const [transferredRows] = await connection.execute(
          'SELECT employee_id FROM subsection_transfers WHERE sub_section_id = ?',
          [String(sub_section_id)]
        );
        
        transferredEmployeeIds = transferredRows.map(row => String(row.employee_id));
        console.log(`   ✅ Found ${transferredEmployeeIds.length} transferred employees in sub section`);
        
        if (transferredEmployeeIds.length > 0) {
          console.log(`   Sample transferred IDs:`, transferredEmployeeIds.slice(0, 5));
          
          // Filter HRIS employees to only include transferred employees
          filteredByDivisionSection = filteredByDivisionSection.filter(emp => {
            const empId = String(emp.EMP_NUMBER || emp.emp_no || emp.employee_no || emp.employee_ID || emp.empNo || emp.id);
            return transferredEmployeeIds.includes(empId);
          });
          
          console.log(`   ✅ After transfer filter: ${filteredByDivisionSection.length} HRIS employees`);
        } else {
          console.log(`   ⚠️  No transferred employees found for this sub section`);
          // If no transfers found, return empty result
          await connection.end();
          return {
            reportType: 'group',
            dateRange: { from: from_date, to: to_date },
            dates: [],
            employees: [],
            summary: { totalEmployees: 0, totalDays: 0 }
          };
        }
      } catch (err) {
        console.error('   ❌ Error fetching transferred employees:', err);
        // Continue without sub section filter
      }
    }
    
    // Step 2: From filtered employees, keep only those who have attendance records
    console.log(`\n🔗 MATCHING WITH ATTENDANCE RECORDS:`);
    console.log(`   Filtered HRIS employees: ${filteredByDivisionSection.length}`);
    console.log(`   Employees with attendance: ${distinctEmployeeIds.length}`);
    
    let employees = filteredByDivisionSection.filter(emp => {
      const empId = emp.EMP_NUMBER || emp.emp_no || emp.employee_no || emp.employee_ID || emp.empNo || emp.id;
      if (!empId) return false;
      
      const empIdStr = String(empId);
      const empIdNum = parseInt(empId);
      
      // Check if this employee ID exists in attendance records
      const hasAttendance = distinctEmployeeIds.some(attId => {
        const attIdStr = String(attId);
        const attIdNum = parseInt(attId);
        return attIdStr === empIdStr || attIdNum === empIdNum;
      });
      
      return hasAttendance;
    });
    
    console.log(`   ✅ Final matched employees: ${employees.length}\n`);
    
    // Debug: Show samples
    if (employees.length > 0) {
      console.log('Sample matched employees:', employees.slice(0, 3).map(e => ({
        hris_id: e.EMP_NUMBER,
        name: e.FULLNAME,
        division: e.currentwork?.HIE_NAME_3,
        section: e.currentwork?.HIE_NAME_4
      })));
    } else if (allEmployees.length > 0 && distinctEmployeeIds.length > 0) {
      console.log('⚠️ No employees matched! Checking filters...');
      console.log('Division filter:', division_id);
      console.log('Section filter:', section_id);
      
      // Show unique section names from employees with attendance
      const employeesWithAttendance = allEmployees.filter(emp => {
        const empId = emp.EMP_NUMBER || emp.emp_no;
        return distinctEmployeeIds.some(attId => String(attId) === String(empId));
      });
      
      const uniqueSections = [...new Set(employeesWithAttendance.map(e => e.currentwork?.HIE_NAME_4 || 'No Section'))];
      console.log(`📊 Unique sections from ${employeesWithAttendance.length} employees with attendance:`, uniqueSections.slice(0, 20));
      
      console.log('Sample HRIS employee division/section:', allEmployees.slice(0, 3).map(e => ({
        id: e.EMP_NUMBER,
        HIE_CODE_4: e.HIE_CODE_4,
        division_name: e.currentwork?.HIE_NAME_3,
        HIE_CODE_3: e.HIE_CODE_3,
        section_name: e.currentwork?.HIE_NAME_4
      })));

    }
    
    console.log(`Processing report for ${employees.length} employees (with division/section filtering applied)`);

    // If no employees matched, return empty result
    if (employees.length === 0) {
      await connection.end();
      console.log('⚠️ No employees matched from HRIS. Cannot generate report.');
      return {
        reportType: 'group',
        dateRange: { from: from_date, to: to_date },
        dates: [],
        data: [],
        employees: [],
        summary: { totalEmployees: 0, totalDays: 0 }
      };
    }

    // Normalize HRIS employee fields to expected shape for report generation
    employees = employees.map(emp => {
      const id = String(emp.EMP_NUMBER || emp.emp_no || emp.employee_no || emp.employee_ID || '');
      const name = emp.FULLNAME || emp.DISPLAY_NAME || emp.CALLING_NAME || emp.employee_name || 'Unknown';
      const divisionName = emp.currentwork?.HIE_NAME_3 || emp.division_name || '';
      const sectionName = emp.currentwork?.HIE_NAME_4 || emp.section_name || '';
      return {
        ...emp,
        employee_ID: id,
        employee_name: name,
        division_name: divisionName,
        section_name: sectionName
      };
    });

    // Generate date range
    const dateRange = [];
    const startDate = moment(from_date);
    const endDate = moment(to_date);
    const currentDate = startDate.clone();
    
    while (currentDate.isSameOrBefore(endDate)) {
      dateRange.push(currentDate.format('YYYY-MM-DD'));
      currentDate.add(1, 'day');
    }

    // Get all attendance records for the period and employees
    const employeeIds = employees.map(emp => emp.employee_ID);
    const placeholders = employeeIds.map(() => '?').join(',');

    const recordsSql = `
      SELECT employee_ID, date_, time_, scan_type
      FROM attendance
      WHERE date_ BETWEEN ? AND ?
      AND employee_ID IN (${placeholders})
      ORDER BY date_ ASC, time_ ASC
    `;

    const attendanceParams = [from_date, to_date, ...employeeIds];
    const [attendanceRecords] = await connection.execute(recordsSql, attendanceParams);

    // Create attendance map for quick lookup
    const attendanceMap = {};
    attendanceRecords.forEach(record => {
      const dateKey = moment(record.date_).format('YYYY-MM-DD');
      const employeeKey = record.employee_ID;
      
      if (!attendanceMap[employeeKey]) {
        attendanceMap[employeeKey] = {};
      }
      if (!attendanceMap[employeeKey][dateKey]) {
        attendanceMap[employeeKey][dateKey] = [];
      }
      
      attendanceMap[employeeKey][dateKey].push({
        time: record.time_,
        scan_type: record.scan_type
      });
    });

    // Generate report data in tabular format
    const reportData = employees.map(employee => {
      const employeeAttendance = {
        employeeId: employee.employee_ID,
        employeeName: employee.employee_name || 'Unknown',
        division: employee.division_name || 'N/A',
        section: employee.section_name || 'N/A',
        dailyAttendance: {}
      };

      // Add daily attendance data
      dateRange.forEach(date => {
        const employeeKey = employee.employee_ID;
        const dayRecords = attendanceMap[employeeKey] && attendanceMap[employeeKey][date];
        
        if (dayRecords && dayRecords.length > 0) {
          // Build punches list from dayRecords with proper format for frontend
          const punches = dayRecords.map(r => ({ 
            time_: r.time,
            time: r.time, 
            scan_type: (r.scan_type || '').toUpperCase(),
            type: (r.scan_type || '').toUpperCase(),
            eventDescription: r.scan_type === 'IN' ? 'Check In' : 'Check Out'
          }));
          punches.sort((a, b) => (a.time || '').localeCompare(b.time || ''));

          // Find earliest IN and latest OUT for backward-compatible fields
          const inRecord = dayRecords.find(r => r.scan_type && r.scan_type.toUpperCase() === 'IN');
          let outRecord = [...dayRecords].reverse().find(r => r.scan_type && r.scan_type.toUpperCase() === 'OUT');
          if (!outRecord) outRecord = dayRecords[dayRecords.length - 1];

          const rawIn = inRecord && inRecord.time ? inRecord.time : null;
          const rawOut = outRecord && outRecord.time ? outRecord.time : null;

          // Compute working hours using moment when possible
          let workingHours = 0;
          try {
            if (rawIn && rawOut) {
              const ci = moment(rawIn, 'HH:mm:ss');
              const co = moment(rawOut, 'HH:mm:ss');
              if (ci.isValid() && co.isValid()) {
                workingHours = Number(co.diff(ci, 'hours', true).toFixed(2));
              }
            }
          } catch (e) {
            workingHours = 0;
          }

          // Return punches array directly for this date
          employeeAttendance.dailyAttendance[date] = punches;
        } else {
          // Return empty array for absent days
          employeeAttendance.dailyAttendance[date] = [];
        }
      });

      return employeeAttendance;
    });

    await connection.end();

    console.log(`\n📊 REPORT GENERATION SUMMARY:`);
    console.log(`   ✅ Generated successfully!`);
    console.log(`   📅 Date range: ${from_date} to ${to_date} (${dateRange.length} days)`);
    console.log(`   👥 Total employees: ${reportData.length}`);
    console.log(`   📍 Division: ${employees[0]?.division_name || 'All Divisions'}`);
    console.log(`   📂 Section: ${employees[0]?.section_name || 'All Sections'}`);
    console.log(`   📝 Total attendance records: ${attendanceRecords.length}\n`);

    return {
      reportType: 'group',
      dateRange: {
        from: from_date,
        to: to_date
      },
      dates: dateRange,
      data: reportData, // Changed from 'employees' to 'data' to match frontend expectations
      employees: reportData, // Keep for backward compatibility
      summary: {
        totalEmployees: employees.length,
        totalDays: dateRange.length,
        totalRecords: attendanceRecords.length,
        divisionInfo: employees[0]?.division_name || null,
        sectionInfo: employees[0]?.section_name || null
      }
    };

  } catch (error) {
    console.error('Error generating MySQL group attendance report:', error);
    throw error;
  }
};

module.exports = {
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
  generateMySQLMealReport,
  generateMySQLGroupAttendanceReport,
  generateMySQLAuditReport: async (req, res) => {
    try {
      console.log('=== AUDIT REPORT REQUEST ===');
      console.log('Request body:', req.body);

      const { from_date, to_date, division_id = '', section_id = '', sub_section_id = '', time_period = 'daily', grouping = 'none' } = req.body;

      // For designation-wise reports, we don't need dates - just fetch all employees from HRIS
      if (grouping === 'designation') {
        console.log(`\n📊 DESIGNATION-WISE REPORT (HRIS API ONLY)`);
        console.log(`Division filter: ${division_id || 'All'}`);
        console.log(`Section filter: ${section_id || 'All'}`);
        console.log(`Sub Section filter: ${sub_section_id || 'All'}`);

        // Fetch all employees from HRIS using cache (FAST)
        const hrisApiService = require('../services/hrisApiService');
        
        console.time('⏱️ Employee data fetch');
        
        // Always try cache first for maximum speed
        let allEmployees = hrisApiService.getCachedEmployees();
        
        if (!allEmployees || allEmployees.length === 0) {
          console.log('⚠️ Employee cache miss - initializing...');
          
          // Check if cache is initialized
          if (!hrisApiService.isCacheInitialized()) {
            console.log('🔄 Cache not initialized, initializing now...');
            await hrisApiService.initializeCache();
          }
          
          // Try cache again after initialization
          allEmployees = hrisApiService.getCachedEmployees();
          
          // If still empty, fetch directly
          if (!allEmployees || allEmployees.length === 0) {
            console.log('📡 Fetching from HRIS API...');
            allEmployees = await hrisApiService.getCachedOrFetch('employee', {});
          }
        } else {
          console.log(`📦 Cache HIT - ${allEmployees.length} employees loaded instantly`);
        }
        
        console.timeEnd('⏱️ Employee data fetch');
        console.log(`✅ Total employees available: ${allEmployees.length}`);

        // Filter by division/section using the same logic as working reports
        let filteredEmployees = allEmployees;
        
        console.log(`\n🎯 FILTERING HRIS EMPLOYEES:`);
        
        // Show available section names for debugging
        if (section_id && section_id !== 'all') {
          const uniqueSections = [...new Set(allEmployees.map(e => e.currentwork?.HIE_NAME_4).filter(Boolean))];
          console.log(`📋 Available HRIS section names (${uniqueSections.length}):`, uniqueSections.sort().slice(0, 20));
        }
        
        // Filter by section first (if provided)
        if (section_id && section_id !== 'all') {
          console.log(`🔍 Filtering by SECTION: "${section_id}"`);
          
          filteredEmployees = filteredEmployees.filter(emp => {
            const empSectionName = (emp.currentwork?.HIE_NAME_4 || '').trim();
            const filterSectionName = String(section_id).trim();
            
            // Try exact match first, then contains match
            const exactMatch = empSectionName.toLowerCase() === filterSectionName.toLowerCase();
            const containsMatch = empSectionName.toLowerCase().includes(filterSectionName.toLowerCase()) ||
                                 filterSectionName.toLowerCase().includes(empSectionName.toLowerCase());
            
            return exactMatch || containsMatch;
          });
          
          console.log(`✅ Found ${filteredEmployees.length} employees in section "${section_id}"`);
          
          if (filteredEmployees.length > 0) {
            console.log(`Sample employees:`, filteredEmployees.slice(0, 3).map(e => ({
              id: e.EMP_NUMBER,
              name: e.FULLNAME,
              section: e.currentwork?.HIE_NAME_4,
              designation: e.currentwork?.designation
            })));
          } else {
            console.log(`⚠️ No match! Your filter "${section_id}" doesn't match any HRIS section names`);
          }
        } else if (division_id && division_id !== 'all') {
          // Filter by division only if no section specified
          console.log(`🔍 Filtering by DIVISION: "${division_id}"`);
          
          filteredEmployees = filteredEmployees.filter(emp => {
            const empDivisionName = (emp.currentwork?.HIE_NAME_3 || '').trim();
            const empDivisionCode = String(emp.currentwork?.HIE_CODE_4 || '').trim();
            const filterDivisionName = String(division_id).trim().toLowerCase();
            
            // Try exact match first, then contains match (check name and code)
            const exactMatch = empDivisionName.toLowerCase() === filterDivisionName || empDivisionCode.toLowerCase() === filterDivisionName;
            const containsMatch = empDivisionName.toLowerCase().includes(filterDivisionName) || empDivisionCode.toLowerCase().includes(filterDivisionName) ||
                                 filterDivisionName.includes(empDivisionName.toLowerCase()) || filterDivisionName.includes(empDivisionCode.toLowerCase());
            
            return exactMatch || containsMatch;
          });
          
          console.log(`✅ Found ${filteredEmployees.length} employees in division "${division_id}"`);
          
          if (filteredEmployees.length > 0) {
            console.log(`Sample employees:`, filteredEmployees.slice(0, 3).map(e => ({
              id: e.EMP_NUMBER,
              name: e.FULLNAME,
              division: e.currentwork?.HIE_NAME_3
            })));
          }
        } else {
          console.log(`ℹ️ No division/section filter - using all employees`);
        }

        // Group by designation
        const designationMap = new Map();
        
        filteredEmployees.forEach(emp => {
          const empId = emp.EMP_NUMBER;
          const designation = emp.currentwork?.designation || 'Unassigned';
          
          if (!designationMap.has(designation)) {
            designationMap.set(designation, []);
          }
          
          // Add employee with simplified info (no issue count for now - can be calculated later if needed)
          designationMap.get(designation).push({
            employeeId: empId,
            employeeName: emp.FULLNAME || 'Unknown',
            designation: designation,
            issueCount: 0, // Placeholder - can be calculated from attendance data if needed
            divisionName: emp.currentwork?.HIE_NAME_3 || '',
            sectionName: emp.currentwork?.HIE_NAME_4 || ''
          });
        });

        // Convert to array format
        const reportData = [];
        designationMap.forEach((employees, designation) => {
          reportData.push({
            groupName: designation,
            groupType: 'Designation',
            count: employees.length,
            totalIssues: 0, // Can be calculated if needed
            employees: employees.sort((a, b) => a.employeeName.localeCompare(b.employeeName))
          });
        });

        // Sort by designation name
        reportData.sort((a, b) => a.groupName.localeCompare(b.groupName));

        console.log(`✅ Generated ${reportData.length} designation groups with ${filteredEmployees.length} total employees`);

        return res.status(200).json({
          success: true,
          reportType: 'audit',
          dateRange: { from: 'N/A', to: 'N/A' },
          timePeriod: time_period,
          grouping: grouping,
          data: reportData,
          summary: {
            totalRecords: 0,
            totalEmployees: filteredEmployees.length,
            totalGroups: reportData.length,
            divisionFilter: division_id || 'All',
            sectionFilter: section_id || 'All',
            subSectionFilter: sub_section_id || 'All',
            timePeriod: time_period,
            groupingMethod: grouping
          }
        });
      }

      // For other grouping types, we need MySQL attendance data
      if (!from_date || !to_date) {
        return res.status(400).json({
          success: false,
          message: 'Start date and end date are required'
        });
      }

      console.log(`\n📊 AUDIT REPORT GENERATION STARTED`);
      console.log(`Date range: ${from_date} to ${to_date}`);
      console.log(`Division filter: ${division_id || 'All'}`);
      console.log(`Section filter: ${section_id || 'All'}`);
      console.log(`Sub Section filter: ${sub_section_id || 'All'}`);

      // Connect to MySQL
      const { createMySQLConnection } = require('../config/mysql');
      const connection = await createMySQLConnection();
      console.log('✅ MySQL Connected successfully');

      // Get all employees who have only ONE punch in the date range
      const auditQuery = `
        SELECT 
          employee_ID,
          date_,
          COUNT(*) as punch_count,
          GROUP_CONCAT(CONCAT(time_, ':', scan_type) ORDER BY time_ SEPARATOR '|') as punches
        FROM attendance
        WHERE date_ BETWEEN ? AND ?
        GROUP BY employee_ID, date_
        HAVING COUNT(*) = 1
        ORDER BY date_ DESC, employee_ID ASC
      `;

      const [auditRecords] = await connection.execute(auditQuery, [from_date, to_date]);
      console.log(`Found ${auditRecords.length} single-punch records`);

      // Get unique employee IDs
      const distinctEmployeeIds = [...new Set(auditRecords.map(r => r.employee_ID))];
      console.log(`Distinct employees with single punches: ${distinctEmployeeIds.length}`);

      // Fetch employee details from HRIS
      const hrisApiService = require('../services/hrisApiService');
      const allEmployees = await hrisApiService.getCachedOrFetch('employee', {});
      console.log(`Fetched ${allEmployees.length} employees from HRIS`);

      // Filter by division/section if provided
      let filteredEmployees = allEmployees;
      
      if (sub_section_id) {
        console.log(`🔄 Filtering by sub section: "${sub_section_id}"`);
        // Get transferred employees for this sub section
        try {
          const [transferredRows] = await connection.execute(
            'SELECT employee_id FROM subsection_transfers WHERE sub_section_id = ?',
            [String(sub_section_id)]
          );
          
          const transferredEmployeeIds = transferredRows.map(row => String(row.employee_id));
          console.log(`Found ${transferredEmployeeIds.length} transferred employees in sub section`);
          
          if (transferredEmployeeIds.length > 0) {
            filteredEmployees = filteredEmployees.filter(emp => {
              const empId = String(emp.EMP_NUMBER || emp.emp_no || emp.employee_no || '');
              return transferredEmployeeIds.includes(empId);
            });
            console.log(`✅ After sub section filter: ${filteredEmployees.length} employees`);
          } else {
            console.log(`⚠️ No transferred employees found for this sub section`);
            filteredEmployees = [];
          }
        } catch (err) {
          console.error('Error fetching transferred employees:', err);
        }
      } else if (section_id && section_id !== 'all') {
        console.log(`🔍 Filtering by SECTION: "${section_id}"`);
        
        // Log sample section names to debug
        const sampleSections = [...new Set(allEmployees.slice(0, 50).map(e => e.currentwork?.HIE_NAME_3).filter(Boolean))];
        console.log(`📋 Sample HRIS section names:`, sampleSections.slice(0, 10));
        
        filteredEmployees = filteredEmployees.filter(emp => {
          const empSectionName = (emp.currentwork?.HIE_NAME_3 || '').trim();
          const filterSectionName = String(section_id).trim();
          
          // Try exact match first, then contains match (bidirectional)
          const exactMatch = empSectionName.toLowerCase() === filterSectionName.toLowerCase();
          const containsMatch = empSectionName.toLowerCase().includes(filterSectionName.toLowerCase()) ||
                               filterSectionName.toLowerCase().includes(empSectionName.toLowerCase());
          
          return exactMatch || containsMatch;
        });
        
        console.log(`✅ Found ${filteredEmployees.length} employees in section "${section_id}"`);
        
        if (filteredEmployees.length > 0) {
          console.log(`Sample employees:`, filteredEmployees.slice(0, 3).map(e => ({
            id: e.EMP_NUMBER,
            name: e.FULLNAME,
            section: e.currentwork?.HIE_NAME_3
          })));
        } else {
          console.log(`⚠️ No match! Your filter "${section_id}" doesn't match any HRIS section names`);
        }
      } else if (division_id && division_id !== 'all') {
        console.log(`🔍 Filtering by DIVISION: "${division_id}"`);
        
        filteredEmployees = filteredEmployees.filter(emp => {
            const empDivisionName = (emp.currentwork?.HIE_NAME_3 || '').trim();
          
          // Try exact match first, then contains match (bidirectional)
          const exactMatch = empDivisionName.toLowerCase() === filterDivisionName.toLowerCase();
          const containsMatch = empDivisionName.toLowerCase().includes(filterDivisionName.toLowerCase()) ||
                               filterDivisionName.toLowerCase().includes(empDivisionName.toLowerCase());
          
          return exactMatch || containsMatch;
        });
        
        console.log(`✅ Found ${filteredEmployees.length} employees in division "${division_id}"`);
      }

      // Match with employees who have single punches
      const employees = filteredEmployees.filter(emp => {
        const empId = emp.EMP_NUMBER;
        return distinctEmployeeIds.includes(empId);
      });

      console.log(`✅ Final matched employees: ${employees.length}`);

      // Build designation-wise audit report (simplified for best practices)
      console.log(`\n🔨 Building designation-wise audit report (grouping: ${grouping})...`);
      
      let reportData = [];
      
      if (grouping === 'designation') {
        // Designation-wise: Show unique employees grouped by designation
        const designationMap = new Map();
        
        employees.forEach(emp => {
          const empId = emp.EMP_NUMBER;
          const designation = emp.currentwork?.designation || 'Unassigned';
          const empRecords = auditRecords.filter(r => r.employee_ID === empId);
          
          if (!designationMap.has(designation)) {
            designationMap.set(designation, []);
          }
          
          // Add employee with their issue count (no date/time details for cleaner report)
          designationMap.get(designation).push({
            employeeId: empId,
            employeeName: emp.FULLNAME || 'Unknown',
            designation: designation,
            issueCount: empRecords.length,
            divisionName: emp.currentwork?.HIE_NAME_3 || '',
            sectionName: emp.currentwork?.HIE_NAME_4 || ''
          });
        });
        
        // Convert to array and sort
        reportData = Array.from(designationMap.entries()).map(([designation, empList]) => ({
          groupName: designation,
          groupType: 'Designation',
          employees: empList.sort((a, b) => a.employeeName.localeCompare(b.employeeName)),
          count: empList.length,
          totalIssues: empList.reduce((sum, e) => sum + e.issueCount, 0)
        })).sort((a, b) => a.groupName.localeCompare(b.groupName));
        
      } else if (grouping === 'punch') {
        // Punch-wise: Show ONLY Check In records (employees who checked in but didn't check out)
        const checkInOnlyRecords = [];
        
        // First, let's see what scan types we actually have
        const scanTypeSample = new Set();
        
        employees.forEach(emp => {
          const empId = emp.EMP_NUMBER;
          const empRecords = auditRecords.filter(r => r.employee_ID === empId);
          
          empRecords.forEach(record => {
            const punchData = record.punches.split('|')[0].split(':');
            const scanType = punchData[1];
            scanTypeSample.add(scanType);
            
            // In this attendance system:
            // '08' = Check In
            // '46' = Check Out
            // Single punch records with '08' mean employee forgot to check out
            const isCheckIn = scanType === '08';
            
            if (isCheckIn) {
              checkInOnlyRecords.push({
                employeeId: empId,
                employeeName: emp.FULLNAME || 'Unknown',
                designation: emp.currentwork?.designation || 'Unassigned',
                divisionName: emp.currentwork?.HIE_NAME_3 || '',
                sectionName: emp.currentwork?.HIE_NAME_3 || '',
                eventDate: record.date_,
                eventTime: punchData[0],
                scanType: scanType,
                punchType: 'Check In Only'
              });
            }
          });
        });
        
        console.log(`📊 Unique scan types found in data:`, Array.from(scanTypeSample));
        console.log(`✅ Found ${checkInOnlyRecords.length} Check In Only records (missing check out)`);
        
        if (checkInOnlyRecords.length > 0) {
          console.log(`📋 Sample check-in records:`, checkInOnlyRecords.slice(0, 3).map(r => ({
            empId: r.employeeId,
            date: r.eventDate,
            time: r.eventTime,
            scanType: r.scanType
          })));
        }
        
        reportData = [{
          groupName: 'F1 - Check In Only (Missing Check Out)',
          groupType: 'Punch Type',
          employees: checkInOnlyRecords.sort((a, b) => {
            const desigCompare = a.designation.localeCompare(b.designation);
            if (desigCompare !== 0) return desigCompare;
            return new Date(b.eventDate) - new Date(a.eventDate);
          }),
          count: checkInOnlyRecords.length,
          totalIssues: checkInOnlyRecords.length
        }];
        
      } else {
        // No grouping: Flat list
        const flatList = [];
        employees.forEach(emp => {
          const empId = emp.EMP_NUMBER;
          const empRecords = auditRecords.filter(r => r.employee_ID === empId);
          
          flatList.push({
            employeeId: empId,
            employeeName: emp.FULLNAME || 'Unknown',
            designation: emp.currentwork?.designation || 'Unassigned',
            issueCount: empRecords.length,
            divisionName: emp.currentwork?.HIE_NAME_3 || '',
            sectionName: emp.currentwork?.HIE_NAME_4 || ''
          });
        });
        
        reportData = [{
          groupName: 'All Employees',
          groupType: 'None',
          employees: flatList.sort((a, b) => b.issueCount - a.issueCount),
          count: flatList.length,
          totalIssues: flatList.reduce((sum, e) => sum + e.issueCount, 0)
        }];
      }

      await connection.end();

      console.log(`\n📊 PROFESSIONAL AUDIT REPORT SUMMARY:`);
      console.log(`   Grouping method: ${grouping}`);
      console.log(`   Total groups: ${reportData.length}`);
      console.log(`   Total employees affected: ${employees.length}`);
      console.log(`   Total records in first group: ${reportData[0]?.employees?.length || 0}`);
      console.log(`   Time period: ${time_period}`);

      return res.status(200).json({
        success: true,
        reportType: 'audit',
        dateRange: { from: from_date, to: to_date },
        timePeriod: time_period,
        grouping: grouping,
        data: reportData,
        summary: {
          totalRecords: auditRecords.length,
          totalEmployees: employees.length,
          totalGroups: reportData.length,
          divisionFilter: division_id || 'All',
          sectionFilter: section_id || 'All',
          subSectionFilter: sub_section_id || 'All',
          timePeriod: time_period,
          groupingMethod: grouping
        }
      });

    } catch (error) {
      console.error('Audit report error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error generating audit report',
        error: error.message
      });
    }
  }
};
