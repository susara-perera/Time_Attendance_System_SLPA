const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI;
    
    if (!mongoURI) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }
    
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('MongoDB Connected:', mongoose.connection.host);
    
    // Create default super admin if not exists
    await createDefaultSuperAdmin();
    
  } catch (error) {
    console.error('Database connection error:', error.message);
    process.exit(1);
  }
};

const createDefaultSuperAdmin = async () => {
  try {
    const existingSuperAdmin = await User.findOne({ role: 'super_admin' });
    
    if (!existingSuperAdmin) {
      const hashedPassword = await bcrypt.hash(process.env.DEFAULT_ADMIN_PASSWORD || 'susara_perera', 10);
      
      const superAdmin = new User({
        firstName: 'Susara',
        lastName: 'Perera',
        email: process.env.DEFAULT_ADMIN_EMAIL || 'susara_perera@admin',
        employeeId: 'SP001',
        password: hashedPassword,
        role: 'super_admin',
        isActive: true,
        permissions: {
          users: { create: true, read: true, update: true, delete: true },
          attendance: { create: true, read: true, update: true, delete: true },
          reports: { create: true, read: true, update: true, delete: true },
          divisions: { create: true, read: true, update: true, delete: true },
          settings: { create: true, read: true, update: true, delete: true }
        }
      });
      
      await superAdmin.save();
      console.log('Default Super Admin created successfully');
      console.log('Login Email: susara_perera@admin');
      console.log('Login Password: susara_perera');
    }
  } catch (error) {
    console.error('Error creating default super admin:', error.message);
  }
};

module.exports = connectDB;
