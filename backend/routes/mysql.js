const express = require('express');
const { createMySQLConnection } = require('../config/mysql');
const { auth } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/mysql/divisions
// @desc    Get all divisions from MySQL database
// @access  Private
router.get('/divisions', auth, async (req, res) => {
  try {
    const connection = await createMySQLConnection();
    
    const [divisions] = await connection.execute(`
      SELECT division_id, division_name 
      FROM divisions 
      ORDER BY division_name ASC
    `);
    
    await connection.end();
    
    res.status(200).json({
      success: true,
      divisions: divisions
    });
    
  } catch (error) {
    console.error('MySQL Divisions fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching divisions: ' + error.message
    });
  }
});

// @route   GET /api/mysql/sections
// @desc    Get all sections from MySQL database (optionally filtered by division)
// @access  Private
router.get('/sections', auth, async (req, res) => {
  try {
    const { division_id } = req.query;
    const connection = await createMySQLConnection();
    
    let sql = `
      SELECT s.section_id, s.section_name, s.division_id, d.division_name
      FROM sections s
      LEFT JOIN divisions d ON s.division_id = d.division_id
    `;
    let params = [];
    
    if (division_id && division_id !== 'all') {
      sql += ' WHERE s.division_id = ?';
      params.push(division_id);
    }
    
    sql += ' ORDER BY d.division_name ASC, s.section_name ASC';
    
    const [sections] = await connection.execute(sql, params);
    
    await connection.end();
    
    res.status(200).json({
      success: true,
      sections: sections
    });
    
  } catch (error) {
    console.error('MySQL Sections fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching sections: ' + error.message
    });
  }
});

module.exports = router;
