require('dotenv').config();
const mysql = require('mysql2/promise');

async function checkCollations() {
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || 'localhost',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'gads71',
    database: process.env.MYSQL_DATABASE || 'slpa_db'
  });

  try {
    console.log('🔍 Checking collations...\n');
    
    // Check employees_sync DIV_CODE collation
    const [empCols] = await conn.execute(`
      SELECT COLUMN_NAME, COLUMN_TYPE, COLLATION_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'employees_sync'
        AND COLUMN_NAME = 'DIV_CODE'
    `);
    console.log('employees_sync.DIV_CODE:', empCols[0]);
    
    // Check attendance_sync table
    const [attCols] = await conn.execute(`
      SELECT COLUMN_NAME, COLUMN_TYPE, COLLATION_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'attendance_sync'
        AND COLUMN_NAME IN ('employee_id', 'status', 'attendance_date')
    `);
    console.log('\nattendance_sync columns:');
    attCols.forEach(col => console.log('  ', col));
    
    // Try the query with COLLATE
    console.log('\n🧪 Testing query with explicit collation...');
    const isDivCode = '66';
    const today = '2026-01-23';
    
    const [result] = await conn.execute(`
      SELECT COUNT(DISTINCT a.employee_id) as count
      FROM attendance_sync a
      JOIN employees_sync e ON a.employee_id = e.EMP_NO
      WHERE a.attendance_date = ? 
        AND a.status = 'present'
        AND e.DIV_CODE COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci
    `, [today, isDivCode]);
    
    console.log('✅ Result:', result[0]);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await conn.end();
    process.exit(0);
  }
}

checkCollations();
