const mysql = require('mysql2/promise');

async function runMigration() {
  let connection;
  try {
    console.log('Connecting to MySQL...');
    
    // Create connection with credentials
    connection = await mysql.createConnection({
      host: '127.0.0.1',
      port: 3306,
      user: 'root',
      password: 'gads71',
      database: 'slpa_db'
    });
    
    console.log('✅ Connected to MySQL');
    console.log('\nRunning migration: Adding IS attendance columns...\n');

    // Add IS_attendance_trend column
    await connection.execute(`
      ALTER TABLE total_count_dashboard 
      ADD COLUMN IF NOT EXISTS IS_attendance_trend JSON 
      COMMENT '7-day attendance trend for IS division (DIV_CODE=66)'
    `);
    console.log('✓ Added IS_attendance_trend column');

    // Add present_IS column
    await connection.execute(`
      ALTER TABLE total_count_dashboard 
      ADD COLUMN IF NOT EXISTS present_IS JSON 
      COMMENT 'Present employees in IS division for today'
    `);
    console.log('✓ Added present_IS column');

    // Add absent_IS column
    await connection.execute(`
      ALTER TABLE total_count_dashboard 
      ADD COLUMN IF NOT EXISTS absent_IS JSON 
      COMMENT 'Absent employees in IS division for today'
    `);
    console.log('✓ Added absent_IS column');

    // Add is_division_attendance column
    await connection.execute(`
      ALTER TABLE total_count_dashboard 
      ADD COLUMN IF NOT EXISTS is_division_attendance JSON 
      COMMENT 'All IS division employees with division, section, and presence status'
    `);
    console.log('✓ Added is_division_attendance column');

    // Show table structure
    console.log('\n📋 Current table structure:');
    const [columns] = await connection.execute('DESCRIBE total_count_dashboard');
    console.table(columns);

    console.log('\n✅ Migration completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Go to Manual Sync page in your application');
    console.log('2. Click "Sync total_count_dashboard" button');
    console.log('3. The new columns will be populated with IS division attendance data');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n✅ Database connection closed');
    }
    process.exit(0);
  }
}

runMigration();
