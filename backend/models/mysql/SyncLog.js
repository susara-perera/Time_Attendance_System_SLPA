const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const SyncLog = sequelize.define('SyncLog', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    sync_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'Type: divisions, sections, employees, full'
    },
    sync_status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      comment: 'Status: started, completed, failed'
    },
    records_synced: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Number of records synced'
    },
    records_added: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Number of new records added'
    },
    records_updated: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Number of records updated'
    },
    records_failed: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Number of records that failed'
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Error details if failed'
    },
    started_at: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: 'Sync start time'
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Sync completion time'
    },
    duration_seconds: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Duration in seconds'
    },
    triggered_by: {
      type: DataTypes.STRING(50),
      defaultValue: 'system',
      comment: 'Who triggered: system, manual, user_id'
    },
    sync_details: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Additional sync details'
    }
  }, {
    tableName: 'sync_logs',
    timestamps: false,
    indexes: [
      { fields: ['sync_type'] },
      { fields: ['sync_status'] },
      { fields: ['started_at'] }
    ]
  });

  return SyncLog;
};
