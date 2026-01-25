require('dotenv').config();
const { sequelize } = require('../config/mysql');

const addSubsectionIdColumn = async () => {
  try {
    console.log('Adding subsectionId column to users table...');
    
    // Check if column already exists
    const [results] = await sequelize.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'users' 
      AND COLUMN_NAME = 'subsectionId'
    `);
    
    if (results.length > 0) {
      console.log('subsectionId column already exists');
      return;
    }
    
    // Add the column
    await sequelize.query(`
      ALTER TABLE users 
      ADD COLUMN subsectionId INT(11) NULL,
      ADD INDEX idx_users_subsection (subsectionId),
      ADD CONSTRAINT fk_users_subsection 
        FOREIGN KEY (subsectionId) 
        REFERENCES subsections(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE
    `);
    
    console.log('subsectionId column added successfully!');
    
  } catch (error) {
    console.error('Error adding subsectionId column:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
};

module.exports = { addSubsectionIdColumn };

// Run if called directly
if (require.main === module) {
  addSubsectionIdColumn()
    .then(() => {
      console.log('Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}