/**
 * Check attendance table schema
 */

require('dotenv').config();
const { sequelize } = require('./models/mysql');

async function checkAttendanceSchema() {
  try {
    console.log('\n' + '='.repeat(60));
    console.log('📋 ATTENDANCE TABLE SCHEMA CHECK');
    console.log('='.repeat(60) + '\n');
    
    // Check attendance table
    console.log('🔹 attendance table:');
    const [attCols] = await sequelize.query('SHOW COLUMNS FROM attendance');
    attCols.forEach(col => console.log(`   ${col.Field.padEnd(30)} ${col.Type}`));
    
    // Check row count
    const [countResult] = await sequelize.query('SELECT COUNT(*) as count FROM attendance');
    console.log(`\n📊 Total Records: ${countResult[0].count.toLocaleString()}`);
    
    // Sample query patterns
    console.log('\n📝 Common Query Patterns:');
    console.log('   1. Filter by date range + employee_ID (individual)');
    console.log('   2. Filter by date range + division → section → subsection (group)');
    
    console.log('\n' + '='.repeat(60));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sequelize.close();
  }
}

checkAttendanceSchema();
