require('dotenv').config();
const { MySQLUser, MySQLDivision, MySQLSection } = require('../models/mysql');
const { sequelize } = require('../config/mysql');
const bcrypt = require('bcryptjs');

const createDefaultAdmin = async () => {
  try {
    console.log('🔧 Creating default admin user...');

    // Check if admin already exists - if so, delete and recreate
    const existingAdmin = await MySQLUser.findOne({
      where: { email: 'admin@slpa.lk' }
    });

    if (existingAdmin) {
      console.log('🗑️  Deleting existing admin user...');
      await existingAdmin.destroy();
      console.log('✅ Existing admin user deleted');
    }

    // Find a valid division and section (use first available ones)
    let divisionId = null;
    let sectionId = null;

    try {
      const divisions = await MySQLDivision.findAll({ limit: 1 });
      if (divisions.length > 0) {
        divisionId = divisions[0].id;
        console.log(`   Using division: ${divisions[0].name} (ID: ${divisionId})`);

        // Find a section in this division
        const sections = await MySQLSection.findAll({
          where: { divisionId: divisionId },
          limit: 1
        });
        if (sections.length > 0) {
          sectionId = sections[0].id;
          console.log(`   Using section: ${sections[0].name} (ID: ${sectionId})`);
        }
      }
    } catch (error) {
      console.log('⚠️  Could not find valid division/section, creating user without them');
    }

    // Create the admin user with PLAIN password - let the model hook hash it
    console.log('🔐 Creating user with plain password (model hook will hash it automatically)');
    const plainPassword = 'admin123';

    // Create the admin user
    const adminUser = await MySQLUser.create({
      firstName: 'System',
      lastName: 'Administrator',
      email: 'admin@slpa.lk',
      employeeId: 'ADMIN001',
      password: plainPassword, // Plain password - will be hashed by beforeCreate hook
      role: 'super_admin',
      divisionId: divisionId,
      sectionId: sectionId,
      phone: null,
      isActive: true,
      permissions: {
        users: { create: true, read: true, update: true, delete: true },
        attendance: { create: true, read: true, update: true, delete: true },
        reports: { create: true, read: true, update: true, delete: true },
        divisions: { create: true, read: true, update: true, delete: true },
        settings: { create: true, read: true, update: true, delete: true }
      }
    });

    console.log('✅ Default admin user created successfully!');
    console.log(`   Email: ${adminUser.email}`);
    console.log(`   Password: admin123`);
    console.log(`   Role: ${adminUser.role}`);
    console.log(`   Employee ID: ${adminUser.employeeId}`);
    console.log(`   User ID: ${adminUser.id}`);

  } catch (error) {
    console.error('❌ Error creating default admin user:', error);
    console.error('Error details:', error.message);

    // If it's a foreign key constraint error, try creating without division/section
    if (error.message.includes('foreign key constraint')) {
      console.log('🔄 Retrying without division/section references...');

      try {
        const adminUser = await MySQLUser.create({
          firstName: 'System',
          lastName: 'Administrator',
          email: 'admin@slpa.lk',
          employeeId: 'ADMIN001',
          password: 'admin123', // Plain password - will be hashed by beforeCreate hook
          role: 'super_admin',
          divisionId: null,
          sectionId: null,
          phone: null,
          isActive: true,
          permissions: {
            users: { create: true, read: true, update: true, delete: true },
            attendance: { create: true, read: true, update: true, delete: true },
            reports: { create: true, read: true, update: true, delete: true },
            divisions: { create: true, read: true, update: true, delete: true },
            settings: { create: true, read: true, update: true, delete: true }
          }
        });

        console.log('✅ Default admin user created successfully (without division/section)!');
        console.log(`   Email: ${adminUser.email}`);
        console.log(`   Password: admin123`);
        console.log(`   Role: ${adminUser.role}`);
        console.log(`   Employee ID: ${adminUser.employeeId}`);
        console.log(`   User ID: ${adminUser.id}`);

      } catch (retryError) {
        console.error('❌ Failed to create admin user even without references:', retryError.message);
      }
    }
  } finally {
    await sequelize.close();
  }
};

// Run if called directly
if (require.main === module) {
  createDefaultAdmin()
    .then(() => {
      console.log('\n🎉 Script completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { createDefaultAdmin };