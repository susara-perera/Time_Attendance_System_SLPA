const axios = require('axios');

const API_URL = 'http://localhost:5000/api';

// Test user creation
async function testUserCreation() {
  console.log('🧪 Testing User Creation...\n');

  try {
    // First, let's get divisions and sections
    console.log('1️⃣ Fetching divisions...');
    const divisionsResponse = await axios.get(`${API_URL}/divisions`);
    const divisions = divisionsResponse.data.data || divisionsResponse.data;
    
    if (!divisions || divisions.length === 0) {
      console.log('❌ No divisions found in the system');
      return;
    }
    
    console.log(`✅ Found ${divisions.length} divisions`);
    const testDivision = divisions[0];
    console.log(`   Using division: ${testDivision.name} (${testDivision.code})`);
    console.log(`   Division ID: ${testDivision._id}`);

    // Get sections for this division
    console.log('\n2️⃣ Fetching sections...');
    const sectionsResponse = await axios.get(`${API_URL}/sections`);
    const sections = sectionsResponse.data.data || sectionsResponse.data;
    
    // Find a section that belongs to our test division
    const testSection = sections.find(s => String(s.division) === String(testDivision._id));
    
    if (testSection) {
      console.log(`✅ Found ${sections.length} sections`);
      console.log(`   Using section: ${testSection.name} (${testSection.code})`);
      console.log(`   Section ID: ${testSection._id}`);
    } else {
      console.log(`⚠️  No sections found for this division`);
    }

    // Create a test user
    console.log('\n3️⃣ Creating test user...');
    const timestamp = Date.now();
    const testUserData = {
      firstName: 'Test',
      lastName: 'User',
      email: `testuser${timestamp}@example.com`,
      employeeId: `EMP${timestamp}`,
      password: 'Test@123',
      role: 'employee',
      division: testDivision._id,
      section: testSection ? testSection._id : undefined,
      phone: '0771234567',
      designation: 'Test Designation',
      salary: 50000
    };

    console.log('   Test user data:', {
      ...testUserData,
      password: '***hidden***'
    });

    const createResponse = await axios.post(`${API_URL}/users`, testUserData);
    
    console.log('\n✅ User created successfully!');
    console.log('   Response:', JSON.stringify(createResponse.data, null, 2));
    
    const createdUser = createResponse.data.data || createResponse.data.user;
    
    if (createdUser) {
      console.log('\n📋 Created User Details:');
      console.log(`   ID: ${createdUser._id}`);
      console.log(`   Name: ${createdUser.firstName} ${createdUser.lastName}`);
      console.log(`   Email: ${createdUser.email}`);
      console.log(`   Employee ID: ${createdUser.employeeId}`);
      console.log(`   Role: ${createdUser.role}`);
      console.log(`   Division ID: ${createdUser.division}`);
      console.log(`   Division Name: ${createdUser.divisionName}`);
      console.log(`   Division Code: ${createdUser.divisionCode}`);
      console.log(`   Section ID: ${createdUser.section}`);
      console.log(`   Section Name: ${createdUser.sectionName}`);
      console.log(`   Section Code: ${createdUser.sectionCode}`);
    }

    console.log('\n✅ TEST PASSED: User creation is working correctly!');
    
  } catch (error) {
    console.error('\n❌ TEST FAILED: User creation error');
    
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Error:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('   No response received from server');
      console.error('   Error:', error.message);
    } else {
      console.error('   Error:', error.message);
    }
    
    console.error('\n   Stack trace:', error.stack);
  }
}

// Run the test
testUserCreation();
