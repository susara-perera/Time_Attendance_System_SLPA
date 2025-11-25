const Meal = require('../models/Meal');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
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
  getTodaysBookings
};
