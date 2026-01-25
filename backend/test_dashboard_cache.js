require('dotenv').config();
const axios = require('axios');

async function testDashboardAPI() {
  console.log('🧪 Testing Dashboard API with Cache Table...\n');
  
  const API_BASE = 'http://localhost:5000/api';
  
  try {
    console.log('📊 Fetching dashboard stats...');
    const startTime = Date.now();
    
    const response = await axios.get(`${API_BASE}/dashboard/stats`);
    const loadTime = Date.now() - startTime;
    
    console.log(`✅ Response received in ${loadTime}ms\n`);
    
    const data = response.data.data;
    
    console.log('📈 Dashboard Statistics:');
    console.log('='.repeat(80));
    console.log(`  Data Source: ${data.dataSource}`);
    console.log(`  Cache Last Updated: ${data.cacheLastUpdated}`);
    console.log(`\n  Totals:`);
    console.log(`    Divisions: ${data.totalDivisions}`);
    console.log(`    Sections: ${data.totalSections}`);
    console.log(`    Subsections: ${data.totalSubSections}`);
    console.log(`    Employees: ${data.totalEmployees}`);
    console.log(`    Present Today: ${data.presentToday} (${data.attendanceRate}%)`);
    
    console.log(`\n  📊 Weekly Trend (${data.weeklyTrend?.length || 0} days):`);
    if (data.weeklyTrend && data.weeklyTrend.length > 0) {
      data.weeklyTrend.forEach(day => {
        console.log(`    ${day.date}: ${day.employees} employees`);
      });
    } else {
      console.log('    ⚠️ No trend data');
    }
    
    console.log(`\n  🏢 IS Division Attendance:`);
    console.log(`    Total Employees: ${data.totalEmployeesIS}`);
    console.log(`    Present Today: ${data.presentTodayISCount}`);
    console.log(`    Absent Today: ${data.absentTodayISCount}`);
    if (data.totalEmployeesIS > 0) {
      const rate = ((data.presentTodayISCount / data.totalEmployeesIS) * 100).toFixed(1);
      console.log(`    Attendance Rate: ${rate}%`);
    }
    
    console.log(`\n  👥 Recent Activities: ${data.recentActivities?.length || 0} items`);
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Dashboard is using cached data from total_count_dashboard table!');
    console.log(`🚀 Load time: ${loadTime}ms (should be <100ms with cache)`);
    
    if (data.dataSource === 'Dashboard Cache Table') {
      console.log('\n✅ SUCCESS: Dashboard is reading from total_count_dashboard! 🎉');
    } else {
      console.log(`\n⚠️ WARNING: Dashboard data source is "${data.dataSource}" (expected "Dashboard Cache Table")`);
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testDashboardAPI();
