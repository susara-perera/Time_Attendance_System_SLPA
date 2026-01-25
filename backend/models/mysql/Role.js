const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/mysql');

const MySQLRole = sequelize.define('Role', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  value: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: true
    }
  },
  label: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: true,
    defaultValue: ''
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: ''
  },
  permissions: {
    type: DataTypes.JSON,
    defaultValue: {}
  }
}, {
  tableName: 'roles',
  timestamps: true,
  indexes: [
    { fields: ['value'], unique: true },
    { fields: ['label'] }
  ]
});

module.exports = MySQLRole;
