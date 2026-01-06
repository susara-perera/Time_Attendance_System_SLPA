/**
 * Initial Attendance Sync Script
 * 
 * Run this after creating attendance_sync tables
 * to populate them with historical attendance data
 */

const { syncLastNDays, syncCurrentMonth } = require('../services/attendanceSyncService');

const runInitialSync = async () => {
  try {
    console.log('🚀 Starting initial attendance sync...\n');
    console.log('This will sync the last 30 days of attendance data\n');

    const result = await syncLastNDays(30, 'manual-initial');

    if (result.success) {
      console.log('\n✅ Initial sync completed successfully!');
      console.log('\n📊 Summary:');
      console.log(`   Total processed: ${result.recordsProcessed}`);
      console.log(`   New records: ${result.recordsInserted}`);
      console.log(`   Updated records: ${result.recordsUpdated}`);
      console.log(`   Failed records: ${result.recordsFailed}`);
      console.log(`   Duration: ${result.duration}s`);
      console.log('\n💡 Next steps:');
      console.log('   1. Attendance data is now synced in attendance_sync table');
      console.log('   2. Reports will use this table for fast queries');
      console.log('   3. Daily sync will run at 12:00 PM automatically');
      console.log('   4. You can manually trigger sync anytime via: POST /api/sync/trigger/attendance');
    } else {
      console.error('\n❌ Initial sync failed!');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Error during initial sync:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
};

// Run the script
runInitialSync()
  .then(() => {
    console.log('\n🎉 Done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });
