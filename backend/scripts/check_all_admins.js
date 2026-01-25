require('dotenv').config();
const { MySQLUser } = require('../models/mysql');
const { sequelize } = require('../config/mysql');

const checkAllAdmins = async () => {
  try {
    console.log('🔍 Checking all admin users...');

    const admins = await MySQLUser.findAll({
      where: { email: 'admin@slpa.lk' }
    });

    console.log(`Found ${admins.length} admin users with email admin@slpa.lk:`);

    for (let i = 0; i < admins.length; i++) {
      const admin = admins[i];
      console.log(`\n--- Admin User ${i + 1} ---`);
      console.log(`   ID: ${admin.id}`);
      console.log(`   Email: ${admin.email}`);
      console.log(`   Employee ID: ${admin.employeeId}`);
      console.log(`   Role: ${admin.role}`);
      console.log(`   Password hash exists: ${admin.password ? 'Yes' : 'No'}`);
      console.log(`   Password hash length: ${admin.password ? admin.password.length : 0}`);
      console.log(`   Hash starts with: ${admin.password ? admin.password.substring(0, 15) + '...' : 'N/A'}`);
      console.log(`   Is Active: ${admin.isActive}`);
      console.log(`   Created At: ${admin.createdAt}`);

      // Test password
      if (admin.password) {
        const bcrypt = require('bcryptjs');
        const testPasswords = ['admin123', 'admin', 'password', '123456'];
        
        console.log(`   Testing passwords:`);
        for (const testPass of testPasswords) {
          const isValid = await bcrypt.compare(testPass, admin.password);
          console.log(`     '${testPass}': ${isValid}`);
        }
        
        // Show full hash for debugging
        console.log(`   Full hash: ${admin.password}`);
      }
    }

  } catch (error) {
    console.error('❌ Error checking admin users:', error);
  } finally {
    await sequelize.close();
  }
};

checkAllAdmins();