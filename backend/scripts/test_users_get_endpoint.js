require('dotenv').config();
const axios = require('axios');

async function testUsersEndpoint() {
  try {
    console.log('Testing GET /api/users endpoint...\n');
    
    // First login to get a valid token
    console.log('Step 1: Logging in...');
    const loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'admin@slpa.lk',
      password: 'admin123'
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Login successful\n');
    
    // Test GET /api/users
    console.log('Step 2: Fetching users from GET /api/users...');
    const usersResponse = await axios.get('http://localhost:5000/api/users', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('\n📊 Response Status:', usersResponse.status);
    console.log('📊 Response Structure:', Object.keys(usersResponse.data));
    
    const data = usersResponse.data;
    
    if (data.success) {
      console.log('✅ Success: true');
      console.log(`📋 Total Users: ${data.count || data.users?.length || 0}`);
      
      // Check if users array exists
      const usersArray = data.users || data.data || [];
      
      if (usersArray.length > 0) {
        console.log('\n👤 Sample User (first in array):');
        const sampleUser = usersArray[0];
        console.log('  ID:', sampleUser.id);
        console.log('  Name:', `${sampleUser.firstName} ${sampleUser.lastName}`);
        console.log('  Email:', sampleUser.email);
        console.log('  Employee ID:', sampleUser.employeeId);
        console.log('  Role:', sampleUser.role);
        console.log('  Division ID:', sampleUser.divisionId);
        console.log('  Division Name:', sampleUser.divisionName);
        console.log('  Division Code:', sampleUser.divisionCode);
        console.log('  Section ID:', sampleUser.sectionId);
        console.log('  Section Name:', sampleUser.sectionName);
        console.log('  Section Code:', sampleUser.sectionCode);
        console.log('  Subsection ID:', sampleUser.subsectionId);
        console.log('  Subsection Name:', sampleUser.subsectionName);
        console.log('  Active:', sampleUser.isActive);
        
        console.log('\n📋 All Users Summary:');
        usersArray.forEach((user, index) => {
          console.log(`  ${index + 1}. ${user.firstName} ${user.lastName} (${user.email}) - Division: ${user.divisionName || 'N/A'}, Section: ${user.sectionName || 'N/A'}`);
        });
        
        // Check if division/section data is present
        const usersWithDivision = usersArray.filter(u => u.divisionName);
        const usersWithSection = usersArray.filter(u => u.sectionName);
        
        console.log(`\n📊 Users with Division data: ${usersWithDivision.length}/${usersArray.length}`);
        console.log(`📊 Users with Section data: ${usersWithSection.length}/${usersArray.length}`);
        
        // Check if any user has the old division/section object format
        const hasOldFormat = usersArray.some(u => u.division && typeof u.division === 'object');
        if (hasOldFormat) {
          console.log('\n⚠️  Warning: Some users have old division/section object format (not denormalized)');
        } else {
          console.log('\n✅ All users use denormalized division/section data');
        }
        
      } else {
        console.log('\n⚠️  No users found in the response');
      }
      
      console.log('\n✅ GET /api/users endpoint is working correctly!');
      
    } else {
      console.log('❌ Response success = false');
      console.log('Message:', data.message);
    }
    
  } catch (error) {
    console.error('\n❌ Error testing endpoint:');
    console.error('Message:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
    process.exit(1);
  }
}

testUsersEndpoint();
