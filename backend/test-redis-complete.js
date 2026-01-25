/**
 * Complete Redis Cache Verification Test
 * Tests all cached endpoints and verifies auth is NOT cached
 */

require('dotenv').config();
const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

async function testRedisCache() {
  console.log('🧪 Complete Redis Cache Verification\n');
  console.log('='.repeat(70));
  console.log('Testing all endpoints to verify Redis caching is active');
  console.log('='.repeat(70));
  console.log('');

  // You need a valid auth token - get it by logging in first
  const TEST_TOKEN = process.env.TEST_TOKEN;
  
  if (!TEST_TOKEN) {
    console.log(`${colors.yellow}⚠️  No TEST_TOKEN found in environment${colors.reset}`);
    console.log('To run full tests:');
    console.log('  1. Login to get a JWT token');
    console.log('  2. Set: $env:TEST_TOKEN="your_jwt_token_here"');
    console.log('  3. Run this script again');
    console.log('');
    console.log('Testing without auth (limited tests)...');
    console.log('');
  }

  const headers = TEST_TOKEN ? { Authorization: `Bearer ${TEST_TOKEN}` } : {};

  const results = {
    cached: [],
    notCached: [],
    errors: []
  };

  // Test 1: Dashboard Stats (SHOULD BE CACHED)
  try {
    console.log('Test 1: Dashboard Stats');
    const start1 = Date.now();
    await axios.get(`${BASE_URL}/dashboard/stats`, { headers });
    const time1 = Date.now() - start1;
    
    const start2 = Date.now();
    await axios.get(`${BASE_URL}/dashboard/stats`, { headers });
    const time2 = Date.now() - start2;
    
    const speedup = time1 / time2;
    const cached = time2 < time1 * 0.5; // Second request should be at least 2x faster
    
    console.log(`  First request:  ${time1}ms`);
    console.log(`  Second request: ${time2}ms ${cached ? `${colors.green}(${speedup.toFixed(1)}x faster - CACHED!)${colors.reset}` : `${colors.yellow}(not cached)${colors.reset}`}`);
    
    if (cached) results.cached.push('Dashboard Stats');
    else results.notCached.push('Dashboard Stats');
  } catch (error) {
    console.log(`  ${colors.red}❌ Error: ${error.message}${colors.reset}`);
    results.errors.push('Dashboard Stats');
  }
  console.log('');

  // Test 2: Divisions (SHOULD BE CACHED)
  try {
    console.log('Test 2: Divisions List');
    const start1 = Date.now();
    await axios.get(`${BASE_URL}/divisions/sync`, { headers });
    const time1 = Date.now() - start1;
    
    const start2 = Date.now();
    await axios.get(`${BASE_URL}/divisions/sync`, { headers });
    const time2 = Date.now() - start2;
    
    const speedup = time1 / time2;
    const cached = time2 < time1 * 0.5;
    
    console.log(`  First request:  ${time1}ms`);
    console.log(`  Second request: ${time2}ms ${cached ? `${colors.green}(${speedup.toFixed(1)}x faster - CACHED!)${colors.reset}` : `${colors.yellow}(not cached)${colors.reset}`}`);
    
    if (cached) results.cached.push('Divisions');
    else results.notCached.push('Divisions');
  } catch (error) {
    console.log(`  ${colors.red}❌ Error: ${error.message}${colors.reset}`);
    results.errors.push('Divisions');
  }
  console.log('');

  // Test 3: Sections (SHOULD BE CACHED)
  try {
    console.log('Test 3: Sections List');
    const start1 = Date.now();
    await axios.get(`${BASE_URL}/sections/hris`, { headers });
    const time1 = Date.now() - start1;
    
    const start2 = Date.now();
    await axios.get(`${BASE_URL}/sections/hris`, { headers });
    const time2 = Date.now() - start2;
    
    const speedup = time1 / time2;
    const cached = time2 < time1 * 0.5;
    
    console.log(`  First request:  ${time1}ms`);
    console.log(`  Second request: ${time2}ms ${cached ? `${colors.green}(${speedup.toFixed(1)}x faster - CACHED!)${colors.reset}` : `${colors.yellow}(not cached)${colors.reset}`}`);
    
    if (cached) results.cached.push('Sections');
    else results.notCached.push('Sections');
  } catch (error) {
    console.log(`  ${colors.red}❌ Error: ${error.message}${colors.reset}`);
    results.errors.push('Sections');
  }
  console.log('');

  // Test 4: Auth/Login (SHOULD NOT BE CACHED)
  console.log('Test 4: Auth/Login Endpoint');
  console.log(`  ${colors.cyan}INFO: This endpoint should NOT be cached for security${colors.reset}`);
  try {
    // Make two login attempts with wrong credentials
    const start1 = Date.now();
    try {
      await axios.post(`${BASE_URL}/auth/login`, {
        email: 'test@example.com',
        password: 'wrongpassword'
      });
    } catch (e) {
      // Expected to fail
    }
    const time1 = Date.now() - start1;
    
    const start2 = Date.now();
    try {
      await axios.post(`${BASE_URL}/auth/login`, {
        email: 'test@example.com',
        password: 'wrongpassword'
      });
    } catch (e) {
      // Expected to fail
    }
    const time2 = Date.now() - start2;
    
    const similar = Math.abs(time1 - time2) < 50; // Times should be similar (not cached)
    
    console.log(`  First request:  ${time1}ms`);
    console.log(`  Second request: ${time2}ms ${similar ? `${colors.green}(similar - NOT CACHED ✓)${colors.reset}` : `${colors.red}(cached - WRONG!)${colors.reset}`}`);
    
    if (similar) results.notCached.push('Auth/Login (correct)');
    else results.cached.push('Auth/Login (ERROR - should not be cached!)');
  } catch (error) {
    console.log(`  ${colors.yellow}⚠️  Could not test: ${error.message}${colors.reset}`);
  }
  console.log('');

  // Print Summary
  console.log('='.repeat(70));
  console.log('📊 REDIS CACHE VERIFICATION SUMMARY');
  console.log('='.repeat(70));
  console.log('');
  
  console.log(`${colors.green}✅ Cached Endpoints (${results.cached.length}):${colors.reset}`);
  results.cached.forEach(endpoint => {
    console.log(`   • ${endpoint}`);
  });
  console.log('');
  
  console.log(`${colors.cyan}ℹ️  Not Cached (${results.notCached.length}):${colors.reset}`);
  results.notCached.forEach(endpoint => {
    console.log(`   • ${endpoint}`);
  });
  console.log('');
  
  if (results.errors.length > 0) {
    console.log(`${colors.red}❌ Errors (${results.errors.length}):${colors.reset}`);
    results.errors.forEach(endpoint => {
      console.log(`   • ${endpoint}`);
    });
    console.log('');
  }

  // Final Verdict
  console.log('='.repeat(70));
  const totalTests = results.cached.length + results.notCached.length + results.errors.length;
  const successRate = ((results.cached.length + results.notCached.filter(e => e.includes('correct')).length) / totalTests * 100).toFixed(1);
  
  if (results.cached.length >= 3 && results.notCached.some(e => e.includes('Auth'))) {
    console.log(`${colors.green}🎉 REDIS CACHING IS WORKING CORRECTLY!${colors.reset}`);
    console.log(`   • Data endpoints are cached ✓`);
    console.log(`   • Auth endpoints are NOT cached ✓`);
    console.log(`   • Success rate: ${successRate}%`);
  } else if (results.errors.length > totalTests / 2) {
    console.log(`${colors.red}❌ MANY ERRORS - Check backend server${colors.reset}`);
  } else {
    console.log(`${colors.yellow}⚠️  PARTIAL SUCCESS${colors.reset}`);
    console.log(`   • Some caching is working`);
    console.log(`   • Check Redis service status`);
    console.log(`   • Ensure REDIS_ENABLED=true in .env`);
  }
  console.log('='.repeat(70));
  console.log('');

  // Additional Info
  console.log('💡 Tips:');
  console.log('   • First requests will be slower (cache miss)');
  console.log('   • Subsequent requests should be 5-50x faster (cache hit)');
  console.log('   • After sync operations, cache is cleared (fresh data)');
  console.log('   • Check cache stats: GET /api/performance/stats');
  console.log('');
}

testRedisCache()
  .then(() => {
    console.log('✅ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
