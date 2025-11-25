const express = require('express');
const {
  login,
  logout,
  getMe,
  updateProfile,
  changePassword,
  requestOtp,
  verifyOtp,
  verifyPassword,
  forgotPassword,
  resetPassword,
  refreshToken,
  verifyToken
} = require('../controllers/authController');
const { auth } = require('../middleware/auth');
const { authValidation, userValidation } = require('../middleware/validation');
const { ensureCacheInitialized } = require('../middleware/cacheCheck');

const router = express.Router();

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
// @note    Ensures HRIS cache is initialized before allowing login
router.post('/login', authValidation.login, ensureCacheInitialized, login);

// @route   POST /api/auth/logout
// @desc    Logout user
// @access  Private
router.post('/logout', auth, logout);

// @route   GET /api/auth/me
// @desc    Get current logged in user
// @access  Private
router.get('/me', auth, getMe);

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', auth, updateProfile);

// @route   PUT /api/auth/change-password
// @desc    Change password
// @access  Private
router.put('/change-password', auth, userValidation.changePassword, changePassword);

// @route   POST /api/auth/verify-password
// @desc    Verify current password (without changing it)
// @access  Private
router.post('/verify-password', auth, verifyPassword);

// @route   POST /api/auth/forgot-password
// @desc    Forgot password
// @access  Public
router.post('/forgot-password', authValidation.forgotPassword, forgotPassword);

// OTP request / verify for forgot password flow
router.post('/request-otp', authValidation.otpRequest, requestOtp);
router.post('/verify-otp', authValidation.otpVerify, verifyOtp);

// @route   PUT /api/auth/reset-password/:token
// @desc    Reset password
// @access  Public
router.put('/reset-password/:token', authValidation.resetPassword, resetPassword);

// @route   POST /api/auth/refresh
// @desc    Refresh token
// @access  Private
router.post('/refresh', auth, refreshToken);

// @route   GET /api/auth/verify
// @desc    Verify token
// @access  Private
router.get('/verify', auth, verifyToken);

module.exports = router;
