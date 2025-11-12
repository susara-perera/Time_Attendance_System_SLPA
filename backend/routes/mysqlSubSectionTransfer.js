const express = require('express');
const router = express.Router();

const { auth, auditTrail } = require('../middleware/auth');
const ctrl = require('../controllers/mysqlSubSectionTransferController');

// Order matters: more specific first
router.get('/transferred/all/list', auth, auditTrail('mysql_transfers_all_listed', 'TransferToSubsection'), ctrl.getAllTransferredEmployees);
router.get('/transferred/:subSectionId', auth, auditTrail('mysql_transfers_listed', 'TransferToSubsection'), ctrl.getTransferredEmployees);
router.post('/transfer', auth, auditTrail('mysql_employee_transferred', 'TransferToSubsection'), ctrl.transferEmployeeToSubSection);
router.delete('/recall-transfer', auth, auditTrail('mysql_transfer_recalled', 'TransferToSubsection'), ctrl.recallTransfer);
// Allow POST fallback for environments that don't send bodies with DELETE
router.post('/recall-transfer', auth, auditTrail('mysql_transfer_recalled', 'TransferToSubsection'), ctrl.recallTransfer);

module.exports = router;
