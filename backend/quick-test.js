/**
 * Quick Performance Test - Optimized Queries
 */

require('dotenv').config();
const { sequelize } = require('./models/mysql');
const moment = require('moment');

async function quickTest() {
  console.log('🚀 Quick Performance Test\n');
  
  // Test 1: COUNT vs SELECT * for active employees
  console.log('Test 1: Active Employees');
  let start = Date.now();
  await sequelize.query('SELECT COUNT(*) FROM employees_sync WHERE IS_ACTIVE = 1');
  console.log(`  COUNT query: ${Date.now() - start}ms`);
  
  start = Date.now();
  await sequelize.query('SELECT EMP_NO, EMP_NAME, DIV_CODE FROM employees_sync WHERE IS_ACTIVE = 1');
  console.log(`  SELECT specific columns: ${Date.now() - start}ms`);
  
  // Test 2: IS Division with indexes
  console.log('\nTest 2: IS Division Employees');
  start = Date.now();
  await sequelize.query("SELECT COUNT(*) FROM employees_sync WHERE DIV_CODE = '66' AND IS_ACTIVE = 1");
  console.log(`  COUNT query: ${Date.now() - start}ms`);
  
  start = Date.now();
  await sequelize.query("SELECT * FROM employees_sync WHERE DIV_CODE = '66' AND IS_ACTIVE = 1");
  console.log(`  SELECT * query: ${Date.now() - start}ms`);
  
  // Test 3: Today's IS attendance with JOIN
  console.log('\nTest 3: IS Attendance Today');
  const today = moment().format('YYYY-MM-DD');
  
  start = Date.now();
  await sequelize.query(`
    SELECT COUNT(*) 
    FROM attendance a
    INNER JOIN employees_sync e ON a.employee_ID = e.EMP_NO
    WHERE e.DIV_CODE = '66' AND a.date_ = ?
  `, { replacements: [today] });
  console.log(`  COUNT with JOIN: ${Date.now() - start}ms`);
  
  start = Date.now();
  await sequelize.query(`
    SELECT a.*, e.EMP_NAME, e.SEC_NAME
    FROM attendance a
    INNER JOIN employees_sync e ON a.employee_ID = e.EMP_NO
    WHERE e.DIV_CODE = '66' AND a.date_ = ?
    ORDER BY a.time_ DESC
    LIMIT 500
  `, { replacements: [today] });
  console.log(`  SELECT with JOIN (limited): ${Date.now() - start}ms`);
  
  // Test 4: Individual attendance
  console.log('\nTest 4: Individual Attendance (30 days)');
  const startDate = moment().subtract(30, 'days').format('YYYY-MM-DD');
  
  start = Date.now();
  await sequelize.query(`
    SELECT * FROM attendance 
    WHERE employee_ID = '465963' 
    AND date_ BETWEEN ? AND ?
  `, { replacements: [startDate, today] });
  console.log(`  SELECT 30 days: ${Date.now() - start}ms`);
  
  // Test 5: Check indexes
  console.log('\nTest 5: Verify Indexes');
  const [indexes] = await sequelize.query(`
    SELECT TABLE_NAME, INDEX_NAME, COLUMN_NAME
    FROM information_schema.statistics
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME IN ('employees_sync', 'attendance')
    AND INDEX_NAME LIKE 'idx_%'
    ORDER BY TABLE_NAME, INDEX_NAME
  `);
  
  console.log('\n📋 Active Indexes:');
  indexes.forEach(idx => {
    console.log(`  ${idx.TABLE_NAME}.${idx.INDEX_NAME} (${idx.COLUMN_NAME})`);
  });
  
  console.log('\n✅ Test complete!');
  process.exit(0);
}

quickTest().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
