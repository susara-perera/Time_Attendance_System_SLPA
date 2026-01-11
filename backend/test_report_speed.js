require('dotenv').config();
const { mysqlSequelize } = require('./config/mysql');

async function testPerformance() {
  try {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('⚡ REPORT GENERATION SPEED TEST');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Test 1: Count records
    console.log('Test 1: Table Size');
    let start = Date.now();
    const [count] = await mysqlSequelize.query('SELECT COUNT(*) as cnt FROM attendance_reports_optimized');
    console.log(`  ✅ Count: ${count[0].cnt} records in ${Date.now() - start}ms\n`);

    // Test 2: Group by division
    console.log('Test 2: Group by Division (30 days)');
    start = Date.now();
    const [divResults] = await mysqlSequelize.query(`
      SELECT 
        division_code,
        division_name,
        COUNT(*) as emp_count,
        COUNT(DISTINCT emp_id) as unique_employees,
        COUNT(DISTINCT attendance_date) as days
      FROM attendance_reports_optimized
      WHERE attendance_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY division_code, division_name
      ORDER BY division_code
    `);
    console.log(`  ✅ Found ${divResults.length} divisions in ${Date.now() - start}ms\n`);

    // Test 3: Full report
    console.log('Test 3: Full Report (30 days, all data)');
    start = Date.now();
    const [fullReport] = await mysqlSequelize.query(`
      SELECT 
        division_code,
        division_name,
        section_code,
        section_name,
        emp_id,
        emp_name,
        emp_designation,
        COUNT(DISTINCT attendance_date) as present_days,
        MIN(attendance_date) as first_date,
        MAX(attendance_date) as last_date
      FROM attendance_reports_optimized
      WHERE attendance_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY division_code, section_code, emp_id
      ORDER BY division_code, section_code, emp_id
      LIMIT 1000
    `);
    console.log(`  ✅ Report (1000 rows): ${fullReport.length} rows in ${Date.now() - start}ms\n`);

    // Test 4: Complex aggregation
    console.log('Test 4: Complex Aggregation (90 days)');
    start = Date.now();
    const [complex] = await mysqlSequelize.query(`
      SELECT 
        division_code,
        division_name,
        COUNT(DISTINCT attendance_date) as total_days,
        COUNT(DISTINCT emp_id) as total_employees,
        SUM(CASE WHEN attendance_status = 'Present' THEN 1 ELSE 0 END) as present_records,
        SUM(CASE WHEN attendance_status = 'Absent' THEN 1 ELSE 0 END) as absent_records
      FROM attendance_reports_optimized
      WHERE attendance_date >= DATE_SUB(NOW(), INTERVAL 90 DAY)
      GROUP BY division_code, division_name
    `);
    console.log(`  ✅ Aggregation: ${complex.length} rows in ${Date.now() - start}ms\n`);

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('✅ Performance tests completed!');
    console.log('═══════════════════════════════════════════════════════════════\n');

    await mysqlSequelize.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testPerformance();
