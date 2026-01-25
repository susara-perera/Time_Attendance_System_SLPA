/**
 * Performance Testing Script
 * Tests actual data fetching times across the system
 */

const axios = require('axios');

const baseURL = 'http://localhost:5000/api';
const testToken = process.env.TEST_TOKEN || '';

// Color codes for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

async function runTests() {
  console.log('🧪 Starting Performance Tests...\n');
  
  const results = [];
  let totalTime = 0;
  
  const tests = [
    { name: 'Dashboard Stats', url: `${baseURL}/dashboard/stats`, method: 'get', requiresAuth: true },
    { name: 'Recent Activities', url: `${baseURL}/dashboard/activities/recent?limit=20`, method: 'get', requiresAuth: true },
    { name: 'All Employees', url: `${baseURL}/hris-cache/employees`, method: 'get', requiresAuth: true },
    { name: 'IS Division Employees', url: `${baseURL}/mysql-data/emp-index/division/66`, method: 'get', requiresAuth: true },
    { name: 'IS Attendance Today', url: `${baseURL}/mysql-data/emp-index/division/66/attendance`, method: 'get', requiresAuth: true },
    { name: 'Divisions List', url: `${baseURL}/mysql-data/divisions`, method: 'get', requiresAuth: true },
    { name: 'Sections List', url: `${baseURL}/mysql-data/sections`, method: 'get', requiresAuth: true },
    { name: 'Individual Report', url: `${baseURL}/reports/attendance/individual?employeeId=465963&startDate=2026-01-22&endDate=2026-01-22`, method: 'get', requiresAuth: true }
  ];

  for (const test of tests) {
    const start = Date.now();
    try {
      const config = test.requiresAuth && testToken 
        ? { headers: { 'Authorization': `Bearer ${testToken}` } }
        : {};
      
      const response = await axios[test.method](test.url, config);
      const time = Date.now() - start;
      totalTime += time;
      
      const status = time < 100 ? '🚀 FAST' : time < 500 ? '✅ GOOD' : time < 1000 ? '⚠️  SLOW' : '❌ VERY SLOW';
      const color = time < 100 ? colors.green : time < 500 ? colors.blue : time < 1000 ? colors.yellow : colors.red;
      
      console.log(`${color}${status}${colors.reset} ${test.name}: ${time}ms (${response.data?.data?.length || response.data?.length || 'N/A'} records)`);
      
      results.push({
        name: test.name,
        time,
        status: status.replace(/[🚀✅⚠️❌]/g, '').trim(),
        records: response.data?.data?.length || response.data?.length || 0
      });
    } catch (err) {
      const time = Date.now() - start;
      console.log(`${colors.red}❌ ERROR${colors.reset} ${test.name}: ${err.response?.status || err.message} (${time}ms)`);
      results.push({
        name: test.name,
        time,
        status: 'ERROR',
        error: err.response?.status || err.message
      });
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 PERFORMANCE SUMMARY');
  console.log('='.repeat(60));
  
  const avgTime = (totalTime / results.length).toFixed(2);
  const fastRequests = results.filter(r => r.time < 100).length;
  const goodRequests = results.filter(r => r.time >= 100 && r.time < 500).length;
  const slowRequests = results.filter(r => r.time >= 500 && r.time < 1000).length;
  const verySlowRequests = results.filter(r => r.time >= 1000).length;
  const errors = results.filter(r => r.status === 'ERROR').length;

  console.log(`Total Tests: ${results.length}`);
  console.log(`Total Time: ${totalTime}ms`);
  console.log(`Average Time: ${avgTime}ms`);
  console.log(`\n${colors.green}🚀 Fast (<100ms): ${fastRequests}${colors.reset}`);
  console.log(`${colors.blue}✅ Good (100-500ms): ${goodRequests}${colors.reset}`);
  console.log(`${colors.yellow}⚠️  Slow (500-1000ms): ${slowRequests}${colors.reset}`);
  console.log(`${colors.red}❌ Very Slow (>1000ms): ${verySlowRequests}${colors.reset}`);
  if (errors > 0) {
    console.log(`${colors.red}💥 Errors: ${errors}${colors.reset}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('🎯 OPTIMIZATION RECOMMENDATIONS');
  console.log('='.repeat(60));

  const slowTests = results.filter(r => r.time >= 500 && r.status !== 'ERROR');
  if (slowTests.length > 0) {
    console.log('\n⚠️  Slow endpoints that need optimization:');
    slowTests.forEach(test => {
      console.log(`   - ${test.name}: ${test.time}ms`);
    });
    console.log('\n💡 Recommendations:');
    console.log('   1. Enable Redis caching for these endpoints');
    console.log('   2. Add database indexes on frequently queried fields');
    console.log('   3. Implement data pagination for large result sets');
    console.log('   4. Consider database query optimization');
  } else {
    console.log('\n✨ All endpoints performing well!');
  }

  if (errors > 0) {
    console.log('\n🔧 Fix authentication issues:');
    console.log('   Set TEST_TOKEN environment variable with a valid JWT token');
    console.log('   Example: $env:TEST_TOKEN="your_jwt_token_here"');
  }

  console.log('\n');
}

// Run tests
runTests().catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});
