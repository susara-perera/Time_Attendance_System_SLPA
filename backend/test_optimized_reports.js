/**
 * COMPREHENSIVE ATTENDANCE REPORT OPTIMIZATION TEST
 * Tests the new optimized report generation with connection pooling and JOIN queries
 */

const moment = require('moment');
require('dotenv').config();

// Import the pool utilities
const { testConnection, getPoolStats, closePool } = require('./config/mysqlPool');

// Import report controller
const { generateMySQLGroupAttendanceReport } = require('./controllers/reportController');

// Test configuration
const TEST_SCENARIOS = [
  {
    name: '1 DAY - Single Division',
    from_date: moment().subtract(1, 'days').format('YYYY-MM-DD'),
    to_date: moment().subtract(1, 'days').format('YYYY-MM-DD'),
    division_id: '', // Leave empty for first test, will auto-detect
    section_id: '',
    sub_section_id: ''
  },
  {
    name: '7 DAYS - All Divisions',
    from_date: moment().subtract(7, 'days').format('YYYY-MM-DD'),
    to_date: moment().format('YYYY-MM-DD'),
    division_id: '',
    section_id: '',
    sub_section_id: ''
  },
  {
    name: '30 DAYS - Specific Division',
    from_date: moment().subtract(30, 'days').format('YYYY-MM-DD'),
    to_date: moment().format('YYYY-MM-DD'),
    division_id: '', // Will be set from first test
    section_id: '',
    sub_section_id: ''
  },
  {
    name: '90 DAYS - All Divisions (Heavy Load)',
    from_date: moment().subtract(90, 'days').format('YYYY-MM-DD'),
    to_date: moment().format('YYYY-MM-DD'),
    division_id: '',
    section_id: '',
    sub_section_id: ''
  }
];

// Results storage
const testResults = [];

/**
 * Format bytes to human readable
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Format duration in ms to human readable
 */
function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Run a single test scenario
 */
async function runTest(scenario, index) {
  console.log('\n' + '='.repeat(80));
  console.log(`TEST ${index + 1}/${TEST_SCENARIOS.length}: ${scenario.name}`);
  console.log('='.repeat(80));
  console.log(`📅 Date Range: ${scenario.from_date} to ${scenario.to_date}`);
  console.log(`📊 Filters: Division=${scenario.division_id || 'ALL'}, Section=${scenario.section_id || 'ALL'}, SubSection=${scenario.sub_section_id || 'ALL'}`);
  
  const memBefore = process.memoryUsage();
  const startTime = Date.now();
  
  try {
    // Execute report generation
    const result = await generateMySQLGroupAttendanceReport(
      scenario.from_date,
      scenario.to_date,
      scenario.division_id,
      scenario.section_id,
      scenario.sub_section_id
    );
    
    const endTime = Date.now();
    const memAfter = process.memoryUsage();
    const duration = endTime - startTime;
    
    // Calculate memory usage
    const memUsed = {
      heapUsed: memAfter.heapUsed - memBefore.heapUsed,
      external: memAfter.external - memBefore.external,
      rss: memAfter.rss - memBefore.rss
    };
    
    // Get pool stats
    const poolStats = getPoolStats();
    
    // Store results
    const testResult = {
      scenario: scenario.name,
      success: true,
      duration,
      queryTime: result.summary?.queryTime || 0,
      processingTime: result.summary?.processingTime || 0,
      employees: result.summary?.totalEmployees || 0,
      days: result.summary?.totalDays || 0,
      records: result.summary?.totalRecords || 0,
      recordsPerSec: Math.round(result.summary?.totalRecords / (duration / 1000)) || 0,
      memoryUsed: memUsed,
      poolStats: poolStats
    };
    
    testResults.push(testResult);
    
    // Print results
    console.log('\n✅ TEST PASSED');
    console.log('\n📊 RESULTS:');
    console.log(`   ⏱️  Total Time: ${formatDuration(duration)}`);
    console.log(`   🔍 Query Time: ${formatDuration(testResult.queryTime)} (${Math.round(testResult.queryTime / duration * 100)}%)`);
    console.log(`   ⚙️  Processing Time: ${formatDuration(testResult.processingTime)} (${Math.round(testResult.processingTime / duration * 100)}%)`);
    console.log(`   👥 Employees: ${testResult.employees}`);
    console.log(`   📅 Days: ${testResult.days}`);
    console.log(`   📝 Records: ${testResult.records.toLocaleString()}`);
    console.log(`   🚀 Throughput: ${testResult.recordsPerSec.toLocaleString()} records/sec`);
    console.log(`   💾 Heap Used: ${formatBytes(memUsed.heapUsed)}`);
    console.log(`   🔗 Pool: ${poolStats?.freeConnections}/${poolStats?.totalConnections} free (${poolStats?.queuedRequests} queued)`);
    
    // If this is the first test and we found data, use the division for subsequent tests
    if (index === 0 && result.summary?.divisionInfo) {
      const divisionName = result.summary.divisionInfo;
      console.log(`\n💡 Found division "${divisionName}" - will use for future tests`);
      
      // Update future test scenarios that need a specific division
      for (let i = 2; i < TEST_SCENARIOS.length; i++) {
        if (TEST_SCENARIOS[i].name.includes('Specific Division')) {
          // We'd need to look up the division_id from the result, keeping empty for now
          console.log(`   (Note: Would set division_id for test ${i + 1})`);
        }
      }
    }
    
    return testResult;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`\n❌ TEST FAILED after ${formatDuration(duration)}`);
    console.error(`   Error: ${error.message}`);
    console.error(`   Stack: ${error.stack?.split('\n').slice(0, 3).join('\n')}`);
    
    const testResult = {
      scenario: scenario.name,
      success: false,
      duration,
      error: error.message
    };
    
    testResults.push(testResult);
    return testResult;
  }
}

/**
 * Print summary of all tests
 */
function printSummary() {
  console.log('\n\n' + '═'.repeat(80));
  console.log('📊 TEST SUITE SUMMARY');
  console.log('═'.repeat(80));
  
  const passed = testResults.filter(r => r.success).length;
  const failed = testResults.filter(r => !r.success).length;
  
  console.log(`\n✅ Passed: ${passed}/${testResults.length}`);
  console.log(`❌ Failed: ${failed}/${testResults.length}`);
  
  if (passed > 0) {
    console.log('\n📈 PERFORMANCE METRICS (Successful Tests):');
    console.log('─'.repeat(80));
    console.log('Scenario                          | Duration | Query  | Process | Records  | Throughput');
    console.log('─'.repeat(80));
    
    testResults.filter(r => r.success).forEach(result => {
      const name = result.scenario.padEnd(33);
      const duration = formatDuration(result.duration).padStart(8);
      const query = formatDuration(result.queryTime).padStart(6);
      const process = formatDuration(result.processingTime).padStart(7);
      const records = result.records.toLocaleString().padStart(8);
      const throughput = (result.recordsPerSec.toLocaleString() + '/s').padStart(10);
      
      console.log(`${name} | ${duration} | ${query} | ${process} | ${records} | ${throughput}`);
    });
    
    // Calculate averages
    const successfulResults = testResults.filter(r => r.success);
    const avgDuration = successfulResults.reduce((sum, r) => sum + r.duration, 0) / successfulResults.length;
    const avgThroughput = successfulResults.reduce((sum, r) => sum + r.recordsPerSec, 0) / successfulResults.length;
    const totalRecords = successfulResults.reduce((sum, r) => sum + r.records, 0);
    
    console.log('─'.repeat(80));
    console.log(`\n📊 AGGREGATE STATS:`);
    console.log(`   Average Duration: ${formatDuration(avgDuration)}`);
    console.log(`   Average Throughput: ${Math.round(avgThroughput).toLocaleString()} records/sec`);
    console.log(`   Total Records Processed: ${totalRecords.toLocaleString()}`);
  }
  
  if (failed > 0) {
    console.log('\n❌ FAILED TESTS:');
    testResults.filter(r => !r.success).forEach(result => {
      console.log(`   - ${result.scenario}: ${result.error}`);
    });
  }
  
  console.log('\n' + '═'.repeat(80));
}

/**
 * Main test runner
 */
async function main() {
  console.log('╔' + '═'.repeat(78) + '╗');
  console.log('║' + ' '.repeat(78) + '║');
  console.log('║       ATTENDANCE REPORT OPTIMIZATION TEST SUITE                          ║');
  console.log('║' + ' '.repeat(78) + '║');
  console.log('╚' + '═'.repeat(78) + '╝');
  
  console.log('\n🔧 SETUP:');
  console.log(`   Database: ${process.env.MYSQL_DATABASE || 'slpa_db'}`);
  console.log(`   Host: ${process.env.MYSQL_HOST || 'localhost'}`);
  console.log(`   Test Scenarios: ${TEST_SCENARIOS.length}`);
  
  // Test connection pool
  console.log('\n🔌 Testing connection pool...');
  const connectionOk = await testConnection();
  
  if (!connectionOk) {
    console.error('❌ Cannot connect to database. Exiting.');
    process.exit(1);
  }
  
  console.log('✅ Connection pool initialized successfully');
  
  // Run all tests sequentially
  console.log(`\n🚀 Running ${TEST_SCENARIOS.length} test scenarios...\n`);
  
  for (let i = 0; i < TEST_SCENARIOS.length; i++) {
    await runTest(TEST_SCENARIOS[i], i);
    
    // Small delay between tests
    if (i < TEST_SCENARIOS.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  // Print summary
  printSummary();
  
  // Close pool
  console.log('\n🔒 Closing connection pool...');
  await closePool();
  console.log('✅ Test suite completed!\n');
}

// Run tests
main().catch(error => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});
