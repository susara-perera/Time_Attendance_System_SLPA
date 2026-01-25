require('dotenv').config();
const { sequelize } = require('../config/mysql');

const cleanupTestData = async () => {
  try {
    console.log('Cleaning up test data...');
    
    // Delete test user if exists
    await sequelize.query("DELETE FROM users WHERE email = 'john.doe@test.com' OR employeeId = 'EMP001'");
    console.log('✅ Test users cleaned up');
    
  } catch (error) {
    console.error('Error cleaning up test data:', error);
  } finally {
    await sequelize.close();
  }
};

cleanupTestData();