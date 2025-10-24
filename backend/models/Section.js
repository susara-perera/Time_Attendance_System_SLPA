const mongoose = require('mongoose');

const sectionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Section name is required'],
    trim: true,
    maxlength: [100, 'Section name cannot exceed 100 characters']
  },
  code: {
    type: String,
    required: [true, 'Section code is required'],
    trim: true,
    uppercase: true,
    maxlength: [10, 'Section code cannot exceed 10 characters']
  },
  division: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Division',
    required: [true, 'Division is required']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  supervisor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  location: {
    building: String,
    floor: String,
    room: String
  },
  capacity: {
    type: Number,
    min: [1, 'Capacity must be at least 1'],
    default: 10
  },
  budget: {
    allocated: {
      type: Number,
      default: 0,
      min: [0, 'Allocated budget cannot be negative']
    },
    spent: {
      type: Number,
      default: 0,
      min: [0, 'Spent budget cannot be negative']
    }
  },
  workingHours: {
    inheritFromDivision: {
      type: Boolean,
      default: true
    },
    startTime: {
      type: String,
      match: [/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)']
    },
    endTime: {
      type: String,
      match: [/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)']
    },
    lunchBreakStart: {
      type: String,
      match: [/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)']
    },
    lunchBreakEnd: {
      type: String,
      match: [/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)']
    }
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'deleted'],
    default: 'active'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  establishedDate: {
    type: Date,
    default: Date.now
  },
  employees: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  contact: {
    phone: {
      type: String,
      trim: true,
      maxlength: [15, 'Phone number cannot exceed 15 characters']
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    extension: {
      type: String,
      trim: true,
      maxlength: [10, 'Extension cannot exceed 10 characters']
    }
  },
  objectives: [{
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: [200, 'Objective title cannot exceed 200 characters']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Objective description cannot exceed 1000 characters']
    },
    targetDate: Date,
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'cancelled'],
      default: 'pending'
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    }
  }],
  performance: {
    monthlyTargets: {
      productivity: {
        type: Number,
        min: [0, 'Productivity target cannot be negative'],
        max: [100, 'Productivity target cannot exceed 100%']
      },
      quality: {
        type: Number,
        min: [0, 'Quality target cannot be negative'],
        max: [100, 'Quality target cannot exceed 100%']
      },
      attendance: {
        type: Number,
        min: [0, 'Attendance target cannot be negative'],
        max: [100, 'Attendance target cannot exceed 100%']
      }
    },
    currentMetrics: {
      productivity: {
        type: Number,
        default: 0,
        min: [0, 'Productivity cannot be negative']
      },
      quality: {
        type: Number,
        default: 0,
        min: [0, 'Quality cannot be negative']
      },
      attendance: {
        type: Number,
        default: 0,
        min: [0, 'Attendance cannot be negative']
      }
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound index to ensure unique section code within a division
sectionSchema.index({ division: 1, code: 1 }, { unique: true });
sectionSchema.index({ division: 1, name: 1 }, { unique: true });
sectionSchema.index({ isActive: 1 });
sectionSchema.index({ supervisor: 1 });

// Virtual for employee count
sectionSchema.virtual('employeeCount', {
  ref: 'User',
  localField: '_id',
  foreignField: 'section',
  count: true
});

// Virtual for full section code (division code + section code)
sectionSchema.virtual('fullCode').get(function() {
  return this.populated('division') ? 
    `${this.division.code}-${this.code}` : 
    this.code;
});

// Virtual for budget utilization percentage
sectionSchema.virtual('budgetUtilization').get(function() {
  if (!this.budget.allocated || this.budget.allocated === 0) return 0;
  return ((this.budget.spent / this.budget.allocated) * 100).toFixed(2);
});

// Pre-save middleware
sectionSchema.pre('save', function(next) {
  // Ensure code is uppercase
  if (this.code) {
    this.code = this.code.toUpperCase();
  }
  next();
});

// Pre-save middleware to validate budget
sectionSchema.pre('save', function(next) {
  if (this.budget.spent > this.budget.allocated && this.budget.allocated > 0) {
    return next(new Error('Spent budget cannot exceed allocated budget'));
  }
  next();
});

// Static method to get section statistics
sectionSchema.statics.getSectionStats = async function(sectionId) {
  const User = mongoose.model('User');
  const Attendance = mongoose.model('Attendance');
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const [employeeCount, todayAttendance] = await Promise.all([
    User.countDocuments({ section: sectionId, isActive: true }),
    Attendance.countDocuments({
      date: today,
      user: {
        $in: await User.find({ section: sectionId, isActive: true }).distinct('_id')
      }
    })
  ]);
  
  return {
    employeeCount,
    todayAttendance,
    attendancePercentage: employeeCount > 0 ? (todayAttendance / employeeCount * 100).toFixed(2) : 0
  };
};

// Instance method to get effective working hours
sectionSchema.methods.getEffectiveWorkingHours = async function() {
  if (!this.workingHours.inheritFromDivision) {
    return {
      startTime: this.workingHours.startTime,
      endTime: this.workingHours.endTime,
      lunchBreakStart: this.workingHours.lunchBreakStart,
      lunchBreakEnd: this.workingHours.lunchBreakEnd
    };
  }
  
  // Get from division
  await this.populate('division');
  if (this.division) {
    return {
      startTime: this.division.workingHours.startTime,
      endTime: this.division.workingHours.endTime,
      lunchBreakStart: this.division.workingHours.lunchBreakStart,
      lunchBreakEnd: this.division.workingHours.lunchBreakEnd
    };
  }
  
  // Default fallback
  return {
    startTime: '09:00',
    endTime: '17:00',
    lunchBreakStart: '12:00',
    lunchBreakEnd: '13:00'
  };
};

// Instance method to check if section is at capacity
sectionSchema.methods.isAtCapacity = async function() {
  const User = mongoose.model('User');
  const currentEmployees = await User.countDocuments({ 
    section: this._id, 
    isActive: true 
  });
  
  return currentEmployees >= this.capacity;
};

module.exports = mongoose.model('Section', sectionSchema);
