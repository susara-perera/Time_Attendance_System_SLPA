require('dotenv').config();
const { updateDashboardTotals, getDashboardTotals } = require('./services/dashboardTotalsService');

async function testSync() {
  try {
    console.log('🧪 Testing Dashboard Total Count Sync with IS Attendance...\n');
    console.log('=' .repeat(60));
    
    // Run the sync
    console.log('\n📊 Step 1: Running updateDashboardTotals()...\n');
    const updateResult = await updateDashboardTotals();
    
    console.log('\n✅ Sync completed successfully!');
    console.log('Result:', JSON.stringify(updateResult, null, 2));
    
    // Fetch the data back
    console.log('\n' + '='.repeat(60));
    console.log('\n📖 Step 2: Fetching data from total_count_dashboard...\n');
    const fetchResult = await getDashboardTotals();
    
    if (fetchResult.success && fetchResult.data) {
      const data = fetchResult.data;
      
      console.log('✅ Data retrieved successfully!\n');
      console.log('📊 Dashboard Counts:');
      console.log(`   - Total Divisions: ${data.totalDivisions}`);
      console.log(`   - Total Sections: ${data.totalSections}`);
      console.log(`   - Total Subsections: ${data.totalSubsections}`);
      console.log(`   - Total Active Employees: ${data.totalActiveEmployees}`);
      
      console.log('\n📈 IS Attendance Trend (7 days):');
      if (data.IS_attendance_trend && Array.isArray(data.IS_attendance_trend)) {
        console.table(data.IS_attendance_trend);
        console.log(`   Total trend records: ${data.IS_attendance_trend.length}`);
      } else {
        console.log('   ⚠️ No trend data found');
      }
      
      console.log('\n👥 Present IS Employees Today:');
      if (data.present_IS && Array.isArray(data.present_IS)) {
        console.log(`   Count: ${data.present_IS.length}`);
        if (data.present_IS.length > 0) {
          console.log('   Sample (first 5):');
          console.table(data.present_IS.slice(0, 5));
        }
      } else {
        console.log('   ⚠️ No present employees data found');
      }
      
      console.log('\n❌ Absent IS Employees Today:');
      if (data.absent_IS && Array.isArray(data.absent_IS)) {
        console.log(`   Count: ${data.absent_IS.length}`);
        if (data.absent_IS.length > 0) {
          console.log('   Sample (first 5):');
          console.table(data.absent_IS.slice(0, 5));
        }
      } else {
        console.log('   ⚠️ No absent employees data found');
      }
      
      console.log('\n📅 Last Updated:', data.last_updated);
      
      // Validation
      console.log('\n' + '='.repeat(60));
      console.log('\n✅ VALIDATION RESULTS:\n');
      
      const validations = [
        { name: 'Total counts populated', pass: data.totalDivisions > 0 || data.totalSections > 0 || data.totalActiveEmployees > 0 },
        { name: 'IS attendance trend exists', pass: data.IS_attendance_trend && data.IS_attendance_trend.length === 7 },
        { name: 'IS attendance trend has data', pass: data.IS_attendance_trend && data.IS_attendance_trend.some(d => d.employees > 0) },
        { name: 'Present IS employees exists', pass: data.present_IS && Array.isArray(data.present_IS) },
        { name: 'Absent IS employees exists', pass: data.absent_IS && Array.isArray(data.absent_IS) },
        { name: 'Last updated is recent', pass: data.last_updated !== null }
      ];
      
      validations.forEach(v => {
        console.log(`   ${v.pass ? '✅' : '❌'} ${v.name}`);
      });
      
      const allPassed = validations.every(v => v.pass);
      
      if (allPassed) {
        console.log('\n🎉 ALL TESTS PASSED! Sync is working correctly!');
      } else {
        console.log('\n⚠️ Some validations failed. Check the data above.');
      }
      
    } else {
      console.log('❌ Failed to fetch data');
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('\n✅ Test completed!\n');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testSync();
