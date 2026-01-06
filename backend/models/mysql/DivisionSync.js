const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const DivisionSync = sequelize.define('DivisionSync', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    HIE_CODE: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      comment: 'Hierarchy code from HRIS'
    },
    HIE_NAME: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: 'Division name in English'
    },
    HIE_NAME_SINHALA: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Division name in Sinhala'
    },
    HIE_NAME_TAMIL: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Division name in Tamil'
    },
    HIE_RELATIONSHIP: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Parent relationship'
    },
    DEF_LEVEL: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 3,
      comment: 'Hierarchy level (3 for divisions)'
    },
    STATUS: {
      type: DataTypes.STRING(20),
      defaultValue: 'ACTIVE',
      comment: 'Status of division'
    },
    DESCRIPTION: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Additional description'
    },
    synced_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      comment: 'Last sync timestamp'
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'created_at'
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'updated_at'
    }
  }, {
    tableName: 'divisions_sync',
    timestamps: false, // We handle timestamps manually
    indexes: [
      { fields: ['HIE_CODE'], unique: true },
      { fields: ['HIE_NAME'] },
      { fields: ['synced_at'] },
      { fields: ['STATUS'] }
    ]
  });

  return DivisionSync;
};
