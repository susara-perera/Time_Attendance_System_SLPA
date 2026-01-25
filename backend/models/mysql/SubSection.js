const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/mysql');

const MySQLSubSection = sequelize.define('SubSection', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  division_id: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'division_id'
  },
  division_code: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'division_code'
  },
  division_name: {
    type: DataTypes.STRING(150),
    allowNull: true,
    field: 'division_name'
  },
  section_id: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'section_id'
  },
  section_code: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'section_code'
  },
  section_name: {
    type: DataTypes.STRING(150),
    allowNull: true,
    field: 'section_name'
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'sub_name'  // Map 'name' to actual database column 'sub_name'
  },
  code: {
    type: DataTypes.STRING(20),
    allowNull: false,
    field: 'sub_code'  // Map 'code' to actual database column 'sub_code'
  }
}, {
  tableName: 'subsections',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = MySQLSubSection;
