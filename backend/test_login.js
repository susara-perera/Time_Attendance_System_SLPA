const axios = require('axios');

const API_URL = 'http://localhost:5000/api';

async function testLogin() {
  console.log('🧪 Testing login with default super admin...\n');
  
  try {
    const response = await axios.post(`${API_URL}/auth/login`, {
      email: 'root@slpa.lk',
      password: 'root123'
    });
    
    if (response.data.success) {
      console.log('✅ LOGIN SUCCESSFUL!\n');
      console.log('User Details:');
      console.log('  Name:', response.data.user.fullName);
      console.log('  Email:', response.data.user.email);
      console.log('  Employee ID:', response.data.user.employeeId);
      console.log('  Role:', response.data.user.role);
      console.log('  Division:', response.data.user.division?.name || 'N/A');
      console.log('  Section:', response.data.user.section?.name || 'N/A');
      console.log('\n🔑 Token:', response.data.token.substring(0, 50) + '...');
      console.log('\n✅ Login test PASSED - User can login successfully!');
      return true;
    }
  } catch (error) {
    console.error('❌ LOGIN FAILED!\n');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Message:', error.response.data.message);
      console.error('Full response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
    console.log('\n❌ Login test FAILED');
    return false;
  }
}

// Also test with wrong password
async function testWrongPassword() {
  console.log('\n🧪 Testing login with wrong password...\n');
  
  try {
    const response = await axios.post(`${API_URL}/auth/login`, {
      email: 'root@slpa.lk',
      password: 'wrongpassword'
    });
    
    console.log('❌ Should have failed but succeeded');
    return false;
  } catch (error) {
    if (error.response && error.response.status === 401) {
      console.log('✅ Correctly rejected wrong password');
      console.log('   Message:', error.response.data.message);
      return true;
    } else {
      console.error('❌ Unexpected error:', error.message);
      return false;
    }
  }
}

// Run tests
async function runTests() {
  console.log('═══════════════════════════════════════════════');
  console.log('     LOGIN FUNCTIONALITY TEST');
  console.log('═══════════════════════════════════════════════\n');
  
  const test1 = await testLogin();
  const test2 = await testWrongPassword();
  
  console.log('\n═══════════════════════════════════════════════');
  console.log('     TEST SUMMARY');
  console.log('═══════════════════════════════════════════════');
  console.log(`Valid credentials: ${test1 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Invalid credentials: ${test2 ? '✅ PASS' : '❌ FAIL'}`);
  console.log('═══════════════════════════════════════════════\n');
  
  if (test1 && test2) {
    console.log('🎉 ALL TESTS PASSED - Login functionality is working!\n');
  } else {
    console.log('⚠️  SOME TESTS FAILED - Please review the errors above\n');
  }
}

runTests();
