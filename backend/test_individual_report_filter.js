const mysql = require('mysql2/promise');

async function testIndividualReport() {
  const employee_id = '448225';
  const from_date = '2026-01-21';
  const to_date = '2026-01-21';

  console.log('\n🧪 TESTING INDIVIDUAL ATTENDANCE REPORT');
  console.log('='.repeat(80));
  console.log(`Employee ID: ${employee_id}`);
  console.log(`Date Range: ${from_date} to ${to_date}`);
  console.log('='.repeat(80));

  let connection;
  try {
    connection = await mysql.createConnection({
      host: '127.0.0.1',
      user: 'root',
      password: 'gads71',
      database: 'slpa_db'
    });
    
    // Test 1: Query WITHOUT filter (original behavior)
    console.log('\n📊 TEST 1: WITHOUT Emergency Exit Filter (OLD BEHAVIOR)');
    console.log('-'.repeat(80));
    
    const sqlOld = `SELECT 
              a.attendance_id,
              a.employee_ID,
              a.fingerprint_id,
              a.date_,
              a.time_,
              a.scan_type
             FROM attendance a
             WHERE a.date_ BETWEEN ? AND ? AND a.employee_ID = ?
             ORDER BY a.date_ ASC, a.time_ ASC`;
    
    const [oldResults] = await connection.execute(sqlOld, [from_date, to_date, employee_id]);
    
    console.log(`\nRecords found: ${oldResults.length}`);
    oldResults.forEach((rec, i) => {
      const isEmergency = rec.fingerprint_id && rec.fingerprint_id.includes('Emergancy Exit');
      const marker = isEmergency ? '🚨' : '✓';
      console.log(`${i+1}. ${marker} | ID: ${rec.attendance_id} | Time: ${rec.time_} | Device: "${rec.fingerprint_id}"`);
    });

    const oldEmergencyCount = oldResults.filter(r => r.fingerprint_id && r.fingerprint_id.includes('Emergancy Exit')).length;
    
    // Test 2: Query WITH filter (new behavior)
    console.log('\n\n📊 TEST 2: WITH Emergency Exit Filter (NEW BEHAVIOR)');
    console.log('-'.repeat(80));
    
    const sqlNew = `SELECT 
              a.attendance_id,
              a.employee_ID,
              a.fingerprint_id,
              a.date_,
              a.time_,
              a.scan_type
             FROM attendance a
             WHERE a.date_ BETWEEN ? AND ? AND a.employee_ID = ?
             AND (a.fingerprint_id NOT LIKE '%Emergancy Exit%' OR a.fingerprint_id IS NULL)
             ORDER BY a.date_ ASC, a.time_ ASC`;
    
    const [newResults] = await connection.execute(sqlNew, [from_date, to_date, employee_id]);
    
    console.log(`\nRecords found: ${newResults.length}`);
    newResults.forEach((rec, i) => {
      console.log(`${i+1}. ✓ | ID: ${rec.attendance_id} | Time: ${rec.time_} | Device: "${rec.fingerprint_id}"`);
    });

    // Summary
    console.log('\n\n' + '='.repeat(80));
    console.log('📈 COMPARISON SUMMARY');
    console.log('='.repeat(80));
    console.log(`Old Query (no filter):     ${oldResults.length} records`);
    console.log(`  - Emergency Exit:        ${oldEmergencyCount} records`);
    console.log(`  - Regular:               ${oldResults.length - oldEmergencyCount} records`);
    console.log();
    console.log(`New Query (with filter):   ${newResults.length} records`);
    console.log(`  - Emergency Exit:        0 records (filtered out)`);
    console.log(`  - Regular:               ${newResults.length} records`);
    console.log();
    console.log(`Records Filtered Out:      ${oldResults.length - newResults.length}`);
    console.log();
    console.log(`✅ Filter Working:         ${oldEmergencyCount === (oldResults.length - newResults.length) ? 'YES ✓' : 'NO ✗'}`);
    console.log('='.repeat(80));

    // Show what would be in the report
    console.log('\n\n📋 FINAL REPORT DATA (Emergency Exit records excluded):');
    console.log('-'.repeat(80));
    if (newResults.length === 0) {
      console.log('No attendance records found for this employee on this date.');
    } else {
      newResults.forEach((rec, i) => {
        console.log(`\nRecord ${i+1}:`);
        console.log(`  Attendance ID: ${rec.attendance_id}`);
        console.log(`  Date: ${rec.date_}`);
        console.log(`  Time: ${rec.time_}`);
        console.log(`  Scan Type: ${rec.scan_type || 'NULL'}`);
        console.log(`  Terminal: ${rec.fingerprint_id}`);
      });
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

testIndividualReport();
