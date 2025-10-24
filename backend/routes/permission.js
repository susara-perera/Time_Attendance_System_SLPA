const express = require('express');
const router = express.Router();
const { getPermissionCatalog, updateRolePermissions } = require('../controllers/permissionController');
const { auth, authorize } = require('../middleware/auth');

// Public-ish: Get permission catalog
router.get('/catalog', auth, getPermissionCatalog);

// Update permissions for a role (super_admin only)
router.put('/roles/:roleId', auth, authorize('super_admin'), updateRolePermissions);

module.exports = router;
