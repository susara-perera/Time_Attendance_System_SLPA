const { syncSections } = require('../services/hrisSyncService');

(async () => {
  try {
    console.log('Starting manual sections sync...');
    const res = await syncSections('manual_run');
    console.log('Result:', res);
    process.exit(0);
  } catch (err) {
    console.error('Sections sync failed:', err.message);
    process.exit(1);
  }
})();