const mongoose = require('mongoose');

const mealSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required']
  },
  date: {
    type: Date,
    required: [true, 'Date is required'],
    default: Date.now
  },
  mealType: {
    type: String,
    enum: ['breakfast', 'lunch', 'dinner', 'snack'],
    required: [true, 'Meal type is required']
  },
  mealTime: {
    type: Date,
    required: [true, 'Meal time is required']
  },
  location: {
    type: String,
    enum: ['cafeteria', 'office', 'outside', 'home'],
    default: 'cafeteria'
  },
  items: [{
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: [100, 'Item name cannot exceed 100 characters']
    },
    category: {
      type: String,
      enum: ['main_course', 'side_dish', 'beverage', 'dessert', 'salad', 'soup'],
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1']
    },
    unit: {
      type: String,
      enum: ['plate', 'bowl', 'cup', 'glass', 'piece', 'serving'],
      default: 'serving'
    },
    price: {
      type: Number,
      required: true,
      min: [0, 'Price cannot be negative']
    },
    calories: {
      type: Number,
      min: [0, 'Calories cannot be negative']
    },
    nutritionalInfo: {
      protein: { type: Number, min: 0 }, // in grams
      carbs: { type: Number, min: 0 },   // in grams
      fat: { type: Number, min: 0 },     // in grams
      fiber: { type: Number, min: 0 },   // in grams
      sugar: { type: Number, min: 0 }    // in grams
    }
  }],
  totalAmount: {
    type: Number,
    required: true,
    min: [0, 'Total amount cannot be negative']
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'employee_credit', 'company_sponsored', 'free'],
    default: 'cash'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'cancelled', 'refunded'],
    default: 'pending'
  },
  transactionId: {
    type: String,
    trim: true
  },
  isSubsidized: {
    type: Boolean,
    default: false
  },
  subsidyAmount: {
    type: Number,
    default: 0,
    min: [0, 'Subsidy amount cannot be negative']
  },
  actualAmount: {
    type: Number,
    min: [0, 'Actual amount cannot be negative']
  },
  orderedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User' // In case someone else orders for the user
  },
  specialRequests: {
    type: String,
    trim: true,
    maxlength: [500, 'Special requests cannot exceed 500 characters']
  },
  allergyInfo: [{
    allergen: {
      type: String,
      enum: ['nuts', 'dairy', 'gluten', 'eggs', 'soy', 'shellfish', 'fish', 'sesame'],
      required: true
    },
    severity: {
      type: String,
      enum: ['mild', 'moderate', 'severe'],
      default: 'mild'
    }
  }],
  rating: {
    taste: {
      type: Number,
      min: [1, 'Rating must be between 1 and 5'],
      max: [5, 'Rating must be between 1 and 5']
    },
    quality: {
      type: Number,
      min: [1, 'Rating must be between 1 and 5'],
      max: [5, 'Rating must be between 1 and 5']
    },
    service: {
      type: Number,
      min: [1, 'Rating must be between 1 and 5'],
      max: [5, 'Rating must be between 1 and 5']
    },
    overall: {
      type: Number,
      min: [1, 'Rating must be between 1 and 5'],
      max: [5, 'Rating must be between 1 and 5']
    },
    comment: {
      type: String,
      trim: true,
      maxlength: [1000, 'Comment cannot exceed 1000 characters']
    }
  },
  status: {
    type: String,
    enum: ['ordered', 'preparing', 'ready', 'served', 'cancelled'],
    default: 'ordered'
  },
  servedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  servedAt: {
    type: Date
  },
  estimatedDeliveryTime: {
    type: Date
  },
  actualDeliveryTime: {
    type: Date
  },
  remarks: {
    type: String,
    trim: true,
    maxlength: [500, 'Remarks cannot exceed 500 characters']
  },
  // Division and Section information for reporting
  divisionId: {
    type: String,
    trim: true
  },
  divisionName: {
    type: String,
    trim: true
  },
  sectionId: {
    type: String,
    trim: true
  },
  sectionName: {
    type: String,
    trim: true
  },
  specialRequirements: {
    type: String,
    trim: true,
    maxlength: [1000, 'Special requirements cannot exceed 1000 characters']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for total calories
mealSchema.virtual('totalCalories').get(function() {
  if (!this.items || this.items.length === 0) return 0;
  
  return this.items.reduce((total, item) => {
    return total + (item.calories * item.quantity || 0);
  }, 0);
});

// Virtual for total nutritional info
mealSchema.virtual('totalNutrition').get(function() {
  if (!this.items || this.items.length === 0) {
    return { protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 };
  }
  
  return this.items.reduce((totals, item) => {
    const nutrition = item.nutritionalInfo || {};
    return {
      protein: totals.protein + (nutrition.protein * item.quantity || 0),
      carbs: totals.carbs + (nutrition.carbs * item.quantity || 0),
      fat: totals.fat + (nutrition.fat * item.quantity || 0),
      fiber: totals.fiber + (nutrition.fiber * item.quantity || 0),
      sugar: totals.sugar + (nutrition.sugar * item.quantity || 0)
    };
  }, { protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 });
});

// Virtual for average rating
mealSchema.virtual('averageRating').get(function() {
  if (!this.rating) return 0;
  
  const ratings = [
    this.rating.taste,
    this.rating.quality,
    this.rating.service,
    this.rating.overall
  ].filter(rating => rating && rating > 0);
  
  if (ratings.length === 0) return 0;
  
  return (ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length).toFixed(1);
});

// Index for better performance
mealSchema.index({ user: 1, date: 1 });
mealSchema.index({ date: 1, mealType: 1 });
mealSchema.index({ paymentStatus: 1 });
mealSchema.index({ status: 1 });
mealSchema.index({ location: 1 });

// Pre-save middleware
mealSchema.pre('save', function(next) {
  // Set date to start of day for consistency
  if (this.date) {
    this.date.setHours(0, 0, 0, 0);
  }
  
  // Calculate actual amount if subsidized
  if (this.isSubsidized && this.subsidyAmount > 0) {
    this.actualAmount = Math.max(0, this.totalAmount - this.subsidyAmount);
  } else {
    this.actualAmount = this.totalAmount;
  }
  
  // Set served time when status changes to served
  if (this.status === 'served' && !this.servedAt) {
    this.servedAt = new Date();
  }
  
  // Set actual delivery time when status changes to served
  if (this.status === 'served' && !this.actualDeliveryTime) {
    this.actualDeliveryTime = new Date();
  }
  
  next();
});

// Static method to get meal statistics
mealSchema.statics.getMealStats = async function(filters = {}) {
  const matchStage = { ...filters };
  
  if (filters.startDate && filters.endDate) {
    matchStage.date = {
      $gte: new Date(filters.startDate),
      $lte: new Date(filters.endDate)
    };
    delete matchStage.startDate;
    delete matchStage.endDate;
  }
  
  return await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalMeals: { $sum: 1 },
        totalRevenue: { $sum: '$actualAmount' },
        averageAmount: { $avg: '$actualAmount' },
        mealsByType: {
          $push: {
            type: '$mealType',
            amount: '$actualAmount'
          }
        },
        mealsByLocation: {
          $push: {
            location: '$location',
            amount: '$actualAmount'
          }
        }
      }
    },
    {
      $project: {
        totalMeals: 1,
        totalRevenue: { $round: ['$totalRevenue', 2] },
        averageAmount: { $round: ['$averageAmount', 2] },
        mealTypeBreakdown: {
          $reduce: {
            input: '$mealsByType',
            initialValue: {},
            in: {
              $mergeObjects: [
                '$$value',
                {
                  $arrayToObject: [
                    [{ k: '$$this.type', v: { $add: [{ $ifNull: [{ $getField: { field: '$$this.type', input: '$$value' } }, 0] }, 1] } }]
                  ]
                }
              ]
            }
          }
        },
        locationBreakdown: {
          $reduce: {
            input: '$mealsByLocation',
            initialValue: {},
            in: {
              $mergeObjects: [
                '$$value',
                {
                  $arrayToObject: [
                    [{ k: '$$this.location', v: { $add: [{ $ifNull: [{ $getField: { field: '$$this.location', input: '$$value' } }, 0] }, 1] } }]
                  ]
                }
              ]
            }
          }
        }
      }
    }
  ]);
};

// Instance method to calculate delivery delay
mealSchema.methods.getDeliveryDelay = function() {
  if (!this.estimatedDeliveryTime || !this.actualDeliveryTime) return null;
  
  const delayMinutes = (this.actualDeliveryTime - this.estimatedDeliveryTime) / (1000 * 60);
  return Math.round(delayMinutes);
};

module.exports = mongoose.model('Meal', mealSchema);
