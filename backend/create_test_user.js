/**
 * Create Test User for MySQL Endpoints Testing
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://slpaAdmin:HwIRrhnpRrFRzOek@payment.ydeh3.mongodb.net/SLPA';

async function createTestUser() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Check if test user already exists
    let testUser = await User.findOne({ email: 'test@slpa.lk' });
    
    if (testUser) {
      console.log('ℹ️  Test user already exists');
      console.log('📧 Email: test@slpa.lk');
      console.log('🔑 Password: test123');
    } else {
      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('test123', salt);

      // Create test user
      testUser = await User.create({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@slpa.lk',
        employeeId: 'TEST001',
        password: hashedPassword,
        role: 'super_admin',
        isActive: true
      });

      console.log('✅ Test user created successfully!');
      console.log('📧 Email: test@slpa.lk');
      console.log('🔑 Password: test123');
    }

    // Also try to update/create the default admin
    let adminUser = await User.findOne({ email: 'admin@slpa.lk' });
    if (!adminUser) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('admin123', salt);
      
      adminUser = await User.create({
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@slpa.lk',
        employeeId: 'ADMIN001',
        password: hashedPassword,
        role: 'super_admin',
        isActive: true
      });
      
      console.log('✅ Admin user created successfully!');
      console.log('📧 Email: admin@slpa.lk');
      console.log('🔑 Password: admin123');
    }

    console.log('\n✅ All test users ready!');
    console.log('\nYou can now login with:');
    console.log('  test@slpa.lk / test123');
    console.log('  admin@slpa.lk / admin123');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 MongoDB connection closed');
  }
}

createTestUser();
