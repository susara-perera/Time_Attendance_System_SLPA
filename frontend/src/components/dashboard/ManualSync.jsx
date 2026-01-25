import React, { useState } from 'react';
import axios from 'axios';
import './ManualSync.css';
import PageHeader from './PageHeader';

const ManualSync = ({ onBack }) => {
  const [loading, setLoading] = useState({});
  const [progress, setProgress] = useState({});
  const [results, setResults] = useState({});
  const [showDateRangeModal, setShowDateRangeModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [currentResult, setCurrentResult] = useState(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  const syncTables = [
    {
      id: 'dashboard_totals_cache',
      name: 'Sync total_count_dashboard (Updated Dashboard)',
      endpoint: '/dashboard/total-counts/refresh',
      icon: 'bi-speedometer2',
      color: 'secondary',
      description: 'Rebuild total_count_dashboard for the new dashboard (counts, trend, IS attendance, present/absent with division + section)',
      hasProgress: true
    },
    {
      id: 'divisions_sync',
      name: 'Divisions Sync',
      endpoint: '/sync/trigger/divisions',
      icon: 'bi-building',
      color: 'primary',
      description: 'Sync company divisions from HRIS',
      hasProgress: true
    },
    {
      id: 'sections_sync',
      name: 'Sections Sync',
      endpoint: '/sync/trigger/sections',
      icon: 'bi-diagram-3',
      color: 'info',
      description: 'Sync organizational sections from HRIS',
      hasProgress: true
    },
    {
      id: 'employees_sync',
      name: 'Employees Sync',
      endpoint: '/sync/trigger/employees',
      icon: 'bi-people',
      color: 'success',
      description: 'Sync employee records from HRIS',
      hasProgress: true
    },
    {
      id: 'division_cache',
      name: 'Division Cache',
      endpoint: '/hris-cache/divisions/refresh',
      icon: 'bi-hdd-stack',
      color: 'primary',
      description: 'Preload division cache for faster access',
      hasProgress: true
    },
    {
      id: 'section_cache',
      name: 'Section Cache',
      endpoint: '/hris-cache/sections/refresh',
      icon: 'bi-hdd-network',
      color: 'info',
      description: 'Preload section cache for faster access',
      hasProgress: true
    },
    {
      id: 'subsection_cache',
      name: 'Sub-Section Cache',
      endpoint: '/hris-cache/subsections/refresh',
      icon: 'bi-hdd',
      color: 'secondary',
      description: 'Preload sub-section cache for faster access',
      hasProgress: true
    },
    {
      id: 'employee_cache',
      name: 'Employee Cache',
      endpoint: '/hris-cache/employees/refresh',
      icon: 'bi-person-lines-fill',
      color: 'success',
      description: 'Preload employee cache for faster access',
      hasProgress: true
    },
    {
      id: 'attendance_cache',
      name: 'Attendance Cache',
      endpoint: '/cache/warmup',
      icon: 'bi-calendar-check',
      color: 'warning',
      description: 'Cache attendance data for selected date range',
      hasProgress: true,
      needsDateRange: true
    },

  ];

  const handleSync = async (table) => {
    if (table.needsDateRange) {
      setShowDateRangeModal(true);
      return;
    }

    await executeSyncWithProgress(table);
  };

  const executeSyncWithProgress = async (table, customParams = {}) => {
    try {
      setLoading(prev => ({ ...prev, [table.id]: true }));
      setProgress(prev => ({ ...prev, [table.id]: { percent: 0, message: 'Starting...', current: 0, total: 0 } }));
      setResults(prev => ({ ...prev, [table.id]: null }));

      const token = localStorage.getItem('token');
      
      // Build URL with date range if needed
      let url = `${API_BASE_URL}${table.endpoint}`;
      if (customParams.startDate && customParams.endDate) {
        url += `?startDate=${customParams.startDate}&endDate=${customParams.endDate}`;
      }

      const response = await axios.post(url, {}, {
        headers: { 'Authorization': `Bearer ${token}` },
        onDownloadProgress: (progressEvent) => {
          // Simulate progress if real progress not available
          if (!progressEvent.total) {
            const timeElapsed = Date.now() - startTime;
            const estimatedPercent = Math.min(90, (timeElapsed / 10000) * 100);
            setProgress(prev => ({
              ...prev,
              [table.id]: {
                percent: Math.round(estimatedPercent),
                message: 'Processing...',
                current: 0,
                total: 0
              }
            }));
          }
        }
      });

      const data = response.data;

      // Calculate final progress from response
      let finalProgress = { percent: 100, message: 'Completed!', current: 0, total: 0 };
      
      if (data.data) {
        if (data.data.synced !== undefined && data.data.total !== undefined) {
          finalProgress.current = data.data.synced;
          finalProgress.total = data.data.total;
        } else if (data.data.recordsSynced !== undefined) {
          finalProgress.current = data.data.recordsSynced;
          finalProgress.total = data.data.recordsSynced;
        } else if (data.data.count !== undefined) {
          finalProgress.current = data.data.count;
          finalProgress.total = data.data.count;
        }
      }

      setProgress(prev => ({ ...prev, [table.id]: finalProgress }));
      setResults(prev => ({ ...prev, [table.id]: data }));
      
      // Show result modal after sync completes
      setCurrentResult({
        tableName: table.name,
        success: true,
        data: data,
        icon: table.icon,
        color: table.color
      });
      setShowResultModal(true);

    } catch (error) {
      console.error(`Error syncing ${table.name}:`, error);
      setProgress(prev => ({
        ...prev,
        [table.id]: { percent: 0, message: error.response?.data?.message || 'Error occurred', current: 0, total: 0 }
      }));
      setResults(prev => ({
        ...prev,
        [table.id]: { success: false, message: error.response?.data?.message || error.message }
      }));
      
      // Show error in modal
      setCurrentResult({
        tableName: table.name,
        success: false,
        message: error.response?.data?.message || error.message,
        icon: table.icon,
        color: 'danger'
      });
      setShowResultModal(true);
    } finally {
      setLoading(prev => ({ ...prev, [table.id]: false }));
    }
  };

  const handleAttendanceCacheWithDateRange = async () => {
    const table = syncTables.find(t => t.id === 'attendance_cache');
    setShowDateRangeModal(false);
    await executeSyncWithProgress(table, dateRange);
  };

  const startTime = Date.now();

  return (
    <div className="manual-sync-container">
      <PageHeader
        title="Manual Data Synchronization"
        subtitle="Manually trigger data sync and cache operations"
        icon="bi-arrow-repeat"
        onBack={onBack}
      />

      <div className="sync-list">
        <div className="sync-list-header">
          <div className="col name">Name</div>
          <div className="col desc">Description</div>
          <div className="col actions">Actions</div>
        </div>
        {syncTables.map(table => (
          <div key={table.id} className={`sync-list-item sync-item-${table.color}`}>
            <div className="col name">
              <i className={`bi ${table.icon} item-icon`} />
              <div className="item-title">{table.name}</div>
            </div>
            <div className="col desc">
              <div className="item-desc">{table.description}</div>
              {loading[table.id] && (
                <div className="small-progress">{progress[table.id]?.percent || 0}% - {progress[table.id]?.message || 'Processing...'}</div>
              )}
            </div>
            <div className="col actions">
              <button
                className={`start-btn start-btn-${table.color}`}
                onClick={() => handleSync(table)}
                disabled={loading[table.id]}
              >
                {loading[table.id] ? (
                  <span className="spinner-border spinner-border-sm me-2"></span>
                ) : (
                  <i className="bi bi-play-fill"></i>
                )}
                <span className="btn-label">Start</span>
              </button>

              <button
                className={`stop-btn`}
                onClick={() => {
                  // Soft stop: cancel UI state
                  setLoading(prev => ({ ...prev, [table.id]: false }));
                  setResults(prev => ({ ...prev, [table.id]: { success: false, message: 'Cancelled by user' } }));
                }}
                disabled={!loading[table.id]}
              >
                <i className="bi bi-stop-fill"></i>
                <span className="btn-label">Stop</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Date Range Modal for Attendance Cache */}
      {showDateRangeModal && (
        <div className="modal-overlay" onClick={() => setShowDateRangeModal(false)}>
          <div className="modal-content date-range-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3><i className="bi bi-calendar-range"></i> Select Date Range</h3>
              <button className="close-btn" onClick={() => setShowDateRangeModal(false)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="modal-body">
              <p className="modal-description">
                Select the date range for attendance data to cache. This will improve report generation speed for the selected period.
              </p>
              <div className="date-inputs">
                <div className="date-input-group">
                  <label>Start Date</label>
                  <input
                    type="date"
                    value={dateRange.startDate}
                    onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                    className="date-input"
                  />
                </div>
                <div className="date-input-group">
                  <label>End Date</label>
                  <input
                    type="date"
                    value={dateRange.endDate}
                    onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                    className="date-input"
                    max={new Date().toISOString().split('T')[0]}
                  />
                </div>
              </div>
              <div className="date-range-info">
                <i className="bi bi-info-circle"></i>
                <span>
                  Selected: {Math.ceil((new Date(dateRange.endDate) - new Date(dateRange.startDate)) / (1000 * 60 * 60 * 24))} days
                </span>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn-cancel"
                onClick={() => setShowDateRangeModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn-confirm"
                onClick={handleAttendanceCacheWithDateRange}
              >
                <i className="bi bi-check-circle"></i>
                Start Caching
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Result Modal */}
      {showResultModal && currentResult && (
        <div className="sync-result-modal-overlay" onClick={() => setShowResultModal(false)}>
          <div className="sync-result-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sync-result-header">
              <div className="sync-result-title">
                <i className={`bi ${currentResult.icon} me-2`} />
                {currentResult.tableName} - Results
              </div>
              <button className="close-btn" onClick={() => setShowResultModal(false)}>
                <i className="bi bi-x-lg" />
              </button>
            </div>
            
            <div className="sync-result-body">
              {currentResult.success ? (
                <>
                  <div className={`alert alert-${currentResult.data?.success ? 'success' : 'warning'} mb-3`}>
                    <i className={`bi bi-${currentResult.data?.success ? 'check-circle' : 'exclamation-triangle'} me-2`} />
                    {currentResult.data?.message || 'Operation completed'}
                  </div>

                  {/* Display sync statistics */}
                  {currentResult.data?.data && (
                    <div className="sync-stats-grid">
                      {/* Total records */}
                      {currentResult.data.data.total !== undefined && (
                        <div className="stat-card">
                          <div className="stat-label">Total Records</div>
                          <div className="stat-value">{currentResult.data.data.total}</div>
                        </div>
                      )}
                      
                      {/* Synced/Created records */}
                      {(currentResult.data.data.synced !== undefined || currentResult.data.data.created !== undefined) && (
                        <div className="stat-card stat-success">
                          <div className="stat-label">New/Updated</div>
                          <div className="stat-value">{currentResult.data.data.synced || currentResult.data.data.created || 0}</div>
                        </div>
                      )}
                      
                      {/* Records synced */}
                      {currentResult.data.data.recordsSynced !== undefined && (
                        <div className="stat-card stat-info">
                          <div className="stat-label">Records Synced</div>
                          <div className="stat-value">{currentResult.data.data.recordsSynced}</div>
                        </div>
                      )}
                      
                      {/* Count field */}
                      {currentResult.data.data.count !== undefined && (
                        <div className="stat-card stat-primary">
                          <div className="stat-label">Count</div>
                          <div className="stat-value">{currentResult.data.data.count}</div>
                        </div>
                      )}
                      
                      {/* Present/Absent counts */}
                      {currentResult.data.data.presentCount !== undefined && (
                        <>
                          <div className="stat-card stat-success">
                            <div className="stat-label">Present</div>
                            <div className="stat-value">{currentResult.data.data.presentCount}</div>
                          </div>
                          <div className="stat-card stat-danger">
                            <div className="stat-label">Absent</div>
                            <div className="stat-value">{currentResult.data.data.absentCount}</div>
                          </div>
                        </>
                      )}
                      
                      {/* Total divisions, sections, etc */}
                      {currentResult.data.data.totalDivisions !== undefined && (
                        <div className="stat-card">
                          <div className="stat-label">Divisions</div>
                          <div className="stat-value">{currentResult.data.data.totalDivisions}</div>
                        </div>
                      )}
                      {currentResult.data.data.totalSections !== undefined && (
                        <div className="stat-card">
                          <div className="stat-label">Sections</div>
                          <div className="stat-value">{currentResult.data.data.totalSections}</div>
                        </div>
                      )}
                      {currentResult.data.data.totalSubsections !== undefined && (
                        <div className="stat-card">
                          <div className="stat-label">Sub-Sections</div>
                          <div className="stat-value">{currentResult.data.data.totalSubsections}</div>
                        </div>
                      )}
                      {currentResult.data.data.totalActiveEmployees !== undefined && (
                        <div className="stat-card">
                          <div className="stat-label">Active Employees</div>
                          <div className="stat-value">{currentResult.data.data.totalActiveEmployees}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Display if no new data found */}
                  {currentResult.data?.data && 
                   (currentResult.data.data.synced === 0 || 
                    currentResult.data.data.created === 0 || 
                    currentResult.data.data.recordsSynced === 0 ||
                    (currentResult.data.data.synced === undefined && 
                     currentResult.data.data.created === undefined && 
                     currentResult.data.data.recordsSynced === undefined &&
                     currentResult.data.data.count === 0)) && (
                    <div className="alert alert-info mt-3">
                      <i className="bi bi-info-circle me-2" />
                      No new data found. All records are up to date.
                    </div>
                  )}

                  {/* Display new records if available */}
                  {currentResult.data?.data?.records && currentResult.data.data.records.length > 0 && (
                    <div className="new-records-section mt-4">
                      <h6 className="mb-3">
                        <i className="bi bi-plus-circle me-2" />
                        New Records ({currentResult.data.data.records.length})
                      </h6>
                      <div className="records-table-container">
                        <table className="table table-sm table-hover">
                          <thead>
                            <tr>
                              {Object.keys(currentResult.data.data.records[0]).map(key => (
                                <th key={key}>{key.replace(/_/g, ' ').toUpperCase()}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {currentResult.data.data.records.slice(0, 100).map((record, idx) => (
                              <tr key={idx}>
                                {Object.values(record).map((value, vidx) => (
                                  <td key={vidx}>{value?.toString() || 'N/A'}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {currentResult.data.data.records.length > 100 && (
                          <div className="text-muted small text-center mt-2">
                            Showing first 100 of {currentResult.data.data.records.length} records
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="alert alert-danger">
                  <i className="bi bi-exclamation-triangle me-2" />
                  {currentResult.message || 'An error occurred during sync'}
                </div>
              )}
            </div>
            
            <div className="sync-result-footer">
              <button className="btn btn-primary" onClick={() => setShowResultModal(false)}>
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
