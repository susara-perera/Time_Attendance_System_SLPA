/**
 * Day-by-Day Audit Sync Test
 * Syncs audit data one day at a time and shows results
 */

const axios = require('axios');
const moment = require('moment');

const BASE_URL = 'http://localhost:5000/api';

async function login() {
  try {
    const response = await axios.post(`${BASE_URL}/auth/login`, {
       email: 'lalinda@slpa.lk',
      password: 'slpa@123'
    });
    
    if (response.data.success && response.data.token) {
      console.log('✅ Logged in successfully\n');
      return response.data.token;
    } else {
      console.error('❌ Login failed');
      return null;
    }
  } catch (error) {
    console.error('❌ Login error:', error.response?.data || error.message);
    return null;
  }
}

async function syncOneDay(token, date, divisionId, sectionId) {
  try {
    const response = await axios.post(
      `${BASE_URL}/sync/trigger/audit`,
      {
        from_date: date,
        to_date: date,
        ...(divisionId && { division_id: divisionId }),
        ...(sectionId && { section_id: sectionId })
      },
      {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 30000 // 30 second timeout - faster
      }
    );
    
    return response.data;
  } catch (error) {
    const errorMsg = error.response?.data?.error || error.response?.data?.message || error.message;
    console.error(`   ❌ Error: ${errorMsg}`);
    return null;
  }
}

async function checkAuditSyncTable(token) {
  try {
    const response = await axios.post(
      `${BASE_URL}/reports/audit`,
      {
        from_date: '2024-12-01',
        to_date: '2026-01-01',
        grouping: 'punch',
        division_id: '66',
        section_id: '333',
        use_optimized: true
      },
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('❌ Query error:', error.response?.data || error.message);
    return null;
  }
}

async function runDayByDaySync() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║           DAY-BY-DAY AUDIT SYNC TEST                         ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  // Login
  const token = await login();
  if (!token) {
    console.error('Failed to login. Exiting...');
    process.exit(1);
  }
  
  const startDate = '2025-10-01'; // User's requested start date
  const endDate = '2026-01-01'; // User's requested end date
  const divisionId = null; // Remove filters to sync ALL data
  const sectionId = null;
  
  console.log('📋 Sync Configuration:');
  console.log(`   Division: ${divisionId || 'All (no filter)'}`);
  console.log(`   Section: ${sectionId || 'All (no filter)'}`);
  console.log(`   Date Range: ${startDate} to ${endDate}`);
  console.log('\n' + '─'.repeat(70) + '\n');
  
  let totalRecords = 0;
  let daysWithIssues = 0;
  let daysWithoutIssues = 0;
  
  // Generate array of dates
  const dates = [];
  let currentDate = moment(startDate);
  const end = moment(endDate);
  
  while (currentDate.isSameOrBefore(end)) {
    dates.push(currentDate.format('YYYY-MM-DD'));
    currentDate.add(1, 'day');
  }
  
  console.log(`🔄 Processing ${dates.length} days...\n`);
  
  // Process each day
  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    const dayOfWeek = moment(date).format('dddd');
    
    console.log(`📅 Day ${i + 1}/${dates.length}: ${date} (${dayOfWeek})`);
    
    const result = await syncOneDay(token, date, divisionId, sectionId);
    
    if (result && result.success) {
      const synced = result.data?.recordsSynced || 0;
      totalRecords += synced;
      
      if (synced > 0) {
        daysWithIssues++;
        console.log(`   ✅ Found ${synced} incomplete punch(es)`);
        
        if (result.data?.breakdown) {
          const b = result.data.breakdown;
          if (b.checkInOnly > 0) console.log(`      - Check In Only: ${b.checkInOnly}`);
          if (b.checkOutOnly > 0) console.log(`      - Check Out Only: ${b.checkOutOnly}`);
          if (b.unknown > 0) console.log(`      - Unknown: ${b.unknown}`);
        }
      } else {
        daysWithoutIssues++;
        console.log(`   ℹ️  No incomplete punches found`);
      }
    } else {
      console.log(`   ⚠️  Sync failed or returned no data`);
    }
    
    console.log('');
    
    // Small delay to avoid overwhelming the server
    if (i < dates.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  console.log('\n' + '═'.repeat(70));
  console.log('\n📊 SUMMARY:');
  console.log(`   Total Days Processed: ${dates.length}`);
  console.log(`   Days with Issues: ${daysWithIssues}`);
  console.log(`   Days without Issues: ${daysWithoutIssues}`);
  console.log(`   Total Records Synced: ${totalRecords}`);
  console.log('\n' + '═'.repeat(70) + '\n');
  
  if (totalRecords > 0) {
    console.log('🔍 Querying audit_sync table to verify...\n');
    
    const reportData = await checkAuditSyncTable(token);
    
    if (reportData && reportData.success) {
      console.log('✅ Query successful!');
      console.log(`   Total Records in audit_sync: ${reportData.summary?.totalRecords || 0}`);
      console.log(`   Total Employees: ${reportData.summary?.totalEmployees || 0}`);
      console.log(`   Groups: ${reportData.summary?.totalGroups || 0}`);
      
      if (reportData.data && reportData.data.length > 0) {
        console.log('\n📋 Issue Breakdown:');
        reportData.data.forEach(group => {
          console.log(`   ${group.groupName}: ${group.count} employees (${group.severity})`);
        });
      }
    } else {
      console.log('⚠️  Query failed - table might be empty');
    }
  } else {
    console.log('⚠️  No records were synced. Possible reasons:');
    console.log('   1. No incomplete punches exist for the selected filters');
    console.log('   2. Division ID or Section ID might be incorrect');
    console.log('   3. Employees in that section had complete attendance');
    console.log('   4. No attendance data exists for those dates\n');
    
    console.log('💡 Suggestions:');
    console.log('   - Try syncing without filters (remove division_id/section_id)');
    console.log('   - Check if attendance table has data for these dates');
    console.log('   - Verify division_id=66 and section_id=333 exist in your database');
  }
}

// Run the test
runDayByDaySync().catch(error => {
  console.error('\n❌ Unexpected error:', error);
  process.exit(1);
});
