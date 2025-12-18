const AuditLog = require('../models/AuditLog');
const moment = require('moment');

// @desc    Get recent activities (audit logs)
// @route   GET /api/activities/recent
// @access  Private (admin, super_admin, clerk, employee)
const getRecentActivities = async (req, res) => {
  try {
    // Optionally filter by user, category, or entity
    const { userId, category, entityType, limit = 20 } = req.query;
    let query = {};
    if (userId) query.user = userId;
    if (category) query.category = category;
    if (entityType) query['entity.type'] = entityType;

    // Only show last 7 days by default
    const weekAgo = moment().subtract(7, 'days').toDate();
    query.createdAt = { $gte: weekAgo };

    const logs = await AuditLog.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .populate('user', 'firstName lastName email employeeId')
      .populate('reviewedBy', 'firstName lastName email');

    // Format for frontend
    const activities = logs.map(log => ({
      id: log._id,
      title: log.action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      description: log.description,
      date: moment(log.createdAt).format('YYYY-MM-DD'),
      time: moment(log.createdAt).format('HH:mm:ss'),
      icon: getActivityIcon(log.action),
      user: log.user ? `${log.user.firstName} ${log.user.lastName}` : 'System',
      entity: log.entity,
      category: log.category,
      severity: log.severity
    }));

    res.status(200).json({ success: true, data: activities });
  } catch (err) {
    console.error('Get recent activities error:', err);
    res.status(500).json({ success: false, message: 'Server error fetching activities' });
  }
};

function getActivityIcon(action) {
  const icons = {
    // User actions
    user_login: 'bi bi-box-arrow-in-right',
    user_logout: 'bi bi-box-arrow-left',
    user_created: 'bi bi-person-plus',
    user_updated: 'bi bi-person-gear',
    user_deleted: 'bi bi-person-dash',
    user_activated: 'bi bi-person-check',
    user_deactivated: 'bi bi-person-x',
    
    // Attendance actions
    check_in: 'bi bi-box-arrow-in-right',
    check_out: 'bi bi-box-arrow-right',
    break_start: 'bi bi-cup-hot',
    break_end: 'bi bi-play-circle',
    attendance_created: 'bi bi-calendar-plus',
    attendance_updated: 'bi bi-calendar-check',
    attendance_deleted: 'bi bi-calendar-x',
    attendance_approved: 'bi bi-calendar-check',
    attendance_rejected: 'bi bi-calendar-x',
    
    // Role & Permission actions
    permissions_updated: 'bi bi-shield-check',
    role_changed: 'bi bi-shield-lock',
    
    // Report actions
    report_generated: 'bi bi-file-earmark-bar-graph',
    report_downloaded: 'bi bi-download',
    report_viewed: 'bi bi-eye',
    
    // Settings actions
    settings_updated: 'bi bi-gear',
    
    // Division actions
    division_created: 'bi bi-building-add',
    division_updated: 'bi bi-building-gear',
    division_deleted: 'bi bi-building-dash',
    
    // Section actions
    section_created: 'bi bi-diagram-3',
    section_updated: 'bi bi-diagram-3',
    section_deleted: 'bi bi-diagram-3',
    
    // SubSection actions
    subsection_created: 'bi bi-diagram-2-fill',
    subsection_updated: 'bi bi-diagram-2',
    subsection_deleted: 'bi bi-diagram-2',
    subSection_created: 'bi bi-diagram-2-fill',
    subSection_updated: 'bi bi-diagram-2',
    subSection_deleted: 'bi bi-diagram-2',
    
    // Employee Transfer actions
    employee_transferred_to_subsection: 'bi bi-arrow-left-right',
    employee_transfer_recalled: 'bi bi-arrow-return-left',
    employee_assigned_to_section: 'bi bi-person-plus-fill',
    employee_removed_from_section: 'bi bi-person-dash-fill',
    
    // MySQL SubSection actions
    mysql_subsection_created: 'bi bi-database-add',
    mysql_subsection_updated: 'bi bi-database-gear',
    mysql_subsection_deleted: 'bi bi-database-dash',
    mysql_employee_transferred: 'bi bi-database-up',
    mysql_employees_bulk_transferred: 'bi bi-database-fill-up',
    mysql_transfer_recalled: 'bi bi-database-down',
    mysql_transfers_bulk_recalled: 'bi bi-database-fill-down',
    
    // Section status actions
    section_activated: 'bi bi-toggle-on',
    section_deactivated: 'bi bi-toggle-off',
    
    // Meal actions
    meal_created: 'bi bi-cup-hot-fill',
    meal_booked: 'bi bi-cart-plus',
    meal_booking_cancelled: 'bi bi-cart-dash',
    meal_ordered: 'bi bi-cup-hot-fill',
    meal_updated: 'bi bi-cup-hot',
    meal_deleted: 'bi bi-cup',
    meal_cancelled: 'bi bi-cup',
    meal_served: 'bi bi-check-circle',
    meal_paid: 'bi bi-currency-dollar',
    
    // Security actions
    failed_login: 'bi bi-exclamation-triangle',
    account_locked: 'bi bi-lock',
    account_unlocked: 'bi bi-unlock',
    password_changed: 'bi bi-key-fill',
    password_reset: 'bi bi-key',
    profile_updated: 'bi bi-person-lines-fill',
    
    // System actions
    system_maintenance: 'bi bi-tools',
    backup_created: 'bi bi-cloud-arrow-up',
    data_imported: 'bi bi-upload',
    data_exported: 'bi bi-download',
    
    // Administrative actions
    bulk_update: 'bi bi-stack',
    bulk_delete: 'bi bi-trash3',
    data_migration: 'bi bi-database',
    system_configuration: 'bi bi-sliders',
    
    // Access control
    permission_denied: 'bi bi-shield-exclamation',
    suspicious_activity: 'bi bi-exclamation-octagon',
    
    default: 'bi bi-activity'
  };
  return icons[action] || icons.default;
}

module.exports = {
  getRecentActivities
};
