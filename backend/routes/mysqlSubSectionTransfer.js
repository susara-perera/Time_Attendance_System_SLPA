const express = require('express');
const router = express.Router();

const { auth, auditTrail } = require('../middleware/auth');
const ctrl = require('../controllers/mysqlSubSectionTransferController');

// Allow opt-in insecure testing mode which skips auth when ALLOW_INSECURE_TESTING=true
const ALLOW_INSECURE = String(process.env.ALLOW_INSECURE_TESTING || '').toLowerCase() === 'true';
const maybeAuth = ALLOW_INSECURE ? ((req, res, next) => next()) : auth;

// Order matters: more specific first
router.get('/transferred/all/list', maybeAuth, auditTrail('mysql_transfers_all_listed', 'TransferToSubsection'), ctrl.getAllTransferredEmployees);
router.get('/transferred/:subSectionId', maybeAuth, auditTrail('mysql_transfers_listed', 'TransferToSubsection'), ctrl.getTransferredEmployees);
router.post('/transfer', maybeAuth, auditTrail('mysql_employee_transferred', 'TransferToSubsection'), ctrl.transferEmployeeToSubSection);
// Bulk transfer: accept array of transfers
router.post('/transfer/bulk', maybeAuth, auditTrail('mysql_employee_transferred_bulk', 'TransferToSubsection'), ctrl.transferEmployeesToSubSectionBulk);
router.delete('/recall-transfer', maybeAuth, auditTrail('mysql_transfer_recalled', 'TransferToSubsection'), ctrl.recallTransfer);
// Allow POST fallback for environments that don't send bodies with DELETE
router.post('/recall-transfer', maybeAuth, auditTrail('mysql_transfer_recalled', 'TransferToSubsection'), ctrl.recallTransfer);
// Bulk recall (delete multiple transfers)
router.delete('/recall-transfer/bulk', maybeAuth, auditTrail('mysql_transfer_recalled_bulk', 'TransferToSubsection'), ctrl.recallTransfersBulk);
router.post('/recall-transfer/bulk', maybeAuth, auditTrail('mysql_transfer_recalled_bulk', 'TransferToSubsection'), ctrl.recallTransfersBulk);

module.exports = router;
