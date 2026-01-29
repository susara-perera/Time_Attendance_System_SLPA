/**
 * Migration Script: Add date_range_start and date_range_end columns to sync_schedules table
 * Run this script once to update the existing database schema
 */

const { sequelize } = require('../config/mysql');

async function addDateRangeColumns() {
  try {
    console.log('🔧 Starting migration: Adding date range columns to sync_schedules...');

    // Check if columns already exist
    const [results] = await sequelize.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'sync_schedules' 
        AND COLUMN_NAME IN ('date_range_start', 'date_range_end')
    `);

    if (results.length === 2) {
      console.log('✅ Columns already exist. No migration needed.');
      return;
    }

    // Add date_range_start column if it doesn't exist
    if (!results.find(r => r.COLUMN_NAME === 'date_range_start')) {
      await sequelize.query(`
        ALTER TABLE sync_schedules 
        ADD COLUMN date_range_start DATE NULL 
        COMMENT 'Start date for date-range specific tasks (like attendance cache)'
      `);
      console.log('✅ Added date_range_start column');
    }

    // Add date_range_end column if it doesn't exist
    if (!results.find(r => r.COLUMN_NAME === 'date_range_end')) {
      await sequelize.query(`
        ALTER TABLE sync_schedules 
        ADD COLUMN date_range_end DATE NULL 
        COMMENT 'End date for date-range specific tasks (like attendance cache)'
      `);
      console.log('✅ Added date_range_end column');
    }

    console.log('🎉 Migration completed successfully!');
    console.log('');
    console.log('📋 Next steps:');
    console.log('   - You can now set date ranges for attendance_cache tasks');
    console.log('   - Use the Manual Sync page to cache attendance with date ranges');
    console.log('   - Schedule automatic caching with specific date ranges');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// Run migration
addDateRangeColumns()
  .then(() => {
    console.log('✅ Script completed');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Script failed:', err);
    process.exit(1);
  });
