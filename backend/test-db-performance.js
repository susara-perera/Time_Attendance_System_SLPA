/**
 * Direct Database Performance Testing
 * Tests query execution times without HTTP overhead
 */

require('dotenv').config();
const { sequelize } = require('./models/mysql');
const moment = require('moment');

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

async function testDatabasePerformance() {
  console.log('🧪 Direct Database Performance Tests\n');
  console.log('='.repeat(70));
  
  const results = [];

  // Test 1: Get all active employees
  try {
    const start = Date.now();
    const [employees] = await sequelize.query(`
      SELECT COUNT(*) as count FROM employees_sync WHERE IS_ACTIVE = 1
    `);
    const time = Date.now() - start;
    const count = employees[0].count;
    logResult('All Active Employees COUNT', time, count, results);
  } catch (error) {
    logError('All Active Employees COUNT', error, results);
  }

  // Test 2: Get IS division employees
  try {
    const start = Date.now();
    const [employees] = await sequelize.query(`
      SELECT * FROM employees_sync WHERE DIV_CODE = '66' AND IS_ACTIVE = 1
    `);
    const time = Date.now() - start;
    logResult('IS Division Employees FULL', time, employees.length, results);
  } catch (error) {
    logError('IS Division Employees FULL', error, results);
  }

  // Test 3: Get all divisions
  try {
    const start = Date.now();
    const [divisions] = await sequelize.query(`
      SELECT * FROM divisions_sync ORDER BY HIE_NAME
    `);
    const time = Date.now() - start;
    logResult('All Divisions', time, divisions.length, results);
  } catch (error) {
    logError('All Divisions', error, results);
  }

  // Test 4: Get all sections
  try {
    const start = Date.now();
    const [sections] = await sequelize.query(`
      SELECT * FROM sections_sync ORDER BY HIE_NAME
    `);
    const time = Date.now() - start;
    logResult('All Sections', time, sections.length, results);
  } catch (error) {
    logError('All Sections', error, results);
  }

  // Test 5: Today's attendance for IS division
  try {
    const today = moment().format('YYYY-MM-DD');
    const start = Date.now();
    const [attendance] = await sequelize.query(`
      SELECT a.*, e.EMP_NAME as employee_name, e.SEC_NAME as section_name
      FROM attendance a
      INNER JOIN employees_sync e ON a.employee_ID = e.EMP_NO
      WHERE e.DIV_CODE = '66' AND a.date_ = ?
      AND (a.fingerprint_id NOT LIKE '%Emergancy Exit%' OR a.fingerprint_id IS NULL)
      ORDER BY a.time_ DESC
      LIMIT 500
    `, { replacements: [today] });
    const time = Date.now() - start;
    logResult('IS Attendance Today', time, attendance.length, results);
  } catch (error) {
    logError('IS Attendance Today', error, results);
  }

  // Test 6: Individual employee attendance (last 30 days)
  try {
    const startDate = moment().subtract(30, 'days').format('YYYY-MM-DD');
    const endDate = moment().format('YYYY-MM-DD');
    const start = Date.now();
    const [attendance] = await sequelize.query(`
      SELECT * FROM attendance 
      WHERE employee_ID = '465963' 
      AND date_ BETWEEN ? AND ?
      ORDER BY date_ DESC, time_ DESC
    `, { replacements: [startDate, endDate] });
    const time = Date.now() - start;
    logResult('Individual Attendance (30 days)', time, attendance.length, results);
  } catch (error) {
    logError('Individual Attendance (30 days)', error, results);
  }

  // Test 7: Complex join query (dashboard stats simulation)
  try {
    const start = Date.now();
    const [stats] = await sequelize.query(`
      SELECT 
        COUNT(DISTINCT e.EMP_NO) as total_employees,
        COUNT(DISTINCT e.DIV_CODE) as total_divisions,
        COUNT(DISTINCT e.SEC_CODE) as total_sections
      FROM employees_sync e
      WHERE e.IS_ACTIVE = 1
    `);
    const time = Date.now() - start;
    logResult('Dashboard Stats (Complex)', time, 1, results);
  } catch (error) {
    logError('Dashboard Stats (Complex)', error, results);
  }

  // Test 8: Weekly attendance trend (heavy query)
  try {
    const startDate = moment().subtract(7, 'days').format('YYYY-MM-DD');
    const endDate = moment().format('YYYY-MM-DD');
    const start = Date.now();
    const [trend] = await sequelize.query(`
      SELECT 
        a.date_,
        COUNT(DISTINCT a.employee_ID) as present_count,
        COUNT(*) as total_punches
      FROM attendance a
      INNER JOIN employees_sync e ON a.employee_ID = e.EMP_NO
      WHERE e.DIV_CODE = '66'
      AND a.date_ BETWEEN ? AND ?
      AND (a.fingerprint_id NOT LIKE '%Emergancy Exit%' OR a.fingerprint_id IS NULL)
      GROUP BY a.date_
      ORDER BY a.date_
    `, { replacements: [startDate, endDate] });
    const time = Date.now() - start;
    logResult('Weekly Attendance Trend', time, trend.length, results);
  } catch (error) {
    logError('Weekly Attendance Trend', error, results);
  }

  // Print summary
  printSummary(results);
}

function logResult(name, time, records, results) {
  const status = time < 50 ? '🚀 FAST' : time < 200 ? '✅ GOOD' : time < 500 ? '⚠️  SLOW' : '❌ VERY SLOW';
  const color = time < 50 ? colors.green : time < 200 ? colors.blue : time < 500 ? colors.yellow : colors.red;
  
  console.log(`${color}${status}${colors.reset} ${name.padEnd(35)} ${time}ms (${records} records)`);
  
  results.push({ name, time, records, status: status.replace(/[🚀✅⚠️❌]/g, '').trim() });
}

function logError(name, error, results) {
  console.log(`${colors.red}❌ ERROR${colors.reset} ${name.padEnd(35)} ${error.message}`);
  results.push({ name, time: 0, records: 0, status: 'ERROR', error: error.message });
}

function printSummary(results) {
  console.log('\n' + '='.repeat(70));
  console.log('📊 PERFORMANCE SUMMARY');
  console.log('='.repeat(70));

  const successResults = results.filter(r => r.status !== 'ERROR');
  const totalTime = successResults.reduce((sum, r) => sum + r.time, 0);
  const avgTime = successResults.length > 0 ? (totalTime / successResults.length).toFixed(2) : 0;
  
  const fast = results.filter(r => r.time < 50).length;
  const good = results.filter(r => r.time >= 50 && r.time < 200).length;
  const slow = results.filter(r => r.time >= 200 && r.time < 500).length;
  const verySlow = results.filter(r => r.time >= 500).length;
  const errors = results.filter(r => r.status === 'ERROR').length;

  console.log(`\nTotal Tests: ${results.length}`);
  console.log(`Successful: ${successResults.length}`);
  console.log(`Total Time: ${totalTime}ms`);
  console.log(`Average Time: ${avgTime}ms`);
  
  console.log(`\n${colors.green}🚀 Fast (<50ms): ${fast}${colors.reset}`);
  console.log(`${colors.blue}✅ Good (50-200ms): ${good}${colors.reset}`);
  console.log(`${colors.yellow}⚠️  Slow (200-500ms): ${slow}${colors.reset}`);
  console.log(`${colors.red}❌ Very Slow (>500ms): ${verySlow}${colors.reset}`);
  if (errors > 0) {
    console.log(`${colors.red}💥 Errors: ${errors}${colors.reset}`);
  }

  // Detailed breakdown of slow queries
  const slowQueries = results.filter(r => r.time >= 200 && r.status !== 'ERROR');
  if (slowQueries.length > 0) {
    console.log('\n' + '='.repeat(70));
    console.log('🔍 SLOW QUERIES NEEDING OPTIMIZATION');
    console.log('='.repeat(70));
    slowQueries.forEach(q => {
      console.log(`${colors.yellow}⚠️  ${q.name}${colors.reset}`);
      console.log(`   Time: ${q.time}ms | Records: ${q.records}`);
      console.log(`   ${colors.cyan}Recommendation:${colors.reset} Add database index or implement caching`);
      console.log('');
    });
  }

  // Recommendations
  console.log('='.repeat(70));
  console.log('💡 OPTIMIZATION RECOMMENDATIONS');
  console.log('='.repeat(70));
  
  if (slow + verySlow > 0) {
    console.log('\n1. DATABASE INDEXES NEEDED:');
    console.log('   - ADD INDEX idx_emp_div_active ON employees_sync(DIV_CODE, IS_ACTIVE)');
    console.log('   - ADD INDEX idx_att_emp_date ON attendance(employee_ID, date_)');
    console.log('   - ADD INDEX idx_att_date_emp ON attendance(date_, employee_ID)');
    console.log('   - ADD INDEX idx_emp_sec ON employees_sync(SEC_CODE)');
  }
  
  if (avgTime > 100) {
    console.log('\n2. ENABLE REDIS CACHING:');
    console.log('   - Install Redis: choco install redis-64');
    console.log('   - Start Redis: redis-server');
    console.log('   - Configure: Set REDIS_ENABLED=true in .env');
  }
  
  if (verySlow > 0) {
    console.log('\n3. QUERY OPTIMIZATION:');
    console.log('   - Consider query result pagination');
    console.log('   - Limit JOIN operations where possible');
    console.log('   - Use COUNT(*) instead of fetching all records for counts');
  }

  console.log('\n✨ Overall Performance: ' + (avgTime < 50 ? `${colors.green}EXCELLENT` : avgTime < 200 ? `${colors.blue}GOOD` : avgTime < 500 ? `${colors.yellow}NEEDS IMPROVEMENT` : `${colors.red}CRITICAL`) + colors.reset);
  console.log('');
}

// Run tests
testDatabasePerformance()
  .then(() => {
    console.log('✅ Tests completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });
