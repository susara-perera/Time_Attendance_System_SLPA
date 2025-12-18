const Role = require('../models/Role');
const AuditLog = require('../models/AuditLog');

// Return the permission catalog (categories and permission ids/names)
const getPermissionCatalog = async (req, res) => {
  try {
    // Updated catalog: includes all system modules, including employee management
    const catalog = [
      {
        category: 'users',
        name: 'User Management',
        permissions: [
          { id: 'create', name: 'Create Users' },
          { id: 'read', name: 'View Users' },
          { id: 'update', name: 'Update Users' },
          { id: 'delete', name: 'Delete Users' }
        ]
      },
      {
        category: 'attendance',
        name: 'Attendance Management',
        permissions: [
          { id: 'create', name: 'Create Attendance' },
          { id: 'read', name: 'View Attendance' },
          { id: 'update', name: 'Update Attendance' },
          { id: 'delete', name: 'Delete Attendance' }
        ]
      },
      {
        category: 'reports',
        name: 'Reports Management',
        permissions: [
          { id: 'create', name: 'Generate Reports' },
          { id: 'read', name: 'View Reports' },
          { id: 'update', name: 'Update Reports' },
          { id: 'delete', name: 'Delete Reports' }
        ]
      },
      {
        category: 'divisions',
        name: 'Division Management',
        permissions: [
          { id: 'create', name: 'Create Divisions' },
          { id: 'read', name: 'View Divisions' },
          { id: 'update', name: 'Update Divisions' },
          { id: 'delete', name: 'Delete Divisions' }
        ]
      },
      {
        category: 'sections',
        name: 'Section Management',
        permissions: [
          { id: 'create', name: 'Create Sections' },
          { id: 'read', name: 'View Sections' },
          { id: 'update', name: 'Update Sections' },
          { id: 'delete', name: 'Delete Sections' }
        ]
      },
      {
        category: 'roles',
        name: 'Role & Permission Management',
        permissions: [
          { id: 'create', name: 'Create Roles' },
          { id: 'read', name: 'View Roles & Permissions' },
          { id: 'update', name: 'Update Role Permissions' },
          { id: 'delete', name: 'Delete Roles' },
          { id: 'manage', name: 'Full Role Management Access' }
        ]
      },
      {
        category: 'settings',
        name: 'System Settings',
        permissions: [
          { id: 'create', name: 'Create Settings' },
          { id: 'read', name: 'View Settings' },
          { id: 'update', name: 'Update Settings' },
          { id: 'delete', name: 'Delete Settings' }
        ]
      },
      {
        category: 'employees',
        name: 'Employee Management',
        permissions: [
          { id: 'create', name: 'Create Employees' },
          { id: 'read', name: 'View Employees' },
          { id: 'update', name: 'Update Employees' },
          { id: 'delete', name: 'Delete Employees' }
        ]
      }
    ];

    res.status(200).json({ success: true, data: catalog });
  } catch (err) {
    console.error('Error fetching permission catalog:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Update a role's permissions (alias for /api/roles/:id but useful as a dedicated endpoint)
const updateRolePermissions = async (req, res) => {
  try {
    const { roleId } = req.params;
    const { permissions } = req.body;

    if (!roleId) return res.status(400).json({ success: false, message: 'roleId required' });
    if (!permissions || typeof permissions !== 'object') return res.status(400).json({ success: false, message: 'permissions object required' });

    const role = await Role.findByIdAndUpdate(roleId, { permissions, updatedAt: Date.now() }, { new: true });
    if (!role) return res.status(404).json({ success: false, message: 'Role not found' });

    // Log audit trail for permission update
    if (req.user?._id) {
      try {
        await AuditLog.createLog({
          user: req.user._id,
          action: 'permissions_updated',
          entity: { type: 'User', id: role._id, name: role.label },
          category: 'data_modification',
          severity: 'high',
          description: `Permissions updated for role "${role.label}"`,
          details: `Updated permissions for role "${role.label}" (${role.value})`,
          metadata: {
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            method: req.method,
            endpoint: req.originalUrl
          }
        });
      } catch (auditErr) {
        console.error('[AuditLog] Failed to log permission update:', auditErr);
      }
    }

    res.status(200).json({ success: true, data: role });
  } catch (err) {
    console.error('Error updating role permissions:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getPermissionCatalog,
  updateRolePermissions
};
