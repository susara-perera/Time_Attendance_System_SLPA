require('dotenv').config();
const { generateMySQLAuditReport } = require('./controllers/reportController');

async function test448225InReport() {
  console.log('\n=== TESTING IF 448225 APPEARS IN AUDIT REPORT ===\n');
  
  const testBody = {
    from_date: '2026-01-26',
    to_date: '2026-01-26',
    division_id: 'Information Systems',
    section_id: 'Information Systems  - ( IS )',
    grouping: 'punch'
  };
  
  console.log('Request:', JSON.stringify(testBody, null, 2));
  
  const req = { body: testBody };
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
    console.log(`   Cached: ${responseData.cached || false}`);
    
    // Search for employee 448225
    let found = false;
    if (responseData.data && responseData.data.length > 0) {
      for (const group of responseData.data) {
        const emp448225 = group.employees?.find(e => e.employeeId === '448225');
        if (emp448225) {
          found = true;
          console.log('\n✅✅✅ EMPLOYEE 448225 FOUND IN REPORT! ✅✅✅');
          console.log(`   Group: ${group.groupName}`);
          console.log(`   Name: ${emp448225.employeeName}`);
          console.log(`   Designation: ${emp448225.designation}`);
          console.log(`   Division: ${emp448225.divisionName}`);
          console.log(`   Section: ${emp448225.sectionName}`);
          console.log(`   Event Date: ${emp448225.eventDate}`);
          console.log(`   Event Time: ${emp448225.eventTime}`);
          console.log(`   Punch Type: ${emp448225.punchType}`);
          break;
        }
      }
    }
    
    if (!found) {
      console.log('\n❌ EMPLOYEE 448225 NOT FOUND IN REPORT');
      console.log('\n🔍 Debugging Info:');
      console.log(`   Groups returned: ${responseData.data?.length || 0}`);
      
      if (responseData.data && responseData.data.length > 0) {
        responseData.data.forEach((group, idx) => {
          console.log(`\n   Group ${idx + 1}: ${group.groupName}`);
          console.log(`      Total employees: ${group.count}`);
          console.log(`      Sample employees (first 3):`);
          group.employees?.slice(0, 3).forEach(e => {
            console.log(`         - ${e.employeeId}: ${e.employeeName}`);
          });
        });
      }
    }
    
  } catch (error) {
    console.log('\n❌ Error:', error.message);
    console.log('Stack:', error.stack);
  }
  
  process.exit(0);
}

test448225InReport().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
