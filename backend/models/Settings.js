const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: ['general', 'attendance', 'security', 'notifications', 'reports', 'meal', 'appearance'],
    index: true
  },
  key: {
    type: String,
    required: [true, 'Key is required'],
    trim: true,
    index: true
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: [true, 'Value is required']
  },
  dataType: {
    type: String,
    enum: ['string', 'number', 'boolean', 'object', 'array'],
    required: [true, 'Data type is required']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  defaultValue: {
    type: mongoose.Schema.Types.Mixed
  },
  isEditable: {
    type: Boolean,
    default: true
  },
  isVisible: {
    type: Boolean,
    default: true
  },
  requiresRestart: {
    type: Boolean,
    default: false
  },
  scope: {
    type: String,
    enum: ['global', 'division', 'section', 'user'],
    default: 'global'
  },
  scopeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: function() {
      if (this.scope === 'division') return 'Division';
      if (this.scope === 'section') return 'Section';
      if (this.scope === 'user') return 'User';
      return null;
    }
  },
  validation: {
    required: {
      type: Boolean,
      default: false
    },
    minValue: Number,
    maxValue: Number,
    minLength: Number,
    maxLength: Number,
    pattern: String, // Regex pattern for validation
    allowedValues: [mongoose.Schema.Types.Mixed]
  },
  metadata: {
    group: String, // For grouping related settings
    order: {
      type: Number,
      default: 0
    },
    icon: String,
    helpText: String,
    warningText: String
  },
  permissions: {
    read: {
      type: [String],
      enum: ['super_admin', 'admin', 'clerk', 'administrative_clerk', 'employee'],
      default: ['super_admin', 'admin']
    },
    write: {
      type: [String],
      enum: ['super_admin', 'admin', 'administrative_clerk'],
      default: ['super_admin']
    }
  },
  auditTrail: [{
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    changedAt: {
      type: Date,
      default: Date.now
    },
    oldValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed,
    reason: String,
    ipAddress: String
  }],
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound unique index
settingsSchema.index({ category: 1, key: 1, scope: 1, scopeId: 1 }, { unique: true });

// Virtual for full key name
settingsSchema.virtual('fullKey').get(function() {
  return `${this.category}.${this.key}`;
});

// Pre-save middleware for validation
settingsSchema.pre('save', function(next) {
  // Validate value based on dataType
  if (!this.validateValue()) {
    return next(new Error(`Invalid value for data type ${this.dataType}`));
  }
  
  // Validate against custom validation rules
  if (!this.validateCustomRules()) {
    return next(new Error('Value does not meet validation requirements'));
  }
  
  next();
});

// Instance method to validate value based on data type
settingsSchema.methods.validateValue = function() {
  switch (this.dataType) {
    case 'string':
      return typeof this.value === 'string';
    case 'number':
      return typeof this.value === 'number' && !isNaN(this.value);
    case 'boolean':
      return typeof this.value === 'boolean';
    case 'object':
      return typeof this.value === 'object' && this.value !== null && !Array.isArray(this.value);
    case 'array':
      return Array.isArray(this.value);
    default:
      return true;
  }
};

// Instance method to validate custom rules
settingsSchema.methods.validateCustomRules = function() {
  const validation = this.validation;
  
  if (validation.required && (this.value === null || this.value === undefined || this.value === '')) {
    return false;
  }
  
  if (this.dataType === 'string') {
    if (validation.minLength && this.value.length < validation.minLength) return false;
    if (validation.maxLength && this.value.length > validation.maxLength) return false;
    if (validation.pattern && !new RegExp(validation.pattern).test(this.value)) return false;
  }
  
  if (this.dataType === 'number') {
    if (validation.minValue !== undefined && this.value < validation.minValue) return false;
    if (validation.maxValue !== undefined && this.value > validation.maxValue) return false;
  }
  
  if (validation.allowedValues && validation.allowedValues.length > 0) {
    return validation.allowedValues.includes(this.value);
  }
  
  return true;
};

// Instance method to add audit trail
settingsSchema.methods.addAuditTrail = function(userId, oldValue, newValue, reason, ipAddress) {
  this.auditTrail.push({
    changedBy: userId,
    oldValue: oldValue,
    newValue: newValue,
    reason: reason,
    ipAddress: ipAddress
  });
  
  this.lastModifiedBy = userId;
};

// Static method to get setting by full key
settingsSchema.statics.getSetting = async function(fullKey, scope = 'global', scopeId = null) {
  const [category, key] = fullKey.split('.');
  
  const query = { category, key, scope, isActive: true };
  if (scopeId) query.scopeId = scopeId;
  
  const setting = await this.findOne(query);
  return setting ? setting.value : null;
};

// Static method to set setting value
settingsSchema.statics.setSetting = async function(fullKey, value, userId, reason, ipAddress, scope = 'global', scopeId = null) {
  const [category, key] = fullKey.split('.');
  
  const query = { category, key, scope };
  if (scopeId) query.scopeId = scopeId;
  
  let setting = await this.findOne(query);
  
  if (setting) {
    const oldValue = setting.value;
    setting.value = value;
    setting.addAuditTrail(userId, oldValue, value, reason, ipAddress);
    await setting.save();
  } else {
    setting = new this({
      category,
      key,
      value,
      dataType: typeof value,
      scope,
      scopeId,
      lastModifiedBy: userId
    });
    setting.addAuditTrail(userId, null, value, reason || 'Initial setting', ipAddress);
    await setting.save();
  }
  
  return setting;
};

// Static method to get all settings for a category
settingsSchema.statics.getCategorySettings = async function(category, scope = 'global', scopeId = null) {
  const query = { category, scope, isActive: true };
  if (scopeId) query.scopeId = scopeId;
  
  return await this.find(query).sort({ 'metadata.order': 1, key: 1 });
};

// Static method to initialize default settings
settingsSchema.statics.initializeDefaults = async function() {
  const defaultSettings = [
    // General Settings
    {
      category: 'general',
      key: 'company_name',
      value: 'My Company',
      dataType: 'string',
      description: 'Company name displayed throughout the system',
      isEditable: true,
      metadata: { group: 'company', order: 1 }
    },
    {
      category: 'general',
      key: 'timezone',
      value: 'Asia/Colombo',
      dataType: 'string',
      description: 'Default timezone for the system',
      isEditable: true,
      metadata: { group: 'localization', order: 1 }
    },
    {
      category: 'general',
      key: 'date_format',
      value: 'DD/MM/YYYY',
      dataType: 'string',
      description: 'Default date format',
      validation: {
        allowedValues: ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']
      },
      metadata: { group: 'localization', order: 2 }
    },
    {
      category: 'general',
      key: 'time_format',
      value: '24h',
      dataType: 'string',
      description: 'Default time format',
      validation: {
        allowedValues: ['12h', '24h']
      },
      metadata: { group: 'localization', order: 3 }
    },
    
    // Attendance Settings
    {
      category: 'attendance',
      key: 'standard_working_hours',
      value: 8,
      dataType: 'number',
      description: 'Standard working hours per day',
      validation: {
        minValue: 1,
        maxValue: 24
      },
      metadata: { group: 'working_time', order: 1 }
    },
    {
      category: 'attendance',
      key: 'grace_period_minutes',
      value: 15,
      dataType: 'number',
      description: 'Grace period for late arrival (in minutes)',
      validation: {
        minValue: 0,
        maxValue: 60
      },
      metadata: { group: 'working_time', order: 2 }
    },
    {
      category: 'attendance',
      key: 'allow_early_checkin',
      value: true,
      dataType: 'boolean',
      description: 'Allow employees to check in before official start time',
      metadata: { group: 'check_in_out', order: 1 }
    },
    {
      category: 'attendance',
      key: 'require_checkout',
      value: true,
      dataType: 'boolean',
      description: 'Require employees to check out',
      metadata: { group: 'check_in_out', order: 2 }
    },
    
    // Security Settings
    {
      category: 'security',
      key: 'password_min_length',
      value: 8,
      dataType: 'number',
      description: 'Minimum password length',
      validation: {
        minValue: 6,
        maxValue: 50
      },
      metadata: { group: 'password_policy', order: 1 }
    },
    {
      category: 'security',
      key: 'password_require_uppercase',
      value: true,
      dataType: 'boolean',
      description: 'Require uppercase letters in password',
      metadata: { group: 'password_policy', order: 2 }
    },
    {
      category: 'security',
      key: 'password_require_lowercase',
      value: true,
      dataType: 'boolean',
      description: 'Require lowercase letters in password',
      metadata: { group: 'password_policy', order: 3 }
    },
    {
      category: 'security',
      key: 'password_require_numbers',
      value: true,
      dataType: 'boolean',
      description: 'Require numbers in password',
      metadata: { group: 'password_policy', order: 4 }
    },
    {
      category: 'security',
      key: 'password_require_symbols',
      value: false,
      dataType: 'boolean',
      description: 'Require special characters in password',
      metadata: { group: 'password_policy', order: 5 }
    },
    {
      category: 'security',
      key: 'max_login_attempts',
      value: 5,
      dataType: 'number',
      description: 'Maximum failed login attempts before account lock',
      validation: {
        minValue: 3,
        maxValue: 10
      },
      metadata: { group: 'account_security', order: 1 }
    },
    {
      category: 'security',
      key: 'account_lockout_duration',
      value: 30,
      dataType: 'number',
      description: 'Account lockout duration in minutes',
      validation: {
        minValue: 5,
        maxValue: 1440
      },
      metadata: { group: 'account_security', order: 2 }
    },
    
    // Notification Settings
    {
      category: 'notifications',
      key: 'email_notifications',
      value: true,
      dataType: 'boolean',
      description: 'Enable email notifications',
      metadata: { group: 'email', order: 1 }
    },
    {
      category: 'notifications',
      key: 'notify_late_arrival',
      value: true,
      dataType: 'boolean',
      description: 'Send notifications for late arrivals',
      metadata: { group: 'attendance_alerts', order: 1 }
    },
    {
      category: 'notifications',
      key: 'notify_early_departure',
      value: true,
      dataType: 'boolean',
      description: 'Send notifications for early departures',
      metadata: { group: 'attendance_alerts', order: 2 }
    },
    
    // Report Settings
    {
      category: 'reports',
      key: 'default_report_period',
      value: 'monthly',
      dataType: 'string',
      description: 'Default time period for reports',
      validation: {
        allowedValues: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly']
      },
      metadata: { group: 'defaults', order: 1 }
    },
    {
      category: 'reports',
      key: 'auto_generate_monthly_reports',
      value: false,
      dataType: 'boolean',
      description: 'Automatically generate monthly reports',
      metadata: { group: 'automation', order: 1 }
    },
    
    // Meal Settings
    {
      category: 'meal',
      key: 'meal_booking_enabled',
      value: true,
      dataType: 'boolean',
      description: 'Enable meal booking system',
      metadata: { group: 'general', order: 1 }
    },
    {
      category: 'meal',
      key: 'meal_subsidy_enabled',
      value: false,
      dataType: 'boolean',
      description: 'Enable meal subsidies',
      metadata: { group: 'subsidies', order: 1 }
    },
    {
      category: 'meal',
      key: 'default_meal_subsidy',
      value: 0,
      dataType: 'number',
      description: 'Default meal subsidy amount',
      validation: {
        minValue: 0
      },
      metadata: { group: 'subsidies', order: 2 }
    }
  ];
  
  for (const settingData of defaultSettings) {
    const existing = await this.findOne({
      category: settingData.category,
      key: settingData.key,
      scope: 'global'
    });
    
    if (!existing) {
      const setting = new this({
        ...settingData,
        scope: 'global',
        defaultValue: settingData.value
      });
      await setting.save();
    }
  }
  
  console.log('Default settings initialized');
};

module.exports = mongoose.model('Settings', settingsSchema);
