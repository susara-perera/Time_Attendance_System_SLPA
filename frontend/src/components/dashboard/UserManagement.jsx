import React, { useState, useEffect } from 'react';
import usePermission from '../../hooks/usePermission';
import { useLanguage } from '../../context/LanguageContext';
import './UserManagement.css';
import PageHeader from './PageHeader';

const UserManagement = ({ onBack }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    employeeId: '',
    role: '',
    password: '',
    confirmPassword: '',
    division: '',
    section: '',
    subsection: ''
  });
  const [divisions, setDivisions] = useState([]);
  const [sections, setSections] = useState([]);
  const [availableSections, setAvailableSections] = useState([]);
  const [subsections, setSubsections] = useState([]);
  const [availableSubsections, setAvailableSubsections] = useState([]);
  const [roles, setRoles] = useState([]);
  const canViewUsers = usePermission('users', 'read');
  const canCreateUser = usePermission('users', 'create');
  const canUpdateUser = usePermission('users', 'update');
  const canDeleteUser = usePermission('users', 'delete');
  const { t } = useLanguage();

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

  // Helper to sanitize section display name (removes IDs/codes and counts in parentheses)
  const formatSectionName = (name) => {
    if (!name) return '';
    // Remove any parenthetical groups e.g. "(IS)" or "(333)"
    let cleaned = String(name).replace(/\s*\([^)]*\)/g, '').trim();
    // Remove trailing hyphen if left behind e.g. "Administration -"
    cleaned = cleaned.replace(/\s*-\s*$/, '').trim();
    return cleaned;
  };

  useEffect(() => {
    // Fetch users and divisions from API
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
        
        // Fetch users from database
        try {
          const usersResponse = await fetch(`${API_BASE_URL}/users`, {
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
                divisionName: user.division?.name || '',
                sectionName: user.section?.name || '',
                // Keep display values separate
                divisionDisplay: user.division?.name || 'N/A',
                sectionDisplay: user.section?.name || 'N/A'
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
        
        // Fetch divisions from MySQL (faster and more reliable)
        try {
          const divisionsResponse = await fetch(`${API_BASE_URL}/mysql-data/divisions`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (divisionsResponse.ok) {
            const divisionsData = await divisionsResponse.json();
            console.log('Divisions HRIS API Response:', divisionsData); // Debug log
            
            // Handle different response structures and normalize
            const rawDivisions = divisionsData.data || divisionsData || [];
            console.log('Raw divisions:', rawDivisions.length); // Debug log
            
            // Normalize divisions to consistent format
            const normalizedDivisions = rawDivisions.map(d => ({
              _id: d._id || d.id || d.HIE_CODE || d.code,
              id: d._id || d.id || d.HIE_CODE || d.code,
              code: d.code || d.HIE_CODE || d.hie_code || d._id || d.id,
              name: d.name || d.HIE_NAME || d.hie_name || d.hie_relationship || 'Unknown Division',
              hie_relationship: d.hie_relationship || d.HIE_RELATIONSHIP,
              isActive: d.isActive !== false
            })).sort((a, b) => a.name.localeCompare(b.name));
            
            console.log('Normalized divisions:', normalizedDivisions); // Debug log
            setDivisions(normalizedDivisions);
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

        // Fetch sections from MySQL (faster and more reliable)
        try {
          const sectionsResponse = await fetch(`${API_BASE_URL}/mysql-data/sections`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (sectionsResponse.ok) {
            const sectionsData = await sectionsResponse.json();
            console.log('Sections HRIS API Response:', sectionsData); // Debug log
            
            // Handle different response structures and normalize
            const rawSections = sectionsData.data || sectionsData || [];
            console.log('Raw sections:', rawSections.length); // Debug log
            
            // Normalize sections to consistent format
            // The sections API returns:
            // - code/HIE_CODE: section's own code
            // - name/HIE_NAME: section name
            // - division_code/HIE_RELATIONSHIP: parent division's CODE (not name)
            const normalizedSections = rawSections.map(s => ({
              _id: s._id || s.id || s.HIE_CODE || s.code,
              id: s._id || s.id || s.HIE_CODE || s.code,
              code: s.code || s.HIE_CODE || s.hie_code || s.section_code || s._id || s.id,
              name: s.name || s.HIE_NAME || s.hie_name || s.section_name || `Section ${s.code}`,
              // division_code is the parent division's HIE_CODE
              divisionCode: s.division_code || s.HIE_RELATIONSHIP || s.divisionCode || '',
              divisionId: s.division_id || s.divisionId || '',
              // These may not be available - need to lookup from divisions
              divisionName: s.division_name || s.divisionName || '',
              hie_relationship: s.hie_relationship || s.HIE_RELATIONSHIP || s.division_code || '',
              isActive: s.isActive !== false
            })).sort((a, b) => a.name.localeCompare(b.name));
            
            console.log('Normalized sections:', normalizedSections); // Debug log
            setSections(normalizedSections);
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

        // Fetch subsections from MySQL
        try {
          const subsectionsResponse = await fetch(`${API_BASE_URL}/mysql-data/subsections`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (subsectionsResponse.ok) {
            const subsectionsData = await subsectionsResponse.json();
            console.log('Subsections API Response:', subsectionsData); // Debug log
            
            // Handle different response structures and normalize
            const rawSubsections = subsectionsData.data || subsectionsData || [];
            console.log('Raw subsections:', rawSubsections.length); // Debug log
            
            // Normalize subsections to consistent format
            const normalizedSubsections = rawSubsections.map(sub => ({
              _id: sub._id || sub.id || sub.sub_code,
              id: sub._id || sub.id || sub.sub_code,
              code: sub.subSection?.sub_hie_code || sub.sub_code || sub.code || sub._id,
              name: sub.subSection?.sub_hie_name || sub.sub_name || sub.name || `Subsection ${sub.code}`,
              sectionId: sub.parentSection?.id || sub.section_id || sub.section_code || '',
              sectionCode: sub.parentSection?.hie_code || sub.section_code || '',
              sectionName: sub.parentSection?.hie_name || sub.section_name || '',
              divisionId: sub.parentDivision?.id || sub.division_id || sub.division_code || '',
              divisionCode: sub.parentDivision?.division_code || sub.division_code || '',
              divisionName: sub.parentDivision?.division_name || sub.division_name || '',
              isActive: sub.isActive !== false
            })).sort((a, b) => a.name.localeCompare(b.name));
            
            console.log('Normalized subsections:', normalizedSubsections); // Debug log
            setSubsections(normalizedSubsections);
          } else {
            console.error('Failed to fetch subsections, status:', subsectionsResponse.status);
            const errorText = await subsectionsResponse.text();
            console.error('Subsections error response:', errorText);
            setSubsections([]);
          }
        } catch (subsectionError) {
          console.error('Error fetching subsections:', subsectionError);
          setSubsections([]);
        }

        // Fetch roles from API
        try {
          const rolesResponse = await fetch(`${API_BASE_URL}/roles`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });

          if (rolesResponse.ok) {
            const rolesData = await rolesResponse.json();
            console.log('Roles API Response:', rolesData); // Debug log

            // Handle the response structure properly
            const roles = rolesData.data || rolesData || [];
            console.log('Fetched roles:', roles); // Debug log
            setRoles(roles);
          } else {
            console.error('Failed to fetch roles, status:', rolesResponse.status);
            const errorText = await rolesResponse.text();
            console.error('Roles error response:', errorText);
            setRoles([]);
          }
        } catch (roleError) {
          console.error('Error fetching roles:', roleError);
          setRoles([]);
        }
        
        setLoading(false);
        
      } catch (error) {
        console.error('Error fetching data:', error);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Filter sections based on selected division
  useEffect(() => {
    if (!formData.division) {
      setAvailableSections([]);
      return;
    }

    // Find the selected division to get its code
    const selectedDivision = divisions.find(d => d.name === formData.division);
    const selectedDivisionCode = selectedDivision?.code || '';
    
    console.log('Selected Division Name:', formData.division);
    console.log('Selected Division Code:', selectedDivisionCode);

    // Filter sections that belong to the selected division (by division code)
    const filteredSections = sections.filter(section => {
      // Section's divisionCode/hie_relationship contains the parent division's CODE
      const sectionParentCode = String(section.divisionCode || section.hie_relationship || '');
      
      // Match by code
      return sectionParentCode === selectedDivisionCode;
    });

    console.log('Filtered Sections:', filteredSections.length);
    setAvailableSections(filteredSections);
  }, [formData.division, sections, divisions]);

  // Filter subsections based on selected section
  useEffect(() => {
    if (!formData.section) {
      setAvailableSubsections([]);
      return;
    }

    // Find the selected section to get its code
    const selectedSection = availableSections.find(s => s.name === formData.section);
    const selectedSectionCode = selectedSection?.code || '';
    
    console.log('Selected Section Name:', formData.section);
    console.log('Selected Section Code:', selectedSectionCode);

    // Filter subsections that belong to the selected section (by section code)
    const filteredSubsections = subsections.filter(subsection => {
      const subsectionParentCode = String(subsection.sectionCode || subsection.sectionId || '');
      return subsectionParentCode === selectedSectionCode;
    });

    console.log('Filtered Subsections:', filteredSubsections.length);
    setAvailableSubsections(filteredSubsections);
  }, [formData.section, subsections, availableSections]);

  // The main filtering useEffect already handles section updates for editing
  // So we don't need a separate useEffect for editing mode

  const handleAddUser = () => {
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      employeeId: '',
      role: '',
      password: '',
      confirmPassword: '',
      division: '',
      section: '',
      subsection: ''
    });
    setEditingUser(null);
    setShowAddModal(true);
  };

  const handleEditUser = (user) => {
    // Only use divisionName/sectionName if they're actual names (not empty)
    const divisionValue = user.divisionName && user.divisionName !== 'N/A' ? user.divisionName : '';
    const sectionValue = user.sectionName && user.sectionName !== 'N/A' ? user.sectionName : '';
    
    console.log('Editing user:', user);
    console.log('Division value for form:', divisionValue);
    console.log('Section value for form:', sectionValue);
    
    setFormData({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      employeeId: user.employeeId,
      role: user.role,
      password: '',
      confirmPassword: '',
      division: divisionValue,
      section: sectionValue
    });
    setEditingUser(user);
    setShowAddModal(true);
  };

  const handleDeleteUser = async (userId) => {
    if (window.confirm(t('confirmDeleteUser'))) {
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
          alert(t('userDeletedSuccess'));
        } else {
          const error = await response.json();
          alert(error.message || t('noUsersFound'));
        }
      } catch (error) {
        console.error('Error deleting user:', error);
        alert(t('userDeletedSuccess'));
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
      alert(t('passwordsDoNotMatch') || 'Passwords do not match!');
      return;
    }
    
    // Validate required fields
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.employeeId || !formData.role) {
      alert(t('pleaseFillRequired') || 'Please fill in all required fields!');
      return;
    }
    
    if (!editingUser && !formData.password) {
      alert(t('passwordRequired') || 'Password is required for new users!');
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
        alert(editingUser ? t('userUpdateSuccess') : t('userCreateSuccess'));
      } else {
        const error = await response.json();
        alert(error.message || (t('failedToSaveUser') || 'Failed to save user'));
      }
    } catch (error) {
      console.error('Error saving user:', error);
      alert(t('failedToSaveUser') || 'Error saving user. Please try again.');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      // If division changes, reset section and subsection to ensure consistency
      if (name === 'division') {
        return {
          ...prev,
          [name]: value,
          section: '',
          subsection: ''
        };
      }
      // If section changes, reset subsection
      if (name === 'section') {
        return {
          ...prev,
          [name]: value,
          subsection: ''
        };
      }
      return {
        ...prev,
        [name]: value
      };
    });
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner-border" role="status">
          <span className="visually-hidden">{t('loading') || 'Loading...'}</span>
        </div>
      </div>
    );
  }

  if (!canViewUsers) {
    return (
      <div className="user-management">
        <PageHeader
          title={t('userManagement')}
          subtitle="User access denied"
          icon="bi-people"
        />
        <div className="professional-card">
          <div className="no-data">
            <p>{t('noPermissionViewUsers')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="user-management">
      {/* Professional Section Header with Logo */}
      <PageHeader
        title={t('userManagement')}
        subtitle="Manage system users and access permissions"
        icon="bi-people"
        onBack={onBack}
        actions={
          <button 
            className="btn-professional btn-primary"
            onClick={canCreateUser ? handleAddUser : undefined}
            title={!canCreateUser ? t('noPermissionAddUser') : t('addUser')}
            disabled={!canCreateUser}
            style={{ cursor: canCreateUser ? 'pointer' : 'not-allowed' }}
          >
            <i className="bi bi-plus-circle"></i> Add User
          </button>
        }
      />

      {/* Professional Users Table */}
      <div className="professional-card">
        <div className="table-responsive">
          <table className="professional-table">
            <thead>
              <tr>
                <th>{t('employeeIdLabel')}</th>
                <th>{t('nameLabel') || 'Name'}</th>
                <th>{t('emailLabel')}</th>
                <th>{t('roleLabel')}</th>
                <th>{t('divisionLabel')}</th>
                <th>{t('sectionLabel')}</th>
                <th>{t('statusLabel') || 'Status'}</th>
                <th>{t('actionsLabel') || 'Actions'}</th>
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
                  <td>{user.divisionDisplay || user.divisionName || (user.division?.name) || getDivisionName(user.division) || 'N/A'}</td>
                  <td>{user.sectionDisplay || user.sectionName || (user.section?.name) || getSectionName(user.section) || 'N/A'}</td>
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
            <p>{t('noUsersFound')}</p>
          </div>
        )}
      </div>

      {/* Professional Add/Edit User Modal */}
      {showAddModal && (
        <div className="user-modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="user-modal-content" onClick={(e) => e.stopPropagation()}>
            {/* Decorative Elements */}
            <div className="user-modal-decoration top-right"></div>
            
            {/* Premium Modal Header */}
            <div className="user-modal-header">
              <div className="user-modal-header-content">
                <div className="user-modal-icon-wrapper">
                  <i className={`bi ${editingUser ? 'bi-person-gear' : 'bi-person-plus-fill'}`}></i>
                </div>
                <div className="user-modal-title-group">
                  <h3 className="user-modal-title">
                    {editingUser ? t('editUser') : t('addNewUser')}
                  </h3>
                  <span className="user-modal-subtitle">
                    {editingUser ? 'Update user information and permissions' : 'Create a new user account'}
                  </span>
                </div>
              </div>
              <button 
                className="user-modal-close-btn"
                onClick={() => setShowAddModal(false)}
                type="button"
              >
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            
            {/* Modal Body with Form */}
            <form onSubmit={handleSubmit}>
              <div className="user-modal-body">
                
                {/* Personal Information Section */}
                <div className="user-form-section">
                  <div className="user-form-section-header">
                    <div className="user-form-section-icon">
                      <i className="bi bi-person"></i>
                    </div>
                    <span className="user-form-section-title">Personal Information</span>
                  </div>
                  
                  <div className="user-form-grid">
                    <div className="user-form-group">
                      <label className="user-form-label">
                        <i className="bi bi-person-badge"></i>
                        {t('firstName')} <span className="required">*</span>
                      </label>
                      <div className="user-input-wrapper">
                        <i className="bi bi-person user-input-icon"></i>
                        <input
                          type="text"
                          name="firstName"
                          className="user-form-input"
                          value={formData.firstName}
                          onChange={handleInputChange}
                          placeholder="Enter first name"
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="user-form-group">
                      <label className="user-form-label">
                        <i className="bi bi-person-badge"></i>
                        {t('lastName')} <span className="required">*</span>
                      </label>
                      <div className="user-input-wrapper">
                        <i className="bi bi-person user-input-icon"></i>
                        <input
                          type="text"
                          name="lastName"
                          className="user-form-input"
                          value={formData.lastName}
                          onChange={handleInputChange}
                          placeholder="Enter last name"
                          required
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="user-form-grid" style={{ marginTop: '20px' }}>
                    <div className="user-form-group">
                      <label className="user-form-label">
                        <i className="bi bi-envelope"></i>
                        {t('emailLabel')} <span className="required">*</span>
                      </label>
                      <div className="user-input-wrapper">
                        <i className="bi bi-envelope user-input-icon"></i>
                        <input
                          type="email"
                          name="email"
                          className="user-form-input"
                          value={formData.email}
                          onChange={handleInputChange}
                          placeholder="user@slpa.lk"
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="user-form-group">
                      <label className="user-form-label">
                        <i className="bi bi-hash"></i>
                        {t('employeeIdLabel')} <span className="required">*</span>
                      </label>
                      <div className="user-input-wrapper">
                        <i className="bi bi-hash user-input-icon"></i>
                        <input
                          type="text"
                          name="employeeId"
                          className="user-form-input"
                          value={formData.employeeId}
                          onChange={handleInputChange}
                          placeholder="e.g., EMP001"
                          required
                        />
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Organization Section */}
                <div className="user-form-section">
                  <div className="user-form-section-header">
                    <div className="user-form-section-icon">
                      <i className="bi bi-building"></i>
                    </div>
                    <span className="user-form-section-title">Organization & Role</span>
                  </div>
                  
                  <div className="user-form-grid">
                    <div className="user-form-group">
                      <label className="user-form-label">
                        <i className="bi bi-diagram-3"></i>
                        {t('divisionLabel')} <span className="required">*</span>
                      </label>
                      <div className="user-input-wrapper">
                        <i className="bi bi-diagram-3 user-input-icon"></i>
                        <select
                          name="division"
                          className="user-form-select"
                          value={formData.division}
                          onChange={handleInputChange}
                          required
                        >
                          <option value="">{t('selectDivision')}</option>
                          {divisions.map(division => (
                            <option key={division._id || division.id || division.name} value={division.name}>
                              {division.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    
                    <div className="user-form-group">
                      <label className="user-form-label">
                        <i className="bi bi-shield-check"></i>
                        {t('roleLabel')} <span className="required">*</span>
                      </label>
                      <div className="user-input-wrapper">
                        <i className="bi bi-shield-check user-input-icon"></i>
                        <select
                          name="role"
                          className="user-form-select"
                          value={formData.role}
                          onChange={handleInputChange}
                          required
                        >
                          <option value="">-- Choose a role --</option>
                          {roles.map(role => (
                            <option key={role.value} value={role.value}>
                              {role.label} - {role.description || 'No description'}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                  
                  <div className="user-form-grid single" style={{ marginTop: '20px' }}>
                    <div className="user-form-group">
                      <label className="user-form-label">
                        <i className="bi bi-collection"></i>
                        {t('sectionLabel')}
                      </label>
                      <div className="user-input-wrapper">
                        <i className="bi bi-collection user-input-icon"></i>
                        <select
                          name="section"
                          className="user-form-select"
                          value={formData.section}
                          onChange={handleInputChange}
                          disabled={!formData.division}
                        >
                          <option value="">
                            {!formData.division 
                              ? 'Select a division first' 
                              : availableSections.length === 0 
                                ? 'No sections available' 
                                : t('selectSection')}
                          </option>
                          {availableSections.map(section => (
                            <option key={section._id || section.id || section.name} value={section.name}>
                              {formatSectionName(section.name)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Subsection Dropdown */}
                  {formData.section && availableSubsections.length > 0 && (
                    <div className="user-form-grid single" style={{ marginTop: '20px' }}>
                      <div className="user-form-group">
                        <label className="user-form-label">
                          <i className="bi bi-diagram-3"></i>
                          Sub-Section
                        </label>
                        <div className="user-input-wrapper">
                          <i className="bi bi-diagram-3 user-input-icon"></i>
                          <select
                            name="subsection"
                            className="user-form-select"
                            value={formData.subsection}
                            onChange={handleInputChange}
                          >
                            <option value="">Select Sub-Section (Optional)</option>
                            {availableSubsections.map(subsection => (
                              <option key={subsection._id || subsection.id} value={subsection.code}>
                                {subsection.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Security Section */}
                <div className="user-form-section">
                  <div className="user-form-section-header">
                    <div className="user-form-section-icon">
                      <i className="bi bi-shield-lock"></i>
                    </div>
                    <span className="user-form-section-title">Security</span>
                  </div>
                  
                  <div className="user-form-grid">
                    <div className="user-form-group">
                      <label className="user-form-label">
                        <i className="bi bi-key"></i>
                        {t('passwordLabel')} {!editingUser && <span className="required">*</span>}
                      </label>
                      <div className="user-input-wrapper">
                        <i className="bi bi-lock user-input-icon"></i>
                        <input
                          type="password"
                          name="password"
                          className="user-form-input"
                          value={formData.password}
                          onChange={handleInputChange}
                          placeholder={editingUser ? "Leave blank to keep current" : "Enter password"}
                          required={!editingUser}
                          minLength="1"
                        />
                      </div>
                    </div>
                    
                    <div className="user-form-group">
                      <label className="user-form-label">
                        <i className="bi bi-key-fill"></i>
                        {t('confirmPasswordLabel')} {!editingUser && <span className="required">*</span>}
                      </label>
                      <div className="user-input-wrapper">
                        <i className="bi bi-lock-fill user-input-icon"></i>
                        <input
                          type="password"
                          name="confirmPassword"
                          className="user-form-input"
                          value={formData.confirmPassword}
                          onChange={handleInputChange}
                          placeholder={editingUser ? "Leave blank to keep current" : "Confirm password"}
                          required={!editingUser}
                          minLength="1"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                
              </div>
              
              {/* Modal Footer */}
              <div className="user-modal-footer">
                <button 
                  type="button"
                  className="user-btn user-btn-cancel"
                  onClick={() => setShowAddModal(false)}
                >
                  <i className="bi bi-x-circle"></i>
                  {t('cancel')}
                </button>
                <button 
                  type="submit"
                  className="user-btn user-btn-submit"
                  disabled={!canCreateUser && !editingUser}
                  title={!canCreateUser && !editingUser ? 'You do not have permission to add users' : ''}
                >
                  <i className={`bi ${editingUser ? 'bi-check-circle-fill' : 'bi-plus-circle-fill'}`}></i>
                  {editingUser ? t('updateUser') : (canCreateUser ? t('addUser') : t('noPermissionAddUser'))}
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