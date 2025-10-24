const mongoose = require('mongoose');

const subSectionSchema = new mongoose.Schema({
  parentDivision: {
    id: {
      type: String,
      required: [true, 'Parent division ID is required'],
      trim: true
    },
    code: {
      type: String,
      trim: true,
      default: ''
    },
    name: {
      type: String,
      trim: true,
      default: ''
    }
  },
  parentSection: {
    id: {
      type: String,
      required: [true, 'Parent section ID is required'],
      trim: true
    },
    code: {
      type: String,
      trim: true,
      default: ''
    },
    name: {
      type: String,
      trim: true,
      default: ''
    }
  },
  subSection: {
    name: {
      type: String,
      required: [true, 'Sub-section name is required'],
      trim: true,
      maxlength: [100, 'Sub-section name cannot exceed 100 characters']
    },
    code: {
      type: String,
      required: [true, 'Sub-section code is required'],
      trim: true,
      uppercase: true,
      maxlength: [20, 'Sub-section code cannot exceed 20 characters']
    }
  },
  hrisSnapshot: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// Index for efficient queries by parent section
subSectionSchema.index({ 'parentSection.id': 1 });

// Index for unique constraint on sub-section code within parent section
subSectionSchema.index({ 
  'parentSection.id': 1, 
  'subSection.code': 1 
}, { unique: true });

// Virtual for full sub-section identifier
subSectionSchema.virtual('fullCode').get(function() {
  return `${this.parentSection.code}-${this.subSection.code}`;
});

// Pre-save middleware to ensure code is uppercase
subSectionSchema.pre('save', function(next) {
  if (this.subSection && this.subSection.code) {
    this.subSection.code = this.subSection.code.toUpperCase();
  }
  next();
});

// Pre-update middleware to ensure code is uppercase
subSectionSchema.pre(['findOneAndUpdate', 'updateOne', 'updateMany'], function(next) {
  if (this.getUpdate().$set && this.getUpdate().$set['subSection.code']) {
    this.getUpdate().$set['subSection.code'] = this.getUpdate().$set['subSection.code'].toUpperCase();
  }
  next();
});

const SubSection = mongoose.model('SubSection', subSectionSchema);

module.exports = SubSection;
