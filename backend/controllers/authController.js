const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '24h'
  });
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const { email, employeeId, password } = req.body;

    // Determine the login credential (email or employeeId)
    let user;
    let loginIdentifier;

    if (email) {
      // Login with email
      user = await User.findOne({ email })
        .populate('division', 'name code')
        .populate('section', 'name code');
      loginIdentifier = email;
    } else if (employeeId) {
      // Login with employee ID
      user = await User.findOne({ employeeId })
        .populate('division', 'name code')
        .populate('section', 'name code');
      loginIdentifier = employeeId;
    } else {
      return res.status(400).json({
        success: false,
        message: 'Please provide either email or employee ID'
      });
    }

    if (!user) {
      // Log failed login attempt
      await AuditLog.createLog({
        action: 'failed_login',
        entity: { type: 'User', name: loginIdentifier },
        category: 'authentication',
        severity: 'medium',
        description: 'Failed login attempt - user not found',
        details: `Login attempt for non-existent credential: ${loginIdentifier}`,
        metadata: {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          method: req.method,
          endpoint: req.originalUrl
        },
        isSecurityRelevant: true
      });

      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Account lock check removed for development - accounts can login regardless of lock status

    // Check if account is active
    if (!user.isActive) {
      // Log inactive account access attempt
      await AuditLog.createLog({
        user: user._id,
        action: 'failed_login',
        entity: { type: 'User', id: user._id, name: user.email },
        category: 'authentication',
        severity: 'medium',
        description: 'Login attempt on inactive account',
        details: 'User attempted to login with deactivated account',
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
        message: 'Account is deactivated. Please contact administrator.'
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      // Login attempt increment removed for development
      // await user.incLoginAttempts();

      // Log failed login attempt
      await AuditLog.createLog({
        user: user._id,
        action: 'failed_login',
        entity: { type: 'User', id: user._id, name: user.email },
        category: 'authentication',
        severity: 'medium',
        description: 'Failed login attempt - invalid password',
        details: `Invalid password attempt`,
        metadata: {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          method: req.method,
          endpoint: req.originalUrl
        },
        isSecurityRelevant: true
      });

      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Cache initialization is now handled by middleware (ensureCacheInitialized)
    // No need to check here - if we reach this point, cache is ready

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    // Log successful login
    await AuditLog.createLog({
      user: user._id,
      action: 'user_login',
      entity: { type: 'User', id: user._id, name: user.email },
      category: 'authentication',
      severity: 'low',
      description: 'User logged in successfully',
      details: `User ${user.fullName} logged in from ${req.ip}`,
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        method: req.method,
        endpoint: req.originalUrl
      },
      isSecurityRelevant: true
    });

    // Set cookie and send response
    const cookieOptions = {
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    };

    res.cookie('token', token, cookieOptions);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        email: user.email,
        employeeId: user.employeeId,
        role: user.role,
        division: user.division,
        section: user.section,
        permissions: user.permissions,
        lastLogin: user.lastLogin
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
const logout = async (req, res) => {
  try {
    // Log logout
    await AuditLog.createLog({
      user: req.user._id,
      action: 'user_logout',
      entity: { type: 'User', id: req.user._id, name: req.user.email },
      category: 'authentication',
      severity: 'low',
      description: 'User logged out',
      details: `User ${req.user.fullName} logged out`,
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        method: req.method,
        endpoint: req.originalUrl
      },
      isSecurityRelevant: true
    });

    // Clear cookie
    res.cookie('token', 'none', {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true
    });

    res.status(200).json({
      success: true,
      message: 'Logout successful'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during logout'
    });
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('division', 'name code workingHours')
      .populate('section', 'name code');

    res.status(200).json({
      success: true,
      data: user
    });

  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting user data'
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, phone, address } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Store old values for audit
    const oldValues = {
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      address: user.address
    };

    // Update fields
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phone) user.phone = phone;
    if (address) user.address = address;

    await user.save();

    // Log profile update
    await AuditLog.createLog({
      user: req.user._id,
      action: 'profile_updated',
      entity: { type: 'User', id: user._id, name: user.email },
      category: 'data_modification',
      severity: 'low',
      description: 'User profile updated',
      details: 'User updated their profile information',
      changes: {
        before: oldValues,
        after: { firstName, lastName, phone, address }
      },
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        method: req.method,
        endpoint: req.originalUrl
      }
    });

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: user
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating profile'
    });
  }
};

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);

    if (!isCurrentPasswordValid) {
      // Log failed password change attempt
      await AuditLog.createLog({
        user: req.user._id,
        action: 'password_changed',
        entity: { type: 'User', id: user._id, name: user.email },
        category: 'security',
        severity: 'medium',
        description: 'Failed password change attempt',
        details: 'User provided incorrect current password',
        metadata: {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          method: req.method,
          endpoint: req.originalUrl
        },
        isSecurityRelevant: true
      });

      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Log successful password change
    await AuditLog.createLog({
      user: req.user._id,
      action: 'password_changed',
      entity: { type: 'User', id: user._id, name: user.email },
      category: 'security',
      severity: 'medium',
      description: 'Password changed successfully',
      details: 'User changed their password',
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        method: req.method,
        endpoint: req.originalUrl
      },
      isSecurityRelevant: true
    });

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error changing password'
    });
  }
};

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      // Don't reveal if email exists or not
      return res.status(200).json({
        success: true,
        message: 'If the email exists, a password reset link has been sent'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(20).toString('hex');
    
    // Hash token and set to resetPasswordToken field
    user.passwordResetToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // Set expire
    user.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    await user.save();

    // Log password reset request
    await AuditLog.createLog({
      user: user._id,
      action: 'password_reset',
      entity: { type: 'User', id: user._id, name: user.email },
      category: 'security',
      severity: 'medium',
      description: 'Password reset requested',
      details: 'User requested password reset',
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        method: req.method,
        endpoint: req.originalUrl
      },
      isSecurityRelevant: true
    });

    // In production, send email here
    // For now, just return the token for testing
    const resetUrl = `${req.protocol}://${req.get('host')}/api/auth/reset-password/${resetToken}`;

    res.status(200).json({
      success: true,
      message: 'Password reset email sent',
      resetToken: process.env.NODE_ENV === 'development' ? resetToken : undefined,
      resetUrl: process.env.NODE_ENV === 'development' ? resetUrl : undefined
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error sending password reset email'
    });
  }
};

// @desc    Reset password
// @route   PUT /api/auth/reset-password/:token
// @access  Public
const resetPassword = async (req, res) => {
  try {
    const { password } = req.body;

    // Get hashed token
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(req.params.token)
      .digest('hex');

    const user = await User.findOne({
      passwordResetToken,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    // Set new password
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    await user.save();

    // Generate token
    const token = generateToken(user._id);

    // Log password reset
    await AuditLog.createLog({
      user: user._id,
      action: 'password_reset',
      entity: { type: 'User', id: user._id, name: user.email },
      category: 'security',
      severity: 'medium',
      description: 'Password reset completed',
      details: 'User successfully reset their password',
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        method: req.method,
        endpoint: req.originalUrl
      },
      isSecurityRelevant: true
    });

    res.status(200).json({
      success: true,
      message: 'Password reset successful',
      token
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error resetting password'
    });
  }
};

// @desc    Refresh token
// @route   POST /api/auth/refresh
// @access  Private
const refreshToken = async (req, res) => {
  try {
    // Generate new token
    const token = generateToken(req.user._id);

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      token
    });

  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error refreshing token'
    });
  }
};

// @desc    Verify token
// @route   GET /api/auth/verify
// @access  Private
const verifyToken = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: 'Token is valid',
      user: {
        id: req.user._id,
        email: req.user.email,
        role: req.user.role,
        permissions: req.user.permissions
      }
    });

  } catch (error) {
    console.error('Verify token error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error verifying token'
    });
  }
};

// @desc    Verify current password
// @route   POST /api/auth/verify-password
// @access  Private
const verifyPassword = async (req, res) => {
  try {
    const { password } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isValid = await user.comparePassword(password);

    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Invalid password' });
    }

    res.status(200).json({ success: true, message: 'Password valid' });
  } catch (error) {
    console.error('Verify password error:', error);
    res.status(500).json({ success: false, message: 'Server error verifying password' });
  }
};

module.exports = {
  login,
  logout,
  getMe,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  refreshToken,
  verifyToken,
  verifyPassword
};
