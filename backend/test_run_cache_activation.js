/*
 * Test runner: Trigger cache activation (login-style) and poll progress
 *
 * Usage:
 *   node test_run_cache_activation.js           # default: wait for completion (5 min timeout)
 *   node test_run_cache_activation.js --no-wait # trigger and exit immediately
 *   node test_run_cache_activation.js --timeout=600000 # 10 min timeout
 *   node test_run_cache_activation.js --force  # trigger even if cache is warm
 */
require('dotenv').config();

const cachePreloadService = require('./services/cachePreloadService');
const { getCache } = require('./config/reportCache');

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { wait: true, timeout: 300000, force: false };
  for (const a of args) {
    if (a === '--no-wait' || a === '--nowait') opts.wait = false;
    else if (a.startsWith('--timeout=')) opts.timeout = parseInt(a.split('=')[1], 10) || opts.timeout;
    else if (a === '--force') opts.force = true;
  }
  return opts;
}

async function run() {
  const opts = parseArgs();
  console.log('🔎 Test runner for cache activation');
  console.log(`   Options: wait=${opts.wait}, timeout=${opts.timeout}ms, force=${opts.force}`);

  try {
    const cache = getCache();
    console.log('1) Ensuring Redis connection...');
    try {
      await cache.connect();
      console.log(`   Redis enabled=${cache.isEnabled}, connected=${cache.isConnected}`);
    } catch (e) {
      console.warn('   Redis connect failed (non-fatal):', e && e.message ? e.message : e);
    }

    const isWarm = await cachePreloadService.isCacheWarm();
    console.log(`2) Current cache warm status: ${isWarm ? 'WARM ✅' : 'COLD ❄️'}`);

    if (isWarm && !opts.force) {
      console.log('   Cache is already warm. Use --force to re-trigger. Exiting.');
      process.exit(0);
    }

    console.log('3) Triggering preload job (simulating login)...');
    const job = cachePreloadService.startFullSystemPreloadJob('test-runner');
    console.log(`   Job started: id=${job.id} status=${job.status} percent=${job.percent}`);

    if (!opts.wait) {
      console.log('   Not waiting for completion. You can monitor progress via /api/cache/status or by inspecting this job id.');
      process.exit(0);
    }

    console.log('4) Polling job status until completion or timeout...');
    const start = Date.now();
    const deadline = start + opts.timeout;

    while (true) {
      const current = cachePreloadService.getPreloadJob(job.id);
      if (!current) {
        console.warn('   Job not found in memory; it may have completed or the service was restarted.');
      } else {
        console.log(`   Progress: ${current.percent}% - step: ${current.currentStep || 'n/a'} - status: ${current.status}`);
      }

      if (current && current.status === 'completed') {
        console.log('✅ Preload job completed successfully');
        break;
      }

      if (current && current.status === 'failed') {
        console.error('❌ Preload job failed:', current.error || 'Unknown error');
        process.exit(1);
      }

      if (Date.now() > deadline) {
        console.error('⏱️  Timeout waiting for preload to complete');
        process.exit(2);
      }

      // wait 2 seconds
      await new Promise(r => setTimeout(r, 2000));
    }

    // Final checks
    console.log('5) Fetching final cache stats and info...');
    try {
      const stats = await cachePreloadService.getStats();
      console.log('   CachePreloadService stats:', JSON.stringify(stats, null, 2));
    } catch (e) {
      console.warn('   Could not fetch preload stats:', e && e.message ? e.message : e);
    }

    try {
      const info = await cache.getInfo();
      console.log('   Cache info:', info && info.connected !== undefined ? JSON.stringify(info, null, 2) : String(info));
    } catch (e) {
      console.warn('   Could not fetch cache info:', e && e.message ? e.message : e);
    }

    console.log('\n✅ Test run finished');
    process.exit(0);

  } catch (error) {
    console.error('Fatal error in test runner:', error && (error.message || error.stack) ? (error.message || error.stack) : error);
    process.exit(1);
  }
}

if (require.main === module) run();

module.exports = { run };
