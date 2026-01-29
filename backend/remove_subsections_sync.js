const { SyncSchedule } = require('./models/mysql');
require('dotenv').config();

async function removeSubSectionsSync() {
  try {
    console.log('🔧 Removing Sub-Sections Sync from sync_schedules table...');

    const deleted = await SyncSchedule.destroy({
      where: { task_id: 'subsections_sync' }
    });

    if (deleted > 0) {
      console.log('✅ Successfully removed Sub-Sections Sync from database');
    } else {
      console.log('ℹ️  Sub-Sections Sync was not found in database (already removed or never existed)');
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Error removing Sub-Sections Sync:', err);
    process.exit(1);
  }
}

removeSubSectionsSync();