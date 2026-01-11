const mysql = require('mysql2/promise');

async function findAuditCandidates() {
  let conn;
  try {
    conn = await mysql.createConnection({
      host: '127.0.0.1',
      user: 'root',
      password: 'gads71',
      database: 'slpa_db'
    });

    console.log('🔍 Finding employees with incomplete punches (audit candidates)...\n');

    // First, get total attendance records
    console.log('📊 STEP 1: Getting total attendance records...');
    const [totalRecords] = await conn.execute('SELECT COUNT(*) as total FROM attendance');
    console.log(`   ✅ Found ${totalRecords[0].total.toLocaleString()} total attendance records\n`);

    // Get unique employees
    console.log('👥 STEP 2: Getting unique employees...');
    const [uniqueEmployees] = await conn.execute('SELECT COUNT(DISTINCT employee_ID) as unique_count FROM attendance');
    console.log(`   ✅ Found ${uniqueEmployees[0].unique_count.toLocaleString()} unique employees\n`);

    // Get date range
    console.log('📅 STEP 3: Checking date range...');
    const [dateRange] = await conn.execute('SELECT MIN(date_) as start_date, MAX(date_) as end_date FROM attendance');
    console.log(`   ✅ Date range: ${dateRange[0].start_date} to ${dateRange[0].end_date}\n`);

    // Find all incomplete punches
    console.log('🔍 STEP 4: Finding incomplete punches (employees with only 1 punch per day)...');
    console.log('   This may take a moment for large datasets...\n');

    const [incompleteRecords] = await conn.execute(`
      SELECT
        a.employee_ID,
        a.date_,
        COUNT(*) as punch_count,
        GROUP_CONCAT(DISTINCT a.scan_type ORDER BY a.time_ SEPARATOR ', ') as scan_types,
        MIN(a.time_) as first_punch,
        MAX(a.time_) as last_punch
      FROM attendance a
      GROUP BY a.employee_ID, a.date_
      HAVING COUNT(*) = 1
      ORDER BY a.date_ DESC, a.employee_ID
    `);

    console.log(`   ✅ Found ${incompleteRecords.length.toLocaleString()} incomplete punch records\n`);

    if (incompleteRecords.length === 0) {
      console.log('✅ No incomplete punches found! All attendance records are complete.');
      return;
    }

    // Analyze the incomplete records
    console.log('📈 STEP 5: Analyzing incomplete punch patterns...');

    // Group by employee
    const employeeSummary = {};
    const scanTypeStats = {};
    const dateStats = {};

    incompleteRecords.forEach(record => {
      // Employee summary
      const empId = record.employee_ID;
      if (!employeeSummary[empId]) {
        employeeSummary[empId] = {
          employee_id: empId,
          total_incomplete_days: 0,
          dates: [],
          scan_types: new Set()
        };
      }
      employeeSummary[empId].total_incomplete_days++;
      employeeSummary[empId].dates.push(record.date_);
      employeeSummary[empId].scan_types.add(record.scan_types);

      // Scan type statistics
      if (!scanTypeStats[record.scan_types]) {
        scanTypeStats[record.scan_types] = 0;
      }
      scanTypeStats[record.scan_types]++;

      // Date statistics (by month)
      const month = record.date_.toISOString().substring(0, 7);
      if (!dateStats[month]) {
        dateStats[month] = 0;
      }
      dateStats[month]++;
    });

    console.log(`   ✅ Analyzed ${Object.keys(employeeSummary).length} employees with incomplete punches\n`);

    // Show scan type breakdown
    console.log('🔢 SCAN TYPE BREAKDOWN:');
    Object.entries(scanTypeStats)
      .sort(([,a], [,b]) => b - a)
      .forEach(([scanType, count]) => {
        console.log(`   "${scanType}": ${count} occurrences`);
      });
    console.log('');

    // Show monthly breakdown
    console.log('📅 MONTHLY BREAKDOWN:');
    Object.entries(dateStats)
      .sort(([a], [b]) => b.localeCompare(a))
      .forEach(([month, count]) => {
        console.log(`   ${month}: ${count} incomplete punches`);
      });
    console.log('');

    // Convert to array and sort by most problematic employees
    const sortedEmployees = Object.values(employeeSummary)
      .sort((a, b) => b.total_incomplete_days - a.total_incomplete_days);

    console.log('👥 EMPLOYEES NEEDING AUDIT ATTENTION:');
    console.log('═'.repeat(90));
    console.log('Employee ID'.padEnd(15) + 'Incomplete Days'.padEnd(18) + 'Scan Types'.padEnd(20) + 'Recent Dates');
    console.log('═'.repeat(90));

    sortedEmployees.slice(0, 50).forEach(emp => { // Show top 50
      const scanTypes = Array.from(emp.scan_types).join(', ');
      const recentDates = emp.dates.slice(0, 3).join(', ') + (emp.dates.length > 3 ? '...' : '');
      console.log(
        emp.employee_id.toString().padEnd(15) +
        emp.total_incomplete_days.toString().padEnd(18) +
        scanTypes.padEnd(20) +
        recentDates
      );
    });

    if (sortedEmployees.length > 50) {
      console.log(`\n... and ${sortedEmployees.length - 50} more employees`);
    }

    console.log('\n📈 SUMMARY:');
    console.log(`   Total employees with incomplete punches: ${sortedEmployees.length.toLocaleString()}`);
    console.log(`   Total incomplete punch days: ${incompleteRecords.length.toLocaleString()}`);
    console.log(`   Average incomplete days per employee: ${(incompleteRecords.length / sortedEmployees.length).toFixed(1)}`);

    // Show sample records
    console.log('\n🔍 SAMPLE RECORDS (first 10):');
    console.log('─'.repeat(90));
    incompleteRecords.slice(0, 10).forEach((record, index) => {
      console.log(`${(index + 1).toString().padStart(2)}. Employee: ${record.employee_ID} | Date: ${record.date_} | Scan: ${record.scan_types} | Time: ${record.first_punch}`);
    });

    console.log('\n✅ Analysis complete! These employees need audit attention.');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (conn) await conn.end();
  }
}

findAuditCandidates();