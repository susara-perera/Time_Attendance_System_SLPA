const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const RecentActivity = sequelize.define('RecentActivity', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: 'Activity title (e.g., "New Sub-Section", "Employee Transferred")'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: 'Activity description/details'
    },
    activity_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'Type of activity (subsection_created, employee_transferred, etc.)'
    },
    icon: {
      type: DataTypes.STRING(100),
      defaultValue: 'bi bi-activity',
      comment: 'Bootstrap icon class'
    },
    entity_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'ID of the related entity (subsection_id, employee_id, etc.)'
    },
    entity_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Name of the related entity'
    },
    user_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'ID of user who performed the action'
    },
    user_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Name of user who performed the action'
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Additional activity metadata'
    },
    activity_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      comment: 'Date of activity (YYYY-MM-DD)'
    },
    activity_time: {
      type: DataTypes.TIME,
      allowNull: false,
      comment: 'Time of activity (HH:mm:ss)'
    }
  }, {
    tableName: 'recent_activities',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['activity_type'] },
      { fields: ['activity_date'] },
      { fields: ['created_at'] },
      { fields: ['entity_id'] },
      { fields: ['user_id'] }
    ],
    defaultScope: {
      order: [['created_at', 'DESC']]
    }
  });

  return RecentActivity;
};