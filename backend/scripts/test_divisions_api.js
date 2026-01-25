require('dotenv').config();
const axios = require('axios');

async function testDivisionsAPI() {
  try {
    // First get a token
    const loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'admin@slpa.lk',
      password: 'admin123'
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Logged in successfully');
    
    // Test the divisions API endpoint
    const divisionsResponse = await axios.get('http://localhost:5000/api/mysql-data/divisions', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('\n📋 Divisions API Response:');
    console.log('Status:', divisionsResponse.status);
    console.log('Data structure:', typeof divisionsResponse.data);
    
    const rawData = divisionsResponse.data;
    const divisions = rawData.data || rawData || [];
    
    console.log(`\nTotal divisions: ${divisions.length}`);
    
    divisions.slice(0, 5).forEach((div, index) => {
      console.log(`\nDivision ${index + 1}:`);
      console.log('  Fields:', Object.keys(div));
      console.log('  Sample:', {
        id: div.id || div._id,
        name: div.name || div.div_name || div.HIE_NAME,
        code: div.code || div.div_code || div.HIE_CODE
      });
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    process.exit(1);
  }
}

testDivisionsAPI();
