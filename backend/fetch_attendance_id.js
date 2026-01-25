const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: 'gads71',
    database: 'slpa_db'
  });

  try {
    const attendanceId = 1109981;
    console.log(`\n📋 Fetching Attendance Record ID: ${attendanceId}\n`);
    
    const [rows] = await conn.execute(
      'SELECT * FROM attendance WHERE attendance_id = ?',
      [attendanceId]
    );

    if (rows.length === 0) {
      console.log('❌ No record found with this ID\n');
    } else {
      const record = rows[0];
      console.log('✅ Record Found:\n');
      console.log('─'.repeat(60));
      Object.keys(record).forEach(key => {
        console.log(`${key.padEnd(20)}: ${record[key]}`);
      });
      console.log('─'.repeat(60));
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await conn.end();
  }
})();
