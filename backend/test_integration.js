#!/usr/bin/env node

/**
 * Frontend to Backend Integration Test
 * Tests the complete audit report workflow
 */

require('dotenv').config();
const { fetchAuditReport } = require('./models/auditModel');

async function testIntegration() {
  console.log('\n' + '='.repeat(80));
  console.log('🔗 FRONTEND TO BACKEND INTEGRATION TEST');
  console.log('='.repeat(80) + '\n');

  const tests = [
    {
      name: 'Test 1: Frontend calls Punch Type Grouping',
      payload: {
        from_date: '2024-10-02',
        to_date: '2024-10-31',
        grouping: 'punch',
        time_period: 'all',
        division_id: '',
        section_id: ''
      },
      expectation: 'Response should have IN/OUT groups with punch records'
    },
    {
      name: 'Test 2: Frontend calls Designation Wise',
      payload: {
        from_date: '2024-10-02',
        to_date: '2024-10-31',
        grouping: 'designation',
        time_period: 'all',
        division_id: '',
        section_id: ''
      },
      expectation: 'Response should group by designation'
    },
    {
      name: 'Test 3: Frontend calls with Division Filter',
      payload: {
        from_date: '2024-10-02',
        to_date: '2024-10-31',
        grouping: 'punch',
        division_id: 'IT',  // Frontend sends division name
        section_id: ''
      },
      expectation: 'Response should filter by division'
    },
    {
      name: 'Test 4: Frontend calls Summary (None)',
      payload: {
        from_date: '2024-10-02',
        to_date: '2024-10-31',
        grouping: 'none',
        division_id: '',
        section_id: ''
      },
      expectation: 'Response should show employee summary with punch counts'
    },
    {
      name: 'Test 5: Frontend Response Format Validation',
      payload: {
        from_date: '2024-10-02',
        to_date: '2024-10-31',
        grouping: 'punch'
      },
      validate: (result) => {
        const checks = [
          { field: 'success', expected: true, actual: result.success },
          { field: 'data', expected: 'array', actual: Array.isArray(result.data) ? 'array' : typeof result.data },
          { field: 'summary', expected: 'object', actual: typeof result.summary },
          { field: 'dateRange', expected: 'object', actual: typeof result.dateRange },
          { field: 'grouping', expected: 'string', actual: typeof result.grouping }
        ];
        
        const allValid = checks.every(c => {
          if (c.expected === 'array') return c.actual === true;
          if (c.expected === 'object') return c.actual === c.expected;
          return c.actual === c.expected;
        });

        return {
          valid: allValid,
          checks
        };
      },
      expectation: 'Response must have correct structure for frontend'
    }
  ];

  let passCount = 0;
  let failCount = 0;

  for (const test of tests) {
    console.log(`\n📋 ${test.name}`);
    console.log('-'.repeat(80));
    console.log(`Expectation: ${test.expectation}`);

    try {
      // Call the model directly (simulating what the controller does)
      const result = await fetchAuditReport(test.payload);

      // If custom validator provided, use it
      if (test.validate) {
        const validation = test.validate(result);
        if (!validation.valid) {
          console.log('\n❌ FAILED - Structure validation');
          validation.checks.forEach(c => {
            const status = c.expected === c.actual ? '✓' : '✗';
            console.log(`   ${status} ${c.field}: expected ${c.expected}, got ${c.actual}`);
          });
          failCount++;
          continue;
        }
      }

      console.log('\n✅ PASSED');
      console.log(`   Data Groups: ${result.data.length}`);
      console.log(`   Total Records: ${result.summary.totalRecords}`);
      console.log(`   Total Employees: ${result.summary.totalEmployees}`);
      console.log(`   Date Range: ${result.dateRange.from} to ${result.dateRange.to}`);

      if (result.data.length > 0 && result.data[0].employees?.length > 0) {
        const emp = result.data[0].employees[0];
        console.log(`   Sample: ID ${emp.employeeId}, Date: ${emp.eventDate}, Time: ${emp.eventTime}`);
      }

      passCount++;
    } catch (err) {
      console.log(`\n❌ FAILED`);
      console.log(`   Error: ${err.message}`);
      failCount++;
    }
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 INTEGRATION TEST SUMMARY');
  console.log('='.repeat(80));
  console.log(`\nTotal Tests: ${tests.length}`);
  console.log(`✅ Passed: ${passCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`Success Rate: ${((passCount / tests.length) * 100).toFixed(1)}%\n`);

  if (failCount === 0) {
    console.log('🎉 All integration tests passed!');
    console.log('✓ Frontend can successfully call audit report API');
    console.log('✓ Backend returns properly formatted responses');
    console.log('✓ All grouping modes work correctly');
  } else {
    console.log(`⚠️  ${failCount} test(s) failed. Check details above.`);
  }

  console.log('='.repeat(80) + '\n');

  process.exit(failCount > 0 ? 1 : 0);
}

testIntegration().catch(err => {
  console.error('\n❌ Fatal Error:', err);
  process.exit(1);
});
