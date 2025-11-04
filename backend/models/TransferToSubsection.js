const mongoose = require('mongoose');

const transferToSubsectionSchema = new mongoose.Schema({
	employeeId: { 
		type: String, 
		required: true,
		index: true 
	},
	employeeName: { 
		type: String, 
		required: true 
	},
	division_code: { 
		type: String, 
		default: '' 
	},
	division_name: { 
		type: String, 
		default: '' 
	},
	hie_code: { 
		type: String, 
		default: '' 
	},
	hie_name: { 
		type: String, 
		default: '' 
	},
	subSectionId: { 
		type: String, 
		required: true,
		index: true 
	},
	subSectionCode: { 
		type: String, 
		default: '' 
	},
	subSectionName: { 
		type: String, 
		required: true 
	},
	transferredAt: { 
		type: Date, 
		default: Date.now 
	},
	transferredBy: { 
		type: mongoose.Schema.Types.ObjectId, 
		ref: 'User' 
	},
	employeeData: { 
		type: mongoose.Schema.Types.Mixed, 
		default: {} 
	}
}, {
	timestamps: true,
	collection: 'transfertosubsections' // Explicit collection name
});

// Create compound index for faster queries
transferToSubsectionSchema.index({ employeeId: 1, subSectionId: 1 });

module.exports = mongoose.model('TransferToSubsection', transferToSubsectionSchema);
