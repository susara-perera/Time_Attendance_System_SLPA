const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const SectionSync = sequelize.define('SectionSync', {
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
    HIE_CODE_3: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Parent division code'
    },
    HIE_NAME: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Section name (Level 3)'
    },
    HIE_NAME_3: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Parent division name'
    },
    HIE_NAME_4: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: 'Section name in English'
    },
    HIE_NAME_SINHALA: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Section name in Sinhala'
    },
    HIE_NAME_TAMIL: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Section name in Tamil'
    },
    HIE_RELATIONSHIP: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Parent relationship (division)'
    },
    SECTION_ID: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Section ID'
    },
    DEF_LEVEL: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 4,
      comment: 'Hierarchy level (4 for sections)'
    },
    STATUS: {
      type: DataTypes.STRING(20),
      defaultValue: 'ACTIVE',
      comment: 'Status of section'
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
    tableName: 'sections_sync',
    timestamps: false,
    indexes: [
      { fields: ['HIE_CODE'], unique: true },
      { fields: ['HIE_CODE_3'] },
      { fields: ['HIE_NAME_4'] },
      { fields: ['SECTION_ID'] },
      { fields: ['synced_at'] },
      { fields: ['STATUS'] }
    ]
  });

  return SectionSync;
};
