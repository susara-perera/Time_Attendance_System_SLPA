require('dotenv').config();
const { MySQLUser } = require('../models/mysql');

async function cleanupTestUser() {
  try {
    console.log('Deleting test user...');
    
    const deleted = await MySQLUser.destroy({
      where: {
        email: 'test.user@slpa.lk'
      }
    });
    
    console.log(`✅ Deleted ${deleted} user(s) with email test.user@slpa.lk`);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

cleanupTestUser();
