const { getCache } = require('../config/reportCache');

(async () => {
  try {
    const cache = getCache();
    console.log('\n🔍 Connecting to cache...');
    const connected = await cache.connect();

    if (!connected) {
      console.log('⚠️  Cache not connected or disabled, nothing to clear.');
      process.exit(0);
    }

    console.log('🗑️  Clearing all report caches (pattern: report:*)...');
    const deleted = await cache.clearAll('report:*');

    console.log(`✅ Cleared ${deleted} report cache keys`);

    // Optionally show remaining keys count
    const remaining = await cache.getKeysCount('report:*');
    console.log(`ℹ️  Remaining report keys: ${remaining}`);

    // Close connection
    await cache.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing report cache:', error.message);
    process.exit(1);
  }
})();