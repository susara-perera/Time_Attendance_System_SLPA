const SubSection = require('../models/SubSection');

// POST /api/subsections
// Create a new sub-section request/record
exports.createSubSection = async (req, res, next) => {
	try {
		const {
			parentDivision,
			parentSection,
			subSection,
			hrisSnapshot
		} = req.body || {};

		// Basic validation mirroring frontend
		if (!parentDivision?.id || !parentSection?.id) {
			return res.status(400).json({ success: false, message: 'Parent division and section are required.' });
		}
		if (!subSection?.name || !subSection?.code) {
			return res.status(400).json({ success: false, message: 'Sub-section name and code are required.' });
		}

		const payload = {
			parentDivision: {
				id: String(parentDivision.id),
				code: parentDivision.code || '',
				name: parentDivision.name || ''
			},
			parentSection: {
				id: String(parentSection.id),
				code: parentSection.code || '',
				name: parentSection.name || ''
			},
			subSection: {
				name: String(subSection.name).trim(),
				code: String(subSection.code).trim()
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
		const { name, code } = req.body || {};

		if (!name && !code) {
			return res.status(400).json({ success: false, message: 'Nothing to update' });
		}

		const update = {};
		if (name) update['subSection.name'] = String(name).trim();
		if (code) update['subSection.code'] = String(code).trim();
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

