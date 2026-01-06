import React, { useState, useEffect } from 'react';
import usePermission from '../../hooks/usePermission';
import { useLanguage } from '../../context/LanguageContext';
import './DivisionManagement.css';

const DivisionManagement = () => {
  const [divisions, setDivisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentDivision, setCurrentDivision] = useState(null);
  const [isHrisSource, setIsHrisSource] = useState(true); // Read-only when loading from HRIS API
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState('name_asc'); // name_asc, name_desc, id_asc, id_desc
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
  const { t } = useLanguage();

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

  // Fetch divisions from MySQL sync table (fallback to legacy HRIS endpoint)
  const fetchDivisions = async () => {
    try {
      const token = localStorage.getItem('token');

      // Primary: Use fast MySQL sync data (no auth required)
      // Fallback: Use HRIS endpoint (may require auth)
      const endpoints = [
        `${API_BASE_URL}/mysql-data/divisions`,  // Fast MySQL sync (no auth)
        `${API_BASE_URL}/divisions/hris`         // Legacy HRIS (may require auth)
      ];

      let response;
      let data = null;
      let successfulUrl = null;

      for (const url of endpoints) {
        console.log(`Fetching divisions from ${url}...`);
        try {
          // MySQL endpoint doesn't require auth, HRIS might
          const headers = {
            'Content-Type': 'application/json'
          };

          if (url.includes('/hris') && token) {
            headers['Authorization'] = `Bearer ${token}`;
          }

          response = await fetch(url, {
            headers: headers,
            credentials: 'include'
          });

          if (response.ok) {
            data = await response.json();
            console.log('Divisions API Response:', data);
            successfulUrl = url;
            setIsHrisSource(url.includes('/hris'));
            break;
          } else {
            const errorText = await response.text();
            console.warn(`Division fetch failed at ${url}:`, response.status, response.statusText, errorText);
          }
        } catch (err) {
          console.error(`Error fetching from ${url}:`, err);
        }
      }

      if (!data || !data.data) {
        console.error('No division data received from any endpoint');
        setDivisions([]);
        setLoading(false);
        return;
      }

      const rows = Array.isArray(data?.data) ? data.data : [];
      // Normalize to local shape expected by the table
      // Handle both MySQL sync data and HRIS data formats
      const normalized = rows.map((d) => ({
        _id: String(d?._id ?? d?.id ?? d?.DIVISION_ID ?? d?.code ?? d?.hie_code ?? d?.DIVISION_CODE ?? d?.HIE_CODE ?? ''),
        code: String(d?.code ?? d?.DIVISION_CODE ?? d?.hie_code ?? d?.HIE_CODE ?? ''),
        name: d?.name ?? d?.DIVISION_NAME ?? d?.hie_name ?? d?.HIE_NAME ?? d?.hie_relationship ?? 'Unknown Division',
        nameSinhala: d?.HIE_NAME_SINHALA ?? d?.name_sinhala ?? '',
        nameTamil: d?.HIE_NAME_TAMIL ?? d?.name_tamil ?? '',
        isActive: typeof d?.isActive === 'boolean' ? d.isActive : (typeof d?.active === 'boolean' ? d.active : (d?.STATUS === 'ACTIVE')),
        employeeCount: d?.employeeCount ?? d?.count ?? undefined,
        createdAt: d?.createdAt ?? d?.created_at ?? d?.CREATED_AT ?? d?.createdOn ?? d?.CREATED_ON ?? d?.synced_at ?? null,
        source: d?.source ?? (successfulUrl?.includes('/mysql-data') ? 'MySQL Sync' : 'HRIS')
      })).sort((a, b) => a.name.localeCompare(b.name));
      setDivisions(normalized);
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
    return <div className="loading-container">{t('loading')}</div>;
  }

  if (!canView) {
    return (
      <div className="division-management">
        <div style={{
          background: 'linear-gradient(135deg, #1e40af 0%, #2563eb 50%, #3b82f6 100%)',
          borderRadius: '20px',
          padding: '32px 40px',
          marginBottom: '28px',
          color: '#fff',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 10px 40px rgba(30, 64, 175, 0.3)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <i className="bi bi-building" style={{ fontSize: '28px' }}></i>
            <h2 style={{ margin: 0, fontSize: '28px', fontWeight: 700 }}>{t('divisionManagementTitle')}</h2>
          </div>
        </div>
        <div className="professional-card">
          <div className="no-data">
            <p>{t('noPermissionViewDivisions')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="division-management">
      {/* Professional Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #1e40af 0%, #2563eb 50%, #3b82f6 100%)',
        borderRadius: '20px',
        padding: '32px 40px',
        marginBottom: '28px',
        color: '#fff',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 10px 40px rgba(30, 64, 175, 0.3)'
      }}>
        <div style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              background: 'rgba(255,255,255,0.2)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <i className="bi bi-building" style={{ fontSize: '24px' }}></i>
            </div>
            <h2 style={{ margin: 0, fontSize: '28px', fontWeight: 700 }}>{t('divisionManagementTitle')}</h2>
          </div>
          <p style={{ margin: 0, opacity: 0.85, fontSize: '15px' }}>
            Manage organizational divisions and view division details
          </p>
        </div>
        <div style={{
          position: 'absolute',
          right: '30px',
          top: '50%',
          transform: 'translateY(-50%)',
          opacity: 0.1,
          fontSize: '120px'
        }}>
          <i className="bi bi-buildings"></i>
        </div>
      </div>

      {/* Search and Filter Section */}
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
            {t('divisionSearchLabel')}
          </label>
            <select
              id="divisionSort"
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value)}
              style={{
                fontSize: '14px',
                borderRadius: '8px',
                border: '2px solid #e0e7ff',
                background: '#fff',
                color: '#374151',
                fontWeight: 600,
                boxShadow: '0 1px 4px rgba(102,126,234,0.04)',
                padding: '8px 12px',
                outline: 'none',
                marginRight: '8px'
              }}
            >
              <option value="name_asc">Name A → Z</option>
              <option value="name_desc">Name Z → A</option>
              <option value="id_asc">ID Small → High</option>
              <option value="id_desc">ID High → Small</option>
            </select>

          <input
            id="divisionSearch"
            type="text"
            className="form-control"
            placeholder={t('divisionSearchPlaceholder')}
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
                <th>Division ID</th>
                <th>Division</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const q = normalizeTextKey(searchQuery);
                const filtered = !q ? divisions : divisions.filter(d => {
                  const codeKey = normalizeTextKey(d.code || '');
                  const nameKey = normalizeTextKey(d.name || '');
                  return codeKey.includes(q) || nameKey.includes(q);
                });

                const getName = (x) => String(x?.name || '').toLowerCase();
                const getIdNum = (x) => {
                  const v = x?.code ?? x?._id ?? '';
                  const n = Number(String(v).replace(/[^0-9.-]/g, ''));
                  return Number.isFinite(n) ? n : String(v);
                };

                const sorted = filtered.slice().sort((a, b) => {
                  if (sortOption === 'name_asc') return getName(a).localeCompare(getName(b));
                  if (sortOption === 'name_desc') return getName(b).localeCompare(getName(a));
                  if (sortOption === 'id_asc') {
                    const ai = getIdNum(a); const bi = getIdNum(b);
                    if (typeof ai === 'number' && typeof bi === 'number') return ai - bi;
                    return String(ai).localeCompare(String(bi));
                  }
                  if (sortOption === 'id_desc') {
                    const ai = getIdNum(a); const bi = getIdNum(b);
                    if (typeof ai === 'number' && typeof bi === 'number') return bi - ai;
                    return String(bi).localeCompare(String(ai));
                  }
                  return 0;
                });

                return sorted.map(division => (
                <tr key={division._id || division.code || division.name}>
                  <td><span className="division-code">{division.code}</span></td>
                  <td className="division-name">{division.name}</td>
                  <td>
                    <button
                      className="btn-professional btn-info"
                      onClick={() => setCurrentDivision(division)}
                      title={t('viewDivisionDetails')}
                      style={{ padding: '8px 12px', fontSize: '13px', fontWeight: 600, color: '#2563eb', background: '#e0e7ff', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <i className="bi bi-eye"></i> {t('viewLabel')}
                    </button>
                  </td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>

          {divisions.length === 0 && (
            <div className="no-data">
              <p>{t('noDivisionsFoundMsg')}</p>
            </div>
          )}
        </div>
      </div>

      {/* View Division Modal */}
      {currentDivision && (
        <div className="dm-modal-overlay" onClick={() => setCurrentDivision(null)}>
          <div className="dm-modal-card" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t('divisionDetailsTitle')}>
            <div className="dm-modal-header">
              <div className="dm-modal-title">
                <i className="bi bi-eye dm-modal-icon" aria-hidden="true"></i>
                <h3>{t('divisionDetailsTitle') || 'Division Details'}</h3>
              </div>
              <button className="dm-modal-close" onClick={() => setCurrentDivision(null)} aria-label={t('close')}>
                <i className="bi bi-x"></i>
              </button>
            </div>

            <div className="dm-modal-body">
              <div className="dm-field">
                <strong className="dm-label">id:</strong>
                <div className="dm-value">{currentDivision._id ?? (currentDivision.id || t('naLabel'))}</div>
              </div>

              <div className="dm-field">
                <strong className="dm-label">Code:</strong>
                <div className="dm-value">{currentDivision.code ?? t('naLabel')}</div>
              </div>

              <div className="dm-field">
                <strong className="dm-label">Name:</strong>
                <div className="dm-value">{currentDivision.name ?? t('naLabel')}</div>
              </div>

              <div className="dm-field">
                <strong className="dm-label">Is Active:</strong>
                <div className="dm-value">{typeof currentDivision.isActive === 'boolean' ? (currentDivision.isActive ? t('yesLabel') || 'Yes' : t('noLabel') || 'No') : t('naLabel')}</div>
              </div>

              <div className="dm-field">
                <strong className="dm-label">Employee Count:</strong>
                <div className="dm-value">{currentDivision.employeeCount ?? 0}</div>
              </div>

              <div className="dm-field">
                <strong className="dm-label">Created At:</strong>
                <div className="dm-value">{currentDivision.createdAt ? (parseHrisDate(currentDivision.createdAt) || String(currentDivision.createdAt)) : t('naLabel')}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DivisionManagement;