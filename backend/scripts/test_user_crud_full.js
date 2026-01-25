require('dotenv').config();
const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';
let authToken = '';
let testUserId = null;

// Test user data
const testUser = {
  firstName: 'Test',
  lastName: 'User',
  email: 'test.user@slpa.lk',
  employeeId: 'TEST001',
  password: 'Test123!',
  role: 'employee',
  phone: '0771234567',
  division: {
    id: 'mysql_div_6',
    _id: 'mysql_div_6',
    code: '6',
    name: 'Human Resource',
    HIE_CODE: '6',
    HIE_NAME: 'Human Resource'
  },
  section: {
    id: 'mysql_sec_333',
    _id: 'mysql_sec_333',
    code: '333',
    name: 'Human Resource - Administration',
    HIE_CODE: '333',
    HIE_NAME: 'Human Resource - Administration'
  }
};

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Step 1: Login as admin
async function login() {
  try {
    log('\n🔐 Step 1: Logging in as admin...', 'blue');
    const response = await axios.post(`${API_BASE}/auth/login`, {
      email: 'admin@slpa.lk',
      password: 'admin123'
    });
    
    authToken = response.data.token;
    log('✅ Login successful!', 'green');
    log(`   Token: ${authToken.substring(0, 20)}...`, 'reset');
    return true;
  } catch (error) {
    log(`❌ Login failed: ${error.response?.data?.message || error.message}`, 'red');
    return false;
  }
}

// Step 2: Create a test user
async function createUser() {
  try {
    log('\n📝 Step 2: Creating test user...', 'blue');
    log(`   Email: ${testUser.email}`, 'reset');
    log(`   Employee ID: ${testUser.employeeId}`, 'reset');
    log(`   Division: ${testUser.division.name} (ID: ${testUser.division.id})`, 'reset');
    log(`   Section: ${testUser.section.name} (ID: ${testUser.section.id})`, 'reset');
    
    const response = await axios.post(`${API_BASE}/users`, testUser, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (response.data.success) {
      testUserId = response.data.user.id;
      log('✅ User created successfully!', 'green');
      log(`   User ID: ${testUserId}`, 'reset');
      log(`   Name: ${response.data.user.firstName} ${response.data.user.lastName}`, 'reset');
      log(`   Division stored: ${response.data.user.divisionName || 'N/A'}`, 'reset');
      log(`   Section stored: ${response.data.user.sectionName || 'N/A'}`, 'reset');
      return true;
    } else {
      log('❌ User creation failed: ' + response.data.message, 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Create user error: ${error.response?.data?.message || error.message}`, 'red');
    if (error.response?.data) {
      console.log('Response data:', error.response.data);
    }
    return false;
  }
}

// Step 3: Get user by ID
async function getUserById() {
  try {
    log('\n🔍 Step 3: Fetching user by ID...', 'blue');
    const response = await axios.get(`${API_BASE}/users/${testUserId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (response.data.success) {
      const user = response.data.user;
      log('✅ User fetched successfully!', 'green');
      log(`   ID: ${user.id}`, 'reset');
      log(`   Name: ${user.firstName} ${user.lastName}`, 'reset');
      log(`   Email: ${user.email}`, 'reset');
      log(`   Employee ID: ${user.employeeId}`, 'reset');
      log(`   Division: ${user.divisionName} (Code: ${user.divisionCode || 'N/A'})`, 'reset');
      log(`   Section: ${user.sectionName} (Code: ${user.sectionCode || 'N/A'})`, 'reset');
      log(`   Role: ${user.role}`, 'reset');
      log(`   Active: ${user.isActive}`, 'reset');
      return true;
    } else {
      log('❌ Failed to fetch user', 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Get user error: ${error.response?.data?.message || error.message}`, 'red');
    return false;
  }
}

// Step 4: Get all users
async function getAllUsers() {
  try {
    log('\n📋 Step 4: Fetching all users...', 'blue');
    const response = await axios.get(`${API_BASE}/users`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (response.data.success) {
      const users = response.data.users;
      log(`✅ Fetched ${users.length} users successfully!`, 'green');
      
      // Find our test user
      const testUserInList = users.find(u => u.id === testUserId);
      if (testUserInList) {
        log(`   ✓ Test user found in list!`, 'green');
        log(`     Division: ${testUserInList.divisionName || 'N/A'}`, 'reset');
        log(`     Section: ${testUserInList.sectionName || 'N/A'}`, 'reset');
      } else {
        log(`   ⚠ Test user NOT found in list!`, 'yellow');
      }
      return true;
    } else {
      log('❌ Failed to fetch users', 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Get users error: ${error.response?.data?.message || error.message}`, 'red');
    return false;
  }
}

// Step 5: Update user
async function updateUser() {
  try {
    log('\n✏️  Step 5: Updating user...', 'blue');
    
    const updateData = {
      firstName: 'Updated',
      lastName: 'TestUser',
      phone: '0779876543',
      role: 'clerk',
      division: {
        id: 'mysql_div_8',
        _id: 'mysql_div_8',
        code: '8',
        name: 'Operations (Conventional Cargo)',
        HIE_CODE: '8',
        HIE_NAME: 'Operations (Conventional Cargo)'
      },
      section: {
        id: 'mysql_sec_400',
        _id: 'mysql_sec_400',
        code: '400',
        name: 'Operations - General',
        HIE_CODE: '400',
        HIE_NAME: 'Operations - General'
      }
    };
    
    log(`   Changing division to: ${updateData.division.name}`, 'reset');
    log(`   Changing section to: ${updateData.section.name}`, 'reset');
    log(`   Changing role to: ${updateData.role}`, 'reset');
    
    const response = await axios.put(`${API_BASE}/users/${testUserId}`, updateData, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (response.data.success) {
      const user = response.data.user;
      log('✅ User updated successfully!', 'green');
      log(`   Name: ${user.firstName} ${user.lastName}`, 'reset');
      log(`   Phone: ${user.phone}`, 'reset');
      log(`   Role: ${user.role}`, 'reset');
      log(`   Division: ${user.divisionName} (Code: ${user.divisionCode || 'N/A'})`, 'reset');
      log(`   Section: ${user.sectionName} (Code: ${user.sectionCode || 'N/A'})`, 'reset');
      return true;
    } else {
      log('❌ Update failed: ' + response.data.message, 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Update error: ${error.response?.data?.message || error.message}`, 'red');
    if (error.response?.data) {
      console.log('Response data:', error.response.data);
    }
    return false;
  }
}

// Step 6: Verify update
async function verifyUpdate() {
  try {
    log('\n🔍 Step 6: Verifying update...', 'blue');
    const response = await axios.get(`${API_BASE}/users/${testUserId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (response.data.success) {
      const user = response.data.user;
      log('✅ User data retrieved after update:', 'green');
      log(`   Name: ${user.firstName} ${user.lastName}`, 'reset');
      log(`   Division: ${user.divisionName} (Code: ${user.divisionCode || 'N/A'})`, 'reset');
      log(`   Section: ${user.sectionName} (Code: ${user.sectionCode || 'N/A'})`, 'reset');
      log(`   Role: ${user.role}`, 'reset');
      
      // Verify the changes
      const checks = [
        { name: 'First Name', expected: 'Updated', actual: user.firstName },
        { name: 'Role', expected: 'clerk', actual: user.role },
        { name: 'Division Name', expected: 'Operations (Conventional Cargo)', actual: user.divisionName }
      ];
      
      let allPassed = true;
      checks.forEach(check => {
        if (check.actual === check.expected) {
          log(`   ✓ ${check.name}: ${check.actual}`, 'green');
        } else {
          log(`   ✗ ${check.name}: Expected "${check.expected}", got "${check.actual}"`, 'red');
          allPassed = false;
        }
      });
      
      return allPassed;
    } else {
      log('❌ Failed to verify update', 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Verify error: ${error.response?.data?.message || error.message}`, 'red');
    return false;
  }
}

// Step 7: Delete user
async function deleteUser() {
  try {
    log('\n🗑️  Step 7: Deleting user...', 'blue');
    const response = await axios.delete(`${API_BASE}/users/${testUserId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (response.data.success) {
      log('✅ User deleted successfully!', 'green');
      log(`   Message: ${response.data.message}`, 'reset');
      return true;
    } else {
      log('❌ Delete failed: ' + response.data.message, 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Delete error: ${error.response?.data?.message || error.message}`, 'red');
    return false;
  }
}

// Step 8: Verify deletion
async function verifyDeletion() {
  try {
    log('\n🔍 Step 8: Verifying deletion...', 'blue');
    const response = await axios.get(`${API_BASE}/users/${testUserId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    // If we get here, the user still exists (should not happen)
    log('❌ User still exists after deletion!', 'red');
    return false;
  } catch (error) {
    if (error.response?.status === 404) {
      log('✅ User successfully deleted (404 Not Found)', 'green');
      return true;
    } else {
      log(`❌ Unexpected error: ${error.message}`, 'red');
      return false;
    }
  }
}

// Run all tests
async function runTests() {
  log('═══════════════════════════════════════════════════', 'blue');
  log('  USER CRUD OPERATIONS - FULL TEST SUITE', 'blue');
  log('═══════════════════════════════════════════════════', 'blue');
  
  const results = {
    passed: 0,
    failed: 0,
    total: 8
  };
  
  // Run tests in sequence
  const tests = [
    { name: 'Login', fn: login },
    { name: 'Create User', fn: createUser },
    { name: 'Get User by ID', fn: getUserById },
    { name: 'Get All Users', fn: getAllUsers },
    { name: 'Update User', fn: updateUser },
    { name: 'Verify Update', fn: verifyUpdate },
    { name: 'Delete User', fn: deleteUser },
    { name: 'Verify Deletion', fn: verifyDeletion }
  ];
  
  for (const test of tests) {
    const success = await test.fn();
    if (success) {
      results.passed++;
    } else {
      results.failed++;
      log(`\n⚠️  Test "${test.name}" failed! Continuing...`, 'yellow');
    }
  }
  
  // Summary
  log('\n═══════════════════════════════════════════════════', 'blue');
  log('  TEST SUMMARY', 'blue');
  log('═══════════════════════════════════════════════════', 'blue');
  log(`Total Tests: ${results.total}`, 'reset');
  log(`Passed: ${results.passed}`, 'green');
  log(`Failed: ${results.failed}`, results.failed > 0 ? 'red' : 'green');
  log(`Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%`, 'reset');
  
  if (results.failed === 0) {
    log('\n🎉 All tests passed!', 'green');
  } else {
    log('\n⚠️  Some tests failed. Check the output above for details.', 'yellow');
  }
  
  process.exit(results.failed > 0 ? 1 : 0);
}

// Start tests
runTests().catch(error => {
  log(`\n💥 Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
