const express = require('express');
const router = express.Router();

const { auth, auditTrail } = require('../middleware/auth');
const { createSubSection, listSubSections, updateSubSection, deleteSubSection } = require('../controllers/subSectionController');

// Optional: list for verification/testing
router.get('/', auth, auditTrail('subsections_viewed', 'SubSection'), listSubSections);

// Create sub-section
router.post('/', auth, auditTrail('subsection_created', 'SubSection'), createSubSection);

// Update sub-section
router.put('/:id', auth, auditTrail('subsection_updated', 'SubSection'), updateSubSection);

// Delete sub-section
router.delete('/:id', auth, auditTrail('subsection_deleted', 'SubSection'), deleteSubSection);

module.exports = router;

