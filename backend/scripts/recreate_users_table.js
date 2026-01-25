const { sequelize } = require('../config/mysql');
const { MySQLUser, MySQLDivision, MySQLSection, MySQLSubSection } = require('../models/mysql');

const recreateUsersTable = async () => {
  try {
    console.log('Starting users table recreation...');
    
    // Drop the users table if it exists
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
    await sequelize.query('DROP TABLE IF EXISTS users');
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('Dropped existing users table');
    
    // Recreate the users table with all relationships
    await MySQLUser.sync({ force: true });
    console.log('Users table created successfully');
    
    // Create indexes for better performance
    await sequelize.query(`
      ALTER TABLE users 
      ADD INDEX idx_users_email (email),
      ADD INDEX idx_users_employee_id (employeeId),
      ADD INDEX idx_users_division (divisionId),
      ADD INDEX idx_users_section (sectionId),
      ADD INDEX idx_users_role (role),
      ADD INDEX idx_users_active (isActive)
    `);
    console.log('Added indexes to users table');
    
    console.log('Users table recreation completed successfully!');
    
  } catch (error) {
    console.error('Error recreating users table:', error);
    throw error;
  }
};

module.exports = { recreateUsersTable };

// Run if called directly
if (require.main === module) {
  recreateUsersTable()
    .then(() => {
      console.log('Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}