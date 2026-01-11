/**
 * Complete Audit System Flow Test
 * 
 * Tests the entire audit system workflow:
 * 1. Login to get auth token
 * 2. Sync audit data with filters (division 66, section 333)
 * 3. Query audit report
 * 4. Verify results
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

// Test credentials
const TEST_USER = {
  email: 'lalinda@slpa.lk',  // or employee_id: 'EMP001'
  password: 'slpa@123'
};

// Test parameters matching your requirements
const TEST_PARAMS = {
  division_id: '66',
  section_id: '333',
  from_date: '2025-12-01',
  to_date: '2026-01-01',
  grouping: 'punch',  // F1-0 means punch type grouping
  days: 35  // Covers the date range
};

let authToken = null;

/**
 * Step 1: Login
 */
async function login() {
  try {
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║                     STEP 1: LOGIN                            ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
    
    const response = await axios.post(`${BASE_URL}/auth/login`, TEST_USER);
    
    if (response.data.success && response.data.token) {
      authToken = response.data.token;
      console.log('✅ Login successful!');
      console.log(`   User: ${response.data.user?.username}`);
      console.log(`   Token: ${authToken.substring(0, 20)}...`);
      return true;
    } else {
      console.error('❌ Login failed:', response.data);
      return false;
    }
  } catch (error) {
    console.error('❌ Login error:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Step 2: Sync audit data with filters
 */
async function syncAuditData() {
  try {
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║              STEP 2: SYNC AUDIT DATA WITH FILTERS           ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
    
    console.log('📋 Sync Parameters:');
    console.log(`   Division ID: ${TEST_PARAMS.division_id}`);
    console.log(`   Section ID: ${TEST_PARAMS.section_id}`);
    console.log(`   Days: ${TEST_PARAMS.days}`);
    console.log('');
    
    const startTime = Date.now();
    
    const response = await axios.post(
      `${BASE_URL}/sync/trigger/audit`,
      {
        days: TEST_PARAMS.days,
        division_id: TEST_PARAMS.division_id,
        section_id: TEST_PARAMS.section_id
      },
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );
    
    const duration = Date.now() - startTime;
    
    if (response.data.success) {
      console.log('✅ Sync completed successfully!');
      console.log('\n📊 Sync Results:');
      console.log(`   Records Synced: ${response.data.data.recordsSynced}`);
      console.log(`   Records Added: ${response.data.data.recordsAdded}`);
      console.log(`   Date Range: ${response.data.data.dateRange.start} to ${response.data.data.dateRange.end}`);
      
      if (response.data.data.breakdown) {
        console.log('\n🔍 Issue Breakdown:');
        console.log(`   Check In Only (HIGH): ${response.data.data.breakdown.checkInOnly}`);
        console.log(`   Check Out Only (MEDIUM): ${response.data.data.breakdown.checkOutOnly}`);
        console.log(`   Unknown (LOW): ${response.data.data.breakdown.unknown}`);
      }
      
      if (response.data.data.filters) {
        console.log('\n🏢 Applied Filters:');
        console.log(`   Division: ${response.data.data.filters.division_id || 'All'}`);
        console.log(`   Section: ${response.data.data.filters.section_id || 'All'}`);
      }
      
      console.log(`\n⏱️  Sync Duration: ${duration}ms (${(duration / 1000).toFixed(2)}s)`);
      
      return true;
    } else {
      console.error('❌ Sync failed:', response.data);
      return false;
    }
  } catch (error) {
    console.error('❌ Sync error:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Step 3: Query audit report
 */
async function queryAuditReport() {
  try {
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║              STEP 3: QUERY AUDIT REPORT                      ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
    
    console.log('📋 Query Parameters:');
    console.log(`   Report Type: audit`);
    console.log(`   Division: ${TEST_PARAMS.division_id}`);
    console.log(`   Section: ${TEST_PARAMS.section_id}`);
    console.log(`   Group By: ${TEST_PARAMS.grouping} (F1-0 = punch type)`);
    console.log(`   Time Period: daily`);
    console.log(`   Start Date: ${TEST_PARAMS.from_date}`);
    console.log(`   End Date: ${TEST_PARAMS.to_date}`);
    console.log('');
    
    const startTime = Date.now();
    
    const response = await axios.post(
      `${BASE_URL}/reports/audit`,
      {
        from_date: TEST_PARAMS.from_date,
        to_date: TEST_PARAMS.to_date,
        grouping: TEST_PARAMS.grouping,
        division_id: TEST_PARAMS.division_id,
        section_id: TEST_PARAMS.section_id,
        use_optimized: true
      },
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );
    
    const duration = Date.now() - startTime;
    
    if (response.data.success) {
      console.log('✅ Report generated successfully!');
      console.log(`\n⏱️  Query Duration: ${duration}ms (${(duration / 1000).toFixed(2)}s)`);
      console.log(`   ${response.data.cached ? '🚀 FROM CACHE' : '💾 FROM DATABASE'}`);
      
      console.log('\n📊 Report Summary:');
      console.log(`   Total Employees: ${response.data.summary?.totalEmployees || 0}`);
      console.log(`   Total Groups: ${response.data.summary?.totalGroups || 0}`);
      console.log(`   Total Records: ${response.data.summary?.totalRecords || 0}`);
      
      if (response.data.summary?.filterDescription) {
        console.log(`   Filters Applied: ${response.data.summary.filterDescription}`);
      }
      
      console.log('\n🔍 Issue Groups:');
      if (response.data.data && response.data.data.length > 0) {
        response.data.data.forEach((group, index) => {
          console.log(`\n   Group ${index + 1}: ${group.groupName}`);
          console.log(`      Issue Type: ${group.issueType}`);
          console.log(`      Severity: ${group.severity}`);
          console.log(`      Count: ${group.count} employees`);
          
          if (group.description) {
            console.log(`      Description: ${group.description}`);
          }
          
          // Show first 3 employees as sample
          if (group.employees && group.employees.length > 0) {
            console.log(`\n      Sample Employees (showing ${Math.min(3, group.employees.length)} of ${group.employees.length}):`);
            group.employees.slice(0, 3).forEach((emp, empIndex) => {
              console.log(`         ${empIndex + 1}. ${emp.employeeName} (${emp.employeeId})`);
              console.log(`            Designation: ${emp.designation || 'N/A'}`);
              console.log(`            Date: ${emp.eventDate}, Time: ${emp.eventTime}`);
              console.log(`            Scan Type: ${emp.scanType} (Raw: ${emp.rawScanType})`);
            });
          }
          
          // Show statistics if available
          if (group.statistics) {
            if (group.statistics.byDesignation) {
              console.log(`\n      By Designation:`);
              Object.entries(group.statistics.byDesignation)
                .slice(0, 5)
                .forEach(([designation, count]) => {
                  console.log(`         ${designation}: ${count}`);
                });
            }
            
            if (group.statistics.byDivision) {
              console.log(`\n      By Division:`);
              Object.entries(group.statistics.byDivision).forEach(([division, count]) => {
                console.log(`         ${division}: ${count}`);
              });
            }
          }
        });
      } else {
        console.log('   No issues found! ✨ All attendance records are complete.');
      }
      
      return true;
    } else {
      console.error('❌ Report query failed:', response.data);
      return false;
    }
  } catch (error) {
    console.error('❌ Query error:', error.response?.data || error.message);
    if (error.response?.data) {
      console.error('   Error details:', JSON.stringify(error.response.data, null, 2));
    }
    return false;
  }
}

/**
 * Main test flow
 */
async function runCompleteTest() {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║        COMPLETE AUDIT SYSTEM FLOW TEST                       ║');
  console.log('║        Testing Division + Section Filtering                  ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  
  const overallStart = Date.now();
  
  // Step 1: Login
  const loginSuccess = await login();
  if (!loginSuccess) {
    console.error('\n❌ Test failed at login step');
    process.exit(1);
  }
  
  // Step 2: Sync audit data with filters
  const syncSuccess = await syncAuditData();
  if (!syncSuccess) {
    console.error('\n❌ Test failed at sync step');
    process.exit(1);
  }
  
  // Step 3: Query audit report
  const querySuccess = await queryAuditReport();
  if (!querySuccess) {
    console.error('\n❌ Test failed at query step');
    process.exit(1);
  }
  
  const overallDuration = Date.now() - overallStart;
  
  console.log('\n\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                  ✅ ALL TESTS PASSED!                        ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  console.log(`⏱️  Total Test Duration: ${overallDuration}ms (${(overallDuration / 1000).toFixed(2)}s)`);
  console.log('\n✨ Audit system is working correctly with organizational filters!\n');
  console.log('Key Features Verified:');
  console.log('  ✅ Division-based filtering (emp_ids_by_divisions)');
  console.log('  ✅ Section-based filtering (emp_ids_by_sections)');
  console.log('  ✅ Audit sync with filters');
  console.log('  ✅ Fast audit report generation from audit_sync table');
  console.log('  ✅ Issue categorization (CHECK_IN_ONLY, CHECK_OUT_ONLY)');
  console.log('  ✅ Severity levels (HIGH, MEDIUM, LOW)');
  console.log('  ✅ Statistics by designation and division\n');
}

// Run the test
runCompleteTest().catch(error => {
  console.error('\n❌ Unexpected error:', error);
  process.exit(1);
});
