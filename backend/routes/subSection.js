const express = require('express');
const router = express.Router();

const { auth, auditTrail } = require('../middleware/auth');
const { createSubSection, listSubSections, updateSubSection, deleteSubSection, transferEmployeeToSubSection, getTransferredEmployees, getAllTransferredEmployees, recallTransfer } = require('../controllers/subSectionController');

// Optional: list for verification/testing
router.get('/', auth, auditTrail('subsections_viewed', 'SubSection'), listSubSections);

// Transfer employee to sub-section (must come before /:id routes)
router.post('/transfer', auth, auditTrail('employee_transferred_to_subsection', 'TransferToSubsection'), transferEmployeeToSubSection);

// Get all transferred employees across all subsections (must come before /:id routes)
router.get('/transferred/all/list', auth, getAllTransferredEmployees);

// Get transferred employees for a subsection (must come before /:id routes)
router.get('/transferred/:subSectionId', auth, getTransferredEmployees);

// Recall (delete) a transfer (must come before /:id routes)
router.delete('/recall-transfer', auth, auditTrail('employee_transfer_recalled', 'TransferToSubsection'), recallTransfer);

// Create sub-section
router.post('/', auth, auditTrail('subsection_created', 'SubSection'), createSubSection);

// Update sub-section
router.put('/:id', auth, auditTrail('subsection_updated', 'SubSection'), updateSubSection);

// Delete sub-section
router.delete('/:id', auth, auditTrail('subsection_deleted', 'SubSection'), deleteSubSection);

module.exports = router;

