const User = require('../models/User');
const Division = require('../models/Division');
const Section = require('../models/Section');
const Attendance = require('../models/Attendance');
const { createMySQLConnection } = require('../config/mysql');
const moment = require('moment');

// @desc    Get dashboard statistics
// @route   GET /api/dashboard/stats
// @access  Private
const getDashboardStats = async (req, res) => {
  try {
    console.log('Getting dashboard statistics...');

    // Get basic counts from MongoDB
    const [totalUsers, totalDivisions, totalSections] = await Promise.all([
      User.countDocuments({ isActive: true }),
      Division.countDocuments({ isActive: true }),
      Section.countDocuments({ isActive: true })
    ]);

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

    const stats = {
      totalUsers,
      totalDivisions, 
      totalSections,
      todayAttendance: {
        employeesPresent: attendanceStats[0]?.employees_present || 0,
        totalScans: attendanceStats[0]?.total_scans || 0,
        inScans: attendanceStats[0]?.in_scans || 0,
        outScans: attendanceStats[0]?.out_scans || 0
      },
      weeklyTrend: weeklyStats.map(day => ({
        date: day.date_,
        employees: day.daily_employees
      }))
    };

    console.log('Dashboard stats generated successfully');

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
