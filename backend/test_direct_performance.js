/**
 * Direct Performance Testing (No Server Required)
 * 
 * Tests database and cache operations directly without needing HTTP server
 */

const { performance } = require('perf_hooks');
const fs = require('fs');
const path = require('path');

// Load environment
require('dotenv').config();

// Services
const cacheDataService = require('./services/cacheDataService');
const cachePreloadService = require('./services/cachePreloadService');
const mysqlDataService = require('./services/mysqlDataService');
const { getMySQLPool } = require('./config/mysqlPool');

// Test results storage
const testResults = {
  timestamp: new Date(),
  tests: [],
  summary: {
    total_tests: 0,
    fastest: { name: '', time: Infinity },
    slowest: { name: '', time: 0 },
    average: 0
  }
};

/**
 * Measure execution time
 */
async function measureTime(name, fn, category = 'general') {
  const startTime = performance.now();
  let result;
  let error = null;
  
  try {
    result = await fn();
  } catch (err) {
    error = err.message;
    console.error(`   ❌ Error: ${err.message}`);
  }
  
  const endTime = performance.now();
  const duration = Math.round(endTime - startTime);
  
  testResults.tests.push({
    name,
    category,
    duration_ms: duration,
    success: !error,
    error
  });
  
  // Update summary
  if (duration < testResults.summary.fastest.time) {
    testResults.summary.fastest = { name, time: duration };
  }
  if (duration > testResults.summary.slowest.time) {
    testResults.summary.slowest = { name, time: duration };
  }
  
  const icon = duration < 10 ? '⚡' : duration < 50 ? '✅' : duration < 200 ? '⏱️' : '🐌';
  console.log(`   ${icon} ${name}: ${duration}ms`);
  
  return { result, duration, error };
}

/**
 * Test Suite 1: Cache System Performance
 */
async function testCacheOperations() {
  console.log('\n⚡ Testing Cache Operations...');
  
  // Test cache warming
  await measureTime('Cache Preload - Full System', async () => {
    return await cachePreloadService.preloadAll();
  }, 'cache');
  
  // Test cache status
  await measureTime('Get Cache Status', async () => {
    return await cachePreloadService.isCacheWarm();
  }, 'cache');
  
  // Test individual entity caching
  await measureTime('Cache Preload - Divisions Only', async () => {
    return await cachePreloadService.preloadDivisions();
  }, 'cache');
  
  await measureTime('Cache Preload - Sections Only', async () => {
    return await cachePreloadService.preloadSections();
  }, 'cache');
  
  await measureTime('Cache Preload - Employees Only', async () => {
    return await cachePreloadService.preloadEmployees();
  }, 'cache');
}

/**
 * Test Suite 2: Division Operations
 */
async function testDivisionOperations() {
  console.log('\n📊 Testing Division Operations...');
  
  // Test getting all divisions
  await measureTime('Get All Divisions (Cache)', async () => {
    return await cacheDataService.getDivisions();
  }, 'divisions');
  
  await measureTime('Get All Divisions (MySQL Direct)', async () => {
    return await mysqlDataService.getDivisions();
  }, 'divisions');
  
  // Get first division for detailed tests
  const divisions = await cacheDataService.getDivisions();
  if (divisions && divisions.length > 0) {
    const divCode = divisions[0].HIE_CODE;
    
    await measureTime('Get Division by Code (Cache)', async () => {
      return await cacheDataService.getDivisionByCode(divCode);
    }, 'divisions');
    
    await measureTime('Get Division by Code (MySQL Direct)', async () => {
      return await mysqlDataService.getDivisionByCode(divCode);
    }, 'divisions');
    
    // Test 100 consecutive lookups
    await measureTime('100 Division Lookups (Cache)', async () => {
      for (let i = 0; i < 100; i++) {
        await cacheDataService.getDivisionByCode(divCode);
      }
    }, 'divisions');
    
    await measureTime('100 Division Lookups (MySQL Direct)', async () => {
      for (let i = 0; i < 100; i++) {
        await mysqlDataService.getDivisionByCode(divCode);
      }
    }, 'divisions');
  }
}

/**
 * Test Suite 3: Section Operations
 */
async function testSectionOperations() {
  console.log('\n📋 Testing Section Operations...');
  
  await measureTime('Get All Sections (Cache)', async () => {
    return await cacheDataService.getSections();
  }, 'sections');
  
  await measureTime('Get All Sections (MySQL Direct)', async () => {
    return await mysqlDataService.getSections();
  }, 'sections');
  
  // Get sections by division
  const divisions = await cacheDataService.getDivisions();
  if (divisions && divisions.length > 0) {
    const divCode = divisions[0].HIE_CODE;
    
    await measureTime('Get Sections by Division (Cache)', async () => {
      return await cacheDataService.getSections({ divisionCode: divCode });
    }, 'sections');
    
    await measureTime('Get Sections by Division (MySQL Direct)', async () => {
      return await mysqlDataService.getSections({ divisionCode: divCode });
    }, 'sections');
  }
  
  // Test specific section lookup
  const sections = await cacheDataService.getSections();
  if (sections && sections.length > 0) {
    const secCode = sections[0].HIE_CODE;
    
    await measureTime('Get Section by Code (Cache)', async () => {
      return await cacheDataService.getSectionByCode(secCode);
    }, 'sections');
    
    await measureTime('Get Section by Code (MySQL Direct)', async () => {
      return await mysqlDataService.getSectionByCode(secCode);
    }, 'sections');
  }
}

/**
 * Test Suite 4: Employee Operations
 */
async function testEmployeeOperations() {
  console.log('\n👥 Testing Employee Operations...');
  
  await measureTime('Get 100 Employees (Cache)', async () => {
    return await cacheDataService.getEmployees({ limit: 100 });
  }, 'employees');
  
  await measureTime('Get 100 Employees (MySQL Direct)', async () => {
    return await mysqlDataService.getEmployees({ limit: 100 });
  }, 'employees');
  
  await measureTime('Get 1000 Employees (Cache)', async () => {
    return await cacheDataService.getEmployees({ limit: 1000 });
  }, 'employees');
  
  await measureTime('Get 1000 Employees (MySQL Direct)', async () => {
    return await mysqlDataService.getEmployees({ limit: 1000 });
  }, 'employees');
  
  // Test by division
  const divisions = await cacheDataService.getDivisions();
  if (divisions && divisions.length > 0) {
    const divCode = divisions[0].HIE_CODE;
    
    await measureTime('Get Employees by Division (Cache)', async () => {
      return await cacheDataService.getEmployees({ divisionCode: divCode });
    }, 'employees');
    
    await measureTime('Get Employees by Division (MySQL Direct)', async () => {
      return await mysqlDataService.getEmployees({ divisionCode: divCode });
    }, 'employees');
  }
  
  // Test specific employee lookup
  const employees = await cacheDataService.getEmployees({ limit: 1 });
  if (employees && employees.length > 0) {
    const empId = employees[0].EMP_ID;
    
    await measureTime('Get Employee by ID (Cache)', async () => {
      return await cacheDataService.getEmployeeById(empId);
    }, 'employees');
    
    await measureTime('Get Employee by ID (MySQL Direct)', async () => {
      return await mysqlDataService.getEmployeeById(empId);
    }, 'employees');
  }
}

/**
 * Test Suite 5: Search Operations
 */
async function testSearchOperations() {
  console.log('\n🔍 Testing Search Operations...');
  
  await measureTime('Search Divisions (Cache)', async () => {
    return await cacheDataService.searchByIndex('division', 'name', 'finance');
  }, 'search');
  
  await measureTime('Search Sections (Cache)', async () => {
    return await cacheDataService.searchByIndex('section', 'name', 'admin');
  }, 'search');
  
  await measureTime('Search Employees (Cache)', async () => {
    return await cacheDataService.searchByIndex('employee', 'name', 'john');
  }, 'search');
}

/**
 * Test Suite 6: Relationship Traversal
 */
async function testRelationshipOperations() {
  console.log('\n🔗 Testing Relationship Operations...');
  
  const divisions = await cacheDataService.getDivisions();
  if (divisions && divisions.length > 0) {
    const divCode = divisions[0].HIE_CODE;
    
    await measureTime('Get Division Children (Cache)', async () => {
      return await cacheDataService.getChildren('division', divCode);
    }, 'relationships');
  }
  
  const sections = await cacheDataService.getSections();
  if (sections && sections.length > 0) {
    const secCode = sections[0].HIE_CODE;
    
    await measureTime('Get Section Children (Cache)', async () => {
      return await cacheDataService.getChildren('section', secCode);
    }, 'relationships');
  }
}

/**
 * Test Suite 7: Raw MySQL Queries
 */
async function testRawMySQLQueries() {
  console.log('\n🗄️  Testing Raw MySQL Queries...');
  
  const pool = getMySQLPool();
  
  await measureTime('Raw Query - Count Divisions', async () => {
    const [rows] = await pool.query('SELECT COUNT(*) as count FROM divisions_sync');
    return rows;
  }, 'mysql');
  
  await measureTime('Raw Query - Count Sections', async () => {
    const [rows] = await pool.query('SELECT COUNT(*) as count FROM sections_sync');
    return rows;
  }, 'mysql');
  
  await measureTime('Raw Query - Count Employees', async () => {
    const [rows] = await pool.query('SELECT COUNT(*) as count FROM employees_sync');
    return rows;
  }, 'mysql');
  
  await measureTime('Raw Query - SELECT * FROM divisions_sync', async () => {
    const [rows] = await pool.query('SELECT * FROM divisions_sync');
    return rows;
  }, 'mysql');
  
  await measureTime('Raw Query - SELECT * FROM sections_sync', async () => {
    const [rows] = await pool.query('SELECT * FROM sections_sync');
    return rows;
  }, 'mysql');
  
  await measureTime('Raw Query - SELECT * FROM employees_sync LIMIT 100', async () => {
    const [rows] = await pool.query('SELECT * FROM employees_sync LIMIT 100');
    return rows;
  }, 'mysql');
}

/**
 * Generate performance report
 */
function generateReport() {
  console.log('\n' + '='.repeat(70));
  console.log('📊 DIRECT PERFORMANCE TEST REPORT');
  console.log('='.repeat(70));
  
  // Calculate summary
  const totalDuration = testResults.tests.reduce((sum, t) => sum + t.duration_ms, 0);
  testResults.summary.total_tests = testResults.tests.length;
  testResults.summary.average = Math.round(totalDuration / testResults.tests.length);
  
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
  console.log(`Average Time: ${testResults.summary.average}ms`);
  console.log(`Fastest: ${testResults.summary.fastest.name} (${testResults.summary.fastest.time}ms)`);
  console.log(`Slowest: ${testResults.summary.slowest.name} (${testResults.summary.slowest.time}ms)`);
  
  // Print by category with cache vs MySQL comparison
  console.log('\n📊 Results by Category:\n');
  Object.keys(categories).forEach(category => {
    const tests = categories[category];
    const avgTime = Math.round(tests.reduce((sum, t) => sum + t.duration_ms, 0) / tests.length);
    const successRate = (tests.filter(t => t.success).length / tests.length * 100).toFixed(1);
    
    console.log(`${category.toUpperCase()}: ${tests.length} tests, avg ${avgTime}ms, ${successRate}% success`);
    
    // Show cache vs MySQL comparisons
    const cacheTests = tests.filter(t => t.name.includes('(Cache)'));
    const mysqlTests = tests.filter(t => t.name.includes('(MySQL Direct)'));
    
    if (cacheTests.length > 0 && mysqlTests.length > 0) {
      const cacheAvg = Math.round(cacheTests.reduce((sum, t) => sum + t.duration_ms, 0) / cacheTests.length);
      const mysqlAvg = Math.round(mysqlTests.reduce((sum, t) => sum + t.duration_ms, 0) / mysqlTests.length);
      const improvement = ((mysqlAvg - cacheAvg) / mysqlAvg * 100).toFixed(1);
      
      console.log(`  Cache Avg: ${cacheAvg}ms | MySQL Avg: ${mysqlAvg}ms | Improvement: ${improvement}%`);
    }
    
    // Show individual tests
    tests.forEach(test => {
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
  const reportPath = path.join(__dirname, 'direct_performance_results.json');
  fs.writeFileSync(reportPath, JSON.stringify(testResults, null, 2));
  console.log(`\n💾 Results saved to: ${reportPath}`);
  
  console.log('\n' + '='.repeat(70));
}

/**
 * Main test runner
 */
async function runAllTests() {
  console.log('═'.repeat(70));
  console.log('🚀 DIRECT PERFORMANCE TEST SUITE (No Server Required)');
  console.log('═'.repeat(70));
  console.log(`Test Date: ${new Date().toISOString()}`);
  console.log('═'.repeat(70));
  
  try {
    // Run all test suites
    await testCacheOperations();
    await testDivisionOperations();
    await testSectionOperations();
    await testEmployeeOperations();
    await testSearchOperations();
    await testRelationshipOperations();
    await testRawMySQLQueries();
    
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

// Run tests
if (require.main === module) {
  runAllTests()
    .then(() => {
      console.log('\n🎉 Testing complete!\n');
      process.exit(0);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { runAllTests, measureTime };
