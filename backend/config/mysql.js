const mysql = require('mysql2/promise');

// Simple MySQL connection for reports and attendance data
const createMySQLConnection = async () => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.MYSQL_HOST || 'localhost',
      port: process.env.MYSQL_PORT || 3306,
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'slpa_db',
      connectTimeout: 5000, // 5 second timeout
      enableKeepAlive: true,
      keepAliveInitialDelay: 0
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
  testMySQLConnection,
  ensureMySQLSchema
};

// Ensure MySQL schema objects required by the app exist
async function ensureMySQLSchema() {
  const ddlSubsections = `
    CREATE TABLE IF NOT EXISTS subsections (
      id INT AUTO_INCREMENT PRIMARY KEY,
      division_id VARCHAR(50) NOT NULL,
      division_code VARCHAR(50) NULL,
      division_name VARCHAR(150) NULL,
      section_id VARCHAR(50) NOT NULL,
      section_code VARCHAR(50) NULL,
      section_name VARCHAR(150) NULL,
      sub_name VARCHAR(100) NOT NULL,
      sub_code VARCHAR(20) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_section_subcode (section_id, sub_code),
      INDEX idx_section_id (section_id),
      INDEX idx_division_id (division_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  const ddlTransfers = `
    CREATE TABLE IF NOT EXISTS subsection_transfers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      employee_id VARCHAR(50) NOT NULL,
      employee_name VARCHAR(150) NULL,
      division_code VARCHAR(50) NULL,
      division_name VARCHAR(150) NULL,
      section_code VARCHAR(50) NULL,
      section_name VARCHAR(150) NULL,
      sub_section_id INT NOT NULL,
      sub_hie_code VARCHAR(20) NULL,
      sub_hie_name VARCHAR(100) NULL,
      transferred_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      transferred_by VARCHAR(50) NULL,
      employee_data JSON NULL,
      UNIQUE KEY uniq_emp_sub (employee_id, sub_section_id),
      INDEX idx_sub_section_id (sub_section_id),
      INDEX idx_employee_id (employee_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  let conn;
  try {
    conn = await createMySQLConnection();
    await conn.execute(ddlSubsections);
    console.log('🛠️  Ensured MySQL table exists: subsections');
  await conn.execute(ddlTransfers);
  console.log('🛠️  Ensured MySQL table exists: subsection_transfers');
  } catch (err) {
    console.error('❌ Failed ensuring MySQL schema:', err.message);
  } finally {
    if (conn) await conn.end();
  }
}
