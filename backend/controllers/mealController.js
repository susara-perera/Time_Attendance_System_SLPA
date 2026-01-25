const { MySQLMeal: Meal, MySQLUser: User, MySQLAuditLog: AuditLog } = require('../models/mysql');
const { validationResult } = require('express-validator');
const moment = require('moment');

// @desc    Get all meals
// @route   GET /api/meals
// @access  Private
const getMeals = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sort = '-createdAt',
      date,
      mealType,
      status,
      search
    } = req.query;

    // Build filter object
    const filter = { status: { $ne: 'deleted' } };
    
    if (date) {
      const startDate = moment(date).startOf('day').toDate();
      const endDate = moment(date).endOf('day').toDate();
      filter.date = { $gte: startDate, $lte: endDate };
    }
    
    if (mealType) filter.mealType = mealType;
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { 'ingredients.name': { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Get meals
    const meals = await Meal.find(filter)
      .populate('createdBy', 'firstName lastName')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await Meal.countDocuments(filter);

    res.json({
      success: true,
      data: meals,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get meals error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve meals'
    });
  }
};

// @desc    Get single meal
// @route   GET /api/meals/:id
// @access  Private
const getMeal = async (req, res) => {
  try {
    const meal = await Meal.findById(req.params.id)
      .populate('createdBy', 'firstName lastName')
      .populate('bookings.user', 'firstName lastName employeeId');

    if (!meal) {
      return res.status(404).json({
        success: false,
        error: 'Meal not found'
      });
    }

    res.json({
      success: true,
      data: meal
    });
  } catch (error) {
    console.error('Get meal error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve meal'
    });
  }
};

// @desc    Create meal
// @route   POST /api/meals
// @access  Private (administrator and super_admin only)
const createMeal = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const {
      name,
      description,
      mealType,
      date,
      ingredients,
      nutritionalInfo,
      price,
      maxBookings,
      bookingDeadline,
      status
    } = req.body;

    const meal = await Meal.create({
      name,
      description,
      mealType,
      date,
      ingredients,
      nutritionalInfo,
      price,
      maxBookings,
      bookingDeadline,
      status,
      createdBy: req.user.id
    });

    // Log meal creation
    try {
      await AuditLog.createLog({
        user: req.user._id,
        action: 'meal_created',
        entity: { type: 'Meal', id: meal._id, name: meal.name },
        category: 'data_modification',
        severity: 'low',
        description: `Meal "${meal.name}" created`,
        details: `Created meal "${meal.name}" (${meal.mealType}) for ${moment(meal.date).format('YYYY-MM-DD')}`,
        metadata: {
          mealType,
          price,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          method: req.method,
          endpoint: req.originalUrl
        }
      });
    } catch (auditErr) {
      console.error('[AuditLog] Failed to log meal creation:', auditErr);
    }

    // Log to recent activities table
    try {
      const { logRecentActivity } = require('../services/activityLogService');

      await logRecentActivity({
        title: 'New Meal Created',
        description: `"${meal.name}" meal added`,
        activity_type: 'meal_created',
        icon: 'bi bi-cup-hot',
        entity_id: meal._id?.toString(),
        entity_name: meal.name,
        user_id: req.user?._id?.toString(),
        user_name: req.user?.name || req.user?.username || 'Unknown User'
      });

      console.log(`[MySQL] ✅ Recent activity logged for meal creation: ${meal.name}`);
    } catch (activityErr) {
      console.error('[RecentActivity] Failed to log meal creation activity:', activityErr);
    }

    res.status(201).json({
      success: true,
      data: meal,
      message: 'Meal created successfully'
    });
  } catch (error) {
    console.error('Create meal error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create meal'
    });
  }
};

// @desc    Update meal
// @route   PUT /api/meals/:id
// @access  Private (administrator and super_admin only)
const updateMeal = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const meal = await Meal.findById(req.params.id);
    if (!meal) {
      return res.status(404).json({
        success: false,
        error: 'Meal not found'
      });
    }

    const {
      name,
      description,
      mealType,
      date,
      ingredients,
      nutritionalInfo,
      price,
      maxBookings,
      bookingDeadline,
      status
    } = req.body;

    const updatedMeal = await Meal.findByIdAndUpdate(
      req.params.id,
      {
        name,
        description,
        mealType,
        date,
        ingredients,
        nutritionalInfo,
        price,
        maxBookings,
        bookingDeadline,
        status,
        updatedBy: req.user.id
      },
      { new: true, runValidators: true }
    );

    // Log meal update
    try {
      await AuditLog.createLog({
        user: req.user._id,
        action: 'meal_updated',
        entity: { type: 'Meal', id: updatedMeal._id, name: updatedMeal.name },
        category: 'data_modification',
        severity: 'low',
        description: `Meal "${updatedMeal.name}" updated`,
        details: `Updated meal "${updatedMeal.name}" (${updatedMeal.mealType})`,
        changes: { before: { name: meal.name, status: meal.status, price: meal.price }, after: { name, status, price } },
        metadata: {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          method: req.method,
          endpoint: req.originalUrl
        }
      });
    } catch (auditErr) {
      console.error('[AuditLog] Failed to log meal update:', auditErr);
    }

    // Log to recent activities table
    try {
      const { logRecentActivity } = require('../services/activityLogService');

      await logRecentActivity({
        title: 'Meal Updated',
        description: `"${updatedMeal.name}" meal modified`,
        activity_type: 'meal_updated',
        icon: 'bi bi-pencil-square',
        entity_id: updatedMeal._id?.toString(),
        entity_name: updatedMeal.name,
        user_id: req.user?._id?.toString(),
        user_name: req.user?.name || req.user?.username || 'Unknown User'
      });

      console.log(`[MySQL] ✅ Recent activity logged for meal update: ${updatedMeal.name}`);
    } catch (activityErr) {
      console.error('[RecentActivity] Failed to log meal update activity:', activityErr);
    }

    res.json({
      success: true,
      data: updatedMeal,
      message: 'Meal updated successfully'
    });
  } catch (error) {
    console.error('Update meal error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update meal'
    });
  }
};

// @desc    Delete meal
// @route   DELETE /api/meals/:id
// @access  Private (super_admin only)
const deleteMeal = async (req, res) => {
  try {
    const meal = await Meal.findById(req.params.id);
    if (!meal) {
      return res.status(404).json({
        success: false,
        error: 'Meal not found'
      });
    }

    // Check if meal has bookings
    if (meal.bookings && meal.bookings.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete meal with existing bookings'
      });
    }

    await Meal.findByIdAndUpdate(req.params.id, {
      status: 'deleted',
      updatedBy: req.user.id
    });

    // Log meal deletion
    try {
      await AuditLog.createLog({
        user: req.user._id,
        action: 'meal_deleted',
        entity: { type: 'Meal', id: meal._id, name: meal.name },
        category: 'data_modification',
        severity: 'medium',
        description: `Meal "${meal.name}" deleted`,
        details: `Deleted meal "${meal.name}" (${meal.mealType})`,
        metadata: {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          method: req.method,
          endpoint: req.originalUrl
        }
      });
    } catch (auditErr) {
      console.error('[AuditLog] Failed to log meal deletion:', auditErr);
    }

    // Log to recent activities table
    try {
      const { logRecentActivity } = require('../services/activityLogService');

      await logRecentActivity({
        title: 'Meal Deleted',
        description: `"${meal.name}" meal removed`,
        activity_type: 'meal_deleted',
        icon: 'bi bi-trash',
        entity_id: meal._id?.toString(),
        entity_name: meal.name,
        user_id: req.user?._id?.toString(),
        user_name: req.user?.name || req.user?.username || 'Unknown User'
      });

      console.log(`[MySQL] ✅ Recent activity logged for meal deletion: ${meal.name}`);
    } catch (activityErr) {
      console.error('[RecentActivity] Failed to log meal deletion activity:', activityErr);
    }

    res.json({
      success: true,
      message: 'Meal deleted successfully'
    });
  } catch (error) {
    console.error('Delete meal error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete meal'
    });
  }
};

// @desc    Book a meal
// @route   POST /api/meals/:id/book
// @access  Private
const bookMeal = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const meal = await Meal.findById(req.params.id);
    if (!meal) {
      return res.status(404).json({
        success: false,
        error: 'Meal not found'
      });
    }

    // Check if meal is available for booking
    if (meal.status !== 'available') {
      return res.status(400).json({
        success: false,
        error: 'Meal is not available for booking'
      });
    }

    // Check booking deadline
    if (moment().isAfter(moment(meal.bookingDeadline))) {
      return res.status(400).json({
        success: false,
        error: 'Booking deadline has passed'
      });
    }

    // Check if user has already booked this meal
    const existingBooking = meal.bookings.find(
      booking => booking.user.toString() === req.user.id
    );

    if (existingBooking) {
      return res.status(400).json({
        success: false,
        error: 'You have already booked this meal'
      });
    }

    // Check if meal has reached maximum bookings
    if (meal.maxBookings && meal.bookings.length >= meal.maxBookings) {
      return res.status(400).json({
        success: false,
        error: 'Meal has reached maximum bookings'
      });
    }

    const { quantity = 1, specialRequests } = req.body;

    // Add booking
    meal.bookings.push({
      user: req.user.id,
      quantity,
      specialRequests,
      bookingDate: new Date(),
      status: 'confirmed'
    });

    await meal.save();

    // Log meal booking
    try {
      await AuditLog.createLog({
        user: req.user._id,
        action: 'meal_booked',
        entity: { type: 'Meal', id: meal._id, name: meal.name },
        category: 'data_modification',
        severity: 'low',
        description: `Meal "${meal.name}" booked`,
        details: `User booked meal "${meal.name}" x${quantity} (Total: ${meal.price * quantity})`,
        metadata: {
          quantity,
          totalPrice: meal.price * quantity,
          specialRequests,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          method: req.method,
          endpoint: req.originalUrl
        }
      });
    } catch (auditErr) {
      console.error('[AuditLog] Failed to log meal booking:', auditErr);
    }

    res.json({
      success: true,
      message: 'Meal booked successfully',
      data: {
        mealId: meal._id,
        mealName: meal.name,
        quantity,
        totalPrice: meal.price * quantity
      }
    });
  } catch (error) {
    console.error('Book meal error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to book meal'
    });
  }
};

// @desc    Cancel meal booking
// @route   DELETE /api/meals/:id/cancel-booking
// @access  Private
const cancelMealBooking = async (req, res) => {
  try {
    const meal = await Meal.findById(req.params.id);
    if (!meal) {
      return res.status(404).json({
        success: false,
        error: 'Meal not found'
      });
    }

    // Find user's booking
    const bookingIndex = meal.bookings.findIndex(
      booking => booking.user.toString() === req.user.id
    );

    if (bookingIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    // Check if cancellation is allowed (e.g., before a certain time)
    const booking = meal.bookings[bookingIndex];
    const cancellationDeadline = moment(meal.date).subtract(2, 'hours');
    
    if (moment().isAfter(cancellationDeadline)) {
      return res.status(400).json({
        success: false,
        error: 'Cancellation deadline has passed'
      });
    }

    // Remove booking
    meal.bookings.splice(bookingIndex, 1);
    await meal.save();

    // Log meal booking cancellation
    try {
      await AuditLog.createLog({
        user: req.user._id,
        action: 'meal_booking_cancelled',
        entity: { type: 'Meal', id: meal._id, name: meal.name },
        category: 'data_modification',
        severity: 'low',
        description: `Meal "${meal.name}" booking cancelled`,
        details: `User cancelled booking for meal "${meal.name}"`,
        metadata: {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          method: req.method,
          endpoint: req.originalUrl
        }
      });
    } catch (auditErr) {
      console.error('[AuditLog] Failed to log meal booking cancellation:', auditErr);
    }

    res.json({
      success: true,
      message: 'Meal booking cancelled successfully'
    });
  } catch (error) {
    console.error('Cancel meal booking error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel meal booking'
    });
  }
};

// @desc    Get user's meal bookings
// @route   GET /api/meals/user/bookings
// @access  Private
const getUserMealBookings = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      startDate,
      endDate
    } = req.query;

    // Build date filter
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.date = {};
      if (startDate) dateFilter.date.$gte = moment(startDate).startOf('day').toDate();
      if (endDate) dateFilter.date.$lte = moment(endDate).endOf('day').toDate();
    }

    // Get meals where user has bookings
    const meals = await Meal.find({
      ...dateFilter,
      'bookings.user': req.user.id,
      status: { $ne: 'deleted' }
    })
    .populate('bookings.user', 'firstName lastName')
    .sort({ date: -1 });

    // Filter and format bookings
    const userBookings = meals.map(meal => {
      const userBooking = meal.bookings.find(
        booking => booking.user._id.toString() === req.user.id
      );
      
      return {
        _id: meal._id,
        mealName: meal.name,
        mealType: meal.mealType,
        date: meal.date,
        price: meal.price,
        booking: userBooking
      };
    }).filter(item => status ? item.booking.status === status : true);

    // Apply pagination
    const skip = (page - 1) * limit;
    const paginatedBookings = userBookings.slice(skip, skip + parseInt(limit));

    res.json({
      success: true,
      data: paginatedBookings,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(userBookings.length / limit),
        total: userBookings.length,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get user meal bookings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve meal bookings'
    });
  }
};

// @desc    Get meal bookings
// @route   GET /api/meals/:id/bookings
// @access  Private (administrator and super_admin only)
const getMealBookings = async (req, res) => {
  try {
    const meal = await Meal.findById(req.params.id)
      .populate('bookings.user', 'firstName lastName employeeId email phone');

    if (!meal) {
      return res.status(404).json({
        success: false,
        error: 'Meal not found'
      });
    }

    const { status } = req.query;
    let bookings = meal.bookings;

    if (status) {
      bookings = bookings.filter(booking => booking.status === status);
    }

    res.json({
      success: true,
      data: {
        meal: {
          _id: meal._id,
          name: meal.name,
          date: meal.date,
          mealType: meal.mealType,
          maxBookings: meal.maxBookings
        },
        bookings,
        summary: {
          totalBookings: bookings.length,
          confirmedBookings: bookings.filter(b => b.status === 'confirmed').length,
          totalQuantity: bookings.reduce((sum, b) => sum + b.quantity, 0)
        }
      }
    });
  } catch (error) {
    console.error('Get meal bookings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve meal bookings'
    });
  }
};

// @desc    Rate a meal
// @route   POST /api/meals/:id/rate
// @access  Private
const rateMeal = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const meal = await Meal.findById(req.params.id);
    if (!meal) {
      return res.status(404).json({
        success: false,
        error: 'Meal not found'
      });
    }

    // Check if user has booked this meal
    const userBooking = meal.bookings.find(
      booking => booking.user.toString() === req.user.id
    );

    if (!userBooking) {
      return res.status(400).json({
        success: false,
        error: 'You can only rate meals you have booked'
      });
    }

    const { rating, review } = req.body;

    // Check if user has already rated this meal
    const existingRating = meal.ratings.find(
      r => r.user.toString() === req.user.id
    );

    if (existingRating) {
      // Update existing rating
      existingRating.rating = rating;
      existingRating.review = review;
      existingRating.date = new Date();
    } else {
      // Add new rating
      meal.ratings.push({
        user: req.user.id,
        rating,
        review,
        date: new Date()
      });
    }

    // Calculate average rating
    const totalRatings = meal.ratings.length;
    const sumRatings = meal.ratings.reduce((sum, r) => sum + r.rating, 0);
    meal.averageRating = totalRatings > 0 ? sumRatings / totalRatings : 0;

    await meal.save();

    res.json({
      success: true,
      message: 'Meal rated successfully',
      data: {
        rating,
        averageRating: meal.averageRating,
        totalRatings
      }
    });
  } catch (error) {
    console.error('Rate meal error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to rate meal'
    });
  }
};

// @desc    Get meal statistics
// @route   GET /api/meals/stats/overview
// @access  Private (administrator and super_admin only)
const getMealStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Build date filter
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.date = {};
      if (startDate) dateFilter.date.$gte = moment(startDate).startOf('day').toDate();
      if (endDate) dateFilter.date.$lte = moment(endDate).endOf('day').toDate();
    }

    const stats = await Meal.aggregate([
      { $match: { ...dateFilter, status: { $ne: 'deleted' } } },
      {
        $group: {
          _id: null,
          totalMeals: { $sum: 1 },
          totalBookings: { $sum: { $size: '$bookings' } },
          averageRating: { $avg: '$averageRating' },
          totalRevenue: {
            $sum: {
              $multiply: [
                '$price',
                { $sum: '$bookings.quantity' }
              ]
            }
          }
        }
      }
    ]);

    const mealTypeStats = await Meal.aggregate([
      { $match: { ...dateFilter, status: { $ne: 'deleted' } } },
      {
        $group: {
          _id: '$mealType',
          count: { $sum: 1 },
          bookings: { $sum: { $size: '$bookings' } }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        overview: stats[0] || {
          totalMeals: 0,
          totalBookings: 0,
          averageRating: 0,
          totalRevenue: 0
        },
        mealTypes: mealTypeStats
      }
    });
  } catch (error) {
    console.error('Get meal stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve meal statistics'
    });
  }
};

// @desc    Generate meal menu
// @route   POST /api/meals/menu/generate
// @access  Private (administrator and super_admin only)
const generateMealMenu = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { startDate, endDate, preferences } = req.body;

    // This is a simplified menu generation
    // In a real application, this might use AI or complex algorithms
    const menuTemplate = [
      { mealType: 'breakfast', options: ['Oatmeal', 'Eggs & Toast', 'Pancakes', 'Yogurt Bowl'] },
      { mealType: 'lunch', options: ['Grilled Chicken', 'Pasta', 'Salad Bowl', 'Soup & Sandwich'] },
      { mealType: 'dinner', options: ['Steak', 'Fish & Chips', 'Vegetarian Curry', 'Pizza'] }
    ];

    const generatedMenu = [];
    const current = moment(startDate);
    const end = moment(endDate);

    while (current.isSameOrBefore(end)) {
      for (const mealTemplate of menuTemplate) {
        const randomOption = mealTemplate.options[
          Math.floor(Math.random() * mealTemplate.options.length)
        ];

        generatedMenu.push({
          name: randomOption,
          mealType: mealTemplate.mealType,
          date: current.toDate(),
          description: `Delicious ${randomOption.toLowerCase()} prepared fresh`,
          price: Math.floor(Math.random() * 15) + 5, // Random price between 5-20
          maxBookings: 50
        });
      }
      current.add(1, 'day');
    }

    res.json({
      success: true,
      data: generatedMenu,
      message: 'Menu generated successfully'
    });
  } catch (error) {
    console.error('Generate meal menu error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate meal menu'
    });
  }
};

// @desc    Create a meal booking (save to MySQL)
// @route   POST /api/meal/book
// @access  Private
const createMealBooking = async (req, res) => {
  const { createMySQLConnection } = require('../config/mysql');
  let conn;
  
  try {
    const {
      divisionId,
      divisionName,
      sectionId,
      sectionName,
      mealDate,
      mealType,
      quantity,
      specialRequirements
    } = req.body;

    // Validation
    if (!divisionId || !sectionId || !mealDate || !mealType || !quantity) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: divisionId, sectionId, mealDate, mealType, quantity'
      });
    }

    // Get user info from request
    const userId = req.user.id;
    const employeeId = req.user.employeeId || null;
    const employeeName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim();

    conn = await createMySQLConnection();

    // Insert meal booking into MySQL (matching actual table structure)
    const insertQuery = `
      INSERT INTO meal_bookings 
      (division_id, meal_date, meal_type, quantity, special_requirements, booked_by, status)
      VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `;

    const [result] = await conn.execute(insertQuery, [
      divisionId,
      mealDate,
      mealType,
      parseInt(quantity),
      specialRequirements || null,
      userId
    ]);

    console.log('✅ Meal booking created in MySQL:', result.insertId);

    res.status(201).json({
      success: true,
      message: 'Meal booked successfully',
      data: {
        id: result.insertId,
        divisionId,
        divisionName,
        sectionId,
        sectionName,
        mealDate,
        mealType,
        quantity,
        specialRequirements,
        bookedBy: userId,
        status: 'pending'
      }
    });
  } catch (error) {
    console.error('Create meal booking error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create meal booking'
    });
  } finally {
    if (conn) await conn.end();
  }
};

// @desc    Get today's bookings count
// @route   GET /api/meals/bookings/today/count
// @access  Private
const getTodaysBookingsCount = async (req, res) => {
  const { createMySQLConnection } = require('../config/mysql');
  let conn;
  
  try {
    const today = new Date().toISOString().split('T')[0];
    
    conn = await createMySQLConnection();
    
    const query = `
      SELECT COUNT(*) as count 
      FROM meal_bookings 
      WHERE meal_date = ? AND status IN ('pending', 'confirmed')
    `;
    
    const [rows] = await conn.execute(query, [today]);
    const count = rows[0]?.count || 0;
    
    res.json({
      success: true,
      count: count
    });
  } catch (error) {
    console.error('Get today\'s bookings count error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get today\'s bookings count'
    });
  } finally {
    if (conn) await conn.end();
  }
};

// @desc    Get today's bookings with full details
// @route   GET /api/meals/bookings/today
// @access  Private
const getTodaysBookings = async (req, res) => {
  const { createMySQLConnection } = require('../config/mysql');
  const User = require('../models/User');
  let conn;
  
  try {
    const today = new Date().toISOString().split('T')[0];
    
    conn = await createMySQLConnection();
    
    // Query only MySQL meal_bookings table
    const query = `
      SELECT 
        id,
        division_id,
        meal_date,
        meal_type,
        quantity,
        special_requirements,
        booked_by,
        status,
        created_at,
        updated_at
      FROM meal_bookings
      WHERE meal_date = ?
      ORDER BY created_at DESC
    `;
    
    const [rows] = await conn.execute(query, [today]);
    
    // Get user info from MongoDB for each booking
    const bookingsWithUserInfo = await Promise.all(
      rows.map(async (row) => {
        let userInfo = {
          employeeId: 'N/A',
          employeeName: 'Unknown User',
          email: 'N/A',
          divisionName: 'N/A',
          sectionName: 'N/A'
        };
        
        try {
          // Fetch user from MongoDB
          const user = await User.findById(row.booked_by)
            .populate('division', 'name')
            .populate('section', 'name')
            .lean();
          
          if (user) {
            userInfo = {
              employeeId: user.employeeId || 'N/A',
              employeeName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown User',
              email: user.email || 'N/A',
              divisionName: user.division?.name || 'N/A',
              sectionName: user.section?.name || 'N/A'
            };
          }
        } catch (err) {
          console.error('Error fetching user info:', err);
        }
        
        return {
          id: row.id,
          divisionId: row.division_id,
          mealDate: row.meal_date,
          mealType: row.meal_type,
          quantity: row.quantity,
          specialRequirements: row.special_requirements || '-',
          bookedBy: row.booked_by,
          status: row.status,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          ...userInfo
        };
      })
    );
    
    res.json({
      success: true,
      count: bookingsWithUserInfo.length,
      data: bookingsWithUserInfo
    });
  } catch (error) {
    console.error('Get today\'s bookings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get today\'s bookings'
    });
  } finally {
    if (conn) await conn.end();
  }
};

// @desc    Set employee meal preference
// @route   POST /api/meals/preference
// @access  Private
const setMealPreference = async (req, res) => {
  const { createMySQLConnection } = require('../config/mysql');
  let conn;
  
  try {
    const {
      employeeId,
      employeeName,
      email,
      preference,
      divisionId,
      divisionName,
      sectionId,
      sectionName,
      subsectionId,
      subsectionName,
      allowanceAmount
    } = req.body;

    // Validation
    if (!employeeId || !preference) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: employeeId, preference'
      });
    }

    if (!['meal', 'money'].includes(preference)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid preference. Must be "meal" or "money"'
      });
    }

    const addedBy = req.user.id;

    conn = await createMySQLConnection();

    // Start transaction
    await conn.beginTransaction();

    try {
      // Remove employee from both tables first
      await conn.execute('DELETE FROM meal_package_employees WHERE employee_id = ?', [employeeId]);
      await conn.execute('DELETE FROM money_allowance_employees WHERE employee_id = ?', [employeeId]);

      const employeeData = JSON.stringify({
        employeeId,
        employeeName,
        email,
        divisionId,
        divisionName,
        sectionId,
        sectionName,
        subsectionId,
        subsectionName
      });

      if (preference === 'meal') {
        // Add to meal package table
        await conn.execute(
          `INSERT INTO meal_package_employees 
           (employee_id, employee_name, email, division_id, division_name, section_id, section_name, 
            subsection_id, subsection_name, added_by, employee_data)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [employeeId, employeeName, email, divisionId, divisionName, sectionId, sectionName, 
           subsectionId, subsectionName, addedBy, employeeData]
        );
        console.log(`✅ Employee ${employeeId} added to meal package`);
      } else {
        // Add to money allowance table
        const amount = allowanceAmount || 0.00;
        await conn.execute(
          `INSERT INTO money_allowance_employees 
           (employee_id, employee_name, email, division_id, division_name, section_id, section_name, 
            subsection_id, subsection_name, allowance_amount, added_by, employee_data)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [employeeId, employeeName, email, divisionId, divisionName, sectionId, sectionName, 
           subsectionId, subsectionName, amount, addedBy, employeeData]
        );
        console.log(`✅ Employee ${employeeId} added to money allowance`);
      }

      // Commit transaction
      await conn.commit();

    } catch (error) {
      await conn.rollback();
      throw error;
    }

    res.json({
      success: true,
      message: 'Meal preference saved successfully',
      data: {
        employeeId,
        employeeName,
        preference,
        divisionId,
        sectionId
      }
    });
  } catch (error) {
    console.error('Set meal preference error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to set meal preference'
    });
  } finally {
    if (conn) await conn.end();
  }
};

// Get subsection transferred employees (source for meal assignment)
const getSubsectionEmployees = async (req, res) => {
  const { createMySQLConnection } = require('../config/mysql');
  let conn;
  
  try {
    const { divisionId, sectionId, subsectionId } = req.query;
    
    conn = await createMySQLConnection();
    
    let query = 'SELECT * FROM subsection_transfers WHERE 1=1';
    const params = [];
    
    if (divisionId && divisionId !== 'all') {
      query += ' AND division_code = ?';
      params.push(divisionId);
    }
    if (sectionId && sectionId !== 'all') {
      query += ' AND section_code = ?';
      params.push(sectionId);
    }
    if (subsectionId && subsectionId !== 'all') {
      query += ' AND sub_section_id = ?';
      params.push(subsectionId);
    }
    
    query += ' ORDER BY employee_name ASC';
    
    const [rows] = await conn.execute(query, params);
    
    // Check which employees are already assigned to meal package or money allowance
    const employeeIds = rows.map(r => r.employee_id);
    
    let mealAssignments = [];
    let moneyAssignments = [];
    
    if (employeeIds.length > 0) {
      const placeholders = employeeIds.map(() => '?').join(',');
      
      const [mealRows] = await conn.execute(
        `SELECT employee_id FROM meal_package_employees WHERE employee_id IN (${placeholders})`,
        employeeIds
      );
      mealAssignments = mealRows.map(r => r.employee_id);
      
      const [moneyRows] = await conn.execute(
        `SELECT employee_id FROM money_allowance_employees WHERE employee_id IN (${placeholders})`,
        employeeIds
      );
      moneyAssignments = moneyRows.map(r => r.employee_id);
    }
    
    // Add assignment status to each employee
    const enrichedRows = rows.map(emp => ({
      ...emp,
      meal_assigned: mealAssignments.includes(emp.employee_id),
      money_assigned: moneyAssignments.includes(emp.employee_id),
      assignment_status: mealAssignments.includes(emp.employee_id) ? 'meal' : 
                        moneyAssignments.includes(emp.employee_id) ? 'money' : 'none'
    }));
    
    res.json({
      success: true,
      data: enrichedRows,
      count: enrichedRows.length
    });
  } catch (error) {
    console.error('Get subsection employees error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get subsection employees'
    });
  } finally {
    if (conn) await conn.end();
  }
};

// Get meal package employees with filters
const getMealPackageEmployees = async (req, res) => {
  const { createMySQLConnection } = require('../config/mysql');
  let conn;
  
  try {
    const { divisionId, sectionId, subsectionId } = req.query;
    
    conn = await createMySQLConnection();
    
    let query = 'SELECT * FROM meal_package_employees WHERE 1=1';
    const params = [];
    
    if (divisionId && divisionId !== 'all') {
      query += ' AND division_id = ?';
      params.push(divisionId);
    }
    if (sectionId && sectionId !== 'all') {
      query += ' AND section_id = ?';
      params.push(sectionId);
    }
    if (subsectionId && subsectionId !== 'all') {
      query += ' AND subsection_id = ?';
      params.push(subsectionId);
    }
    
    query += ' ORDER BY employee_name ASC';
    
    const [rows] = await conn.execute(query, params);
    
    res.json({
      success: true,
      data: rows,
      count: rows.length
    });
  } catch (error) {
    console.error('Get meal package employees error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get meal package employees'
    });
  } finally {
    if (conn) await conn.end();
  }
};

// Get money allowance employees with filters
const getMoneyAllowanceEmployees = async (req, res) => {
  const { createMySQLConnection } = require('../config/mysql');
  let conn;
  
  try {
    const { divisionId, sectionId, subsectionId } = req.query;
    
    conn = await createMySQLConnection();
    
    let query = 'SELECT * FROM money_allowance_employees WHERE 1=1';
    const params = [];
    
    if (divisionId && divisionId !== 'all') {
      query += ' AND division_id = ?';
      params.push(divisionId);
    }
    if (sectionId && sectionId !== 'all') {
      query += ' AND section_id = ?';
      params.push(sectionId);
    }
    if (subsectionId && subsectionId !== 'all') {
      query += ' AND subsection_id = ?';
      params.push(subsectionId);
    }
    
    query += ' ORDER BY employee_name ASC';
    
    const [rows] = await conn.execute(query, params);
    
    res.json({
      success: true,
      data: rows,
      count: rows.length
    });
  } catch (error) {
    console.error('Get money allowance employees error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get money allowance employees'
    });
  } finally {
    if (conn) await conn.end();
  }
};

module.exports = {
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
  setMealPreference,
  getSubsectionEmployees,
  getMealPackageEmployees,
  getMoneyAllowanceEmployees
};
