/**
 * Initial Audit Data Sync Script
 * Run this after creating the audit_sync table to populate initial data
 * 
 * Usage: node backend/scripts/sync_audit_data.js [days]
 * Example: node backend/scripts/sync_audit_data.js 60  (sync last 60 days)
 */

const { syncLastNDays, syncCurrentMonth } = require('../services/auditSyncService');

const runInitialSync = async () => {
  try {
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║              📋 INITIAL AUDIT DATA SYNC                       ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    // Get days from command line argument, default to 30
    const days = parseInt(process.argv[2]) || 30;
    
    console.log(`🎯 Syncing last ${days} days of incomplete punch records...`);
    console.log(`📅 This will populate the audit_sync table with pre-processed data\n`);

    const result = await syncLastNDays(days, 'manual_initial');

    console.log('\n✅ Initial sync completed successfully!');
    console.log(`📊 Records synced: ${result.recordsSynced}`);
    console.log(`⏱️  Duration: ${result.duration}ms (${(result.duration / 1000).toFixed(2)}s)\n`);

    if (result.breakdown) {
      console.log('📈 Breakdown:');
      console.log(`   Check In Only:  ${result.breakdown.checkInOnly} (HIGH priority)`);
      console.log(`   Check Out Only: ${result.breakdown.checkOutOnly} (MEDIUM priority)`);
      console.log(`   Unknown:        ${result.breakdown.unknown} (LOW priority)\n`);
    }

    console.log('🚀 Next Steps:');
    console.log('   1. Verify data: SELECT * FROM audit_sync LIMIT 10;');
    console.log('   2. Check stats: SELECT * FROM v_audit_summary LIMIT 10;');
    console.log('   3. Test report: POST /api/reports/audit with {"from_date": "2025-01-01", "to_date": "2025-01-10", "grouping": "punch"}');
    console.log('   4. Add to manual sync page: Add button in ManualSync.jsx');
    console.log('');

  } catch (error) {
    console.error('\n❌ Initial sync failed:', error);
    process.exit(1);
  }
};

// Run
runInitialSync()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
