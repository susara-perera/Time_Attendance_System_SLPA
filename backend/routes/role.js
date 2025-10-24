const express = require('express');
const router = express.Router();
const { getRoles, createRole, getRole, updateRole, deleteRole } = require('../controllers/roleController');
const { auth, authorize } = require('../middleware/auth');

// Note: auth middleware exports named functions; adjust if needed
// GET /api/roles
// GET /api/roles
router.get('/', auth, getRoles);

// GET /api/roles/:id - get single role
router.get('/:id', auth, getRole);

// POST /api/roles - only super_admin can create roles
router.post('/', auth, authorize('super_admin'), createRole);

// PUT /api/roles/:id - update role (permissions)
router.put('/:id', auth, authorize('super_admin'), updateRole);

// DELETE /api/roles/:id - delete role (only super_admin)
router.delete('/:id', auth, authorize('super_admin'), deleteRole);

module.exports = router;
