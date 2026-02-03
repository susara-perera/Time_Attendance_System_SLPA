const mysql = require('mysql2/promise');

async function checkAttendance() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: 'gads71',
    database: 'slpa_db'
  });

  console.log('=== CHECKING EMPLOYEE 448225 ATTENDANCE ===\n');
  
  // Check attendance on 2026-01-26
  const [attendance] = await conn.execute(`
    SELECT 
      employee_ID,
      date_,
      time_,
      scan_type,
      fingerprint_id
    FROM attendance
    WHERE employee_ID = '448225'
    AND date_ = '2026-01-26'
    ORDER BY time_
  `);
  
  console.log('📅 Attendance Records for 448225 on 2026-01-26:');
  console.log('─'.repeat(80));
  if (attendance.length === 0) {
    console.log('❌ No attendance records found');
  } else {
    attendance.forEach((record, idx) => {
      console.log(`${idx + 1}. Time: ${record.time_} | Scan Type: ${record.scan_type} | ID: ${record.fingerprint_id}`);
    });
    
    const inCount = attendance.filter(r => ['IN', 'in', 'I', 'ON', 'on'].includes(r.scan_type)).length;
    const outCount = attendance.filter(r => ['OUT', 'out', 'O', 'OFF', 'off'].includes(r.scan_type)).length;
    
    console.log('\n📊 Summary:');
    console.log(`   IN/F1 Punches: ${inCount}`);
    console.log(`   OUT/F4 Punches: ${outCount}`);
    console.log(`   Total Punches: ${attendance.length}`);
    console.log(`   Should appear in audit: ${inCount >= 1 && outCount === 0 ? '✅ YES' : '❌ NO'}`);
  }
  
  // Check employee details
  console.log('\n\n=== EMPLOYEE DETAILS ===\n');
  const [empDetails] = await conn.execute(`
    SELECT 
      e.EMP_NO,
      e.EMP_NAME,
      e.DIV_CODE,
      e.SEC_CODE,
      d.HIE_NAME as division_name,
      s.HIE_NAME_4 as section_name
    FROM employees_sync e
    LEFT JOIN divisions_sync d ON e.DIV_CODE = d.HIE_CODE
    LEFT JOIN sections_sync s ON e.SEC_CODE = s.HIE_CODE
    WHERE e.EMP_NO = '448225'
  `);
  
  if (empDetails.length > 0) {
    const emp = empDetails[0];
    console.log(`Employee ID: ${emp.EMP_NO}`);
    console.log(`Name: ${emp.EMP_NAME}`);
    console.log(`Division Code: ${emp.DIV_CODE}`);
    console.log(`Division Name: ${emp.division_name}`);
    console.log(`Section Code: ${emp.SEC_CODE}`);
    console.log(`Section Name: ${emp.section_name}`);
    
    console.log('\n📋 Matching IS Division/Section?');
    console.log(`   Division 66: ${emp.DIV_CODE == 66 ? '✅ YES' : '❌ NO (' + emp.DIV_CODE + ')'}`);
    console.log(`   Section 333: ${emp.SEC_CODE == 333 ? '✅ YES' : '❌ NO (' + emp.SEC_CODE + ')'}`);
  } else {
    console.log('❌ Employee not found in employees_sync');
  }
  
  // Test the audit query
  console.log('\n\n=== TESTING AUDIT QUERY ===\n');
  const [auditTest] = await conn.execute(`
    SELECT 
      employee_ID,
      date_,
      COUNT(*) as punch_count,
      GROUP_CONCAT(CONCAT(time_, ':', scan_type) ORDER BY time_ SEPARATOR '|') as punches,
      SUM(CASE 
        WHEN UPPER(scan_type) IN ('IN', 'I', 'ON') THEN 1 
        ELSE 0 
      END) as in_count,
      SUM(CASE 
        WHEN UPPER(scan_type) IN ('OUT', 'O', 'OFF') THEN 1 
        ELSE 0 
      END) as out_count
    FROM attendance
    WHERE date_ = '2026-01-26'
    AND employee_ID = '448225'
    GROUP BY employee_ID, date_
    HAVING in_count >= 1 AND out_count = 0
  `);
  
  console.log('Audit Query Result:');
  if (auditTest.length > 0) {
    console.log('✅ Employee SHOULD appear in audit report');
    console.log(`   Punches: ${auditTest[0].punches}`);
    console.log(`   IN count: ${auditTest[0].in_count}`);
    console.log(`   OUT count: ${auditTest[0].out_count}`);
  } else {
    console.log('❌ Employee will NOT appear in audit report (either no records or has OUT punches)');
  }
  
  await conn.end();
}

checkAttendance().catch(console.error);
