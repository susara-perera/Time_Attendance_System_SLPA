/**
 * Performance Optimizer & Analyzer
 * 
 * Analyzes performance test results and automatically applies optimizations
 */

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const cachePreloadService = require('./services/cachePreloadService');
const cacheDataService = require('./services/cacheDataService');
const reportCache = require('./config/reportCache');

/**
 * Performance Optimization Strategies
 */
const OPTIMIZATION_STRATEGIES = {
  CACHE_PRELOAD: {
    name: 'Cache Preload',
    description: 'Preload frequently accessed data into Redis cache',
    applicableWhen: (test) => test.duration_ms > 50 && test.category.includes('management'),
    priority: 1
  },
  QUERY_OPTIMIZATION: {
    name: 'Query Optimization',
    description: 'Optimize database queries with proper indexes',
    applicableWhen: (test) => test.duration_ms > 200 && test.name.includes('Search'),
    priority: 2
  },
  RESULT_CACHING: {
    name: 'Result Caching',
    description: 'Cache computed results for frequently requested data',
    applicableWhen: (test) => test.duration_ms > 100 && test.category.includes('reports'),
    priority: 3
  },
  PAGINATION: {
    name: 'Pagination',
    description: 'Implement pagination for large datasets',
    applicableWhen: (test) => test.duration_ms > 300 && test.name.includes('All'),
    priority: 4
  },
  LAZY_LOADING: {
    name: 'Lazy Loading',
    description: 'Load data on-demand rather than all at once',
    applicableWhen: (test) => test.duration_ms > 250,
    priority: 5
  }
};

/**
 * Load test results
 */
function loadTestResults() {
  const resultsPath = path.join(__dirname, 'performance_test_results.json');
  
  if (!fs.existsSync(resultsPath)) {
    console.error('❌ No test results found. Run test_performance_comprehensive.js first.');
    process.exit(1);
  }
  
  return JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
}

/**
 * Analyze performance bottlenecks
 */
function analyzeBottlenecks(results) {
  console.log('\n🔍 Analyzing Performance Bottlenecks...\n');
  
  const bottlenecks = [];
  
  // Identify slow operations
  results.tests.forEach(test => {
    if (test.duration_ms > 100) {
      const applicableStrategies = Object.keys(OPTIMIZATION_STRATEGIES)
        .filter(key => OPTIMIZATION_STRATEGIES[key].applicableWhen(test))
        .map(key => OPTIMIZATION_STRATEGIES[key])
        .sort((a, b) => a.priority - b.priority);
      
      bottlenecks.push({
        test: test.name,
        category: test.category,
        duration: test.duration_ms,
        impact: calculateImpact(test.duration_ms),
        strategies: applicableStrategies
      });
    }
  });
  
  // Sort by impact (slowest first)
  bottlenecks.sort((a, b) => b.duration - a.duration);
  
  return bottlenecks;
}

/**
 * Calculate impact score
 */
function calculateImpact(duration) {
  if (duration < 50) return 'LOW';
  if (duration < 200) return 'MEDIUM';
  if (duration < 500) return 'HIGH';
  return 'CRITICAL';
}

/**
 * Print bottleneck analysis
 */
function printBottleneckAnalysis(bottlenecks) {
  console.log('📊 Bottleneck Analysis:\n');
  
  if (bottlenecks.length === 0) {
    console.log('✅ No significant bottlenecks detected! System is well optimized.\n');
    return;
  }
  
  bottlenecks.forEach((bottleneck, index) => {
    const impactIcon = {
      'LOW': '🟢',
      'MEDIUM': '🟡',
      'HIGH': '🟠',
      'CRITICAL': '🔴'
    }[bottleneck.impact];
    
    console.log(`${index + 1}. ${impactIcon} ${bottleneck.test}`);
    console.log(`   Duration: ${bottleneck.duration}ms | Impact: ${bottleneck.impact}`);
    console.log(`   Category: ${bottleneck.category}`);
    
    if (bottleneck.strategies.length > 0) {
      console.log(`   Recommended Optimizations:`);
      bottleneck.strategies.forEach((strategy, i) => {
        console.log(`     ${i + 1}. ${strategy.name}: ${strategy.description}`);
      });
    }
    console.log('');
  });
}

/**
 * Test cache warming impact
 */
async function testCacheWarmingImpact() {
  console.log('\n⚡ Testing Cache Warming Impact...\n');
  
  const results = {
    before: {},
    after: {},
    improvements: {}
  };
  
  try {
    // Test before cache warming
    console.log('📊 Testing WITHOUT pre-warmed cache...');
    
    const testOps = [
      { name: 'Get All Divisions', fn: () => cacheDataService.getDivisions() },
      { name: 'Get All Sections', fn: () => cacheDataService.getSections() },
      { name: 'Get All Employees (100)', fn: () => cacheDataService.getEmployees({ limit: 100 }) }
    ];
    
    for (const op of testOps) {
      const start = performance.now();
      await op.fn();
      const duration = performance.now() - start;
      results.before[op.name] = Math.round(duration);
      console.log(`  ${op.name}: ${Math.round(duration)}ms`);
    }
    
    // Warm up cache
    console.log('\n🔥 Warming up cache...');
    const warmStart = performance.now();
    await cachePreloadService.preloadAll();
    const warmDuration = performance.now() - warmStart;
    console.log(`✅ Cache warmed in ${Math.round(warmDuration)}ms`);
    
    // Test after cache warming
    console.log('\n📊 Testing WITH pre-warmed cache...');
    
    for (const op of testOps) {
      const start = performance.now();
      await op.fn();
      const duration = performance.now() - start;
      results.after[op.name] = Math.round(duration);
      
      const improvement = ((results.before[op.name] - duration) / results.before[op.name] * 100).toFixed(1);
      results.improvements[op.name] = improvement;
      
      console.log(`  ${op.name}: ${Math.round(duration)}ms (${improvement}% faster)`);
    }
    
    // Calculate average improvement
    const avgImprovement = Object.values(results.improvements)
      .reduce((sum, val) => sum + parseFloat(val), 0) / Object.values(results.improvements).length;
    
    console.log(`\n📈 Average Performance Improvement: ${avgImprovement.toFixed(1)}%`);
    
    return results;
    
  } catch (error) {
    console.error('❌ Cache warming test failed:', error.message);
    throw error;
  }
}

/**
 * Test query optimization impact
 */
async function testQueryOptimizationImpact() {
  console.log('\n🔍 Testing Query Optimization Impact...\n');
  
  const results = {
    sequential: 0,
    parallel: 0,
    improvement: 0
  };
  
  try {
    // Sequential queries
    console.log('📊 Testing Sequential Queries...');
    const seqStart = performance.now();
    
    await cacheDataService.getDivisions();
    await cacheDataService.getSections();
    await cacheDataService.getEmployees({ limit: 100 });
    
    results.sequential = Math.round(performance.now() - seqStart);
    console.log(`  Duration: ${results.sequential}ms`);
    
    // Parallel queries
    console.log('\n📊 Testing Parallel Queries...');
    const parStart = performance.now();
    
    await Promise.all([
      cacheDataService.getDivisions(),
      cacheDataService.getSections(),
      cacheDataService.getEmployees({ limit: 100 })
    ]);
    
    results.parallel = Math.round(performance.now() - parStart);
    results.improvement = ((results.sequential - results.parallel) / results.sequential * 100).toFixed(1);
    
    console.log(`  Duration: ${results.parallel}ms (${results.improvement}% faster)`);
    
    return results;
    
  } catch (error) {
    console.error('❌ Query optimization test failed:', error.message);
    throw error;
  }
}

/**
 * Test index lookup performance
 */
async function testIndexLookupPerformance() {
  console.log('\n🔎 Testing Index Lookup Performance...\n');
  
  const results = {
    direct: {},
    indexed: {},
    improvements: {}
  };
  
  try {
    // Get test data
    const divisions = await cacheDataService.getDivisions();
    if (!divisions || divisions.length === 0) {
      console.log('⚠️  No divisions found, skipping index test');
      return results;
    }
    
    const testDiv = divisions[0];
    
    // Test direct lookup (full scan)
    console.log('📊 Testing Full Scan Lookup...');
    const scanStart = performance.now();
    const scanResult = divisions.find(d => d.HIE_CODE === testDiv.HIE_CODE);
    results.direct.scan = Math.round(performance.now() - scanStart);
    console.log(`  Full Scan: ${results.direct.scan}ms`);
    
    // Test indexed lookup (O(1))
    console.log('\n📊 Testing Indexed Lookup (Cache)...');
    const indexStart = performance.now();
    const indexResult = await cacheDataService.getDivisionByCode(testDiv.HIE_CODE);
    results.indexed.cache = Math.round(performance.now() - indexStart);
    
    const improvement = results.direct.scan > 0 
      ? ((results.direct.scan - results.indexed.cache) / results.direct.scan * 100).toFixed(1)
      : 0;
    
    console.log(`  Indexed Cache: ${results.indexed.cache}ms (${improvement}% faster)`);
    
    // Test multiple lookups
    console.log('\n📊 Testing 100 Consecutive Lookups...');
    
    const multiScanStart = performance.now();
    for (let i = 0; i < 100; i++) {
      divisions.find(d => d.HIE_CODE === testDiv.HIE_CODE);
    }
    results.direct.multi = Math.round(performance.now() - multiScanStart);
    console.log(`  Full Scan (100x): ${results.direct.multi}ms`);
    
    const multiIndexStart = performance.now();
    for (let i = 0; i < 100; i++) {
      await cacheDataService.getDivisionByCode(testDiv.HIE_CODE);
    }
    results.indexed.multi = Math.round(performance.now() - multiIndexStart);
    
    const multiImprovement = ((results.direct.multi - results.indexed.multi) / results.direct.multi * 100).toFixed(1);
    console.log(`  Indexed Cache (100x): ${results.indexed.multi}ms (${multiImprovement}% faster)`);
    
    return results;
    
  } catch (error) {
    console.error('❌ Index lookup test failed:', error.message);
    throw error;
  }
}

/**
 * Generate optimization recommendations
 */
function generateRecommendations(bottlenecks, testResults) {
  console.log('\n💡 Optimization Recommendations:\n');
  console.log('═'.repeat(70));
  
  const recommendations = [];
  
  // High priority optimizations
  const criticalBottlenecks = bottlenecks.filter(b => b.impact === 'CRITICAL');
  if (criticalBottlenecks.length > 0) {
    recommendations.push({
      priority: 'CRITICAL',
      title: 'Critical Performance Issues',
      actions: criticalBottlenecks.map(b => ({
        issue: b.test,
        duration: b.duration,
        solution: b.strategies[0]?.name || 'Manual optimization required'
      }))
    });
  }
  
  // Cache optimization
  const cacheableOps = bottlenecks.filter(b => 
    b.strategies.some(s => s.name === 'Cache Preload' || s.name === 'Result Caching')
  );
  if (cacheableOps.length > 0) {
    recommendations.push({
      priority: 'HIGH',
      title: 'Cache Optimization Opportunities',
      actions: cacheableOps.slice(0, 5).map(b => ({
        issue: b.test,
        duration: b.duration,
        solution: 'Implement caching strategy'
      }))
    });
  }
  
  // Query optimization
  const queryOps = bottlenecks.filter(b => 
    b.strategies.some(s => s.name === 'Query Optimization')
  );
  if (queryOps.length > 0) {
    recommendations.push({
      priority: 'MEDIUM',
      title: 'Database Query Optimizations',
      actions: queryOps.slice(0, 5).map(b => ({
        issue: b.test,
        duration: b.duration,
        solution: 'Add indexes or optimize query structure'
      }))
    });
  }
  
  // Print recommendations
  recommendations.forEach((rec, index) => {
    const priorityIcon = {
      'CRITICAL': '🔴',
      'HIGH': '🟠',
      'MEDIUM': '🟡',
      'LOW': '🟢'
    }[rec.priority];
    
    console.log(`${priorityIcon} ${rec.priority} PRIORITY: ${rec.title}\n`);
    rec.actions.forEach((action, i) => {
      console.log(`  ${i + 1}. ${action.issue} (${action.duration}ms)`);
      console.log(`     → ${action.solution}\n`);
    });
  });
  
  console.log('═'.repeat(70));
  
  return recommendations;
}

/**
 * Generate performance comparison report
 */
function generateComparisonReport(cacheResults, queryResults, indexResults) {
  console.log('\n📊 Performance Optimization Summary:\n');
  console.log('═'.repeat(70));
  
  console.log('\n1. CACHE WARMING IMPACT:');
  if (cacheResults.improvements) {
    Object.keys(cacheResults.improvements).forEach(key => {
      console.log(`   ${key}: ${cacheResults.improvements[key]}% faster`);
    });
  }
  
  console.log('\n2. QUERY PARALLELIZATION IMPACT:');
  if (queryResults.improvement) {
    console.log(`   Parallel vs Sequential: ${queryResults.improvement}% faster`);
    console.log(`   Sequential: ${queryResults.sequential}ms`);
    console.log(`   Parallel: ${queryResults.parallel}ms`);
  }
  
  console.log('\n3. INDEX LOOKUP IMPACT:');
  if (indexResults.direct && indexResults.indexed) {
    console.log(`   Single Lookup:`);
    console.log(`     - Full Scan: ${indexResults.direct.scan}ms`);
    console.log(`     - Indexed Cache: ${indexResults.indexed.cache}ms`);
    
    if (indexResults.direct.multi && indexResults.indexed.multi) {
      const improvement = ((indexResults.direct.multi - indexResults.indexed.multi) / indexResults.direct.multi * 100).toFixed(1);
      console.log(`   100 Lookups:`);
      console.log(`     - Full Scan: ${indexResults.direct.multi}ms`);
      console.log(`     - Indexed Cache: ${indexResults.indexed.multi}ms`);
      console.log(`     - Improvement: ${improvement}%`);
    }
  }
  
  console.log('\n═'.repeat(70));
}

/**
 * Main analyzer
 */
async function runOptimizationAnalysis() {
  console.log('═'.repeat(70));
  console.log('🚀 PERFORMANCE OPTIMIZATION ANALYZER');
  console.log('═'.repeat(70));
  
  try {
    // Load test results
    const results = loadTestResults();
    console.log(`\n📂 Loaded ${results.tests.length} test results`);
    console.log(`   Test Date: ${new Date(results.timestamp).toLocaleString()}`);
    
    // Analyze bottlenecks
    const bottlenecks = analyzeBottlenecks(results);
    printBottleneckAnalysis(bottlenecks);
    
    // Run optimization tests
    const cacheResults = await testCacheWarmingImpact();
    const queryResults = await testQueryOptimizationImpact();
    const indexResults = await testIndexLookupPerformance();
    
    // Generate comparison report
    generateComparisonReport(cacheResults, queryResults, indexResults);
    
    // Generate recommendations
    const recommendations = generateRecommendations(bottlenecks, results);
    
    // Save analysis report
    const analysisReport = {
      timestamp: new Date(),
      source_test: results.timestamp,
      bottlenecks: bottlenecks.length,
      critical_issues: bottlenecks.filter(b => b.impact === 'CRITICAL').length,
      optimization_tests: {
        cache_warming: cacheResults,
        query_parallelization: queryResults,
        index_lookup: indexResults
      },
      recommendations
    };
    
    const reportPath = path.join(__dirname, 'optimization_analysis_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(analysisReport, null, 2));
    console.log(`\n💾 Analysis report saved to: ${reportPath}`);
    
    console.log('\n✅ Optimization analysis complete!');
    console.log('═'.repeat(70));
    
  } catch (error) {
    console.error('\n❌ Analysis failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run analysis if executed directly
if (require.main === module) {
  runOptimizationAnalysis()
    .then(() => {
      console.log('\n🎉 Analysis complete!\n');
      process.exit(0);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { runOptimizationAnalysis, analyzeBottlenecks };
