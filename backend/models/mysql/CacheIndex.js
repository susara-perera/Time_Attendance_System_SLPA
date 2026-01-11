/**
 * Cache Index Model
 * Enables fast indexed lookups in cache
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/mysql');

const CacheIndex = sequelize.define('CacheIndex', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  entity_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'Type of entity'
  },
  entity_id: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: 'Unique identifier of entity'
  },
  index_key: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: 'Index field name'
  },
  index_value: {
    type: DataTypes.STRING(500),
    comment: 'Indexed value for fast lookup'
  },
  cache_key: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: 'Redis cache key'
  },
  metadata: {
    type: DataTypes.JSON,
    comment: 'Additional metadata'
  }
}, {
  tableName: 'cache_index',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { 
      unique: true,
      fields: ['entity_type', 'entity_id', 'index_key'],
      name: 'unique_entity_index'
    },
    { fields: ['entity_type'] },
    { fields: ['entity_id'] },
    { fields: ['index_key', 'index_value'] },
    { fields: ['cache_key'] },
    { fields: ['entity_type', 'index_value'] }
  ]
});

module.exports = CacheIndex;
