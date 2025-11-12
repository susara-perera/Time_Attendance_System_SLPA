const express = require('express');
const router = express.Router();

const { auth, auditTrail } = require('../middleware/auth');
const ctrl = require('../controllers/mysqlSubSectionController');

// List subsections (optionally by sectionId)
router.get('/', auth, auditTrail('mysql_subsections_viewed', 'SubSection'), ctrl.list);

// Create subsection
router.post('/', auth, auditTrail('mysql_subsection_created', 'SubSection'), ctrl.create);

// Update subsection
router.put('/:id', auth, auditTrail('mysql_subsection_updated', 'SubSection'), ctrl.update);

// Delete subsection
router.delete('/:id', auth, auditTrail('mysql_subsection_deleted', 'SubSection'), ctrl.remove);

module.exports = router;
