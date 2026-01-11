/**
 * Cache Sync Log Model
 * Tracks cache synchronization operations
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/mysql');

const CacheSyncLog = sequelize.define('CacheSyncLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  sync_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'Type of sync operation'
  },
  entity_types: {
    type: DataTypes.TEXT,
    comment: 'Comma-separated list of synced entities'
  },
  records_synced: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  indexes_built: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  duration_ms: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'completed',
    comment: 'Status of sync operation'
  },
  error_message: {
    type: DataTypes.TEXT,
    comment: 'Error details if failed'
  },
  triggered_by: {
    type: DataTypes.STRING(100),
    comment: 'User or system that triggered sync'
  },
  started_at: {
    type: DataTypes.DATE,
    allowNull: false
  },
  completed_at: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'cache_sync_log',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
  indexes: [
    { fields: ['sync_type'] },
    { fields: ['status'] },
    { fields: ['started_at'] }
  ]
});

module.exports = CacheSyncLog;
