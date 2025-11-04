const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { readData } = require('../services/hrisApiService');

// @route   GET /api/hris/employees
// @desc    Get all employees directly from HRIS API (not cached)
// @access  Private
router.get('/employees', auth, async (req, res) => {
  try {
    console.log('📡 Fetching employees directly from HRIS API...');
    
    // Fetch fresh data from HRIS API
    const employees = await readData('employee', {});
    
    console.log(`✅ Fetched ${employees.length} employees from HRIS API`);

    res.status(200).json({
      success: true,
      data: employees
    });
  } catch (error) {
    console.error('❌ Error fetching employees from HRIS API:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching employees from HRIS API: ' + error.message
    });
  }
});

// @route   GET /api/hris/hierarchy
// @desc    Get company hierarchy directly from HRIS API
// @access  Private
router.get('/hierarchy', auth, async (req, res) => {
  try {
    console.log('📡 Fetching company hierarchy directly from HRIS API...');
    
    const hierarchy = await readData('company_hierarchy', {});
    
    console.log(`✅ Fetched ${hierarchy.length} hierarchy items from HRIS API`);

    res.status(200).json({
      success: true,
      data: hierarchy
    });
  } catch (error) {
    console.error('❌ Error fetching hierarchy from HRIS API:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching hierarchy from HRIS API: ' + error.message
    });
  }
});

module.exports = router;
