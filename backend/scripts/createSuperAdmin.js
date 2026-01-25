require('dotenv').config();
const { sequelize } = require('../config/mysql');
const bcrypt = require('bcryptjs');

async function checkAndCreateSuperAdmin() {
  try {
    console.log('🔍 Checking users table...');
    
    // Check if users table exists
    const [tables] = await sequelize.query("SHOW TABLES LIKE 'users'");
    if (tables.length === 0) {
      console.log('❌ Users table does not exist. Creating...');
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          firstName VARCHAR(50) NOT NULL,
          lastName VARCHAR(50) NOT NULL,
          email VARCHAR(255) NOT NULL UNIQUE,
          employeeId VARCHAR(20) NOT NULL UNIQUE,
          password VARCHAR(255) NOT NULL,
          role ENUM('super_admin', 'admin', 'clerk', 'administrative_clerk', 'employee') DEFAULT 'employee',
          divisionId INT NULL,
          sectionId INT NULL,
          phone VARCHAR(15) NULL,
          address TEXT NULL,
          dateOfJoining DATETIME DEFAULT CURRENT_TIMESTAMP,
          salary DECIMAL(10,2) NULL,
          designation VARCHAR(100) NULL,
          permissions JSON NULL,
          isActive BOOLEAN DEFAULT TRUE,
          lastLogin DATETIME NULL,
          profilePicture VARCHAR(255) NULL,
          passwordResetToken VARCHAR(255) NULL,
          passwordResetExpires DATETIME NULL,
          loginAttempts INT DEFAULT 0,
          lockUntil DATETIME NULL,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Users table created');
    }
    
    // Check all existing users
    const [users] = await sequelize.query('SELECT id, email, employeeId, role, firstName, lastName FROM users');
    console.log(`\n📊 Found ${users.length} users in database:`);
    users.forEach(u => {
      console.log(`   - ${u.email} (${u.firstName} ${u.lastName}) - Role: ${u.role} - ID: ${u.id}`);
    });
    
    // Check for root@slpa.lk
    const [existing] = await sequelize.query("SELECT * FROM users WHERE email = 'root@slpa.lk'");
    
    if (existing.length > 0) {
      console.log('\n⚠️  User root@slpa.lk already exists. Updating password...');
      const hashedPassword = await bcrypt.hash('root123', 10);
      await sequelize.query(
        "UPDATE users SET password = ?, role = 'super_admin', divisionId = 66, sectionId = 333, isActive = 1 WHERE email = 'root@slpa.lk'",
        { replacements: [hashedPassword] }
      );
      console.log('✅ Updated root@slpa.lk password to: root123');
    } else {
      console.log('\n🔧 Creating new super admin user...');
      const hashedPassword = await bcrypt.hash('root123', 10);
      const permissions = JSON.stringify({
        users: { create: true, read: true, update: true, delete: true },
        attendance: { create: true, read: true, update: true, delete: true },
        reports: { create: true, read: true, update: true, delete: true },
        divisions: { create: true, read: true, update: true, delete: true },
        settings: { create: true, read: true, update: true, delete: true }
      });
      
      await sequelize.query(
        `INSERT INTO users (firstName, lastName, email, employeeId, password, role, divisionId, sectionId, permissions, isActive)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        { 
          replacements: ['Super', 'Admin', 'root@slpa.lk', 'ROOT001', hashedPassword, 'super_admin', 66, 333, permissions, 1]
        }
      );
      console.log('✅ Created super admin user');
    }
    
    // Verify the user
    const [verified] = await sequelize.query("SELECT id, email, employeeId, role, firstName, lastName, isActive FROM users WHERE email = 'root@slpa.lk'");
    if (verified.length > 0) {
      console.log('\n✅ VERIFIED - User is ready:');
      console.log(`   Email: ${verified[0].email}`);
      console.log(`   Password: root123`);
      console.log(`   Role: ${verified[0].role}`);
      console.log(`   Employee ID: ${verified[0].employeeId}`);
      console.log(`   Active: ${verified[0].isActive}`);
      console.log(`   Division ID: 66`);
      console.log(`   Section ID: 333`);
      console.log('\n🚀 You can now login!');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkAndCreateSuperAdmin();
