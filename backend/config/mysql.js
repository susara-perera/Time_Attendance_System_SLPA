const mysql = require('mysql2/promise');
const { Sequelize } = require('sequelize');

// Sequelize instance for ORM operations
const sequelize = new Sequelize(
  process.env.MYSQL_DATABASE || 'slpa_db',
  process.env.MYSQL_USER || 'root',
  process.env.MYSQL_PASSWORD || '',
  {
    host: process.env.MYSQL_HOST || 'localhost',
    port: process.env.MYSQL_PORT || 3306,
    dialect: 'mysql',
    logging: false, // Set to console.log to see SQL queries
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

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
  sequelize,
  mysqlSequelize: sequelize, // Alias for compatibility
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

  const ddlMealBookings = `
    CREATE TABLE IF NOT EXISTS meal_bookings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id VARCHAR(50) NOT NULL,
      employee_id VARCHAR(50) NULL,
      employee_name VARCHAR(150) NULL,
      division_id VARCHAR(50) NOT NULL,
      division_name VARCHAR(150) NULL,
      section_id VARCHAR(50) NOT NULL,
      section_name VARCHAR(150) NULL,
      meal_date DATE NOT NULL,
      meal_type VARCHAR(50) NOT NULL,
      quantity INT NOT NULL DEFAULT 1,
      special_requirements TEXT NULL,
      status VARCHAR(20) DEFAULT 'confirmed',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_user_id (user_id),
      INDEX idx_meal_date (meal_date),
      INDEX idx_division_id (division_id),
      INDEX idx_section_id (section_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  let conn;
  try {
    conn = await createMySQLConnection();
    await conn.execute(ddlSubsections);
    console.log('🛠️  Ensured MySQL table exists: subsections');
    await conn.execute(ddlTransfers);
    console.log('🛠️  Ensured MySQL table exists: subsection_transfers');
    await conn.execute(ddlMealBookings);
    console.log('🛠️  Ensured MySQL table exists: meal_bookings');
    
    const ddlMealPackageEmployees = `
      CREATE TABLE IF NOT EXISTS meal_package_employees (
        id INT AUTO_INCREMENT PRIMARY KEY,
        employee_id VARCHAR(50) NOT NULL UNIQUE,
        employee_name VARCHAR(150) NULL,
        email VARCHAR(150) NULL,
        division_id VARCHAR(50) NULL,
        division_name VARCHAR(150) NULL,
        section_id VARCHAR(50) NULL,
        section_name VARCHAR(150) NULL,
        subsection_id INT NULL,
        subsection_name VARCHAR(100) NULL,
        added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        added_by VARCHAR(50) NULL,
        employee_data JSON NULL,
        INDEX idx_employee_id (employee_id),
        INDEX idx_division_id (division_id),
        INDEX idx_section_id (section_id),
        INDEX idx_subsection_id (subsection_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    await conn.execute(ddlMealPackageEmployees);
    console.log('🛠️  Ensured MySQL table exists: meal_package_employees');
    
    const ddlMoneyAllowanceEmployees = `
      CREATE TABLE IF NOT EXISTS money_allowance_employees (
        id INT AUTO_INCREMENT PRIMARY KEY,
        employee_id VARCHAR(50) NOT NULL UNIQUE,
        employee_name VARCHAR(150) NULL,
        email VARCHAR(150) NULL,
        division_id VARCHAR(50) NULL,
        division_name VARCHAR(150) NULL,
        section_id VARCHAR(50) NULL,
        section_name VARCHAR(150) NULL,
        subsection_id INT NULL,
        subsection_name VARCHAR(100) NULL,
        allowance_amount DECIMAL(10,2) DEFAULT 0.00,
        added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        added_by VARCHAR(50) NULL,
        employee_data JSON NULL,
        INDEX idx_employee_id (employee_id),
        INDEX idx_division_id (division_id),
        INDEX idx_section_id (section_id),
        INDEX idx_subsection_id (subsection_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    await conn.execute(ddlMoneyAllowanceEmployees);
    console.log('🛠️  Ensured MySQL table exists: money_allowance_employees');

    // Create transferred_employees table for sub-section transfers
    const ddlTransferredEmployees = `
      CREATE TABLE IF NOT EXISTS transferred_employees (
        id INT AUTO_INCREMENT PRIMARY KEY,
        employee_id VARCHAR(50) NOT NULL COMMENT 'Employee ID from HRIS',
        employee_name VARCHAR(255) COMMENT 'Employee full name',
        division_code VARCHAR(50) COMMENT 'Division code',
        division_name VARCHAR(255) COMMENT 'Division name',
        section_code VARCHAR(50) COMMENT 'Section code',
        section_name VARCHAR(255) COMMENT 'Section name',
        sub_section_id INT NOT NULL COMMENT 'FK to sub_sections.id',
        sub_hie_code VARCHAR(50) COMMENT 'Sub-section code',
        sub_hie_name VARCHAR(255) COMMENT 'Sub-section name',
        transferred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'When employee was transferred',
        transferred_by VARCHAR(100) COMMENT 'User ID who performed transfer',
        recalled_at DATETIME NULL COMMENT 'When transfer was recalled',
        recalled_by VARCHAR(100) COMMENT 'User ID who recalled transfer',
        transferred_status BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'TRUE=currently transferred, FALSE=recalled',
        employee_data JSON COMMENT 'Full employee object from HRIS',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_employee_id (employee_id),
        INDEX idx_sub_section_id (sub_section_id),
        INDEX idx_transferred_status (transferred_status),
        INDEX idx_employee_sub (employee_id, sub_section_id),
        UNIQUE KEY uk_employee_subsection (employee_id, sub_section_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Employee transfers to sub-sections with status tracking';
    `;
    await conn.execute(ddlTransferredEmployees);
    console.log('🛠️  Ensured MySQL table exists: transferred_employees');

    // Create sync tables for HRIS data
    const fs = require('fs');
    const path = require('path');
    const syncTablesSQL = path.join(__dirname, 'createSyncTables.sql');
    
    if (fs.existsSync(syncTablesSQL)) {
      const sqlContent = fs.readFileSync(syncTablesSQL, 'utf8');
      // Split by semicolon and execute each statement
      const statements = sqlContent
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));
      
      for (const statement of statements) {
        if (statement.toUpperCase().includes('CREATE TABLE') || 
            statement.toUpperCase().includes('INSERT INTO')) {
          try {
            await conn.execute(statement);
          } catch (err) {
            // Ignore errors for tables that already exist
            if (!err.message.includes('already exists')) {
              console.warn('⚠️  SQL execution warning:', err.message);
            }
          }
        }
      }
      console.log('🛠️  Ensured MySQL sync tables exist (divisions_sync, sections_sync, employees_sync, sync_logs)');
    }
  } catch (err) {
    console.error('❌ Failed ensuring MySQL schema:', err.message);
  } finally {
    if (conn) await conn.end();
  }
}
