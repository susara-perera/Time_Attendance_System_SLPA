const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize } = require('../config/mysql');

async function run() {
  try {
    console.log('[resetUserTables] Dropping and recreating tables...');
    
    // Disable foreign key checks temporarily
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
    
    // Drop tables (excluding attendance - keeping it intact)
    const dropQueries = [
      "DROP TABLE IF EXISTS audit_logs",
      "DROP TABLE IF EXISTS meals",
      "DROP TABLE IF EXISTS users",
      "DROP TABLE IF EXISTS sections",
      "DROP TABLE IF EXISTS divisions",
      "DROP TABLE IF EXISTS roles"
    ];

    for (const sql of dropQueries) {
      console.log('Executing:', sql);
      await sequelize.query(sql);
    }

    // Re-enable foreign key checks
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');

    console.log('\n[resetUserTables] Creating fresh tables...');

    // Create divisions table
    await sequelize.query(`
      CREATE TABLE divisions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        code VARCHAR(10) NOT NULL UNIQUE,
        description TEXT NULL,
        workingHours JSON NULL,
        isActive TINYINT(1) NOT NULL DEFAULT 1,
        managerId INT NULL,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_code (code),
        INDEX idx_name (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Created divisions table');

    // Create sections table
    await sequelize.query(`
      CREATE TABLE sections (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        code VARCHAR(10) NOT NULL UNIQUE,
        description TEXT NULL,
        divisionId INT NOT NULL,
        isActive TINYINT(1) NOT NULL DEFAULT 1,
        managerId INT NULL,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_code (code),
        INDEX idx_name (name),
        INDEX idx_divisionId (divisionId),
        FOREIGN KEY (divisionId) REFERENCES divisions(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Created sections table');

    // Create roles table
    await sequelize.query(`
      CREATE TABLE roles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        value VARCHAR(50) NOT NULL UNIQUE,
        label VARCHAR(100) NOT NULL,
        name VARCHAR(100) NOT NULL,
        description TEXT NULL,
        permissions JSON NULL,
        isActive TINYINT(1) NOT NULL DEFAULT 1,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_value (value)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Created roles table');

    // Create users table
    await sequelize.query(`
      CREATE TABLE users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        firstName VARCHAR(50) NOT NULL,
        lastName VARCHAR(50) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        employeeId VARCHAR(20) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role ENUM('super_admin', 'admin', 'clerk', 'administrative_clerk', 'employee') NOT NULL DEFAULT 'employee',
        divisionId INT NULL,
        sectionId INT NULL,
        phone VARCHAR(15) NULL,
        address TEXT NULL,
        dateOfJoining DATE NULL,
        salary DECIMAL(10, 2) NULL,
        designation VARCHAR(100) NULL,
        permissions JSON NULL,
        isActive TINYINT(1) NOT NULL DEFAULT 1,
        lastLogin DATETIME NULL,
        profilePicture VARCHAR(255) NULL,
        passwordResetToken VARCHAR(255) NULL,
        passwordResetExpires DATETIME NULL,
        loginAttempts INT NOT NULL DEFAULT 0,
        lockUntil DATETIME NULL,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_email (email),
        INDEX idx_employeeId (employeeId),
        INDEX idx_divisionId (divisionId),
        INDEX idx_sectionId (sectionId),
        INDEX idx_role (role),
        FOREIGN KEY (divisionId) REFERENCES divisions(id) ON DELETE SET NULL,
        FOREIGN KEY (sectionId) REFERENCES sections(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Created users table');

    // Create audit_logs table
    await sequelize.query(`
      CREATE TABLE audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NULL,
        action VARCHAR(100) NOT NULL,
        entity JSON NULL,
        category VARCHAR(50) NULL,
        severity VARCHAR(20) NULL,
        description TEXT NULL,
        details TEXT NULL,
        changes JSON NULL,
        metadata JSON NULL,
        status VARCHAR(20) NULL DEFAULT 'completed',
        requiresReview TINYINT(1) NULL DEFAULT 0,
        reviewedBy INT NULL,
        reviewedAt DATETIME NULL,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_userId (userId),
        INDEX idx_action (action),
        INDEX idx_createdAt (createdAt),
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Created audit_logs table');

    // Create meals table
    await sequelize.query(`
      CREATE TABLE meals (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        mealType ENUM('breakfast', 'lunch', 'dinner') NOT NULL,
        mealDate DATE NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        notes TEXT NULL,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_userId (userId),
        INDEX idx_mealDate (mealDate),
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Created meals table');

    // Seed default roles
    const defaultRoles = [
      { value: 'super_admin', label: 'Super Admin', name: 'Super Admin', description: 'Full system access' },
      { value: 'admin', label: 'Administrator', name: 'Administrator', description: 'Administrative access' },
      { value: 'clerk', label: 'Clerk', name: 'Clerk', description: 'Clerk access' },
      { value: 'administrative_clerk', label: 'Administrative Clerk', name: 'Administrative Clerk', description: 'Administrative Clerk access' },
      { value: 'employee', label: 'Employee', name: 'Employee', description: 'Basic employee access' }
    ];

    for (const role of defaultRoles) {
      await sequelize.query(
        'INSERT INTO roles (value, label, name, description) VALUES (?, ?, ?, ?)',
        {
          replacements: [role.value, role.label, role.name, role.description]
        }
      );
    }
    console.log('✅ Seeded default roles');

    // Create default super admin
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('root123', 10);
    
    await sequelize.query(
      'INSERT INTO users (firstName, lastName, email, employeeId, password, role) VALUES (?, ?, ?, ?, ?, ?)',
      {
        replacements: ['Root', 'Admin', 'root@slpa.lk', 'root', hashedPassword, 'super_admin']
      }
    );
    console.log('✅ Created default super admin (root@slpa.lk / root123)');

    console.log('\n[resetUserTables] ✅ All tables reset successfully!');
    process.exit(0);
  } catch (err) {
    console.error('[resetUserTables] ❌ Error:', err);
    process.exit(1);
  }
}

run();
