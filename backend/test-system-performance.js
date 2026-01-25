/**
 * Complete System Performance Test
 * Measures actual login and data fetching times
 * Tests Redis cache effectiveness
 */

require('dotenv').config();
const axios = require('axios');
const moment = require('moment');

const BASE_URL = 'http://localhost:5000/api';
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

// Test credentials
const TEST_USER = {
  email: process.env.TEST_EMAIL || 'susaraperera33@gmail.com',
  password: process.env.TEST_PASSWORD || 'susara_perera'
};

const results = {
  login: [],
  dashboard: [],
  employees: [],
  divisions: [],
  sections: [],
  reports: []
};

async function measureTime(name, fn) {
  const start = Date.now();
  try {
    await fn();
    const time = Date.now() - start;
    return { success: true, time, error: null };
  } catch (error) {
    const time = Date.now() - start;
    return { success: false, time, error: error.message };
  }
}

function getSpeedRating(time) {
  if (time < 50) return { rating: 'EXCELLENT', color: colors.green, icon: '🚀' };
  if (time < 100) return { rating: 'VERY GOOD', color: colors.green, icon: '✅' };
  if (time < 200) return { rating: 'GOOD', color: colors.blue, icon: '👍' };
  if (time < 500) return { rating: 'ACCEPTABLE', color: colors.yellow, icon: '⚠️' };
  if (time < 1000) return { rating: 'SLOW', color: colors.yellow, icon: '🐌' };
  return { rating: 'VERY SLOW', color: colors.red, icon: '❌' };
}

function printResult(name, time, cached = false) {
  const { rating, color, icon } = getSpeedRating(time);
  const cacheStatus = cached ? `${colors.cyan}[CACHED]${colors.reset}` : '';
  console.log(`  ${icon} ${name.padEnd(35)} ${color}${time}ms${colors.reset} ${rating} ${cacheStatus}`);
}

async function testLogin() {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`${colors.magenta}🔐 TEST 1: LOGIN PERFORMANCE${colors.reset}`);
  console.log(`${'='.repeat(70)}\n`);
  
  console.log('Testing login endpoint (should NOT be cached)...\n');
  
  // Test 1: First login
  const result1 = await measureTime('Login Attempt 1', async () => {
    const response = await axios.post(`${BASE_URL}/auth/login`, TEST_USER);
    authToken = response.data.token;
  });
  
  if (!result1.success) {
    console.log(`${colors.red}❌ Login failed: ${result1.error}${colors.reset}`);
    console.log('Please check credentials in .env or use default admin account');
    process.exit(1);
  }
  
  printResult('First Login', result1.time);
  results.login.push(result1.time);
  
  // Test 2: Second login (should be similar - not cached)
  const result2 = await measureTime('Login Attempt 2', async () => {
    await axios.post(`${BASE_URL}/auth/login`, TEST_USER);
  });
  
  printResult('Second Login', result2.time);
  results.login.push(result2.time);
  
  // Test 3: Third login
  const result3 = await measureTime('Login Attempt 3', async () => {
    await axios.post(`${BASE_URL}/auth/login`, TEST_USER);
  });
  
  printResult('Third Login', result3.time);
  results.login.push(result3.time);
  
  const avgLogin = (result1.time + result2.time + result3.time) / 3;
  const variance = Math.abs(result1.time - result2.time);
  
  console.log(`\n${colors.cyan}📊 Login Analysis:${colors.reset}`);
  console.log(`  Average time: ${avgLogin.toFixed(0)}ms`);
  console.log(`  Variance: ${variance}ms`);
  
  if (variance < 100) {
    console.log(`  ${colors.green}✅ Consistent timing - Login is NOT cached (correct!)${colors.reset}`);
  } else {
    console.log(`  ${colors.yellow}⚠️  High variance - Check database connection${colors.reset}`);
  }
}

async function testDashboard() {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`${colors.magenta}📊 TEST 2: DASHBOARD PERFORMANCE${colors.reset}`);
  console.log(`${'='.repeat(70)}\n`);
  
  const headers = { Authorization: `Bearer ${authToken}` };
  
  console.log('Testing dashboard stats (should use Redis cache)...\n');
  
  // First request - cache miss
  const result1 = await measureTime('Dashboard Load 1 (Cache Miss)', async () => {
    await axios.get(`${BASE_URL}/dashboard/stats`, { headers });
  });
  
  if (!result1.success) {
    console.log(`${colors.red}❌ Dashboard failed: ${result1.error}${colors.reset}`);
    return;
  }
  
  printResult('First Load (No Cache)', result1.time);
  results.dashboard.push(result1.time);
  
  // Wait a moment
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Second request - should be cached
  const result2 = await measureTime('Dashboard Load 2 (Cache Hit)', async () => {
    await axios.get(`${BASE_URL}/dashboard/stats`, { headers });
  });
  
  printResult('Second Load (Cached)', result2.time, true);
  results.dashboard.push(result2.time);
  
  // Third request - should also be cached
  const result3 = await measureTime('Dashboard Load 3 (Cache Hit)', async () => {
    await axios.get(`${BASE_URL}/dashboard/stats`, { headers });
  });
  
  printResult('Third Load (Cached)', result3.time, true);
  results.dashboard.push(result3.time);
  
  const avgCached = (result2.time + result3.time) / 2;
  const speedup = result1.time / avgCached;
  
  console.log(`\n${colors.cyan}📊 Dashboard Analysis:${colors.reset}`);
  console.log(`  First load (no cache): ${result1.time}ms`);
  console.log(`  Cached average: ${avgCached.toFixed(0)}ms`);
  console.log(`  ${colors.green}Speedup: ${speedup.toFixed(1)}x faster!${colors.reset}`);
  
  if (speedup > 2) {
    console.log(`  ${colors.green}✅ Redis caching is working excellently!${colors.reset}`);
  } else if (speedup > 1.5) {
    console.log(`  ${colors.blue}✓ Redis caching is working${colors.reset}`);
  } else {
    console.log(`  ${colors.yellow}⚠️  Cache speedup is low - Check Redis configuration${colors.reset}`);
  }
}

async function testEmployees() {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`${colors.magenta}👥 TEST 3: EMPLOYEES DATA PERFORMANCE${colors.reset}`);
  console.log(`${'='.repeat(70)}\n`);
  
  const headers = { Authorization: `Bearer ${authToken}` };
  
  console.log('Testing employees list (should use Redis cache)...\n');
  
  const result1 = await measureTime('Employees Load 1', async () => {
    await axios.get(`${BASE_URL}/hris-cache/employees`, { headers });
  });
  
  if (!result1.success) {
    console.log(`${colors.yellow}⚠️  Employees endpoint: ${result1.error}${colors.reset}`);
    return;
  }
  
  printResult('First Load', result1.time);
  results.employees.push(result1.time);
  
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const result2 = await measureTime('Employees Load 2', async () => {
    await axios.get(`${BASE_URL}/hris-cache/employees`, { headers });
  });
  
  printResult('Second Load (Cached)', result2.time, true);
  results.employees.push(result2.time);
  
  const speedup = result1.time / result2.time;
  console.log(`\n${colors.cyan}📊 Employees Analysis:${colors.reset}`);
  console.log(`  Speedup: ${colors.green}${speedup.toFixed(1)}x faster${colors.reset}`);
}

async function testDivisions() {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`${colors.magenta}📁 TEST 4: DIVISIONS DATA PERFORMANCE${colors.reset}`);
  console.log(`${'='.repeat(70)}\n`);
  
  const headers = { Authorization: `Bearer ${authToken}` };
  
  console.log('Testing divisions list (should use Redis cache)...\n');
  
  const result1 = await measureTime('Divisions Load 1', async () => {
    await axios.get(`${BASE_URL}/divisions/sync`, { headers });
  });
  
  if (!result1.success) {
    console.log(`${colors.yellow}⚠️  Divisions endpoint: ${result1.error}${colors.reset}`);
    return;
  }
  
  printResult('First Load', result1.time);
  results.divisions.push(result1.time);
  
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const result2 = await measureTime('Divisions Load 2', async () => {
    await axios.get(`${BASE_URL}/divisions/sync`, { headers });
  });
  
  printResult('Second Load (Cached)', result2.time, true);
  results.divisions.push(result2.time);
  
  const speedup = result1.time / result2.time;
  console.log(`\n${colors.cyan}📊 Divisions Analysis:${colors.reset}`);
  console.log(`  Speedup: ${colors.green}${speedup.toFixed(1)}x faster${colors.reset}`);
}

async function testSections() {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`${colors.magenta}📂 TEST 5: SECTIONS DATA PERFORMANCE${colors.reset}`);
  console.log(`${'='.repeat(70)}\n`);
  
  const headers = { Authorization: `Bearer ${authToken}` };
  
  console.log('Testing sections list (should use Redis cache)...\n');
  
  const result1 = await measureTime('Sections Load 1', async () => {
    await axios.get(`${BASE_URL}/sections/hris`, { headers });
  });
  
  if (!result1.success) {
    console.log(`${colors.yellow}⚠️  Sections endpoint: ${result1.error}${colors.reset}`);
    return;
  }
  
  printResult('First Load', result1.time);
  results.sections.push(result1.time);
  
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const result2 = await measureTime('Sections Load 2', async () => {
    await axios.get(`${BASE_URL}/sections/hris`, { headers });
  });
  
  printResult('Second Load (Cached)', result2.time, true);
  results.sections.push(result2.time);
  
  const speedup = result1.time / result2.time;
  console.log(`\n${colors.cyan}📊 Sections Analysis:${colors.reset}`);
  console.log(`  Speedup: ${colors.green}${speedup.toFixed(1)}x faster${colors.reset}`);
}

async function printFinalSummary() {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`${colors.magenta}🏆 FINAL PERFORMANCE SUMMARY${colors.reset}`);
  console.log(`${'='.repeat(70)}\n`);
  
  const summary = [];
  
  if (results.login.length > 0) {
    const avgLogin = results.login.reduce((a, b) => a + b, 0) / results.login.length;
    summary.push({ 
      name: 'Login', 
      avg: avgLogin, 
      cached: false,
      speedup: 1
    });
  }
  
  if (results.dashboard.length > 0) {
    const first = results.dashboard[0];
    const cachedAvg = results.dashboard.slice(1).reduce((a, b) => a + b, 0) / (results.dashboard.length - 1);
    summary.push({ 
      name: 'Dashboard', 
      avg: cachedAvg, 
      cached: true,
      speedup: first / cachedAvg,
      uncached: first
    });
  }
  
  if (results.employees.length > 1) {
    const first = results.employees[0];
    const second = results.employees[1];
    summary.push({ 
      name: 'Employees', 
      avg: second, 
      cached: true,
      speedup: first / second,
      uncached: first
    });
  }
  
  if (results.divisions.length > 1) {
    const first = results.divisions[0];
    const second = results.divisions[1];
    summary.push({ 
      name: 'Divisions', 
      avg: second, 
      cached: true,
      speedup: first / second,
      uncached: first
    });
  }
  
  if (results.sections.length > 1) {
    const first = results.sections[0];
    const second = results.sections[1];
    summary.push({ 
      name: 'Sections', 
      avg: second, 
      cached: true,
      speedup: first / second,
      uncached: first
    });
  }
  
  console.log('Performance Results:\n');
  console.log('Endpoint          | No Cache | With Cache | Speedup  | Status');
  console.log('-'.repeat(70));
  
  summary.forEach(item => {
    const { rating, color, icon } = getSpeedRating(item.avg);
    const uncachedStr = item.uncached ? `${item.uncached.toFixed(0)}ms`.padEnd(8) : 'N/A     ';
    const cachedStr = `${item.avg.toFixed(0)}ms`.padEnd(10);
    const speedupStr = item.speedup > 1 ? `${item.speedup.toFixed(1)}x`.padEnd(8) : 'N/A     ';
    const statusStr = `${color}${rating}${colors.reset}`;
    
    console.log(`${item.name.padEnd(17)} | ${uncachedStr} | ${cachedStr} | ${speedupStr} | ${icon} ${statusStr}`);
  });
  
  console.log('');
  console.log(`${'='.repeat(70)}`);
  console.log(`${colors.cyan}💡 RECOMMENDATIONS${colors.reset}`);
  console.log(`${'='.repeat(70)}\n`);
  
  const cachedEndpoints = summary.filter(s => s.cached && s.speedup > 2);
  const slowEndpoints = summary.filter(s => s.avg > 200);
  const excellentEndpoints = summary.filter(s => s.avg < 50);
  
  if (cachedEndpoints.length > 0) {
    console.log(`${colors.green}✅ Redis Caching Working:${colors.reset}`);
    cachedEndpoints.forEach(e => {
      console.log(`   • ${e.name}: ${e.speedup.toFixed(1)}x faster with cache`);
    });
    console.log('');
  }
  
  if (excellentEndpoints.length > 0) {
    console.log(`${colors.green}🚀 Excellent Performance:${colors.reset}`);
    excellentEndpoints.forEach(e => {
      console.log(`   • ${e.name}: ${e.avg.toFixed(0)}ms (excellent!)`);
    });
    console.log('');
  }
  
  if (slowEndpoints.length > 0) {
    console.log(`${colors.yellow}⚠️  Needs Optimization:${colors.reset}`);
    slowEndpoints.forEach(e => {
      console.log(`   • ${e.name}: ${e.avg.toFixed(0)}ms - Consider:`);
      if (!e.cached) {
        console.log(`     - Add Redis caching`);
      } else {
        console.log(`     - Add database indexes`);
        console.log(`     - Optimize queries`);
      }
    });
    console.log('');
  }
  
  // Overall system rating
  const avgSpeed = summary.reduce((sum, s) => sum + s.avg, 0) / summary.length;
  const { rating, color, icon } = getSpeedRating(avgSpeed);
  
  console.log(`${colors.cyan}Overall System Performance:${colors.reset} ${icon} ${color}${rating}${colors.reset} (${avgSpeed.toFixed(0)}ms average)`);
  
  if (avgSpeed < 100) {
    console.log(`\n${colors.green}🎉 EXCELLENT! Your system is blazing fast!${colors.reset}`);
  } else if (avgSpeed < 200) {
    console.log(`\n${colors.blue}👍 GOOD! System performance is solid.${colors.reset}`);
  } else {
    console.log(`\n${colors.yellow}💡 ROOM FOR IMPROVEMENT: Consider the recommendations above.${colors.reset}`);
  }
  
  console.log('');
}

async function runAllTests() {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`${colors.magenta}🧪 COMPLETE SYSTEM PERFORMANCE TEST${colors.reset}`);
  console.log(`${'='.repeat(70)}`);
  console.log(`\nTesting: ${BASE_URL}`);
  console.log(`Time: ${moment().format('YYYY-MM-DD HH:mm:ss')}\n`);
  
  try {
    await testLogin();
    await testDashboard();
    await testEmployees();
    await testDivisions();
    await testSections();
    await printFinalSummary();
    
    console.log(`${colors.green}✅ All tests completed successfully!${colors.reset}\n`);
  } catch (error) {
    console.error(`\n${colors.red}❌ Test suite failed:${colors.reset}`, error.message);
    process.exit(1);
  }
}

runAllTests()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
