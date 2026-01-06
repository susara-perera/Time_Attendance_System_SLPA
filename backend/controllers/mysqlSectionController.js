/**
 * MySQL Section Controller - Uses synced MySQL data instead of HRIS API
 */

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
    const sections = await getSectionsFromMySQL(filters);

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
      source: 'MySQL Sync',
      message: 'Data fetched from synced MySQL tables (faster than HRIS API)'
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
    const section = await getSectionFromMySQL(code);

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
      source: 'MySQL Sync'
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
