import React, { useState, useEffect } from 'react';
import usePermission from '../../hooks/usePermission';
import { useLanguage } from '../../context/LanguageContext';
import PageHeader from './PageHeader';
import './DivisionManagement.css';

const DivisionManagement = ({ onBack }) => {
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
      }));
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
        <PageHeader
          title={t('divisionManagementTitle')}
          subtitle="Manage organizational divisions and view division details"
          icon="bi-building"
        />
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
      {/* Professional Header with Logo */}
      <PageHeader
        title={t('divisionManagementTitle')}
        subtitle="Manage organizational divisions and view division details"
        icon="bi-building"
        onBack={onBack}
      />

      {/* Search and Filter Section */}
      <div className="dm-controls-section">
        <div className="dm-controls-inner">
          <div className="dm-search-group">
            <label htmlFor="divisionSort" className="dm-label">
              <i className="bi bi-sort-alpha-down"></i> Sort By:
            </label>
            <select
              id="divisionSort"
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value)}
              className="dm-select"
            >
              <option value="name_asc">Name A → Z</option>
              <option value="name_desc">Name Z → A</option>
              <option value="id_asc">ID Small → High</option>
              <option value="id_desc">ID High → Small</option>
            </select>
          </div>

          <div className="dm-search-group dm-search-input-group">
            <i className="bi bi-search dm-search-icon"></i>
            <input
              id="divisionSearch"
              type="text"
              className="dm-search-input"
              placeholder={t('divisionSearchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="dm-stats-badge">
            <i className="bi bi-building"></i>
            <span>{divisions.length} Divisions</span>
          </div>
        </div>
      </div>

      {/* Professional Divisions Table */}
      <div className="dm-table-card">
        <div className="dm-table-wrapper">
          <table className="dm-table">
            <thead>
              <tr>
                <th>
                  <div className="dm-th-content">
                    <i className="bi bi-hash"></i>
                    Division ID
                  </div>
                </th>
                <th>
                  <div className="dm-th-content">
                    <i className="bi bi-building"></i>
                    Division Name
                  </div>
                </th>
                <th>
                  <div className="dm-th-content">
                    <i className="bi bi-gear"></i>
                    Action
                  </div>
                </th>
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

                return sorted.map((division, index) => (
                <tr key={division._id || division.code || division.name} className="dm-table-row" style={{ '--delay': `${index * 0.03}s` }}>
                  <td>
                    <span className="dm-code-badge">{division.code}</span>
                  </td>
                  <td>
                    <div className="dm-name-cell">
                      <span className="dm-division-name">{division.name}</span>
                      {division.isActive !== undefined && (
                        <span className={`dm-status-dot ${division.isActive ? 'active' : 'inactive'}`}></span>
                      )}
                    </div>
                  </td>
                  <td>
                    <button
                      className="dm-view-btn"
                      onClick={() => setCurrentDivision(division)}
                      title={t('viewDivisionDetails')}
                    >
                      <i className="bi bi-eye"></i>
                      <span>{t('viewLabel')}</span>
                    </button>
                  </td>
                </tr>
                ));
              })()}
            </tbody>
          </table>

          {divisions.length === 0 && (
            <div className="dm-no-data">
              <i className="bi bi-folder-x"></i>
              <p>{t('noDivisionsFoundMsg')}</p>
            </div>
          )}
        </div>
      </div>

      {/* View Division Modal - Enhanced Design */}
      {currentDivision && (
        <div className="dm-modal-overlay" onClick={() => setCurrentDivision(null)}>
          <div className="dm-modal-container" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t('divisionDetailsTitle')}>
            {/* Modal Header */}
            <div className="dm-modal-header-enhanced">
              <div className="dm-modal-header-content">
                <div className="dm-modal-icon-wrapper">
                  <i className="bi bi-building"></i>
                </div>
                <div className="dm-modal-title-section">
                  <h3>{t('divisionDetailsTitle') || 'Division Details'}</h3>
                  <span className="dm-modal-subtitle">View division information</span>
                </div>
              </div>
              <button className="dm-modal-close-enhanced" onClick={() => setCurrentDivision(null)} aria-label={t('close')}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            {/* Modal Body */}
            <div className="dm-modal-body-enhanced">
              {/* Division Name Highlight */}
              <div className="dm-detail-highlight">
                <div className="dm-detail-highlight-icon">
                  <i className="bi bi-building-fill"></i>
                </div>
                <div className="dm-detail-highlight-content">
                  <span className="dm-detail-highlight-label">Division Name</span>
                  <h4 className="dm-detail-highlight-value">{currentDivision.name ?? t('naLabel')}</h4>
                </div>
              </div>

              {/* Details Grid */}
              <div className="dm-details-grid">
                <div className="dm-detail-item">
                  <div className="dm-detail-icon">
                    <i className="bi bi-fingerprint"></i>
                  </div>
                  <div className="dm-detail-content">
                    <span className="dm-detail-label">ID</span>
                    <span className="dm-detail-value">{currentDivision._id ?? (currentDivision.id || t('naLabel'))}</span>
                  </div>
                </div>

                <div className="dm-detail-item">
                  <div className="dm-detail-icon">
                    <i className="bi bi-upc-scan"></i>
                  </div>
                  <div className="dm-detail-content">
                    <span className="dm-detail-label">Code</span>
                    <span className="dm-detail-value dm-code">{currentDivision.code ?? t('naLabel')}</span>
                  </div>
                </div>

                <div className="dm-detail-item">
                  <div className="dm-detail-icon">
                    <i className="bi bi-toggle-on"></i>
                  </div>
                  <div className="dm-detail-content">
                    <span className="dm-detail-label">Status</span>
                    <span className={`dm-detail-status ${typeof currentDivision.isActive === 'boolean' ? (currentDivision.isActive ? 'active' : 'inactive') : ''}`}>
                      {typeof currentDivision.isActive === 'boolean' ? (currentDivision.isActive ? 'Active' : 'Inactive') : t('naLabel')}
                    </span>
                  </div>
                </div>

                <div className="dm-detail-item">
                  <div className="dm-detail-icon">
                    <i className="bi bi-people-fill"></i>
                  </div>
                  <div className="dm-detail-content">
                    <span className="dm-detail-label">Employee Count</span>
                    <span className="dm-detail-value dm-count">{currentDivision.employeeCount ?? 0}</span>
                  </div>
                </div>

                <div className="dm-detail-item dm-detail-full">
                  <div className="dm-detail-icon">
                    <i className="bi bi-calendar-check"></i>
                  </div>
                  <div className="dm-detail-content">
                    <span className="dm-detail-label">Created At</span>
                    <span className="dm-detail-value">{currentDivision.createdAt ? (parseHrisDate(currentDivision.createdAt) || String(currentDivision.createdAt)) : t('naLabel')}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="dm-modal-footer-enhanced">
              <button className="dm-btn-close" onClick={() => setCurrentDivision(null)}>
                <i className="bi bi-x-circle"></i>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DivisionManagement;