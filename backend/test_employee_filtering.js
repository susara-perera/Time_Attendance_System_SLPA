const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';

// Test specific filtering scenarios for Employee Management
async function testEmployeeFiltering() {
  console.log('🧪 Testing Employee Management Filtering...\n');

  try {
    // First, get a token
    console.log('1. Getting authentication token...');
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: 'admin@example.com',
      password: 'password123'
    });

    if (!loginResponse.data.success) {
      console.log('❌ Login failed, trying with test token...');
      return await testWithoutAuth();
    }

    const token = loginResponse.data.token;
    const headers = { 'Authorization': `Bearer ${token}` };

    console.log('✅ Got token, proceeding with authenticated tests...\n');

    // Test 1: Check if there are any employees with division codes
    console.log('2. Checking for employees with division codes...');
    try {
      const allResponse = await axios.get(`${API_BASE}/mysql-data/employees?limit=1000`, { headers });
      const employees = allResponse.data.data || [];

      const withDivCode = employees.filter(e => e.DIV_CODE && e.DIV_CODE.trim());
      const withSecCode = employees.filter(e => e.SEC_CODE && e.SEC_CODE.trim());

      console.log(`   Total employees: ${employees.length}`);
      console.log(`   With DIV_CODE: ${withDivCode.length}`);
      console.log(`   With SEC_CODE: ${withSecCode.length}`);

      if (withDivCode.length > 0) {
        console.log('   Sample DIV_CODE values:', [...new Set(withDivCode.slice(0, 5).map(e => e.DIV_CODE))]);
      }
      if (withSecCode.length > 0) {
        console.log('   Sample SEC_CODE values:', [...new Set(withSecCode.slice(0, 5).map(e => e.SEC_CODE))]);
      }

      // Test 2: Try filtering by a division code if available
      if (withDivCode.length > 0) {
        const testDivCode = withDivCode[0].DIV_CODE;
        console.log(`\n3. Testing division filter with DIV_CODE: ${testDivCode}...`);
        const divFilterResponse = await axios.get(`${API_BASE}/mysql-data/employees?divisionCode=${testDivCode}&limit=10`, { headers });
        console.log('✅ Division filter response:', {
          success: divFilterResponse.data.success,
          count: divFilterResponse.data.data?.length || 0,
          source: divFilterResponse.data.source
        });
        if (divFilterResponse.data.data && divFilterResponse.data.data.length > 0) {
          console.log('   Sample filtered employee:', {
            EMP_NO: divFilterResponse.data.data[0].EMP_NO,
            EMP_NAME: divFilterResponse.data.data[0].EMP_NAME,
            DIV_CODE: divFilterResponse.data.data[0].DIV_CODE
          });
        }
      }

      // Test 3: Try filtering by a section code if available
      if (withSecCode.length > 0) {
        const testSecCode = withSecCode[0].SEC_CODE;
        console.log(`\n4. Testing section filter with SEC_CODE: ${testSecCode}...`);
        const secFilterResponse = await axios.get(`${API_BASE}/mysql-data/employees?sectionCode=${testSecCode}&limit=10`, { headers });
        console.log('✅ Section filter response:', {
          success: secFilterResponse.data.success,
          count: secFilterResponse.data.data?.length || 0,
          source: secFilterResponse.data.source
        });
        if (secFilterResponse.data.data && secFilterResponse.data.data.length > 0) {
          console.log('   Sample filtered employee:', {
            EMP_NO: secFilterResponse.data.data[0].EMP_NO,
            EMP_NAME: secFilterResponse.data.data[0].EMP_NAME,
            SEC_CODE: secFilterResponse.data.data[0].SEC_CODE
          });
        }
      }

    } catch (err) {
      console.log('❌ Employee data check error:', err.response?.status, err.response?.data?.message || err.message);
    }

    // Test 4: Test sub-section transfer endpoint
    console.log('\n5. Testing sub-section transfer endpoints...');
    try {
      // First get all transfers
      const allTransfersResponse = await axios.get(`${API_BASE}/mysql-subsections/transferred/all/list`, { headers });
      console.log('✅ All transfers response:', {
        success: allTransfersResponse.data.success,
        count: allTransfersResponse.data.data?.length || 0
      });

      if (allTransfersResponse.data.data && allTransfersResponse.data.data.length > 0) {
        const testTransfer = allTransfersResponse.data.data[0];
        console.log('   Sample transfer:', {
          employeeId: testTransfer.employeeId,
          employeeName: testTransfer.employeeName,
          sub_section_id: testTransfer.sub_section_id
        });

        // Test specific sub-section transfers
        console.log(`\n6. Testing transfers for sub-section: ${testTransfer.sub_section_id}...`);
        const subSecTransfersResponse = await axios.get(`${API_BASE}/mysql-subsections/transferred/${testTransfer.sub_section_id}`, { headers });
        console.log('✅ Sub-section transfers response:', {
          success: subSecTransfersResponse.data.success,
          count: subSecTransfersResponse.data.data?.length || 0
        });
      } else {
        console.log('   No transfers found in the system');
      }
    } catch (err) {
      console.log('❌ Sub-section transfer test error:', err.response?.status, err.response?.data?.message || err.message);
    }

    // Test 5: Test search functionality
    console.log('\n7. Testing search functionality...');
    try {
      const searchResponse = await axios.get(`${API_BASE}/mysql-data/employees?search=EMP_176763&limit=5`, { headers });
      console.log('✅ Search response:', {
        success: searchResponse.data.success,
        count: searchResponse.data.data?.length || 0,
        source: searchResponse.data.source
      });
    } catch (err) {
      console.log('❌ Search test error:', err.response?.status, err.response?.data?.message || err.message);
    }

  } catch (err) {
    console.log('❌ Authentication error:', err.response?.status, err.response?.data?.message || err.message);
    return await testWithoutAuth();
  }
}

async function testWithoutAuth() {
  console.log('\n🔄 Testing without authentication...\n');

  try {
    console.log('Testing /mysql-data/employees without auth...');
    const response = await axios.get(`${API_BASE}/mysql-data/employees?limit=1`);
    console.log('✅ No-auth response:', response.data);
  } catch (err) {
    console.log('❌ No-auth test:', err.response?.status, err.response?.data?.message || err.message);
  }
}

testEmployeeFiltering().then(() => {
  console.log('\n✅ Employee filtering tests completed!');
}).catch(err => {
  console.error('❌ Test failed:', err.message);
});