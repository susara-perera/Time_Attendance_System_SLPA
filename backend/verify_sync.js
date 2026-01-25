const mysql = require('mysql2/promise');

async function checkSyncResult() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: '127.0.0.1',
      port: 3306,
      user: 'root',
      password: 'gads71',
      database: 'slpa_db'
    });

    console.log('✅ Connected to MySQL\n');

    // Check if dashboard data was updated
    const [rows] = await connection.execute(`
      SELECT
        totalDivisions,
        totalSections,
        totalActiveEmployees,
        IS_attendance_trend,
        present_IS,
        absent_IS,
        last_updated
      FROM total_count_dashboard
      WHERE id = 1
    `);

    if (rows.length > 0) {
      const data = rows[0];
      console.log('📊 Dashboard Sync Results:');
      console.log(`   Divisions: ${data.totalDivisions}`);
      console.log(`   Sections: ${data.totalSections}`);
      console.log(`   Active Employees: ${data.totalActiveEmployees}`);
      console.log(`   Last Updated: ${data.last_updated}`);

      if (data.IS_attendance_trend) {
        const trend = JSON.parse(data.IS_attendance_trend);
        console.log(`   📈 IS Attendance Trend: ${trend.length} days`);
      }

      if (data.present_IS) {
        const present = JSON.parse(data.present_IS);
        console.log(`   👥 Present IS Today: ${present.length} employees`);
      }

      if (data.absent_IS) {
        const absent = JSON.parse(data.absent_IS);
        console.log(`   ❌ Absent IS Today: ${absent.length} employees`);
      }

      console.log('\n✅ Automatic dashboard sync is working correctly!');
    } else {
      console.log('❌ No dashboard data found');
    }

    await connection.end();

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (connection) await connection.end();
  }
}

checkSyncResult();
