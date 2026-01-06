const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';

async function testEndpoints() {
  console.log('Testing API Endpoints...\n');
  
  try {
    // Test divisions/sync endpoint
    console.log('1. Testing /divisions/sync (new endpoint)...');
    try {
      const divSyncRes = await axios.get(`${API_BASE}/divisions/sync`, {
        headers: { 'Authorization': 'Bearer test' }
      });
      console.log('✅ /divisions/sync response:', {
        success: divSyncRes.data.success,
        count: divSyncRes.data.data?.length || 0,
        source: divSyncRes.data.source
      });
    } catch (err) {
      console.log('❌ /divisions/sync error:', err.response?.status, err.response?.data?.message || err.message);
    }
    
    // Test divisions/hris endpoint
    console.log('\n2. Testing /divisions/hris (existing endpoint)...');
    try {
      const divHrisRes = await axios.get(`${API_BASE}/divisions/hris`);
      console.log('✅ /divisions/hris response:', {
        success: divHrisRes.data.success,
        count: divHrisRes.data.data?.length || 0,
        source: divHrisRes.data.source
      });
      if (divHrisRes.data.data && divHrisRes.data.data.length > 0) {
        console.log('   Sample division:', {
          _id: divHrisRes.data.data[0]._id,
          code: divHrisRes.data.data[0].code,
          name: divHrisRes.data.data[0].name
        });
      }
    } catch (err) {
      console.log('❌ /divisions/hris error:', err.response?.status, err.response?.data?.message || err.message);
    }
    
    // Test sections/hris endpoint
    console.log('\n3. Testing /sections/hris...');
    try {
      const secRes = await axios.get(`${API_BASE}/sections/hris`);
      console.log('✅ /sections/hris response:', {
        success: secRes.data.success,
        count: secRes.data.data?.length || 0,
        source: secRes.data.source
      });
      if (secRes.data.data && secRes.data.data.length > 0) {
        console.log('   Sample section:', {
          _id: secRes.data.data[0]._id,
          code: secRes.data.data[0].code,
          name: secRes.data.data[0].name,
          division_code: secRes.data.data[0].division_code
        });
      }
    } catch (err) {
      console.log('❌ /sections/hris error:', err.response?.status, err.response?.data?.message || err.message);
    }
    
    // Test users/hris endpoint
    console.log('\n4. Testing /users/hris...');
    try {
      const empRes = await axios.get(`${API_BASE}/users/hris?limit=10`);
      console.log('✅ /users/hris response:', {
        success: empRes.data.success,
        count: empRes.data.data?.length || 0,
        total: empRes.data.pagination?.total || 0
      });
      if (empRes.data.data && empRes.data.data.length > 0) {
        console.log('   Sample employee:', {
          _id: empRes.data.data[0]._id,
          EMP_NUMBER: empRes.data.data[0].EMP_NUMBER,
          FULLNAME: empRes.data.data[0].FULLNAME,
          DIVISION_CODE: empRes.data.data[0].DIVISION_CODE
        });
      }
    } catch (err) {
      console.log('❌ /users/hris error:', err.response?.status, err.response?.data?.message || err.message);
    }
    
    console.log('\n✅ All tests completed!');
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testEndpoints();
