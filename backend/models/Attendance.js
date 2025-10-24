const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
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
  checkIn: {
    time: {
      type: Date,
      required: [true, 'Check-in time is required']
    },
    location: {
      latitude: Number,
      longitude: Number,
      address: String
    },
    method: {
      type: String,
      enum: ['manual', 'biometric', 'web', 'mobile'],
      default: 'web'
    },
    remarks: String
  },
  checkOut: {
    time: Date,
    location: {
      latitude: Number,
      longitude: Number,
      address: String
    },
    method: {
      type: String,
      enum: ['manual', 'biometric', 'web', 'mobile'],
      default: 'web'
    },
    remarks: String
  },
  breaks: [{
    breakStart: {
      type: Date,
      required: true
    },
    breakEnd: Date,
    breakType: {
      type: String,
      enum: ['lunch', 'tea', 'personal', 'meeting', 'other'],
      default: 'personal'
    },
    remarks: String
  }],
  status: {
    type: String,
    enum: ['present', 'absent', 'late', 'half_day', 'leave', 'holiday', 'weekend'],
    default: 'present'
  },
  workingHours: {
    type: Number,
    default: 0 // in hours
  },
  overtime: {
    type: Number,
    default: 0 // in hours
  },
  lateMinutes: {
    type: Number,
    default: 0
  },
  earlyLeaveMinutes: {
    type: Number,
    default: 0
  },
  isHoliday: {
    type: Boolean,
    default: false
  },
  isWeekend: {
    type: Boolean,
    default: false
  },
  leaveType: {
    type: String,
    enum: ['annual', 'sick', 'casual', 'maternity', 'paternity', 'unpaid', ''],
    default: ''
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  remarks: {
    type: String,
    maxlength: [500, 'Remarks cannot exceed 500 characters']
  },
  editHistory: [{
    editedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    editedAt: {
      type: Date,
      default: Date.now
    },
    changes: {
      type: Object,
      required: true
    },
    reason: {
      type: String,
      required: true
    }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for total break time
attendanceSchema.virtual('totalBreakTime').get(function() {
  if (!this.breaks || this.breaks.length === 0) return 0;
  
  let totalBreakMinutes = 0;
  this.breaks.forEach(breakItem => {
    if (breakItem.breakEnd) {
      totalBreakMinutes += (breakItem.breakEnd - breakItem.breakStart) / (1000 * 60);
    }
  });
  
  return Math.round(totalBreakMinutes);
});

// Virtual for net working hours (excluding breaks)
attendanceSchema.virtual('netWorkingHours').get(function() {
  if (!this.checkIn.time || !this.checkOut.time) return 0;
  
  const totalMinutes = (this.checkOut.time - this.checkIn.time) / (1000 * 60);
  const netMinutes = totalMinutes - this.totalBreakTime;
  
  return Math.max(0, netMinutes / 60); // Convert to hours
});

// Index for better performance
attendanceSchema.index({ user: 1, date: 1 }, { unique: true });
attendanceSchema.index({ date: 1 });
attendanceSchema.index({ status: 1 });
attendanceSchema.index({ 'checkIn.time': 1 });

// Pre-save middleware to calculate working hours and overtime
attendanceSchema.pre('save', function(next) {
  // Calculate working hours if both check-in and check-out exist
  if (this.checkIn.time && this.checkOut.time) {
    const totalMinutes = (this.checkOut.time - this.checkIn.time) / (1000 * 60);
    const breakMinutes = this.totalBreakTime;
    const netWorkingMinutes = totalMinutes - breakMinutes;
    
    this.workingHours = Math.max(0, netWorkingMinutes / 60);
    
    // Calculate overtime (assuming 8 hours standard)
    const standardHours = 8;
    this.overtime = Math.max(0, this.workingHours - standardHours);
    
    // Calculate late minutes (assuming 9:00 AM standard start time)
    const standardStartTime = new Date(this.checkIn.time);
    standardStartTime.setHours(9, 0, 0, 0);
    
    if (this.checkIn.time > standardStartTime) {
      this.lateMinutes = (this.checkIn.time - standardStartTime) / (1000 * 60);
    }
    
    // Calculate early leave minutes (assuming 5:00 PM standard end time)
    const standardEndTime = new Date(this.checkOut.time);
    standardEndTime.setHours(17, 0, 0, 0);
    
    if (this.checkOut.time < standardEndTime) {
      this.earlyLeaveMinutes = (standardEndTime - this.checkOut.time) / (1000 * 60);
    }
  }
  
  // Set date to start of day for consistency
  if (this.date) {
    this.date.setHours(0, 0, 0, 0);
  }
  
  // Check if it's weekend
  const dayOfWeek = this.date.getDay();
  this.isWeekend = (dayOfWeek === 0 || dayOfWeek === 6); // Sunday or Saturday
  
  next();
});

// Static method to get attendance summary for a user
attendanceSchema.statics.getAttendanceSummary = async function(userId, startDate, endDate) {
  return await this.aggregate([
    {
      $match: {
        user: mongoose.Types.ObjectId(userId),
        date: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      }
    },
    {
      $group: {
        _id: null,
        totalDays: { $sum: 1 },
        presentDays: {
          $sum: {
            $cond: [{ $eq: ['$status', 'present'] }, 1, 0]
          }
        },
        absentDays: {
          $sum: {
            $cond: [{ $eq: ['$status', 'absent'] }, 1, 0]
          }
        },
        lateDays: {
          $sum: {
            $cond: [{ $gt: ['$lateMinutes', 0] }, 1, 0]
          }
        },
        totalWorkingHours: { $sum: '$workingHours' },
        totalOvertime: { $sum: '$overtime' },
        totalLateMinutes: { $sum: '$lateMinutes' }
      }
    }
  ]);
};

module.exports = mongoose.model('Attendance', attendanceSchema);
