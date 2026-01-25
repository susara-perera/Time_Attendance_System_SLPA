require('dotenv').config();
const mysql = require('mysql2/promise');

async function addDashboardColumns() {
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || 'localhost',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'gads71',
    database: process.env.MYSQL_DATABASE || 'slpa_db'
  });

  try {
    console.log('🔧 Adding new columns to total_count_dashboard table...\n');
    
    // Check if columns exist first
    const [columns] = await conn.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'total_count_dashboard'
    `);
    
    const existingColumns = columns.map(c => c.COLUMN_NAME);
    
    // Add attendance_trend_data column if not exists
    if (!existingColumns.includes('attendance_trend_data')) {
      console.log('Adding attendance_trend_data column...');
      await conn.execute(`
        ALTER TABLE total_count_dashboard 
        ADD COLUMN attendance_trend_data JSON COMMENT 'Last 7 days attendance trend [{date, employees}]'
      `);
      console.log('✅ attendance_trend_data column added');
    } else {
      console.log('⏭️  attendance_trend_data column already exists');
    }
    
    // Add is_division_attendance column if not exists
    if (!existingColumns.includes('is_division_attendance')) {
      console.log('Adding is_division_attendance column...');
      await conn.execute(`
        ALTER TABLE total_count_dashboard 
        ADD COLUMN is_division_attendance JSON COMMENT 'IS division attendance data {presentToday, absentToday, totalEmployees}'
      `);
      console.log('✅ is_division_attendance column added');
    } else {
      console.log('⏭️  is_division_attendance column already exists');
    }
    
    // Drop old present_absent_IS column if exists
    if (existingColumns.includes('present_absent_IS')) {
      console.log('Dropping old present_absent_IS column...');
      await conn.execute(`
        ALTER TABLE total_count_dashboard 
        DROP COLUMN present_absent_IS
      `);
      console.log('✅ present_absent_IS column removed');
    }
    
    // Show final structure
    console.log('\n📋 Updated Table Structure:');
    const [finalColumns] = await conn.execute('DESCRIBE total_count_dashboard');
    finalColumns.forEach(col => {
      console.log(`  ${col.Field.padEnd(30)} ${col.Type.padEnd(20)} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    
    console.log('\n✅ Schema update complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await conn.end();
    process.exit(0);
  }
}

addDashboardColumns();
