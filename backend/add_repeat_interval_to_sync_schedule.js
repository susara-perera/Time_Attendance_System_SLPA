/**
 * Migration Script: Add repeat_interval and repeat_enabled columns to sync_schedules table
 */

const { sequelize } = require('./models/mysql');
require('dotenv').config();

async function addRepeatColumns() {
  try {
    console.log('🔧 Starting migration: Adding repeat columns to sync_schedules...');

    // Check if columns already exist
    const [columns] = await sequelize.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'sync_schedules' 
        AND COLUMN_NAME IN ('repeat_interval', 'repeat_enabled')
    `);

    const existingColumns = columns.map(col => col.COLUMN_NAME);

    // Add repeat_interval column if it doesn't exist
    if (!existingColumns.includes('repeat_interval')) {
      console.log('📝 Adding repeat_interval column...');
      await sequelize.query(`
        ALTER TABLE sync_schedules 
        ADD COLUMN repeat_interval ENUM(
          'none', 
          'every_30_seconds', 
          'every_minute', 
          'every_5_minutes', 
          'every_15_minutes', 
          'every_30_minutes', 
          'hourly', 
          'daily', 
          'weekly'
        ) DEFAULT 'none' 
        COMMENT 'Repeat interval for recurring schedules'
      `);
      console.log('✅ repeat_interval column added');
    } else {
      console.log('ℹ️  repeat_interval column already exists');
    }

    // Add repeat_enabled column if it doesn't exist
    if (!existingColumns.includes('repeat_enabled')) {
      console.log('📝 Adding repeat_enabled column...');
      await sequelize.query(`
        ALTER TABLE sync_schedules 
        ADD COLUMN repeat_enabled BOOLEAN DEFAULT FALSE 
        COMMENT 'Enable or disable recurring schedule'
      `);
      console.log('✅ repeat_enabled column added');
    } else {
      console.log('ℹ️  repeat_enabled column already exists');
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📋 Next Steps:');
    console.log('   1. Restart your backend server');
    console.log('   2. Go to Manual Sync page');
    console.log('   3. Set tasks to Auto mode and select repeat intervals');
    console.log('   4. Set start date/time if needed (optional for recurring tasks)');
    console.log('   5. The scheduler will automatically run tasks based on repeat interval\n');

    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

addRepeatColumns();
