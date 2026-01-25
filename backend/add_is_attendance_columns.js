require('dotenv').config();
const { sequelize } = require('./config/mysql');

/**
 * Migration to add IS division attendance tracking columns
 * Columns:
 * - IS_attendance_trend: JSON array with 7-day attendance trend for IS division
 * - present_IS: JSON array with present employee details for today
 * - absent_IS: JSON array with absent employee details for today
 */
async function addISAttendanceColumns() {
  try {
    console.log('Starting migration: Adding IS attendance columns to total_count_dashboard...');

    // Add IS_attendance_trend column (JSON for 7-day trend data)
    await sequelize.query(`
      ALTER TABLE total_count_dashboard 
      ADD COLUMN IF NOT EXISTS IS_attendance_trend JSON COMMENT '7-day attendance trend for IS division (DIV_CODE=66)';
    `);
    console.log('✓ Added IS_attendance_trend column');

    // Add present_IS column (JSON for present employees list)
    await sequelize.query(`
      ALTER TABLE total_count_dashboard 
      ADD COLUMN IF NOT EXISTS present_IS JSON COMMENT 'Present employees in IS division for today';
    `);
    console.log('✓ Added present_IS column');

    // Add absent_IS column (JSON for absent employees list)
    await sequelize.query(`
      ALTER TABLE total_count_dashboard 
      ADD COLUMN IF NOT EXISTS absent_IS JSON COMMENT 'Absent employees in IS division for today';
    `);
    console.log('✓ Added absent_IS column');

    console.log('Migration completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Run total_count_dashboard sync from Manual Sync page');
    console.log('2. Check that IS attendance data is populated');
    
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
addISAttendanceColumns();
