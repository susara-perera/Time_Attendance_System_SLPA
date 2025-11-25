const { body, param, query, validationResult } = require('express-validator');
const mongoose = require('mongoose');

// Validation error handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(error => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value
    }));

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: formattedErrors
    });
  }
  
  next();
};

// Common validation rules
const commonValidations = {
  mongoId: (field) => 
    param(field)
      .isMongoId()
      .withMessage(`${field} must be a valid MongoDB ObjectId`),

  email: (field = 'email') =>
    body(field)
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email address'),

  password: (field = 'password') =>
    body(field)
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long'),

  name: (field, minLength = 2, maxLength = 50) =>
    body(field)
      .trim()
      .isLength({ min: minLength, max: maxLength })
      .withMessage(`${field} must be between ${minLength} and ${maxLength} characters`)
      .matches(/^[a-zA-Z\s]+$/)
      .withMessage(`${field} can only contain letters and spaces`),

  employeeId: (field = 'employeeId') =>
    body(field)
      .trim()
      .isLength({ min: 1, max: 20 })
      .withMessage('Employee ID must be between 1 and 20 characters'),

  phone: (field = 'phone') =>
    body(field)
      .optional()
      .isMobilePhone()
      .withMessage('Please provide a valid phone number'),

  date: (field) =>
    body(field)
      .isISO8601()
      .withMessage(`${field} must be a valid date`)
      .toDate(),

  time: (field) =>
    body(field)
      .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage(`${field} must be in HH:MM format`),

  positiveNumber: (field) =>
    body(field)
      .isFloat({ min: 0 })
      .withMessage(`${field} must be a positive number`),

  requiredString: (field, minLength = 1, maxLength = 255) =>
    body(field)
      .trim()
      .isLength({ min: minLength, max: maxLength })
      .withMessage(`${field} is required and must be between ${minLength} and ${maxLength} characters`),

  optionalString: (field, maxLength = 255) =>
    body(field)
      .optional()
      .trim()
      .isLength({ max: maxLength })
      .withMessage(`${field} cannot exceed ${maxLength} characters`),

  role: (field = 'role') =>
    body(field)
      .isIn(['super_admin', 'admin', 'clerk', 'administrative_clerk', 'employee'])
      .withMessage('Role must be one of: super_admin, admin, clerk, administrative_clerk, employee'),

  status: (field, allowedValues) =>
    body(field)
      .isIn(allowedValues)
      .withMessage(`${field} must be one of: ${allowedValues.join(', ')}`),

  arrayNotEmpty: (field) =>
    body(field)
      .isArray({ min: 1 })
      .withMessage(`${field} must be a non-empty array`),

  coordinates: (latField, lngField) => [
    body(latField)
      .optional()
      .isFloat({ min: -90, max: 90 })
      .withMessage('Latitude must be between -90 and 90'),
    body(lngField)
      .optional()
      .isFloat({ min: -180, max: 180 })
      .withMessage('Longitude must be between -180 and 180')
  ]
};

// User validation rules
const userValidation = {
  create: [
    commonValidations.requiredString('firstName', 2, 50),
    commonValidations.requiredString('lastName', 2, 50),
    commonValidations.email(),
    commonValidations.employeeId(),
    body('password')
      .isLength({ min: 1 })
      .withMessage('Password is required'),
    commonValidations.role(),
    body('division')
      .if(body('role').not().equals('super_admin'))
      .isMongoId()
      .withMessage('Division is required for non-super admin users'),
    body('section')
      .optional()
      .isMongoId()
      .withMessage('Section must be a valid MongoDB ObjectId'),
    commonValidations.phone(),
    commonValidations.optionalString('designation', 100),
    body('salary')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Salary must be a positive number'),
    handleValidationErrors
  ],

  update: [
    commonValidations.mongoId('id'),
    commonValidations.optionalString('firstName', 2, 50),
    commonValidations.optionalString('lastName', 2, 50),
    body('email')
      .optional()
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email address'),
    body('employeeId')
      .optional()
      .trim()
      .isLength({ min: 3, max: 20 })
      .withMessage('Employee ID must be between 3 and 20 characters'),
    body('role')
      .optional()
      .isIn(['super_admin', 'admin', 'clerk', 'administrative_clerk', 'employee'])
      .withMessage('Role must be one of: super_admin, admin, clerk, administrative_clerk, employee'),
    body('division')
      .optional()
      .isMongoId()
      .withMessage('Division must be a valid MongoDB ObjectId'),
    body('section')
      .optional()
      .isMongoId()
      .withMessage('Section must be a valid MongoDB ObjectId'),
    commonValidations.phone(),
    commonValidations.optionalString('designation', 100),
    body('salary')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Salary must be a positive number'),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive must be a boolean'),
    handleValidationErrors
  ],

  changePassword: [
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),
    commonValidations.password('newPassword'),
    body('confirmPassword')
      .custom((value, { req }) => {
        if (value !== req.body.newPassword) {
          throw new Error('Password confirmation does not match');
        }
        return true;
      }),
    handleValidationErrors
  ]
};

// Attendance validation rules
const attendanceValidation = {
  checkIn: [
    body('time')
      .optional()
      .isISO8601()
      .withMessage('Check-in time must be a valid date')
      .toDate(),
    ...commonValidations.coordinates('location.latitude', 'location.longitude'),
    commonValidations.optionalString('location.address', 200),
    body('method')
      .optional()
      .isIn(['manual', 'biometric', 'web', 'mobile'])
      .withMessage('Method must be one of: manual, biometric, web, mobile'),
    commonValidations.optionalString('remarks', 500),
    handleValidationErrors
  ],

  checkOut: [
    body('time')
      .optional()
      .isISO8601()
      .withMessage('Check-out time must be a valid date')
      .toDate(),
    ...commonValidations.coordinates('location.latitude', 'location.longitude'),
    commonValidations.optionalString('location.address', 200),
    body('method')
      .optional()
      .isIn(['manual', 'biometric', 'web', 'mobile'])
      .withMessage('Method must be one of: manual, biometric, web, mobile'),
    commonValidations.optionalString('remarks', 500),
    handleValidationErrors
  ],

  update: [
    commonValidations.mongoId('id'),
    body('date')
      .optional()
      .isISO8601()
      .withMessage('Date must be a valid date')
      .toDate(),
    body('checkIn.time')
      .optional()
      .isISO8601()
      .withMessage('Check-in time must be a valid date')
      .toDate(),
    body('checkOut.time')
      .optional()
      .isISO8601()
      .withMessage('Check-out time must be a valid date')
      .toDate(),
    body('status')
      .optional()
      .isIn(['present', 'absent', 'late', 'half_day', 'leave', 'holiday', 'weekend'])
      .withMessage('Status must be a valid attendance status'),
    commonValidations.optionalString('remarks', 500),
    body('reason')
      .notEmpty()
      .withMessage('Reason for editing attendance is required'),
    handleValidationErrors
  ]
};

// Division validation rules
const divisionValidation = {
  create: [
    body('name')
      .trim()
      .isLength({ min: 1 })
      .withMessage('Division name is required'),
    body('code')
      .trim()
      .isLength({ min: 1 })
      .withMessage('Division code is required'),
    handleValidationErrors
  ],

  update: [
    commonValidations.mongoId('id'),
    body('name')
      .optional()
      .trim()
      .isLength({ min: 1 })
      .withMessage('Division name is required'),
    body('code')
      .optional()
      .trim()
      .isLength({ min: 1 })
      .withMessage('Division code is required'),
    body('description')
      .optional()
      .trim(),
    body('manager')
      .optional()
      .isMongoId()
      .withMessage('Manager must be a valid user ID'),
    body('workingHours.startTime')
      .optional()
      .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('Start time must be in HH:MM format'),
    body('workingHours.endTime')
      .optional()
      .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('End time must be in HH:MM format'),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive must be a boolean'),
    handleValidationErrors
  ]
};

// Section validation rules
const sectionValidation = {
  create: [
    commonValidations.requiredString('name', 2, 100),
    body('code')
      .optional()
      .trim()
      .isLength({ min: 2, max: 10 })
      .withMessage('Section code must be between 2 and 10 characters')
      .matches(/^[A-Z0-9_]+$/)
      .withMessage('Section code can only contain uppercase letters, numbers, and underscores'),
    body('division')
      .isMongoId()
      .withMessage('Division is required and must be a valid ID'),
    commonValidations.optionalString('description', 500),
    body('supervisor')
      .optional()
      .isMongoId()
      .withMessage('Supervisor must be a valid user ID'),
    body('capacity')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Capacity must be at least 1'),
    body('status')
      .optional()
      .isIn(['active', 'inactive'])
      .withMessage('Status must be either active or inactive'),
    handleValidationErrors
  ],

  update: [
    commonValidations.mongoId('id'),
    commonValidations.optionalString('name', 2, 100),
    body('code')
      .optional()
      .trim()
      .isLength({ min: 2, max: 10 })
      .withMessage('Section code must be between 2 and 10 characters')
      .matches(/^[A-Z0-9_]+$/)
      .withMessage('Section code can only contain uppercase letters, numbers, and underscores'),
    body('division')
      .optional()
      .isMongoId()
      .withMessage('Division must be a valid ID'),
    commonValidations.optionalString('description', 500),
    body('supervisor')
      .optional()
      .isMongoId()
      .withMessage('Supervisor must be a valid user ID'),
    body('capacity')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Capacity must be at least 1'),
    body('status')
      .optional()
      .isIn(['active', 'inactive'])
      .withMessage('Status must be either active or inactive'),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive must be a boolean'),
    handleValidationErrors
  ]
};

// Meal validation rules
const mealValidation = {
  create: [
    commonValidations.requiredString('name', 1, 100),
    commonValidations.optionalString('description', 0, 500),
    body('mealType')
      .isIn(['breakfast', 'lunch', 'dinner', 'snack'])
      .withMessage('Meal type must be one of: breakfast, lunch, dinner, snack'),
    body('date')
      .isISO8601()
      .withMessage('Date must be a valid date')
      .toDate(),
    body('price')
      .isFloat({ min: 0 })
      .withMessage('Price must be a positive number'),
    body('maxBookings')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Max bookings must be a positive integer'),
    body('bookingDeadline')
      .optional()
      .isISO8601()
      .withMessage('Booking deadline must be a valid date')
      .toDate(),
    handleValidationErrors
  ],

  booking: [
    body('quantity')
      .optional()
      .isInt({ min: 1, max: 10 })
      .withMessage('Quantity must be between 1 and 10'),
    commonValidations.optionalString('specialRequests', 0, 500),
    handleValidationErrors
  ],

  rating: [
    body('rating')
      .isInt({ min: 1, max: 5 })
      .withMessage('Rating must be between 1 and 5'),
    commonValidations.optionalString('review', 0, 1000),
    handleValidationErrors
  ],

  menuGeneration: [
    body('startDate')
      .isISO8601()
      .withMessage('Start date must be a valid date')
      .toDate(),
    body('endDate')
      .isISO8601()
      .withMessage('End date must be a valid date')
      .toDate()
      .custom((endDate, { req }) => {
        if (endDate <= req.body.startDate) {
          throw new Error('End date must be after start date');
        }
        return true;
      }),
    body('preferences')
      .optional()
      .isObject()
      .withMessage('Preferences must be an object'),
    handleValidationErrors
  ],

  order: [
    body('mealType')
      .isIn(['breakfast', 'lunch', 'dinner', 'snack'])
      .withMessage('Meal type must be one of: breakfast, lunch, dinner, snack'),
    body('mealTime')
      .isISO8601()
      .withMessage('Meal time must be a valid date')
      .toDate(),
    body('location')
      .optional()
      .isIn(['cafeteria', 'office', 'outside', 'home'])
      .withMessage('Location must be one of: cafeteria, office, outside, home'),
    body('items')
      .isArray({ min: 1 })
      .withMessage('Items must be a non-empty array'),
    body('items.*.name')
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Item name is required and cannot exceed 100 characters'),
    body('items.*.category')
      .isIn(['main_course', 'side_dish', 'beverage', 'dessert', 'salad', 'soup'])
      .withMessage('Item category must be valid'),
    body('items.*.quantity')
      .isInt({ min: 1 })
      .withMessage('Item quantity must be at least 1'),
    body('items.*.price')
      .isFloat({ min: 0 })
      .withMessage('Item price must be a positive number'),
    body('paymentMethod')
      .optional()
      .isIn(['cash', 'card', 'employee_credit', 'company_sponsored', 'free'])
      .withMessage('Payment method must be valid'),
    handleValidationErrors
  ],

  update: [
    commonValidations.mongoId('id'),
    body('status')
      .optional()
      .isIn(['ordered', 'preparing', 'ready', 'served', 'cancelled'])
      .withMessage('Status must be valid'),
    body('paymentStatus')
      .optional()
      .isIn(['pending', 'paid', 'cancelled', 'refunded'])
      .withMessage('Payment status must be valid'),
    handleValidationErrors
  ]
};

// Report validation rules
const reportValidation = {
  attendanceReport: [
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Start date must be a valid date')
      .toDate(),
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid date')
      .toDate(),
    query('division')
      .optional()
      .isMongoId()
      .withMessage('Division must be a valid MongoDB ObjectId'),
    query('section')
      .optional()
      .isMongoId()
      .withMessage('Section must be a valid MongoDB ObjectId'),
    query('format')
      .optional()
      .isIn(['json', 'pdf', 'excel', 'csv'])
      .withMessage('Format must be one of: json, pdf, excel, csv'),
    handleValidationErrors
  ],

  auditReport: [
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Start date must be a valid date')
      .toDate(),
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid date')
      .toDate(),
    query('action')
      .optional()
      .isString()
      .withMessage('Action must be a string'),
    query('userId')
      .optional()
      .isMongoId()
      .withMessage('User ID must be a valid MongoDB ObjectId'),
    handleValidationErrors
  ],

  mealReport: [
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Start date must be a valid date')
      .toDate(),
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid date')
      .toDate(),
    query('mealType')
      .optional()
      .isIn(['breakfast', 'lunch', 'dinner', 'snack'])
      .withMessage('Meal type must be one of: breakfast, lunch, dinner, snack'),
    handleValidationErrors
  ],

  unitAttendanceReport: [
    query('date')
      .optional()
      .isISO8601()
      .withMessage('Date must be a valid date')
      .toDate(),
    query('division')
      .optional()
      .isMongoId()
      .withMessage('Division must be a valid MongoDB ObjectId'),
    query('section')
      .optional()
      .isMongoId()
      .withMessage('Section must be a valid MongoDB ObjectId'),
    handleValidationErrors
  ],

  divisionReport: [
    param('divisionId')
      .isMongoId()
      .withMessage('Division ID must be a valid MongoDB ObjectId'),
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Start date must be a valid date')
      .toDate(),
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid date')
      .toDate(),
    handleValidationErrors
  ],

  userActivityReport: [
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Start date must be a valid date')
      .toDate(),
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid date')
      .toDate(),
    query('userId')
      .optional()
      .isMongoId()
      .withMessage('User ID must be a valid MongoDB ObjectId'),
    handleValidationErrors
  ],

  reportSummary: [
    query('period')
      .optional()
      .isIn(['daily', 'weekly', 'monthly', 'yearly'])
      .withMessage('Period must be one of: daily, weekly, monthly, yearly'),
    query('date')
      .optional()
      .isISO8601()
      .withMessage('Date must be a valid date')
      .toDate(),
    handleValidationErrors
  ],

  customReport: [
    body('reportType')
      .isString()
      .withMessage('Report type is required'),
    body('criteria')
      .isObject()
      .withMessage('Criteria must be an object'),
    body('startDate')
      .isISO8601()
      .withMessage('Start date must be a valid date')
      .toDate(),
    body('endDate')
      .isISO8601()
      .withMessage('End date must be a valid date')
      .toDate(),
    handleValidationErrors
  ],

  exportReport: [
    param('reportType')
      .isIn(['attendance', 'meal', 'audit', 'user-activity', 'division'])
      .withMessage('Report type must be valid'),
    query('format')
      .isIn(['pdf', 'excel', 'csv'])
      .withMessage('Format must be one of: pdf, excel, csv'),
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Start date must be a valid date')
      .toDate(),
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid date')
      .toDate(),
    handleValidationErrors
  ],

  generate: [
    body('type')
      .isIn(['attendance', 'meal', 'audit', 'user'])
      .withMessage('Report type must be one of: attendance, meal, audit, user'),
    body('startDate')
      .isISO8601()
      .withMessage('Start date must be a valid date')
      .toDate(),
    body('endDate')
      .isISO8601()
      .withMessage('End date must be a valid date')
      .toDate()
      .custom((endDate, { req }) => {
        if (endDate <= req.body.startDate) {
          throw new Error('End date must be after start date');
        }
        return true;
      }),
    body('filters.division')
      .optional()
      .isMongoId()
      .withMessage('Division filter must be a valid ID'),
    body('filters.section')
      .optional()
      .isMongoId()
      .withMessage('Section filter must be a valid ID'),
    body('filters.users')
      .optional()
      .isArray()
      .withMessage('Users filter must be an array'),
    body('format')
      .optional()
      .isIn(['pdf', 'excel', 'csv'])
      .withMessage('Format must be one of: pdf, excel, csv'),
    handleValidationErrors
  ]
};

// Authentication validation rules
const authValidation = {
  login: [
    body()
      .custom((value, { req }) => {
        const { email, employeeId, password } = req.body;
        
        // Check if password is provided
        if (!password) {
          throw new Error('Password is required');
        }
        
        // Check if either email or employeeId is provided
        if (!email && !employeeId) {
          throw new Error('Please provide either email or employee ID');
        }
        
        // Validate email format if provided
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          throw new Error('Please provide a valid email address');
        }
        
        // Validate employee ID format if provided - allow more flexible formats
        if (employeeId && employeeId.trim().length === 0) {
          throw new Error('Employee ID cannot be empty');
        }
        
        return true;
      }),
    handleValidationErrors
  ],

  register: [
    commonValidations.requiredString('firstName', 2, 50),
    commonValidations.requiredString('lastName', 2, 50),
    commonValidations.email(),
    commonValidations.employeeId(),
    commonValidations.password(),
    handleValidationErrors
  ],

  forgotPassword: [
    commonValidations.email(),
    handleValidationErrors
  ],

  otpRequest: [
    commonValidations.email(),
    handleValidationErrors
  ],

  otpVerify: [
    commonValidations.email(),
    body('otp')
      .trim()
      .isLength({ min: 6, max: 6 })
      .withMessage('OTP must be 6 digits'),
    handleValidationErrors
  ],

  resetPassword: [
    body('token')
      .notEmpty()
      .withMessage('Reset token is required'),
    commonValidations.password('password'),
    body('confirmPassword')
      .custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error('Password confirmation does not match');
        }
        return true;
      }),
    handleValidationErrors
  ]
};

// Query validation for pagination and filtering
const queryValidation = {
  pagination: [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('sort')
      .optional()
      .matches(/^[a-zA-Z_-]+$/)
      .withMessage('Sort field can only contain letters, underscores, and hyphens'),
    query('order')
      .optional()
      .isIn(['asc', 'desc', '1', '-1'])
      .withMessage('Order must be asc, desc, 1, or -1'),
    handleValidationErrors
  ],

  dateRange: [
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Start date must be a valid date')
      .toDate(),
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid date')
      .toDate(),
    handleValidationErrors
  ]
};

// Settings validation rules
const settingsValidation = {
  update: [
    body('settings')
      .isArray({ min: 1 })
      .withMessage('Settings must be a non-empty array'),
    body('settings.*.key')
      .isString()
      .trim()
      .isLength({ min: 1 })
      .withMessage('Setting key is required'),
    body('settings.*.category')
      .isString()
      .trim()
      .isLength({ min: 1 })
      .withMessage('Setting category is required'),
    body('settings.*.value')
      .exists()
      .withMessage('Setting value is required'),
    handleValidationErrors
  ],

  systemUpdate: [
    body('systemSettings')
      .isObject()
      .withMessage('System settings must be an object'),
    handleValidationErrors
  ],

  reset: [
    body('category')
      .optional()
      .isString()
      .withMessage('Category must be a string'),
    body('keys')
      .optional()
      .isArray()
      .withMessage('Keys must be an array'),
    handleValidationErrors
  ],

  import: [
    body('settings')
      .isObject()
      .withMessage('Settings must be an object'),
    body('overwrite')
      .optional()
      .isBoolean()
      .withMessage('Overwrite must be a boolean'),
    handleValidationErrors
  ]
};

module.exports = {
  handleValidationErrors,
  commonValidations,
  userValidation,
  attendanceValidation,
  divisionValidation,
  sectionValidation,
  mealValidation,
  reportValidation,
  authValidation,
  queryValidation,
  settingsValidation
};
