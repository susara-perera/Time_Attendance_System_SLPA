const { MySQLSettings: Settings, MySQLAuditLog: AuditLog } = require('../models/mysql');
const { validationResult } = require('express-validator');

// @desc    Get all settings
// @route   GET /api/settings
// @access  Private (administrator and super_admin only)
const getSettings = async (req, res) => {
  try {
    const settings = await Settings.find()
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName')
      .sort({ category: 1, key: 1 });

    // Group settings by category
    const groupedSettings = settings.reduce((acc, setting) => {
      if (!acc[setting.category]) {
        acc[setting.category] = [];
      }
      acc[setting.category].push(setting);
      return acc;
    }, {});

    res.json({
      success: true,
      data: groupedSettings
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve settings'
    });
  }
};

// @desc    Get settings by category
// @route   GET /api/settings/category/:category
// @access  Private
const getSettingsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    
    // Check if user has permission to view this category
    const restrictedCategories = ['security', 'database', 'system'];
    if (restrictedCategories.includes(category) && 
        !['administrator', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions to view this category'
      });
    }

    const settings = await Settings.find({ category })
      .sort({ key: 1 });

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Get settings by category error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve settings'
    });
  }
};

// @desc    Update settings
// @route   PUT /api/settings
// @access  Private (administrator and super_admin only)
const updateSettings = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { settings: settingsToUpdate } = req.body;
    const updatedSettings = [];
    const auditEntries = [];

    for (const settingUpdate of settingsToUpdate) {
      const { key, category, value } = settingUpdate;

      // Find existing setting
      let setting = await Settings.findOne({ key, category });

      if (setting) {
        // Store old value for audit
        const oldValue = setting.value;

        // Update existing setting
        setting.value = value;
        setting.updatedBy = req.user.id;
        setting.lastModified = new Date();
        await setting.save();

        // Add to audit trail
        auditEntries.push({
          action: 'setting_updated',
          entityType: 'Settings',
          entityId: setting._id,
          userId: req.user.id,
          details: {
            key: setting.key,
            category: setting.category,
            oldValue,
            newValue: value
          },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });
      } else {
        // Create new setting
        setting = await Settings.create({
          key,
          category,
          value,
          createdBy: req.user.id
        });

        // Add to audit trail
        auditEntries.push({
          action: 'setting_created',
          entityType: 'Settings',
          entityId: setting._id,
          userId: req.user.id,
          details: {
            key: setting.key,
            category: setting.category,
            value
          },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });
      }

      updatedSettings.push(setting);
    }

    // Bulk insert audit entries
    if (auditEntries.length > 0) {
      await AuditLog.insertMany(auditEntries);
    }

    res.json({
      success: true,
      data: updatedSettings,
      message: 'Settings updated successfully'
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update settings'
    });
  }
};

// @desc    Update system settings
// @route   PUT /api/settings/system
// @access  Private (super_admin only)
const updateSystemSettings = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { systemSettings } = req.body;
    const updatedSettings = [];

    for (const [key, value] of Object.entries(systemSettings)) {
      let setting = await Settings.findOne({ 
        key, 
        category: 'system' 
      });

      if (setting) {
        const oldValue = setting.value;
        setting.value = value;
        setting.updatedBy = req.user.id;
        setting.lastModified = new Date();
        await setting.save();

        // Log critical system changes
        await AuditLog.create({
          action: 'system_setting_updated',
          entityType: 'Settings',
          entityId: setting._id,
          userId: req.user.id,
          details: {
            key,
            oldValue,
            newValue: value
          },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });
      } else {
        setting = await Settings.create({
          key,
          category: 'system',
          value,
          createdBy: req.user.id
        });
      }

      updatedSettings.push(setting);
    }

    res.json({
      success: true,
      data: updatedSettings,
      message: 'System settings updated successfully'
    });
  } catch (error) {
    console.error('Update system settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update system settings'
    });
  }
};

// @desc    Reset settings to default
// @route   POST /api/settings/reset
// @access  Private (super_admin only)
const resetSettings = async (req, res) => {
  try {
    const { category, keys } = req.body;

    // Default settings by category
    const defaultSettings = {
      general: {
        company_name: 'Time Attendance System',
        timezone: 'UTC',
        date_format: 'YYYY-MM-DD',
        time_format: '24h'
      },
      attendance: {
        grace_period: 15, // minutes
        break_duration: 60, // minutes
        max_working_hours: 8,
        overtime_threshold: 8
      },
      security: {
        session_timeout: 30, // minutes
        password_expiry_days: 90,
        max_login_attempts: 5,
        lockout_duration: 30 // minutes
      },
      notifications: {
        email_enabled: true,
        sms_enabled: false,
        push_enabled: true
      }
    };

    const settingsToReset = keys || Object.keys(defaultSettings[category] || {});
    const resetSettings = [];

    for (const key of settingsToReset) {
      const defaultValue = defaultSettings[category]?.[key];
      if (defaultValue !== undefined) {
        let setting = await Settings.findOne({ key, category });
        
        if (setting) {
          const oldValue = setting.value;
          setting.value = defaultValue;
          setting.updatedBy = req.user.id;
          setting.lastModified = new Date();
          await setting.save();

          // Audit log
          await AuditLog.create({
            action: 'setting_reset',
            entityType: 'Settings',
            entityId: setting._id,
            userId: req.user.id,
            details: {
              key,
              category,
              oldValue,
              newValue: defaultValue
            },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
          });
        } else {
          setting = await Settings.create({
            key,
            category,
            value: defaultValue,
            createdBy: req.user.id
          });
        }

        resetSettings.push(setting);
      }
    }

    res.json({
      success: true,
      data: resetSettings,
      message: 'Settings reset to default values successfully'
    });
  } catch (error) {
    console.error('Reset settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset settings'
    });
  }
};

// @desc    Export settings
// @route   GET /api/settings/export
// @access  Private (super_admin only)
const exportSettings = async (req, res) => {
  try {
    const { categories } = req.query;
    
    const filter = {};
    if (categories) {
      filter.category = { $in: categories.split(',') };
    }

    const settings = await Settings.find(filter)
      .select('key category value description dataType isRequired')
      .lean();

    // Group by category
    const exportData = settings.reduce((acc, setting) => {
      if (!acc[setting.category]) {
        acc[setting.category] = {};
      }
      acc[setting.category][setting.key] = {
        value: setting.value,
        description: setting.description,
        dataType: setting.dataType,
        isRequired: setting.isRequired
      };
      return acc;
    }, {});

    // Log export action
    await AuditLog.create({
      action: 'settings_exported',
      entityType: 'Settings',
      userId: req.user.id,
      details: {
        categories: categories || 'all',
        settingsCount: settings.length
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      data: exportData,
      metadata: {
        exportDate: new Date(),
        totalSettings: settings.length,
        exportedBy: req.user.firstName + ' ' + req.user.lastName
      }
    });
  } catch (error) {
    console.error('Export settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export settings'
    });
  }
};

// @desc    Import settings
// @route   POST /api/settings/import
// @access  Private (super_admin only)
const importSettings = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { settings: importData, overwrite = false } = req.body;
    const importedSettings = [];
    const skippedSettings = [];

    for (const [category, categorySettings] of Object.entries(importData)) {
      for (const [key, settingData] of Object.entries(categorySettings)) {
        const existingSetting = await Settings.findOne({ key, category });

        if (existingSetting && !overwrite) {
          skippedSettings.push({ key, category, reason: 'already_exists' });
          continue;
        }

        if (existingSetting && overwrite) {
          // Update existing
          existingSetting.value = settingData.value;
          existingSetting.description = settingData.description || existingSetting.description;
          existingSetting.updatedBy = req.user.id;
          existingSetting.lastModified = new Date();
          await existingSetting.save();
          importedSettings.push(existingSetting);
        } else {
          // Create new
          const newSetting = await Settings.create({
            key,
            category,
            value: settingData.value,
            description: settingData.description,
            dataType: settingData.dataType || 'string',
            isRequired: settingData.isRequired || false,
            createdBy: req.user.id
          });
          importedSettings.push(newSetting);
        }
      }
    }

    // Log import action
    await AuditLog.create({
      action: 'settings_imported',
      entityType: 'Settings',
      userId: req.user.id,
      details: {
        importedCount: importedSettings.length,
        skippedCount: skippedSettings.length,
        overwrite
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      data: {
        imported: importedSettings.length,
        skipped: skippedSettings.length,
        importedSettings,
        skippedSettings
      },
      message: 'Settings imported successfully'
    });
  } catch (error) {
    console.error('Import settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to import settings'
    });
  }
};

// @desc    Get settings change history
// @route   GET /api/settings/history
// @access  Private (super_admin only)
const getSettingsHistory = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      category,
      key,
      startDate,
      endDate
    } = req.query;

    // Build filter
    const filter = {
      entityType: 'Settings',
      action: { $in: ['setting_created', 'setting_updated', 'setting_reset'] }
    };

    if (category) filter['details.category'] = category;
    if (key) filter['details.key'] = key;
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) filter.timestamp.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const history = await AuditLog.find(filter)
      .populate('userId', 'firstName lastName')
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await AuditLog.countDocuments(filter);

    res.json({
      success: true,
      data: history,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get settings history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve settings history'
    });
  }
};

module.exports = {
  getSettings,
  getSettingsByCategory,
  updateSettings,
  updateSystemSettings,
  resetSettings,
  exportSettings,
  importSettings,
  getSettingsHistory
};
