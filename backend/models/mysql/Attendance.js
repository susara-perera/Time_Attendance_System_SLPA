const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/mysql');

const MySQLAttendance = sequelize.define('Attendance', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  checkIn: {
    type: DataTypes.DATE,
    allowNull: true
  },
  checkOut: {
    type: DataTypes.DATE,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('present', 'absent', 'late', 'half_day', 'on_leave', 'holiday', 'weekend'),
    defaultValue: 'present'
  },
  workHours: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    defaultValue: 0
  },
  overtimeHours: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    defaultValue: 0
  },
  breakHours: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    defaultValue: 0
  },
  lateMinutes: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0
  },
  earlyLeaveMinutes: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0
  },
  shiftId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  shiftName: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  shiftStart: {
    type: DataTypes.TIME,
    allowNull: true
  },
  shiftEnd: {
    type: DataTypes.TIME,
    allowNull: true
  },
  location: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  latitude: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: true
  },
  longitude: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: true
  },
  deviceId: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  approvedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  approvedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  isApproved: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  dataSource: {
    type: DataTypes.STRING(50),
    allowNull: true,
    defaultValue: 'manual'
  }
}, {
  tableName: 'attendance',
  timestamps: true,
  indexes: [
    { fields: ['userId'] },
    { fields: ['date'] },
    { fields: ['userId', 'date'], unique: true },
    { fields: ['status'] },
    { fields: ['checkIn'] },
    { fields: ['checkOut'] }
  ]
});

module.exports = MySQLAttendance;
