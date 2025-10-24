const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/mysql');

const MySQLDivision = sequelize.define('Division', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [1, 100]
    }
  },
  code: {
    type: DataTypes.STRING(10),
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: true,
      len: [1, 10]
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  workingHours: {
    type: DataTypes.JSON,
    defaultValue: {
      monday: { start: '08:00', end: '17:00', isWorkingDay: true },
      tuesday: { start: '08:00', end: '17:00', isWorkingDay: true },
      wednesday: { start: '08:00', end: '17:00', isWorkingDay: true },
      thursday: { start: '08:00', end: '17:00', isWorkingDay: true },
      friday: { start: '08:00', end: '17:00', isWorkingDay: true },
      saturday: { start: '08:00', end: '12:00', isWorkingDay: false },
      sunday: { start: '08:00', end: '17:00', isWorkingDay: false }
    }
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  managerId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id'
    }
  }
}, {
  tableName: 'divisions',
  timestamps: true,
  indexes: [
    { fields: ['code'] },
    { fields: ['name'] },
    { fields: ['managerId'] }
  ]
});

module.exports = MySQLDivision;
