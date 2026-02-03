require('dotenv').config();
const mysql = require('mysql2/promise');

async function compareAuditAndAttendance() {
  console.log('\n=== COMPARING AUDIT vs ATTENDANCE FOR 2026-01-26 ===\n');
  
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'gads71',
    database: process.env.MYSQL_DATABASE || 'slpa_db'
  });
  
  const testDate = '2026-01-26';
  const testEmployeeId = '448225';
  
  console.log(`Testing Employee: ${testEmployeeId}`);
  console.log(`Date: ${testDate}\n`);
  
  // 1. Get AUDIT REPORT data (should show employees with F1 but no F4)
  console.log('1️⃣  AUDIT REPORT QUERY:');
  console.log('─'.repeat(80));
  
  const [auditRecords] = await conn.execute(`
    SELECT 
      employee_ID,
      date_,
      COUNT(*) as punch_count,
      GROUP_CONCAT(CONCAT(time_, ':', scan_type) ORDER BY time_ SEPARATOR '|') as punches,
      CAST(SUM(CASE 
        WHEN UPPER(scan_type) IN ('IN', 'I', 'ON') THEN 1 
        ELSE 0 
      END) AS SIGNED) as in_count,
      CAST(SUM(CASE 
        WHEN UPPER(scan_type) IN ('OUT', 'O', 'OFF') THEN 1 
        ELSE 0 
      END) AS SIGNED) as out_count
    FROM attendance
    WHERE date_ = ?
    AND employee_ID = ?
    GROUP BY employee_ID, date_
    HAVING in_count >= 1 AND out_count = 0
  `, [testDate, testEmployeeId]);
  
  if (auditRecords.length > 0) {
    console.log('✅ Employee FOUND in audit report');
    console.log(`   Punch count: ${auditRecords[0].punch_count}`);
    console.log(`   IN count: ${auditRecords[0].in_count}`);
    console.log(`   OUT count: ${auditRecords[0].out_count}`);
    console.log(`   Punches: ${auditRecords[0].punches}`);
  } else {
    console.log('❌ Employee NOT in audit report');
  }
  
  // 2. Get RAW ATTENDANCE data (all records)
  console.log('\n2️⃣  RAW ATTENDANCE RECORDS:');
  console.log('─'.repeat(80));
  
  const [attendanceRecords] = await conn.execute(`
    SELECT 
      employee_ID,
      date_,
      time_,
      scan_type,
      fingerprint_id,
      UPPER(scan_type) as scan_type_upper
    FROM attendance
    WHERE date_ = ?
    AND employee_ID = ?
    ORDER BY time_
  `, [testDate, testEmployeeId]);
  
  console.log(`Found ${attendanceRecords.length} attendance records:\n`);
  
  attendanceRecords.forEach((record, idx) => {
    const scanTypeDisplay = record.scan_type || '(empty)';
    const isIn = ['IN', 'I', 'ON'].includes(record.scan_type_upper);
    const isOut = ['OUT', 'O', 'OFF'].includes(record.scan_type_upper);
    const category = isIn ? 'F1/IN' : (isOut ? 'F4/OUT' : 'UNKNOWN');
    
    console.log(`   ${idx + 1}. ${record.time_} | scan_type: "${scanTypeDisplay}" | ${category}`);
    console.log(`      fingerprint_id: ${record.fingerprint_id}`);
  });
  
  // 3. Calculate summary from attendance records
  console.log('\n3️⃣  CALCULATED SUMMARY FROM ATTENDANCE:');
  console.log('─'.repeat(80));
  
  const inPunches = attendanceRecords.filter(r => ['IN', 'I', 'ON'].includes(r.scan_type_upper));
  const outPunches = attendanceRecords.filter(r => ['OUT', 'O', 'OFF'].includes(r.scan_type_upper));
  const unknownPunches = attendanceRecords.filter(r => 
    !['IN', 'I', 'ON'].includes(r.scan_type_upper) && 
    !['OUT', 'O', 'OFF'].includes(r.scan_type_upper)
  );
  
  console.log(`   Total records: ${attendanceRecords.length}`);
  console.log(`   IN/F1 punches: ${inPunches.length}`);
  console.log(`   OUT/F4 punches: ${outPunches.length}`);
  console.log(`   Unknown/Emergency: ${unknownPunches.length}`);
  
  // 4. Compare the two
  console.log('\n4️⃣  COMPARISON RESULT:');
  console.log('─'.repeat(80));
  
  const shouldBeInAudit = inPunches.length >= 1 && outPunches.length === 0;
  const isInAudit = auditRecords.length > 0;
  
  console.log(`   Should be in audit (has F1, no F4): ${shouldBeInAudit ? '✅ YES' : '❌ NO'}`);
  console.log(`   Is in audit report: ${isInAudit ? '✅ YES' : '❌ NO'}`);
  
  if (shouldBeInAudit === isInAudit) {
    console.log('\n   ✅✅✅ MATCH! Audit and Attendance are CONSISTENT! ✅✅✅');
  } else {
    console.log('\n   ❌❌❌ MISMATCH! Audit and Attendance are INCONSISTENT! ❌❌❌');
  }
  
  // 5. Build the punch string as audit does
  if (auditRecords.length > 0) {
    console.log('\n5️⃣  PUNCH STRING COMPARISON:');
    console.log('─'.repeat(80));
    
    const manualPunchString = attendanceRecords
      .map(r => `${r.time_}:${r.scan_type}`)
      .join('|');
    
    console.log('   Audit query punch string:');
    console.log(`   ${auditRecords[0].punches}`);
    console.log('\n   Manual punch string from attendance:');
    console.log(`   ${manualPunchString}`);
    console.log(`\n   Strings match: ${auditRecords[0].punches === manualPunchString ? '✅ YES' : '❌ NO'}`);
  }
  
  // 6. Test with attendance report style query (group report)
  console.log('\n6️⃣  ATTENDANCE REPORT STYLE QUERY:');
  console.log('─'.repeat(80));
  
  const [groupReportStyle] = await conn.execute(`
    SELECT 
      employee_ID,
      date_,
      GROUP_CONCAT(
        CONCAT(
          DATE_FORMAT(date_, '%Y-%m-%d'), ' ',
          time_, '|',
          scan_type
        ) 
        ORDER BY time_ 
        SEPARATOR ','
      ) as all_scans
    FROM attendance
    WHERE date_ = ?
    AND employee_ID = ?
    GROUP BY employee_ID, date_
  `, [testDate, testEmployeeId]);
  
  if (groupReportStyle.length > 0) {
    console.log('✅ Found in group-style query');
    console.log(`   All scans: ${groupReportStyle[0].all_scans}`);
  } else {
    console.log('❌ Not found in group-style query');
  }
  
  await conn.end();
  console.log('\n✅ Comparison complete!\n');
}

compareAuditAndAttendance().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
