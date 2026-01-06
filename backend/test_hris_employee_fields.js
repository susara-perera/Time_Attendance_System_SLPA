const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';

// Test HRIS API employee data structure
async function testHrisEmployeeFields() {
  console.log('🧪 Testing HRIS Employee Data Structure...\n');

  try {
    // First, get a token
    console.log('1. Getting authentication token...');
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: 'admin@example.com',
      password: 'password123'
    });

    if (!loginResponse.data.success) {
      console.log('❌ Login failed');
      return;
    }

    const token = loginResponse.data.token;
    const headers = { 'Authorization': `Bearer ${token}` };

    console.log('✅ Got token, testing HRIS employee data...\n');

    // Test HRIS employee endpoint directly
    console.log('2. Testing /users/hris endpoint...');
    try {
      const hrisResponse = await axios.get(`${API_BASE}/users/hris?limit=3`, { headers });
      console.log('✅ HRIS employee response:', {
        success: hrisResponse.data.success,
        count: hrisResponse.data.data?.length || 0,
        total: hrisResponse.data.total || 'unknown'
      });

      if (hrisResponse.data.data && hrisResponse.data.data.length > 0) {
        const sampleEmp = hrisResponse.data.data[0];
        console.log('\n📋 Sample HRIS employee fields:');
        console.log('All fields:', Object.keys(sampleEmp));

        console.log('\n🔍 Organizational fields:');
        const orgFields = ['DIV_CODE', 'DIVISION_CODE', 'DIV_NAME', 'DIVISION_NAME',
                          'SEC_CODE', 'SECTION_CODE', 'SEC_NAME', 'SECTION_NAME',
                          'DEPT_CODE', 'DEPARTMENT_CODE', 'DEPT_NAME', 'DEPARTMENT_NAME',
                          'HIE_CODE', 'HIE_NAME', 'HIE_RELATIONSHIP'];

        orgFields.forEach(field => {
          if (sampleEmp.hasOwnProperty(field)) {
            console.log(`  ${field}: ${sampleEmp[field]}`);
          }
        });

        console.log('\n📊 Current work assignment fields:');
        if (sampleEmp.currentwork) {
          console.log('  currentwork object exists with fields:', Object.keys(sampleEmp.currentwork));
          ['HIE_NAME_3', 'HIE_NAME_4', 'DIVISION_NAME', 'SECTION_NAME'].forEach(field => {
            if (sampleEmp.currentwork[field]) {
              console.log(`    ${field}: ${sampleEmp.currentwork[field]}`);
            }
          });
        } else {
          console.log('  No currentwork object found');
        }

        console.log('\n🔗 Hierarchy fields:');
        ['HIE_NAME_3', 'HIE_NAME_4', 'HIE_RELATIONSHIP'].forEach(field => {
          if (sampleEmp[field]) {
            console.log(`  ${field}: ${sampleEmp[field]}`);
          }
        });
      }
    } catch (err) {
      console.log('❌ HRIS employee test error:', err.response?.status, err.response?.data?.message || err.message);
    }

  } catch (err) {
    console.log('❌ Authentication error:', err.response?.status, err.response?.data?.message || err.message);
  }
}

testHrisEmployeeFields().then(() => {
  console.log('\n✅ HRIS employee field analysis completed!');
}).catch(err => {
  console.error('❌ Test failed:', err.message);
});