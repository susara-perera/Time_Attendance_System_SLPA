/**
 * Dashboard Controller - MySQL Sync Version
 * 
 * Uses MySQL sync tables (divisions_sync, sections_sync, employees_sync)
 * instead of HRIS API cache for fast, reliable dashboard data
 */

const { sequelize } = require('../models/mysql');
const moment = require('moment');

// @desc    Get dashboard statistics using MySQL sync tables
// @route   GET /api/dashboard/stats
// @access  Private
const getDashboardStats = async (req, res) => {
  try {
    console.log('📊 Getting dashboard statistics from MySQL sync tables...');

    // Get counts from MySQL sync tables (fast!)
    let divisionCount = { count: 0 };
    let sectionCount = { count: 0 };
    let employeeCount = { count: 0 };

    try {
      const [[divCount]] = await sequelize.query(
        'SELECT COUNT(*) as count FROM divisions_sync'
      );
      divisionCount = divCount || { count: 0 };
    } catch (err) {
      console.log('⚠️ Could not get division count from MySQL, using 0:', err.message);
    }

    try {
      const [[secCount]] = await sequelize.query(
        'SELECT COUNT(*) as count FROM sections_sync'
      );
      sectionCount = secCount || { count: 0 };
    } catch (err) {
      console.log('⚠️ Could not get section count from MySQL, using 0:', err.message);
    }

    try {
      const [[empCount]] = await sequelize.query(
        'SELECT COUNT(*) as count FROM employees_sync WHERE IS_ACTIVE = 1'
      );
      employeeCount = empCount || { count: 0 };
    } catch (err) {
      console.log('⚠️ Could not get employee count from MySQL, using 0:', err.message);
    }

    // Get sub-sections count from MySQL
    let subSectionCount = 0;
    try {
      const [[subSecCount]] = await sequelize.query(
        'SELECT COUNT(*) as count FROM sub_sections'
      );
      subSectionCount = subSecCount?.count || 0;
    } catch (err) {
      // Table doesn't exist yet, try MongoDB fallback
      try {
        const SubSection = require('../models/SubSection');
        subSectionCount = await SubSection.countDocuments({});
      } catch (mongoErr) {
        subSectionCount = 0;
      }
    }

    // Get system users count from MongoDB
    const User = require('../models/User');
    const totalUsers = await User.countDocuments({ isActive: true });

    // Get today's date
    const today = moment().format('YYYY-MM-DD');

    // Try to get attendance stats from attendance_sync
    let presentToday = 0;
    try {
      const [[todayStats]] = await sequelize.query(`
        SELECT COUNT(DISTINCT employee_id) as present_count
        FROM attendance_sync 
        WHERE attendance_date = ? AND status = 'present'
      `, { replacements: [today] });
      presentToday = todayStats?.present_count || 0;
    } catch (err) {
      // attendance_sync not available yet
    }

    const totalEmployees = employeeCount?.count || 0;
    const attendanceRate = totalEmployees > 0 
      ? parseFloat(((presentToday / totalEmployees) * 100).toFixed(1)) 
      : 0;

    // Calculate active users (logged in last 24 hours)
    const activeUsers = await User.countDocuments({ 
      isActive: true, 
      lastLogin: { $gte: moment().subtract(24, 'hours').toDate() } 
    });

    // Get recent activities
    let recentActivities = [];
    try {
      const SubSection = require('../models/SubSection');
      const TransferToSubsection = require('../models/TransferToSubsection');
      const weekAgoDate = moment().subtract(7, 'days').toDate();

      const [recentSubSections, recentTransfers] = await Promise.all([
        SubSection.find({ createdAt: { $gte: weekAgoDate } }).sort({ createdAt: -1 }).limit(5).lean(),
        TransferToSubsection.find({ transferredAt: { $gte: weekAgoDate } }).sort({ transferredAt: -1 }).limit(5).lean()
      ]);

      const subSectionActivities = recentSubSections.map(sub => ({
        title: 'New Sub-Section',
        description: `"${sub.subSection?.sub_hie_name || 'Unknown'}" added`,
        date: moment(sub.createdAt).format('YYYY-MM-DD'),
        time: moment(sub.createdAt).format('HH:mm:ss'),
        icon: 'bi bi-diagram-2'
      }));

      const transferActivities = recentTransfers.map(tr => ({
        title: 'Employee Transferred',
        description: `"${tr.employeeName}" transferred to "${tr.sub_hie_name}"`,
        date: moment(tr.transferredAt).format('YYYY-MM-DD'),
        time: moment(tr.transferredAt).format('HH:mm:ss'),
        icon: 'bi bi-arrow-left-right'
      }));

      recentActivities = [...subSectionActivities, ...transferActivities]
        .sort((a, b) => new Date(`${b.date}T${b.time}`) - new Date(`${a.date}T${a.time}`))
        .slice(0, 10);
    } catch (err) {
      console.log('⚠️ Could not fetch activities:', err.message);
    }

    const stats = {
      totalDivisions: divisionCount?.count || 0,
      totalSections: sectionCount?.count || 0,
      totalSubSections: subSectionCount,
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
      weeklyTrend: [],
      dataSource: 'MySQL Sync'
    };

    console.log(`✅ Dashboard: ${stats.totalDivisions} div, ${stats.totalSections} sec, ${stats.totalEmployees} emp`);

    res.status(200).json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('❌ Dashboard stats error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard stats',
      error: error.message
    });
  }
};

// @desc    Get recent activities
// @route   GET /api/dashboard/activities/recent
// @access  Private
const getRecentActivities = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const weekAgoDate = moment().subtract(7, 'days').toDate();

    const SubSection = require('../models/SubSection');
    const TransferToSubsection = require('../models/TransferToSubsection');

    let recentSubSections = [];
    let recentTransfers = [];

    try {
      recentSubSections = await SubSection.find({ createdAt: { $gte: weekAgoDate } })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
    } catch (err) {}

    try {
      recentTransfers = await TransferToSubsection.find({ transferredAt: { $gte: weekAgoDate } })
        .sort({ transferredAt: -1 })
        .limit(limit)
        .lean();
    } catch (err) {}

    const subSectionActivities = recentSubSections.map(sub => ({
      title: 'New Sub-Section',
      description: `"${sub.subSection?.sub_hie_name || 'Unknown'}" added`,
      date: moment(sub.createdAt).format('YYYY-MM-DD'),
      time: moment(sub.createdAt).format('HH:mm:ss'),
      icon: 'bi bi-diagram-2'
    }));

    const transferActivities = recentTransfers.map(tr => ({
      title: 'Employee Transferred',
      description: `"${tr.employeeName}" transferred to "${tr.sub_hie_name}"`,
      date: moment(tr.transferredAt).format('YYYY-MM-DD'),
      time: moment(tr.transferredAt).format('HH:mm:ss'),
      icon: 'bi bi-arrow-left-right'
    }));

    const allActivities = [...subSectionActivities, ...transferActivities]
      .sort((a, b) => new Date(`${b.date}T${b.time}`) - new Date(`${a.date}T${a.time}`))
      .slice(0, limit);

    res.status(200).json({
      success: true,
      data: allActivities
    });

  } catch (error) {
    console.error('Error fetching recent activities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent activities'
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

module.exports = {
  getDashboardStats,
  getRecentActivities,
  getDashboardTotalCounts,
  refreshDashboardTotalCounts
};
