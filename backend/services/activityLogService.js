const AuditLog = require('../models/AuditLog');
const { RecentActivity } = require('../models/mysql');
const moment = require('moment');
const { Op } = require('sequelize');

// No max limit - we'll keep records from the latest day to current moment only
const CLEANUP_PERFORMED_TODAY = { date: null };

/**
 * Log an activity to the AuditLog collection
 * @param {Object} params - Activity log parameters
 * @param {ObjectId} params.user - User performing the action
 * @param {String} params.action - Action type
 * @param {Object} params.entity - { type, id, name }
 * @param {Object} params.changes - { before, after, fields }
 * @param {Object} params.metadata - { ipAddress, userAgent, ... }
 * @param {String} params.severity - Severity level
 * @param {String} params.category - Category
 * @param {String} params.description - Short description
 * @param {String} [params.details] - Optional details
 * @param {Object} [params.location] - Optional location
 * @param {Array} [params.tags] - Optional tags
 */
async function logActivity(params) {
  try {
    await AuditLog.createLog(params);
  } catch (err) {
    console.error('Failed to log activity:', err);
  }
}

/**
 * Clean up old recent activities (keep only records from latest day to current moment)
 * This runs once per day on first login/activity
 */
async function cleanupOldActivities() {
  try {
    const today = moment().format('YYYY-MM-DD');
    
    // Check if cleanup already performed today
    if (CLEANUP_PERFORMED_TODAY.date === today) {
      return;
    }

    // Get the date of the most recent activity
    const latestActivity = await RecentActivity.findOne({
      order: [['created_at', 'DESC']],
      attributes: ['activity_date']
    });

    if (!latestActivity) {
      console.log('🗑️ [RecentActivity] No activities to clean up');
      CLEANUP_PERFORMED_TODAY.date = today;
      return;
    }

    const latestDate = latestActivity.activity_date;
    
    // Delete all activities older than the latest day
    const deleteResult = await RecentActivity.destroy({
      where: {
        activity_date: {
          [Op.lt]: latestDate
        }
      }
    });

    if (deleteResult > 0) {
      console.log(`🗑️ [RecentActivity] Daily cleanup: removed ${deleteResult} old activities (keeping only from ${latestDate} onwards)`);
    } else {
      console.log('🗑️ [RecentActivity] Daily cleanup: no old activities to remove');
    }

    // Mark cleanup as performed today
    CLEANUP_PERFORMED_TODAY.date = today;

  } catch (error) {
    console.error('❌ [RecentActivity] Failed to clean up old activities:', error);
  }
}

/**
 * Log recent activity to MySQL with daily cleanup
 * This replaces all RecentActivity.create() calls throughout the codebase
 * 
 * @param {Object} activity - Activity details
 * @param {string} activity.title - Activity title
 * @param {string} activity.description - Activity description
 * @param {string} activity.activity_type - Type of activity
 * @param {string} activity.icon - Bootstrap icon class (optional)
 * @param {string} activity.entity_id - Related entity ID (optional)
 * @param {string} activity.entity_name - Related entity name (optional)
 * @param {string} activity.user_id - User who performed the action (optional)
 * @param {string} activity.user_name - Name of user (optional)
 * @param {Object} activity.metadata - Additional metadata (optional)
 */
async function logRecentActivity(activity) {
  try {
    // Perform daily cleanup on first activity of the day
    await cleanupOldActivities();

    // Set default icon based on activity type if not provided
    if (!activity.icon) {
      activity.icon = getActivityIcon(activity.activity_type);
    }

    // Create the new activity
    const newActivity = await RecentActivity.create({
      title: activity.title,
      description: activity.description,
      activity_type: activity.activity_type,
      icon: activity.icon,
      entity_id: activity.entity_id || null,
      entity_name: activity.entity_name || null,
      user_id: activity.user_id || null,
      user_name: activity.user_name || null,
      metadata: activity.metadata || null,
      activity_date: moment().format('YYYY-MM-DD'),
      activity_time: moment().format('HH:mm:ss')
    });

    console.log(`✅ [RecentActivity] Logged: ${activity.activity_type} - ${activity.title}`);
    return newActivity;

  } catch (error) {
    console.error('❌ [RecentActivity] Failed to log activity:', error);
    // Don't throw - logging should not break the main flow
  }
}

/**
 * Activity type icons mapping - comprehensive list
 */
const activityIcons = {
  // User activities
  'user_login': 'bi-box-arrow-in-right',
  'user_logout': 'bi-box-arrow-right',
  'user_created': 'bi-person-plus-fill',
  'user_updated': 'bi-person-check-fill',
  'user_deleted': 'bi-person-x-fill',
  
  // Division activities
  'division_created': 'bi-building-add',
  'division_updated': 'bi-building-check',
  'division_deleted': 'bi-building-x',
  
  // Section activities
  'section_created': 'bi-diagram-3-fill',
  'section_updated': 'bi-pencil-square',
  'section_deleted': 'bi-trash',
  'section_viewed': 'bi-eye',
  
  // Sub-section activities
  'subsection_created': 'bi-folder-plus',
  'subsection_updated': 'bi-folder-check',
  'subsection_deleted': 'bi-folder-x',
  
  // Employee activities
  'employee_created': 'bi-person-badge-fill',
  'employee_updated': 'bi-person-badge',
  'employee_deleted': 'bi-person-dash-fill',
  'employee_transferred': 'bi-arrow-left-right',
  'employee_recalled': 'bi-arrow-counterclockwise',
  'employee_viewed': 'bi-person-lines-fill',
  
  // Attendance activities
  'check_in': 'bi-box-arrow-in-down-right',
  'check_out': 'bi-box-arrow-up-right',
  'break_start': 'bi-pause-circle-fill',
  'break_end': 'bi-play-circle-fill',
  
  // Permission activities
  'permissions_updated': 'bi-shield-fill-check',
  'permission_granted': 'bi-shield-plus',
  'permission_revoked': 'bi-shield-minus',
  'role_created': 'bi-award-fill',
  'role_updated': 'bi-award',
  'role_deleted': 'bi-trash',
  
  // Meal activities
  'meal_created': 'bi-egg-fried',
  'meal_updated': 'bi-egg-fill',
  'meal_deleted': 'bi-egg',
  'meal_booked': 'bi-calendar-check',
  
  // System/Sync activities
  'sync_triggered': 'bi-arrow-repeat',
  'sync_completed': 'bi-check-circle-fill',
  'cache_cleared': 'bi-trash3-fill',
  'cache_refreshed': 'bi-arrow-clockwise',
  'backup_created': 'bi-database-fill-up',
  'system_update': 'bi-gear-fill',
  
  // Report activities
  'report_generated': 'bi-file-earmark-bar-graph-fill',
  'report_exported': 'bi-file-earmark-arrow-down',
  'report_viewed': 'bi-file-earmark-text',
  
  // Default
  'default': 'bi-activity'
};

/**
 * Get icon for activity type
 */
function getActivityIcon(activityType) {
  return activityIcons[activityType] || activityIcons.default;
}

module.exports = {
  logActivity,
  logRecentActivity,
  getActivityIcon,
  cleanupOldActivities
};

