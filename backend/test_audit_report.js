/**
 * Test Audit Report API
 * Tests the audit report endpoint with specific parameters:
 * - Division: 66
 * - Section: 333
 * - Grouping: punch (F1-0)
 * - Date Range: 2025-12-01 to 2026-01-01
 */

const http = require('http');

// Step 1: Login to get token
function login() {
  return new Promise((resolve, reject) => {
    const loginData = JSON.stringify({
      email: 'lalinda@slpa.lk',
      password: 'slpa@123'
    });

    const loginOptions = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(loginData)
      }
    };

    const req = http.request(loginOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          console.log('Login response:', jsonData);
          if (jsonData.token) {
            resolve(jsonData.token);
          } else {
            reject(new Error('No token received from login. Response: ' + JSON.stringify(jsonData)));
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.write(loginData);
    req.end();
  });
}

// Step 2: Test audit report with token
async function testAuditReport() {
  try {
    console.log('🔐 Logging in...');
    const token = await login();
    console.log('✅ Token received');
    console.log('');

    const postData = JSON.stringify({
      from_date: '2025-12-01',
      to_date: '2026-01-01',
      division_id: '66',
      section_id: '333',
      grouping: 'punch'
    });

    const options = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/reports/mysql/audit',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    console.log('📊 Testing Audit Report API');
    console.log('=' .repeat(60));
    console.log('Parameters:');
    console.log('  - Division ID: 66');
    console.log('  - Section ID: 333');
    console.log('  - Grouping: punch (F1-0 - Punch Type)');
    console.log('  - Date Range: 2025-12-01 to 2026-01-01');
    console.log('=' .repeat(60));
    console.log('');

    const req = http.request(options, (res) => {
      let data = '';

      console.log(`Status Code: ${res.statusCode}`);
      console.log('');

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          
          console.log('✅ Response received successfully!');
          console.log('');
          console.log('📈 Summary:');
          if (jsonData.summary) {
            console.log(`  - Total Employees: ${jsonData.summary.totalEmployees || 0}`);
            console.log(`  - Total Groups: ${jsonData.summary.totalGroups || 0}`);
            console.log(`  - Total Records: ${jsonData.summary.totalRecords || 0}`);
            if (jsonData.summary.filterDescription) {
              console.log(`  - Filters: ${jsonData.summary.filterDescription}`);
            }
            if (jsonData.summary.issueBreakdown) {
              console.log('');
              console.log('🔍 Issue Breakdown:');
              console.log(`  - Check In Only: ${jsonData.summary.issueBreakdown.checkInOnly || 0}`);
              console.log(`  - Check Out Only: ${jsonData.summary.issueBreakdown.checkOutOnly || 0}`);
              console.log(`  - Unknown: ${jsonData.summary.issueBreakdown.unknown || 0}`);
            }
          }
          
          console.log('');
          console.log('📊 Groups:');
          if (jsonData.data && jsonData.data.length > 0) {
            jsonData.data.forEach((group, index) => {
              console.log('');
              console.log(`  ${index + 1}. ${group.groupName || 'Unknown Group'}`);
              console.log(`     - Issue Type: ${group.issueType || 'N/A'}`);
              console.log(`     - Severity: ${group.severity || 'N/A'}`);
              console.log(`     - Count: ${group.count || 0}`);
              console.log(`     - Punch Type: ${group.punchType || 'N/A'}`);
              
              if (group.statistics) {
                if (group.statistics.byDesignation && Object.keys(group.statistics.byDesignation).length > 0) {
                  console.log(`     - By Designation:`);
                  Object.entries(group.statistics.byDesignation).slice(0, 3).forEach(([des, count]) => {
                    console.log(`       • ${des}: ${count}`);
                  });
                }
                if (group.statistics.byDivision && Object.keys(group.statistics.byDivision).length > 0) {
                  console.log(`     - By Division:`);
                  Object.entries(group.statistics.byDivision).slice(0, 3).forEach(([div, count]) => {
                    console.log(`       • ${div}: ${count}`);
                  });
                }
              }
              
              if (group.employees && group.employees.length > 0) {
                console.log(`     - Sample Employees (first 3):`);
                group.employees.slice(0, 3).forEach((emp, i) => {
                  console.log(`       ${i + 1}. ${emp.employeeName || 'Unknown'} (${emp.employeeId || 'N/A'})`);
                  console.log(`          Date: ${emp.eventDate}, Time: ${emp.eventTime}`);
                  console.log(`          Scan Type: ${emp.scanType} (Raw: ${emp.rawScanType})`);
                  console.log(`          Designation: ${emp.designation || 'N/A'}`);
                });
              }
            });
          } else {
            console.log('  No groups found or empty data array');
          }
          
          console.log('');
          console.log('=' .repeat(60));
          console.log('');
          console.log('📄 Full JSON Response:');
          console.log(JSON.stringify(jsonData, null, 2));
          
        } catch (error) {
          console.error('❌ Error parsing response:', error.message);
          console.log('Raw response:', data);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Request failed:', error.message);
      console.log('');
      console.log('⚠️  Make sure the backend server is running on port 5000');
      console.log('   Run: node server.js');
    });

    req.write(postData);
    req.end();

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run the test
testAuditReport();
