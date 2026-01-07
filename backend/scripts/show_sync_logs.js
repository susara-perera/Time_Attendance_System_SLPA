const { SyncLog } = require('../models/mysql');

(async () => {
  try {
    const logs = await SyncLog.findAll({ order: [['started_at', 'DESC']], limit: 10 });
    console.log('Recent sync logs:');
    logs.forEach(l => {
      console.log(`- [${l.sync_type}] ${l.sync_status} : ${l.records_synced} synced, ${l.records_added} added, ${l.records_updated} updated, failed ${l.records_failed} (started ${l.started_at})`);
    });
    process.exit(0);
  } catch (err) {
    console.error('Error fetching sync logs:', err.message);
    process.exit(1);
  }
})();