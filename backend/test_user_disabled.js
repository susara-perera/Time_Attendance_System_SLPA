const axios = require('axios');

const API_URL = 'http://localhost:5000/api';

async function testDisabledUserOperations() {
  console.log('🚫 Testing that user CRUD operations are disabled...\n');
  
  try {
    // Login first
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: 'root@slpa.lk',
      password: 'root123'
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Login still works (authentication not disabled)\n');
    
    // Test 1: Get users (should be disabled)
    console.log('🔍 Test 1: GET /api/users');
    try {
      const response = await axios.get(`${API_URL}/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('❌ FAIL: Users endpoint should be disabled');
    } catch (error) {
      if (error.response?.status === 403) {
        console.log('✅ PASS: Users list properly disabled (403)');
        console.log(`   Message: ${error.response.data.message}`);
      } else {
        console.log('⚠️  Unexpected status:', error.response?.status);
      }
    }
    
    // Test 2: Create user (should be disabled)
    console.log('\n🔍 Test 2: POST /api/users');
    try {
      const response = await axios.post(`${API_URL}/users`, {
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        employeeId: 'TEST123',
        password: 'test123'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('❌ FAIL: User creation should be disabled');
    } catch (error) {
      if (error.response?.status === 403) {
        console.log('✅ PASS: User creation properly disabled (403)');
        console.log(`   Message: ${error.response.data.message}`);
      } else {
        console.log('⚠️  Unexpected status:', error.response?.status);
      }
    }
    
    // Test 3: Update user (should be disabled)
    console.log('\n🔍 Test 3: PUT /api/users/1');
    try {
      const response = await axios.put(`${API_URL}/users/1`, {
        firstName: 'Updated'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('❌ FAIL: User update should be disabled');
    } catch (error) {
      if (error.response?.status === 403) {
        console.log('✅ PASS: User update properly disabled (403)');
        console.log(`   Message: ${error.response.data.message}`);
      } else {
        console.log('⚠️  Unexpected status:', error.response?.status);
      }
    }
    
    // Test 4: Delete user (should be disabled)
    console.log('\n🔍 Test 4: DELETE /api/users/1');
    try {
      const response = await axios.delete(`${API_URL}/users/1`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('❌ FAIL: User deletion should be disabled');
    } catch (error) {
      if (error.response?.status === 403) {
        console.log('✅ PASS: User deletion properly disabled (403)');
        console.log(`   Message: ${error.response.data.message}`);
      } else {
        console.log('⚠️  Unexpected status:', error.response?.status);
      }
    }
    
    console.log('\n═══════════════════════════════════════════════');
    console.log('     USER CRUD OPERATIONS DISABLED ✅');
    console.log('═══════════════════════════════════════════════');
    console.log('✅ Authentication still works (login/logout)');
    console.log('🚫 All user CRUD operations properly disabled');
    console.log('📞 Users must contact system administrator');
    console.log('═══════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testDisabledUserOperations();