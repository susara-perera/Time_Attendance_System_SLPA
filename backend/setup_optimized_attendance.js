/**
 * Setup Optimized Attendance System
 * 
 * Run this once to create the optimized table and sync initial data
 */

// Load environment variables
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { mysqlSequelize } = require('./config/mysql');
const optimizedSyncService = require('./services/optimizedAttendanceSyncService');

async function setup() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('🚀 OPTIMIZED ATTENDANCE SYSTEM SETUP');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  try {
    // Step 1: Create table
    console.log('📋 Step 1: Creating optimized attendance table...');
    const sqlFile = path.join(__dirname, 'config', 'createOptimizedAttendanceTable.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    // Split by semicolon and execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));
    
    for (const statement of statements) {
      if (statement.includes('SELECT') && statement.includes('status')) {
        // Skip the final SELECT status statement
        continue;
      }
      try {
        await mysqlSequelize.query(statement);
      } catch (err) {
        if (!err.message.includes('already exists')) {
          console.warn(`   ⚠️  Warning: ${err.message}`);
        }
      }
    }
    
    console.log('✅ Table created successfully!\n');
    
    // Step 2: Get table stats
    console.log('📊 Step 2: Checking table structure...');
    const [indexes] = await mysqlSequelize.query(`
      SHOW INDEXES FROM attendance_reports_optimized;
    `);
    console.log(`✅ Found ${indexes.length} indexes for optimized queries\n`);
    
    // Step 3: Sync initial data
    console.log('📋 Step 3: Syncing initial data (last 90 days)...');
    console.log('This may take a few minutes depending on data volume...\n');
    
    const stats = await optimizedSyncService.syncLastDays(90);
    
    // Step 4: Verify data
    console.log('\n📊 Step 4: Verifying synced data...');
    const tableStats = await optimizedSyncService.getTableStats();
    
    console.log('\n✅ SETUP COMPLETE!\n');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📊 TABLE STATISTICS:');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`Total Records: ${tableStats.total_records.toLocaleString()}`);
    console.log(`Total Divisions: ${tableStats.total_divisions}`);
    console.log(`Total Sections: ${tableStats.total_sections}`);
    console.log(`Total Employees: ${tableStats.total_employees}`);
    console.log(`Date Range: ${tableStats.earliest_date} to ${tableStats.latest_date}`);
    console.log(`Total Work Hours: ${tableStats.total_work_hours.toLocaleString()}`);
    console.log(`Avg Work Hours: ${tableStats.avg_work_hours}\n`);
    
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🎯 NEXT STEPS:');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('1. Test the new optimized reports:');
    console.log('   node test_optimized_reports.js\n');
    console.log('2. Schedule daily sync (add to cron or scheduler):');
    console.log('   optimizedSyncService.syncLastDays(1)\n');
    console.log('3. Use new report endpoints:');
    console.log('   GET /api/reports/optimized/group?groupBy=division&startDate=...\n');
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run setup
setup();
