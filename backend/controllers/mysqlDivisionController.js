/**
 * MySQL Division Controller - Uses synced MySQL data instead of HRIS API
 */

const {
  getDivisionsFromMySQL,
  getDivisionFromMySQL,
  getEmployeeCountByDivision
} = require('../services/mysqlDataService');

// @desc    Get all divisions from MySQL
// @route   GET /api/mysql/divisions
// @access  Private
const getMySQLDivisions = async (req, res) => {
  try {
    const {
      search,
      status,
      page = 1,
      limit = 1000
    } = req.query;

    const filters = { search, status };
    const divisions = await getDivisionsFromMySQL(filters);

    // Add employee counts if requested
    if (req.query.includeEmployeeCount === 'true') {
      for (const division of divisions) {
        division.employeeCount = await getEmployeeCountByDivision(division.HIE_CODE);
      }
    }

    res.status(200).json({
      success: true,
      count: divisions.length,
      data: divisions,
      source: 'MySQL Sync',
      message: 'Data fetched from synced MySQL tables (faster than HRIS API)'
    });

  } catch (error) {
    console.error('[MySQL Division Controller] Get divisions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch divisions from MySQL',
      error: error.message
    });
  }
};

// @desc    Get single division from MySQL
// @route   GET /api/mysql/divisions/:code
// @access  Private
const getMySQLDivisionByCode = async (req, res) => {
  try {
    const { code } = req.params;
    const division = await getDivisionFromMySQL(code);

    if (!division) {
      return res.status(404).json({
        success: false,
        message: `Division with code ${code} not found`
      });
    }

    // Add employee count
    division.employeeCount = await getEmployeeCountByDivision(division.HIE_CODE);

    res.status(200).json({
      success: true,
      data: division,
      source: 'MySQL Sync'
    });

  } catch (error) {
    console.error('[MySQL Division Controller] Get division error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch division from MySQL',
      error: error.message
    });
  }
};

module.exports = {
  getMySQLDivisions,
  getMySQLDivisionByCode
};
