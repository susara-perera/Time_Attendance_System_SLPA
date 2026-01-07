/**
 * Import attendance.sql file
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function importAttendanceSQL() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'slpa_db',
    multipleStatements: true
  });

  try {
    console.log('� Reading attendance.sql file...');
    const sqlFilePath = 's:\\C_Drive_Link\\Desktop\\attendance.sql';
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

    console.log('📊 File size:', (sqlContent.length / 1024 / 1024).toFixed(2), 'MB');

    console.log('🔄 Executing SQL import...');
    await conn.query(sqlContent);

    console.log('✅ Import completed successfully!');

    // Verify the import
    console.log('🔍 Verifying import...');
    const [rows] = await conn.query('DESCRIBE attendance');
    console.log('New table structure:');
    rows.forEach(row => console.log('  ' + row.Field + ' (' + row.Type + ')'));

    const [count] = await conn.query('SELECT COUNT(*) as count FROM attendance');
    console.log('New record count:', count[0].count);

  } catch (error) {
    console.error('❌ Import failed:', error.message);
    throw error;
  } finally {
    await conn.end();
  }
}

importAttendanceSQL()
  .then(() => {
    console.log('\n🎉 Attendance table overwrite completed!');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n💥 Import failed:', err.message);
    process.exit(1);
  });
