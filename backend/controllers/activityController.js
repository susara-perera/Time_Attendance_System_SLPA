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
    user_login: 'bi bi-person-check',
    user_logout: 'bi bi-person-x',
    user_created: 'bi bi-person-plus',
    user_updated: 'bi bi-pencil',
    user_deleted: 'bi bi-person-dash',
    check_in: 'bi bi-box-arrow-in-right',
    check_out: 'bi bi-box-arrow-right',
    attendance_created: 'bi bi-calendar-plus',
    attendance_updated: 'bi bi-calendar-check',
    attendance_deleted: 'bi bi-calendar-x',
    permissions_updated: 'bi bi-shield-check',
    role_changed: 'bi bi-shield-lock',
    report_generated: 'bi bi-file-earmark-bar-graph',
    report_downloaded: 'bi bi-download',
    settings_updated: 'bi bi-gear',
    division_created: 'bi bi-building-add',
    division_updated: 'bi bi-building',
    division_deleted: 'bi bi-building-dash',
    section_created: 'bi bi-diagram-3',
    section_updated: 'bi bi-diagram-3',
    section_deleted: 'bi bi-diagram-3',
    subSection_created: 'bi bi-diagram-2',
    subSection_updated: 'bi bi-diagram-2',
    subSection_deleted: 'bi bi-diagram-2',
    meal_ordered: 'bi bi-cup-hot',
    meal_updated: 'bi bi-cup-hot',
    meal_cancelled: 'bi bi-cup-hot',
    meal_served: 'bi bi-cup-hot',
    meal_paid: 'bi bi-cup-hot',
    failed_login: 'bi bi-exclamation-triangle',
    password_changed: 'bi bi-key',
    password_reset: 'bi bi-key',
    profile_updated: 'bi bi-person',
    system_maintenance: 'bi bi-tools',
    settings_updated: 'bi bi-gear',
    permission_denied: 'bi bi-shield-exclamation',
    suspicious_activity: 'bi bi-shield-exclamation',
    default: 'bi bi-activity'
  };
  return icons[action] || icons.default;
}

module.exports = {
  getRecentActivities
};
