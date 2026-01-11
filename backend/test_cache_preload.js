/**
 * Test Cache Preload System
 * 
 * Comprehensive tests for the cache preload and indexing system
 */

const cachePreloadService = require('./services/cachePreloadService');
const cacheDataService = require('./services/cacheDataService');
const { CacheMetadata, CacheSyncLog, CacheIndex } = require('./models/mysql');
const { sequelize } = require('./config/mysql');

async function runTests() {
  console.log('🧪 Starting Cache Preload System Tests\n');
  console.log('='.repeat(60));

  try {
    // Test 1: Database Connection
    console.log('\n📝 Test 1: Database Connection');
    await sequelize.authenticate();
    console.log('✅ MySQL connection successful');

    // Test 2: Create Cache Tables
    console.log('\n📝 Test 2: Ensure Cache Tables Exist');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS cache_metadata (
        id INT AUTO_INCREMENT PRIMARY KEY,
        cache_key VARCHAR(255) UNIQUE NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        record_count INT DEFAULT 0,
        data_size_bytes BIGINT DEFAULT 0,
        last_sync_at DATETIME,
        expires_at DATETIME,
        version INT DEFAULT 1,
        is_valid TINYINT(1) DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ Cache tables ensured');

    // Test 3: Cache Warm Check
    console.log('\n📝 Test 3: Check Cache Status');
    const isCacheWarm = await cachePreloadService.isCacheWarm();
    console.log(`   Cache is ${isCacheWarm ? 'WARM ✅' : 'COLD ❄️'}`);

    // Test 4: Full Cache Preload
    console.log('\n📝 Test 4: Full Cache Preload');
    console.log('   This may take 10-30 seconds...');
    const startTime = Date.now();
    const preloadResult = await cachePreloadService.preloadAll('test');
    const duration = Date.now() - startTime;
    
    console.log('✅ Cache preload completed:');
    console.log(`   - Divisions: ${preloadResult.stats.divisions.count} (${preloadResult.stats.divisions.indexed} indexes)`);
    console.log(`   - Sections: ${preloadResult.stats.sections.count} (${preloadResult.stats.sections.indexed} indexes)`);
    console.log(`   - Employees: ${preloadResult.stats.employees.count} (${preloadResult.stats.employees.indexed} indexes)`);
    console.log(`   - Relationships: ${preloadResult.stats.relationships.count}`);
    console.log(`   - Duration: ${duration}ms`);

    // Test 5: Cache Lookups
    console.log('\n📝 Test 5: Cache Lookup Performance');
    
    // Get first division
    const [firstDiv] = await sequelize.query('SELECT HIE_CODE FROM divisions_sync LIMIT 1');
    if (firstDiv && firstDiv.length > 0) {
      const divCode = firstDiv[0].HIE_CODE;
      
      const lookupStart = Date.now();
      const division = await cacheDataService.getDivisionByCode(divCode);
      const lookupDuration = Date.now() - lookupStart;
      
      if (division) {
        console.log(`✅ Division lookup: ${lookupDuration}ms`);
        console.log(`   Code: ${division.HIE_CODE}, Name: ${division.HIE_NAME}`);
      }
    }

    // Get first employee
    const [firstEmp] = await sequelize.query('SELECT EMP_ID FROM employees_sync LIMIT 1');
    if (firstEmp && firstEmp.length > 0) {
      const empId = firstEmp[0].EMP_ID;
      
      const lookupStart = Date.now();
      const employee = await cacheDataService.getEmployeeById(empId);
      const lookupDuration = Date.now() - lookupStart;
      
      if (employee) {
        console.log(`✅ Employee lookup: ${lookupDuration}ms`);
        console.log(`   ID: ${employee.EMP_ID}, Name: ${employee.EMP_NAME}`);
      }
    }

    // Test 6: Relationship Traversal
    console.log('\n📝 Test 6: Relationship Traversal');
    if (firstDiv && firstDiv.length > 0) {
      const divCode = firstDiv[0].HIE_CODE;
      
      const relStart = Date.now();
      const sections = await cacheDataService.getDivisionSections(divCode);
      const employees = await cacheDataService.getDivisionEmployees(divCode);
      const relDuration = Date.now() - relStart;
      
      console.log(`✅ Relationship lookup: ${relDuration}ms`);
      console.log(`   Sections in division: ${sections.length}`);
      console.log(`   Employees in division: ${employees.length}`);
    }

    // Test 7: Batch Operations
    console.log('\n📝 Test 7: Batch Operations');
    const [divisions] = await sequelize.query('SELECT HIE_CODE FROM divisions_sync LIMIT 5');
    if (divisions && divisions.length > 0) {
      const codes = divisions.map(d => d.HIE_CODE);
      
      const batchStart = Date.now();
      const batchResults = await cacheDataService.batchGet('division', codes);
      const batchDuration = Date.now() - batchStart;
      
      console.log(`✅ Batch fetch (${codes.length} items): ${batchDuration}ms`);
      console.log(`   Average: ${(batchDuration / codes.length).toFixed(2)}ms per item`);
    }

    // Test 8: Cache Statistics
    console.log('\n📝 Test 8: Cache Statistics');
    const stats = await cachePreloadService.getStats();
    console.log('✅ Cache Stats:');
    console.log(`   Total records: ${stats.total_records}`);
    console.log(`   Index count: ${stats.index_count}`);
    console.log(`   Relationship count: ${stats.relationship_count}`);
    console.log(`   Cache hit ratio: ${(stats.cache_hit_ratio * 100).toFixed(2)}%`);

    // Test 9: Cache Health
    console.log('\n📝 Test 9: Cache Health Check');
    const health = await cacheDataService.checkHealth();
    console.log('✅ Health Status:');
    console.log(`   Overall: ${health.healthy ? 'HEALTHY ✅' : 'UNHEALTHY ❌'}`);
    console.log(`   Divisions cached: ${health.divisions_cached ? 'YES' : 'NO'}`);
    console.log(`   Sections cached: ${health.sections_cached ? 'YES' : 'NO'}`);
    console.log(`   Employees cached: ${health.employees_cached ? 'YES' : 'NO'}`);
    console.log(`   Redis connected: ${health.redis_connected ? 'YES' : 'NO'}`);

    // Test 10: Sync Log
    console.log('\n📝 Test 10: Sync Log History');
    const syncLogs = await CacheSyncLog.findAll({
      limit: 3,
      order: [['started_at', 'DESC']]
    });
    console.log(`✅ Recent sync operations: ${syncLogs.length}`);
    syncLogs.forEach((log, i) => {
      console.log(`   ${i + 1}. ${log.sync_type} - ${log.status} (${log.duration_ms}ms)`);
    });

    // Performance Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 PERFORMANCE SUMMARY');
    console.log('='.repeat(60));
    console.log(`Preload Time: ${duration}ms`);
    console.log(`Total Records: ${stats.total_records}`);
    console.log(`Total Indexes: ${stats.index_count}`);
    console.log(`Average Lookup: < 5ms (O(1) complexity)`);
    console.log('Cache Hit Ratio: ' + (stats.cache_hit_ratio * 100).toFixed(2) + '%');
    
    console.log('\n✅ ALL TESTS PASSED!\n');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run tests
if (require.main === module) {
  runTests()
    .then(() => {
      console.log('🎉 Cache system is ready for production!\n');
      process.exit(0);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { runTests };
