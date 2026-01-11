/**
 * MySQL Section Controller - Uses cached data with fallback to MySQL
 */

const cacheDataService = require('../services/cacheDataService');
const {
  getSectionsFromMySQL,
  getSectionFromMySQL,
  getEmployeeCountBySection
} = require('../services/mysqlDataService');

// @desc    Get all sections from MySQL
// @route   GET /api/mysql/sections
// @access  Private
const getMySQLSections = async (req, res) => {
  try {
    const {
      search,
      divisionCode,
      status,
      page = 1,
      limit = 1000
    } = req.query;

    const filters = { search, divisionCode, status };
    
    // Try cache first with intelligent fallback
    const sections = await cacheDataService.getSections(filters);

    // Add employee counts if requested
    if (req.query.includeEmployeeCount === 'true') {
      for (const section of sections) {
        section.employeeCount = await getEmployeeCountBySection(section.HIE_CODE);
      }
    }

    res.status(200).json({
      success: true,
      count: sections.length,
      data: sections,
      source: 'Cache + MySQL',
      message: 'Data fetched from cache with MySQL fallback (lightning fast!)'
    });

  } catch (error) {
    console.error('[MySQL Section Controller] Get sections error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sections from MySQL',
      error: error.message
    });
  }
};

// @desc    Get single section from MySQL
// @route   GET /api/mysql/sections/:code
// @access  Private
const getMySQLSectionByCode = async (req, res) => {
  try {
    const { code } = req.params;
    
    // Try cache first
    const section = await cacheDataService.getSectionByCode(code);

    if (!section) {
      return res.status(404).json({
        success: false,
        message: `Section with code ${code} not found`
      });
    }

    // Add employee count
    section.employeeCount = await getEmployeeCountBySection(section.HIE_CODE);

    res.status(200).json({
      success: true,
      data: section,
      source: 'Cache + MySQL'
    });

  } catch (error) {
    console.error('[MySQL Section Controller] Get section error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch section from MySQL',
      error: error.message
    });
  }
};

module.exports = {
  getMySQLSections,
  getMySQLSectionByCode
};
