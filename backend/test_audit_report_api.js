const axios = require('axios');

async function testAuditReport() {
  console.log('\n=== TESTING AUDIT REPORT API ===\n');
  
  // You'll need a valid token - using a test token or login first
  // For now, let's test without auth to see the response
  
  const testCases = [
    {
      name: 'Test 1: Punch Type Grouping (F1 only)',
      payload: {
        from_date: '2026-01-26',
        to_date: '2026-01-26',
        division_id: 'Information Systems',
        section_id: 'Information Systems  - ( IS )',
        grouping: 'punch'
      }
    },
    {
      name: 'Test 2: No Grouping',
      payload: {
        from_date: '2026-01-26',
        to_date: '2026-01-26',
        division_id: 'Information Systems',
        section_id: 'Information Systems  - ( IS )',
        grouping: 'none'
      }
    },
    {
      name: 'Test 3: Division only (no section filter)',
      payload: {
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
    console.log('Request Payload:', JSON.stringify(test.payload, null, 2));
    
    try {
      const response = await axios.post(
        'http://localhost:5000/api/reports/mysql/audit',
        test.payload,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      console.log('\n✅ Response Status:', response.status);
      console.log('📊 Results:');
      console.log(`   Total Records: ${response.data.summary?.totalRecords || 0}`);
      console.log(`   Total Employees: ${response.data.summary?.totalEmployees || 0}`);
      console.log(`   Total Groups: ${response.data.summary?.totalGroups || 0}`);
      
      if (response.data.data && response.data.data.length > 0) {
        response.data.data.forEach((group, idx) => {
          console.log(`\n   Group ${idx + 1}: ${group.groupName}`);
          console.log(`      Count: ${group.count}`);
          console.log(`      Total Issues: ${group.totalIssues}`);
          
          // Check if employee 448225 is in this group
          const found448225 = group.employees?.find(e => e.employeeId === '448225');
          if (found448225) {
            console.log(`      ✅ Employee 448225 FOUND!`);
            console.log(`         Name: ${found448225.employeeName}`);
            console.log(`         Designation: ${found448225.designation}`);
            if (found448225.eventDate) {
              console.log(`         Event Date: ${found448225.eventDate}`);
              console.log(`         Event Time: ${found448225.eventTime}`);
            }
          } else {
            console.log(`      ❌ Employee 448225 NOT in this group`);
          }
        });
      } else {
        console.log('   ⚠️ No data returned');
      }
      
    } catch (error) {
      if (error.response) {
        console.log('\n❌ API Error Response:');
        console.log(`   Status: ${error.response.status}`);
        console.log(`   Message: ${error.response.data?.message || 'Unknown error'}`);
        console.log(`   Details:`, error.response.data);
      } else if (error.request) {
        console.log('\n❌ No response received from server');
        console.log('   Is the server running on port 5000?');
      } else {
        console.log('\n❌ Error:', error.message);
      }
    }
  }
  
  console.log(`\n${'='.repeat(80)}\n`);
}

testAuditReport().catch(console.error);
