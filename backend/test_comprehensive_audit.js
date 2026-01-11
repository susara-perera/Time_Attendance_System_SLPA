#!/usr/bin/env node

/**
 * Comprehensive Audit Report Testing
 * Tests all grouping modes and filters directly without API
 */

require('dotenv').config();
const { fetchAuditReport } = require('./models/auditModel');

async function runTests() {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 COMPREHENSIVE AUDIT REPORT TESTING');
  console.log('='.repeat(80) + '\n');

  const testCases = [
    {
      id: 1,
      name: 'Punch Type Grouping (F1-0) - October 2024',
      filters: {
        from_date: '2024-10-02',
        to_date: '2024-10-31',
        grouping: 'punch'
      },
      expectedGroups: 'Should have IN and OUT punch groups'
    },
    {
      id: 2,
      name: 'Designation Wise Grouping - October 2024',
      filters: {
        from_date: '2024-10-02',
        to_date: '2024-10-31',
        grouping: 'designation'
      },
      expectedGroups: 'Should group by employee designation'
    },
    {
      id: 3,
      name: 'No Grouping (Summary) - October 2024',
      filters: {
        from_date: '2024-10-02',
        to_date: '2024-10-31',
        grouping: 'none'
      },
      expectedGroups: 'Should show employee punch count summary'
    },
    {
      id: 4,
      name: 'Punch Type with Date Range (3 days)',
      filters: {
        from_date: '2024-10-03',
        to_date: '2024-10-05',
        grouping: 'punch'
      },
      expectedGroups: 'Should return punches for 3-day period'
    },
    {
      id: 5,
      name: 'Punch Type (Single Day)',
      filters: {
        from_date: '2024-10-03',
        to_date: '2024-10-03',
        grouping: 'punch'
      },
      expectedGroups: 'Should return punches for single day only'
    },
    {
      id: 6,
      name: 'Designation Wise with Narrow Date Range',
      filters: {
        from_date: '2024-10-03',
        to_date: '2024-10-10',
        grouping: 'designation'
      },
      expectedGroups: 'Should group by designation for week'
    },
    {
      id: 7,
      name: 'No Grouping with Date Range',
      filters: {
        from_date: '2024-10-03',
        to_date: '2024-10-31',
        grouping: 'none'
      },
      expectedGroups: 'Should show employee punch counts for month'
    }
  ];

  let passedCount = 0;
  let failedCount = 0;
  const results = [];

  for (const test of testCases) {
    const startTime = Date.now();
    try {
      console.log(`\n📋 Test ${test.id}: ${test.name}`);
      console.log('-'.repeat(80));
      console.log(`   Filters: ${JSON.stringify(test.filters)}`);
      console.log(`   Expected: ${test.expectedGroups}`);

      const result = await fetchAuditReport(test.filters);
      const duration = Date.now() - startTime;

      // Validate result structure
      if (!result || !result.data || !result.summary || !result.dateRange) {
        throw new Error('Invalid response structure');
      }

      const { data, summary, dateRange, grouping } = result;

      console.log(`\n   ✅ PASSED (${duration}ms)`);
      console.log(`   Results:`);
      console.log(`     • Groups: ${data.length}`);
      console.log(`     • Total Records: ${summary.totalRecords}`);
      console.log(`     • Total Employees: ${summary.totalEmployees}`);
      console.log(`     • Grouping Mode: ${grouping}`);
      console.log(`     • Date Range: ${dateRange.from} to ${dateRange.to}`);

      if (data.length > 0) {
        const firstGroup = data[0];
        console.log(`     • First Group: ${firstGroup.groupName}`);
        if (firstGroup.employees && firstGroup.employees.length > 0) {
          const emp = firstGroup.employees[0];
          console.log(`       - Sample Record: ${emp.employeeName} (${emp.employeeId}) - ${emp.scanType}`);
          console.log(`         Date: ${emp.eventDate}, Time: ${emp.eventTime}`);
        }
      }

      passedCount++;
      results.push({
        test: test.id,
        name: test.name,
        status: 'PASSED',
        duration,
        recordCount: summary.totalRecords,
        employeeCount: summary.totalEmployees,
        groupCount: data.length
      });

    } catch (err) {
      const duration = Date.now() - startTime;
      console.log(`\n   ❌ FAILED (${duration}ms)`);
      console.log(`   Error: ${err.message}`);
      console.log(`   Stack: ${err.stack?.split('\n').slice(0, 3).join(' ')}`);

      failedCount++;
      results.push({
        test: test.id,
        name: test.name,
        status: 'FAILED',
        duration,
        error: err.message
      });
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(80));
  console.log(`\n Total Tests: ${testCases.length}`);
  console.log(`✅ Passed: ${passedCount}`);
  console.log(`❌ Failed: ${failedCount}`);
  console.log(`   Success Rate: ${((passedCount / testCases.length) * 100).toFixed(1)}%\n`);

  console.log('Detailed Results:');
  console.log('-'.repeat(80));
  results.forEach(r => {
    const status = r.status === 'PASSED' ? '✅' : '❌';
    console.log(`${status} Test ${r.test}: ${r.name}`);
    if (r.status === 'PASSED') {
      console.log(`   Records: ${r.recordCount}, Employees: ${r.employeeCount}, Groups: ${r.groupCount}, Time: ${r.duration}ms`);
    } else {
      console.log(`   Error: ${r.error}`);
    }
  });

  console.log('\n' + '='.repeat(80));
  if (failedCount === 0) {
    console.log('🎉 ALL TESTS PASSED! Audit report functionality is working correctly.');
  } else {
    console.log(`⚠️  ${failedCount} test(s) failed. See details above.`);
  }
  console.log('='.repeat(80) + '\n');

  process.exit(failedCount > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('\n❌ Fatal Error:', err);
  process.exit(1);
});
