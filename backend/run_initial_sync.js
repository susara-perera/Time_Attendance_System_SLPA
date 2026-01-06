/**
 * Initial Sync Script
 * Run this once to populate the sync tables with HRIS data
 */

require('dotenv').config();
const { performFullSync } = require('./services/hrisSyncService');

console.log('');
console.log('╔════════════════════════════════════════════════════════╗');
console.log('║     HRIS to MySQL Initial Synchronization             ║');
console.log('╚════════════════════════════════════════════════════════╝');
console.log('');

async function runInitialSync() {
  try {
    console.log('🚀 Starting initial full sync...');
    console.log('⏳ This may take several minutes for 500,000+ records...');
    console.log('');

    const result = await performFullSync('initial_setup');

    console.log('');
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║              Sync Completed Successfully!             ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('📊 Summary:');
    console.log('─────────────────────────────────────────────────────────');
    
    if (result.divisions) {
      console.log(`  Divisions:`);
      console.log(`    ✅ Synced: ${result.divisions.recordsSynced || 0}`);
      console.log(`    ➕ Added: ${result.divisions.recordsAdded || 0}`);
      console.log(`    ♻️  Updated: ${result.divisions.recordsUpdated || 0}`);
      if (result.divisions.recordsFailed > 0) {
        console.log(`    ❌ Failed: ${result.divisions.recordsFailed}`);
      }
    }
    
    console.log('');
    
    if (result.sections) {
      console.log(`  Sections:`);
      console.log(`    ✅ Synced: ${result.sections.recordsSynced || 0}`);
      console.log(`    ➕ Added: ${result.sections.recordsAdded || 0}`);
      console.log(`    ♻️  Updated: ${result.sections.recordsUpdated || 0}`);
      if (result.sections.recordsFailed > 0) {
        console.log(`    ❌ Failed: ${result.sections.recordsFailed}`);
      }
    }
    
    console.log('');
    
    if (result.employees) {
      console.log(`  Employees:`);
      console.log(`    ✅ Synced: ${result.employees.recordsSynced || 0}`);
      console.log(`    ➕ Added: ${result.employees.recordsAdded || 0}`);
      console.log(`    ♻️  Updated: ${result.employees.recordsUpdated || 0}`);
      if (result.employees.recordsFailed > 0) {
        console.log(`    ❌ Failed: ${result.employees.recordsFailed}`);
      }
    }
    
    console.log('');
    console.log('─────────────────────────────────────────────────────────');
    console.log(`  ⏱️  Total Duration: ${result.overall.duration || 0} seconds`);
    console.log(`  📊 Total Records: ${result.overall.totalRecordsSynced || 0}`);
    console.log('─────────────────────────────────────────────────────────');
    console.log('');
    console.log('✅ Initial sync complete!');
    console.log('📅 Scheduled sync will run daily at 12:00 PM');
    console.log('');
    
    process.exit(0);
  } catch (error) {
    console.error('');
    console.error('╔════════════════════════════════════════════════════════╗');
    console.error('║                  Sync Failed!                          ║');
    console.error('╚════════════════════════════════════════════════════════╝');
    console.error('');
    console.error('❌ Error:', error.message);
    console.error('');
    console.error('Troubleshooting:');
    console.error('  1. Check HRIS API connectivity');
    console.error('  2. Verify MySQL database connection');
    console.error('  3. Check .env configuration');
    console.error('  4. Review server logs for details');
    console.error('');
    process.exit(1);
  }
}

runInitialSync();
