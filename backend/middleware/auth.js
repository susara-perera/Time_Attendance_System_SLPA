const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

// Verify JWT token
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '') || req.cookies?.token;
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Access denied. No token provided.' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id)
      .populate('division', 'name code')
      .populate('section', 'name code');

    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Token is valid but user not found.' 
      });
    }

    if (!user.isActive) {
      return res.status(403).json({ 
        success: false, 
        message: 'Account is deactivated.' 
      });
    }

    if (user.isLocked) {
      return res.status(423).json({ 
        success: false, 
        message: 'Account is locked due to multiple failed login attempts.' 
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token.' 
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Token expired.' 
      });
    }

    console.error('Auth middleware error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error in authentication.' 
    });
  }
};

// Check user roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Access denied. Not authenticated.' 
      });
    }

    if (!roles.includes(req.user.role)) {
      // Log unauthorized access attempt
      AuditLog.createLog({
        user: req.user._id,
        action: 'permission_denied',
        entity: { type: 'System' },
        category: 'authorization',
        severity: 'high',
        description: `Unauthorized access attempt to ${req.method} ${req.originalUrl}`,
        details: `User with role '${req.user.role}' attempted to access resource requiring roles: ${roles.join(', ')}`,
        metadata: {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          method: req.method,
          endpoint: req.originalUrl
        },
        isSecurityRelevant: true
      });

      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Insufficient privileges.' 
      });
    }

    next();
  };
};

// Check specific permissions
const checkPermission = (resource, action) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Access denied. Not authenticated.' 
      });
    }

    // Super admin has all permissions
    if (req.user.role === 'super_admin') {
      return next();
    }

    // Check if user has the required permission
    const hasPermission = req.user.permissions?.[resource]?.[action];
    
    if (!hasPermission) {
      // Log unauthorized access attempt
      AuditLog.createLog({
        user: req.user._id,
        action: 'permission_denied',
        entity: { type: 'System' },
        category: 'authorization',
        severity: 'medium',
        description: `Permission denied for ${resource}.${action}`,
        details: `User attempted to perform '${action}' on '${resource}' without proper permissions`,
        metadata: {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          method: req.method,
          endpoint: req.originalUrl
        },
        isSecurityRelevant: true
      });

      return res.status(403).json({ 
        success: false, 
        message: `Access denied. Missing permission: ${resource}.${action}` 
      });
    }

    next();
  };
};

// Check if user can access specific division/section
const checkDivisionAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Access denied. Not authenticated.' 
    });
  }

  // Super admin can access all divisions
  if (req.user.role === 'super_admin') {
    return next();
  }

  const requestedDivisionId = req.params.divisionId || req.body.division || req.query.division;
  
  // If no specific division requested, allow access
  if (!requestedDivisionId) {
    return next();
  }

  // Check if user belongs to the requested division
  if (req.user.division && req.user.division._id.toString() !== requestedDivisionId) {
    return res.status(403).json({ 
      success: false, 
      message: 'Access denied. Cannot access data from other divisions.' 
    });
  }

  next();
};

// Check if user can access specific section
const checkSectionAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Access denied. Not authenticated.' 
    });
  }

  // Super admin and admin can access all sections
  if (['super_admin', 'admin'].includes(req.user.role)) {
    return next();
  }

  const requestedSectionId = req.params.sectionId || req.body.section || req.query.section;
  
  // If no specific section requested, allow access
  if (!requestedSectionId) {
    return next();
  }

  // Check if user belongs to the requested section
  if (req.user.section && req.user.section._id.toString() !== requestedSectionId) {
    return res.status(403).json({ 
      success: false, 
      message: 'Access denied. Cannot access data from other sections.' 
    });
  }

  next();
};

// Check if user can modify their own data or has admin privileges
const checkSelfOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Access denied. Not authenticated.' 
    });
  }

  const targetUserId = req.params.userId || req.params.id || req.body.userId;
  
  // Super admin and admin can modify any user
  if (['super_admin', 'admin'].includes(req.user.role)) {
    return next();
  }

  // Users can only modify their own data
  if (req.user._id.toString() === targetUserId) {
    return next();
  }

  return res.status(403).json({ 
    success: false, 
    message: 'Access denied. Can only modify your own data.' 
  });
};

// Rate limiting based on user role
const roleBasedRateLimit = (req, res, next) => {
  const limits = {
    super_admin: 1000, // requests per 15 minutes
    admin: 500,
    clerk: 200,
    employee: 100
  };

  const userRole = req.user?.role || 'employee';
  const limit = limits[userRole];

  // Store rate limit info in request for rate limiter middleware
  req.rateLimit = {
    max: limit,
    windowMs: 15 * 60 * 1000, // 15 minutes
    keyGenerator: (req) => `${userRole}:${req.user?._id || req.ip}`
  };

  next();
};

// Audit trail middleware
const auditTrail = (action, entityType) => {
  return (req, res, next) => {
    // Store original response methods
    const originalSend = res.send;
    const originalJson = res.json;
    
    // Track request start time
    const startTime = Date.now();
    
    // Override response methods to capture response data
    res.send = function(data) {
      logAuditTrail();
      return originalSend.call(this, data);
    };
    
    res.json = function(data) {
      logAuditTrail(data);
      return originalJson.call(this, data);
    };
    
    const logAuditTrail = (responseData) => {
      const duration = Date.now() - startTime;
      
      // Only log if user is authenticated
      if (req.user) {
        const auditData = {
          user: req.user._id,
          action: action,
          entity: {
            type: entityType,
            id: req.params.id || req.params.userId || req.body._id,
            name: req.body.name || req.body.firstName || req.body.email
          },
          category: getCategoryFromAction(action),
          severity: getSeverityFromAction(action),
          description: getDescriptionFromAction(action, req),
          metadata: {
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            method: req.method,
            endpoint: req.originalUrl,
            responseCode: res.statusCode,
            duration: duration
          }
        };

        // Add changes if it's an update operation
        if (action.includes('update') && req.body) {
          auditData.changes = {
            after: req.body
          };
        }

        AuditLog.createLog(auditData);
      }
    };
    
    next();
  };
};

// Helper functions for audit trail
const getCategoryFromAction = (action) => {
  if (action.includes('login') || action.includes('logout')) return 'authentication';
  if (action.includes('permission') || action.includes('role')) return 'authorization';
  if (action.includes('password')) return 'security';
  if (action.includes('settings') || action.includes('config')) return 'configuration';
  return 'data_modification';
};

const getSeverityFromAction = (action) => {
  if (action.includes('delete') || action.includes('role_change')) return 'high';
  if (action.includes('create') || action.includes('update')) return 'medium';
  return 'low';
};

const getDescriptionFromAction = (action, req) => {
  const resourceMap = {
    user: 'User',
    attendance: 'Attendance',
    division: 'Division',
    section: 'Section',
    meal: 'Meal',
    report: 'Report'
  };
  
  const resource = Object.keys(resourceMap).find(key => 
    req.originalUrl.includes(key)
  ) || 'Resource';
  
  return `${action.replace('_', ' ')} - ${resourceMap[resource] || resource}`;
};

module.exports = {
  auth,
  authorize,
  checkPermission,
  checkDivisionAccess,
  checkSectionAccess,
  checkSelfOrAdmin,
  roleBasedRateLimit,
  auditTrail
};
