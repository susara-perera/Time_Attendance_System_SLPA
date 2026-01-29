const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/mysql');

const SyncSchedule = sequelize.define('SyncSchedule', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  task_id: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: 'Identifier for the sync/cache task'
  },
  task_name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  mode: {
    type: DataTypes.ENUM('manual', 'auto'),
    defaultValue: 'manual'
  },
  schedule_date: {
    type: DataTypes.DATEONLY, // YYYY-MM-DD
    allowNull: true
  },
  schedule_time: {
    type: DataTypes.TIME, // HH:MM:SS
    allowNull: true
  },
  last_run: {
    type: DataTypes.DATE,
    allowNull: true
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'idle' // idle, running, completed, error
  },
  last_message: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  date_range_start: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    comment: 'Start date for date-range specific tasks (like attendance cache)'
  },
  date_range_end: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    comment: 'End date for date-range specific tasks (like attendance cache)'
  },
  repeat_interval: {
    type: DataTypes.ENUM('none', 'every_30_seconds', 'every_minute', 'every_5_minutes', 'every_15_minutes', 'every_30_minutes', 'hourly', 'daily', 'weekly'),
    defaultValue: 'none',
    comment: 'Repeat interval for recurring schedules'
  },
  repeat_enabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Enable or disable recurring schedule'
  }
}, {
  tableName: 'sync_schedules',
  timestamps: true
});

module.exports = SyncSchedule;
