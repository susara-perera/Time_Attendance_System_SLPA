import React, { useState } from 'react';
import axios from 'axios';
import './ManualSync.css';
import PageHeader from './PageHeader';

const ManualSync = ({ onBack }) => {
  const [loading, setLoading] = useState({});
  const [progress, setProgress] = useState({});
  const [results, setResults] = useState({});
  const [showDateRangeModal, setShowDateRangeModal] = useState(false);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  const syncTables = [
    {
      id: 'divisions_sync',
      name: 'Divisions Sync',
      endpoint: '/api/sync/trigger/divisions',
      icon: 'bi-building',
      color: 'primary',
      description: 'Sync company divisions from HRIS',
      hasProgress: true
    },
    {
      id: 'sections_sync',
      name: 'Sections Sync',
      endpoint: '/api/sync/trigger/sections',
      icon: 'bi-diagram-3',
      color: 'info',
      description: 'Sync organizational sections from HRIS',
      hasProgress: true
    },
    {
      id: 'employees_sync',
      name: 'Employees Sync',
      endpoint: '/api/sync/trigger/employees',
      icon: 'bi-people',
      color: 'success',
      description: 'Sync employee records from HRIS',
      hasProgress: true
    },
    {
      id: 'attendance_cache',
      name: 'Attendance Cache',
      endpoint: '/api/cache/warmup',
      icon: 'bi-calendar-check',
      color: 'warning',
      description: 'Cache attendance data for selected date range',
      hasProgress: true,
      needsDateRange: true
    }
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

      <div className="sync-cards-grid">
        {syncTables.map(table => (
          <div key={table.id} className={`sync-card sync-card-${table.color}`}>
            <div className="sync-card-header">
              <div className="sync-icon-wrapper">
                <i className={`bi ${table.icon} sync-icon`}></i>
              </div>
              <div className="sync-card-info">
                <h3>{table.name}</h3>
                <p>{table.description}</p>
              </div>
            </div>

            {/* Progress Bar */}
            {loading[table.id] && (
              <div className="sync-progress-container">
                <div className="sync-progress-bar-wrapper">
                  <div
                    className="sync-progress-bar"
                    style={{ width: `${progress[table.id]?.percent || 0}%` }}
                  >
                    <span className="progress-percent">{progress[table.id]?.percent || 0}%</span>
                  </div>
                </div>
                <div className="sync-progress-details">
                  <span className="progress-message">{progress[table.id]?.message || 'Processing...'}</span>
                  {progress[table.id]?.total > 0 && (
                    <span className="progress-count">
                      {progress[table.id]?.current} / {progress[table.id]?.total} records
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Results */}
            {results[table.id] && !loading[table.id] && (
              <div className={`sync-result ${results[table.id].success ? 'success' : 'error'}`}>
                <i className={`bi ${results[table.id].success ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}`}></i>
                <span>{results[table.id].message}</span>
                {results[table.id].data && (
                  <div className="result-details">
                    {results[table.id].data.synced && (
                      <span>Synced: {results[table.id].data.synced}</span>
                    )}
                    {results[table.id].data.skipped && (
                      <span>Skipped: {results[table.id].data.skipped}</span>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="sync-card-actions">
              <button
                className={`sync-btn sync-btn-${table.color}`}
                onClick={() => handleSync(table)}
                disabled={loading[table.id]}
              >
                {loading[table.id] ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    Syncing...
                  </>
                ) : (
                  <>
                    <i className="bi bi-play-fill"></i>
                    {table.needsDateRange ? 'Select Date Range & Sync' : 'Start Sync'}
                  </>
                )}
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
    </div>
  );
};

export default ManualSync;
