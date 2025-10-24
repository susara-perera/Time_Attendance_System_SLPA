const mongoose = require('mongoose');

const divisionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Division name is required'],
    unique: true,
    trim: true,
    maxlength: [100, 'Division name cannot exceed 100 characters']
  },
  code: {
    type: String,
    required: [true, 'Division code is required'],
    unique: true,
    trim: true,
    uppercase: true,
    maxlength: [10, 'Division code cannot exceed 10 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  manager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  location: {
    building: String,
    floor: String,
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: { type: String, default: 'Sri Lanka' }
    }
  },
  workingHours: {
    startTime: {
      type: String,
      default: '09:00',
      match: [/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)']
    },
    endTime: {
      type: String,
      default: '17:00',
      match: [/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)']
    },
    lunchBreakStart: {
      type: String,
      default: '12:00',
      match: [/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)']
    },
    lunchBreakEnd: {
      type: String,
      default: '13:00',
      match: [/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)']
    },
    workingDays: {
      type: [String],
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      default: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    }
  },
  budget: {
    annual: {
      type: Number,
      min: [0, 'Budget cannot be negative']
    },
    allocated: {
      type: Number,
      default: 0,
      min: [0, 'Allocated budget cannot be negative']
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  establishedDate: {
    type: Date,
    default: Date.now
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
  settings: {
    allowOvertimeBooking: {
      type: Boolean,
      default: false
    },
    requireApprovalForOvertime: {
      type: Boolean,
      default: true
    },
    maxOvertimeHoursPerDay: {
      type: Number,
      default: 4,
      min: [0, 'Max overtime hours cannot be negative'],
      max: [12, 'Max overtime hours cannot exceed 12']
    },
    allowFlexibleTiming: {
      type: Boolean,
      default: false
    },
    flexibleTimingBuffer: {
      type: Number,
      default: 30, // minutes
      min: [0, 'Flexible timing buffer cannot be negative'],
      max: [120, 'Flexible timing buffer cannot exceed 120 minutes']
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for employee count
divisionSchema.virtual('employeeCount', {
  ref: 'User',
  localField: '_id',
  foreignField: 'division',
  count: true
});

// Virtual for section count
divisionSchema.virtual('sectionCount', {
  ref: 'Section',
  localField: '_id',
  foreignField: 'division',
  count: true
});

// Index for better performance
divisionSchema.index({ name: 1 });
divisionSchema.index({ code: 1 });
divisionSchema.index({ isActive: 1 });
divisionSchema.index({ manager: 1 });

// Pre-save middleware
divisionSchema.pre('save', function(next) {
  // Ensure code is uppercase
  if (this.code) {
    this.code = this.code.toUpperCase();
  }
  next();
});

// Static method to get division statistics
divisionSchema.statics.getDivisionStats = async function(divisionId) {
  const User = mongoose.model('User');
  const Section = mongoose.model('Section');
  const Attendance = mongoose.model('Attendance');
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const [employeeCount, sectionCount, todayAttendance] = await Promise.all([
    User.countDocuments({ division: divisionId, isActive: true }),
    Section.countDocuments({ division: divisionId, isActive: true }),
    Attendance.countDocuments({
      date: today,
      user: {
        $in: await User.find({ division: divisionId, isActive: true }).distinct('_id')
      }
    })
  ]);
  
  return {
    employeeCount,
    sectionCount,
    todayAttendance,
    attendancePercentage: employeeCount > 0 ? (todayAttendance / employeeCount * 100).toFixed(2) : 0
  };
};

// Instance method to check if division is within working hours
divisionSchema.methods.isWithinWorkingHours = function(time = new Date()) {
  const currentTime = time.toTimeString().substring(0, 5); // HH:MM format
  const startTime = this.workingHours.startTime;
  const endTime = this.workingHours.endTime;
  
  return currentTime >= startTime && currentTime <= endTime;
};

// Instance method to check if current day is working day
divisionSchema.methods.isWorkingDay = function(date = new Date()) {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = dayNames[date.getDay()];
  
  return this.workingHours.workingDays.includes(dayName);
};

module.exports = mongoose.model('Division', divisionSchema);
