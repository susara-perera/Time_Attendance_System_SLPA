require('dotenv').config();
const { fetchAuditReport } = require('./models/auditModel');

async function testAuditReports() {
  console.log('🔍 Testing Audit Report Fixes\n');
  console.log('=' .repeat(60));

  const tests = [
    {
      name: 'Test 1: Punch Type Grouping (F1-0)',
      filters: {
        from_date: '2024-10-02',
        to_date: '2024-10-31',
        grouping: 'punch'
      }
    },
    {
      name: 'Test 2: Designation Wise Grouping',
      filters: {
        from_date: '2024-10-02',
        to_date: '2024-10-31',
        grouping: 'designation'
      }
    },
    {
      name: 'Test 3: No Grouping (Summary)',
      filters: {
        from_date: '2024-10-02',
        to_date: '2024-10-31',
        grouping: 'none'
      }
    },
    {
      name: 'Test 4: Punch Type with Division Filter',
      filters: {
        from_date: '2024-10-02',
        to_date: '2024-10-05',
        grouping: 'punch',
        division_id: 'All'
      }
    },
    {
      name: 'Test 5: Punch Type with Date Range (Single Day)',
      filters: {
        from_date: '2024-10-02',
        to_date: '2024-10-02',
        grouping: 'punch'
      }
    }
  ];

  for (const test of tests) {
    try {
      console.log(`\n✅ ${test.name}`);
      console.log('-'.repeat(60));
      
      const result = await fetchAuditReport(test.filters);
      
      console.log(`   Groups: ${result.data.length}`);
      console.log(`   Total Records: ${result.summary.totalRecords}`);
      console.log(`   Total Employees: ${result.summary.totalEmployees}`);
      console.log(`   Date Range: ${result.dateRange.from} to ${result.dateRange.to}`);
      
      if (result.data.length > 0) {
        const firstGroup = result.data[0];
        console.log(`   First Group: ${firstGroup.groupName}`);
        if (firstGroup.employees && firstGroup.employees.length > 0) {
          const emp = firstGroup.employees[0];
          console.log(`     Sample: ${emp.employeeName} (${emp.designation}) - ${emp.eventDate} ${emp.eventTime}`);
        }
      }
      
      console.log(`   ✓ PASSED`);
    } catch (err) {
      console.log(`   ✗ FAILED`);
      console.log(`   Error: ${err.message}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('🏁 Test Summary Complete\n');
  process.exit(0);
}

testAuditReports().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
