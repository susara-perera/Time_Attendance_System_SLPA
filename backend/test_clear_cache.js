const axios = require('axios');

const LOGIN_URL = 'http://localhost:5000/api/auth/login';
const CLEAR_ALL_URL = 'http://localhost:5000/api/cache/clear-all';
const STATUS_URL = 'http://localhost:5000/api/cache/status';

async function run() {
  try {
    console.log('1) Logging in as admin@slpa.lk');
    const login = await axios.post(LOGIN_URL, { email: 'admin@slpa.lk', password: 'admin123' }, { timeout: 10000 });
    const token = login.data.token;
    console.log('   Login success. Token obtained');

    console.log('2) Clearing all report caches (POST /api/cache/clear-all)');
    const clearResp = await axios.post(CLEAR_ALL_URL, {}, { headers: { Authorization: `Bearer ${token}` }, timeout: 20000 });
    console.log('   Clear response:', JSON.stringify(clearResp.data, null, 2));

    console.log('3) Fetching cache status');
    const statusResp = await axios.get(STATUS_URL, { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 });
    console.log('   Status response:', JSON.stringify(statusResp.data, null, 2));

    console.log('\n✅ Cache clear and verification complete');
  } catch (err) {
    if (err.response) {
      console.error('Error status:', err.response.status);
      console.error('Error body:', JSON.stringify(err.response.data, null, 2));
    } else {
      console.error('Request error:', err.message);
    }
    process.exit(1);
  }
}

if (require.main === module) run();
module.exports = { run };
