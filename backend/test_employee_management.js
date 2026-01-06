const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';

// Test MySQL employee endpoints for Employee Management
async function testEmployeeManagementEndpoints() {
  console.log('🧪 Testing Employee Management Endpoints...\n');

  try {
    // First, get a token (assuming login endpoint exists)
    console.log('1. Getting authentication token...');
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: 'admin@example.com', // Adjust based on your test user
      password: 'password123'
    });

    if (!loginResponse.data.success) {
      console.log('❌ Login failed, using test token approach...');
      // Try without auth for basic testing
      return await testWithoutAuth();
    }

    const token = loginResponse.data.token;
    const headers = { 'Authorization': `Bearer ${token}` };

    console.log('✅ Got token, proceeding with authenticated tests...\n');

    // Test 1: Get all employees (no filters)
    console.log('2. Testing /mysql-data/employees (all employees)...');
    try {
      const allResponse = await axios.get(`${API_BASE}/mysql-data/employees?limit=5`, { headers });
      console.log('✅ All employees response:', {
        success: allResponse.data.success,
        count: allResponse.data.data?.length || 0,
        total: allResponse.data.total || 'unknown',
        source: allResponse.data.source
      });
      if (allResponse.data.data && allResponse.data.data.length > 0) {
        console.log('   Sample employee:', {
          EMP_NO: allResponse.data.data[0].EMP_NO,
          EMP_NAME: allResponse.data.data[0].EMP_NAME,
          DIV_CODE: allResponse.data.data[0].DIV_CODE,
          SEC_CODE: allResponse.data.data[0].SEC_CODE
        });
      }
    } catch (err) {
      console.log('❌ All employees error:', err.response?.status, err.response?.data?.message || err.message);
    }

    // Test 2: Get divisions first to test division filtering
    console.log('\n3. Getting divisions for filtering tests...');
    try {
      const divResponse = await axios.get(`${API_BASE}/divisions/hris`, { headers });
      if (divResponse.data.success && divResponse.data.data.length > 0) {
        const testDivision = divResponse.data.data[0];
        console.log(`   Using division: ${testDivision.name} (code: ${testDivision.code})`);

        // Test 2a: Filter by division
        console.log('\n4. Testing /mysql-data/employees (division filter)...');
        const divFilterResponse = await axios.get(`${API_BASE}/mysql-data/employees?divisionCode=${testDivision.code}&limit=5`, { headers });
        console.log('✅ Division filter response:', {
          success: divFilterResponse.data.success,
          count: divFilterResponse.data.data?.length || 0,
          source: divFilterResponse.data.source
        });
        if (divFilterResponse.data.data && divFilterResponse.data.data.length > 0) {
          console.log('   Sample employee:', {
            EMP_NO: divFilterResponse.data.data[0].EMP_NO,
            EMP_NAME: divFilterResponse.data.data[0].EMP_NAME,
            DIV_CODE: divFilterResponse.data.data[0].DIV_CODE
          });
        }
      }
    } catch (err) {
      console.log('❌ Division test error:', err.response?.status, err.response?.data?.message || err.message);
    }

    // Test 3: Get sections for section filtering
    console.log('\n5. Getting sections for filtering tests...');
    try {
      const secResponse = await axios.get(`${API_BASE}/sections/hris`, { headers });
      if (secResponse.data.success && secResponse.data.data.length > 0) {
        const testSection = secResponse.data.data[0];
        console.log(`   Using section: ${testSection.name} (code: ${testSection.code})`);

        // Test 3a: Filter by section
        console.log('\n6. Testing /mysql-data/employees (section filter)...');
        const secFilterResponse = await axios.get(`${API_BASE}/mysql-data/employees?sectionCode=${testSection.code}&limit=5`, { headers });
        console.log('✅ Section filter response:', {
          success: secFilterResponse.data.success,
          count: secFilterResponse.data.data?.length || 0,
          source: secFilterResponse.data.source
        });
        if (secFilterResponse.data.data && secFilterResponse.data.data.length > 0) {
          console.log('   Sample employee:', {
            EMP_NO: secFilterResponse.data.data[0].EMP_NO,
            EMP_NAME: secFilterResponse.data.data[0].EMP_NAME,
            SEC_CODE: secFilterResponse.data.data[0].SEC_CODE
          });
        }
      }
    } catch (err) {
      console.log('❌ Section test error:', err.response?.status, err.response?.data?.message || err.message);
    }

    // Test 4: Test sub-section transfers
    console.log('\n7. Testing sub-section transfer endpoints...');
    try {
      // First get sub-sections
      const subSecResponse = await axios.get(`${API_BASE}/mysql-subsections`, { headers });
      if (subSecResponse.data.success && subSecResponse.data.data.length > 0) {
        const testSubSection = subSecResponse.data.data[0];
        console.log(`   Using sub-section ID: ${testSubSection._id}`);

        // Test 4a: Get transferred employees for sub-section
        console.log('\n8. Testing /mysql-subsections/transferred/:id...');
        const transferResponse = await axios.get(`${API_BASE}/mysql-subsections/transferred/${testSubSection._id}`, { headers });
        console.log('✅ Sub-section transfers response:', {
          success: transferResponse.data.success,
          count: transferResponse.data.data?.length || 0
        });
        if (transferResponse.data.data && transferResponse.data.data.length > 0) {
          console.log('   Sample transfer:', {
            employeeId: transferResponse.data.data[0].employeeId,
            employeeName: transferResponse.data.data[0].employeeName,
            sub_section_id: transferResponse.data.data[0].sub_section_id
          });
        }
      }
    } catch (err) {
      console.log('❌ Sub-section test error:', err.response?.status, err.response?.data?.message || err.message);
    }

    // Test 5: Test search functionality
    console.log('\n9. Testing search functionality...');
    try {
      const searchResponse = await axios.get(`${API_BASE}/mysql-data/employees?search=test&limit=3`, { headers });
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
  console.log('\n🔄 Testing without authentication (may fail for protected endpoints)...\n');

  // Test basic endpoints that might not require auth
  try {
    console.log('Testing /mysql-data/employees without auth...');
    const response = await axios.get(`${API_BASE}/mysql-data/employees?limit=1`);
    console.log('✅ No-auth response:', response.data);
  } catch (err) {
    console.log('❌ No-auth test:', err.response?.status, err.response?.data?.message || err.message);
  }
}

testEmployeeManagementEndpoints().then(() => {
  console.log('\n✅ Employee Management endpoint testing completed!');
}).catch(err => {
  console.error('❌ Test failed:', err.message);
});