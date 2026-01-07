/**
 * Manual script to run emp_index_list sync
 * 
 * This script manually triggers the emp_index_list synchronization
 * which combines data from divisions_sync, sections_sync, sub_sections,
 * and employees_sync (active only) into a single indexed table.
 * 
 * Usage: node scripts/run_emp_index_sync.js
 */

const { syncEmpIndex } = require('../services/empIndexSyncService');

const runSync = async () => {
  console.log('🚀 Starting manual emp_index_list sync...');
  console.log('─'.repeat(50));
  
  const startTime = new Date();
  
  try {
    const result = await syncEmpIndex();
    
    const endTime = new Date();
    const duration = Math.floor((endTime - startTime) / 1000);
    
    console.log('─'.repeat(50));
    console.log('✅ Sync completed successfully!');
    console.log(`   Duration: ${duration}s`);
    console.log(`   Inserted: ${result.inserted || 0} new records`);
    console.log(`   Updated: ${result.updated || 0} existing records`);
    console.log('─'.repeat(50));
    
    process.exit(0);
  } catch (error) {
    console.error('─'.repeat(50));
    console.error('❌ Sync failed:', error.message);
    console.error('─'.repeat(50));
    process.exit(1);
  }
};

// Run the sync
runSync();
