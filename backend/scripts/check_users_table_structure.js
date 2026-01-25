require('dotenv').config();
const { sequelize } = require('../config/mysql');

async function checkUsersTable() {
  try {
    console.log('Checking users table structure...');
    
    const [columns] = await sequelize.query(`
      DESCRIBE users
    `);
    
    console.log('\n📋 Users table columns:');
    columns.forEach(col => {
      console.log(`  ${col.Field} - ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Key ? `(${col.Key})` : ''}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkUsersTable();
