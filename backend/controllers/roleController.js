const Role = require('../models/Role');
const AuditLog = require('../models/AuditLog');

// @desc Get all roles
// @route GET /api/roles
// @access Private (admin, super_admin)
const getRoles = async (req, res) => {
  try {
    const roles = await Role.find().sort({ createdAt: 1 });
    res.status(200).json({ success: true, data: roles });
  } catch (error) {
    console.error('Get roles error:', error);
    res.status(500).json({ success: false, message: 'Server error getting roles' });
  }
};

// @desc Create a role
// @route POST /api/roles
// @access Private (admin, super_admin)
const createRole = async (req, res) => {
  try {
    const { value, label, description } = req.body;
    if (!value || !label) {
      return res.status(400).json({ success: false, message: 'Value and label are required' });
    }

    const existing = await Role.findOne({ value });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Role already exists' });
    }

  const role = await Role.create({ value, label, name: label, description });
  
    // Log audit trail for role creation
    if (req.user?._id) {
      try {
        await AuditLog.createLog({
          user: req.user._id,
          action: 'role_changed',
          entity: { type: 'User', id: role._id, name: role.label },
          category: 'data_modification',
          severity: 'high',
          description: `Role "${role.label}" created`,
          details: `Created new role "${role.label}" (${role.value})`,
          metadata: {
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            method: req.method,
            endpoint: req.originalUrl
          }
        });
      } catch (auditErr) {
        console.error('[AuditLog] Failed to log role creation:', auditErr);
      }
    }
  
    res.status(201).json({ success: true, data: role });
  } catch (error) {
    console.error('Create role error:', error);
    res.status(500).json({ success: false, message: 'Server error creating role' });
  }
};

// @desc Get a single role by id
// @route GET /api/roles/:id
// @access Private (admin, super_admin)
const getRole = async (req, res) => {
  try {
    const { id } = req.params;
    const role = await Role.findById(id);
    if (!role) return res.status(404).json({ success: false, message: 'Role not found' });
    res.status(200).json({ success: true, data: role });
  } catch (error) {
    console.error('Get role error:', error);
    res.status(500).json({ success: false, message: 'Server error getting role' });
  }
};

// @desc Update a role (including permissions)
// @route PUT /api/roles/:id
// @access Private (super_admin)
const updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = {};
    const { label, description, permissions } = req.body;

    if (label) updates.label = label;
    if (description) updates.description = description;
    if (permissions && typeof permissions === 'object') {
      updates.permissions = permissions;
    }

    updates.updatedAt = Date.now();

    const role = await Role.findByIdAndUpdate(id, updates, { new: true });
    if (!role) return res.status(404).json({ success: false, message: 'Role not found' });

    // Log audit trail for role/permission update
    if (req.user?._id) {
      try {
        const actionType = permissions ? 'permissions_updated' : 'role_changed';
        await AuditLog.createLog({
          user: req.user._id,
          action: actionType,
          entity: { type: 'User', id: role._id, name: role.label },
          category: 'data_modification',
          severity: 'high',
          description: permissions ? `Permissions updated for role "${role.label}"` : `Role "${role.label}" updated`,
          details: permissions ? `Updated permissions for role "${role.label}"` : `Updated role "${role.label}"`,
          metadata: {
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            method: req.method,
            endpoint: req.originalUrl
          }
        });
      } catch (auditErr) {
        console.error('[AuditLog] Failed to log role update:', auditErr);
      }
    }

    res.status(200).json({ success: true, data: role });
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ success: false, message: 'Server error updating role' });
  }
};

// @desc Delete a role
// @route DELETE /api/roles/:id
// @access Private (super_admin)
const deleteRole = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Attempting to delete role with ID:', id);
    
    const role = await Role.findById(id);
    
    if (!role) {
      console.log('Role not found for ID:', id);
      return res.status(404).json({ success: false, message: 'Role not found' });
    }

    console.log('Found role to delete:', role.value, role.label);

    await Role.findByIdAndDelete(id);
    console.log('Role deleted successfully:', role.value);
    
    // Log audit trail for role deletion
    if (req.user?._id) {
      try {
        await AuditLog.createLog({
          user: req.user._id,
          action: 'role_changed',
          entity: { type: 'User', id: role._id, name: role.label },
          category: 'data_modification',
          severity: 'high',
          description: `Role "${role.label}" deleted`,
          details: `Deleted role "${role.label}" (${role.value})`,
          metadata: {
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            method: req.method,
            endpoint: req.originalUrl
          }
        });
      } catch (auditErr) {
        console.error('[AuditLog] Failed to log role deletion:', auditErr);
      }
    }
    
    res.status(200).json({ success: true, message: 'Role deleted successfully' });
  } catch (error) {
    console.error('Delete role error:', error);
    res.status(500).json({ success: false, message: 'Server error deleting role' });
  }
};

module.exports = {
  getRoles,
  createRole,
  getRole,
  updateRole,
  deleteRole
};
