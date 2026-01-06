/**
 * MySQL Employee Controller - Uses synced MySQL data instead of HRIS API
 */

const {
  getEmployeesFromMySQL,
  getEmployeeFromMySQL
} = require('../services/mysqlDataService');

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

    const filters = { search, divisionCode, sectionCode, designation };
    const employees = await getEmployeesFromMySQL(filters);

    res.status(200).json({
      success: true,
      count: employees.length,
      data: employees,
      source: 'MySQL Sync',
      message: 'Data fetched from synced MySQL tables (faster than HRIS API)'
    });

  } catch (error) {
    console.error('[MySQL Employee Controller] Get employees error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch employees from MySQL',
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
    const employee = await getEmployeeFromMySQL(empNo);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: `Employee with number ${empNo} not found`
      });
    }

    res.status(200).json({
      success: true,
      data: employee,
      source: 'MySQL Sync'
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

module.exports = {
  getMySQLEmployees,
  getMySQLEmployeeByNumber
};
