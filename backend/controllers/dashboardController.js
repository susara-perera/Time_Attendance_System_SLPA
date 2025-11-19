const User = require('../models/User');
const Division = require('../models/Division');
const Section = require('../models/Section');
const Attendance = require('../models/Attendance');
const { createMySQLConnection } = require('../config/mysql');
const { getCachedEmployees, getCachedOrFetch, isCacheInitialized } = require('../services/hrisApiService');
const moment = require('moment');

// @desc    Get dashboard statistics
// @route   GET /api/dashboard/stats
// @access  Private
const getDashboardStats = async (req, res) => {
  try {
    console.log('Getting dashboard statistics...');

    // Get basic counts from MongoDB
    const [totalUsers, totalSubSections] = await Promise.all([
      User.countDocuments({ isActive: true }),
      require('../models/SubSection').countDocuments({})
    ]);

    // Get section count using Section Management logic (HRIS cache, fallback to local)
    let totalSections = 0;
    try {
      const { getCachedSections, getCachedOrFetch, isCacheInitialized, initializeCache } = require('../services/hrisApiService');
      if (!isCacheInitialized()) {
        await initializeCache();
      }
      let sections = getCachedSections();
      if (!sections) {
        const allHierarchy = await getCachedOrFetch('company_hierarchy', {});
        sections = allHierarchy.filter(item => item.DEF_LEVEL === 4 || item.DEF_LEVEL === '4');
      }
      totalSections = Array.isArray(sections) ? sections.length : 0;
    } catch (err) {
      // Fallback to local DB
      totalSections = await require('../models/Section').countDocuments({ isActive: true });
    }

    // Get division count using Division Management logic (HRIS cache, fallback to local)
    let totalDivisions = 0;
    try {
      const { getCachedDivisions, getCachedOrFetch, isCacheInitialized, initializeCache } = require('../services/hrisApiService');
      if (!isCacheInitialized()) {
        await initializeCache();
      }
      let divisions = getCachedDivisions();
      if (!divisions) {
        const allHierarchy = await getCachedOrFetch('company_hierarchy', {});
        divisions = allHierarchy.filter(item => item.DEF_LEVEL === 3 || item.DEF_LEVEL === '3');
      }
      totalDivisions = Array.isArray(divisions) ? divisions.length : 0;
    } catch (err) {
      // Fallback to local DB
      totalDivisions = await Division.countDocuments({ isActive: true });
    }

    // Get today's attendance from MySQL
    const today = moment().format('YYYY-MM-DD');
    const connection = await createMySQLConnection();
    
    // Get today's attendance stats
    const [attendanceStats] = await connection.execute(`
      SELECT 
        COUNT(DISTINCT employee_ID) as employees_present,
        COUNT(*) as total_scans,
        SUM(CASE WHEN scan_type = 'IN' THEN 1 ELSE 0 END) as in_scans,
        SUM(CASE WHEN scan_type = 'OUT' THEN 1 ELSE 0 END) as out_scans
      FROM attendance 
      WHERE date_ = ?
    `, [today]);

    // Get recent attendance summary (last 7 days)
    const weekAgo = moment().subtract(7, 'days').format('YYYY-MM-DD');
    const [weeklyStats] = await connection.execute(`
      SELECT 
        date_,
        COUNT(DISTINCT employee_ID) as daily_employees
      FROM attendance 
      WHERE date_ BETWEEN ? AND ?
      GROUP BY date_
      ORDER BY date_ DESC
    `, [weekAgo, today]);

    await connection.end();

    // Try to get HRIS total employees from HRIS cache/service (preferred source) - fallback to mongo users
    // Always fetch HRIS employees the same way as Employee Management page
    let hrisEmployees;
    try {
      hrisEmployees = await getCachedOrFetch('employee', {});
    } catch (err) {
      console.warn('HRIS fetch failed for dashboard, falling back to Mongo users:', err?.message || err);
      hrisEmployees = null;
    }
    // If HRIS unavailable, fallback to Mongo users
    const totalEmployees = (hrisEmployees && Array.isArray(hrisEmployees) && hrisEmployees.length > 0)
      ? hrisEmployees.length
      : totalUsers;
    console.log(`HRIS employee count for dashboard: ${hrisEmployees && Array.isArray(hrisEmployees) ? hrisEmployees.length : 'N/A'}`);
    const presentToday = attendanceStats[0]?.employees_present || 0;
    const totalScans = attendanceStats[0]?.total_scans || 0;
    const inScans = attendanceStats[0]?.in_scans || 0;
    const outScans = attendanceStats[0]?.out_scans || 0;
    const attendanceRate = totalEmployees > 0 ? parseFloat(((presentToday / totalEmployees) * 100).toFixed(1)) : 0;

    // calculate active users (users who logged in in last 24 hours), best-effort (if lastLogin exists)
    const activeUsers = await User.countDocuments({ isActive: true, lastLogin: { $gte: moment().subtract(24, 'hours').toDate() } });

    // Recent activities: fetch last 5 sub-section additions and last 5 employee transfers
    const SubSection = require('../models/SubSection');
    const TransferToSubsection = require('../models/TransferToSubsection');

    // Get all activities from the past week
    const weekAgoDate = moment().subtract(7, 'days').toDate();
    const recentSubSections = await SubSection.find({ createdAt: { $gte: weekAgoDate } }, {
      'subSection.sub_hie_name': 1,
      createdAt: 1,
      'parentSection.hie_name': 1
    }).sort({ createdAt: -1 });

    const recentTransfers = await TransferToSubsection.find({ transferredAt: { $gte: weekAgoDate } }, {
      employeeName: 1,
      sub_hie_name: 1,
      transferredAt: 1,
      hie_name: 1
    }).sort({ transferredAt: -1 });

    const subSectionActivities = recentSubSections.map(sub => ({
      title: 'New Sub-Section',
      description: `"${sub.subSection.sub_hie_name}" added to section "${sub.parentSection.hie_name}"`,
      date: moment(sub.createdAt).format('YYYY-MM-DD'),
      time: moment(sub.createdAt).format('HH:mm:ss'),
      icon: 'bi bi-diagram-2'
    }));

    const transferActivities = recentTransfers.map(tr => ({
      title: 'Employee Transferred',
      description: `"${tr.employeeName}" transferred to sub-section "${tr.sub_hie_name}" (${tr.hie_name})`,
      date: moment(tr.transferredAt).format('YYYY-MM-DD'),
      time: moment(tr.transferredAt).format('HH:mm:ss'),
      icon: 'bi bi-arrow-left-right'
    }));

    // Combine and sort by date/time descending
    const allActivities = [...subSectionActivities, ...transferActivities]
      .sort((a, b) => {
        const aDate = new Date(`${a.date}T${a.time}`);
        const bDate = new Date(`${b.date}T${b.time}`);
        return bDate - aDate;
      });

    // Only send latest 3 by default, but send all for frontend 'Show All'
    const recentActivities = allActivities;

    const stats = {
      // Keep backwards-compatible keys
      totalUsers,
      // HRIS-backed employee total (preferred)
      hrisTotal: (hrisEmployees && Array.isArray(hrisEmployees) && hrisEmployees.length) ? hrisEmployees.length : null,
      // Aliased/expected keys for frontend
      totalEmployees,
      totalDivisions,
      activeUsers,
      totalSections,
      totalSubSections,
      presentToday,
      attendanceRate,
      todayAttendance: {
        employeesPresent: presentToday,
        totalScans,
        inScans,
        outScans
      },
      weeklyTrend: weeklyStats.map(day => ({
        date: day.date_,
        employees: day.daily_employees
      })),
      recentActivities
    };

    console.log('Dashboard stats generated successfully');
    console.log(`HRIS total employees: ${hrisEmployees && Array.isArray(hrisEmployees) ? hrisEmployees.length : 'N/A'}`);

    res.status(200).json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting dashboard statistics'
    });
  }
};

module.exports = {
  getDashboardStats
};
