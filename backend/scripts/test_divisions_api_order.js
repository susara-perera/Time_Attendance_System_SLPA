require('dotenv').config();
const axios = require('axios');

async function testDivisionsOrder() {
  try {
    const response = await axios.get('http://localhost:5000/api/mysql-data/divisions');
    console.log('First 10 divisions from API:');
    response.data.data.slice(0, 10).forEach((d, i) => {
      console.log(`${i + 1}. ${d.code} - ${d.name}`);
    });
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testDivisionsOrder();