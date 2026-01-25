const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: 'gads71',
    database: 'slpa_db'
  });

  try {
    const employeeId = 448225;
    const date = '2026-01-21';
    
    console.log(`\n📋 Fetching ALL attendance records for Employee ${employeeId} on ${date}\n`);
    console.log('='.repeat(100));
    
    const [allRecords] = await conn.execute(`
      SELECT 
        attendance_id,
        employee_ID,
        fingerprint_id,
        date_,
        time_,
        scan_type
      FROM attendance 
      WHERE employee_ID = ? 
      AND date_ = ?
      ORDER BY time_
    `, [employeeId, date]);
    
    console.log(`\n✅ Total Records Found: ${allRecords.length}\n`);
    
    allRecords.forEach((rec, i) => {
      const isEmergency = rec.fingerprint_id && rec.fingerprint_id.includes('Emergancy Exit');
      const marker = isEmergency ? '🚨 EMERGENCY EXIT' : '✓';
      console.log(`${i+1}. ${marker} | ID: ${rec.attendance_id} | Time: ${rec.time_} | Type: ${rec.scan_type || 'NULL'} | Device: "${rec.fingerprint_id}"`);
    });
    
    // Count Emergency Exit records
    const emergencyCount = allRecords.filter(r => r.fingerprint_id && r.fingerprint_id.includes('Emergancy Exit')).length;
    const regularCount = allRecords.length - emergencyCount;
    
    console.log('\n' + '='.repeat(100));
    console.log(`\n📊 Summary:`);
    console.log(`   Total Records: ${allRecords.length}`);
    console.log(`   Emergency Exit Records: ${emergencyCount}`);
    console.log(`   Regular Records: ${regularCount}`);
    
    // Now test with filter
    console.log('\n\n📋 Fetching FILTERED records (excluding Emergency Exit)\n');
    console.log('='.repeat(100));
    
    const [filteredRecords] = await conn.execute(`
      SELECT 
        attendance_id,
        employee_ID,
        fingerprint_id,
        date_,
        time_,
        scan_type
      FROM attendance 
      WHERE employee_ID = ? 
      AND date_ = ?
      AND (fingerprint_id NOT LIKE '%Emergancy Exit%' OR fingerprint_id IS NULL)
      ORDER BY time_
    `, [employeeId, date]);
    
    console.log(`\n✅ Filtered Records Found: ${filteredRecords.length}\n`);
    
    filteredRecords.forEach((rec, i) => {
      console.log(`${i+1}. ✓ | ID: ${rec.attendance_id} | Time: ${rec.time_} | Type: ${rec.scan_type || 'NULL'} | Device: "${rec.fingerprint_id}"`);
    });
    
    console.log('\n' + '='.repeat(100));
    console.log(`\n🎯 Filter Working: ${emergencyCount === (allRecords.length - filteredRecords.length) ? '✅ YES' : '❌ NO'}`);
    console.log(`   Records removed by filter: ${allRecords.length - filteredRecords.length}`);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await conn.end();
  }
})();
