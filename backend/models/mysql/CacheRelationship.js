/**
 * Cache Relationships Model
 * Stores parent-child relationships for O(1) traversal
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/mysql');

const CacheRelationship = sequelize.define('CacheRelationship', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  parent_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'Parent entity type'
  },
  parent_id: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: 'Parent entity ID'
  },
  child_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'Child entity type'
  },
  child_id: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: 'Child entity ID'
  },
  relationship_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'Type of relationship'
  }
}, {
  tableName: 'cache_relationships',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
  indexes: [
    {
      unique: true,
      fields: ['parent_type', 'parent_id', 'child_type', 'child_id'],
      name: 'unique_relationship'
    },
    { fields: ['parent_type', 'parent_id'] },
    { fields: ['child_type', 'child_id'] },
    { fields: ['relationship_type'] }
  ]
});

module.exports = CacheRelationship;
