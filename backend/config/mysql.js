const mysql = require('mysql2/promise');

// Simple MySQL connection for reports and attendance data
const createMySQLConnection = async () => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.MYSQL_HOST || 'localhost',
      port: process.env.MYSQL_PORT || 3306,
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'slpa_db'
    });
    
    console.log('✅ MySQL Connected successfully to database:', process.env.MYSQL_DATABASE || 'slpa_db');
    return connection;
  } catch (error) {
    console.error('❌ MySQL connection error:', error.message);
    throw error;
  }
};

// Test MySQL connection
const testMySQLConnection = async () => {
  try {
    const connection = await createMySQLConnection();
    await connection.ping();
    console.log('🔌 MySQL connection test successful');
    await connection.end();
    return true;
  } catch (error) {
    console.error('❌ MySQL connection test failed:', error.message);
    return false;
  }
};

module.exports = {
  createMySQLConnection,
  testMySQLConnection
};
