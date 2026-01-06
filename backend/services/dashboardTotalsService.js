const { sequelize } = require('../config/mysql');
const DivisionSync = require('../models/mysql/DivisionSync');
const SectionSync = require('../models/mysql/SectionSync');
const EmployeeSync = require('../models/mysql/EmployeeSync');
const SubSection = require('../models/SubSection');

/**
 * Service to update dashboard totals cache table for fast dashboard loading
 */

/**
 * Update total counts in dashboard cache table
 */
const updateDashboardTotals = async () => {
  try {
    console.log('📊 [DASHBOARD] Updating dashboard totals...');

    // Count from MySQL sync tables (fast indexed queries using raw SQL)
    const [[divisionsResult], [sectionsResult], [activeEmployeesResult]] = await Promise.all([
      sequelize.query('SELECT COUNT(*) as count FROM divisions_sync'),
      sequelize.query('SELECT COUNT(*) as count FROM sections_sync'),
      sequelize.query('SELECT COUNT(*) as count FROM employees_sync')
    ]);

    const divisionsCount = divisionsResult[0].count;
    const sectionsCount = sectionsResult[0].count;
    const activeEmployeesCount = activeEmployeesResult[0].count;

    // Count subsections from MongoDB (with connection check)
    let subsectionsCount = 0;
    try {
      const mongoose = require('mongoose');
      if (mongoose.connection.readyState === 1) {
        subsectionsCount = await SubSection.countDocuments();
      } else {
        console.warn('⚠️ [DASHBOARD] MongoDB not connected, skipping subsection count');
      }
    } catch (mongoErr) {
      console.warn('⚠️ [DASHBOARD] Failed to count subsections:', mongoErr.message);
    }

    // Update or insert the single row in total_count_dashboard
    await sequelize.query(`
      INSERT INTO total_count_dashboard (id, totalDivisions, totalSections, totalSubsections, totalActiveEmployees, totalInactiveEmployees)
      VALUES (1, :divisions, :sections, :subsections, :activeEmployees, 0)
      ON DUPLICATE KEY UPDATE
        totalDivisions = :divisions,
        totalSections = :sections,
        totalSubsections = :subsections,
        totalActiveEmployees = :activeEmployees,
        totalInactiveEmployees = 0,
        last_updated = CURRENT_TIMESTAMP
    `, {
      replacements: {
        divisions: divisionsCount,
        sections: sectionsCount,
        subsections: subsectionsCount,
        activeEmployees: activeEmployeesCount
      }
    });

    console.log('✅ [DASHBOARD] Dashboard totals updated successfully');
    console.log(`   📊 Divisions: ${divisionsCount}, Sections: ${sectionsCount}, SubSections: ${subsectionsCount}, Active Employees: ${activeEmployeesCount}`);

    return {
      success: true,
      totals: {
        totalDivisions: divisionsCount,
        totalSections: sectionsCount,
        totalSubsections: subsectionsCount,
        totalActiveEmployees: activeEmployeesCount,
        totalInactiveEmployees: 0
      }
    };

  } catch (error) {
    console.error('❌ [DASHBOARD] Failed to update dashboard totals:', error.message);
    throw error;
  }
};

/**
 * Get cached dashboard totals (very fast query - single row)
 */
const getDashboardTotals = async () => {
  try {
    const [results] = await sequelize.query(`
      SELECT 
        totalDivisions,
        totalSections,
        totalSubsections,
        totalActiveEmployees,
        totalInactiveEmployees,
        last_updated
      FROM total_count_dashboard
      WHERE id = 1
      LIMIT 1
    `);

    if (results && results.length > 0) {
      return {
        success: true,
        data: results[0],
        cached: true
      };
    }

    // If no data, return zeros
    return {
      success: true,
      data: {
        totalDivisions: 0,
        totalSections: 0,
        totalSubsections: 0,
        totalActiveEmployees: 0,
        totalInactiveEmployees: 0,
        last_updated: null
      },
      cached: false
    };

  } catch (error) {
    console.error('❌ [DASHBOARD] Failed to get dashboard totals:', error.message);
    throw error;
  }
};

/**
 * Initialize dashboard totals table (create and populate)
 */
const initializeDashboardTotals = async () => {
  try {
    const fs = require('fs');
    const path = require('path');

    // Create table if not exists
    const sqlPath = path.join(__dirname, '..', 'config', 'createDashboardTable.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await sequelize.query(sql);

    console.log('✅ [DASHBOARD] Dashboard totals table initialized');

    // Update counts
    await updateDashboardTotals();

  } catch (error) {
    console.error('❌ [DASHBOARD] Failed to initialize dashboard totals:', error.message);
    throw error;
  }
};

module.exports = {
  updateDashboardTotals,
  getDashboardTotals,
  initializeDashboardTotals
};
