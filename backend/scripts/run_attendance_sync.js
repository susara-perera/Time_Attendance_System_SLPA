const { syncLastNDays } = require('../services/attendanceSyncService');

(async () => {
  try {
    console.log('Starting manual attendance sync (last 30 days)...');
    const res = await syncLastNDays(30, 'manual_run');
    console.log('Result:', res);
    process.exit(0);
  } catch (err) {
    console.error('Attendance sync failed:', err && err.stack ? err.stack : err.message || err);
    process.exit(1);
  }
})();