/**
 * MySQL Division Controller - Uses cached data with fallback to MySQL
 */

const cacheDataService = require('../services/cacheDataService');
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
    
    // Try cache first, fallback to MySQL
    const divisions = await cacheDataService.getDivisions(filters);

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
      source: 'Cache + MySQL',
      message: 'Data fetched from cache with MySQL fallback (blazing fast!)'
    });

  } catch (error) {
    console.error('[MySQL Division Controller] Get divisions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch divisions',
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

    // Try cache first
    const division = await cacheDataService.getDivisionByCode(code);

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
      source: 'Cache + MySQL'
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
