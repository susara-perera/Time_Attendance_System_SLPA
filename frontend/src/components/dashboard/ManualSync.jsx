import React, { useState } from 'react';
import axios from 'axios';
import './ManualSync.css';

const ManualSync = () => {
  const [loading, setLoading] = useState({});
  const [results, setResults] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState(null);

  const syncTables = [
    {
      id: 'divisions',
      name: 'Divisions',
      endpoint: '/api/sync/trigger/divisions',
      icon: 'bi-building',
      color: 'primary',
      description: 'Sync company divisions from HRIS'
    },
    {
      id: 'sections',
      name: 'Sections',
      endpoint: '/api/sync/trigger/sections',
      icon: 'bi-diagram-3',
      color: 'info',
      description: 'Sync organizational sections from HRIS'
    },
    {
      id: 'employees',
      name: 'Employees',
      endpoint: '/api/sync/trigger/employees',
      icon: 'bi-people',
      color: 'success',
      description: 'Sync employee records from HRIS'
    },
    {
      id: 'emp-index',
      name: 'Employee Index',
      endpoint: '/api/sync/trigger/emp-index',
      icon: 'bi-list-ul',
      color: 'warning',
      description: 'Build employee index (Auto-syncs daily at 12PM)',
      note: 'This table syncs automatically at 12PM daily'
    },
    {
      id: 'subsections',
      name: 'Sub-Sections',
      endpoint: '/api/sync/trigger/subsections',
      icon: 'bi-diagram-2',
      color: 'secondary',
      description: 'Check sub-section status (manually managed)'
    },
    {
      id: 'audit',
      name: 'Audit Data',
      endpoint: '/api/sync/trigger/audit',
      icon: 'bi-exclamation-triangle-fill',
      color: 'danger',
      description: 'Pre-process incomplete punch records for ultra-fast audit reports',
      note: 'Syncs last 30 days of incomplete attendance (check-in/out only)'
    },
    {
      id: 'cache',
      name: 'Cache System',
      endpoint: '/api/sync/trigger/cache',
      icon: 'bi-lightning-charge-fill',
      color: 'danger',
      description: 'Rebuild cache and indexes for ultra-fast data access',
      note: 'Preloads all data into Redis cache with intelligent indexing'
    }
  ];

  const handleSync = async (table) => {
    try {
      setLoading(prev => ({ ...prev, [table.id]: true }));
      setError(null);

      const token = localStorage.getItem('token');
      const response = await axios.post(
        `http://localhost:5000${table.endpoint}`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.success) {
        setResults({
          tableName: table.name,
          ...response.data.data
        });
        setShowModal(true);
      } else {
        setError(`Failed to sync ${table.name}: ${response.data.message}`);
      }

    } catch (err) {
      console.error(`Error syncing ${table.name}:`, err);
      setError(
        err.response?.data?.message || 
        err.message || 
        `Failed to sync ${table.name}`
      );
    } finally {
      setLoading(prev => ({ ...prev, [table.id]: false }));
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setResults(null);
  };

  return (
    <div className="manual-sync-container">
      <div className="page-header-banner">
        <div className="page-header-content">
          <div className="page-header-icon">
            <i className="bi bi-arrow-repeat"></i>
          </div>
          <div className="page-header-text">
            <h1>Manual Data Synchronization</h1>
            <p>Sync data from HRIS API to local MySQL database. Only new records will be added.</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="sync-alert alert-danger">
          <i className="bi bi-exclamation-triangle"></i>
          <span>{error}</span>
          <button onClick={() => setError(null)} className="alert-close">
            <i className="bi bi-x"></i>
          </button>
        </div>
      )}

      <div className="sync-grid">
        {syncTables.map((table) => (
          <div key={table.id} className="sync-card">
            <div className="sync-card-header">
              <div className={`sync-icon ${table.color}`}>
                <i className={`bi ${table.icon}`}></i>
              </div>
              <h3>{table.name}</h3>
            </div>
            <div className="sync-card-body">
              <p className="sync-description">{table.description}</p>
              {table.note && (
                <div className="sync-note-badge">
                  <i className="bi bi-clock-history"></i>
                  <span>{table.note}</span>
                </div>
              )}
            </div>
            <div className="sync-card-footer">
              <button
                onClick={() => handleSync(table)}
                disabled={loading[table.id]}
                className={`sync-btn btn-${table.color}`}
              >
                {loading[table.id] ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    Syncing...
                  </>
                ) : (
                  <>
                    <i className="bi bi-arrow-repeat"></i>
                    Sync {table.name}
                  </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Results Modal */}
      {showModal && results && (
        <div className="sync-modal-overlay" onClick={closeModal}>
          <div className="sync-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sync-modal-header">
              <h3>
                <i className="bi bi-check-circle text-success"></i>
                {results.tableName} Sync Complete
              </h3>
              <button onClick={closeModal} className="modal-close-btn">
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            <div className="sync-modal-body">
              <div className="sync-stats">
                <div className="stat-item">
                  <span className="stat-label">New Records Added</span>
                  <span className="stat-value success">{results.recordsAdded || 0}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Existing Records (Skipped)</span>
                  <span className="stat-value info">{results.recordsUpdated || results.updated || 0}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Total Processed</span>
                  <span className="stat-value">{results.recordsSynced || results.inserted + (results.updated || 0) || 0}</span>
                </div>
                {results.recordsFailed > 0 && (
                  <div className="stat-item">
                    <span className="stat-label">Failed</span>
                    <span className="stat-value danger">{results.recordsFailed}</span>
                  </div>
                )}
              </div>

              {results.newRecords && results.newRecords.length > 0 && (
                <>
                  <div className="new-records-header">
                    <h4>
                      <i className="bi bi-file-earmark-plus"></i>
                      Newly Added Records ({results.newRecords.length})
                    </h4>
                  </div>
                  <div className="new-records-list">
                    {results.newRecords.slice(0, 20).map((record, index) => (
                      <div key={index} className="record-item">
                        <div className="record-index">{index + 1}</div>
                        <div className="record-details">
                          {Object.entries(record)
                            .filter(([key]) => !key.includes('synced_at') && !key.includes('id'))
                            .map(([key, value]) => (
                              <div key={key} className="record-field">
                                <span className="field-label">{key}:</span>
                                <span className="field-value">
                                  {value || 'N/A'}
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>
                    ))}
                    {results.newRecords.length > 20 && (
                      <div className="record-item-more">
                        <i className="bi bi-three-dots"></i>
                        And {results.newRecords.length - 20} more records...
                      </div>
                    )}
                  </div>
                </>
              )}

              {(!results.newRecords || results.newRecords.length === 0) && (
                <div className="no-new-records">
                  <i className="bi bi-info-circle"></i>
                  <p>No new records were added. All records already exist in the database.</p>
                </div>
              )}

              {results.note && (
                <div className="sync-note">
                  <i className="bi bi-info-circle"></i>
                  <span>{results.note}</span>
                </div>
              )}
            </div>

            <div className="sync-modal-footer">
              <button onClick={closeModal} className="btn-close-modal">
                <i className="bi bi-check"></i>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManualSync;
