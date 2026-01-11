/**
 * Simple audit sync test - just sync without querying
 */

const axios = require('axios');

async function test() {
  try {
    // Login
    console.log('Logging in...');
    const loginResp = await axios.post('http://localhost:5000/api/auth/login', {
       email: 'lalinda@slpa.lk',
      password: 'slpa@123'
    });
    
    const token = loginResp.data.token;
    console.log('✅ Logged in');
    
    // Trigger sync with filters
    console.log('\nTriggering audit sync with filters...');
    console.log('Division: 66, Section: 333');
    
    const syncResp = await axios.post(
      'http://localhost:5000/api/sync/trigger/audit',
      {
        days: 35,
        division_id: '66',
        section_id: '333'
      },
      {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 60000 // 60 second timeout
      }
    );
    
    console.log('\n✅ Sync completed!');
    console.log('Records synced:', syncResp.data.data?.recordsSynced);
    console.log('Breakdown:', JSON.stringify(syncResp.data.data?.breakdown, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

test();
