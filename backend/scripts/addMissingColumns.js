require('dotenv').config();
const { sequelize } = require('../config/mysql');

async function addMissingColumns() {
  try {
    console.log('🔄 Adding missing columns to existing tables...');
    
    // Add status column to audit_logs if it doesn't exist
    try {
      await sequelize.query(`
        ALTER TABLE audit_logs 
        ADD COLUMN IF NOT EXISTS status ENUM('success', 'failed', 'pending') DEFAULT 'success'
      `);
      console.log('✅ Added status column to audit_logs');
    } catch (err) {
      if (err.message.includes('Duplicate column')) {
        console.log('ℹ️  status column already exists in audit_logs');
      } else {
        console.error('⚠️  Error adding status column:', err.message);
      }
    }
    
    console.log('✅ Migration complete - no data was deleted');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

addMissingColumns();
