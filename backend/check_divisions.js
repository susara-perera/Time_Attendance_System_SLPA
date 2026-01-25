const axios = require('axios');

const API_URL = 'http://localhost:5000/api';

async function checkDivisions() {
  console.log('🔍 Checking available divisions and sections...\n');
  
  try {
    // Login first
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: 'root@slpa.lk',
      password: 'root123'
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Logged in successfully\n');
    
    // Get divisions
    const divResponse = await axios.get(`${API_URL}/divisions`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('📊 Available Divisions:');
    if (divResponse.data.divisions && divResponse.data.divisions.length > 0) {
      divResponse.data.divisions.slice(0, 5).forEach(div => {
        console.log(`   ID: ${div.id}, Code: ${div.code}, Name: ${div.name}`);
      });
      console.log(`   (Total: ${divResponse.data.divisions.length} divisions)\n`);
      
      // Get sections for the first division
      const firstDivId = divResponse.data.divisions[0].id;
      console.log(`📊 Sections for Division ${firstDivId}:`);
      
      const secResponse = await axios.get(`${API_URL}/sections?divisionId=${firstDivId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (secResponse.data.sections && secResponse.data.sections.length > 0) {
        secResponse.data.sections.slice(0, 5).forEach(sec => {
          console.log(`   ID: ${sec.id}, Code: ${sec.code}, Name: ${sec.name}`);
        });
        console.log(`   (Total: ${secResponse.data.sections.length} sections)\n`);
      } else {
        console.log('   No sections found\n');
      }
      
      console.log('✅ Use these IDs for creating test users');
    } else {
      console.log('   No divisions found\n');
      console.log('⚠️  Warning: You may need to sync divisions from HRIS first');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data?.message || error.message);
  }
}

checkDivisions();
