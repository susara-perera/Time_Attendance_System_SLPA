require('dotenv').config();
const { sequelize } = require('../config/mysql');

async function addDivisionSectionColumns() {
  try {
    console.log('Adding division/section name and code columns to users table...');
    
    // Add division columns
    await sequelize.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS divisionCode VARCHAR(50) NULL AFTER divisionId,
      ADD COLUMN IF NOT EXISTS divisionName VARCHAR(150) NULL AFTER divisionCode
    `);
    console.log('✅ Added divisionCode and divisionName columns');
    
    // Add section columns
    await sequelize.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS sectionCode VARCHAR(50) NULL AFTER sectionId,
      ADD COLUMN IF NOT EXISTS sectionName VARCHAR(150) NULL AFTER sectionCode
    `);
    console.log('✅ Added sectionCode and sectionName columns');
    
    // Add subsection columns
    await sequelize.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS subsectionCode VARCHAR(50) NULL AFTER subsectionId,
      ADD COLUMN IF NOT EXISTS subsectionName VARCHAR(100) NULL AFTER subsectionCode
    `);
    console.log('✅ Added subsectionCode and subsectionName columns');
    
    console.log('\n✅ All columns added successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

addDivisionSectionColumns();
