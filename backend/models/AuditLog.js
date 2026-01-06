const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required']
  },
  action: {
    type: String,
    required: [true, 'Action is required'],
    enum: [
      // User actions
      'user_login', 'user_logout', 'user_created', 'user_updated', 'user_deleted', 'user_activated', 'user_deactivated',
      'password_changed', 'password_reset', 'profile_updated', 'role_changed', 'permissions_updated',
      
      // Attendance actions
      'check_in', 'check_out', 'break_start', 'break_end', 'attendance_created', 'attendance_updated', 
      'attendance_deleted', 'attendance_approved', 'attendance_rejected',
      
  // Division & Section actions
  'division_created', 'division_updated', 'division_deleted', 'section_created', 'section_updated', 'section_deleted',
  // SubSection actions
  'subsection_created', 'subsection_updated', 'subsection_deleted', 'subsections_viewed', 'subsection_viewed',
  // MySQL SubSection actions
  'mysql_subsection_created', 'mysql_subsection_updated', 'mysql_subsection_deleted', 'mysql_subsections_viewed',
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
      
      // System actions
      'settings_updated', 'backup_created', 'data_imported', 'data_exported', 'system_maintenance',
      
      // Security actions
      'failed_login', 'account_locked', 'account_unlocked', 'suspicious_activity', 'permission_denied',
      
      // Administrative actions
      'bulk_update', 'bulk_delete', 'data_migration', 'system_configuration'
    ]
  },
  entity: {
    type: {
      type: String,
      required: [true, 'Entity type is required'],
  enum: ['User', 'Attendance', 'Division', 'Section', 'SubSection', 'MySQLSubSection', 'TransferToSubsection', 'Meal', 'Settings', 'Report', 'System']
    },
    id: {
      type: mongoose.Schema.Types.ObjectId,
      required: false // Made optional to handle cases where ID might not be available immediately
    },
    name: {
      type: String,
      trim: true
    }
  },
  changes: {
    before: {
      type: mongoose.Schema.Types.Mixed // Store the previous state
    },
    after: {
      type: mongoose.Schema.Types.Mixed // Store the new state
    },
    fields: [{
      field: {
        type: String,
        required: true
      },
      oldValue: mongoose.Schema.Types.Mixed,
      newValue: mongoose.Schema.Types.Mixed
    }]
  },
  metadata: {
    ipAddress: {
      type: String,
      trim: true
    },
    userAgent: {
      type: String,
      trim: true
    },
    sessionId: {
      type: String,
      trim: true
    },
    requestId: {
      type: String,
      trim: true
    },
    method: {
      type: String,
      enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      uppercase: true
    },
    endpoint: {
      type: String,
      trim: true
    },
    responseCode: {
      type: Number
    },
    duration: {
      type: Number // Request duration in milliseconds
    }
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  category: {
    type: String,
    enum: ['authentication', 'authorization', 'data_modification', 'system_access', 'configuration', 'security'],
    required: [true, 'Category is required']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  details: {
    type: String,
    trim: true,
    maxlength: [5000, 'Details cannot exceed 5000 characters']
  },
  location: {
    division: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Division'
    },
    section: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Section'
    },
    building: String,
    floor: String,
    room: String
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  relatedLogs: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AuditLog'
  }],
  isSystemGenerated: {
    type: Boolean,
    default: false
  },
  isSecurityRelevant: {
    type: Boolean,
    default: false
  },
  requiresReview: {
    type: Boolean,
    default: false
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: {
    type: Date
  },
  reviewComments: {
    type: String,
    trim: true,
    maxlength: [1000, 'Review comments cannot exceed 1000 characters']
  },
  isArchived: {
    type: Boolean,
    default: false
  },
  retentionDate: {
    type: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for time since action
auditLogSchema.virtual('timeAgo').get(function() {
  const now = new Date();
  const diff = now - this.createdAt;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'Just now';
});

// Index for better performance
auditLogSchema.index({ user: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ 'entity.type': 1, 'entity.id': 1 });
auditLogSchema.index({ category: 1, severity: 1 });
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ isSecurityRelevant: 1, createdAt: -1 });
auditLogSchema.index({ requiresReview: 1, reviewedAt: 1 });
auditLogSchema.index({ tags: 1 });
auditLogSchema.index({ retentionDate: 1 });

// Text search index
auditLogSchema.index({
  description: 'text',
  details: 'text',
  'entity.name': 'text'
});

// Pre-save middleware
auditLogSchema.pre('save', function(next) {
  // Set retention date if not already set (default 7 years)
  if (!this.retentionDate) {
    const retentionYears = 7;
    this.retentionDate = new Date();
    this.retentionDate.setFullYear(this.retentionDate.getFullYear() + retentionYears);
  }
  
  // Auto-set security relevance based on action
  const securityActions = [
    'user_login', 'user_logout', 'failed_login', 'account_locked', 'account_unlocked',
    'password_changed', 'password_reset', 'role_changed', 'permissions_updated',
    'suspicious_activity', 'permission_denied'
  ];
  
  if (securityActions.includes(this.action)) {
    this.isSecurityRelevant = true;
  }
  
  // Auto-set review requirement for critical actions
  const criticalActions = [
    'user_deleted', 'role_changed', 'permissions_updated', 'division_deleted',
    'section_deleted', 'bulk_delete', 'system_configuration', 'suspicious_activity'
  ];
  
  if (criticalActions.includes(this.action) || this.severity === 'critical') {
    this.requiresReview = true;
  }
  
  next();
});

// Static method to create audit log
auditLogSchema.statics.createLog = async function(logData) {
  try {
    const auditLog = new this(logData);
    await auditLog.save();
    return auditLog;
  } catch (error) {
    console.error('Error creating audit log:', error);
    // Don't throw error to prevent disrupting main functionality
    return null;
  }
};

// Static method to get audit statistics
auditLogSchema.statics.getAuditStats = async function(filters = {}) {
  const matchStage = { ...filters };
  
  if (filters.startDate && filters.endDate) {
    matchStage.createdAt = {
      $gte: new Date(filters.startDate),
      $lte: new Date(filters.endDate)
    };
    delete matchStage.startDate;
    delete matchStage.endDate;
  }
  
  return await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalLogs: { $sum: 1 },
        securityLogs: {
          $sum: { $cond: ['$isSecurityRelevant', 1, 0] }
        },
        criticalLogs: {
          $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] }
        },
        pendingReviews: {
          $sum: { $cond: [{ $and: ['$requiresReview', { $eq: ['$reviewedAt', null] }] }, 1, 0] }
        },
        actionBreakdown: {
          $push: '$action'
        },
        categoryBreakdown: {
          $push: '$category'
        },
        userBreakdown: {
          $push: '$user'
        }
      }
    },
    {
      $project: {
        totalLogs: 1,
        securityLogs: 1,
        criticalLogs: 1,
        pendingReviews: 1,
        topActions: {
          $slice: [
            {
              $map: {
                input: { $setUnion: ['$actionBreakdown'] },
                as: 'action',
                in: {
                  action: '$$action',
                  count: {
                    $size: {
                      $filter: {
                        input: '$actionBreakdown',
                        cond: { $eq: ['$$this', '$$action'] }
                      }
                    }
                  }
                }
              }
            },
            10
          ]
        },
        categoryStats: {
          $map: {
            input: { $setUnion: ['$categoryBreakdown'] },
            as: 'category',
            in: {
              category: '$$category',
              count: {
                $size: {
                  $filter: {
                    input: '$categoryBreakdown',
                    cond: { $eq: ['$$this', '$$category'] }
                  }
                }
              }
            }
          }
        }
      }
    }
  ]);
};

// Static method to archive old logs
auditLogSchema.statics.archiveOldLogs = async function(cutoffDate) {
  return await this.updateMany(
    {
      createdAt: { $lt: cutoffDate },
      isArchived: false
    },
    {
      $set: { isArchived: true }
    }
  );
};

// Static method to cleanup expired logs
auditLogSchema.statics.cleanupExpiredLogs = async function() {
  const now = new Date();
  return await this.deleteMany({
    retentionDate: { $lt: now },
    isArchived: true
  });
};

// Instance method to mark as reviewed
auditLogSchema.methods.markAsReviewed = async function(reviewerId, comments) {
  this.reviewedBy = reviewerId;
  this.reviewedAt = new Date();
  if (comments) {
    this.reviewComments = comments;
  }
  return await this.save();
};

module.exports = mongoose.model('AuditLog', auditLogSchema);
