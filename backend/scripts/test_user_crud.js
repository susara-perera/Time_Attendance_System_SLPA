const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

// Test data
const testUser = {
  firstName: 'John',
  lastName: 'Doe',
  email: 'john.doe@test.com',
  employeeId: 'EMP001',
  password: 'TestPassword123',
  role: 'employee',
  phone: '1234567890'
};

let authToken = '';
let createdUserId = '';

const testAPI = async () => {
  try {
    console.log('🧪 Starting User CRUD API Tests...\n');
    
    // Step 1: Try to login first (if there's an existing admin)
    try {
      console.log('1. Testing Login...');
      const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
        email: 'admin@slpa.lk',
        password: 'admin123'
      });
      
      if (loginResponse.status === 200) {
        authToken = loginResponse.data.token;
        console.log('✅ Login successful');
      }
    } catch (error) {
      console.log('⚠️  Login failed, continuing with public endpoints...');
    }

    const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};

    // Step 2: Test GET /api/users (should work even with empty table)
    console.log('\n2. Testing GET /api/users...');
    try {
      const getUsersResponse = await axios.get(`${BASE_URL}/users`, { headers });
      console.log(`✅ GET Users - Status: ${getUsersResponse.status}`);
      console.log(`   Users count: ${getUsersResponse.data.data?.length || 0}`);
    } catch (error) {
      console.log(`❌ GET Users failed: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
      if (error.response?.data?.error) {
        console.log(`   Error details: ${error.response.data.error}`);
      }
    }

    // Step 3: Test POST /api/users (create user)
    console.log('\n3. Testing POST /api/users...');
    try {
      const createUserResponse = await axios.post(`${BASE_URL}/users`, testUser, { headers });
      console.log(`✅ POST User - Status: ${createUserResponse.status}`);
      
      if (createUserResponse.data.data) {
        createdUserId = createUserResponse.data.data.id;
        console.log(`   Created user ID: ${createdUserId}`);
        console.log(`   User: ${createUserResponse.data.data.firstName} ${createUserResponse.data.data.lastName}`);
      }
    } catch (error) {
      console.log(`❌ POST User failed: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
      if (error.response?.data?.error) {
        console.log(`   Error details: ${error.response.data.error}`);
      }
      return;
    }

    // Step 4: Test GET /api/users/:id (get single user)
    if (createdUserId) {
      console.log('\n4. Testing GET /api/users/:id...');
      try {
        const getUserResponse = await axios.get(`${BASE_URL}/users/${createdUserId}`, { headers });
        console.log(`✅ GET User by ID - Status: ${getUserResponse.status}`);
        console.log(`   User: ${getUserResponse.data.data.firstName} ${getUserResponse.data.data.lastName}`);
      } catch (error) {
        console.log(`❌ GET User by ID failed: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
      }
    }

    // Step 5: Test PUT /api/users/:id (update user)
    if (createdUserId) {
      console.log('\n5. Testing PUT /api/users/:id...');
      try {
        const updateData = {
          firstName: 'Jane',
          lastName: 'Smith',
          phone: '9876543210'
        };
        
        const updateUserResponse = await axios.put(`${BASE_URL}/users/${createdUserId}`, updateData, { headers });
        console.log(`✅ PUT User - Status: ${updateUserResponse.status}`);
        console.log(`   Updated user: ${updateUserResponse.data.data.firstName} ${updateUserResponse.data.data.lastName}`);
      } catch (error) {
        console.log(`❌ PUT User failed: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
      }
    }

    // Step 6: Test DELETE /api/users/:id (delete user)
    if (createdUserId) {
      console.log('\n6. Testing DELETE /api/users/:id...');
      try {
        const deleteUserResponse = await axios.delete(`${BASE_URL}/users/${createdUserId}`, { headers });
        console.log(`✅ DELETE User - Status: ${deleteUserResponse.status}`);
        console.log(`   Message: ${deleteUserResponse.data.message}`);
      } catch (error) {
        console.log(`❌ DELETE User failed: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
      }
    }

    // Step 7: Verify deletion by trying to get the user again
    if (createdUserId) {
      console.log('\n7. Verifying deletion...');
      try {
        await axios.get(`${BASE_URL}/users/${createdUserId}`, { headers });
        console.log('❌ User still exists after deletion');
      } catch (error) {
        if (error.response?.status === 404) {
          console.log('✅ User successfully deleted');
        } else {
          console.log(`❌ Unexpected error: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
        }
      }
    }

    console.log('\n🎉 User CRUD API Tests completed!');
    
  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
  }
};

// Run the tests
testAPI();