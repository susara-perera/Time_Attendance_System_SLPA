const axios = require('axios');
const BASE_URL = 'http://localhost:5000/api';

async function testDivisionsEndpoint() {
  console.log('🔍 Testing Divisions API Endpoint...\n');

  try {
    console.log('📡 Calling: GET /api/mysql-data/divisions');
    const response = await axios.get(BASE_URL + '/mysql-data/divisions');

    if (response.data.success) {
      console.log('✅ SUCCESS: Divisions endpoint working!');
      console.log('📊 Total divisions: ' + response.data.count);
      console.log('🔗 Source: ' + response.data.source);
      console.log('💡 Message: ' + response.data.message);

      console.log('\n📋 Sample Divisions:');
      const sampleDivisions = response.data.data.slice(0, 5);
      sampleDivisions.forEach((div, index) => {
        console.log((index + 1) + '. ' + div.HIE_CODE + ' - ' + div.HIE_NAME);
      });

      if (response.data.data.length > 5) {
        console.log('... and ' + (response.data.data.length - 5) + ' more divisions');
      }
    } else {
      console.log('❌ FAILED: API returned success=false');
    }
  } catch (error) {
    console.log('❌ ERROR: Failed to call divisions endpoint');
    console.log('Error details:', error.response?.data?.message || error.message);
  }
}

testDivisionsEndpoint();