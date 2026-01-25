const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

const testAdminLogin = async () => {
  try {
    console.log('🔐 Testing admin login...');

    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'admin@slpa.lk',
      password: 'admin123'
    });

    if (loginResponse.status === 200) {
      console.log('✅ Admin login successful!');
      console.log(`   Token: ${loginResponse.data.token ? 'Generated' : 'Missing'}`);
      console.log(`   User: ${loginResponse.data.user?.firstName} ${loginResponse.data.user?.lastName}`);
      console.log(`   Role: ${loginResponse.data.user?.role}`);
      console.log(`   Email: ${loginResponse.data.user?.email}`);

      // Test accessing users endpoint with the token
      const token = loginResponse.data.token;
      const usersResponse = await axios.get(`${BASE_URL}/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log(`✅ Users endpoint accessible - Status: ${usersResponse.status}`);
      console.log(`   Total users: ${usersResponse.data.data?.length || 0}`);

    } else {
      console.log('❌ Login failed');
    }

  } catch (error) {
    console.error('❌ Login test failed:', error.response?.status, error.response?.data?.message || error.message);
  }
};

testAdminLogin();