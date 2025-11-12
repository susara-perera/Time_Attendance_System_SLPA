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
    // Ensure latest indexes after connection (handles legacy field name changes)
    await ensureSubSectionIndexes();
    
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

// --- Index maintenance helpers ---
// We keep this at bottom to avoid circular requires during model compilation.
async function ensureSubSectionIndexes() {
  try {
    // Defer requiring the model until after connection is established
    const SubSection = require('../models/SubSection');

    // Force Mongoose to build declared indexes (non-blocking)
    await SubSection.init();

    const collection = mongoose.connection.collection('subsections');
    const indexes = await collection.indexes();

    // Detect legacy index that used old path 'subSection.code'
    const legacyIndex = indexes.find(idx => idx.key && idx.key['parentSection.id'] === 1 && idx.key['subSection.code'] === 1);
    if (legacyIndex) {
      console.log('⚠️  Found legacy unique index using subSection.code. Dropping legacy index:', legacyIndex.name);
      try {
        await collection.dropIndex(legacyIndex.name);
        console.log('✅ Dropped legacy subSection.code index');
      } catch (dropErr) {
        console.error('❌ Failed to drop legacy subSection.code index:', dropErr.message);
      }
    }

    // Refresh index list after potential drop
    const updatedIndexes = await collection.indexes();
    const correctIndex = updatedIndexes.find(idx => idx.key && idx.key['parentSection.id'] === 1 && idx.key['subSection.sub_hie_code'] === 1);
    if (!correctIndex) {
      console.log('🔧 Creating missing unique index for parentSection.id + subSection.sub_hie_code');
      try {
        await collection.createIndex(
          { 'parentSection.id': 1, 'subSection.sub_hie_code': 1 },
          {
            unique: true,
            name: 'parentSection.id_1_subSection.sub_hie_code_1',
            // Only enforce uniqueness for docs that actually have a non-empty code
            partialFilterExpression: { 'subSection.sub_hie_code': { $type: 'string' } }
          }
        );
        console.log('✅ Created unique index parentSection.id + subSection.sub_hie_code');
      } catch (createErr) {
        console.error('❌ Failed creating unique index parentSection.id + subSection.sub_hie_code:', createErr.message);
      }
    } else {
      console.log('🔍 Correct unique index already present for parentSection.id + subSection.sub_hie_code');
    }
  } catch (err) {
    console.error('❌ Error ensuring SubSection indexes:', err.message);
  }
}
