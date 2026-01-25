const axios = require('axios');

async function run() {
  try {
    const res = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'admin@slpa.lk',
      password: 'admin123'
    }, { timeout: 10000 });

    console.log('Status:', res.status);
    console.log('Body:', JSON.stringify(res.data, null, 2));

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
