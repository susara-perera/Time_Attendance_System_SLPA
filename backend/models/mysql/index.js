const { sequelize } = require('../../config/mysql');
const MySQLUser = require('./User');
const MySQLDivision = require('./Division');
const MySQLSection = require('./Section');

// Define associations
MySQLUser.belongsTo(MySQLDivision, { 
  foreignKey: 'divisionId', 
  as: 'division',
  allowNull: true 
});

MySQLUser.belongsTo(MySQLSection, { 
  foreignKey: 'sectionId', 
  as: 'section',
  allowNull: true 
});

MySQLDivision.hasMany(MySQLUser, { 
  foreignKey: 'divisionId', 
  as: 'users' 
});

MySQLDivision.hasMany(MySQLSection, { 
  foreignKey: 'divisionId', 
  as: 'sections' 
});

MySQLSection.belongsTo(MySQLDivision, { 
  foreignKey: 'divisionId', 
  as: 'division' 
});

MySQLSection.hasMany(MySQLUser, { 
  foreignKey: 'sectionId', 
  as: 'users' 
});

// Manager relationships
MySQLDivision.belongsTo(MySQLUser, { 
  foreignKey: 'managerId', 
  as: 'manager',
  allowNull: true 
});

MySQLSection.belongsTo(MySQLUser, { 
  foreignKey: 'managerId', 
  as: 'manager',
  allowNull: true 
});

module.exports = {
  sequelize,
  MySQLUser,
  MySQLDivision,
  MySQLSection
};
