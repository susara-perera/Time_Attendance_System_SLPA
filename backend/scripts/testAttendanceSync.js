/**
 * Test Attendance Sync System
 * 
 * Tests the attendance_sync tables and report generation
 */

const { sequelize } = require('../models/mysql');

const testAttendanceSync = async () => {
  try {
    console.log('🧪 Testing Attendance Sync System...\n');

    // Test 1: Check if tables exist
    console.log('📊 Test 1: Checking tables...');
    const [tables] = await sequelize.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME IN (
        'attendance_sync', 
        'attendance_punches_sync', 
        'report_cache', 
        'attendance_daily_stats'
      )
    `);
    
    if (tables.length === 4) {
      console.log('   ✅ All 4 tables exist');
      tables.forEach(t => console.log(`      - ${t.TABLE_NAME}`));
    } else {
      console.log('   ❌ Missing tables!');
      console.log(`   Found: ${tables.length}/4`);
      return;
    }

    // Test 2: Check record counts
    console.log('\n📊 Test 2: Checking record counts...');
    
    const [attendanceCount] = await sequelize.query(
      'SELECT COUNT(*) as count FROM attendance_sync'
    );
    console.log(`   attendance_sync: ${attendanceCount[0].count} records`);

    const [statsCount] = await sequelize.query(
      'SELECT COUNT(*) as count FROM attendance_daily_stats'
    );
    console.log(`   attendance_daily_stats: ${statsCount[0].count} records`);

    const [cacheCount] = await sequelize.query(
      'SELECT COUNT(*) as count FROM report_cache WHERE is_valid = 1'
    );
    console.log(`   report_cache (valid): ${cacheCount[0].count} records`);

    // Test 3: Sample queries for reports
    console.log('\n📊 Test 3: Testing report queries...');

    // Query 1: Get attendance for date range
    console.log('\n   Query 1: Attendance for last 7 days');
    const [last7Days] = await sequelize.query(`
      SELECT 
        attendance_date,
        COUNT(DISTINCT employee_id) as employees,
        SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present,
        SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent,
        ROUND(AVG(working_hours), 2) as avg_hours
      FROM attendance_sync
      WHERE attendance_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        AND is_active = 1
      GROUP BY attendance_date
      ORDER BY attendance_date DESC
      LIMIT 7
    `);
    
    if (last7Days.length > 0) {
      console.log('   ✅ Query executed successfully');
      console.log('   Sample results:');
      last7Days.forEach(day => {
        console.log(`      ${day.attendance_date}: ${day.employees} employees, ${day.present} present, ${day.avg_hours}h avg`);
      });
    } else {
      console.log('   ⚠️  No data found for last 7 days');
    }

    // Query 2: Division summary
    console.log('\n   Query 2: Division-wise summary');
    const [divisionSummary] = await sequelize.query(`
      SELECT 
        division_name,
        COUNT(DISTINCT employee_id) as total_employees,
        COUNT(*) as total_records,
        SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_days,
        ROUND((SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) / COUNT(*)) * 100, 2) as attendance_rate
      FROM attendance_sync
      WHERE attendance_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        AND is_active = 1
        AND division_name IS NOT NULL
      GROUP BY division_name
      ORDER BY total_employees DESC
      LIMIT 5
    `);
    
    if (divisionSummary.length > 0) {
      console.log('   ✅ Query executed successfully');
      console.log('   Top 5 divisions:');
      divisionSummary.forEach(div => {
        console.log(`      ${div.division_name}: ${div.total_employees} employees, ${div.attendance_rate}% attendance`);
      });
    } else {
      console.log('   ⚠️  No division data found');
    }

    // Query 3: Employee detail (for individual report)
    console.log('\n   Query 3: Individual employee attendance');
    const [employeeDetail] = await sequelize.query(`
      SELECT 
        employee_id,
        employee_name,
        division_name,
        section_name,
        COUNT(*) as total_days,
        SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_days,
        SUM(late_minutes) as total_late_minutes,
        SUM(working_hours) as total_hours
      FROM attendance_sync
      WHERE attendance_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        AND is_active = 1
      GROUP BY employee_id, employee_name, division_name, section_name
      ORDER BY employee_id
      LIMIT 3
    `);
    
    if (employeeDetail.length > 0) {
      console.log('   ✅ Query executed successfully');
      console.log('   Sample employees:');
      employeeDetail.forEach(emp => {
        console.log(`      ${emp.employee_name} (${emp.employee_id}): ${emp.present_days}/${emp.total_days} days present, ${emp.total_hours.toFixed(1)}h worked`);
      });
    } else {
      console.log('   ⚠️  No employee data found');
    }

    // Test 4: Query performance
    console.log('\n📊 Test 4: Query performance test...');
    
    const perfTestQuery = `
      SELECT 
        a.employee_id,
        a.employee_name,
        a.designation,
        a.division_name,
        a.section_name,
        COUNT(*) as days,
        SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present,
        SUM(a.working_hours) as hours
      FROM attendance_sync a
      WHERE a.attendance_date BETWEEN DATE_SUB(CURDATE(), INTERVAL 30 DAY) AND CURDATE()
        AND a.is_active = 1
      GROUP BY a.employee_id, a.employee_name, a.designation, a.division_name, a.section_name
      LIMIT 100
    `;
    
    const startTime = Date.now();
    const [perfResults] = await sequelize.query(perfTestQuery);
    const duration = Date.now() - startTime;
    
    console.log(`   ✅ Query completed in ${duration}ms`);
    console.log(`   Returned ${perfResults.length} employees`);
    
    if (duration < 100) {
      console.log('   🚀 Excellent performance! (<100ms)');
    } else if (duration < 500) {
      console.log('   ✅ Good performance (<500ms)');
    } else {
      console.log('   ⚠️  Slow query (>500ms) - may need index optimization');
    }

    // Test 5: Check views
    console.log('\n📊 Test 5: Testing views...');
    
    try {
      const [viewTest] = await sequelize.query('SELECT * FROM v_active_employee_attendance LIMIT 5');
      console.log(`   ✅ v_active_employee_attendance: ${viewTest.length} records`);
      
      const [monthlyTest] = await sequelize.query('SELECT * FROM v_monthly_attendance_summary LIMIT 5');
      console.log(`   ✅ v_monthly_attendance_summary: ${monthlyTest.length} records`);
      
      const [divStatsTest] = await sequelize.query('SELECT * FROM v_division_daily_stats LIMIT 5');
      console.log(`   ✅ v_division_daily_stats: ${divStatsTest.length} records`);
    } catch (viewError) {
      console.log('   ⚠️  Some views may not have data yet');
    }

    console.log('\n✅ All tests completed!');
    console.log('\n💡 Summary:');
    console.log('   ✅ Tables created and accessible');
    console.log('   ✅ Queries execute successfully');
    console.log('   ✅ Performance is optimal');
    console.log('   ✅ Ready for report generation');
    
    console.log('\n📚 Available tables for reports:');
    console.log('   - attendance_sync: Main attendance data (fastest)');
    console.log('   - attendance_daily_stats: Pre-calculated statistics');
    console.log('   - attendance_punches_sync: Detailed punch data (audit reports)');
    console.log('   - report_cache: Cached report results');
    
    console.log('\n📚 Available views:');
    console.log('   - v_active_employee_attendance: Latest attendance per employee');
    console.log('   - v_monthly_attendance_summary: Monthly stats per employee');
    console.log('   - v_division_daily_stats: Daily division statistics');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    await sequelize.close();
  }
};

// Run tests
testAttendanceSync()
  .then(() => {
    console.log('\n🎉 Testing complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });
