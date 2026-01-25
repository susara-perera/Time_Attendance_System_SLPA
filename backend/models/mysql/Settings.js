const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/mysql');

const MySQLSettings = sequelize.define('Settings', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  key: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  value: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  type: {
    type: DataTypes.ENUM('string', 'number', 'boolean', 'json', 'date'),
    defaultValue: 'string'
  },
  category: {
    type: DataTypes.STRING(50),
    allowNull: true,
    defaultValue: 'general'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  isPublic: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'settings',
  timestamps: true,
  indexes: [
    { fields: ['key'], unique: true },
    { fields: ['category'] }
  ]
});

module.exports = MySQLSettings;
