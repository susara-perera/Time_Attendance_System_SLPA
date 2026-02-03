require('dotenv').config();
const { generateMySQLAuditReport } = require('./controllers/reportController');

async function testAuditReportDirect() {
  console.log('\n=== TESTING AUDIT REPORT DIRECTLY ===\n');
  
  const testCases = [
    {
      name: 'Test 1: Punch Type Grouping (F1 only) - IS Division & Section',
      body: {
        from_date: '2026-01-26',
        to_date: '2026-01-26',
        division_id: 'Information Systems',
        section_id: 'Information Systems  - ( IS )',
        grouping: 'punch'
      }
    },
    {
      name: 'Test 2: No Grouping - IS Division & Section',
      body: {
        from_date: '2026-01-26',
        to_date: '2026-01-26',
        division_id: 'Information Systems',
        section_id: 'Information Systems  - ( IS )',
        grouping: 'none'
      }
    },
    {
      name: 'Test 3: Division only (no section filter)',
      body: {
        from_date: '2026-01-26',
        to_date: '2026-01-26',
        division_id: 'Information Systems',
        section_id: 'all',
        grouping: 'punch'
      }
    }
  ];

  for (const test of testCases) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`${test.name}`);
    console.log(`${'='.repeat(80)}`);
    console.log('Request Body:', JSON.stringify(test.body, null, 2));
    
    // Mock request and response objects
    const req = { body: test.body };
    let responseData = null;
    let statusCode = 200;
    
    const res = {
      status: function(code) {
        statusCode = code;
        return this;
      },
      json: function(data) {
        responseData = data;
        return this;
      }
    };
    
    try {
      await generateMySQLAuditReport(req, res);
      
      console.log('\n✅ Response Status:', statusCode);
      console.log('📊 Results:');
      console.log(`   Success: ${responseData.success}`);
      console.log(`   Total Records: ${responseData.summary?.totalRecords || 0}`);
      console.log(`   Total Employees: ${responseData.summary?.totalEmployees || 0}`);
      console.log(`   Total Groups: ${responseData.summary?.totalGroups || 0}`);
      console.log(`   Processing Time: ${responseData.processingTime || 'N/A'}ms`);
      
      if (responseData.data && responseData.data.length > 0) {
        responseData.data.forEach((group, idx) => {
          console.log(`\n   Group ${idx + 1}: ${group.groupName}`);
          console.log(`      Type: ${group.groupType}`);
          console.log(`      Count: ${group.count}`);
          console.log(`      Total Issues: ${group.totalIssues}`);
          
          // Check if employee 448225 is in this group
          const found448225 = group.employees?.find(e => e.employeeId === '448225');
          if (found448225) {
            console.log(`      \n      ✅✅✅ Employee 448225 FOUND! ✅✅✅`);
            console.log(`         Name: ${found448225.employeeName}`);
            console.log(`         Designation: ${found448225.designation}`);
            console.log(`         Division: ${found448225.divisionName}`);
            console.log(`         Section: ${found448225.sectionName}`);
            if (found448225.eventDate) {
              console.log(`         Event Date: ${found448225.eventDate}`);
              console.log(`         Event Time: ${found448225.eventTime}`);
              console.log(`         Punch Type: ${found448225.punchType}`);
            }
            if (found448225.issueCount) {
              console.log(`         Issue Count: ${found448225.issueCount}`);
            }
          } else {
            console.log(`      ❌ Employee 448225 NOT in this group`);
            
            // Show first few employees for debugging
            if (group.employees && group.employees.length > 0) {
              console.log(`\n      Sample employees in this group (first 3):`);
              group.employees.slice(0, 3).forEach((emp, i) => {
                console.log(`         ${i + 1}. ${emp.employeeId} - ${emp.employeeName}`);
              });
            }
          }
        });
      } else {
        console.log('   ⚠️ No data returned');
      }
      
    } catch (error) {
      console.log('\n❌ Error:', error.message);
      console.log('Stack:', error.stack);
    }
  }
  
  console.log(`\n${'='.repeat(80)}\n`);
  process.exit(0);
}

testAuditReportDirect().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
