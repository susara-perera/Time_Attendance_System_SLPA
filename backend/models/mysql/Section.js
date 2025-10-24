const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/mysql');

const MySQLSection = sequelize.define('Section', {
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
  divisionId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Divisions',
      key: 'id'
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
  tableName: 'sections',
  timestamps: true,
  indexes: [
    { fields: ['code'] },
    { fields: ['name'] },
    { fields: ['divisionId'] },
    { fields: ['managerId'] }
  ]
});

module.exports = MySQLSection;
