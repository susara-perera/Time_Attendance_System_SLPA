import React, { useState, useEffect } from 'react';
import usePermission from '../../hooks/usePermission';

const DivisionManagement = () => {
  const [divisions, setDivisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentDivision, setCurrentDivision] = useState(null);
  const [isHrisSource, setIsHrisSource] = useState(true); // Read-only when loading from HRIS API
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    code: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const canView = usePermission('divisions', 'read');
  const canCreate = usePermission('divisions', 'create');
  const canUpdate = usePermission('divisions', 'update');
  const canDelete = usePermission('divisions', 'delete');
  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  // Helpers: robust date parsing for HRIS/Mongo-like payloads
  const formatDateYmd = (d) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const parseHrisDate = (value) => {
    if (!value) return '';
    try {
      if (typeof value === 'string') {
        const asNum = Number(value);
        if (!Number.isNaN(asNum) && value.trim() !== '') {
          const d = new Date(asNum);
          return Number.isNaN(d) ? '' : formatDateYmd(d);
        }
        const d = new Date(value);
        return Number.isNaN(d) ? '' : formatDateYmd(d);
      }
      if (typeof value === 'number') {
        const d = new Date(value);
        return Number.isNaN(d) ? '' : formatDateYmd(d);
      }
      if (typeof value === 'object') {
        if (value.$date) {
          const v = value.$date;
          if (typeof v === 'object' && v.$numberLong) {
            const d = new Date(Number(v.$numberLong));
            return Number.isNaN(d) ? '' : formatDateYmd(d);
          }
          if (typeof v === 'string' || typeof v === 'number') {
            const d = new Date(v);
            return Number.isNaN(d) ? '' : formatDateYmd(d);
          }
        }
        if (value.$numberLong) {
          const d = new Date(Number(value.$numberLong));
          return Number.isNaN(d) ? '' : formatDateYmd(d);
        }
      }
    } catch (_) {
      return '';
    }
    return '';
  };

  // Helper: normalize text for case-insensitive comparisons
  const normalizeTextKey = (s) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().toLowerCase() : '');

  // Fetch divisions from HRIS API (read-only display)
  const fetchDivisions = async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        console.error('No authentication token found');
        setLoading(false);
        return;
      }

      console.log('Fetching divisions from HRIS API...');
      const response = await fetch(`${API_BASE_URL}/divisions/hris`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('HRIS API Response:', data);
        const rows = Array.isArray(data?.data) ? data.data : [];
        // Normalize to local shape expected by the table
        const normalized = rows.map((d) => ({
          _id: String(d?._id ?? d?.id ?? d?.DIVISION_ID ?? d?.code ?? d?.hie_code ?? d?.DIVISION_CODE ?? ''),
          code: String(d?.code ?? d?.DIVISION_CODE ?? d?.hie_code ?? ''),
          name: d?.name ?? d?.DIVISION_NAME ?? d?.hie_name ?? d?.hie_relationship ?? 'Unknown Division',
          isActive: typeof d?.isActive === 'boolean' ? d.isActive : (typeof d?.active === 'boolean' ? d.active : true),
          employeeCount: d?.employeeCount ?? d?.count ?? undefined,
          createdAt: d?.createdAt ?? d?.created_at ?? d?.CREATED_AT ?? d?.createdOn ?? d?.CREATED_ON ?? null,
        })).sort((a, b) => a.name.localeCompare(b.name));
        setDivisions(normalized);
        setIsHrisSource(true);
      } else {
        console.error('Failed to fetch divisions:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('Error details:', errorText);
        setDivisions([]);
      }
    } catch (error) {
      console.error('Error fetching divisions:', error);
      setDivisions([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error for this field
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  // Validate form
  const validateForm = () => {
    const errors = {};
    if (!formData.name.trim()) {
      errors.name = 'Division name is required';
    }
    
    if (!formData.code.trim()) {
      errors.code = 'Division code is required';
    }
    
    return errors;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = validateForm();
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const url = currentDivision 
        ? `http://localhost:5000/api/divisions/${currentDivision._id}`
        : 'http://localhost:5000/api/divisions';
      
      // Prepare the data
      const submitData = {
        name: formData.name.trim(),
        code: formData.code.trim()
      };

      console.log('Submitting division data:', submitData);
      console.log('Using URL:', url);
      console.log('Method:', currentDivision ? 'PUT' : 'POST');
      
      const response = await fetch(url, {
        method: currentDivision ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(submitData)
      });

      console.log('Response status:', response.status);
      
      if (response.ok) {
        const responseData = await response.json();
        console.log('Success response:', responseData);
        await fetchDivisions(); // Refresh the list
        handleCloseModal();
        alert(currentDivision ? 'Division updated successfully!' : 'Division created successfully!');
      } else {
        const errorData = await response.json();
        console.error('Error response:', errorData);
        
        // Handle validation errors specifically
        if (errorData.errors && Array.isArray(errorData.errors)) {
          const errorMessages = errorData.errors.map(err => `${err.field}: ${err.message}`).join('\n');
          alert(`Validation failed:\n${errorMessages}`);
        } else {
          alert(errorData.message || `Failed to ${currentDivision ? 'update' : 'add'} division`);
        }
      }
    } catch (error) {
      console.error('Error submitting division:', error);
      alert(`Error ${currentDivision ? 'updating' : 'adding'} division. Please try again.`);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle opening edit modal
  const handleEdit = (division) => {
    console.log('Editing division:', division);
    setCurrentDivision(division);
    setFormData({
      name: division.name || '',
      code: division.code || ''
    });
    setFormErrors({});
    setShowEditModal(true);
    console.log('Form data set to:', { name: division.name, code: division.code });
  };

  // Handle delete division
  const handleDelete = async (division) => {
    if (window.confirm(`Are you sure you want to delete "${division.name}" division? This action cannot be undone.`)) {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`http://localhost:5000/api/divisions/${division._id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        });

        if (response.ok) {
          await fetchDivisions(); // Refresh the list
          alert('Division deleted successfully!');
        } else {
          const errorData = await response.json();
          alert(errorData.message || 'Failed to delete division');
        }
      } catch (error) {
        console.error('Error deleting division:', error);
        alert('Error deleting division. Please try again.');
      }
    }
  };

  // Handle opening add modal
  const handleAdd = () => {
    setCurrentDivision(null);
    setFormData({ name: '', code: '' });
    setFormErrors({});
    setShowAddModal(true);
  };

  // Handle closing modals
  const handleCloseModal = () => {
    setShowAddModal(false);
    setShowEditModal(false);
    setCurrentDivision(null);
    setFormData({ name: '', code: '' });
    setFormErrors({});
  };

  // Use effect to fetch divisions on component mount
  useEffect(() => {
    fetchDivisions();
  }, []);

  if (loading) {
    return <div className="loading-container">Loading...</div>;
  }

  if (!canView) {
    return (
      <div className="division-management">
        <div className="section-header">
          <h2><i className="bi bi-building"></i> Division Management</h2>
        </div>
        <div className="professional-card">
          <div className="no-data">
            <p>You do not have permission to view divisions. Contact a Super Admin for access.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="division-management">
      <div className="section-header">
        <h2><i className="bi bi-building"></i> Division Management</h2>
      </div>

      {/* Unified Search Section */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        background: '#fff',
        borderRadius: '16px',
        boxShadow: '0 2px 12px rgba(102,126,234,0.07)',
        padding: '28px 32px',
        marginBottom: '28px',
        gap: '32px',
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 320 }}>
          <label htmlFor="divisionSearch" className="form-label m-0" style={{ fontWeight: 600, color: '#374151', fontSize: '16px' }}>
            Search:
          </label>
          <input
            id="divisionSearch"
            type="text"
            className="form-control"
            placeholder="Search by Division Code or Name"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              maxWidth: '360px',
              fontSize: '15px',
              borderRadius: '8px',
              border: '2px solid #e0e7ff',
              background: '#f8fafc',
              color: '#374151',
              fontWeight: 500,
              boxShadow: '0 1px 4px rgba(102,126,234,0.04)',
              padding: '10px 18px',
              outline: 'none',
              transition: 'border 0.2s',
            }}
          />
        </div>
      </div>

      {/* Professional Divisions Table */}
      <div className="professional-card">
        <div className="table-responsive">
          <table className="professional-table">
            <thead>
              <tr>
                <th>Division Code</th>
                <th>Division Name</th>
                <th>Status</th>
                <th>Created Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(divisions.filter(d => {
                const q = normalizeTextKey(searchQuery);
                if (!q) return true;
                const codeKey = normalizeTextKey(d.code || '');
                const nameKey = normalizeTextKey(d.name || '');
                return codeKey.includes(q) || nameKey.includes(q);
              })).map(division => (
                <tr key={division._id || division.code || division.name}>
                  <td>
                    <span className="role-badge role-admin">
                      {division.code}
                    </span>
                  </td>
                  <td><strong>{division.name}</strong></td>
                  <td>
                    <span className={`status-badge ${division.isActive ? 'status-active' : 'status-inactive'}`}>
                      {division.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>{division.createdAt ? (parseHrisDate(division.createdAt) || 'N/A') : 'N/A'}</td>
                  <td>
                    <button
                      className="btn-professional btn-info"
                      onClick={() => setCurrentDivision(division)}
                      title="View Division Details"
                      style={{ padding: '8px 14px', fontSize: '13px', fontWeight: 600, color: '#2563eb', background: '#e0e7ff', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <i className="bi bi-eye"></i> View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {divisions.length === 0 && (
          <div className="no-data">
            <p>No divisions found. Click "Add Division" to create the first division.</p>
          </div>
        )}
      </div>

      {/* View Division Modal */}
      {currentDivision && (
        <div className="modal-overlay" onClick={() => setCurrentDivision(null)}>
          <div className="modal-content professional-form" onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ borderBottom: '2px solid var(--gray-200)', paddingBottom: '20px', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--gray-900)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <i className="bi bi-eye"></i>
                Division Details
              </h3>
              <button
                className="modal-close btn-professional btn-danger"
                onClick={() => setCurrentDivision(null)}
                style={{ padding: '8px 12px', fontSize: '16px' }}
              >
                <i className="bi bi-x"></i>
              </button>
            </div>
            <div className="modal-body" style={{ fontSize: '16px', color: '#222', padding: '8px 0 0 0' }}>
              {Object.entries(currentDivision).map(([key, value]) => {
                // Format key to readable label
                const label = key
                  .replace(/([A-Z])/g, ' $1')
                  .replace(/^./, str => str.toUpperCase())
                  .replace(/_/g, ' ');
                let displayValue = value;
                if (key.toLowerCase().includes('date') && value) {
                  displayValue = parseHrisDate(value) || value;
                }
                if (typeof value === 'boolean') {
                  displayValue = value ? 'Yes' : 'No';
                }
                if (typeof value === 'object' && value !== null) {
                  displayValue = <pre style={{ background: '#f3f4f6', padding: '8px', borderRadius: '6px', fontSize: '14px', overflowX: 'auto' }}>{JSON.stringify(value, null, 2)}</pre>;
                }
                return (
                  <div key={key} style={{ marginBottom: '18px' }}>
                    <strong>{label}:</strong> {displayValue}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DivisionManagement;