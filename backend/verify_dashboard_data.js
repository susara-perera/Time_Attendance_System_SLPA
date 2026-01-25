/**
 * Verify dashboard totals data in database
 * Run: node verify_dashboard_data.js
 */

require('dotenv').config();
const { sequelize } = require('./config/mysql');

async function verifyData() {
  try {
    console.log('🔍 Verifying dashboard totals data in database...\n');
    
    await sequelize.authenticate();
    console.log('✅ MySQL connected\n');

    const [results] = await sequelize.query(`
      SELECT 
        id,
        totalDivisions,
        totalSections,
        totalSubsections,
        totalActiveEmployees,
        JSON_LENGTH(IS_attendance_trend) as trend_count,
        JSON_LENGTH(present_IS) as present_count,
        JSON_LENGTH(absent_IS) as absent_count,
        JSON_EXTRACT(is_division_attendance, '$.totalEmployees') as total_employees,
        JSON_EXTRACT(is_division_attendance, '$.presentCount') as present_count_unified,
        JSON_EXTRACT(is_division_attendance, '$.absentCount') as absent_count_unified,
        last_updated
      FROM total_count_dashboard
      WHERE id = 1
    `);

    if (results.length === 0) {
      console.log('❌ No data found in total_count_dashboard table');
      process.exit(1);
    }

    const data = results[0];
    console.log('📊 Dashboard Totals Data:');
    console.log('='.repeat(80));
    console.log(`Divisions: ${data.totalDivisions}`);
    console.log(`Sections: ${data.totalSections}`);
    console.log(`Subsections: ${data.totalSubsections}`);
    console.log(`Active Employees: ${data.totalActiveEmployees}`);
    console.log(`Last Updated: ${data.last_updated}`);
    console.log();
    console.log('📈 IS Attendance Data:');
    console.log(`  Trend Days: ${data.trend_count || 0}`);
    console.log(`  Present Employees: ${data.present_count || 0}`);
    console.log(`  Absent Employees: ${data.absent_count || 0}`);
    console.log(`  Total IS Employees: ${data.total_employees || 0}`);
    console.log(`  Present Count (unified): ${data.present_count_unified || 0}`);
    console.log(`  Absent Count (unified): ${data.absent_count_unified || 0}`);

    // Get sample employee data
    console.log('\n📋 Sample Present IS Employee:');
    const [presentSample] = await sequelize.query(`
      SELECT JSON_EXTRACT(present_IS, '$[0]') as sample_employee
      FROM total_count_dashboard
      WHERE id = 1
    `);
    if (presentSample[0]?.sample_employee) {
      console.log(JSON.stringify(JSON.parse(presentSample[0].sample_employee), null, 2));
    }

    console.log('\n📋 Sample Absent IS Employee:');
    const [absentSample] = await sequelize.query(`
      SELECT JSON_EXTRACT(absent_IS, '$[0]') as sample_employee
      FROM total_count_dashboard
      WHERE id = 1
    `);
    if (absentSample[0]?.sample_employee) {
      console.log(JSON.stringify(JSON.parse(absentSample[0].sample_employee), null, 2));
    }

    console.log('\n📋 Sample is_division_attendance Employee:');
    const [isDivSample] = await sequelize.query(`
      SELECT JSON_EXTRACT(is_division_attendance, '$.employees[0]') as sample_employee
      FROM total_count_dashboard
      WHERE id = 1
    `);
    if (isDivSample[0]?.sample_employee) {
      console.log(JSON.stringify(JSON.parse(isDivSample[0].sample_employee), null, 2));
    }

    console.log('\n✅ Verification complete!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

verifyData();
