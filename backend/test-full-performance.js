/**
 * Comprehensive Performance Testing with Real Login
 * Tests login time, dashboard loading, and all major pages
 * Measures performance improvements with Redis caching
 */

require('dotenv').config();
const axios = require('axios');
const moment = require('moment');

const BASE_URL = 'http://localhost:5000/api';
const TEST_EMAIL = 'admin@slpa.lk';
const TEST_PASSWORD = 'admin123';

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  reset: '\x1b[0m'
};

let authToken = null;

async function login() {
  console.log('🔐 Testing Login Performance...\n');
  
  try {
    const start = Date.now();
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    });
    const loginTime = Date.now() - start;
    
    authToken = response.data.token;
    
    console.log(`${colors.green}✅ Login Successful${colors.reset}`);
    console.log(`   Email: ${TEST_EMAIL}`);
    console.log(`   Time: ${loginTime}ms`);
    console.log(`   User: ${response.data.user?.name || 'Unknown'}`);
    console.log(`   Role: ${response.data.user?.role || 'Unknown'}`);
    
    if (loginTime < 200) {
      console.log(`   ${colors.green}Performance: EXCELLENT${colors.reset}`);
    } else if (loginTime < 500) {
      console.log(`   ${colors.blue}Performance: GOOD${colors.reset}`);
    } else if (loginTime < 1000) {
      console.log(`   ${colors.yellow}Performance: ACCEPTABLE${colors.reset}`);
    } else {
      console.log(`   ${colors.red}Performance: NEEDS IMPROVEMENT${colors.reset}`);
    }
    
    console.log('');
    return { success: true, time: loginTime };
  } catch (error) {
    console.log(`${colors.red}❌ Login Failed: ${error.message}${colors.reset}`);
    console.log('   Check if backend is running on port 5000');
    console.log('   Verify credentials are correct');
    return { success: false, time: 0, error: error.message };
  }
}

async function testEndpoint(name, url, expectCacheImprovement = true) {
  if (!authToken) {
    console.log(`${colors.red}❌ ${name}: No auth token${colors.reset}`);
    return { name, error: 'No auth token' };
  }

  try {
    const headers = { Authorization: `Bearer ${authToken}` };
    
    // First request (potential cache miss)
    const start1 = Date.now();
    await axios.get(url, { headers });
    const time1 = Date.now() - start1;
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Second request (should be cached)
    const start2 = Date.now();
    await axios.get(url, { headers });
    const time2 = Date.now() - start2;
    
    // Third request (verify cache consistency)
    const start3 = Date.now();
    await axios.get(url, { headers });
    const time3 = Date.now() - start3;
    
    const avgCachedTime = (time2 + time3) / 2;
    const speedup = time1 / avgCachedTime;
    const isCached = time2 < time1 * 0.7 || time3 < time1 * 0.7;
    
    console.log(`${colors.cyan}📊 ${name}${colors.reset}`);
    console.log(`   First request:  ${time1}ms`);
    console.log(`   Second request: ${time2}ms`);
    console.log(`   Third request:  ${time3}ms`);
    console.log(`   Average cached: ${avgCachedTime.toFixed(0)}ms`);
    
    if (expectCacheImprovement && isCached) {
      console.log(`   ${colors.green}✅ CACHED - ${speedup.toFixed(1)}x faster!${colors.reset}`);
    } else if (expectCacheImprovement && !isCached) {
      console.log(`   ${colors.yellow}⚠️  NOT CACHED (might need optimization)${colors.reset}`);
    } else {
      console.log(`   ${colors.blue}ℹ️  Not expected to be cached${colors.reset}`);
    }
    
    // Performance rating
    const bestTime = Math.min(time2, time3);
    if (bestTime < 50) {
      console.log(`   ${colors.green}Performance: EXCELLENT (< 50ms)${colors.reset}`);
    } else if (bestTime < 150) {
      console.log(`   ${colors.blue}Performance: GOOD (< 150ms)${colors.reset}`);
    } else if (bestTime < 500) {
      console.log(`   ${colors.yellow}Performance: ACCEPTABLE (< 500ms)${colors.reset}`);
    } else {
      console.log(`   ${colors.red}Performance: SLOW (needs optimization)${colors.reset}`);
    }
    
    console.log('');
    
    return {
      name,
      time1,
      time2,
      time3,
      avgCachedTime,
      speedup,
      isCached,
      bestTime
    };
  } catch (error) {
    console.log(`${colors.red}❌ ${name}: ${error.message}${colors.reset}\n`);
    return { name, error: error.message };
  }
}

async function runPerformanceTests() {
  console.log('='.repeat(80));
  console.log('🚀 COMPREHENSIVE PERFORMANCE TESTING');
  console.log('='.repeat(80));
  console.log('Testing all major pages with Redis caching');
  console.log('Measuring: Login time, Dashboard load, Data fetching speeds');
  console.log('='.repeat(80));
  console.log('');

  const results = [];

  // Step 1: Test Login
  const loginResult = await login();
  if (!loginResult.success) {
    console.log(`${colors.red}❌ Cannot continue without login${colors.reset}`);
    process.exit(1);
  }
  results.push({ name: 'Login', ...loginResult });

  console.log('='.repeat(80));
  console.log('📈 TESTING DATA ENDPOINTS (with Redis caching)');
  console.log('='.repeat(80));
  console.log('');

  // Step 2: Test Dashboard
  results.push(await testEndpoint(
    'Dashboard Stats',
    `${BASE_URL}/dashboard/stats`,
    true
  ));

  // Step 3: Test Divisions
  results.push(await testEndpoint(
    'Divisions List',
    `${BASE_URL}/divisions/sync?limit=100`,
    true
  ));

  // Step 4: Test Sections
  results.push(await testEndpoint(
    'Sections List',
    `${BASE_URL}/sections/hris`,
    true
  ));

  // Step 5: Test Employees
  results.push(await testEndpoint(
    'Employees List',
    `${BASE_URL}/employees?limit=100`,
    true
  ));

  // Step 6: Test Recent Activities
  results.push(await testEndpoint(
    'Recent Activities',
    `${BASE_URL}/dashboard/activities?limit=10`,
    true
  ));

  // Step 7: Test Attendance Report (if available)
  const today = moment().format('YYYY-MM-DD');
  const startDate = moment().subtract(7, 'days').format('YYYY-MM-DD');
  results.push(await testEndpoint(
    'Attendance Report',
    `${BASE_URL}/reports/attendance?startDate=${startDate}&endDate=${today}`,
    true
  ));

  // Step 8: Test HRIS Cache Status
  results.push(await testEndpoint(
    'HRIS Cache Status',
    `${BASE_URL}/hris-cache/status`,
    false
  ));

  // Print Summary
  console.log('='.repeat(80));
  console.log('📊 PERFORMANCE SUMMARY');
  console.log('='.repeat(80));
  console.log('');

  const successResults = results.filter(r => !r.error && r.time1 !== undefined);
  
  console.log('Endpoint Performance:');
  console.log('');
  
  successResults.forEach(result => {
    const status = result.isCached ? 
      `${colors.green}CACHED (${result.speedup.toFixed(1)}x)${colors.reset}` : 
      result.name === 'Login' ? 
        `${colors.blue}NOT CACHED (auth)${colors.reset}` :
        `${colors.yellow}NOT CACHED${colors.reset}`;
    
    const time = result.bestTime || result.avgCachedTime || result.time1;
    const timeStr = time < 100 ? 
      `${colors.green}${time.toFixed(0)}ms${colors.reset}` : 
      time < 500 ? 
        `${colors.blue}${time.toFixed(0)}ms${colors.reset}` :
        `${colors.yellow}${time.toFixed(0)}ms${colors.reset}`;
    
    console.log(`  ${result.name.padEnd(25)} ${timeStr.padEnd(20)} ${status}`);
  });

  console.log('');
  console.log('='.repeat(80));
  console.log('💡 OPTIMIZATION RECOMMENDATIONS');
  console.log('='.repeat(80));
  console.log('');

  const slowEndpoints = successResults.filter(r => r.bestTime > 500 || r.time1 > 1000);
  const notCachedExpected = successResults.filter(r => 
    r.name !== 'Login' && 
    r.name !== 'HRIS Cache Status' && 
    !r.isCached
  );

  if (slowEndpoints.length > 0) {
    console.log(`${colors.yellow}⚠️  Slow Endpoints (> 500ms):${colors.reset}`);
    slowEndpoints.forEach(r => {
      console.log(`   • ${r.name}: ${r.bestTime || r.time1}ms`);
      console.log(`     Recommendation: Add database indexes or optimize queries`);
    });
    console.log('');
  }

  if (notCachedExpected.length > 0) {
    console.log(`${colors.yellow}⚠️  Expected to be cached but aren't:${colors.reset}`);
    notCachedExpected.forEach(r => {
      console.log(`   • ${r.name}`);
      console.log(`     Check: Redis service running? Cache implementation correct?`);
    });
    console.log('');
  }

  const cachedEndpoints = successResults.filter(r => r.isCached);
  if (cachedEndpoints.length > 0) {
    const avgSpeedup = cachedEndpoints.reduce((sum, r) => sum + r.speedup, 0) / cachedEndpoints.length;
    console.log(`${colors.green}✅ Cache Performance:${colors.reset}`);
    console.log(`   • ${cachedEndpoints.length} endpoints using Redis cache`);
    console.log(`   • Average speedup: ${avgSpeedup.toFixed(1)}x faster`);
    console.log(`   • Best time: ${Math.min(...cachedEndpoints.map(r => r.bestTime))}ms`);
    console.log('');
  }

  // Overall system rating
  const avgBestTime = successResults.reduce((sum, r) => sum + (r.bestTime || r.time1), 0) / successResults.length;
  const cacheRate = (cachedEndpoints.length / (successResults.length - 2)) * 100; // -2 for login and status
  
  console.log('='.repeat(80));
  console.log('🎯 OVERALL SYSTEM PERFORMANCE');
  console.log('='.repeat(80));
  console.log('');
  console.log(`Average Response Time: ${avgBestTime.toFixed(0)}ms`);
  console.log(`Cache Hit Rate: ${cacheRate.toFixed(0)}%`);
  
  if (avgBestTime < 100 && cacheRate > 70) {
    console.log(`${colors.green}Rating: EXCELLENT ⭐⭐⭐⭐⭐${colors.reset}`);
    console.log('System is production-ready with excellent performance!');
  } else if (avgBestTime < 200 && cacheRate > 50) {
    console.log(`${colors.blue}Rating: GOOD ⭐⭐⭐⭐${colors.reset}`);
    console.log('System performance is good, minor optimizations possible.');
  } else if (avgBestTime < 500) {
    console.log(`${colors.yellow}Rating: ACCEPTABLE ⭐⭐⭐${colors.reset}`);
    console.log('System works but needs performance optimization.');
  } else {
    console.log(`${colors.red}Rating: NEEDS IMPROVEMENT ⭐⭐${colors.reset}`);
    console.log('System requires significant performance optimization.');
  }

  console.log('');
  console.log('='.repeat(80));
  console.log('📝 NEXT STEPS');
  console.log('='.repeat(80));
  console.log('');
  console.log('1. Monitor Redis cache: GET /api/performance/stats');
  console.log('2. Check slow queries: GET /api/performance/slow-requests');
  console.log('3. Verify Redis service: Get-Service Redis');
  console.log('4. Review logs for cache hits/misses');
  console.log('');
  console.log(`${colors.green}✅ Performance testing complete!${colors.reset}`);
  console.log('');
}

runPerformanceTests()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(`${colors.red}❌ Test execution failed:${colors.reset}`, error.message);
    process.exit(1);
  });
