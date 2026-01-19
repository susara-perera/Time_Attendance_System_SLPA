const mysql = require('mysql2/promise');

async function testQuery() {
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST || 'localhost',
    port: process.env.MYSQL_PORT || 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'slpa_db',
    connectTimeout: 5000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
  });

  const attendanceQuery = `
    SELECT employee_ID as employee_id, time_ as check_in_time
    FROM attendance
    WHERE date_ = CURDATE()
    ORDER BY employee_ID, time_
  `;

  const [rows] = await connection.execute(attendanceQuery);
  console.log('Attendance rows:', rows.length);
  if (rows.length > 0) {
    console.log('Sample row:', rows[0]);
  }

  await connection.end();
}

testQuery().catch(console.error);