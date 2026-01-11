/**
 * MySQL Employee Controller - Uses cached data with fallback to MySQL
 */

const cacheDataService = require('../services/cacheDataService');
const {
  getEmployeesFromMySQL,
  getEmployeeFromMySQL
} = require('../services/mysqlDataService');
const mysqlDb = require('../config/mysql');

// @desc    Get all employees from MySQL
// @route   GET /api/mysql/employees
// @access  Private
const getMySQLEmployees = async (req, res) => {
  try {
    const {
      search,
      divisionCode,
      sectionCode,
      designation,
      page = 1,
      limit = 1000
    } = req.query;

    const filters = { search, divisionCode, sectionCode, designation, page, limit };
    
    // Try cache first with intelligent fallback
    const employees = await cacheDataService.getEmployees(filters);

    res.status(200).json({
      success: true,
      count: employees.length,
      data: employees,
      source: 'Cache + MySQL',
      message: 'Data fetched from cache with MySQL fallback (ultra fast!)'
    });

  } catch (error) {
    console.error('[MySQL Employee Controller] Get employees error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch employees',
      error: error.message
    });
  }
};

// @desc    Get single employee from MySQL
// @route   GET /api/mysql/employees/:empNo
// @access  Private
const getMySQLEmployeeByNumber = async (req, res) => {
  try {
    const { empNo } = req.params;

    // Try cache first
    const employee = await cacheDataService.getEmployeeById(empNo);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: `Employee with number ${empNo} not found`
      });
    }

    res.status(200).json({
      success: true,
      data: employee,
      source: 'Cache + MySQL'
    });

  } catch (error) {
    console.error('[MySQL Employee Controller] Get employee error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch employee from MySQL',
      error: error.message
    });
  }
};

// @desc    Get unique employee IDs from attendance table based on date range
// @route   GET /api/mysql-data/attendance/employees-by-date
// @access  Private
const getEmployeesByDateFromAttendance = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }

    console.log(`[MySQL Employee Controller] Fetching employees from attendance table for date range: ${startDate} to ${endDate}`);

    const query = `
      SELECT DISTINCT employee_ID 
      FROM attendance 
      WHERE date_ BETWEEN ? AND ?
      ORDER BY employee_ID
    `;

    const [rows] = await mysqlDb.execute(query, [startDate, endDate]);
    const employeeIds = rows.map(row => String(row.employee_ID)).filter(id => id);

    console.log(`[MySQL Employee Controller] Found ${employeeIds.length} unique employees in attendance table for date range`);

    res.status(200).json({
      success: true,
      count: employeeIds.length,
      employeeIds: employeeIds,
      dateRange: { startDate, endDate },
      source: 'Attendance Table'
    });

  } catch (error) {
    console.error('[MySQL Employee Controller] Get employees by date error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch employees from attendance table',
      error: error.message
    });
  }
};

module.exports = {
  getMySQLEmployees,
  getMySQLEmployeeByNumber,
  getEmployeesByDateFromAttendance
};
