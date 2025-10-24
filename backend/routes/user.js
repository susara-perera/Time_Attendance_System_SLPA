const express = require('express');
const {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  getUserStats,
  toggleUserStatus,
  unlockUser,
  unlockAllUsers,
  getHrisEmployees
} = require('../controllers/userController');
const { 
  auth, 
  authorize, 
  checkPermission, 
  checkSelfOrAdmin,
  auditTrail 
} = require('../middleware/auth');
const { userValidation, queryValidation } = require('../middleware/validation');

const router = express.Router();

// @route   GET /api/users
// @desc    Get all users
// @access  Private (admin, super_admin, clerk, administrative_clerk)
router.get(
  '/',
  // auth,
  // authorize('super_admin', 'admin', 'clerk', 'administrative_clerk'),
  // queryValidation.pagination,
  // auditTrail('users_viewed', 'User'),
  getUsers
);

// @route   GET /api/users/hris
// @desc    Get all employees from HRIS API
// @access  Public (for now)
router.get('/hris', getHrisEmployees);

// @route   GET /api/users/stats
// @desc    Get user statistics
// @access  Private (admin, super_admin, administrative_clerk)
router.get(
  '/stats',
  auth,
  authorize('super_admin', 'admin', 'administrative_clerk'),
  auditTrail('user_stats_viewed', 'User'),
  getUserStats
);

// @route   GET /api/users/:id
// @desc    Get single user
// @access  Private
router.get(
  '/:id',
  auth,
  checkSelfOrAdmin,
  auditTrail('user_viewed', 'User'),
  getUser
);

// @route   POST /api/users
// @desc    Create user
// @access  Private (admin, super_admin, administrative_clerk)
router.post(
  '/',
  // auth,
  // authorize('super_admin', 'admin', 'administrative_clerk'),
  // checkPermission('users', 'create'),
  // userValidation.create,
  // auditTrail('user_created', 'User'),
  createUser
);

// @route   PUT /api/users/:id
// @desc    Update user
// @access  Private
router.put(
  '/:id',
  // auth,
  // checkSelfOrAdmin,
  // userValidation.update,
  // auditTrail('user_updated', 'User'),
  updateUser
);

// @route   DELETE /api/users/:id
// @desc    Delete user
// @access  Private (super_admin only)
router.delete(
  '/:id',
  // auth,
  // authorize('super_admin'),
  // checkPermission('users', 'delete'),
  // auditTrail('user_deleted', 'User'),
  deleteUser
);

// @route   PATCH /api/users/:id/toggle-status
// @desc    Toggle user status (activate/deactivate)
// @access  Private (admin, super_admin, administrative_clerk)
router.patch(
  '/:id/toggle-status',
  auth,
  authorize('super_admin', 'admin', 'administrative_clerk'),
  checkPermission('users', 'update'),
  auditTrail('user_status_toggled', 'User'),
  toggleUserStatus
);

// @route   PATCH /api/users/:id/unlock
// @desc    Unlock user account
// @access  Private (admin, super_admin, administrative_clerk)
router.patch(
  '/:id/unlock',
  auth,
  authorize('super_admin', 'admin', 'administrative_clerk'),
  checkPermission('users', 'update'),
  auditTrail('user_unlocked', 'User'),
  unlockUser
);

// @route   POST /api/users/unlock-all
// @desc    Unlock all user accounts (emergency function)
// @access  Public (no auth required for emergency)
router.post(
  '/unlock-all',
  // auth,
  // authorize('super_admin'),
  // auditTrail('unlock_all_users', 'System'),
  unlockAllUsers
);

module.exports = router;
