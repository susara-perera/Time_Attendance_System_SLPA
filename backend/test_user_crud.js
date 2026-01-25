const axios = require('axios');

const API_URL = 'http://localhost:5000/api';
let authToken = '';
let createdUserId = null;

// Login first to get token
async function login() {
  console.log('🔑 Logging in to get auth token...');
  try {
    const response = await axios.post(`${API_URL}/auth/login`, {
      email: 'root@slpa.lk',
      password: 'root123'
    });
    
    authToken = response.data.token;
    console.log('✅ Login successful - Token acquired\n');
    return true;
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data?.message || error.message);
    return false;
  }
}

// Test 1: Create User
async function testCreateUser() {
  console.log('📝 TEST 1: Creating new user...');
  
  const newUser = {
    firstName: 'Test',
    lastName: 'User',
    email: `test.user.${Date.now()}@slpa.lk`,
    employeeId: `TEST${Date.now().toString().slice(-6)}`,
    password: 'test123',
    role: 'employee',
    divisionId: 1, // Use existing division
    sectionId: null, // Make it nullable
    phone: '0771234567',
    isActive: true
  };
  
  try {
    const response = await axios.post(`${API_URL}/users`, newUser, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (response.data.success) {
      const user = response.data.user || response.data.data;
      createdUserId = user.id;
      console.log('✅ User created successfully');
      console.log(`   ID: ${createdUserId}`);
      console.log(`   Name: ${user.firstName} ${user.lastName}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Employee ID: ${user.employeeId}`);
      console.log(`   Role: ${user.role}\n`);
      return true;
    }
  } catch (error) {
    console.error('❌ Create user failed:');
    console.error('   Status:', error.response?.status);
    console.error('   Message:', error.response?.data?.message || error.message);
    if (error.response?.data?.errors) {
      console.error('   Errors:', JSON.stringify(error.response.data.errors, null, 2));
    }
    console.log('');
    return false;
  }
}

// Test 2: Update User
async function testUpdateUser() {
  console.log('✏️  TEST 2: Updating user...');
  
  if (!createdUserId) {
    console.error('❌ No user ID to update\n');
    return false;
  }
  
  const updates = {
    firstName: 'Updated',
    lastName: 'TestUser',
    phone: '0779876543'
  };
  
  try {
    const response = await axios.put(`${API_URL}/users/${createdUserId}`, updates, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (response.data.success) {
      const user = response.data.user || response.data.data;
      console.log('✅ User updated successfully');
      console.log(`   Name: ${user.firstName} ${user.lastName}`);
      console.log(`   Phone: ${user.phone}\n`);
      return true;
    }
  } catch (error) {
    console.error('❌ Update user failed:');
    console.error('   Status:', error.response?.status);
    console.error('   Message:', error.response?.data?.message || error.message);
    if (error.response?.data?.errors) {
      console.error('   Errors:', JSON.stringify(error.response.data.errors, null, 2));
    }
    console.log('');
    return false;
  }
}

// Test 3: Delete User
async function testDeleteUser() {
  console.log('🗑️  TEST 3: Deleting user...');
  
  if (!createdUserId) {
    console.error('❌ No user ID to delete\n');
    return false;
  }
  
  try {
    const response = await axios.delete(`${API_URL}/users/${createdUserId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (response.data.success) {
      console.log('✅ User deleted successfully');
      console.log(`   Message: ${response.data.message}\n`);
      return true;
    }
  } catch (error) {
    console.error('❌ Delete user failed:');
    console.error('   Status:', error.response?.status);
    console.error('   Message:', error.response?.data?.message || error.message);
    console.log('');
    return false;
  }
}

// Test 4: Verify deletion (should get 404)
async function testVerifyDeletion() {
  console.log('🔍 TEST 4: Verifying user was deleted...');
  
  if (!createdUserId) {
    console.log('⚠️  Skipping verification - no user ID\n');
    return true;
  }
  
  try {
    const response = await axios.get(`${API_URL}/users/${createdUserId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.error('❌ User still exists after deletion');
    console.log('');
    return false;
  } catch (error) {
    if (error.response?.status === 404) {
      console.log('✅ User correctly not found (deleted successfully)\n');
      return true;
    } else {
      console.error('❌ Unexpected error:', error.response?.status, error.response?.data?.message || error.message);
      console.log('');
      return false;
    }
  }
}

// Run all tests
async function runAllTests() {
  console.log('═══════════════════════════════════════════════');
  console.log('     USER CRUD OPERATIONS TEST');
  console.log('═══════════════════════════════════════════════\n');
  
  // Login first
  const loginSuccess = await login();
  if (!loginSuccess) {
    console.log('❌ Cannot proceed without authentication\n');
    return;
  }
  
  // Run tests
  const test1 = await testCreateUser();
  const test2 = await testUpdateUser();
  const test3 = await testDeleteUser();
  const test4 = await testVerifyDeletion();
  
  console.log('═══════════════════════════════════════════════');
  console.log('     TEST SUMMARY');
  console.log('═══════════════════════════════════════════════');
  console.log(`1. Create User:  ${test1 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`2. Update User:  ${test2 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`3. Delete User:  ${test3 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`4. Verify Delete: ${test4 ? '✅ PASS' : '❌ FAIL'}`);
  console.log('═══════════════════════════════════════════════\n');
  
  if (test1 && test2 && test3 && test4) {
    console.log('🎉 ALL TESTS PASSED - User CRUD operations working perfectly!\n');
  } else {
    console.log('⚠️  SOME TESTS FAILED - Please review the errors above\n');
  }
}

runAllTests();
