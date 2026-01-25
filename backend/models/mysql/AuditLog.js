const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/mysql');

const MySQLAuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: true, // Allow null for system-level actions
    defaultValue: null,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  action: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: true,
      isIn: [[
        // User actions
        'user_login', 'user_logout', 'user_created', 'user_updated', 'user_deleted', 
        'user_activated', 'user_deactivated', 'password_changed', 'password_reset', 
        'profile_updated', 'role_changed', 'permissions_updated',
        
        // Attendance actions
        'check_in', 'check_out', 'break_start', 'break_end', 'attendance_created', 
        'attendance_updated', 'attendance_deleted', 'attendance_approved', 'attendance_rejected',
        
        // Division & Section actions
        'division_created', 'division_updated', 'division_deleted', 
        'section_created', 'section_updated', 'section_deleted',
        
        // SubSection actions
        'subsection_created', 'subsection_updated', 'subsection_deleted', 
        'subsections_viewed', 'subsection_viewed',
        
        // MySQL SubSection actions
        'mysql_subsection_created', 'mysql_subsection_updated', 'mysql_subsection_deleted', 
        'mysql_subsections_viewed',
        
        // MySQL transfer actions
        'mysql_transfers_all_listed', 'mysql_transfers_listed', 'mysql_employee_transferred', 
        'mysql_employee_transferred_bulk', 'mysql_transfer_recalled', 'mysql_transfer_recalled_bulk',
        
        // Employee Transfer actions
        'employee_transferred_to_subsection', 'employee_transfer_recalled',
        
        // Meal actions
        'meal_ordered', 'meal_updated', 'meal_cancelled', 'meal_served', 'meal_paid',
        'meals_viewed', 'meal_viewed', 'user_meal_bookings_viewed', 'meal_bookings_viewed', 
        'meal_stats_viewed', 'meal_created', 'meal_booked', 'meal_rated', 
        'meal_menu_generated', 'meal_deleted', 'meal_booking_cancelled',
        
        // Report actions
        'report_generated', 'report_downloaded', 'report_viewed',
        'mysql_audit_report_generated', 'mysql_attendance_report_generated', 'mysql_meal_report_generated',
        
        // System actions
        'settings_updated', 'backup_created', 'data_imported', 'data_exported', 'system_maintenance',
        
        // Security actions
        'failed_login', 'account_locked', 'account_unlocked', 'suspicious_activity', 'permission_denied',
        
        // Administrative actions
        'bulk_update', 'bulk_delete', 'data_migration', 'system_configuration'
      ]]
    }
  },
  entityType: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  entityId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  entityName: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  category: {
    type: DataTypes.STRING(50),
    allowNull: true,
    defaultValue: 'general'
  },
  severity: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
    defaultValue: 'low'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  details: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  ipAddress: {
    type: DataTypes.STRING(45),
    allowNull: true
  },
  userAgent: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  isSecurityRelevant: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  status: {
    type: DataTypes.ENUM('success', 'failed', 'pending'),
    defaultValue: 'success'
  }
}, {
  tableName: 'audit_logs',
  timestamps: true,
  indexes: [
    { fields: ['userId'] },
    { fields: ['action'] },
    { fields: ['category'] },
    { fields: ['severity'] },
    { fields: ['createdAt'] },
    { fields: ['entityType', 'entityId'] },
    { fields: ['isSecurityRelevant'] }
  ]
});

// Static method to create log (similar to MongoDB createLog)
MySQLAuditLog.createLog = async function(logData) {
  try {
    return await this.create({
      userId: logData.user || null,
      action: logData.action,
      entityType: logData.entity?.type || null,
      entityId: logData.entity?.id || null,
      entityName: logData.entity?.name || null,
      category: logData.category || 'general',
      severity: logData.severity || 'low',
      description: logData.description || '',
      details: logData.details || '',
      metadata: logData.metadata || {},
      ipAddress: logData.metadata?.ipAddress || null,
      userAgent: logData.metadata?.userAgent || null,
      isSecurityRelevant: logData.isSecurityRelevant || false,
      status: logData.status || 'success'
    });
  } catch (error) {
    console.error('Error creating audit log:', error);
    // Don't throw - audit log failures shouldn't break main operations
    return null;
  }
};

module.exports = MySQLAuditLog;
