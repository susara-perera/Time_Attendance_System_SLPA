const SubSection = require('../models/SubSection');
const TransferToSubsection = require('../models/TransferToSubsection');

// GET /api/subsections
// Create a new sub-section request/record
exports.createSubSection = async (req, res, next) => {
	try {
		const {
			parentDivision,
			parentSection,
			subSection,
			hrisSnapshot
		} = req.body || {};

		console.log('🔍 Received subSection data:', JSON.stringify({ parentDivision, parentSection, subSection }, null, 2));

		// Basic validation mirroring frontend
		if (!parentDivision?.id || !parentSection?.id) {
			return res.status(400).json({ success: false, message: 'Parent division and section are required.' });
		}
		if (!(subSection?.hie_name || subSection?.name) || !(subSection?.hie_code || subSection?.code)) {
			console.log('❌ Validation failed - subSection:', subSection);
			return res.status(400).json({ success: false, message: 'Sub-section name and code are required.' });
		}

		const payload = {
			parentDivision: {
				id: String(parentDivision.id),
				division_code: parentDivision.division_code || parentDivision.code || '',
				division_name: parentDivision.division_name || parentDivision.name || ''
			},
			parentSection: {
				id: String(parentSection.id),
				hie_code: parentSection.hie_code || parentSection.code || '',
				hie_name: parentSection.hie_name || parentSection.name || ''
			},
			subSection: {
				hie_name: String(subSection.hie_name || subSection.name).trim(),
				hie_code: String(subSection.hie_code || subSection.code).trim()
			},
			hrisSnapshot: hrisSnapshot || {},
			createdBy: req.user?._id,
			updatedBy: req.user?._id
		};

		const created = await SubSection.create(payload);

		return res.status(201).json({
			success: true,
			message: 'Sub-section created successfully',
			data: created
		});
	} catch (err) {
		// Pass to global error handler for duplicate keys/validation, etc.
		next(err);
	}
};

// GET /api/subsections (optional simple list for verification)
exports.listSubSections = async (req, res, next) => {
	try {
		const { sectionId } = req.query;
		const query = sectionId ? { 'parentSection.id': sectionId } : {};
		const items = await SubSection.find(query).sort({ createdAt: -1 }).limit(200);
		res.json({ success: true, data: items });
	} catch (err) {
		next(err);
	}
};

// PUT /api/subsections/:id
// Update sub-section name/code
exports.updateSubSection = async (req, res, next) => {
	try {
		const { id } = req.params;
		const { name, code, hie_name, hie_code } = req.body || {};

		if (!name && !code && !hie_name && !hie_code) {
			return res.status(400).json({ success: false, message: 'Nothing to update' });
		}

		const update = {};
		if (hie_name || name) update['subSection.hie_name'] = String(hie_name || name).trim();
		if (hie_code || code) update['subSection.hie_code'] = String(hie_code || code).trim();
		update.updatedBy = req.user?._id;

		const updated = await SubSection.findByIdAndUpdate(
			id,
			{ $set: update },
			{ new: true, runValidators: true }
		);

		if (!updated) {
			return res.status(404).json({ success: false, message: 'Sub-section not found' });
		}

		return res.json({ success: true, message: 'Sub-section updated successfully', data: updated });
	} catch (err) {
		next(err);
	}
};

// DELETE /api/subsections/:id
exports.deleteSubSection = async (req, res, next) => {
	try {
		const { id } = req.params;
		const removed = await SubSection.findByIdAndDelete(id);
		if (!removed) {
			return res.status(404).json({ success: false, message: 'Sub-section not found' });
		}
		return res.json({ success: true, message: 'Sub-section deleted successfully' });
	} catch (err) {
		next(err);
	}
};

// POST /api/subsections/transfer
// Transfer employee to subsection
exports.transferEmployeeToSubSection = async (req, res, next) => {
	try {
		const {
			employeeId,
			employeeName,
			division_code,
			division_name,
			hie_code,
			hie_name,
			subSectionId,
			subSectionCode,
			subSectionName,
			transferredAt,
			employeeData
		} = req.body || {};

		console.log('📥 Transfer request received:', { 
			employeeId, 
			employeeName, 
			subSectionId,
			subSectionName 
		});

		// Basic validation
		if (!employeeId || !employeeName) {
			console.log('❌ Validation failed: Missing employee ID or name');
			return res.status(400).json({ success: false, message: 'Employee ID and name are required' });
		}
		if (!subSectionId || !subSectionName) {
			console.log('❌ Validation failed: Missing subsection information');
			return res.status(400).json({ success: false, message: 'Sub-section information is required' });
		}

		console.log('✅ Validation passed, creating transfer record...');

		// Create the transfer record
		const transferRecord = await TransferToSubsection.create({
			employeeId,
			employeeName,
			division_code,
			division_name,
			hie_code,
			hie_name,
			subSectionId,
			subSectionCode,
			subSectionName,
			transferredAt: transferredAt || new Date(),
			transferredBy: req.user?._id,
			employeeData: employeeData || {}
		});

		console.log('✅ Transfer record created successfully!');
		console.log('📝 Record ID:', transferRecord._id);
		console.log('👤 Employee ID:', transferRecord.employeeId);
		console.log('📍 SubSection ID:', transferRecord.subSectionId);
		console.log('💾 Full record:', JSON.stringify(transferRecord, null, 2));

		return res.status(201).json({
			success: true,
			message: 'Employee transferred successfully',
			data: transferRecord
		});
	} catch (err) {
		console.error('❌ Transfer error:', err);
		next(err);
	}
};

// GET /api/subsections/transferred/:subSectionId
// Get all transferred employees for a specific subsection
exports.getTransferredEmployees = async (req, res, next) => {
	try {
		const { subSectionId } = req.params;
		
		console.log('📥 Fetching transferred employees for subsection:', subSectionId);
		console.log('🔍 SubSection ID type:', typeof subSectionId);

		const transfers = await TransferToSubsection.find({ subSectionId }).sort({ transferredAt: -1 });

		console.log('✅ Found transferred employees:', transfers.length);
		
		if (transfers.length > 0) {
			console.log('📋 Transfer records found:');
			transfers.forEach((t, index) => {
				console.log(`  ${index + 1}. Employee: ${t.employeeName} (${t.employeeId}) -> SubSection: ${t.subSectionName}`);
			});
		} else {
			console.log('⚠️ No transfer records found for this subsection');
		}

		return res.json({
			success: true,
			data: transfers
		});
	} catch (err) {
		console.error('❌ Error fetching transferred employees:', err);
		next(err);
	}
};

// DELETE /api/subsections/recall-transfer
// Recall (delete) a transfer record
exports.recallTransfer = async (req, res, next) => {
	try {
		const { employeeId, subSectionId } = req.body || {};

		console.log('🔄 Recall transfer request:', { employeeId, subSectionId });

		if (!employeeId || !subSectionId) {
			console.log('❌ Validation failed: Missing employee ID or subsection ID');
			return res.status(400).json({ 
				success: false, 
				message: 'Employee ID and Sub-section ID are required' 
			});
		}

		console.log('🔍 Looking for transfer record to delete...');

		// Delete the transfer record
		const deleted = await TransferToSubsection.findOneAndDelete({
			employeeId,
			subSectionId
		});

		if (!deleted) {
			console.log('❌ Transfer record not found for:', { employeeId, subSectionId });
			console.log('🔍 Checking all records in collection...');
			const allRecords = await TransferToSubsection.find({});
			console.log(`📊 Total records in collection: ${allRecords.length}`);
			if (allRecords.length > 0) {
				console.log('📋 Existing records:');
				allRecords.forEach((r, i) => {
					console.log(`  ${i + 1}. EmpID: ${r.employeeId}, SubSecID: ${r.subSectionId}`);
				});
			}
			return res.status(404).json({
				success: false,
				message: 'Transfer record not found'
			});
		}

		console.log('✅ Transfer recalled successfully!');
		console.log('🗑️ Deleted record ID:', deleted._id);
		console.log('👤 Employee:', deleted.employeeName, '(', deleted.employeeId, ')');

		return res.json({
			success: true,
			message: 'Transfer recalled successfully',
			data: deleted
		});
	} catch (err) {
		console.error('❌ Error recalling transfer:', err);
		next(err);
	}
};

