import React, { useState, useEffect } from 'react';
import usePermission from '../../hooks/usePermission';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    employeeId: '',
    role: 'employee',
    password: '',
    confirmPassword: '',
    division: '',
    section: ''
  });
  const [divisions, setDivisions] = useState([]);
  const [sections, setSections] = useState([]);
  const canViewUsers = usePermission('users', 'read');
  const canCreateUser = usePermission('users', 'create');
  const canUpdateUser = usePermission('users', 'update');
  const canDeleteUser = usePermission('users', 'delete');

  // Helper function to get division name by ID
  const getDivisionName = (divisionId) => {
    if (!divisionId) return 'N/A';
    const division = divisions.find(div => 
      (div._id || div.id) === divisionId || 
      div._id === divisionId || 
      div.id === divisionId
    );
    return division ? (division.name || 'Unknown Division') : 'N/A';
  };

  // Helper function to get section name by ID
  const getSectionName = (sectionId) => {
    if (!sectionId) return 'N/A';
    const section = sections.find(sec => 
      (sec._id || sec.id) === sectionId || 
      sec._id === sectionId || 
      sec.id === sectionId
    );
    return section ? (section.name || 'Unknown Section') : 'N/A';
  };

  useEffect(() => {
    // Fetch users and divisions from API
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        
        // Fetch users from database
        try {
          const usersResponse = await fetch('http://localhost:5000/api/users', {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (usersResponse.ok) {
            const usersData = await usersResponse.json();
            console.log('Users API Response:', usersData); // Debug log
            
            // Handle the response structure properly
            const users = usersData.data || usersData || [];
            
            // Map the data to match frontend structure
            const mappedUsers = users.map(user => {
              console.log('Mapping user:', user); // Debug log
              return {
                id: user._id || user.id,
                firstName: user.firstName || '',
                lastName: user.lastName || '',
                email: user.email || '',
                role: user.role || 'employee',
                employeeId: user.employeeId || '',
                status: user.isActive !== false ? 'active' : 'inactive',
                division: user.division?._id || user.division || '',
                section: user.section?._id || user.section || '',
                divisionName: user.division?.name || 'N/A',
                sectionName: user.section?.name || 'N/A'
              };
            });
            
            console.log('Mapped users:', mappedUsers); // Debug log
            setUsers(mappedUsers);
          } else {
            console.error('Failed to fetch users, status:', usersResponse.status);
            const errorText = await usersResponse.text();
            console.error('Error response:', errorText);
            setUsers([]);
          }
        } catch (userError) {
          console.error('Error fetching users:', userError);
          setUsers([]);
        }
        
        // Fetch divisions from database
        try {
          const divisionsResponse = await fetch('http://localhost:5000/api/divisions?limit=1000', {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (divisionsResponse.ok) {
            const divisionsData = await divisionsResponse.json();
            console.log('Divisions API Response:', divisionsData); // Debug log
            
            // Handle different response structures
            const divisions = divisionsData.data || divisionsData || [];
            console.log('Divisions array:', divisions); // Debug log
            setDivisions(divisions);
          } else {
            console.error('Failed to fetch divisions, status:', divisionsResponse.status);
            const errorText = await divisionsResponse.text();
            console.error('Divisions error response:', errorText);
            setDivisions([]);
          }
        } catch (divisionError) {
          console.error('Error fetching divisions:', divisionError);
          setDivisions([]);
        }

        // Fetch sections from database
        try {
          const sectionsResponse = await fetch('http://localhost:5000/api/sections?limit=1000', {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (sectionsResponse.ok) {
            const sectionsData = await sectionsResponse.json();
            console.log('Sections API Response:', sectionsData); // Debug log
            
            // Handle different response structures
            const sections = sectionsData.data || sectionsData || [];
            console.log('Sections array:', sections); // Debug log
            setSections(sections);
          } else {
            console.error('Failed to fetch sections, status:', sectionsResponse.status);
            const errorText = await sectionsResponse.text();
            console.error('Sections error response:', errorText);
            setSections([]);
          }
        } catch (sectionError) {
          console.error('Error fetching sections:', sectionError);
          setSections([]);
        }
        
        setLoading(false);
        
      } catch (error) {
        console.error('Error fetching data:', error);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleAddUser = () => {
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      employeeId: '',
      role: 'employee',
      password: '',
      confirmPassword: '',
      division: '',
      section: ''
    });
    setEditingUser(null);
    setShowAddModal(true);
  };

  const handleEditUser = (user) => {
    setFormData({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      employeeId: user.employeeId,
      role: user.role,
      password: '',
      confirmPassword: '',
      division: user.division || '',
      section: user.section || ''
    });
    setEditingUser(user);
    setShowAddModal(true);
  };

  const handleDeleteUser = async (userId) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`http://localhost:5000/api/users/${userId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          setUsers(users.filter(user => user.id !== userId));
          alert('User deleted successfully!');
        } else {
          const error = await response.json();
          alert(error.message || 'Failed to delete user');
        }
      } catch (error) {
        console.error('Error deleting user:', error);
        alert('Error deleting user. Please try again.');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Enforce front-end permission check as a safeguard
    if (!canCreateUser && !editingUser) {
      alert('You do not have permission to create users.');
      return;
    }
    
    // Check if passwords match when adding a new user
    if (!editingUser && formData.password !== formData.confirmPassword) {
      alert('Passwords do not match!');
      return;
    }
    
    // Validate required fields
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.employeeId || !formData.role) {
      alert('Please fill in all required fields!');
      return;
    }
    
    if (!editingUser && !formData.password) {
      alert('Password is required for new users!');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const userData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        employeeId: formData.employeeId,
        role: formData.role,
        division: formData.division || undefined,
        section: formData.section || undefined
      };

      if (!editingUser) {
        userData.password = formData.password;
      } else if (formData.password) {
        userData.password = formData.password;
      }

      let response;
      if (editingUser) {
        // Update existing user
        response = await fetch(`http://localhost:5000/api/users/${editingUser.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(userData)
        });
      } else {
        // Create new user
        response = await fetch('http://localhost:5000/api/users', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(userData)
        });
      }

      if (response.ok) {
        const result = await response.json();
        
        if (editingUser) {
          // Update existing user in state
          setUsers(users.map(user => 
            user.id === editingUser.id 
              ? {
                  ...user,
                  firstName: formData.firstName,
                  lastName: formData.lastName,
                  email: formData.email,
                  employeeId: formData.employeeId,
                  role: formData.role,
                  division: formData.division,
                  section: formData.section
                }
              : user
          ));
        } else {
          // Add new user to state
          const newUser = {
            id: result.data._id,
            firstName: formData.firstName,
            lastName: formData.lastName,
            email: formData.email,
            employeeId: formData.employeeId,
            role: formData.role,
            status: 'active',
            division: formData.division,
            section: formData.section
          };
          setUsers([...users, newUser]);
        }
        
        setShowAddModal(false);
        setEditingUser(null);
        alert(editingUser ? 'User updated successfully!' : 'User created successfully!');
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to save user');
      }
    } catch (error) {
      console.error('Error saving user:', error);
      alert('Error saving user. Please try again.');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (!canViewUsers) {
    return (
      <div className="user-management">
        <div className="section-header">
          <h2><i className="bi bi-people"></i> User Management</h2>
        </div>
        <div className="professional-card">
          <div className="no-data">
            <p>You do not have permission to view users. Contact a Super Admin for access.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="user-management">
      {/* Professional Section Header */}
      <div className="section-header">
        <h2><i className="bi bi-people"></i> User Management</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button 
            className="btn-professional btn-primary"
            onClick={canCreateUser ? handleAddUser : undefined}
            title={!canCreateUser ? 'You do not have permission to add users' : 'Add User'}
            disabled={!canCreateUser}
            style={{ cursor: canCreateUser ? 'pointer' : 'not-allowed' }}
          >
            <i className="bi bi-plus-circle"></i> Add User
          </button>
        </div>
      </div>

      {/* Professional Users Table */}
      <div className="professional-card">
        <div className="table-responsive">
          <table className="professional-table">
            <thead>
              <tr>
                <th>Employee ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Division</th>
                <th>Section</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id}>
                  <td><strong>{user.employeeId}</strong></td>
                  <td>{`${user.firstName} ${user.lastName}`}</td>
                  <td>{user.email}</td>
                  <td>
                    <span className={`role-badge role-${user.role.replace('_', '-')}`}>
                      {user.role.replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                  <td>{user.divisionName || (user.division?.name) || getDivisionName(user.division) || 'N/A'}</td>
                  <td>{user.sectionName || (user.section?.name) || getSectionName(user.section) || 'N/A'}</td>
                  <td>
                    <span className={`status-badge status-${user.status}`}>
                      {user.status.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        className="btn-professional btn-primary"
                        onClick={canUpdateUser ? () => handleEditUser(user) : undefined}
                        title={!canUpdateUser ? 'No permission to edit users' : 'Edit User'}
                        disabled={!canUpdateUser}
                        style={{ padding: '8px 12px', fontSize: '12px', cursor: canUpdateUser ? 'pointer' : 'not-allowed' }}
                      >
                        <i className="bi bi-pencil"></i>
                      </button>
                      <button 
                        className="btn-professional btn-danger"
                        onClick={canDeleteUser ? () => handleDeleteUser(user.id) : undefined}
                        title={!canDeleteUser ? 'No permission to delete users' : 'Delete User'}
                        disabled={!canDeleteUser}
                        style={{ padding: '8px 12px', fontSize: '12px', cursor: canDeleteUser ? 'pointer' : 'not-allowed' }}
                      >
                        <i className="bi bi-trash"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {users.length === 0 && (
          <div className="no-data">
            <p>No users found. Click "Add User" to create the first user.</p>
          </div>
        )}
      </div>

      {/* Professional Add/Edit User Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content professional-form" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ borderBottom: '2px solid var(--gray-200)', paddingBottom: '20px', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--gray-900)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <i className="bi bi-person-plus" style={{ color: 'var(--primary)' }}></i>
                {editingUser ? 'Edit User' : 'Add New User'}
              </h3>
              <button 
                className="modal-close btn-professional btn-danger"
                onClick={() => setShowAddModal(false)}
                style={{ padding: '8px 12px', fontSize: '16px' }}
              >
                <i className="bi bi-x"></i>
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="modal-body">
              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div className="form-group">
                  <label className="form-label">First Name *</label>
                  <input
                    type="text"
                    name="firstName"
                    className="form-input"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Last Name *</label>
                  <input
                    type="text"
                    name="lastName"
                    className="form-input"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>

              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div className="form-group">
                  <label className="form-label">Email *</label>
                  <input
                    type="email"
                    name="email"
                    className="form-input"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="user@slpa.lk"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Employee ID *</label>
                  <input
                    type="text"
                    name="employeeId"
                    className="form-input"
                    value={formData.employeeId}
                    onChange={handleInputChange}
                    placeholder="e.g., EMP001"
                    required
                  />
                </div>
              </div>

              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div className="form-group">
                  <label className="form-label">Division *</label>
                  <select
                    name="division"
                    className="form-select"
                    value={formData.division}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">Select Division</option>
                    {divisions.map(division => (
                      <option key={division._id || division.id} value={division._id || division.id}>
                        {division.name} ({division.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Role *</label>
                  <select
                    name="role"
                    className="form-select"
                    value={formData.role}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="employee">Employee</option>
                    <option value="administrative_clerk">Administrative Clerk</option>
                    <option value="clerk">Clerk</option>
                    <option value="admin">Administrator</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Section</label>
                <select
                  name="section"
                  className="form-select"
                  value={formData.section}
                  onChange={handleInputChange}
                >
                  <option value="">Select Section</option>
                  {sections.map(section => (
                    <option key={section._id || section.id} value={section._id || section.id}>
                      {section.name} ({section.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div className="form-group">
                  <label className="form-label">Password {!editingUser && '*'}</label>
                  <input
                    type="password"
                    name="password"
                    className="form-input"
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder={editingUser ? "Leave blank to keep current password" : "Enter password"}
                    required={!editingUser}
                    minLength="1"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Confirm Password {!editingUser && '*'}</label>
                  <input
                    type="password"
                    name="confirmPassword"
                    className="form-input"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    placeholder={editingUser ? "Leave blank to keep current password" : "Confirm password"}
                    required={!editingUser}
                    minLength="1"
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ borderTop: '2px solid var(--gray-200)', paddingTop: '20px', marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button 
                  type="button"
                  className="btn-professional btn-secondary"
                  onClick={() => setShowAddModal(false)}
                  style={{ background: 'var(--gray-500)' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="btn-professional btn-success"
                  disabled={!canCreateUser && !editingUser}
                  aria-disabled={!canCreateUser && !editingUser}
                  title={!canCreateUser && !editingUser ? 'You do not have permission to add users' : ''}
                >
                  <i className="bi bi-check-circle"></i>
                  {editingUser ? 'Update User' : (canCreateUser ? 'Add User' : 'No permission')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;