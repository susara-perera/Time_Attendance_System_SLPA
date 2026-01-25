const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: 'gads71',
    database: 'slpa_db'
  });

  try {
    console.log('📊 Fetching sample records from attendance table...\n');
    
    // Get sample records
    const [rows] = await conn.execute(`
      SELECT attendance_id, employee_ID, fingerprint_id, date_, time_, scan_type 
      FROM attendance 
      LIMIT 20
    `);
    
    console.log(`Total records fetched: ${rows.length}\n`);
    
    rows.forEach((row, i) => {
      console.log(`${i+1}. ID: ${row.attendance_id} | Employee: ${row.employee_ID} | Fingerprint: "${row.fingerprint_id}" | Date: ${row.date_} | Time: ${row.time_} | Type: ${row.scan_type}`);
    });
    
    // Check unique fingerprint_id values
    console.log('\n--- Checking unique fingerprint_id values ---');
    const [unique] = await conn.execute(`
      SELECT DISTINCT fingerprint_id 
      FROM attendance 
      WHERE fingerprint_id IS NOT NULL 
      LIMIT 10
    `);
    
    console.log('Sample unique fingerprint_id values:');
    unique.forEach(u => console.log(`  "${u.fingerprint_id}"`));
    
    // Count NULL vs non-NULL
    const [stats] = await conn.execute(`
      SELECT 
        COUNT(*) as total_records,
        SUM(CASE WHEN fingerprint_id IS NULL THEN 1 ELSE 0 END) as null_count,
        SUM(CASE WHEN fingerprint_id IS NOT NULL THEN 1 ELSE 0 END) as non_null_count
      FROM attendance
    `);
    
    console.log('\n--- Fingerprint ID Statistics ---');
    console.log(`Total records: ${stats[0].total_records}`);
    console.log(`NULL values: ${stats[0].null_count}`);
    console.log(`Non-NULL values: ${stats[0].non_null_count}`);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await conn.end();
  }
})();
