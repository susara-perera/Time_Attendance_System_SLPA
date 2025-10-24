
import React, { useState, useEffect, useContext } from 'react';
import { Form } from 'react-bootstrap';
import { AuthContext } from '../../context/AuthContext';
import RoleManagement from './RoleManagement';
import './RoleAccessManagement.css';

const RoleAccessManagement = () => {
  const { user } = useContext(AuthContext);
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
      setFormData(role?.permissions || {});
    }
  }, [selectedRole, roles]);

  // Auto-refresh roles every 30 seconds when component is active
  useEffect(() => {
    if (!showRoleManagement) { // Only refresh when on Role Access Management view
      const interval = setInterval(() => {
        fetchRoles();
      }, 30000); // Refresh every 30 seconds

      return () => clearInterval(interval);
    }
  }, [showRoleManagement]);

  // Permission checks
  const hasRoleReadPermission = () => isSuperAdmin || user?.permissions?.roles?.read;
  const hasRoleUpdatePermission = () => isSuperAdmin || user?.permissions?.roles?.update;

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
  const getTotalAvailablePermissions = () =>
    permissionCatalog.reduce((sum, cat) => sum + (cat.permissions?.length || 0), 0);

  const getTotalEnabledPermissions = () =>
    Object.values(formData)
      .flatMap(cat => Object.values(cat))
      .filter(Boolean).length;

  // Helper functions for better UX
  const getPermissionIcon = (category) => {
    const icons = {
      users: 'bi-people-fill',
      attendance: 'bi-clock-fill',
      reports: 'bi-bar-chart-fill',
      divisions: 'bi-building-fill',
      sections: 'bi-diagram-3-fill',
      roles: 'bi-shield-fill-check',
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
      roles: 'Define user roles and assign permission levels',
      settings: 'Configure system-wide settings and preferences',
      employees: 'Manage employee information and employment records'
    };
    return descriptions[category] || 'Manage related system features and data';
  };

  const getPermissionDetailDescription = (permissionId, category) => {
    const descriptions = {
      create: `Add new ${category === 'users' ? 'user accounts' : category === 'employees' ? 'employee records' : category}`,
      read: `View and browse existing ${category === 'users' ? 'user information' : category === 'employees' ? 'employee data' : category}`,
      update: `Edit and modify existing ${category === 'users' ? 'user details' : category === 'employees' ? 'employee information' : category}`,
      delete: `Remove and delete ${category === 'users' ? 'user accounts' : category === 'employees' ? 'employee records' : category}`,
      manage: `Full administrative access to ${category} management`
    };
    return descriptions[permissionId] || `Perform ${permissionId} operations`;
  };

  // Handlers
  const handleRoleSelect = (e) => {
    setSelectedRole(e.target.value);
  };

  const handlePermissionChange = (category, id) => {
    setFormData(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [id]: !prev[category]?.[id]
      }
    }));
  };

  const handleSelectAll = () => {
    const allEnabled = getTotalEnabledPermissions() !== getTotalAvailablePermissions();
    const updated = {};
    permissionCatalog.forEach(cat => {
      updated[cat.category] = {};
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
      await fetch(`http://localhost:5000/api/roles/${roleObj._id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ permissions: formData })
      });
      setShowSuccessModal(true);
    } catch (error) {
      console.error('Error saving permissions:', error);
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
      {showRoleManagement ? (
        <>
          <div style={{ marginBottom: '16px' }}>
            <button className="btn-manage-roles btn-secondary" onClick={() => setShowRoleManagement(false)}>
              <i className="bi bi-arrow-left" style={{ marginRight: '6px', fontSize: '1.1rem' }}></i> Back
            </button>
          </div>
          <RoleManagement />
        </>
      ) : (
        <>
          <div className="section-header">
            <h2>
              <i className="bi bi-people-fill"></i>
              Role Access Management
            </h2>
            <div className="header-actions">
              <button className="btn-manage-roles" onClick={() => setShowRoleManagement(true)}>
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
                    {permissionCatalog.map(category => (
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
                            return (
                              <div key={`${category.category}_${permission.id}`} className={`permission-toggle ${isChecked ? 'active' : ''}`}>
                                <label className="permission-switch">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => handlePermissionChange(category.category, permission.id)}
                                    disabled={!hasRoleUpdatePermission()}
                                  />
                                  <span className="slider"></span>
                                </label>
                                <div className="permission-info">
                                  <span className="permission-name">{permission.name}</span>
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
                    <button className="btn-save-permissions" onClick={openConfirm} disabled={!hasRoleUpdatePermission()}>
                      <i className="bi bi-shield-check"></i>
                      Save Permission Changes
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
        </>
      )}

      {/* Confirm Modal */}
      {showConfirm && (
        <div className="modal-overlay" onClick={() => setShowConfirm(false)}>
          <div className="modal-content confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h4>Confirm Save</h4>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to save these permission changes for <strong>{roles.find(r => r.value === selectedRole)?.label || selectedRole}</strong>?</p>
            </div>
            <div className="modal-footer">
              <button className="btn-save-modern btn-secondary" onClick={() => setShowConfirm(false)}>
                Cancel
              </button>
              <button className="btn-save-modern btn-success" onClick={confirmAndSave}>
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
