const express = require('express');
const {
  getMeals,
  getMeal,
  createMeal,
  updateMeal,
  deleteMeal,
  bookMeal,
  cancelMealBooking,
  getUserMealBookings,
  getMealBookings,
  rateMeal,
  getMealStats,
  generateMealMenu,
  createMealBooking,
  getTodaysBookingsCount,
  getTodaysBookings,
  setMealPreference
} = require('../controllers/mealController');
const { 
  auth, 
  authorize, 
  checkPermission,
  auditTrail 
} = require('../middleware/auth');
const { mealValidation, queryValidation } = require('../middleware/validation');

const router = express.Router();

// @route   GET /api/meals
// @desc    Get all meals
// @access  Private
router.get(
  '/',
  auth,
  queryValidation.pagination,
  auditTrail('meals_viewed', 'Meal'),
  getMeals
);

// @route   GET /api/meals/:id
// @desc    Get single meal
// @access  Private
router.get(
  '/:id',
  auth,
  auditTrail('meal_viewed', 'Meal'),
  getMeal
);

// @route   GET /api/meals/user/bookings
// @desc    Get user's meal bookings
// @access  Private
router.get(
  '/user/bookings',
  auth,
  queryValidation.pagination,
  auditTrail('user_meal_bookings_viewed', 'Meal'),
  getUserMealBookings
);

// @route   GET /api/meals/:id/bookings
// @desc    Get meal bookings
// @access  Private (administrator and super_admin only)
router.get(
  '/:id/bookings',
  auth,
  authorize(['administrator', 'super_admin']),
  checkPermission('meals', 'view_bookings'),
  queryValidation.pagination,
  auditTrail('meal_bookings_viewed', 'Meal'),
  getMealBookings
);

// @route   GET /api/meals/stats/overview
// @desc    Get meal statistics
// @access  Private (administrator and super_admin only)
router.get(
  '/stats/overview',
  auth,
  authorize(['administrator', 'super_admin']),
  checkPermission('meals', 'view_stats'),
  auditTrail('meal_stats_viewed', 'Meal'),
  getMealStats
);

// @route   POST /api/meals
// @desc    Create meal
// @access  Private (administrator and super_admin only)
router.post(
  '/',
  auth,
  authorize(['administrator', 'super_admin']),
  checkPermission('meals', 'create'),
  mealValidation.create,
  auditTrail('meal_created', 'Meal'),
  createMeal
);

// @route   POST /api/meals/:id/book
// @desc    Book a meal
// @access  Private
router.post(
  '/:id/book',
  auth,
  mealValidation.booking,
  auditTrail('meal_booked', 'Meal'),
  bookMeal
);

// @route   POST /api/meals/:id/rate
// @desc    Rate a meal
// @access  Private
router.post(
  '/:id/rate',
  auth,
  mealValidation.rating,
  auditTrail('meal_rated', 'Meal'),
  rateMeal
);

// @route   POST /api/meals/menu/generate
// @desc    Generate meal menu
// @access  Private (administrator and super_admin only)
router.post(
  '/menu/generate',
  auth,
  authorize(['administrator', 'super_admin']),
  checkPermission('meals', 'generate_menu'),
  mealValidation.menuGeneration,
  auditTrail('meal_menu_generated', 'Meal'),
  generateMealMenu
);

// @route   PUT /api/meals/:id
// @desc    Update meal
// @access  Private (administrator and super_admin only)
router.put(
  '/:id',
  auth,
  authorize(['administrator', 'super_admin']),
  checkPermission('meals', 'update'),
  mealValidation.update,
  auditTrail('meal_updated', 'Meal'),
  updateMeal
);

// @route   DELETE /api/meals/:id
// @desc    Delete meal
// @access  Private (super_admin only)
router.delete(
  '/:id',
  auth,
  authorize('super_admin'),
  checkPermission('meals', 'delete'),
  auditTrail('meal_deleted', 'Meal'),
  deleteMeal
);

// @route   DELETE /api/meals/:id/cancel-booking
// @desc    Cancel meal booking
// @access  Private
router.delete(
  '/:id/cancel-booking',
  auth,
  auditTrail('meal_booking_cancelled', 'Meal'),
  cancelMealBooking
);

// @route   POST /api/meal/book
// @desc    Create a new meal booking (saves to MySQL)
// @access  Private
router.post(
  '/book',
  auth,
  auditTrail('meal_booked', 'Meal'),
  createMealBooking
);

// @route   GET /api/meals/bookings/today/count
// @desc    Get today's bookings count
// @access  Private
router.get(
  '/bookings/today/count',
  auth,
  getTodaysBookingsCount
);

// @route   GET /api/meals/bookings/today
// @desc    Get today's bookings with full details
// @access  Private
router.get(
  '/bookings/today',
  auth,
  getTodaysBookings
);

// @route   POST /api/meals/preference
// @desc    Set employee meal preference
// @access  Private
router.post(
  '/preference',
  auth,
  setMealPreference
);

module.exports = router;
