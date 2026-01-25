require('dotenv').config();
const { MySQLUser } = require('../models/mysql');
const { sequelize } = require('../config/mysql');
const bcrypt = require('bcryptjs');

const debugAdminUser = async () => {
  try {
    console.log('🔍 Debugging admin user...');

    // Find the admin user
    const adminUser = await MySQLUser.findOne({
      where: { email: 'admin@slpa.lk' }
    });

    if (!adminUser) {
      console.log('❌ Admin user not found!');
      return;
    }

    console.log('✅ Admin user found:');
    console.log(`   ID: ${adminUser.id}`);
    console.log(`   Email: ${adminUser.email}`);
    console.log(`   Employee ID: ${adminUser.employeeId}`);
    console.log(`   Role: ${adminUser.role}`);
    console.log(`   Password hash exists: ${adminUser.password ? 'Yes' : 'No'}`);
    console.log(`   Password hash length: ${adminUser.password ? adminUser.password.length : 0}`);
    console.log(`   Is Active: ${adminUser.isActive}`);

    // Test password comparison directly
    console.log('\n🔐 Testing password comparison...');
    const testPassword = 'admin123';
    const isValid = await adminUser.comparePassword(testPassword);
    console.log(`   Password 'admin123' valid: ${isValid}`);

    // Also test with bcrypt directly
    const bcryptValid = await bcrypt.compare(testPassword, adminUser.password);
    console.log(`   Direct bcrypt comparison: ${bcryptValid}`);

    // Show first few characters of hash for debugging
    if (adminUser.password) {
      console.log(`   Hash starts with: ${adminUser.password.substring(0, 10)}...`);
    }

  } catch (error) {
    console.error('❌ Error debugging admin user:', error);
  } finally {
    await sequelize.close();
  }
};

debugAdminUser();