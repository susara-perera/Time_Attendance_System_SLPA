import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import './RoleAccessManagement.css';

const RoleManagement = () => {
  const { user, hasPermission } = useContext(AuthContext);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddRoleModal, setShowAddRoleModal] = useState(false);
  const [showEditRoleModal, setShowEditRoleModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [editingRole, setEditingRole] = useState(null);
  const [roleToDelete, setRoleToDelete] = useState(null);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const isSuperAdmin = user?.role === 'super_admin';

  // Role-based permission checks using AuthContext helper
  const hasRoleManageReadPermission = () => isSuperAdmin || hasPermission('view_roles') || hasPermission('roles.read');
  const hasRoleManageCreatePermission = () => isSuperAdmin || hasPermission('create_role') || hasPermission('roles.create');
  const hasRoleManageUpdatePermission = () => isSuperAdmin || hasPermission('update_role') || hasPermission('roles.update') || hasPermission('permission_management.manage_permission');
  const hasRoleManageDeletePermission = () => isSuperAdmin || hasPermission('delete_role') || hasPermission('roles.delete');

  // Show success modal with message
  const showSuccessPopup = (message) => {
    setSuccessMessage(message);
    setShowSuccessModal(true);
    // Auto close after 3 seconds
    setTimeout(() => {
      setShowSuccessModal(false);
      setSuccessMessage('');
    }, 3000);
  };

  // Fetch roles from backend
  const fetchRoles = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/roles', {
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Fetched roles:', data.data);
        setRoles(data.data || []);
      } else {
        console.error('Failed to fetch roles, status:', response.status);
        setMessage('Failed to fetch roles');
        setMessageType('error');
        setToastVisible(true);
        setTimeout(() => setToastVisible(false), 4000);
      }
    } catch (error) {
      console.error('Error fetching roles:', error);
      setMessage('Error fetching roles');
      setMessageType('error');
      setToastVisible(true);
      setTimeout(() => setToastVisible(false), 4000);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  // Handle Add Role form submission
  const handleAddRoleSubmit = async (e) => {
    e.preventDefault();
    const roleLabel = newRoleName.trim();
    const roleValue = roleLabel.toLowerCase().replace(/\s+/g, '_');
    if (!roleValue) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/api/roles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ value: roleValue, label: roleLabel })
      });

      if (res.ok) {
        const result = await res.json();
        const role = result.data;
        
        // Add the new role to the roles state
        setRoles(prev => [...prev, role]);
        
        // Clear form and close modal
        setNewRoleName('');
        setShowAddRoleModal(false);
        
        // Show enhanced success popup
        showSuccessPopup(`Role "${role.label}" has been successfully created!`);
        
        // Also show the regular toast
        setMessage(`Role "${role.label}" created successfully!`);
        setMessageType('success');
        setToastVisible(true);
        setTimeout(() => setToastVisible(false), 4000);
        
        // Notify other components
        window.dispatchEvent(new CustomEvent('roleAdded', { detail: { value: role.value, label: role.label } }));
      } else {
        const error = await res.json().catch(() => ({}));
        setMessage(error.message || 'Failed to create role');
        setMessageType('error');
        setToastVisible(true);
        setTimeout(() => setToastVisible(false), 4000);
      }
    } catch (err) {
      console.error('Error creating role:', err);
      setMessage('Network error while creating role');
      setMessageType('error');
      setToastVisible(true);
      setTimeout(() => setToastVisible(false), 4000);
    }
  };

  // Handle Edit Role form submission
  const handleEditRoleSubmit = async (e) => {
    e.preventDefault();
    const roleLabel = newRoleName.trim();
    if (!roleLabel || !editingRole) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/roles/${editingRole._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ label: roleLabel })
      });

      if (res.ok) {
        const result = await res.json();
        const updatedRole = result.data;
        
        // Update the role in the roles state
        setRoles(prev => prev.map(role => 
          role._id === editingRole._id ? updatedRole : role
        ));
        
        // Clear form and close modal
        setNewRoleName('');
        setEditingRole(null);
        setShowEditRoleModal(false);
        
        // Show enhanced success popup
        showSuccessPopup(`Role "${updatedRole.label}" has been successfully updated!`);
        
        // Also show the regular toast
        setMessage(`Role updated successfully!`);
        setMessageType('success');
        setToastVisible(true);
        setTimeout(() => setToastVisible(false), 4000);
        
        // Notify other components
        window.dispatchEvent(new CustomEvent('roleUpdated', { detail: { value: updatedRole.value, label: updatedRole.label } }));
      } else {
        const error = await res.json().catch(() => ({}));
        setMessage(error.message || 'Failed to update role');
        setMessageType('error');
        setToastVisible(true);
        setTimeout(() => setToastVisible(false), 4000);
      }
    } catch (err) {
      console.error('Error updating role:', err);
      setMessage('Network error while updating role');
      setMessageType('error');
      setToastVisible(true);
      setTimeout(() => setToastVisible(false), 4000);
    }
  };

  // Handle Delete Role
  const handleDeleteRole = async () => {
    console.log('handleDeleteRole called with roleToDelete:', roleToDelete);
    
    if (!roleToDelete) {
      console.error('No role to delete');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      console.log('Token exists:', !!token);
      console.log('Attempting to delete role:', roleToDelete._id, roleToDelete.label);
      
      const res = await fetch(`http://localhost:5000/api/roles/${roleToDelete._id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });

      console.log('Delete response status:', res.status, res.statusText);

      if (res.ok) {
        const responseData = await res.json();
        console.log('Delete successful:', responseData);
        
        // Remove the role from the roles state
        setRoles(prev => {
          const filteredRoles = prev.filter(role => role._id !== roleToDelete._id);
          console.log('Updated roles list:', filteredRoles);
          return filteredRoles;
        });
        
        // Clear state and close modal
        setRoleToDelete(null);
        setShowDeleteConfirm(false);
        
        // Show enhanced success popup
        showSuccessPopup(`Role "${roleToDelete.label}" has been successfully deleted from the system!`);
        
        // Also show the regular toast for backup
        setMessage(`Role "${roleToDelete.label}" deleted successfully!`);
        setMessageType('success');
        setToastVisible(true);
        setTimeout(() => setToastVisible(false), 4000);
        
        // Notify other components
        window.dispatchEvent(new CustomEvent('roleDeleted', { detail: { value: roleToDelete.value, label: roleToDelete.label } }));
      } else {
        const errorText = await res.text();
        console.error('Delete failed with response:', errorText);
        
        let error;
        try {
          error = JSON.parse(errorText);
        } catch (e) {
          error = { message: errorText || 'Failed to delete role' };
        }
        
        setMessage(error.message || 'Failed to delete role');
        setMessageType('error');
        setToastVisible(true);
        setTimeout(() => setToastVisible(false), 4000);
        setShowDeleteConfirm(false);
      }
    } catch (err) {
      console.error('Error deleting role:', err);
      setMessage('Network error while deleting role');
      setMessageType('error');
      setToastVisible(true);
      setTimeout(() => setToastVisible(false), 4000);
      setShowDeleteConfirm(false);
    }
  };

  // Open edit modal
  const openEditModal = (role) => {
    setEditingRole(role);
    setNewRoleName(role.label);
    setShowEditRoleModal(true);
  };

  // Open delete confirmation
  const openDeleteConfirm = (role) => {
    console.log('Opening delete confirmation for role:', role);
    setRoleToDelete(role);
    setShowDeleteConfirm(true);
  };

  if (loading) {
    return (
      <div className="role-access-wrapper">
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="role-access-wrapper">
      {/* Background shapes */}
      <div className="geometric-background">
        <div className="geometric-shape shape-1"></div>
        <div className="geometric-shape shape-2"></div>
        <div className="geometric-shape shape-3"></div>
        <div className="geometric-shape shape-4"></div>
      </div>

      <div className="container-fluid px-4">
        <div className="main-card">
          <div className="card-header-custom">
            <div className="header-content" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <div className="header-text">
                <h1 className="page-title role-title-black">Role Management</h1>
              </div>
              
              {hasRoleManageReadPermission() ? (
                <button
                  className={`btn-professional ${hasRoleManageCreatePermission() ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => {
                    if (hasRoleManageCreatePermission()) {
                      setShowAddRoleModal(true);
                    } else {
                      setMessage('You do not have permission to create roles. Contact a Super Admin for "roles.create" access.');
                      setMessageType('error');
                      setToastVisible(true);
                      setTimeout(() => setToastVisible(false), 4000);
                    }
                  }}
                  title={hasRoleManageCreatePermission() ? "Add New Role" : "You need 'roles.create' permission to add roles"}
                  style={{ 
                    padding: '10px 16px', 
                    fontSize: '14px',
                    cursor: hasRoleManageCreatePermission() ? 'pointer' : 'not-allowed',
                    opacity: hasRoleManageCreatePermission() ? 1 : 0.6
                  }}
                >
                  <i className={`bi ${hasRoleManageCreatePermission() ? 'bi-plus-circle' : 'bi-lock'}`}></i> 
                  Add Role
                  {!hasRoleManageCreatePermission() && <i className="bi bi-exclamation-triangle ml-1" style={{fontSize: '12px'}}></i>}
                </button>
              ) : (
                <div className="alert alert-info" style={{ margin: 0, padding: '8px 12px', fontSize: '14px' }}>
                  <i className="bi bi-info-circle mr-2"></i>
                  You have limited access to role management.
                </div>
              )}
            </div>
          </div>
          
          <div className="card-body-custom">
            {/* Toast popup */}
            {toastVisible && message && (
              <div className={`toast-popup ${messageType === 'success' ? 'toast-success' : 'toast-error'}`}>
                <i className={`bi ${messageType === 'success' ? 'bi-check-circle' : 'bi-exclamation-circle'} mr-2`}></i>
                {message}
              </div>
            )}

            {/* Access Control Messages */}
            {!hasRoleManageReadPermission() && (
                <div className="alert alert-warning">
                <i className="bi bi-lock-fill mr-2"></i>
                You do not have permission to view role management. Contact a Super Admin for "roles.read" access.
              </div>
            )}            {hasRoleManageReadPermission() && !hasRoleManageCreatePermission() && !hasRoleManageUpdatePermission() && !hasRoleManageDeletePermission() && (
              <div className="alert alert-info">
                <i className="bi bi-eye mr-2"></i>
                You have read-only access to role management. Contact a Super Admin for additional permissions.
              </div>
            )}

            {/* Show content only if user has read access */}
            {hasRoleManageReadPermission() && (
              <>
                {/* Roles Table */}
            <div className="professional-card">
              <div className="table-responsive">
                <table className="professional-table">
                  <thead>
                    <tr>
                      <th>Role Name</th>
                      <th>Role Value</th>
                      <th>Created Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roles.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="text-center">
                          No roles found
                        </td>
                      </tr>
                    ) : (
                      roles.map(role => (
                        <tr key={role._id}>
                          <td><strong>{role.label}</strong></td>
                          <td><code>{role.value}</code></td>
                          <td>{new Date(role.createdAt || Date.now()).toLocaleDateString()}</td>
                          <td>
                            {hasRoleManageReadPermission() ? (
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                  className={`btn-professional ${hasRoleManageUpdatePermission() ? 'btn-secondary' : 'btn-secondary'}`}
                                  onClick={() => {
                                    if (hasRoleManageUpdatePermission()) {
                                      openEditModal(role);
                                    } else {
                                      setMessage('You do not have permission to edit roles. Contact a Super Admin for "roles.update" access.');
                                      setMessageType('error');
                                      setToastVisible(true);
                                      setTimeout(() => setToastVisible(false), 4000);
                                    }
                                  }}
                                  title={hasRoleManageUpdatePermission() ? "Edit Role" : "You need 'roles.update' permission to edit roles"}
                                  style={{ 
                                    padding: '6px 10px', 
                                    fontSize: '12px',
                                    cursor: hasRoleManageUpdatePermission() ? 'pointer' : 'not-allowed',
                                    opacity: hasRoleManageUpdatePermission() ? 1 : 0.6
                                  }}
                                >
                                  <i className={`bi ${hasRoleManageUpdatePermission() ? 'bi-pencil' : 'bi-lock'}`}></i> 
                                  Edit
                                  {!hasRoleManageUpdatePermission() && <i className="bi bi-exclamation-triangle ml-1" style={{fontSize: '10px'}}></i>}
                                </button>
                                <button
                                  className={`btn-professional ${hasRoleManageDeletePermission() ? 'btn-danger' : 'btn-secondary'}`}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (hasRoleManageDeletePermission()) {
                                      console.log('Delete button clicked for role:', role);
                                      openDeleteConfirm(role);
                                    } else {
                                      setMessage('You do not have permission to delete roles. Contact a Super Admin for "roles.delete" access.');
                                      setMessageType('error');
                                      setToastVisible(true);
                                      setTimeout(() => setToastVisible(false), 4000);
                                    }
                                  }}
                                  title={hasRoleManageDeletePermission() ? "Delete Role" : "You need 'roles.delete' permission to delete roles"}
                                  style={{ 
                                    padding: '6px 10px', 
                                    fontSize: '12px',
                                    cursor: hasRoleManageDeletePermission() ? 'pointer' : 'not-allowed',
                                    opacity: hasRoleManageDeletePermission() ? 1 : 0.6
                                  }}
                                >
                                  <i className={`bi ${hasRoleManageDeletePermission() ? 'bi-trash' : 'bi-lock'}`}></i> 
                                  Delete
                                  {!hasRoleManageDeletePermission() && <i className="bi bi-exclamation-triangle ml-1" style={{fontSize: '10px'}}></i>}
                                </button>
                              </div>
                            ) : (
                              <span className="text-muted">
                                <i className="bi bi-lock mr-1"></i>
                                No access
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Add Role Modal */}
      {showAddRoleModal && (
        <div className="modal-overlay" onClick={() => setShowAddRoleModal(false)}>
          <div className="modal-content professional-form" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-header" style={{ borderBottom: '2px solid var(--gray-200)', paddingBottom: '12px', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--gray-900)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="bi bi-plus-circle" style={{ color: 'var(--primary)' }}></i>
                Add New Role
              </h3>
              <button 
                className="modal-close btn-professional btn-danger"
                onClick={() => setShowAddRoleModal(false)}
                style={{ padding: '6px 10px', fontSize: '14px' }}
              >
                <i className="bi bi-x"></i>
              </button>
            </div>

            <form onSubmit={handleAddRoleSubmit} className="modal-body">
              <div className="form-group">
                <label className="form-label">Role Name *</label>
                <input
                  type="text"
                  name="roleName"
                  className="form-input"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="e.g., Regional Manager"
                  required
                />
                <small className="text-muted">Only a name is required. We'll create an internal value automatically.</small>
              </div>

              <div className="modal-footer" style={{ borderTop: '2px solid var(--gray-200)', paddingTop: '12px', marginTop: '12px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button 
                  type="button"
                  className="btn-professional btn-secondary"
                  onClick={() => setShowAddRoleModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="btn-professional btn-success"
                >
                  Add Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Role Modal */}
      {showEditRoleModal && (
        <div className="modal-overlay" onClick={() => setShowEditRoleModal(false)}>
          <div className="modal-content professional-form" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-header" style={{ borderBottom: '2px solid var(--gray-200)', paddingBottom: '12px', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--gray-900)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="bi bi-pencil" style={{ color: 'var(--primary)' }}></i>
                Edit Role
              </h3>
              <button 
                className="modal-close btn-professional btn-danger"
                onClick={() => setShowEditRoleModal(false)}
                style={{ padding: '6px 10px', fontSize: '14px' }}
              >
                <i className="bi bi-x"></i>
              </button>
            </div>

            <form onSubmit={handleEditRoleSubmit} className="modal-body">
              <div className="form-group">
                <label className="form-label">Role Name *</label>
                <input
                  type="text"
                  name="roleName"
                  className="form-input"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="e.g., Regional Manager"
                  required
                />
                <small className="text-muted">Update the role name. The internal value will remain the same.</small>
              </div>

              <div className="modal-footer" style={{ borderTop: '2px solid var(--gray-200)', paddingTop: '12px', marginTop: '12px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button 
                  type="button"
                  className="btn-professional btn-secondary"
                  onClick={() => setShowEditRoleModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="btn-professional btn-success"
                >
                  Update Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
          <div className="modal-overlay confirm-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal-content confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
                <h4 className="confirm-title">Confirm Role Deletion</h4>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete the role <strong>"{roleToDelete?.label}"</strong>?</p>
              <p className="text-warning">
                <i className="bi bi-exclamation-triangle"></i>
                This action cannot be undone. Users with this role may lose access to certain features.
              </p>
            </div>
            <div className="modal-footer">
              <button 
                className="btn-professional btn-secondary" 
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>
              <button 
                className="btn-professional btn-danger" 
                onClick={(e) => {
                  e.preventDefault();
                  console.log('Delete confirmation clicked, calling handleDeleteRole');
                  handleDeleteRole();
                }}
              >
                Yes, Delete Role
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="modal-overlay" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 9999 }}>
          <div className="modal-content success-modal-content" onClick={(e) => e.stopPropagation()} style={{ 
            maxWidth: '500px', 
            textAlign: 'center',
            border: '3px solid #28a745',
            borderRadius: '15px',
            background: 'linear-gradient(135deg, #f8f9fa, #e9ecef)',
            boxShadow: '0 10px 30px rgba(40, 167, 69, 0.3)',
            animation: 'fadeInUp 0.3s ease-out'
          }}>
            <div style={{ padding: '30px' }}>
              <div style={{ 
                fontSize: '60px', 
                color: '#28a745', 
                marginBottom: '20px',
                animation: 'bounce 1s ease-in-out'
              }}>
                <i className="bi bi-check-circle-fill"></i>
              </div>
              <h2 style={{ 
                color: '#28a745', 
                marginBottom: '15px',
                fontWeight: 'bold'
              }}>
                Success!
              </h2>
              <p style={{ 
                fontSize: '16px', 
                color: '#495057',
                marginBottom: '25px',
                lineHeight: '1.5'
              }}>
                {successMessage}
              </p>
              <button 
                className="btn-professional btn-success"
                onClick={() => setShowSuccessModal(false)}
                style={{ 
                  padding: '10px 30px',
                  fontSize: '16px',
                  fontWeight: 'bold'
                }}
              >
                <i className="bi bi-check2"></i> Awesome!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoleManagement;
