require('dotenv').config();
const { sequelize } = require('../config/mysql');

const checkTablesStructure = async () => {
  try {
    console.log('Checking table structures...\n');
    
    // Check users table
    console.log('=== USERS TABLE ===');
    const [usersColumns] = await sequelize.query("DESCRIBE users");
    usersColumns.forEach(col => {
      console.log(`${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Key ? `KEY: ${col.Key}` : ''}`);
    });
    
    // Check subsections table
    console.log('\n=== SUBSECTIONS TABLE ===');
    const [subsectionsColumns] = await sequelize.query("DESCRIBE subsections");
    subsectionsColumns.forEach(col => {
      console.log(`${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Key ? `KEY: ${col.Key}` : ''}`);
    });
    
    // Check if subsections table has data
    console.log('\n=== SUBSECTIONS COUNT ===');
    const [subsectionCount] = await sequelize.query("SELECT COUNT(*) as count FROM subsections");
    console.log(`Total subsections: ${subsectionCount[0].count}`);
    
    // Sample subsection data
    if (subsectionCount[0].count > 0) {
      console.log('\n=== SAMPLE SUBSECTIONS ===');
      const [sampleSubsections] = await sequelize.query("SELECT * FROM subsections LIMIT 3");
      sampleSubsections.forEach(sub => {
        console.log(`ID: ${sub.id}, Code: ${sub.code}, Name: ${sub.name || 'N/A'}`);
      });
    }
    
  } catch (error) {
    console.error('Error checking table structure:', error);
  } finally {
    await sequelize.close();
  }
};

checkTablesStructure();