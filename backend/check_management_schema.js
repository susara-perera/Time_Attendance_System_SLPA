/**
 * Check management table schemas
 */

require('dotenv').config();
const { sequelize } = require('./models/mysql');

async function checkSchemas() {
  try {
    console.log('\n' + '='.repeat(60));
    console.log('📋 MANAGEMENT TABLES - COLUMN SCHEMA CHECK');
    console.log('='.repeat(60) + '\n');
    
    // Check divisions_sync
    console.log('🔹 divisions_sync:');
    const [divCols] = await sequelize.query('SHOW COLUMNS FROM divisions_sync');
    divCols.forEach(col => console.log(`   ${col.Field.padEnd(25)} ${col.Type}`));
    
    // Check sections_sync
    console.log('\n🔹 sections_sync:');
    const [secCols] = await sequelize.query('SHOW COLUMNS FROM sections_sync');
    secCols.forEach(col => console.log(`   ${col.Field.padEnd(25)} ${col.Type}`));
    
    // Check sub_sections
    console.log('\n🔹 sub_sections:');
    const [subCols] = await sequelize.query('SHOW COLUMNS FROM sub_sections');
    subCols.forEach(col => console.log(`   ${col.Field.padEnd(25)} ${col.Type}`));
    
    console.log('\n' + '='.repeat(60));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sequelize.close();
  }
}

checkSchemas();
