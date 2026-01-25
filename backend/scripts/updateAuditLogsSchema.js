require('dotenv').config();
const { sequelize } = require('../config/mysql');

async function updateAuditLogsTable() {
  try {
    console.log('🔄 Updating audit_logs table schema...');
    
    // Make userId nullable
    await sequelize.query('ALTER TABLE audit_logs MODIFY userId INT NULL');
    console.log('✅ Updated userId to allow NULL');
    
    console.log('✅ Schema update complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Schema update failed:', error.message);
    process.exit(1);
  }
}

updateAuditLogsTable();
