const { sequelize } = require('../../config/mysql');
const MySQLUser = require('./User');
const MySQLDivision = require('./Division');
const MySQLSection = require('./Section');
const MySQLRole = require('./Role');
const MySQLAuditLog = require('./AuditLog');
const MySQLAttendance = require('./Attendance');
const MySQLMeal = require('./Meal');
const MySQLSubSection = require('./SubSection');
const MySQLSettings = require('./Settings');
const SyncSchedule = require('./SyncSchedule');

// Import sync models
const DivisionSync = require('./DivisionSync')(sequelize);
const SectionSync = require('./SectionSync')(sequelize);
const EmployeeSync = require('./EmployeeSync')(sequelize);
const SyncLog = require('./SyncLog')(sequelize);

// Import cache models
const CacheMetadata = require('./CacheMetadata');
const CacheIndex = require('./CacheIndex');
const CacheRelationship = require('./CacheRelationship');
const CacheSyncLog = require('./CacheSyncLog');

// Import activity model
const RecentActivity = require('./RecentActivity')(sequelize);

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

MySQLUser.belongsTo(MySQLSubSection, {
  foreignKey: 'subsectionId',
  as: 'subsection',
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

MySQLSubSection.hasMany(MySQLUser, {
  foreignKey: 'subsectionId',
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

// Attendance associations
MySQLAttendance.belongsTo(MySQLUser, {
  foreignKey: 'userId',
  as: 'user'
});

MySQLUser.hasMany(MySQLAttendance, {
  foreignKey: 'userId',
  as: 'attendances'
});

// Meal associations
MySQLMeal.belongsTo(MySQLUser, {
  foreignKey: 'userId',
  as: 'user'
});

MySQLUser.hasMany(MySQLMeal, {
  foreignKey: 'userId',
  as: 'meals'
});

// Audit Log associations
MySQLAuditLog.belongsTo(MySQLUser, {
  foreignKey: 'userId',
  as: 'user'
});

MySQLUser.hasMany(MySQLAuditLog, {
  foreignKey: 'userId',
  as: 'auditLogs'
});

// SubSection associations
MySQLSubSection.belongsTo(MySQLSection, {
  foreignKey: 'parentSectionId',
  as: 'parentSection'
});

MySQLSection.hasMany(MySQLSubSection, {
  foreignKey: 'parentSectionId',
  as: 'subsections'
});

module.exports = {
  sequelize,
  MySQLUser,
  MySQLDivision,
  MySQLSection,
  MySQLRole,
  MySQLAuditLog,
  MySQLAttendance,
  MySQLMeal,
  MySQLSubSection,
  MySQLSettings,
  SyncSchedule,
  // Sync models
  DivisionSync,
  SectionSync,
  EmployeeSync,
  SyncLog,
  // Cache models
  CacheMetadata,
  CacheIndex,
  CacheRelationship,
  CacheSyncLog,
  // Activity model
  RecentActivity
};
