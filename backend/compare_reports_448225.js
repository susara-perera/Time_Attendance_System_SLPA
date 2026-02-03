require('dotenv').config();
const mysql = require('mysql2/promise');

async function compareReports() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║     COMPARING AUDIT vs ATTENDANCE REPORTS FOR 448225          ║');
  console.log('║                   Date: 2026-01-26                             ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'gads71',
    database: process.env.MYSQL_DATABASE || 'slpa_db'
  });
  
  const testDate = '2026-01-26';
  const testEmployeeId = '448225';
  
  // ========== AUDIT REPORT DATA ==========
  console.log('📋 AUDIT REPORT DATA:');
  console.log('═'.repeat(80));
  
  const [auditData] = await conn.execute(`
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
      END) AS SIGNED) as out_count,
      MIN(CASE WHEN UPPER(scan_type) IN ('IN', 'I', 'ON') THEN time_ END) as first_in,
      MAX(CASE WHEN UPPER(scan_type) IN ('OUT', 'O', 'OFF') THEN time_ END) as last_out
    FROM attendance
    WHERE date_ = ?
    AND employee_ID = ?
    GROUP BY employee_ID, date_
    HAVING in_count >= 1 AND out_count = 0
  `, [testDate, testEmployeeId]);
  
  if (auditData.length > 0) {
    const audit = auditData[0];
    console.log('✅ Employee FOUND in Audit Report');
    console.log(`   Total Punches: ${audit.punch_count}`);
    console.log(`   IN Punches: ${audit.in_count}`);
    console.log(`   OUT Punches: ${audit.out_count}`);
    console.log(`   First IN: ${audit.first_in || 'N/A'}`);
    console.log(`   Last OUT: ${audit.last_out || 'N/A'}`);
    console.log(`   All Punches: ${audit.punches}`);
  } else {
    console.log('❌ Employee NOT found in Audit Report');
    console.log('   (This means either has OUT punches or no IN punches)');
  }
  
  // ========== ATTENDANCE REPORT DATA ==========
  console.log('\n\n📊 ATTENDANCE REPORT DATA:');
  console.log('═'.repeat(80));
  
  const [attendanceData] = await conn.execute(`
    SELECT 
      employee_ID,
      date_,
      time_,
      scan_type,
      fingerprint_id,
      CASE 
        WHEN UPPER(scan_type) IN ('IN', 'I', 'ON') THEN 'IN/F1'
        WHEN UPPER(scan_type) IN ('OUT', 'O', 'OFF') THEN 'OUT/F4'
        ELSE 'UNKNOWN'
      END as punch_category
    FROM attendance
    WHERE date_ = ?
    AND employee_ID = ?
    ORDER BY time_
  `, [testDate, testEmployeeId]);
  
  if (attendanceData.length > 0) {
    console.log(`✅ Found ${attendanceData.length} attendance records:\n`);
    
    attendanceData.forEach((record, idx) => {
      const scanDisplay = record.scan_type || '(empty)';
      const emoji = record.punch_category === 'IN/F1' ? '🟢' : 
                    record.punch_category === 'OUT/F4' ? '🔴' : '⚪';
      
      console.log(`   ${idx + 1}. ${emoji} ${record.time_}`);
      console.log(`      Scan Type: "${scanDisplay}" (${record.punch_category})`);
      console.log(`      Device: ${record.fingerprint_id}`);
      console.log('');
    });
  } else {
    console.log('❌ No attendance records found');
  }
  
  // ========== DETAILED COMPARISON ==========
  console.log('🔍 DETAILED COMPARISON:');
  console.log('═'.repeat(80));
  
  // Count IN and OUT from attendance
  const inRecords = attendanceData.filter(r => 
    ['IN', 'I', 'ON'].includes((r.scan_type || '').toUpperCase())
  );
  const outRecords = attendanceData.filter(r => 
    ['OUT', 'O', 'OFF'].includes((r.scan_type || '').toUpperCase())
  );
  const unknownRecords = attendanceData.filter(r => 
    !['IN', 'I', 'ON', 'OUT', 'O', 'OFF'].includes((r.scan_type || '').toUpperCase())
  );
  
  console.log('\n📈 ATTENDANCE BREAKDOWN:');
  console.log(`   Total Records: ${attendanceData.length}`);
  console.log(`   IN/F1 Punches: ${inRecords.length}`);
  console.log(`   OUT/F4 Punches: ${outRecords.length}`);
  console.log(`   Unknown/Emergency: ${unknownRecords.length}`);
  
  if (auditData.length > 0) {
    console.log('\n📉 AUDIT REPORT COUNTS:');
    console.log(`   Total Punches: ${auditData[0].punch_count}`);
    console.log(`   IN Count: ${auditData[0].in_count}`);
    console.log(`   OUT Count: ${auditData[0].out_count}`);
  }
  
  // ========== RECORD-BY-RECORD COMPARISON ==========
  console.log('\n\n📝 RECORD-BY-RECORD COMPARISON:');
  console.log('═'.repeat(80));
  
  if (auditData.length > 0) {
    const auditPunches = auditData[0].punches.split('|');
    
    console.log(`\nTotal records to compare: ${attendanceData.length}`);
    console.log(`Audit punch entries: ${auditPunches.length}\n`);
    
    let allMatch = true;
    
    attendanceData.forEach((attRecord, idx) => {
      const expectedPunch = `${attRecord.time_}:${attRecord.scan_type || ''}`;
      const auditPunch = auditPunches[idx];
      const match = expectedPunch === auditPunch;
      
      console.log(`Record ${idx + 1}:`);
      console.log(`   Attendance: ${expectedPunch}`);
      console.log(`   Audit:      ${auditPunch}`);
      console.log(`   Match: ${match ? '✅' : '❌'}`);
      console.log('');
      
      if (!match) allMatch = false;
    });
    
    console.log('─'.repeat(80));
    if (allMatch) {
      console.log('✅✅✅ ALL RECORDS MATCH PERFECTLY! ✅✅✅');
    } else {
      console.log('❌❌❌ RECORDS DO NOT MATCH! ❌❌❌');
    }
  } else {
    console.log('⚠️  Cannot compare - employee not in audit report');
  }
  
  // ========== PUNCH TIME COMPARISON ==========
  console.log('\n\n⏰ PUNCH TIMES COMPARISON:');
  console.log('═'.repeat(80));
  
  if (auditData.length > 0 && inRecords.length > 0) {
    console.log('\nIN/F1 Punches:');
    inRecords.forEach((rec, idx) => {
      console.log(`   ${idx + 1}. ${rec.time_} - ${rec.fingerprint_id}`);
    });
    
    if (auditData[0].first_in) {
      console.log(`\n   Audit First IN: ${auditData[0].first_in}`);
      console.log(`   Attendance First IN: ${inRecords[0].time_}`);
      console.log(`   Match: ${auditData[0].first_in === inRecords[0].time_ ? '✅' : '❌'}`);
    }
    
    if (outRecords.length > 0) {
      console.log('\n\nOUT/F4 Punches:');
      outRecords.forEach((rec, idx) => {
        console.log(`   ${idx + 1}. ${rec.time_} - ${rec.fingerprint_id}`);
      });
      console.log('\n   ⚠️  NOTE: Audit report should NOT include OUT punches');
    } else {
      console.log('\n\nOUT/F4 Punches: None');
      console.log('   ✅ This is correct for audit report (shows employees with no OUT)');
    }
    
    if (unknownRecords.length > 0) {
      console.log('\n\nUnknown/Emergency Punches:');
      unknownRecords.forEach((rec, idx) => {
        console.log(`   ${idx + 1}. ${rec.time_} - ${rec.fingerprint_id}`);
      });
    }
  }
  
  // ========== FINAL VERDICT ==========
  console.log('\n\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║                        FINAL VERDICT                           ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  
  const shouldBeInAudit = inRecords.length >= 1 && outRecords.length === 0;
  const isInAudit = auditData.length > 0;
  
  console.log(`Should be in audit report (has IN, no OUT): ${shouldBeInAudit ? '✅ YES' : '❌ NO'}`);
  console.log(`Is in audit report: ${isInAudit ? '✅ YES' : '❌ NO'}`);
  
  if (shouldBeInAudit === isInAudit) {
    console.log('\n✅ CONSISTENT: Audit and attendance reports are aligned!');
  } else {
    console.log('\n❌ INCONSISTENT: Audit and attendance reports are NOT aligned!');
  }
  
  // Check if all punch times match
  if (auditData.length > 0 && attendanceData.length === auditData[0].punch_count) {
    console.log('✅ PUNCH COUNT: Matches between reports');
  } else if (auditData.length > 0) {
    console.log(`⚠️  PUNCH COUNT: Audit=${auditData[0].punch_count}, Attendance=${attendanceData.length}`);
  }
  
  // Check if IN counts match
  if (auditData.length > 0 && inRecords.length === auditData[0].in_count) {
    console.log('✅ IN COUNT: Matches between reports');
  } else if (auditData.length > 0) {
    console.log(`⚠️  IN COUNT: Audit=${auditData[0].in_count}, Attendance=${inRecords.length}`);
  }
  
  // Check if OUT counts match
  if (auditData.length > 0 && outRecords.length === auditData[0].out_count) {
    console.log('✅ OUT COUNT: Matches between reports');
  } else if (auditData.length > 0) {
    console.log(`⚠️  OUT COUNT: Audit=${auditData[0].out_count}, Attendance=${outRecords.length}`);
  }
  
  await conn.end();
  console.log('\n✅ Analysis complete!\n');
}

compareReports().catch(err => {
  console.error('\n❌ Error:', err.message);
  console.error(err.stack);
  process.exit(1);
});
