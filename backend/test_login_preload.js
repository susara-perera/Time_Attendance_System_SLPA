/**
 * Test: Login-triggered cache preload
 *
 * Runs a lightweight scenario to validate that the preload job is started when cache is cold
 */
require('dotenv').config();

const cachePreloadService = require('./services/cachePreloadService');

async function run() {
  console.log('🔎 Checking cache warm status...');
  const isWarm = await cachePreloadService.isCacheWarm();
  console.log(`   Cache is ${isWarm ? 'WARM ✅' : 'COLD ❄️'}`);

  if (!isWarm) {
    console.log('▶️ Starting preload job (simulating login)...');
    const job = cachePreloadService.startFullSystemPreloadJob('test-login');
    console.log('   Job started:', job.id, 'status:', job.status);
    console.log('   Check progress via /api/cache/status or by inspecting job object in memory.');
  } else {
    console.log('✅ No preload needed - cache is already warm');
  }
}

if (require.main === module) {
  run().then(() => {
    console.log('Done');
    process.exit(0);
  }).catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
}

module.exports = { run };
