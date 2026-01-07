const { syncDivisions } = require('../services/hrisSyncService');

(async () => {
  try {
    console.log('Starting manual divisions sync...');
    const res = await syncDivisions('manual_run');
    console.log('Result:', res);
    process.exit(0);
  } catch (err) {
    console.error('Divisions sync failed:', err.message);
    process.exit(1);
  }
})();