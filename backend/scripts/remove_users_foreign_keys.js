require('dotenv').config();
const { sequelize } = require('../config/mysql');

async function removeForeignKeys() {
  try {
    console.log('Removing foreign key constraints from users table...');
    
    // First, check what constraints exist
    const [constraints] = await sequelize.query(`
      SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = 'slpa_db'
        AND TABLE_NAME = 'users'
        AND REFERENCED_TABLE_NAME IS NOT NULL
    `);
    
    console.log('\n📋 Current foreign key constraints:');
    constraints.forEach(c => {
      console.log(`  ${c.CONSTRAINT_NAME}: ${c.COLUMN_NAME} -> ${c.REFERENCED_TABLE_NAME}`);
    });
    
    // Drop foreign key constraints
    if (constraints.length > 0) {
      console.log('\n🔧 Dropping foreign key constraints...');
      
      for (const constraint of constraints) {
        try {
          await sequelize.query(`
            ALTER TABLE users DROP FOREIGN KEY ${constraint.CONSTRAINT_NAME}
          `);
          console.log(`  ✅ Dropped: ${constraint.CONSTRAINT_NAME}`);
        } catch (err) {
          console.log(`  ⚠️  Could not drop ${constraint.CONSTRAINT_NAME}: ${err.message}`);
        }
      }
    }
    
    // Now change divisionId, sectionId, subsectionId to VARCHAR to allow HRIS IDs
    console.log('\n🔧 Changing ID columns to VARCHAR to support HRIS IDs...');
    
    await sequelize.query(`
      ALTER TABLE users
      MODIFY COLUMN divisionId VARCHAR(50) NULL,
      MODIFY COLUMN sectionId VARCHAR(50) NULL,
      MODIFY COLUMN subsectionId VARCHAR(50) NULL
    `);
    
    console.log('✅ Changed divisionId, sectionId, subsectionId to VARCHAR(50)');
    
    console.log('\n✅ All foreign key constraints removed and columns updated!');
    console.log('   Users table now supports HRIS string IDs (e.g., "mysql_div_6")');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

removeForeignKeys();
