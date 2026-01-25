require('dotenv').config();
const { sequelize } = require('../config/mysql');

async function resetDatabase() {
  try {
    console.log('🔄 Resetting database tables...');
    
    // Drop all tables
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0;');
    
    const tables = ['audit_logs', 'users', 'roles', 'attendance', 'meals', 'subsections', 'settings'];
    for (const table of tables) {
      try {
        await sequelize.query(`DROP TABLE IF EXISTS \`${table}\`;`);
        console.log(`✅ Dropped table: ${table}`);
      } catch (err) {
        console.log(`⚠️  Table ${table} doesn't exist or couldn't be dropped`);
      }
    }
    
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1;');
    
    console.log('✅ Database reset complete');
    console.log('ℹ️  Restart the server to recreate tables with correct schema');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Database reset failed:', error);
    process.exit(1);
  }
}

resetDatabase();
