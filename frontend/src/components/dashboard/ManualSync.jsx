import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './ManualSync.css';
import PageHeader from './PageHeader';

const ManualSync = () => {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState({}); // { task_id: boolean }
  const [progress, setProgress] = useState({}); // { task_id: percentage }
  const [message, setMessage] = useState(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [currentResult, setCurrentResult] = useState(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [taskDateRanges, setTaskDateRanges] = useState({}); // { task_id: { startDate, endDate } }

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  useEffect(() => {
    fetchSchedules();
    
    // Initialize default date ranges for attendance cache
    setTaskDateRanges({
      attendance_cache: {
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
      }
    });
  }, []);

  const fetchSchedules = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/sync-schedule`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.data.success) {
        setSchedules(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching schedules:', err);
      // Fallback/Mock data if API fails (during dev/migration)
      setSchedules([
          { task_id: 'divisions_sync', task_name: 'Divisions Sync', description: 'Sync company divisions from HRIS', mode: 'manual', repeat_interval: 'none', repeat_enabled: false, last_run: null, status: 'idle' },
          { task_id: 'sections_sync', task_name: 'Sections Sync', description: 'Sync organizational sections from HRIS', mode: 'manual', repeat_interval: 'none', repeat_enabled: false, last_run: null, status: 'idle' },
          { task_id: 'employees_sync', task_name: 'Employees Sync', description: 'Sync employee records from HRIS', mode: 'manual', repeat_interval: 'none', repeat_enabled: false, last_run: null, status: 'idle' },
          { task_id: 'dashboard_sync', task_name: 'Dashboard Totals Sync', description: 'Sync dashboard with latest data', mode: 'manual', repeat_interval: 'none', repeat_enabled: false, last_run: null, status: 'idle' },
          { task_id: 'attendance_cache', task_name: 'Attendance Table Cache', description: 'Cache attendance data', mode: 'manual', repeat_interval: 'none', repeat_enabled: false, last_run: null, status: 'idle' },
          { task_id: 'employees_cache', task_name: 'Employees Cache', description: 'Preload employees cache', mode: 'manual', repeat_interval: 'none', repeat_enabled: false, last_run: null, status: 'idle' },
          { task_id: 'divisions_cache', task_name: 'Divisions Cache', description: 'Preload divisions cache', mode: 'manual', repeat_interval: 'none', repeat_enabled: false, last_run: null, status: 'idle' },
          { task_id: 'sections_cache', task_name: 'Sections Cache', description: 'Preload sections cache', mode: 'manual', repeat_interval: 'none', repeat_enabled: false, last_run: null, status: 'idle' },
          { task_id: 'subsections_cache', task_name: 'Sub-Sections Cache', description: 'Preload sub-sections cache', mode: 'manual', repeat_interval: 'none', repeat_enabled: false, last_run: null, status: 'idle' }
      ]);
      setMessage({ type: 'warning', text: 'Could not load schedules from server, showing defaults.' });
    } finally {
      setLoading(false);
    }
  };

  const [saving, setSaving] = useState({});

  const handleUpdateSchedule = async (task_id, updates) => {
    // Optimistic UI update with saving flag and preserved previous state
    const current = schedules.find(s => s.task_id === task_id);
    if (!current) {
      setMessage({ type: 'error', text: 'Schedule not found' });
      return;
    }

    const previous = { ...current };
    const optimistic = { ...current, ...updates };

    console.debug('[ManualSync] Updating schedule', task_id, 'updates=', updates, 'optimistic=', optimistic);

    setSchedules(prev => prev.map(s => s.task_id === task_id ? optimistic : s));
    setSaving(prev => ({ ...prev, [task_id]: true }));

    try {
      const token = localStorage.getItem('token');

      const payload = {
        task_id: optimistic.task_id,
        task_name: optimistic.task_name,
        description: optimistic.description,
        mode: optimistic.mode,
        schedule_date: optimistic.schedule_date,
        schedule_time: optimistic.schedule_time,
        date_range_start: optimistic.date_range_start,
        date_range_end: optimistic.date_range_end,
        repeat_interval: optimistic.repeat_interval || 'none',
        repeat_enabled: optimistic.repeat_enabled || false,
        last_run: optimistic.last_run || null,
        status: optimistic.status || undefined
      };

      console.debug('[ManualSync] PUT payload', payload);

      const response = await axios.put(`${API_BASE_URL}/sync-schedule/${task_id}`, payload, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      console.debug('[ManualSync] PUT response', response?.data);

      if (response.data && response.data.success) {
        setSchedules(prev => prev.map(s => s.task_id === task_id ? { ...s, ...response.data.data } : s));
        setMessage({ type: 'success', text: 'Schedule updated successfully' });
        setTimeout(() => setMessage(null), 3000);
      } else {
        const msg = response.data?.message || 'Unknown server response';
        throw new Error(msg);
      }

    } catch (err) {
      console.error('[ManualSync] Error updating schedule:', err);
      const errorMsg = err.response?.data?.message || err.message || 'Failed to update schedule';
      setMessage({ type: 'error', text: errorMsg });

      // Revert optimistic update locally to avoid flicker caused by full reload
      setSchedules(prev => prev.map(s => s.task_id === task_id ? previous : s));

      // If auth error, suggest re-login (keep it concise)
      if (err.response?.status === 401) {
        setMessage({ type: 'error', text: 'Authentication error. Please login again.' });
      }

      // Don't automatically reload the whole list to avoid UI jank; allow manual refresh if needed
      console.debug('[ManualSync] Reverted schedule to previous state');
    } finally {
      setSaving(prev => ({ ...prev, [task_id]: false }));
    }
  };

  const handleStartSync = async (task) => {
    if (processing[task.task_id]) return;

    // For attendance_cache, use the task-specific date range
    if (task.task_id === 'attendance_cache') {
      const taskRange = taskDateRanges[task.task_id] || dateRange;
      await executeSync(task, taskRange);
    } else {
      await executeSync(task, {});
    }
  };

  const executeSync = async (task, options = {}) => {
    setProcessing(prev => ({ ...prev, [task.task_id]: true }));
    setProgress(prev => ({ ...prev, [task.task_id]: 0 }));
    setMessage({ type: 'info', text: `Starting ${task.task_name}...` });

    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        const current = prev[task.task_id] || 0;
        if (current < 90) {
          return { ...prev, [task.task_id]: current + 10 };
        }
        return prev;
      });
    }, 300);

    try {
      let endpoint = '';
      // Map task_id to endpoint
      switch(task.task_id) {
        case 'divisions_sync': endpoint = '/sync/trigger/divisions'; break;
        case 'sections_sync': endpoint = '/sync/trigger/sections'; break;
        case 'employees_sync': endpoint = '/sync/trigger/employees'; break;
        case 'dashboard_sync': endpoint = '/dashboard/total-counts/refresh'; break;
        case 'attendance_cache': endpoint = '/cache/warmup'; break;
        case 'employees_cache': endpoint = '/hris-cache/employees/refresh'; break;
        case 'divisions_cache': endpoint = '/hris-cache/divisions/refresh'; break;
        case 'sections_cache': endpoint = '/hris-cache/sections/refresh'; break;
        case 'subsections_cache': endpoint = '/hris-cache/subsections/refresh'; break;
        default: break;
      }

      if (endpoint) {
        const token = localStorage.getItem('token');
        let url = `${API_BASE_URL}${endpoint}`;
        
        // Add date range query params for attendance cache
        if (task.task_id === 'attendance_cache' && options.startDate && options.endDate) {
          url += `?startDate=${options.startDate}&endDate=${options.endDate}`;
        }
        
        const response = await axios.post(url, {}, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        clearInterval(progressInterval);
        setProgress(prev => ({ ...prev, [task.task_id]: 100 }));
        
        // Show result modal
        setCurrentResult({
          taskName: task.task_name,
          taskId: task.task_id,
          data: response.data
        });
        setShowResultModal(true);
        
        setMessage({ type: 'success', text: `${task.task_name} completed successfully` });
      } else {
        clearInterval(progressInterval);
        setMessage({ type: 'error', text: 'No endpoint defined for this task' });
      }
      
      // Update last run time locally
      handleUpdateSchedule(task.task_id, { last_run: new Date(), status: 'completed' });

    } catch (err) {
      clearInterval(progressInterval);
      console.error('Error starting sync:', err);
      setMessage({ type: 'error', text: `Failed to start ${task.task_name}: ${err.response?.data?.message || err.message}` });
      setProgress(prev => ({ ...prev, [task.task_id]: 0 }));
    } finally {
      setTimeout(() => {
        setProcessing(prev => ({ ...prev, [task.task_id]: false }));
        setProgress(prev => ({ ...prev, [task.task_id]: 0 }));
      }, 2000);
    }
  };

  const handleStopSync = (task) => {
     // Since we can't easily cancel backend request, we just reset UI state
     setProcessing(prev => ({ ...prev, [task.task_id]: false }));
     setMessage({ type: 'info', text: 'Stopped (UI only)' });
  };

  return (
    <div className="manual-sync-container">
      <PageHeader 
        title="Manual Sync & Cache Management" 
        subtitle="Manage synchronization schedules and manual triggers"
        icon="bi-arrow-repeat" 
      />

      {message && (
        <div className={`alert alert-${message.type === 'error' ? 'danger' : message.type === 'success' ? 'success' : 'info'} mb-3`}>
          {message.text}
        </div>
      )}

      <div className="card shadow-sm">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="bg-light">
                <tr>
                  <th style={{width: '12%'}}>Name</th>
                  <th style={{width: '12%'}}>Description</th>
                  <th style={{width: '10%'}}>Last Run</th>
                  <th style={{width: '8%'}}>Progress</th>
                  <th style={{width: '8%'}}>Action</th>
                  <th style={{width: '8%'}}>Mode</th>
                  <th style={{width: '10%'}}>Repeat Interval</th>
                  <th style={{width: '16%'}}>Cache Date Range</th>
                  <th style={{width: '16%'}}>Schedule</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="9" className="text-center p-4">Loading schedules...</td></tr>
                ) : schedules.map(task => (
                  <tr key={task.task_id}>
                    <td className="fw-bold">
                        {task.task_name}
                        {task.last_run && <div className="text-muted small fw-normal">Last: {new Date(task.last_run).toLocaleString()}</div>}
                    </td>
                    <td className="text-muted small">{task.description}</td>
                    <td className="text-muted small">{task.last_run ? new Date(task.last_run).toLocaleString() : 'Never'}</td>
                    <td>
                      {processing[task.task_id] ? (
                        <div>
                          <div className="progress" style={{height: '20px'}}>
                            <div 
                              className="progress-bar progress-bar-striped progress-bar-animated bg-primary" 
                              role="progressbar" 
                              style={{width: `${progress[task.task_id] || 0}%`}}
                              aria-valuenow={progress[task.task_id] || 0} 
                              aria-valuemin="0" 
                              aria-valuemax="100"
                            >
                              {progress[task.task_id] || 0}%
                            </div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted small">Ready</span>
                      )}
                    </td>
                    <td>
                      <div className="d-flex gap-1 flex-column">
                        <button 
                          className="btn btn-sm btn-primary"
                          onClick={() => handleStartSync(task)}
                          disabled={processing[task.task_id]}
                        >
                          {processing[task.task_id] ? (
                            <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                          ) : (
                            <i className="bi bi-play-fill me-1"></i>
                          )}
                          Start
                        </button>
                      </div>
                    </td>
                    <td>
                      <div className="btn-group btn-group-sm" role="group">
                        <input 
                          type="radio" 
                          className="btn-check" 
                          name={`mode-${task.task_id}`} 
                          id={`auto-${task.task_id}`} 
                          autoComplete="off"
                          checked={task.mode === 'auto'}
                          disabled={!!saving[task.task_id]}
                          onChange={() => handleUpdateSchedule(task.task_id, { mode: 'auto' })}
                        />
                        <label
                          className={`btn ${task.mode === 'auto' ? 'btn-success' : 'btn-outline-secondary'}`}
                          htmlFor={`auto-${task.task_id}`}
                          onClick={() => !saving[task.task_id] && handleUpdateSchedule(task.task_id, { mode: 'auto' })}
                          style={{ cursor: saving[task.task_id] ? 'not-allowed' : 'pointer' }}
                        >Auto</label>

                        <input 
                          type="radio" 
                          className="btn-check" 
                          name={`mode-${task.task_id}`} 
                          id={`manual-${task.task_id}`} 
                          autoComplete="off"
                          checked={task.mode === 'manual'}
                          disabled={!!saving[task.task_id]}
                          onChange={() => handleUpdateSchedule(task.task_id, { mode: 'manual' })}
                        />
                        <label
                          className={`btn ${task.mode === 'manual' ? 'btn-secondary' : 'btn-outline-secondary'}`}
                          htmlFor={`manual-${task.task_id}`}
                          onClick={() => !saving[task.task_id] && handleUpdateSchedule(task.task_id, { mode: 'manual' })}
                          style={{ cursor: saving[task.task_id] ? 'not-allowed' : 'pointer' }}
                        >Manual</label>
                        {saving[task.task_id] && (
                          <div className="spinner-border spinner-border-sm ms-2" role="status" aria-hidden="true"></div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="d-flex flex-column gap-2">
                        <select 
                          className="form-select form-select-sm" 
                          disabled={task.mode !== 'auto' || !!saving[task.task_id]}
                          value={task.repeat_interval || 'none'}
                          onChange={(e) => handleUpdateSchedule(task.task_id, { repeat_interval: e.target.value, repeat_enabled: e.target.value !== 'none' })}
                        >
                          <option value="none">No Repeat</option>
                          <option value="every_30_seconds">Every 30 Seconds</option>
                          <option value="every_minute">Every Minute</option>
                          <option value="every_5_minutes">Every 5 Minutes</option>
                          <option value="every_15_minutes">Every 15 Minutes</option>
                          <option value="every_30_minutes">Every 30 Minutes</option>
                          <option value="hourly">Hourly</option>
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                        </select>
                        {task.repeat_enabled && task.repeat_interval !== 'none' && (
                          <span className="badge bg-info text-dark small">
                            <i className="bi bi-arrow-repeat me-1"></i>Recurring
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      {task.task_id === 'attendance_cache' ? (
                        <div className="row g-1">
                          <div className="col-6">
                            <input 
                              type="date" 
                              className="form-control form-control-sm" 
                              value={taskDateRanges[task.task_id]?.startDate || dateRange.startDate}
                              onChange={(e) => setTaskDateRanges(prev => ({
                                ...prev,
                                [task.task_id]: {
                                  ...prev[task.task_id],
                                  startDate: e.target.value
                                }
                              }))}
                              placeholder="Start"
                            />
                          </div>
                          <div className="col-6">
                            <input 
                              type="date" 
                              className="form-control form-control-sm" 
                              value={taskDateRanges[task.task_id]?.endDate || dateRange.endDate}
                              onChange={(e) => setTaskDateRanges(prev => ({
                                ...prev,
                                [task.task_id]: {
                                  ...prev[task.task_id],
                                  endDate: e.target.value
                                }
                              }))}
                              placeholder="End"
                              max={new Date().toISOString().split('T')[0]}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted small">N/A</span>
                      )}
                    </td>
                    <td>
                      <div className="row g-2 align-items-center">
                        <div className="col-6">
                          <input 
                            type="date" 
                            className="form-control form-control-sm" 
                            disabled={task.mode !== 'auto' || !!saving[task.task_id]}
                            value={task.schedule_date || ''}
                            onChange={(e) => handleUpdateSchedule(task.task_id, { schedule_date: e.target.value })}
                            placeholder={task.repeat_enabled ? "Start date" : "Date"}
                          />
                        </div>
                        <div className="col-6">
                          <input 
                            type="time" 
                            className="form-control form-control-sm" 
                            disabled={task.mode !== 'auto' || !!saving[task.task_id]}
                            value={task.schedule_time || ''}
                            onChange={(e) => handleUpdateSchedule(task.task_id, { schedule_time: e.target.value })}
                            placeholder={task.repeat_enabled ? "Start time" : "Time"}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Result Modal */}
      {showResultModal && currentResult && (
        <div className="modal show d-block" tabIndex="-1" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title">
                  <i className="bi bi-check-circle me-2"></i>
                  {currentResult.taskName} - Results
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowResultModal(false)}></button>
              </div>
              <div className="modal-body">
                {renderResultContent(currentResult)}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowResultModal(false)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Date Range Modal for Attendance Cache - REMOVED: Now using inline date range inputs */}
      {/* {showDateRangeModal && (
        <div className="modal show d-block" tabIndex="-1" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header bg-warning text-dark">
                <h5 className="modal-title">
                  <i className="bi bi-calendar-range me-2"></i>
                  Select Attendance Date Range
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowDateRangeModal(false)}></button>
              </div>
              <div className="modal-body">
                <p className="text-muted mb-3">
                  Select the date range for attendance data to cache. This will improve report generation speed for the selected period.
                </p>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label fw-bold">Start Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={dateRange.startDate}
                      onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-bold">End Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={dateRange.endDate}
                      onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                      max={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                </div>
                <div className="alert alert-info mt-3 mb-0">
                  <i className="bi bi-info-circle me-2"></i>
                  <small>
                    Selected: {Math.ceil((new Date(dateRange.endDate) - new Date(dateRange.startDate)) / (1000 * 60 * 60 * 24))} days
                  </small>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowDateRangeModal(false)}>
                  Cancel
                </button>
                <button type="button" className="btn btn-warning" onClick={handleDateRangeConfirm}>
                  <i className="bi bi-check-circle me-1"></i>
                  Start Caching
                </button>
              </div>
            </div>
          </div>
        </div>
      )} */}
    </div>
  );

  function renderResultContent(result) {
    const { data, taskId } = result;
    
    // Handle sync operations
    if (taskId.includes('_sync')) {
      const syncData = data.data || {};
      return (
        <div>
          <div className="row mb-3">
            <div className="col-md-3">
              <div className="card text-center border-primary">
                <div className="card-body">
                  <h3 className="text-primary mb-0">{syncData.synced || syncData.total || 0}</h3>
                  <small className="text-muted">Total Synced</small>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card text-center border-success">
                <div className="card-body">
                  <h3 className="text-success mb-0">{syncData.created || 0}</h3>
                  <small className="text-muted">New Records</small>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card text-center border-warning">
                <div className="card-body">
                  <h3 className="text-warning mb-0">{syncData.updated || 0}</h3>
                  <small className="text-muted">Updated</small>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card text-center border-danger">
                <div className="card-body">
                  <h3 className="text-danger mb-0">{syncData.failed || 0}</h3>
                  <small className="text-muted">Failed</small>
                </div>
              </div>
            </div>
          </div>
          
          {syncData.records && syncData.records.length > 0 && (
            <div>
              <h6 className="mb-3">New Records:</h6>
              <div className="table-responsive" style={{maxHeight: '300px', overflowY: 'auto'}}>
                <table className="table table-sm table-striped">
                  <thead className="sticky-top bg-light">
                    <tr>
                      {taskId === 'divisions_sync' && (
                        <>
                          <th>Code</th>
                          <th>Name</th>
                        </>
                      )}
                      {taskId === 'sections_sync' && (
                        <>
                          <th>Code</th>
                          <th>Name</th>
                          <th>Division</th>
                        </>
                      )}
                      {taskId === 'employees_sync' && (
                        <>
                          <th>Emp No</th>
                          <th>Name</th>
                          <th>Division</th>
                          <th>Section</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {syncData.records.slice(0, 50).map((record, idx) => (
                      <tr key={idx}>
                        {taskId === 'divisions_sync' && (
                          <>
                            <td>{record.HIE_CODE || record.code}</td>
                            <td>{record.HIE_NAME || record.name}</td>
                          </>
                        )}
                        {taskId === 'sections_sync' && (
                          <>
                            <td>{record.HIE_CODE || record.code}</td>
                            <td>{record.HIE_NAME || record.name}</td>
                            <td>{record.DIV_CODE || record.divisionCode}</td>
                          </>
                        )}
                        {taskId === 'employees_sync' && (
                          <>
                            <td>{record.EMP_NO || record.empNo}</td>
                            <td>{record.EMP_NAME || record.name}</td>
                            <td>{record.DIV_NAME || record.division}</td>
                            <td>{record.SEC_NAME || record.section}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {syncData.records.length > 50 && (
                  <p className="text-muted text-center">Showing first 50 of {syncData.records.length} records</p>
                )}
              </div>
            </div>
          )}
        </div>
      );
    }
    
    // Handle cache operations
    if (taskId.includes('_cache') || taskId === 'dashboard_sync') {
      return (
        <div>
          <div className="alert alert-success">
            <i className="bi bi-check-circle me-2"></i>
            <strong>Success!</strong> Cache operation completed successfully.
          </div>
          {data.data && (
            <div className="bg-light p-3 rounded">
              <pre className="mb-0" style={{maxHeight: '300px', overflowY: 'auto'}}>
                {JSON.stringify(data.data, null, 2)}
              </pre>
            </div>
          )}
          {data.message && (
            <p className="mt-3 mb-0">{data.message}</p>
          )}
        </div>
      );
    }
    
    return (
      <div>
        <div className="alert alert-info">
          <i className="bi bi-info-circle me-2"></i>
          Operation completed successfully
        </div>
        {data.message && <p>{data.message}</p>}
      </div>
    );
  }
};

export default ManualSync;
