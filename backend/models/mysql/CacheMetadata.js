/**
 * Cache Metadata Model
 * Tracks cache status, versions, and metadata
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/mysql');

const CacheMetadata = sequelize.define('CacheMetadata', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  cache_key: {
    type: DataTypes.STRING(255),
    unique: true,
    allowNull: false,
    comment: 'Unique identifier for cache entry'
  },
  entity_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'Type of cached entity'
  },
  record_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Number of records in cache'
  },
  data_size_bytes: {
    type: DataTypes.BIGINT,
    defaultValue: 0,
    comment: 'Approximate size in bytes'
  },
  last_sync_at: {
    type: DataTypes.DATE,
    comment: 'Last sync timestamp'
  },
  expires_at: {
    type: DataTypes.DATE,
    comment: 'Cache expiration timestamp'
  },
  version: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    comment: 'Cache version for invalidation'
  },
  is_valid: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Whether cache is valid'
  }
}, {
  tableName: 'cache_metadata',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['cache_key'] },
    { fields: ['entity_type'] },
    { fields: ['expires_at'] },
    { fields: ['is_valid'] },
    { fields: ['entity_type', 'is_valid'] }
  ]
});

module.exports = CacheMetadata;
