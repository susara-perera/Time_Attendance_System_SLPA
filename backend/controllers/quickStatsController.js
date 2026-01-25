/**
 * Quick Stats Controller - Ultra-fast individual stat endpoints
 * For progressive dashboard loading
 */

const { sequelize } = require('../models/mysql');
const { MySQLSubSection: SubSection } = require('../models/mysql');

// @desc    Get divisions count only
// @route   GET /api/quick-stats/divisions
// @access  Private
const getDivisionsCount = async (req, res) => {
  try {
    const [[result]] = await sequelize.query('SELECT COUNT(*) as count FROM divisions_sync');
    res.status(200).json({
      success: true,
      count: result.count,
      stat: 'divisions'
    });
  } catch (error) {
    console.error('Divisions count error:', error);
    res.status(500).json({ success: false, message: 'Failed to get divisions count' });
  }
};

// @desc    Get sections count only
// @route   GET /api/quick-stats/sections
// @access  Private
const getSectionsCount = async (req, res) => {
  try {
    const [[result]] = await sequelize.query('SELECT COUNT(*) as count FROM sections_sync');
    res.status(200).json({
      success: true,
      count: result.count,
      stat: 'sections'
    });
  } catch (error) {
    console.error('Sections count error:', error);
    res.status(500).json({ success: false, message: 'Failed to get sections count' });
  }
};

// @desc    Get subsections count only
// @route   GET /api/quick-stats/subsections
// @access  Private
const getSubsectionsCount = async (req, res) => {
  try {
    const mongoose = require('mongoose');
    let count = 0;
    
    if (mongoose.connection.readyState === 1) {
      count = await SubSection.countDocuments();
    }
    
    res.status(200).json({
      success: true,
      count: count,
      stat: 'subsections'
    });
  } catch (error) {
    console.error('Subsections count error:', error);
    res.status(500).json({ success: false, message: 'Failed to get subsections count' });
  }
};

// @desc    Get employees count only
// @route   GET /api/quick-stats/employees
// @access  Private
const getEmployeesCount = async (req, res) => {
  try {
    const [[result]] = await sequelize.query('SELECT COUNT(*) as count FROM employees_sync WHERE IS_ACTIVE = 1');
    res.status(200).json({
      success: true,
      count: result.count,
      stat: 'employees'
    });
  } catch (error) {
    console.error('Employees count error:', error);
    res.status(500).json({ success: false, message: 'Failed to get employees count' });
  }
};

// @desc    Get IS attendance data only
// @route   GET /api/quick-stats/is-attendance
// @access  Private
const getISAttendance = async (req, res) => {
  try {
    const moment = require('moment');
    const isDivCode = process.env.IS_DIV_CODE || '66';
    const today = moment().format('YYYY-MM-DD');
    
    // Get 7-day trend
    const dailyDates = [];
    for (let i = 6; i >= 0; i--) {
      dailyDates.push(moment().subtract(i, 'days').format('YYYY-MM-DD'));
    }

    const isAttendanceTrend = [];
    for (const date of dailyDates) {
      const [[dayStats]] = await sequelize.query(`
        SELECT COUNT(DISTINCT a.employee_id) as present_count
        FROM attendance a
        INNER JOIN employees_sync e ON a.employee_id = e.EMP_NO
        WHERE DATE(a.date_) = ? 
          AND e.DIV_CODE = ?
          AND e.IS_ACTIVE = 1
          AND (a.fingerprint_id NOT LIKE '%Emergancy Exit%' OR a.fingerprint_id IS NULL)
      `, { replacements: [date, isDivCode] });
      
      isAttendanceTrend.push({
        date: date,
        employees: dayStats?.present_count || 0
      });
    }

    // Get present/absent for today
    const [allISEmployees] = await sequelize.query(`
      SELECT EMP_NO, EMP_NAME, DIV_CODE, SEC_CODE
      FROM employees_sync
      WHERE DIV_CODE = ? AND IS_ACTIVE = 1
    `, { replacements: [isDivCode] });

    const [presentToday] = await sequelize.query(`
      SELECT DISTINCT e.EMP_NO, e.EMP_NAME, e.DIV_CODE, e.SEC_CODE
      FROM employees_sync e
      INNER JOIN attendance a ON e.EMP_NO = a.employee_id
      WHERE e.DIV_CODE = ? 
        AND e.IS_ACTIVE = 1
        AND DATE(a.date_) = ?
        AND (a.fingerprint_id NOT LIKE '%Emergancy Exit%' OR a.fingerprint_id IS NULL)
      ORDER BY e.EMP_NAME
    `, { replacements: [isDivCode, today] });

    const presentISEmployees = presentToday.map(emp => ({
      empNo: emp.EMP_NO,
      empName: emp.EMP_NAME,
      divCode: emp.DIV_CODE,
      secCode: emp.SEC_CODE
    }));

    const presentEmpNos = new Set(presentToday.map(e => e.EMP_NO));
    const absentISEmployees = allISEmployees
      .filter(emp => !presentEmpNos.has(emp.EMP_NO))
      .map(emp => ({
        empNo: emp.EMP_NO,
        empName: emp.EMP_NAME,
        divCode: emp.DIV_CODE,
        secCode: emp.SEC_CODE
      }));

    res.status(200).json({
      success: true,
      data: {
        weeklyTrend: isAttendanceTrend,
        presentTodayIS: presentISEmployees,
        absentTodayIS: absentISEmployees,
        presentTodayISCount: presentISEmployees.length,
        absentTodayISCount: absentISEmployees.length,
        totalEmployeesIS: presentISEmployees.length + absentISEmployees.length
      },
      stat: 'is_attendance'
    });
  } catch (error) {
    console.error('IS attendance error:', error);
    res.status(500).json({ success: false, message: 'Failed to get IS attendance' });
  }
};

module.exports = {
  getDivisionsCount,
  getSectionsCount,
  getSubsectionsCount,
  getEmployeesCount,
  getISAttendance
};
