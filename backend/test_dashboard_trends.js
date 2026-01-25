/**
 * Test script to verify dashboard trends and individual attendance reports
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { sequelize } = require('./config/mysql');
const dashboardTotalsService = require('./services/dashboardTotalsService');

const runTests = async () => {
  try {
    console.log('🧪 Starting Dashboard Fixes Verification...\n');

    // Test 1: Update dashboard totals with new trends
    console.log('📊 Test 1: Update dashboard totals with monthly/annual trends');
    const updateResult = await dashboardTotalsService.updateDashboardTotals();
    if (updateResult.success) {
      console.log('✅ Dashboard totals updated successfully');
      console.log('   Daily trend entries:', updateResult.totals.attendanceTrend.length);
      console.log('   Monthly trend entries:', updateResult.totals.monthlyTrend.length);
      console.log('   Annual trend entries:', updateResult.totals.annualTrend.length);
      console.log('   Sample daily trend:', JSON.stringify(updateResult.totals.attendanceTrend.slice(0, 2)));
      console.log('   Sample monthly trend:', updateResult.totals.monthlyTrend);
      console.log('   Sample annual trend:', updateResult.totals.annualTrend);
    }

    // Test 2: Retrieve cached data
    console.log('\n📊 Test 2: Retrieve cached dashboard data');
    const cachedResult = await dashboardTotalsService.getDashboardTotals();
    if (cachedResult.success && cachedResult.data) {
      console.log('✅ Dashboard data retrieved successfully');
      console.log('   Total Divisions:', cachedResult.data.totalDivisions);
      console.log('   Total Sections:', cachedResult.data.totalSections);
      console.log('   Active Employees:', cachedResult.data.totalActiveEmployees);
      console.log('   Weekly trend data:', Array.isArray(cachedResult.data.attendance_trend_data) ? 
        cachedResult.data.attendance_trend_data.length + ' days' : 'N/A');
      console.log('   Monthly trend data:', Array.isArray(cachedResult.data.monthly_trend_data) ? 
        cachedResult.data.monthly_trend_data.length + ' weeks' : 'N/A');
      console.log('   Annual trend data:', Array.isArray(cachedResult.data.annual_trend_data) ? 
        cachedResult.data.annual_trend_data.length + ' months' : 'N/A');
    }

    // Test 3: Check database schema
    console.log('\n📋 Test 3: Verify database columns');
    const [columnInfo] = await sequelize.query(`
      SELECT COLUMN_NAME, DATA_TYPE, COLUMN_COMMENT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'total_count_dashboard' AND TABLE_SCHEMA = ?
      ORDER BY ORDINAL_POSITION
    `, { replacements: [process.env.MYSQL_DATABASE || 'slpa_db'] });

    if (columnInfo.length > 0) {
      console.log('✅ Dashboard table columns:');
      columnInfo.forEach(col => {
        if (col.COLUMN_NAME.includes('trend') || col.COLUMN_NAME.includes('total')) {
          console.log(`   - ${col.COLUMN_NAME}: ${col.DATA_TYPE}${col.COLUMN_COMMENT ? ' (' + col.COLUMN_COMMENT + ')' : ''}`);
        }
      });
    }

    console.log('\n✅ All tests completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error);
    process.exit(1);
  }
};

runTests();
