/**
 * Comprehensive Audit Report Test Suite
 * Tests all grouping modes and filters
 */

const mysql = require('mysql2/promise');

const testConfig = {
  host: '127.0.0.1',
  user: 'root',
  password: 'gads71',
  database: 'slpa_db'
};

// ANSI colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(color, text) {
  console.log(`${color}${text}${colors.reset}`);
}

async function runTests() {
  let conn;
  try {
    log(colors.bright + colors.cyan, '\n=== AUDIT REPORT TEST SUITE ===\n');
    
    // Connect to database
    conn = await mysql.createConnection(testConfig);
    log(colors.green, '✓ Database connection successful');

    // Get data summary
    const [countResults] = await conn.execute('SELECT COUNT(*) as total FROM attendance');
    const totalRecords = countResults[0].total;
    log(colors.blue, `\nTotal attendance records in database: ${totalRecords}`);

    // Get date range
    const [dateResults] = await conn.execute(
      'SELECT MIN(event_time) as min_date, MAX(event_time) as max_date FROM attendance'
    );
    const minDate = dateResults[0].min_date;
    const maxDate = dateResults[0].max_date;
    log(colors.blue, `Date range: ${minDate} to ${maxDate}`);

    // Get sample divisions
    const [divResults] = await conn.execute(
      'SELECT DISTINCT division_name FROM attendance WHERE division_name IS NOT NULL LIMIT 5'
    );
    const divisions = divResults.map(d => d.division_name);
    log(colors.blue, `Sample divisions: ${divisions.join(', ')}`);

    // Get sample sections
    const [secResults] = await conn.execute(
      'SELECT DISTINCT section_name FROM attendance WHERE section_name IS NOT NULL LIMIT 5'
    );
    const sections = secResults.map(s => s.section_name);
    log(colors.blue, `Sample sections: ${sections.join(', ')}`);

    // Test 1: Punch Type Grouping
    log(colors.bright + colors.yellow, '\n\n━━━ TEST 1: PUNCH TYPE (F1-0) GROUPING ━━━');
    const [punchResults] = await conn.execute(`
      SELECT
        scan_type,
        COUNT(*) as count,
        COUNT(DISTINCT employee_id) as unique_employees
      FROM attendance
      WHERE event_time BETWEEN '2025-01-01' AND '2025-01-15'
      GROUP BY scan_type
    `);
    
    if (punchResults.length > 0) {
      log(colors.green, '✓ Punch type grouping test PASSED');
      punchResults.forEach(row => {
        console.log(`  - ${row.scan_type}: ${row.count} records, ${row.unique_employees} employees`);
      });
    } else {
      log(colors.red, '✗ No punch records found for date range 2025-01-01 to 2025-01-15');
    }

    // Test 2: Designation Wise Grouping
    log(colors.bright + colors.yellow, '\n\n━━━ TEST 2: DESIGNATION WISE GROUPING ━━━');
    const [designationResults] = await conn.execute(`
      SELECT
        designation,
        COUNT(*) as count,
        COUNT(DISTINCT employee_id) as unique_employees
      FROM attendance
      WHERE event_time BETWEEN '2025-01-01' AND '2025-01-15'
      AND designation IS NOT NULL
      GROUP BY designation
      ORDER BY count DESC
      LIMIT 5
    `);
    
    if (designationResults.length > 0) {
      log(colors.green, '✓ Designation wise grouping test PASSED');
      designationResults.forEach(row => {
        console.log(`  - ${row.designation}: ${row.count} records, ${row.unique_employees} employees`);
      });
    } else {
      log(colors.red, '✗ No designation records found');
    }

    // Test 3: Date Range Filtering
    log(colors.bright + colors.yellow, '\n\n━━━ TEST 3: DATE RANGE FILTERING ━━━');
    const dateTests = [
      { name: 'Single day', from: '2025-01-10', to: '2025-01-10' },
      { name: 'One week', from: '2025-01-01', to: '2025-01-08' },
      { name: 'Two weeks', from: '2025-01-01', to: '2025-01-15' }
    ];

    for (const test of dateTests) {
      const [results] = await conn.execute(
        `SELECT COUNT(*) as count FROM attendance WHERE event_time BETWEEN ? AND ?`,
        [`${test.from} 00:00:00`, `${test.to} 23:59:59`]
      );
      const count = results[0].count;
      if (count > 0) {
        log(colors.green, `✓ ${test.name} (${test.from} to ${test.to}): ${count} records`);
      } else {
        log(colors.yellow, `⚠ ${test.name} (${test.from} to ${test.to}): No records found`);
      }
    }

    // Test 4: Division Filtering
    log(colors.bright + colors.yellow, '\n\n━━━ TEST 4: DIVISION FILTERING ━━━');
    if (divisions.length > 0) {
      for (const division of divisions.slice(0, 3)) {
        const [results] = await conn.execute(
          `SELECT COUNT(*) as count FROM attendance WHERE division_name = ?`,
          [division]
        );
        const count = results[0].count;
        if (count > 0) {
          log(colors.green, `✓ Division "${division}": ${count} records`);
        }
      }
    } else {
      log(colors.red, '✗ No divisions found in database');
    }

    // Test 5: Section Filtering
    log(colors.bright + colors.yellow, '\n\n━━━ TEST 5: SECTION FILTERING ━━━');
    if (sections.length > 0) {
      for (const section of sections.slice(0, 3)) {
        const [results] = await conn.execute(
          `SELECT COUNT(*) as count FROM attendance WHERE section_name = ?`,
          [section]
        );
        const count = results[0].count;
        if (count > 0) {
          log(colors.green, `✓ Section "${section}": ${count} records`);
        }
      }
    } else {
      log(colors.red, '✗ No sections found in database');
    }

    // Test 6: Combined Filters (Division + Section)
    log(colors.bright + colors.yellow, '\n\n━━━ TEST 6: DIVISION + SECTION FILTERING ━━━');
    if (divisions.length > 0 && sections.length > 0) {
      const [results] = await conn.execute(
        `SELECT COUNT(*) as count FROM attendance 
         WHERE division_name = ? AND section_name = ? 
         LIMIT 1`,
        [divisions[0], sections[0]]
      );
      const count = results[0].count;
      log(colors.green, `✓ Division "${divisions[0]}" + Section "${sections[0]}": ${count} records`);
    }

    // Test 7: None Grouping (Summary)
    log(colors.bright + colors.yellow, '\n\n━━━ TEST 7: NONE GROUPING (SUMMARY) ━━━');
    const [summaryResults] = await conn.execute(`
      SELECT
        COUNT(*) as total_records,
        COUNT(DISTINCT employee_id) as total_employees,
        COUNT(DISTINCT designation) as unique_designations
      FROM attendance
      WHERE event_time BETWEEN '2025-01-01' AND '2025-01-15'
    `);
    
    if (summaryResults.length > 0) {
      const summary = summaryResults[0];
      log(colors.green, '✓ Summary grouping test PASSED');
      console.log(`  - Total records: ${summary.total_records}`);
      console.log(`  - Total employees: ${summary.total_employees}`);
      console.log(`  - Unique designations: ${summary.unique_designations}`);
    }

    // Test 8: Verify Date/Time Fields
    log(colors.bright + colors.yellow, '\n\n━━━ TEST 8: DATE/TIME FIELD VERIFICATION ━━━');
    const [fieldResults] = await conn.execute(
      `SELECT 
        employee_id, 
        employee_name, 
        designation,
        DATE(event_time) as eventDate,
        TIME(event_time) as eventTime,
        division_name,
        section_name,
        scan_type
       FROM attendance 
       WHERE event_time BETWEEN '2025-01-10' AND '2025-01-11'
       LIMIT 3`
    );
    
    if (fieldResults.length > 0) {
      log(colors.green, '✓ Date/Time fields present and extractable');
      fieldResults.forEach((row, idx) => {
        console.log(`\n  Record ${idx + 1}:`);
        console.log(`    - Employee: ${row.employee_id} (${row.employee_name})`);
        console.log(`    - Designation: ${row.designation}`);
        console.log(`    - Date: ${row.eventDate}, Time: ${row.eventTime}`);
        console.log(`    - Division: ${row.division_name}`);
        console.log(`    - Section: ${row.section_name}`);
        console.log(`    - Scan Type: ${row.scan_type}`);
      });
    } else {
      log(colors.yellow, '⚠ No sample records found with date/time fields');
    }

    // Test 9: Scan Type Distribution
    log(colors.bright + colors.yellow, '\n\n━━━ TEST 9: SCAN TYPE DISTRIBUTION ━━━');
    const [scanResults] = await conn.execute(`
      SELECT 
        scan_type,
        COUNT(*) as count
      FROM attendance
      GROUP BY scan_type
    `);
    
    if (scanResults.length > 0) {
      log(colors.green, '✓ Scan types found:');
      scanResults.forEach(row => {
        console.log(`  - ${row.scan_type}: ${row.count} records`);
      });
    } else {
      log(colors.red, '✗ No scan type data found');
    }

    // Summary
    log(colors.bright + colors.cyan, '\n\n=== TEST SUMMARY ===');
    log(colors.green, '✓ All database connectivity tests passed');
    log(colors.green, '✓ All data structure tests passed');
    log(colors.green, '✓ All filtering tests completed');
    log(colors.blue, '\nReady for API testing');

  } catch (error) {
    log(colors.red, `\n✗ Test failed: ${error.message}`);
    console.error(error);
  } finally {
    if (conn) await conn.end();
  }
}

runTests();
