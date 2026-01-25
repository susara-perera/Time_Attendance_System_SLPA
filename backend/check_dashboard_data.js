const mysql = require('mysql2/promise');

async function checkData() {
  let connection;
  try {
    console.log('Connecting to MySQL...\n');
    
    connection = await mysql.createConnection({
      host: '127.0.0.1',
      port: 3306,
      user: 'root',
      password: 'gads71',
      database: 'slpa_db'
    });
    
    console.log('✅ Connected\n');
    console.log('📊 Querying total_count_dashboard...\n');

    const [rows] = await connection.execute(`
      SELECT 
        id,
        totalDivisions,
        totalSections,
        totalSubsections,
        totalActiveEmployees,
        IS_attendance_trend,
        present_IS,
        absent_IS,
        last_updated
      FROM total_count_dashboard
      WHERE id = 1
    `);

    if (rows.length === 0) {
      console.log('❌ No data found in total_count_dashboard table');
      console.log('   Run the sync first from Manual Sync page or run updateDashboardTotals()');
    } else {
      const data = rows[0];
      
      console.log('✅ Data found!\n');
      console.log('📊 Basic Counts:');
      console.log(`   - Divisions: ${data.totalDivisions}`);
      console.log(`   - Sections: ${data.totalSections}`);
      console.log(`   - Subsections: ${data.totalSubsections}`);
      console.log(`   - Active Employees: ${data.totalActiveEmployees}`);
      console.log(`   - Last Updated: ${data.last_updated}`);
      
      // Parse and show IS attendance trend
      console.log('\n📈 IS Attendance Trend:');
      if (data.IS_attendance_trend) {
        try {
          const trend = typeof data.IS_attendance_trend === 'string' 
            ? JSON.parse(data.IS_attendance_trend) 
            : data.IS_attendance_trend;
          
          if (Array.isArray(trend) && trend.length > 0) {
            console.table(trend);
          } else {
            console.log('   (empty or null)');
          }
        } catch (e) {
          console.log('   Error parsing:', e.message);
        }
      } else {
        console.log('   NULL');
      }
      
      // Parse and show present employees
      console.log('\n👥 Present IS Employees:');
      if (data.present_IS) {
        try {
          const present = typeof data.present_IS === 'string' 
            ? JSON.parse(data.present_IS) 
            : data.present_IS;
          
          if (Array.isArray(present)) {
            console.log(`   Count: ${present.length}`);
            if (present.length > 0) {
              console.log('   First 3:');
              console.table(present.slice(0, 3));
            }
          } else {
            console.log('   (not an array)');
          }
        } catch (e) {
          console.log('   Error parsing:', e.message);
        }
      } else {
        console.log('   NULL');
      }
      
      // Parse and show absent employees
      console.log('\n❌ Absent IS Employees:');
      if (data.absent_IS) {
        try {
          const absent = typeof data.absent_IS === 'string' 
            ? JSON.parse(data.absent_IS) 
            : data.absent_IS;
          
          if (Array.isArray(absent)) {
            console.log(`   Count: ${absent.length}`);
            if (absent.length > 0) {
              console.log('   First 3:');
              console.table(absent.slice(0, 3));
            }
          } else {
            console.log('   (not an array)');
          }
        } catch (e) {
          console.log('   Error parsing:', e.message);
        }
      } else {
        console.log('   NULL');
      }
    }

    await connection.end();
    console.log('\n✅ Done!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (connection) await connection.end();
    process.exit(1);
  }
}

checkData();
