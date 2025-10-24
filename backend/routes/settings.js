const express = require('express');
const {
  getSettings,
  updateSettings,
  getSettingsByCategory,
  updateSystemSettings,
  resetSettings,
  exportSettings,
  importSettings,
  getSettingsHistory
} = require('../controllers/settingsController');
const { 
  auth, 
  authorize, 
  checkPermission,
  auditTrail 
} = require('../middleware/auth');
const { settingsValidation } = require('../middleware/validation');

const router = express.Router();

// @route   GET /api/settings
// @desc    Get all settings
// @access  Private (administrator and super_admin only)
router.get(
  '/',
  auth,
  authorize(['administrator', 'super_admin']),
  checkPermission('settings', 'view'),
  auditTrail('settings_viewed', 'Settings'),
  getSettings
);

// @route   GET /api/settings/category/:category
// @desc    Get settings by category
// @access  Private
router.get(
  '/category/:category',
  auth,
  auditTrail('settings_category_viewed', 'Settings'),
  getSettingsByCategory
);

// @route   GET /api/settings/history
// @desc    Get settings change history
// @access  Private (super_admin only)
router.get(
  '/history',
  auth,
  authorize('super_admin'),
  checkPermission('settings', 'view_history'),
  auditTrail('settings_history_viewed', 'Settings'),
  getSettingsHistory
);

// @route   PUT /api/settings
// @desc    Update settings
// @access  Private (administrator and super_admin only)
router.put(
  '/',
  auth,
  authorize(['administrator', 'super_admin']),
  checkPermission('settings', 'update'),
  settingsValidation.update,
  auditTrail('settings_updated', 'Settings'),
  updateSettings
);

// @route   PUT /api/settings/system
// @desc    Update system settings
// @access  Private (super_admin only)
router.put(
  '/system',
  auth,
  authorize('super_admin'),
  checkPermission('settings', 'update_system'),
  settingsValidation.systemUpdate,
  auditTrail('system_settings_updated', 'Settings'),
  updateSystemSettings
);

// @route   POST /api/settings/reset
// @desc    Reset settings to default
// @access  Private (super_admin only)
router.post(
  '/reset',
  auth,
  authorize('super_admin'),
  checkPermission('settings', 'reset'),
  settingsValidation.reset,
  auditTrail('settings_reset', 'Settings'),
  resetSettings
);

// @route   GET /api/settings/export
// @desc    Export settings
// @access  Private (super_admin only)
router.get(
  '/export',
  auth,
  authorize('super_admin'),
  checkPermission('settings', 'export'),
  auditTrail('settings_exported', 'Settings'),
  exportSettings
);

// @route   POST /api/settings/import
// @desc    Import settings
// @access  Private (super_admin only)
router.post(
  '/import',
  auth,
  authorize('super_admin'),
  checkPermission('settings', 'import'),
  settingsValidation.import,
  auditTrail('settings_imported', 'Settings'),
  importSettings
);

module.exports = router;
