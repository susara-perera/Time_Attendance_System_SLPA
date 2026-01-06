/**
 * Initialize Attendance Sync Tables
 * 
 * Creates the attendance_sync, attendance_punches_sync, report_cache,
 * and attendance_daily_stats tables for fast report generation
 */

const fs = require('fs');
const path = require('path');
const { sequelize } = require('../models/mysql');

const initializeAttendanceSyncTables = async () => {
  try {
    console.log('🚀 Starting attendance sync table initialization...\n');

    // Read SQL file
    const sqlPath = path.join(__dirname, '../config/createAttendanceSyncTable.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Remove comments and split by semicolon
    const statements = sql
      .split('\n')
      .filter(line => !line.trim().startsWith('--') && line.trim().length > 0)
      .join('\n')
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);

    console.log(`📄 Found ${statements.length} SQL statements to execute\n`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      try {
        // Extract table/view name for logging
        const tableMatch = statement.match(/CREATE.*?TABLE\s+(?:IF NOT EXISTS\s+)?`?(\w+)`?/i);
        const viewMatch = statement.match(/CREATE.*?VIEW\s+(?:OR REPLACE\s+)?`?(\w+)`?/i);
        const objectName = tableMatch ? tableMatch[1] : viewMatch ? viewMatch[1] : `Statement ${i + 1}`;
        
        console.log(`⏳ Creating ${objectName}...`);
        await sequelize.query(statement);
        console.log(`✅ ${objectName} created successfully\n`);
      } catch (error) {
        // Ignore "already exists" errors
        if (error.message.includes('already exists') || error.message.includes('Duplicate')) {
          const match = statement.match(/CREATE.*?(?:TABLE|VIEW)\s+(?:IF NOT EXISTS\s+)?(?:OR REPLACE\s+)?`?(\w+)`?/i);
          const name = match ? match[1] : `Statement ${i + 1}`;
          console.log(`ℹ️  ${name} already exists, skipping\n`);
        } else {
          console.error(`❌ Error executing statement ${i + 1}:`, error.message);
          throw error;
        }
      }
    }

    // Verify tables exist
    console.log('🔍 Verifying tables...\n');
    const [tables] = await sequelize.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME IN (
        'attendance_sync', 
        'attendance_punches_sync', 
        'report_cache', 
        'attendance_daily_stats'
      )
    `);

    console.log('📊 Created tables:');
    tables.forEach(table => {
      console.log(`   ✅ ${table.TABLE_NAME}`);
    });

    // Get row counts
    console.log('\n📈 Table statistics:');
    for (const table of tables) {
      const tableName = table.TABLE_NAME;
      const [count] = await sequelize.query(`SELECT COUNT(*) as count FROM ${tableName}`);
      console.log(`   ${tableName}: ${count[0].count} records`);
    }

    console.log('\n✅ Attendance sync tables initialized successfully!');
    console.log('\n💡 Next steps:');
    console.log('   1. Run: node backend/scripts/initialAttendanceSync.js');
    console.log('   2. Sync will run daily at 12:00 PM automatically');
    console.log('   3. Reports will use fast attendance_sync table');

  } catch (error) {
    console.error('\n❌ Failed to initialize attendance sync tables:', error.message);
    throw error;
  } finally {
    await sequelize.close();
  }
};

// Run if called directly
if (require.main === module) {
  initializeAttendanceSyncTables()
    .then(() => {
      console.log('\n🎉 Done!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Initialization failed:', error);
      process.exit(1);
    });
}

module.exports = { initializeAttendanceSyncTables };
