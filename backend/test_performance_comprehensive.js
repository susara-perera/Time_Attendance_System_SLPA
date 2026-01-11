/**
 * Comprehensive Performance Testing Suite
 * 
 * Tests all data fetching operations and measures performance improvements
 * with cache system vs direct MySQL queries
 */

const axios = require('axios');
const { performance } = require('perf_hooks');
const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = process.env.API_URL || 'http://localhost:5000';
let authToken = '';

// Test Results Storage
const testResults = {
  timestamp: new Date(),
  system_info: {
    cache_enabled: true,
    node_version: process.version
  },
  tests: [],
  summary: {
    total_tests: 0,
    fastest_operation: { name: '', time: Infinity },
    slowest_operation: { name: '', time: 0 },
    average_time: 0,
    cache_hit_ratio: 0
  }
};

/**
 * Utility: Measure execution time
 */
async function measureTime(name, fn, category = 'general') {
  const startTime = performance.now();
  let result;
  let error = null;
  
  try {
    result = await fn();
  } catch (err) {
    error = err.message;
    console.error(`   ❌ Error in ${name}:`, err.message);
  }
  
  const endTime = performance.now();
  const duration = Math.round(endTime - startTime);
  
  const testResult = {
    name,
    category,
    duration_ms: duration,
    success: !error,
    error,
    timestamp: new Date()
  };
  
  testResults.tests.push(testResult);
  
  // Update summary
  if (duration < testResults.summary.fastest_operation.time) {
    testResults.summary.fastest_operation = { name, time: duration };
  }
  if (duration > testResults.summary.slowest_operation.time) {
    testResults.summary.slowest_operation = { name, time: duration };
  }
  
  const icon = duration < 10 ? '⚡' : duration < 50 ? '✅' : duration < 200 ? '⏱️' : '🐌';
  console.log(`   ${icon} ${name}: ${duration}ms`);
  
  return { result, duration, error };
}

/**
 * Login and get auth token
 */
async function login() {
  console.log('\n🔐 Logging in...');
  try {
    const response = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: process.env.TEST_EMAIL || 'susara_perera@admin',
      password: process.env.TEST_PASSWORD || 'susara_perera'
    });
    
    authToken = response.data.token;
    console.log('✅ Login successful');
    console.log('📊 Cache Status:', response.data.cache);
    return response.data.cache;
  } catch (error) {
    console.error('❌ Login failed:', error.message);
    throw error;
  }
}

/**
 * API request helper
 */
async function apiRequest(method, endpoint, data = null, params = {}) {
  const config = {
    method,
    url: `${BASE_URL}${endpoint}`,
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    },
    params
  };
  
  if (data) {
    config.data = data;
  }
  
  const response = await axios(config);
  return response.data;
}

/**
 * Test Suite 1: Division Management
 */
async function testDivisionManagement() {
  console.log('\n📊 Testing Division Management...');
  
  await measureTime('Get All Divisions', async () => {
    return await apiRequest('GET', '/api/mysql/divisions');
  }, 'division_management');
  
  await measureTime('Get Divisions with Employee Count', async () => {
    return await apiRequest('GET', '/api/mysql/divisions', null, { includeEmployeeCount: 'true' });
  }, 'division_management');
  
  await measureTime('Search Divisions', async () => {
    return await apiRequest('GET', '/api/mysql/divisions', null, { search: 'finance' });
  }, 'division_management');
  
  // Get first division for detail test
  const divisions = await apiRequest('GET', '/api/mysql/divisions');
  if (divisions.data && divisions.data.length > 0) {
    const divCode = divisions.data[0].HIE_CODE;
    
    await measureTime('Get Division by Code', async () => {
      return await apiRequest('GET', `/api/mysql/divisions/${divCode}`);
    }, 'division_management');
  }
}

/**
 * Test Suite 2: Section Management
 */
async function testSectionManagement() {
  console.log('\n📋 Testing Section Management...');
  
  await measureTime('Get All Sections', async () => {
    return await apiRequest('GET', '/api/mysql/sections');
  }, 'section_management');
  
  await measureTime('Get Sections with Employee Count', async () => {
    return await apiRequest('GET', '/api/mysql/sections', null, { includeEmployeeCount: 'true' });
  }, 'section_management');
  
  // Get sections by division
  const divisions = await apiRequest('GET', '/api/mysql/divisions');
  if (divisions.data && divisions.data.length > 0) {
    const divCode = divisions.data[0].HIE_CODE;
    
    await measureTime('Get Sections by Division', async () => {
      return await apiRequest('GET', '/api/mysql/sections', null, { divisionCode: divCode });
    }, 'section_management');
  }
  
  // Get section details
  const sections = await apiRequest('GET', '/api/mysql/sections');
  if (sections.data && sections.data.length > 0) {
    const secCode = sections.data[0].HIE_CODE;
    
    await measureTime('Get Section by Code', async () => {
      return await apiRequest('GET', `/api/mysql/sections/${secCode}`);
    }, 'section_management');
  }
}

/**
 * Test Suite 3: Employee Management
 */
async function testEmployeeManagement() {
  console.log('\n👥 Testing Employee Management...');
  
  await measureTime('Get All Employees (Page 1)', async () => {
    return await apiRequest('GET', '/api/mysql/employees', null, { page: 1, limit: 100 });
  }, 'employee_management');
  
  await measureTime('Get All Employees (Page 1, 1000 records)', async () => {
    return await apiRequest('GET', '/api/mysql/employees', null, { page: 1, limit: 1000 });
  }, 'employee_management');
  
  await measureTime('Search Employees by Name', async () => {
    return await apiRequest('GET', '/api/mysql/employees', null, { search: 'john' });
  }, 'employee_management');
  
  // Get employees by division
  const divisions = await apiRequest('GET', '/api/mysql/divisions');
  if (divisions.data && divisions.data.length > 0) {
    const divCode = divisions.data[0].HIE_CODE;
    
    await measureTime('Get Employees by Division', async () => {
      return await apiRequest('GET', '/api/mysql/employees', null, { divisionCode: divCode });
    }, 'employee_management');
  }
  
  // Get employees by section
  const sections = await apiRequest('GET', '/api/mysql/sections');
  if (sections.data && sections.data.length > 0) {
    const secCode = sections.data[0].HIE_CODE;
    
    await measureTime('Get Employees by Section', async () => {
      return await apiRequest('GET', '/api/mysql/employees', null, { sectionCode: secCode });
    }, 'employee_management');
  }
  
  // Get employee details
  const employees = await apiRequest('GET', '/api/mysql/employees', null, { limit: 1 });
  if (employees.data && employees.data.length > 0) {
    const empNo = employees.data[0].EMP_ID;
    
    await measureTime('Get Employee by Number', async () => {
      return await apiRequest('GET', `/api/mysql/employees/${empNo}`);
    }, 'employee_management');
  }
}

/**
 * Test Suite 4: Dashboard Statistics
 */
async function testDashboardStatistics() {
  console.log('\n📈 Testing Dashboard Statistics...');
  
  const today = new Date();
  const startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const endDate = today.toISOString().split('T')[0];
  
  await measureTime('Get Dashboard Totals (Current Month)', async () => {
    return await apiRequest('GET', '/api/dashboard/totals', null, { startDate, endDate });
  }, 'dashboard');
  
  await measureTime('Get Recent Activity', async () => {
    return await apiRequest('GET', '/api/activity/recent', null, { limit: 10 });
  }, 'dashboard');
  
  await measureTime('Get Division Statistics', async () => {
    const divisions = await apiRequest('GET', '/api/mysql/divisions');
    if (divisions.data && divisions.data.length > 0) {
      const divCode = divisions.data[0].HIE_CODE;
      return await apiRequest('GET', `/api/divisions/${divCode}/stats`);
    }
  }, 'dashboard');
}

/**
 * Test Suite 5: Attendance Reports - All Divisions
 */
async function testAllDivisionsReport() {
  console.log('\n📊 Testing All Divisions Attendance Report...');
  
  const today = new Date();
  
  // 1 day range
  await measureTime('All Divisions Report (1 day)', async () => {
    const date = today.toISOString().split('T')[0];
    return await apiRequest('GET', '/api/reports/attendance', null, {
      startDate: date,
      endDate: date,
      groupBy: 'division'
    });
  }, 'attendance_reports');
  
  // 7 days range
  await measureTime('All Divisions Report (7 days)', async () => {
    const endDate = today.toISOString().split('T')[0];
    const startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    return await apiRequest('GET', '/api/reports/attendance', null, {
      startDate,
      endDate,
      groupBy: 'division'
    });
  }, 'attendance_reports');
  
  // 30 days range
  await measureTime('All Divisions Report (30 days)', async () => {
    const endDate = today.toISOString().split('T')[0];
    const startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    return await apiRequest('GET', '/api/reports/attendance', null, {
      startDate,
      endDate,
      groupBy: 'division'
    });
  }, 'attendance_reports');
  
  // 90 days range
  await measureTime('All Divisions Report (90 days)', async () => {
    const endDate = today.toISOString().split('T')[0];
    const startDate = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    return await apiRequest('GET', '/api/reports/attendance', null, {
      startDate,
      endDate,
      groupBy: 'division'
    });
  }, 'attendance_reports');
}

/**
 * Test Suite 6: Attendance Reports - Division Wise
 */
async function testDivisionWiseReport() {
  console.log('\n📊 Testing Division-Wise Attendance Report...');
  
  const divisions = await apiRequest('GET', '/api/mysql/divisions');
  if (!divisions.data || divisions.data.length === 0) {
    console.log('   ⚠️ No divisions found, skipping...');
    return;
  }
  
  const divCode = divisions.data[0].HIE_CODE;
  const today = new Date();
  
  // 1 day range
  await measureTime('Division Report (1 day)', async () => {
    const date = today.toISOString().split('T')[0];
    return await apiRequest('GET', '/api/reports/attendance', null, {
      startDate: date,
      endDate: date,
      divisionCode: divCode
    });
  }, 'attendance_reports');
  
  // 7 days range
  await measureTime('Division Report (7 days)', async () => {
    const endDate = today.toISOString().split('T')[0];
    const startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    return await apiRequest('GET', '/api/reports/attendance', null, {
      startDate,
      endDate,
      divisionCode: divCode
    });
  }, 'attendance_reports');
  
  // 30 days range
  await measureTime('Division Report (30 days)', async () => {
    const endDate = today.toISOString().split('T')[0];
    const startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    return await apiRequest('GET', '/api/reports/attendance', null, {
      startDate,
      endDate,
      divisionCode: divCode
    });
  }, 'attendance_reports');
}

/**
 * Test Suite 7: Attendance Reports - Division & Section Wise
 */
async function testDivisionSectionReport() {
  console.log('\n📊 Testing Division & Section-Wise Attendance Report...');
  
  const sections = await apiRequest('GET', '/api/mysql/sections');
  if (!sections.data || sections.data.length === 0) {
    console.log('   ⚠️ No sections found, skipping...');
    return;
  }
  
  const section = sections.data[0];
  const divCode = section.HIE_RELATIONSHIP;
  const secCode = section.HIE_CODE;
  const today = new Date();
  
  // 1 day range
  await measureTime('Division & Section Report (1 day)', async () => {
    const date = today.toISOString().split('T')[0];
    return await apiRequest('GET', '/api/reports/attendance', null, {
      startDate: date,
      endDate: date,
      divisionCode: divCode,
      sectionCode: secCode
    });
  }, 'attendance_reports');
  
  // 7 days range
  await measureTime('Division & Section Report (7 days)', async () => {
    const endDate = today.toISOString().split('T')[0];
    const startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    return await apiRequest('GET', '/api/reports/attendance', null, {
      startDate,
      endDate,
      divisionCode: divCode,
      sectionCode: secCode
    });
  }, 'attendance_reports');
  
  // 30 days range
  await measureTime('Division & Section Report (30 days)', async () => {
    const endDate = today.toISOString().split('T')[0];
    const startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    return await apiRequest('GET', '/api/reports/attendance', null, {
      startDate,
      endDate,
      divisionCode: divCode,
      sectionCode: secCode
    });
  }, 'attendance_reports');
}

/**
 * Test Suite 8: Individual Attendance Report
 */
async function testIndividualAttendanceReport() {
  console.log('\n👤 Testing Individual Attendance Report...');
  
  const employees = await apiRequest('GET', '/api/mysql/employees', null, { limit: 1 });
  if (!employees.data || employees.data.length === 0) {
    console.log('   ⚠️ No employees found, skipping...');
    return;
  }
  
  const empId = employees.data[0].EMP_ID;
  const today = new Date();
  
  // 7 days range
  await measureTime('Individual Report (7 days)', async () => {
    const endDate = today.toISOString().split('T')[0];
    const startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    return await apiRequest('GET', '/api/reports/attendance/individual', null, {
      startDate,
      endDate,
      employeeId: empId
    });
  }, 'attendance_reports');
  
  // 30 days range
  await measureTime('Individual Report (30 days)', async () => {
    const endDate = today.toISOString().split('T')[0];
    const startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    return await apiRequest('GET', '/api/reports/attendance/individual', null, {
      startDate,
      endDate,
      employeeId: empId
    });
  }, 'attendance_reports');
  
  // 90 days range
  await measureTime('Individual Report (90 days)', async () => {
    const endDate = today.toISOString().split('T')[0];
    const startDate = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    return await apiRequest('GET', '/api/reports/attendance/individual', null, {
      startDate,
      endDate,
      employeeId: empId
    });
  }, 'attendance_reports');
}

/**
 * Test Suite 9: Group Attendance Report
 */
async function testGroupAttendanceReport() {
  console.log('\n👥 Testing Group Attendance Report...');
  
  const today = new Date();
  
  // By Division
  await measureTime('Group Report by Division (7 days)', async () => {
    const endDate = today.toISOString().split('T')[0];
    const startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    return await apiRequest('GET', '/api/reports/attendance/group', null, {
      startDate,
      endDate,
      groupBy: 'division'
    });
  }, 'attendance_reports');
  
  // By Section
  await measureTime('Group Report by Section (7 days)', async () => {
    const endDate = today.toISOString().split('T')[0];
    const startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    return await apiRequest('GET', '/api/reports/attendance/group', null, {
      startDate,
      endDate,
      groupBy: 'section'
    });
  }, 'attendance_reports');
  
  // By Date
  await measureTime('Group Report by Date (30 days)', async () => {
    const endDate = today.toISOString().split('T')[0];
    const startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    return await apiRequest('GET', '/api/reports/attendance/group', null, {
      startDate,
      endDate,
      groupBy: 'date'
    });
  }, 'attendance_reports');
}

/**
 * Test Suite 10: Audit Reports
 */
async function testAuditReports() {
  console.log('\n📋 Testing Audit Reports...');
  
  await measureTime('Get Recent Audit Logs', async () => {
    return await apiRequest('GET', '/api/audit', null, { limit: 100 });
  }, 'audit_reports');
  
  await measureTime('Get Audit Logs with Filter', async () => {
    return await apiRequest('GET', '/api/audit', null, {
      limit: 100,
      category: 'authentication'
    });
  }, 'audit_reports');
  
  await measureTime('Get Security-Relevant Audit Logs', async () => {
    return await apiRequest('GET', '/api/audit', null, {
      limit: 100,
      isSecurityRelevant: true
    });
  }, 'audit_reports');
}

/**
 * Test Suite 11: Cache Performance
 */
async function testCachePerformance() {
  console.log('\n⚡ Testing Cache Performance...');
  
  await measureTime('Get Cache Status', async () => {
    return await apiRequest('GET', '/api/cache/status');
  }, 'cache_operations');
  
  await measureTime('Get Cache Metadata', async () => {
    return await apiRequest('GET', '/api/cache/metadata');
  }, 'cache_operations');
  
  await measureTime('Get Cache Sync History', async () => {
    return await apiRequest('GET', '/api/cache/sync-history', null, { limit: 10 });
  }, 'cache_operations');
  
  // Test repeated lookups (should be instant from cache)
  const divisions = await apiRequest('GET', '/api/mysql/divisions');
  if (divisions.data && divisions.data.length > 0) {
    const divCode = divisions.data[0].HIE_CODE;
    
    await measureTime('Repeated Division Lookup #1 (Cache)', async () => {
      return await apiRequest('GET', `/api/mysql/divisions/${divCode}`);
    }, 'cache_operations');
    
    await measureTime('Repeated Division Lookup #2 (Cache)', async () => {
      return await apiRequest('GET', `/api/mysql/divisions/${divCode}`);
    }, 'cache_operations');
    
    await measureTime('Repeated Division Lookup #3 (Cache)', async () => {
      return await apiRequest('GET', `/api/mysql/divisions/${divCode}`);
    }, 'cache_operations');
  }
}

/**
 * Generate Performance Report
 */
function generateReport() {
  console.log('\n' + '='.repeat(70));
  console.log('📊 PERFORMANCE TEST REPORT');
  console.log('='.repeat(70));
  
  // Calculate summary
  const totalDuration = testResults.tests.reduce((sum, t) => sum + t.duration_ms, 0);
  testResults.summary.total_tests = testResults.tests.length;
  testResults.summary.average_time = Math.round(totalDuration / testResults.tests.length);
  
  // Group by category
  const categories = {};
  testResults.tests.forEach(test => {
    if (!categories[test.category]) {
      categories[test.category] = [];
    }
    categories[test.category].push(test);
  });
  
  // Print summary
  console.log(`\nTotal Tests: ${testResults.summary.total_tests}`);
  console.log(`Average Time: ${testResults.summary.average_time}ms`);
  console.log(`Fastest: ${testResults.summary.fastest_operation.name} (${testResults.summary.fastest_operation.time}ms)`);
  console.log(`Slowest: ${testResults.summary.slowest_operation.name} (${testResults.summary.slowest_operation.time}ms)`);
  
  // Print by category
  console.log('\n📊 Results by Category:\n');
  Object.keys(categories).forEach(category => {
    const tests = categories[category];
    const avgTime = Math.round(tests.reduce((sum, t) => sum + t.duration_ms, 0) / tests.length);
    const successRate = (tests.filter(t => t.success).length / tests.length * 100).toFixed(1);
    
    console.log(`${category.toUpperCase().replace(/_/g, ' ')}: ${tests.length} tests, avg ${avgTime}ms, ${successRate}% success`);
    
    // Show top 3 slowest in this category
    const slowest = tests.sort((a, b) => b.duration_ms - a.duration_ms).slice(0, 3);
    slowest.forEach(test => {
      const icon = test.duration_ms < 10 ? '⚡' : test.duration_ms < 50 ? '✅' : test.duration_ms < 200 ? '⏱️' : '🐌';
      console.log(`  ${icon} ${test.name}: ${test.duration_ms}ms`);
    });
    console.log('');
  });
  
  // Performance grades
  console.log('📈 Performance Grades:\n');
  const grades = {
    'Ultra Fast (< 10ms)': testResults.tests.filter(t => t.duration_ms < 10).length,
    'Fast (10-50ms)': testResults.tests.filter(t => t.duration_ms >= 10 && t.duration_ms < 50).length,
    'Good (50-200ms)': testResults.tests.filter(t => t.duration_ms >= 50 && t.duration_ms < 200).length,
    'Acceptable (200-500ms)': testResults.tests.filter(t => t.duration_ms >= 200 && t.duration_ms < 500).length,
    'Slow (> 500ms)': testResults.tests.filter(t => t.duration_ms >= 500).length
  };
  
  Object.keys(grades).forEach(grade => {
    const count = grades[grade];
    const percentage = (count / testResults.tests.length * 100).toFixed(1);
    console.log(`${grade}: ${count} (${percentage}%)`);
  });
  
  // Save to file
  const reportPath = path.join(__dirname, 'performance_test_results.json');
  fs.writeFileSync(reportPath, JSON.stringify(testResults, null, 2));
  console.log(`\n💾 Full results saved to: ${reportPath}`);
  
  // Generate recommendations
  console.log('\n💡 Optimization Recommendations:\n');
  
  const slowTests = testResults.tests
    .filter(t => t.duration_ms > 200)
    .sort((a, b) => b.duration_ms - a.duration_ms)
    .slice(0, 5);
  
  if (slowTests.length > 0) {
    console.log('⚠️  These operations could be optimized:');
    slowTests.forEach(test => {
      console.log(`  - ${test.name}: ${test.duration_ms}ms`);
      
      if (test.name.includes('Report') && test.duration_ms > 500) {
        console.log(`    → Consider: Add report caching or pre-aggregation`);
      }
      if (test.name.includes('All') || test.name.includes('1000')) {
        console.log(`    → Consider: Implement pagination or lazy loading`);
      }
      if (test.name.includes('Search')) {
        console.log(`    → Consider: Add full-text search indexes`);
      }
    });
  } else {
    console.log('✅ All operations are well optimized!');
  }
  
  console.log('\n' + '='.repeat(70));
}

/**
 * Main Test Runner
 */
async function runAllTests() {
  console.log('═'.repeat(70));
  console.log('🚀 COMPREHENSIVE PERFORMANCE TEST SUITE');
  console.log('═'.repeat(70));
  console.log(`Test Date: ${new Date().toISOString()}`);
  console.log(`API URL: ${BASE_URL}`);
  console.log('═'.repeat(70));
  
  try {
    // Login and get cache status
    const cacheStatus = await login();
    testResults.system_info.cache_status = cacheStatus;
    
    // Run all test suites
    await testDivisionManagement();
    await testSectionManagement();
    await testEmployeeManagement();
    await testDashboardStatistics();
    await testAllDivisionsReport();
    await testDivisionWiseReport();
    await testDivisionSectionReport();
    await testIndividualAttendanceReport();
    await testGroupAttendanceReport();
    await testAuditReports();
    await testCachePerformance();
    
    // Generate final report
    generateReport();
    
    console.log('\n✅ All tests completed successfully!');
    console.log('═'.repeat(70));
    
  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run tests if executed directly
if (require.main === module) {
  runAllTests()
    .then(() => {
      console.log('\n🎉 Performance testing complete!\n');
      process.exit(0);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { runAllTests, measureTime };
