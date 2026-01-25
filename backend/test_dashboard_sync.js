require('dotenv').config();
const { updateDashboardTotals } = require('./services/dashboardTotalsService');

async function testDashboardSync() {
  console.log('🧪 Testing Dashboard Totals Sync...\n');
  
  try {
    const result = await updateDashboardTotals();
    
    console.log('\n📊 Sync Result:');
    console.log('='.repeat(80));
    console.log('Success:', result.success);
    console.log('\nTotals:');
    console.log('  Divisions:', result.totals.totalDivisions);
    console.log('  Sections:', result.totals.totalSections);
    console.log('  Subsections:', result.totals.totalSubsections);
    console.log('  Active Employees:', result.totals.totalActiveEmployees);
    
    console.log('\n📈 Attendance Trend (7 days):');
    if (result.totals.attendanceTrend && result.totals.attendanceTrend.length > 0) {
      result.totals.attendanceTrend.forEach(day => {
        console.log(`  ${day.date}: ${day.employees} employees`);
      });
    } else {
      console.log('  No data');
    }
    
    console.log('\n🏢 IS Division Attendance:');
    if (result.totals.isDivisionAttendance) {
      const isData = result.totals.isDivisionAttendance;
      console.log(`  Present: ${isData.presentToday}`);
      console.log(`  Absent: ${isData.absentToday}`);
      console.log(`  Total: ${isData.totalEmployees}`);
      console.log(`  Attendance Rate: ${((isData.presentToday / isData.totalEmployees) * 100).toFixed(1)}%`);
    } else {
      console.log('  No data');
    }
    
    console.log('\n✅ Test complete!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  } finally {
    process.exit(0);
  }
}

testDashboardSync();
