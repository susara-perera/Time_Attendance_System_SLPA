const AuditLog = require('../models/AuditLog');

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

module.exports = {
  logActivity
};
