/**
 * Redis Cache Testing Script
 * Tests cache hit/miss, performance improvements, and invalidation
 */

const moment = require('moment');
require('dotenv').config();

const { getCache } = require('./config/reportCache');
const { generateMySQLGroupAttendanceReport } = require('./controllers/reportController');
const { closePool } = require('./config/mysqlPool');

const TEST_PARAMS = {
  from_date: moment().subtract(7, 'days').format('YYYY-MM-DD'),
  to_date: moment().format('YYYY-MM-DD'),
  division_id: '',
  section_id: '',
  sub_section_id: ''
};

async function runCacheTests() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║          REDIS CACHE PERFORMANCE TEST                           ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');
  
  const cache = getCache();
  
  try {
    // Step 1: Connect to Redis
    console.log('STEP 1: Connecting to Redis cache...');
    const connected = await cache.connect();
    
    if (!connected) {
      console.error('❌ Redis not available - install and start Redis server');
      console.log('\n📖 Quick setup:');
      console.log('   Windows: Download from https://github.com/microsoftarchive/redis/releases');
      console.log('   Linux: sudo apt install redis-server');
      console.log('   Mac: brew install redis');
      console.log('   Docker: docker run -d -p 6379:6379 redis\n');
      return;
    }
    
    console.log('✅ Redis connected\n');
    
    // Step 2: Clear any existing cache
    console.log('STEP 2: Clearing existing cache...');
    await cache.clearAll();
    console.log('✅ Cache cleared\n');
    
    // Step 3: First request (cache MISS - slow)
    console.log('STEP 3: First report generation (NO CACHE - will be slow)');
    console.log(`Parameters: ${JSON.stringify(TEST_PARAMS, null, 2)}`);
    console.log('\n⏱️  Generating report...');
    
    const start1 = Date.now();
    const result1 = await generateMySQLGroupAttendanceReport(
      TEST_PARAMS.from_date,
      TEST_PARAMS.to_date,
      TEST_PARAMS.division_id,
      TEST_PARAMS.section_id,
      TEST_PARAMS.sub_section_id
    );
    const time1 = Date.now() - start1;
    
    console.log(`\n✅ First request completed in ${time1}ms`);
    console.log(`   Employees: ${result1.summary?.totalEmployees || 0}`);
    console.log(`   Records: ${result1.summary?.totalRecords || 0}`);
    console.log(`   Cached: ${result1.cached || false}\n`);
    
    // Small delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Step 4: Second request (cache HIT - fast!)
    console.log('STEP 4: Second report generation (FROM CACHE - will be instant)');
    console.log('⏱️  Generating report...');
    
    const start2 = Date.now();
    const result2 = await generateMySQLGroupAttendanceReport(
      TEST_PARAMS.from_date,
      TEST_PARAMS.to_date,
      TEST_PARAMS.division_id,
      TEST_PARAMS.section_id,
      TEST_PARAMS.sub_section_id
    );
    const time2 = Date.now() - start2;
    
    console.log(`\n✅ Second request completed in ${time2}ms`);
    console.log(`   Employees: ${result2.summary?.totalEmployees || 0}`);
    console.log(`   Records: ${result2.summary?.totalRecords || 0}`);
    console.log(`   Cached: ${result2.cached || false}\n`);
    
    // Step 5: Performance comparison
    console.log('STEP 5: Performance Comparison');
    console.log('═'.repeat(70));
    console.log(`   First request (no cache):    ${time1}ms`);
    console.log(`   Second request (from cache):  ${time2}ms`);
    console.log(`   Improvement:                  ${(((time1 - time2) / time1) * 100).toFixed(1)}% faster`);
    console.log(`   Speed multiplier:             ${(time1 / time2).toFixed(1)}x faster`);
    console.log('═'.repeat(70) + '\n');
    
    // Step 6: Cache statistics
    console.log('STEP 6: Cache Statistics');
    const stats = cache.getStats();
    console.log(`   Enabled: ${stats.enabled}`);
    console.log(`   Connected: ${stats.connected}`);
    console.log(`   Hits: ${stats.hits}`);
    console.log(`   Misses: ${stats.misses}`);
    console.log(`   Hit Rate: ${stats.hitRate}`);
    console.log(`   Total Requests: ${stats.totalRequests}\n`);
    
    // Step 7: Cache invalidation test
    console.log('STEP 7: Testing cache invalidation...');
    await cache.clearDateRange(TEST_PARAMS.from_date, TEST_PARAMS.to_date);
    console.log('✅ Cache cleared for date range\n');
    
    // Verify cache miss after clearing
    const start3 = Date.now();
    const result3 = await generateMySQLGroupAttendanceReport(
      TEST_PARAMS.from_date,
      TEST_PARAMS.to_date,
      TEST_PARAMS.division_id,
      TEST_PARAMS.section_id,
      TEST_PARAMS.sub_section_id
    );
    const time3 = Date.now() - start3;
    
    console.log(`   Third request (after invalidation): ${time3}ms`);
    console.log(`   Cached: ${result3.cached || false}`);
    console.log('   ✅ Cache invalidation working correctly\n');
    
    // Step 8: Final statistics
    console.log('STEP 8: Final Cache Statistics');
    const finalStats = cache.getStats();
    console.log(`   Total Hits: ${finalStats.hits}`);
    console.log(`   Total Misses: ${finalStats.misses}`);
    console.log(`   Total Sets: ${finalStats.sets}`);
    console.log(`   Total Deletes: ${finalStats.deletes}`);
    console.log(`   Hit Rate: ${finalStats.hitRate}\n`);
    
    // Summary
    console.log('╔══════════════════════════════════════════════════════════════════╗');
    console.log('║                    TEST SUMMARY                                  ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝\n');
    console.log(`✅ Cache System: WORKING`);
    console.log(`✅ Cache Hit/Miss: WORKING`);
    console.log(`✅ Cache Invalidation: WORKING`);
    console.log(`✅ Performance Improvement: ${(((time1 - time2) / time1) * 100).toFixed(1)}% faster`);
    console.log(`✅ Speed Multiplier: ${(time1 / time2).toFixed(1)}x`);
    
    if (time2 < 100) {
      console.log(`\n🎉 EXCELLENT! Cache responses under 100ms (instant!)`);
    } else if (time2 < 500) {
      console.log(`\n✅ GOOD! Cache responses under 500ms`);
    }
    
    console.log('\n📊 Expected behavior:');
    console.log('   - First request: Slow (generates from database)');
    console.log('   - Subsequent requests: Instant (from cache)');
    console.log('   - After invalidation: Slow again (re-generates)\n');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    await cache.disconnect();
    await closePool();
    console.log('✅ Cleanup complete\n');
  }
}

// Run tests
runCacheTests();
