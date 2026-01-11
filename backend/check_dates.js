const mysql = require('mysql2/promise');

async function checkDateRanges() {
  let conn;
  try {
    conn = await mysql.createConnection({
      host: '127.0.0.1',
      user: 'root',
      password: 'gads71',
      database: 'slpa_db'
    });

    console.log('🔍 Checking attendance data date ranges...\n');

    // Check date ranges with data
    const [dateRanges] = await conn.execute(`
      SELECT
        MIN(date_) as earliest_date,
        MAX(date_) as latest_date,
        COUNT(*) as total_records
      FROM attendance
    `);

    console.log('📅 Attendance Data Range:');
    console.log(`   From: ${dateRanges[0].earliest_date}`);
    console.log(`   To: ${dateRanges[0].latest_date}`);
    console.log(`   Total Records: ${dateRanges[0].total_records}`);

    // Check recent months
    const [monthly] = await conn.execute(`
      SELECT
        DATE_FORMAT(date_, '%Y-%m') as month,
        COUNT(*) as records
      FROM attendance
      WHERE date_ >= '2024-01-01'
      GROUP BY DATE_FORMAT(date_, '%Y-%m')
      ORDER BY month DESC
      LIMIT 10
    `);

    console.log('\n📊 Records by Month (2024+):');
    monthly.forEach(row => {
      console.log(`   ${row.month}: ${row.records} records`);
    });

    // Check for incomplete punches in recent data
    const [incomplete] = await conn.execute(`
      SELECT
        DATE_FORMAT(date_, '%Y-%m') as month,
        COUNT(*) as incomplete_punches
      FROM (
        SELECT employee_ID, date_, COUNT(*) as punches
        FROM attendance
        WHERE date_ >= '2024-01-01'
        GROUP BY employee_ID, date_
        HAVING COUNT(*) = 1
      ) as incomplete_data
      GROUP BY DATE_FORMAT(date_, '%Y-%m')
      ORDER BY month DESC
      LIMIT 10
    `);

    console.log('\n⚠️  Incomplete Punches by Month (2024+):');
    incomplete.forEach(row => {
      console.log(`   ${row.month}: ${row.incomplete_punches} incomplete`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (conn) await conn.end();
  }
}

checkDateRanges();