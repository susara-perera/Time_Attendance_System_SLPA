
import React, { useState, useEffect, useContext } from 'react';
import { Form } from 'react-bootstrap';
import { AuthContext } from '../../context/AuthContext';
import RoleManagement from './RoleManagement';
import './RoleAccessManagement.css';

const RoleAccessManagement = () => {
  const { user, hasPermission } = useContext(AuthContext);
  const isSuperAdmin = user?.role === 'super_admin';

  const [roles, setRoles] = useState([]);
  const [permissionCatalog, setPermissionCatalog] = useState([]);
  const [selectedRole, setSelectedRole] = useState('');
  const [formData, setFormData] = useState({});
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showRoleManagement, setShowRoleManagement] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [savingToggles, setSavingToggles] = useState({}); // keyed by `${category}_${id}`
  const isSavingAny = Object.keys(savingToggles || {}).length > 0;

  useEffect(() => {
    fetchRoles();
    fetchPermissionCatalog();

    // Listen for role updates from Role Management component
    const handleRoleAdded = () => {
      fetchRoles(true); // Refresh roles when a new role is added
    };

    const handleRoleUpdated = () => {
      fetchRoles(true); // Refresh roles when a role is updated
    };

    const handleRoleDeleted = () => {
      fetchRoles(true); // Refresh roles when a role is deleted
      setSelectedRole(''); // Clear selection if current role was deleted
    };

    // Add event listeners
    window.addEventListener('roleAdded', handleRoleAdded);
    window.addEventListener('roleUpdated', handleRoleUpdated);
    window.addEventListener('roleDeleted', handleRoleDeleted);

    // Cleanup event listeners
    return () => {
      window.removeEventListener('roleAdded', handleRoleAdded);
      window.removeEventListener('roleUpdated', handleRoleUpdated);
      window.removeEventListener('roleDeleted', handleRoleDeleted);
    };
  }, []);

  useEffect(() => {
    if (selectedRole) {
      const role = roles.find(r => r.value === selectedRole);
      // Map legacy permissions: if 'subsections' contains transfer/recall but 'transfer_recall' is empty,
      // migrate those flags into the 'transfer_recall' category for UI consumption (no DB migration).
      const perms = role?.permissions || {};
      const mapped = { ...perms };
      if (perms.subsections && (perms.subsections.transfer || perms.subsections.recall) && !perms.transfer_recall) {
        mapped.transfer_recall = {
          transfer: !!perms.subsections.transfer,
          recall: !!perms.subsections.recall
        };
      }
      setFormData(mapped);
    }
  }, [selectedRole, roles]);

  // Auto-refresh roles every 30 seconds when component is active.
  // Do NOT auto-refresh while a role is selected or while the user is actively saving toggles,
  // to avoid interrupting the user's current edits.
  useEffect(() => {
    // Only refresh when on Role Access Management view and user is not interacting
    if (!showRoleManagement && !selectedRole && !isSavingAny) {
      const interval = setInterval(() => {
        fetchRoles();
      }, 30000); // Refresh every 30 seconds

      return () => clearInterval(interval);
    }
    // If conditions not met, ensure any previous interval is cleared by returning noop
    return () => {};
  }, [showRoleManagement, selectedRole, isSavingAny]);

  // Permission checks
  // Permission checks
  const hasViewRolesPermission = () => isSuperAdmin || hasPermission('view_roles') || hasPermission('roles.read');

  const hasRoleReadPermission = () => hasViewRolesPermission();

  // Allow users who have explicit permission-management update rights
  // to modify role permissions as well (in addition to roles.update).
  const hasRoleUpdatePermission = () => isSuperAdmin || hasPermission('update_role') || hasPermission('roles.update') || hasPermission('permission_management.update_permission');

  const hasRoleManageReadPermission = () => hasViewRolesPermission();

  // Fetch roles from backend
  const fetchRoles = async (showRefreshIndicator = false) => {
    try {
      if (showRefreshIndicator) setIsRefreshing(true);
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/roles', {
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });

      if (response.ok) {
        const data = await response.json();
        setRoles(data.data || []);
      } else {
        console.error('Failed to fetch roles');
      }
    } catch (error) {
      console.error('Error fetching roles:', error);
    } finally {
      setLoading(false);
      if (showRefreshIndicator) {
        setTimeout(() => setIsRefreshing(false), 500); // Show indicator for 500ms
      }
    }
  };

  // Fetch permission catalog
  const fetchPermissionCatalog = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/permissions/catalog', {
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPermissionCatalog(data.data || []);
      } else {
        console.error('Failed to fetch permission catalog');
      }
    } catch (error) {
      console.error('Error fetching permission catalog:', error);
    }
  };

  // Stats
  const visiblePermissionCatalog = (() => {
    const baseMapped = permissionCatalog.map(cat => {
      if (cat.category === 'divisions' || cat.category === 'sections' || cat.category === 'employees') {
        // Only show the 'read' permission for divisions and sections (view only)
        return { ...cat, permissions: (cat.permissions || []).filter(p => p.id === 'read') };
      }
      if (cat.category === 'reports') {
        // Define explicit report subsections and actions as requested.
        // These are the only subsections shown in the Report Management card.
        return {
          ...cat,
          permissions: [
            { id: 'attendance_generate', name: 'Attendance Report - Generate Report' },
            { id: 'attendance_download', name: 'Attendance Report - Download Report' },
            { id: 'audit_generate', name: 'Audit Report - Generate Report' },
            { id: 'meal_generate', name: 'Meal Report - Generate Report' },
            { id: 'view_reports', name: 'View Reports' }
          ]
        };
      }
      if (cat.category === 'settings') {
        // Explicit system settings subsections
        return {
          ...cat,
          permissions: [
            { id: 'settings_view', name: 'View Settings' },
            { id: 'profile_update', name: 'Update Profile' },
            { id: 'settings_general', name: 'Change General Settings' },
            { id: 'settings_appearance', name: 'Change Appearance' },
            { id: 'settings_security', name: 'Change Security' }
          ]
        };
      }
      if (cat.category === 'subsections') {
        // For subsections, only show create/read/update/delete (no transfer/recall here)
        return { ...cat, permissions: (cat.permissions || []).filter(p => ['create', 'read', 'update', 'delete'].includes(p.id)) };
      }
      if (cat.category === 'transfer_recall') {
        // Transfer & Recall card only shows transfer and recall actions
        return { ...cat, permissions: (cat.permissions || []).filter(p => ['transfer', 'recall'].includes(p.id)) };
      }
      return cat;
    });

    // If backend doesn't expose 'subsections' yet, append a default category
    const base = baseMapped.slice();
    const hasSubsections = base.some(c => c.category === 'subsections');
    if (!hasSubsections) {
      base.push({
        category: 'subsections',
        name: 'Sub-Section Management',
        permissions: [
          { id: 'create', name: 'Create Sub-Sections' },
          { id: 'read', name: 'View Sub-Sections' },
          { id: 'update', name: 'Update Sub-Sections' },
          { id: 'delete', name: 'Delete Sub-Sections' }
        ]
      });
    }

    // Add Transfer & Recall card fallback if backend doesn't expose it
    const hasTransferRecall = base.some(c => c.category === 'transfer_recall');
    if (!hasTransferRecall) {
      base.push({
        category: 'transfer_recall',
        name: 'Transfer & Recall Management',
        permissions: [
          { id: 'transfer', name: 'Transfer Employee to Sub-Section' },
          { id: 'recall', name: 'Recall Transferred Employee' }
        ]
      });
    }

    // Ensure 'sections' and 'employees' are adjacent so they appear on the same row
    const sectionsIndex = base.findIndex(c => c.category === 'sections');
    const employeesIndex = base.findIndex(c => c.category === 'employees');
    if (sectionsIndex !== -1 && employeesIndex !== -1 && Math.abs(sectionsIndex - employeesIndex) !== 1) {
      // Pull out employees and insert right after sections
      const emp = base.splice(employeesIndex, 1)[0];
      const insertAt = base.findIndex(c => c.category === 'sections') + 1;
      base.splice(insertAt, 0, emp);
    }

    // Remove Attendance Management card entirely per request
    // Also remove any existing legacy 'roles' card so we can replace it
    // with two separate cards: Role Management and Permission Management
    const filtered = base.filter(c => c.category !== 'attendance' && c.category !== 'roles');

    // Append new Role Management and Permission Management cards
    const hasRoleManagement = filtered.some(c => c.category === 'role_management');
    if (!hasRoleManagement) {
      filtered.push({
        category: 'role_management',
        name: 'Role Management',
        permissions: [
          { id: 'create_role', name: 'Create Role' },
          { id: 'update_role', name: 'Update Role' },
          { id: 'delete_role', name: 'Delete Role' },
          { id: 'view_roles', name: 'View Roles' }
        ]
      });
    }

    const hasPermissionManagement = filtered.some(c => c.category === 'permission_management');
    if (!hasPermissionManagement) {
      filtered.push({
        category: 'permission_management',
        name: 'Permission Management',
        permissions: [
          { id: 'view_permission', name: 'View Permission' },
          { id: 'update_permission', name: 'Update Permission' }
        ]
      });
    }

    return filtered;
  })();

  const getTotalAvailablePermissions = () =>
    visiblePermissionCatalog.reduce((sum, cat) => sum + (cat.permissions?.length || 0), 0);

  const getTotalEnabledPermissions = () => {
    let enabled = 0;
    visiblePermissionCatalog.forEach(cat => {
      const perms = cat.permissions || [];
      perms.forEach(p => {
        if (formData[cat.category]?.[p.id]) enabled++;
      });
    });
    return enabled;
  };

  // Helper functions for better UX
  const getPermissionIcon = (category) => {
    const icons = {
      users: 'bi-people-fill',
      attendance: 'bi-clock-fill',
      reports: 'bi-bar-chart-fill',
      divisions: 'bi-building-fill',
      sections: 'bi-diagram-3-fill',
      subsections: 'bi-list-check',
      transfer_recall: 'bi-arrow-left-right',
      roles: 'bi-shield-fill-check',
      role_management: 'bi-people-fill',
      permission_management: 'bi-key-fill',
      settings: 'bi-gear-fill',
      employees: 'bi-person-badge-fill'
    };
    return icons[category] || 'bi-gear-fill';
  };

  const getPermissionDescription = (category) => {
    const descriptions = {
      users: 'Manage user accounts, profiles, and authentication settings',
      attendance: 'Track, monitor, and manage employee attendance records',
      reports: 'Generate, view, and manage various system reports',
      divisions: 'Create and manage organizational divisions and departments',
      sections: 'Organize and manage different sections within divisions',
      subsections: 'Create and manage sub-sections within sections',
      transfer_recall: 'Manage transferring and recalling employees to and from sub-sections',
      roles: 'Define user roles and assign permission levels',
      role_management: 'Create, update, delete and view roles',
      permission_management: 'View and update system permissions',
      settings: 'Configure system-wide settings and preferences',
      employees: 'Manage employee information and employment records'
    };
    return descriptions[category] || 'Manage related system features and data';
  };

  const getPermissionDetailDescription = (permissionId, category) => {
    const descriptions = {
      create: `Add new ${category === 'users' ? 'user accounts' : category === 'employees' ? 'employee records' : category === 'subsections' ? 'sub-section' : category}`,
      read: category === 'reports'
        ? 'Download and export existing reports'
        : `View and browse existing ${category === 'users' ? 'user information' : category === 'employees' ? 'employee data' : category === 'subsections' ? 'sub-section' : category}`,
      update: `Edit and modify existing ${category === 'users' ? 'user details' : category === 'employees' ? 'employee information' : category === 'subsections' ? 'sub-section' : category}`,
      delete: `Remove and delete ${category === 'users' ? 'user accounts' : category === 'employees' ? 'employee records' : category === 'subsections' ? 'sub-section' : category}`,
      transfer: `Transfer employee to ${category === 'subsections' || category === 'transfer_recall' ? 'sub-section' : 'that module'}`,
      recall: `Recall transferred employees from ${category === 'subsections' || category === 'transfer_recall' ? 'sub-section' : 'that module'}`,
      manage: `Full administrative access to ${category} management`,

      // Report-specific permissions (new ids)
      attendance_generate: 'Generate attendance reports for selected date ranges and filters',
      attendance_download: 'Download/export attendance reports (CSV, PDF) for distribution',
      audit_generate: 'Generate system audit reports showing activity and changes',
      meal_generate: 'Generate meal reports for employee meal tracking',
      view_reports: 'Browse and view available reports and their metadata',

      // Settings-specific permissions
      profile_update: 'Update your user profile information (name, contact, photo)',
      settings_general: 'Change general system settings (timezone, locale, defaults)',
      settings_appearance: 'Change appearance options (theme, layout, branding)',
      settings_security: 'Change security settings (password policies, 2FA, session rules)'
      ,
      settings_view: 'View system settings and read configuration without editing'
    };
    // Role / Permission management details
    descriptions.create_role = 'Create new roles that can be assigned to users';
    descriptions.update_role = 'Modify existing role details and assigned permissions';
    descriptions.delete_role = 'Delete roles that are no longer needed';
    descriptions.view_roles = 'View list of roles and their basic details';
    descriptions.view_permission = 'View the permission catalog and current assignments';
    descriptions.update_permission = 'Update permission definitions or assignments';
    return descriptions[permissionId] || `Perform ${permissionId} operations`;
  };


  // Handlers
  const handleRoleSelect = (e) => {
    setSelectedRole(e.target.value);
  };

  const handlePermissionChange = async (category, id) => {
    if (!hasRoleUpdatePermission()) return;
    if (!selectedRole) return;

    const roleObj = roles.find(r => r.value === selectedRole);
    if (!roleObj) return;

    const key = `${category}_${id}`;
    const oldVal = !!formData[category]?.[id];

    // Optimistic UI update
    // Special handling: master switches act as a master. If they are being turned off,
    // also clear other related permissions in the UI immediately.
    if (category === 'settings' && id === 'settings_view' && oldVal === true) {
      // user is unchecking settings_view -> clear other settings permissions
      const settingsPerms = (visiblePermissionCatalog.find(c => c.category === 'settings')?.permissions) || [];
      const cleared = {};
      settingsPerms.forEach(p => {
        cleared[p.id] = false;
      });
      setFormData(prev => ({ ...prev, [category]: { ...(prev[category] || {}), ...cleared } }));
    } else if (category === 'subsections' && id === 'read' && oldVal === true) {
      // user is unchecking subsections.read -> clear other subsection permissions
      const subsPerms = (visiblePermissionCatalog.find(c => c.category === 'subsections')?.permissions) || [];
      const cleared = {};
      subsPerms.forEach(p => {
        cleared[p.id] = false;
      });
      setFormData(prev => ({ ...prev, [category]: { ...(prev[category] || {}), ...cleared } }));
    } else if (category === 'users' && id === 'read' && oldVal === true) {
      // user is unchecking users.read -> clear other user permissions (create/update/delete)
      const userPerms = (visiblePermissionCatalog.find(c => c.category === 'users')?.permissions) || [];
      const cleared = {};
      userPerms.forEach(p => {
        cleared[p.id] = false;
      });
      setFormData(prev => ({ ...prev, [category]: { ...(prev[category] || {}), ...cleared } }));
    } else {
      setFormData(prev => ({
        ...prev,
        [category]: {
          ...prev[category],
          [id]: !oldVal
        }
      }));
    }

    // Mark this toggle as saving
    setSavingToggles(s => ({ ...s, [key]: true }));

    try {
      const token = localStorage.getItem('token');
      // Merge existing role permissions and apply the change
      const mergedPermissions = { ...(roleObj.permissions || {}) };
      mergedPermissions[category] = { ...(mergedPermissions[category] || {}) };

      // If toggling a master permission off, clear other related permissions in the payload
      if (category === 'settings' && id === 'settings_view' && oldVal === true) {
        const settingsPerms = (visiblePermissionCatalog.find(c => c.category === 'settings')?.permissions) || [];
        mergedPermissions[category] = mergedPermissions[category] || {};
        settingsPerms.forEach(p => {
          mergedPermissions[category][p.id] = false;
        });
      } else if (category === 'subsections' && id === 'read' && oldVal === true) {
        const subsPerms = (visiblePermissionCatalog.find(c => c.category === 'subsections')?.permissions) || [];
        mergedPermissions[category] = mergedPermissions[category] || {};
        subsPerms.forEach(p => {
          mergedPermissions[category][p.id] = false;
        });
      } else if (category === 'users' && id === 'read' && oldVal === true) {
        const userPerms = (visiblePermissionCatalog.find(c => c.category === 'users')?.permissions) || [];
        mergedPermissions[category] = mergedPermissions[category] || {};
        userPerms.forEach(p => {
          mergedPermissions[category][p.id] = false;
        });
      } else {
        mergedPermissions[category][id] = !oldVal;
      }

      const response = await fetch(`http://localhost:5000/api/permissions/roles/${roleObj._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ permissions: mergedPermissions })
      });

      if (!response.ok) {
        // Revert optimistic update on failure
        setFormData(prev => ({
          ...prev,
          [category]: {
            ...prev[category],
            [id]: oldVal
          }
        }));
        console.error('Failed to update permission toggle', await response.text());
      } else {
        // Update local roles list to reflect backend change
        const data = await response.json().catch(() => ({}));
        if (data && data.data) {
          setRoles(prev => prev.map(r => (r._id === roleObj._id ? data.data : r)));
          // Notify other components about permission change
          window.dispatchEvent(new CustomEvent('permissionsChanged'));
        }
      }
    } catch (err) {
      // Revert optimistic update on error
      setFormData(prev => ({
        ...prev,
        [category]: {
          ...prev[category],
          [id]: oldVal
        }
      }));
      console.error('Error updating permission toggle:', err);
    } finally {
      setSavingToggles(s => {
        const copy = { ...s };
        delete copy[key];
        return copy;
      });
    }
  };

  const handleSelectAll = () => {
    const allEnabled = getTotalEnabledPermissions() !== getTotalAvailablePermissions();
    const updated = { ...formData };
    visiblePermissionCatalog.forEach(cat => {
      updated[cat.category] = updated[cat.category] || {};
      cat.permissions.forEach(p => {
        updated[cat.category][p.id] = allEnabled;
      });
    });
    setFormData(updated);
  };

  const handleSave = async () => {
    setShowConfirm(false);
    const roleObj = roles.find(r => r.value === selectedRole);
    if (!roleObj) return;

    try {
      const token = localStorage.getItem('token');
      // Preserve any permissions that are not shown in the UI (hidden permissions)
      const mergedPermissions = { ...(roleObj.permissions || {}) };
      Object.keys(formData).forEach(cat => {
        mergedPermissions[cat] = { ...mergedPermissions[cat], ...formData[cat] };
      });

      await fetch(`http://localhost:5000/api/permissions/roles/${roleObj._id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ permissions: mergedPermissions })
      });
      // Refresh local roles to reflect the change
      await fetchRoles();
      // Notify other parts of the app (AuthContext will poll/refresh current user)
      window.dispatchEvent(new CustomEvent('permissionsChanged'));
      setShowSuccessModal(true);
    } catch (error) {
      console.error('Error saving permissions:', error);
      // On failure, try to re-sync
      try { await fetchRoles(); } catch (err) { console.error('Error refreshing roles after failed save:', err); }
    }
  };

  const openConfirm = (e) => { 
    e.preventDefault(); 
    setShowConfirm(true); 
  };

  const confirmAndSave = async () => {
    await handleSave();
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="role-access-wrapper">
          <div className="section-header">
            <h2>
              <i className="bi bi-people-fill"></i>
              Role Access Management
            </h2>
            <div className="header-actions">
              <button
                className="btn-manage-roles"
                onClick={() => {
                  if (!hasViewRolesPermission()) return;
                  // Use the Dashboard's global navigate event to switch to the Role Management page
                  window.dispatchEvent(new CustomEvent('navigateTo', { detail: 'role-management' }));
                }}
                disabled={!hasViewRolesPermission()}
                title={!hasViewRolesPermission() ? "You need 'view_roles' or 'roles.read' access to manage roles" : "Manage Roles"}
              >
                <i className="bi bi-gear" style={{ marginRight: '6px', fontSize: '1.1rem' }}></i> Manage Roles
              </button>
            </div>
          </div>
          {hasRoleReadPermission() ? (
            <>
              <div className="stats-section">
                <div className="stats-item">
                  <span className="stats-number">{roles.length}</span>
                  <span className="stats-label">Available Roles</span>
                </div>
                <div className="stats-item">
                  <span className="stats-number">{getTotalAvailablePermissions()}</span>
                  <span className="stats-label">Available Permissions</span>
                </div>
                {selectedRole && (
                  <div className="stats-item">
                    <span className="stats-number">{getTotalEnabledPermissions()}</span>
                    <span className="stats-label">Granted Permissions</span>
                  </div>
                )}
              </div>

              <div className="form-section">
                <label htmlFor="role" className="form-label-modern">
                  <i className="bi bi-person-gear text-primary mr-2"></i>Select Role to Manage
                  {isRefreshing && <span className="refresh-indicator ml-2">🔄 Updating...</span>}
                </label>
                <Form.Select 
                  name="role" 
                  id="role" 
                  className="form-control-modern" 
                  value={selectedRole}
                  onChange={handleRoleSelect}
                  disabled={!hasRoleUpdatePermission() || isRefreshing}
                  title={!hasRoleUpdatePermission() ? 'You need "Update Role Permissions" access to change role selection' : ''}
                >
                  <option value="">-- Choose a role to configure --</option>
                  {roles.map(role => (
                    <option key={role.value} value={role.value}>
                      {role.label} - {role.description || 'No description'}
                    </option>
                  ))}
                </Form.Select>
                {selectedRole && (
                  <small className="text-muted mt-2 d-block">
                    <i className="bi bi-info-circle mr-1"></i>
                    This will update permissions for users with the role: {roles.find(r => r.value === selectedRole)?.label || selectedRole}
                  </small>
                )}
                {!hasRoleUpdatePermission() && (
                  <div className="alert alert-warning mt-3">
                    <i className="bi bi-lock-fill mr-2"></i>
                    You have view-only access. To modify role permissions, you need the "Update Role Permissions" access.
                  </div>
                )}
              </div>

              {selectedRole && (
                <div className="permissions-container">
                  <div className="permissions-header">
                    <div className="permissions-title">
                      <h4>Configure Permissions for <span className="role-highlight">{roles.find(r => r.value === selectedRole)?.label || selectedRole}</span></h4>
                      <p className="permissions-subtitle">Grant or revoke access to different system modules and features</p>
                    </div>
                    <div className="permissions-actions">
                      <button className="btn-toggle-all" onClick={handleSelectAll}>
                        <i className={`bi ${getTotalEnabledPermissions() === getTotalAvailablePermissions() ? 'bi-check-square' : 'bi-square'}`}></i>
                        {getTotalEnabledPermissions() === getTotalAvailablePermissions() ? 'Unselect All' : 'Select All'}
                      </button>
                    </div>
                  </div>

                  <div className="permissions-grid">
                    {visiblePermissionCatalog.map(category => (
                      <div key={category.category} className="permission-card">
                        <div className="permission-card-header">
                          <div className="permission-icon">
                            <i className={getPermissionIcon(category.category)}></i>
                          </div>
                          <div className="permission-card-title">
                            <h5>{category.name}</h5>
                            <p>{getPermissionDescription(category.category)}</p>
                          </div>
                          <div className="permission-status">
                            <span className="enabled-count">
                              {category.permissions.filter(p => formData[category.category]?.[p.id]).length}
                            </span>
                            <span className="total-count">/{category.permissions.length}</span>
                          </div>
                        </div>
                        <div className="permission-card-body">
                          {category.permissions.map(permission => {
                            const isChecked = formData[category.category]?.[permission.id] || false;
                            const toggleKey = `${category.category}_${permission.id}`;
                            return (
                              <div key={`${category.category}_${permission.id}`} className={`permission-toggle ${isChecked ? 'active' : ''}`}>
                                <label className="permission-switch">
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => handlePermissionChange(category.category, permission.id)}
                                          disabled={
                                            !hasRoleUpdatePermission() ||
                                            !!savingToggles[toggleKey] ||
                                            // For settings: require 'settings_view' to be enabled before other settings can be toggled
                                            (category.category === 'settings' && permission.id !== 'settings_view' && !formData?.settings?.settings_view) ||
                                            // For subsections: require 'read' (view) before other subsection permissions can be toggled
                                            (category.category === 'subsections' && permission.id !== 'read' && !formData?.subsections?.read) ||
                                            // For users: require 'read' (view) before other user permissions can be toggled
                                            (category.category === 'users' && permission.id !== 'read' && !formData?.users?.read)
                                          }
                                          title={
                                            `${permission.name} - ${getPermissionDetailDescription(permission.id, category.category)}` +
                                            (category.category === 'settings' && permission.id !== 'settings_view' && !formData?.settings?.settings_view ? ' — Requires "View Settings" permission' : '') +
                                            (category.category === 'subsections' && permission.id !== 'read' && !formData?.subsections?.read ? ' — Requires "View Sub-Sections" permission' : '') +
                                            (category.category === 'users' && permission.id !== 'read' && !formData?.users?.read ? ' — Requires "View Users" permission' : '')
                                          }
                                        />
                                  <span className="slider"></span>
                                </label>
                                <div className="permission-info">
                                  <span className="permission-name">{permission.name}</span>
                                  {savingToggles[toggleKey] && (
                                    <span className="save-indicator ml-2" title="Saving...">🔄</span>
                                  )}
                                  <span className="permission-desc">{getPermissionDetailDescription(permission.id, category.category)}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="permissions-footer">
                    <div className="permission-summary">
                      <div className="summary-stat">
                        <span className="stat-number">{getTotalEnabledPermissions()}</span>
                        <span className="stat-label">permissions granted</span>
                      </div>
                      <div className="summary-stat">
                        <span className="stat-number">{getTotalAvailablePermissions() - getTotalEnabledPermissions()}</span>
                        <span className="stat-label">permissions restricted</span>
                      </div>
                    </div>
                    <button className="btn-save-permissions" onClick={openConfirm} disabled={!hasRoleUpdatePermission() || isSavingAny}>
                      <i className="bi bi-shield-check"></i>
                      {isSavingAny ? 'Applying...' : 'Save Permission Changes'}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="alert alert-warning mt-4">
              <i className="bi bi-lock-fill mr-2"></i>
              You do not have permission to view role access management. Contact a Super Admin for "roles.read" access.
            </div>
            )}

      {/* Confirm Modal */}
      {showConfirm && (
        <div className="modal-overlay confirm-overlay" onClick={() => setShowConfirm(false)}>
          <div className="modal-content confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h4 className="confirm-title">Confirm Save</h4>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to save these permission changes for <strong>{roles.find(r => r.value === selectedRole)?.label || selectedRole}</strong>?</p>
            </div>
            <div className="modal-footer">
              <button className="btn-save-modern btn-secondary btn-confirm-cancel" onClick={() => setShowConfirm(false)}>
                Cancel
              </button>
              <button className="btn-save-modern btn-success btn-confirm-confirm" onClick={confirmAndSave}>
                Yes, Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="modal-overlay" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 9999 }}>
          <div className="modal-content success-modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center', border: '3px solid #2575fc', borderRadius: '15px', background: 'linear-gradient(135deg, #f8f9fa, #e9ecef)', boxShadow: '0 10px 30px rgba(37,117,252,0.15)' }}>
            <div style={{ padding: '30px' }}>
              <div style={{ fontSize: '48px', color: '#2575fc', marginBottom: '18px' }}>
                <i className="bi bi-check-circle-fill"></i>
              </div>
              <h2 style={{ color: '#2575fc', marginBottom: '12px', fontWeight: 'bold' }}>
                Success!
              </h2>
              <p style={{ fontSize: '15px', color: '#495057', marginBottom: '18px', lineHeight: '1.5' }}>
                Permissions updated for <strong>{roles.find(r => r.value === selectedRole)?.label || selectedRole}</strong>.
              </p>
              <button className="btn-save-modern btn-success" onClick={() => setShowSuccessModal(false)} style={{ padding: '8px 24px', fontSize: '15px', fontWeight: 'bold' }}>
                <i className="bi bi-check2"></i> OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoleAccessManagement;
