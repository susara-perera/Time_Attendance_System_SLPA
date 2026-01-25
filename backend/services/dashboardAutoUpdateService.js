/**
 * Dashboard Auto-Update Service
 * Automatically updates total_count_dashboard when entities change
 */

const { sequelize } = require('../config/mysql');

/**
 * Update just the subsections count in dashboard cache
 * Called automatically after subsection create/update/delete
 */
async function updateSubsectionsCount() {
  try {
    // Count from MySQL sub_sections table
    const [[result]] = await sequelize.query('SELECT COUNT(*) as count FROM sub_sections');
    const subsectionsCount = result.count;
    
    await sequelize.query(`
      UPDATE total_count_dashboard 
      SET totalSubsections = :count, 
          last_updated = CURRENT_TIMESTAMP
      WHERE id = 1
    `, {
      replacements: { count: subsectionsCount }
    });

    console.log(`✅ [DashboardAutoUpdate] Subsections count updated: ${subsectionsCount}`);
    return subsectionsCount;
  } catch (error) {
    console.error('❌ [DashboardAutoUpdate] Failed to update subsections count:', error.message);
  }
}

/**
 * Update just the divisions count in dashboard cache
 * Called automatically after division sync
 */
async function updateDivisionsCount() {
  try {
    const [[result]] = await sequelize.query('SELECT COUNT(*) as count FROM divisions_sync');
    const divisionsCount = result.count;
    
    await sequelize.query(`
      UPDATE total_count_dashboard 
      SET totalDivisions = :count, 
          last_updated = CURRENT_TIMESTAMP
      WHERE id = 1
    `, {
      replacements: { count: divisionsCount }
    });

    console.log(`✅ [DashboardAutoUpdate] Divisions count updated: ${divisionsCount}`);
    return divisionsCount;
  } catch (error) {
    console.error('❌ [DashboardAutoUpdate] Failed to update divisions count:', error.message);
  }
}

/**
 * Update just the sections count in dashboard cache
 * Called automatically after section sync
 */
async function updateSectionsCount() {
  try {
    const [[result]] = await sequelize.query('SELECT COUNT(*) as count FROM sections_sync');
    const sectionsCount = result.count;
    
    await sequelize.query(`
      UPDATE total_count_dashboard 
      SET totalSections = :count, 
          last_updated = CURRENT_TIMESTAMP
      WHERE id = 1
    `, {
      replacements: { count: sectionsCount }
    });

    console.log(`✅ [DashboardAutoUpdate] Sections count updated: ${sectionsCount}`);
    return sectionsCount;
  } catch (error) {
    console.error('❌ [DashboardAutoUpdate] Failed to update sections count:', error.message);
  }
}

/**
 * Update just the employees count in dashboard cache
 * Called automatically after employee sync
 */
async function updateEmployeesCount() {
  try {
    const [[result]] = await sequelize.query('SELECT COUNT(*) as count FROM employees_sync');
    const employeesCount = result.count;
    
    await sequelize.query(`
      UPDATE total_count_dashboard 
      SET totalActiveEmployees = :count, 
          last_updated = CURRENT_TIMESTAMP
      WHERE id = 1
    `, {
      replacements: { count: employeesCount }
    });

    console.log(`✅ [DashboardAutoUpdate] Employees count updated: ${employeesCount}`);
    return employeesCount;
  } catch (error) {
    console.error('❌ [DashboardAutoUpdate] Failed to update employees count:', error.message);
  }
}

module.exports = {
  updateSubsectionsCount,
  updateDivisionsCount,
  updateSectionsCount,
  updateEmployeesCount
};
