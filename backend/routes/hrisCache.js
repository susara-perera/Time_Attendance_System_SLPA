const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const { sequelize } = require('../models/mysql');

// @route   GET /api/hris-cache/status
// @desc    Get MySQL sync tables status (replaces HRIS cache)
// @access  Private
router.get('/status', auth, async (req, res) => {
  try {
    const [[divCount]] = await sequelize.query('SELECT COUNT(*) as count FROM divisions_sync');
    const [[secCount]] = await sequelize.query('SELECT COUNT(*) as count FROM sections_sync');
    const [[empCount]] = await sequelize.query('SELECT COUNT(*) as count FROM employees_sync WHERE IS_ACTIVE = 1');

    res.status(200).json({
      success: true,
      data: {
        isInitialized: true,
        divisionsCount: divCount?.count || 0,
        sectionsCount: secCount?.count || 0,
        employeesCount: empCount?.count || 0,
        hasDivisions: divCount?.count > 0,
        hasSections: secCount?.count > 0,
        hasEmployees: empCount?.count > 0,
        source: 'MySQL'
      }
    });
  } catch (error) {
    console.error('Get cache status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting MySQL sync status'
    });
  }
});

// @route   POST /api/hris-cache/refresh
// @desc    Trigger manual HRIS sync to MySQL
// @access  Private (super_admin only)
router.post('/refresh', auth, authorize('super_admin'), async (req, res) => {
  try {
    console.log('🔄 Manual sync refresh requested by:', req.user.email);
    const { triggerManualSync } = require('../services/hrisSyncScheduler');
    await triggerManualSync(req.user.email);

    res.status(200).json({
      success: true,
      message: 'MySQL sync completed successfully'
    });
  } catch (error) {
    console.error('Refresh sync error:', error);
    res.status(500).json({
      success: false,
      message: 'Error running sync'
    });
  }
});

// @route   POST /api/hris-cache/clear
// @desc    Clear sync (deprecated - no-op)
// @access  Private (super_admin only)
router.post('/clear', auth, authorize('super_admin'), async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'No action needed - data persists in MySQL'
  });
});

// @route   GET /api/hris-cache/employees
// @desc    Get all employees from MySQL sync table
// @access  Private
router.get('/employees', auth, async (req, res) => {
  try {
    const [employees] = await sequelize.query(`
      SELECT 
        EMP_NO as EMP_NUMBER,
        EMP_NAME as FULLNAME,
        EMP_FIRST_NAME as CALLING_NAME,
        EMP_NIC as NIC,
        EMP_DESIGNATION as DESIGNATION,
        EMP_DATE_JOINED as DATE_JOINED,
        DIV_CODE as DIVISION_CODE,
        DIV_NAME as DIVISION_NAME,
        SEC_CODE as SECTION_CODE,
        SEC_NAME as SECTION_NAME,
        STATUS,
        IS_ACTIVE
      FROM employees_sync 
      WHERE IS_ACTIVE = 1 
      ORDER BY EMP_NAME ASC
    `);

    res.status(200).json({
      success: true,
      data: employees,
      source: 'MySQL'
    });
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting employees from MySQL'
    });
  }
});

module.exports = router;
