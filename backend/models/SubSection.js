const mongoose = require('mongoose');

const subSectionSchema = new mongoose.Schema({
  parentDivision: {
    id: {
      type: String,
      required: [true, 'Parent division ID is required'],
      trim: true
    },
    division_code: {
      type: String,
      trim: true,
      default: ''
    },
    division_name: {
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
    hie_code: {
      type: String,
      trim: true,
      default: ''
    },
    hie_name: {
      type: String,
      trim: true,
      default: ''
    }
  },
  subSection: {
    sub_hie_name: {
      type: String,
      required: [true, 'Sub-section name is required'],
      trim: true,
      maxlength: [100, 'Sub-section name cannot exceed 100 characters']
    },
    sub_hie_code: {
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
// Use partialFilterExpression to ignore legacy documents that may not have sub_hie_code
subSectionSchema.index({ 
  'parentSection.id': 1, 
  'subSection.sub_hie_code': 1 
}, { 
  unique: true,
  name: 'parentSection.id_1_subSection.sub_hie_code_1',
  partialFilterExpression: { 'subSection.sub_hie_code': { $type: 'string' } }
});

// Virtual for full sub-section identifier
subSectionSchema.virtual('fullCode').get(function() {
  return `${this.parentSection.hie_code}-${this.subSection.sub_hie_code}`;
});

// Pre-save middleware to ensure code is uppercase
subSectionSchema.pre('save', function(next) {
  if (this.subSection && this.subSection.sub_hie_code) {
    this.subSection.sub_hie_code = this.subSection.sub_hie_code.toUpperCase();
  }
  next();
});

// Pre-update middleware to ensure code is uppercase
subSectionSchema.pre(['findOneAndUpdate', 'updateOne', 'updateMany'], function(next) {
  if (this.getUpdate().$set && this.getUpdate().$set['subSection.sub_hie_code']) {
    this.getUpdate().$set['subSection.sub_hie_code'] = this.getUpdate().$set['subSection.sub_hie_code'].toUpperCase();
  }
  next();
});

const SubSection = mongoose.model('SubSection', subSectionSchema);

module.exports = SubSection;
