const { syncEmployees } = require('../services/hrisSyncService');

(async () => {
  try {
    console.log('Starting manual employees sync...');
    const res = await syncEmployees('manual_run');
    console.log('Result:', res);
    process.exit(0);
  } catch (err) {
    console.error('Employees sync failed:', err && err.stack ? err.stack : err.message || err);
    process.exit(1);
  }
})();