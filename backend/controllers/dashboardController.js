/**
 * Dashboard Controller - MySQL Sync Version
 * 
 * Uses MySQL sync tables (divisions_sync, sections_sync, employees_sync)
 * for fast, reliable dashboard data - NO CACHE
 */

const { sequelize } = require('../models/mysql');
const moment = require('moment');

const safeJsonParse = (value, fallback) => {
  try {
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'string') return JSON.parse(value);
    return value;
  } catch (e) {
    return fallback;
  }
};

const getDashboardCacheRow = async () => {
  const [row] = await sequelize.query(`
    SELECT *
    FROM total_count_dashboard
    WHERE id = 1
    LIMIT 1
  `, {
    raw: true,
    type: sequelize.QueryTypes.SELECT
  });

  return row || null;
};

// @desc    Get dashboard statistics using total_count_dashboard cache table
// @route   GET /api/dashboard/stats
// @access  Private
const getDashboardStats = async (req, res) => {
  try {
    const startTime = Date.now();

    // Get ALL data from total_count_dashboard table (single ULTRA-FAST query with index!)
    const [dashboardData] = await sequelize.query(`
      SELECT 
        totalDivisions,
        totalSections,
        totalSubsections,
        totalActiveEmployees,
        IS_attendance_trend,
        present_IS,
        absent_IS,
        last_updated
      FROM total_count_dashboard USE INDEX (idx_id_updated)
      WHERE id = 1
      LIMIT 1
    `, {
      raw: true,
      type: sequelize.QueryTypes.SELECT
    });

    if (!dashboardData) {
      console.warn('⚠️ No data in total_count_dashboard (cache empty).');
      return res.status(200).json({
        success: true,
        data: {
          totalDivisions: 0,
          totalSections: 0,
          totalSubSections: 0,
          totalEmployees: 0,
          message: 'Dashboard cache is empty. Please run Manual Sync → Dashboard Totals Cache.'
        }
      });
    }

    const cachedData = dashboardData;

    // Parse JSON fields  
    let isAttendanceTrend = [];
    let presentIS = [];
    let absentIS = [];

    try {
      if (cachedData.IS_attendance_trend) {
        isAttendanceTrend = typeof cachedData.IS_attendance_trend === 'string' 
          ? JSON.parse(cachedData.IS_attendance_trend) 
          : cachedData.IS_attendance_trend;
      }
      if (cachedData.present_IS) {
        presentIS = typeof cachedData.present_IS === 'string'
          ? JSON.parse(cachedData.present_IS)
          : cachedData.present_IS;
      }
      if (cachedData.absent_IS) {
        absentIS = typeof cachedData.absent_IS === 'string'
          ? JSON.parse(cachedData.absent_IS)
          : cachedData.absent_IS;
      }
    } catch (e) {
      console.warn('⚠️ Failed to parse IS attendance data:', e.message);
    }

    // Get additional data not in cache table
    const User = require('../models/User');
    const totalUsers = await User.countDocuments({ isActive: true });
    const activeUsers = await User.countDocuments({ 
      isActive: true, 
      lastLogin: { $gte: moment().subtract(24, 'hours').toDate() } 
    });

    // Get today's overall attendance (optional; attendance_sync may not exist)
    const today = moment().format('YYYY-MM-DD');
    const presentToday = 0;
    const totalEmployees = cachedData.totalActiveEmployees || 0;
    const attendanceRate = 0;

    // Get recent activities
    let recentActivities = [];
    try {
      const { RecentActivity } = require('../models/mysql');
      const weekAgoDate = moment().subtract(7, 'days').toDate();

      const activities = await RecentActivity.findAll({
        where: {
          created_at: {
            [require('sequelize').Op.gte]: weekAgoDate
          }
        },
        order: [['created_at', 'DESC']],
        limit: 10
      });

      recentActivities = activities.map(activity => ({
        title: activity.title,
        description: activity.description,
        date: activity.activity_date,
        time: activity.activity_time,
        icon: activity.icon
      }));
    } catch (err) {
      console.log('⚠️ Could not fetch activities:', err.message);
    }

    // Get IS division employee lists (from cached data in total_count_dashboard)
    const presentTodayIS = Array.isArray(presentIS) ? presentIS.slice(0, 200) : [];
    const absentTodayIS = Array.isArray(absentIS) ? absentIS.slice(0, 200) : [];

    const stats = {
      totalDivisions: cachedData.totalDivisions || 0,
      totalSections: cachedData.totalSections || 0,
      totalSubSections: cachedData.totalSubsections || 0,
      totalEmployees: totalEmployees,
      totalUsers: totalUsers,
      presentToday: presentToday,
      attendanceRate: attendanceRate,
      activeUsers: activeUsers,
      today: today,
      recentActivities: recentActivities,
      weeklyAttendance: [],
      todayAttendance: {
        employeesPresent: presentToday,
        totalScans: 0,
        inScans: 0,
        outScans: 0
      },
      weeklyTrend: isAttendanceTrend,  // IS division 7-day trend from cache
      monthlyTrend: [],  // Not implemented yet
      annualTrend: [],  // Not implemented yet
      // IS division data
      absentTodayIS: absentTodayIS,
      absentTodayISCount: absentTodayIS.length,
      presentTodayIS: presentTodayIS,
      presentTodayISCount: presentTodayIS.length,
      totalEmployeesIS: presentTodayIS.length + absentTodayIS.length,
      dataSource: 'total_count_dashboard (MySQL)',
      cacheLastUpdated: cachedData.last_updated, // last_updated in total_count_dashboard
      queryTime: Date.now() - startTime // Performance metric
    };

    const queryTime = Date.now() - startTime;
    console.log(`✅ Dashboard loaded in ${queryTime}ms (${stats.totalDivisions} div, ${stats.totalSections} sec, ${stats.totalEmployees} emp)`);

    const response = {
      success: true,
      data: stats
    };

    res.status(200).json(response);

  } catch (error) {
    console.error('❌ Dashboard stats error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard stats',
      error: error.message
    });
  }
};

// @desc    Get dashboard total counts (cached from total_count_dashboard table)
// @route   GET /api/dashboard/total-counts
// @access  Private
const getDashboardTotalCounts = async (req, res) => {
  try {
    const { getDashboardTotals } = require('../services/dashboardTotalsService');
    const result = await getDashboardTotals();

    res.status(200).json({
      success: true,
      data: result?.data || result,
      cached: result?.cached || true
    });

  } catch (error) {
    console.error('Get dashboard total counts error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting dashboard totals'
    });
  }
};

// @desc    Refresh dashboard total counts
// @route   POST /api/dashboard/total-counts/refresh
// @access  Private
const refreshDashboardTotalCounts = async (req, res) => {
  try {
    const { updateDashboardTotals } = require('../services/dashboardTotalsService');
    const result = await updateDashboardTotals();

    res.status(200).json({
      success: true,
      message: 'Dashboard totals refreshed successfully',
      data: result?.totals || result
    });

  } catch (error) {
    console.error('Refresh dashboard total counts error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error refreshing dashboard totals'
    });
  }
};

// @desc    Get recent activities
// @route   GET /api/dashboard/activities/recent
// @access  Private
const getRecentActivities = async (req, res) => {
  try {
    const requestedLimit = parseInt(req.query.limit);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 20) : 5;

    // Import MySQL models
    const { RecentActivity } = require('../models/mysql');

    // Query recent activities from MySQL table
    const activities = await RecentActivity.findAll({
      order: [['created_at', 'DESC']],
      limit: limit
    });

    // Map to the expected format
    const formattedActivities = activities.map(activity => ({
      id: activity.id,
      title: activity.title,
      description: activity.description,
      date: activity.activity_date,
      time: activity.activity_time,
      icon: activity.icon,
      action: activity.activity_type,
      user: activity.user_name
    }));

    res.status(200).json({
      success: true,
      data: formattedActivities
    });

  } catch (error) {
    console.error('Error fetching recent activities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent activities'
    });
  }
};

// --- Per-widget endpoints (read-only from total_count_dashboard / recent_activities) ---

// @route GET /api/dashboard/total-divisions
const getTotalDivisions = async (req, res) => {
  try {
    const row = await getDashboardCacheRow();
    res.status(200).json({
      success: true,
      count: row?.totalDivisions || 0,
      lastUpdated: row?.last_updated || null
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch total divisions' });
  }
};

// @route GET /api/dashboard/total-sections
const getTotalSections = async (req, res) => {
  try {
    const row = await getDashboardCacheRow();
    res.status(200).json({
      success: true,
      count: row?.totalSections || 0,
      lastUpdated: row?.last_updated || null
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch total sections' });
  }
};

// @route GET /api/dashboard/total-subsections
const getTotalSubSections = async (req, res) => {
  try {
    const row = await getDashboardCacheRow();
    res.status(200).json({
      success: true,
      count: row?.totalSubsections || 0,
      lastUpdated: row?.last_updated || null
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch total sub sections' });
  }
};

// @route GET /api/dashboard/total-employees
const getTotalEmployees = async (req, res) => {
  try {
    const row = await getDashboardCacheRow();
    res.status(200).json({
      success: true,
      count: row?.totalActiveEmployees || 0,
      lastUpdated: row?.last_updated || null
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch total employees' });
  }
};

// @route GET /api/dashboard/attendance-trend
const getAttendanceTrend = async (req, res) => {
  try {
    const row = await getDashboardCacheRow();
    const trend =
      safeJsonParse(row?.IS_attendance_trend, null) ||
      safeJsonParse(row?.attendance_trend_data, []);

    res.status(200).json({
      success: true,
      data: Array.isArray(trend) ? trend : [],
      lastUpdated: row?.last_updated || null
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch attendance trend' });
  }
};

// @route GET /api/dashboard/is-division-attendance
const getIsDivisionAttendance = async (req, res) => {
  try {
    const row = await getDashboardCacheRow();

    // Try to use is_division_attendance if it has valid employees array
    const cachedObj = safeJsonParse(row?.is_division_attendance, null);
    if (cachedObj && typeof cachedObj === 'object' && Array.isArray(cachedObj.employees) && cachedObj.employees.length > 0) {
      return res.status(200).json({
        success: true,
        data: cachedObj,
        lastUpdated: row?.last_updated || null
      });
    }

    // Fallback: combine present_IS and absent_IS
    const present = safeJsonParse(row?.present_IS, []);
    const absent = safeJsonParse(row?.absent_IS, []);

    const presentList = Array.isArray(present)
      ? present.map(e => ({
          employee_id: e.employee_id || e.empNo || e.EMP_NO || null,
          employee_name: e.employee_name || e.empName || e.EMP_NAME || null,
          division_code: e.division_code || e.divCode || e.DIV_CODE || null,
          division_name: e.division_name || e.divName || e.DIV_NAME || null,
          section_code: e.section_code || e.secCode || e.SEC_CODE || null,
          section_name: e.section_name || e.secName || e.SEC_NAME || null,
          is_present: true
        }))
      : [];

    const absentList = Array.isArray(absent)
      ? absent.map(e => ({
          employee_id: e.employee_id || e.empNo || e.EMP_NO || null,
          employee_name: e.employee_name || e.empName || e.EMP_NAME || null,
          division_code: e.division_code || e.divCode || e.DIV_CODE || null,
          division_name: e.division_name || e.divName || e.DIV_NAME || null,
          section_code: e.section_code || e.secCode || e.SEC_CODE || null,
          section_name: e.section_name || e.secName || e.SEC_NAME || null,
          is_present: false
        }))
      : [];

    const employees = [...presentList, ...absentList].filter(e => e.employee_id);

    res.status(200).json({
      success: true,
      data: {
        employees,
        totalEmployees: employees.length,
        presentCount: presentList.length,
        absentCount: absentList.length
      },
      lastUpdated: row?.last_updated || null
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch IS division attendance' });
  }
};

// @desc    Refresh attendance trend data only (also updates total_count_dashboard)
// @route   POST /api/dashboard/attendance-trend/refresh
// @access  Private
const refreshAttendanceTrend = async (req, res) => {
  try {
    const { updateDashboardTotals } = require('../services/dashboardTotalsService');
    const result = await updateDashboardTotals();

    res.status(200).json({
      success: true,
      message: 'Attendance trend data refreshed successfully',
      data: {
        attendanceTrend: result?.totals?.attendanceTrend || result?.attendanceTrend || [],
        monthlyTrend: result?.totals?.monthlyTrend || result?.monthlyTrend || [],
        annualTrend: result?.totals?.annualTrend || result?.annualTrend || []
      }
    });
  } catch (error) {
    console.error('Refresh attendance trend error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error refreshing attendance trend'
    });
  }
};

// @desc    Sync present/absent IS division employees for today into present_employees_IS
// @route   POST /api/dashboard/present-absent-sync
// @access  Private
const syncPresentAbsentIS = async (req, res) => {
  try {
    const runQuery = createDbRunner();
    const isDivCode = process.env.IS_DIV_CODE || '66';

    await runQuery(`
      CREATE TABLE IF NOT EXISTS present_employees_IS (
        id INT AUTO_INCREMENT PRIMARY KEY,
        employee_id VARCHAR(50) NOT NULL,
        employee_name VARCHAR(150) NULL,
        division_code VARCHAR(50) NULL,
        section_code VARCHAR(50) NULL,
        attendance_date DATE NOT NULL,
        status VARCHAR(10) NOT NULL,
        first_in TIME NULL,
        last_out TIME NULL,
        punches INT DEFAULT 0,
        last_seen DATETIME NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_emp_date (employee_id, attendance_date),
        INDEX idx_status (status),
        INDEX idx_att_date (attendance_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await runQuery(`
      INSERT INTO present_employees_IS (
        employee_id, employee_name, division_code, section_code, attendance_date,
        status, first_in, last_out, punches, last_seen
      )
      SELECT 
        e.EMP_NO AS employee_id,
        e.EMP_NAME AS employee_name,
        e.DIV_CODE AS division_code,
        e.SEC_CODE AS section_code,
        CURDATE() AS attendance_date,
        CASE WHEN a.employee_id IS NULL THEN 'absent' ELSE 'present' END AS status,
        MIN(a.time_) AS first_in,
        MAX(a.time_) AS last_out,
        COUNT(a.employee_id) AS punches,
        MAX(CONCAT(a.date_, ' ', a.time_)) AS last_seen
      FROM employees_sync e
      LEFT JOIN attendance a
        ON a.employee_id = e.EMP_NO
        AND DATE(a.date_) = CURDATE()
        AND (a.fingerprint_id NOT LIKE '%Emergancy Exit%' OR a.fingerprint_id IS NULL)
      WHERE e.DIV_CODE = ?
        AND e.IS_ACTIVE = 1
      GROUP BY e.EMP_NO, e.EMP_NAME, e.DIV_CODE, e.SEC_CODE
      ON DUPLICATE KEY UPDATE
        status = VALUES(status),
        first_in = VALUES(first_in),
        last_out = VALUES(last_out),
        punches = VALUES(punches),
        last_seen = VALUES(last_seen),
        updated_at = CURRENT_TIMESTAMP
    `, [isDivCode]);

    const [summaryRows] = await runQuery(`
      SELECT 
        COUNT(*) AS total,
        SUM(status = 'present') AS presentCount,
        SUM(status = 'absent') AS absentCount
      FROM present_employees_IS
      WHERE attendance_date = CURDATE()
    `);

    res.status(200).json({
      success: true,
      message: 'present_employees_IS synced successfully',
      data: summaryRows?.[0] || { total: 0, presentCount: 0, absentCount: 0 }
    });
  } catch (error) {
    console.error('Sync present_employees_IS error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error syncing present/absent IS employees'
    });
  }
};

module.exports = {
  getDashboardStats,
  getRecentActivities,
  getDashboardTotalCounts,
  refreshDashboardTotalCounts,
  refreshAttendanceTrend,
  syncPresentAbsentIS,
  getTotalDivisions,
  getTotalSections,
  getTotalSubSections,
  getTotalEmployees,
  getAttendanceTrend,
  getIsDivisionAttendance
};
