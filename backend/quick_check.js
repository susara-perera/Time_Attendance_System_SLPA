const mysql = require('mysql2/promise');

async function quickCheck() {
  try {
    const connection = await mysql.createConnection({
      host: '127.0.0.1',
      port: 3306,
      user: 'root',
      password: 'gads71',
      database: 'slpa_db'
    });
    
    console.log('✅ Connected to MySQL\n');
    
    // Check table structure
    console.log('📋 Table structure:');
    const [columns] = await connection.execute('DESCRIBE total_count_dashboard');
    const columnNames = columns.map(c => c.Field);
    console.log('Columns:', columnNames.join(', '));
    
    // Check if data exists
    console.log('\n📊 Current data:');
    const [data] = await connection.execute('SELECT * FROM total_count_dashboard WHERE id = 1');
    
    if (data.length > 0) {
      const row = data[0];
      console.log(`Divisions: ${row.totalDivisions}`);
      console.log(`Sections: ${row.totalSections}`);
      console.log(`Active Employees: ${row.totalActiveEmployees}`);
      console.log(`Last Updated: ${row.last_updated}`);
      
      if (row.IS_attendance_trend) {
        const trend = JSON.parse(row.IS_attendance_trend);
        console.log(`\nIS Attendance Trend: ${trend.length} days`);
      }
      
      if (row.present_IS) {
        const present = JSON.parse(row.present_IS);
        console.log(`Present IS: ${present.length} employees`);
      }
      
      if (row.absent_IS) {
        const absent = JSON.parse(row.absent_IS);
        console.log(`Absent IS: ${absent.length} employees`);
      }
      
      console.log('\n✅ Sync is working correctly!');
    } else {
      console.log('No data yet - run the sync from Manual Sync page');
    }
    
    await connection.end();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

quickCheck();
