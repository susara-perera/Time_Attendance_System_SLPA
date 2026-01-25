import React, { useEffect, useMemo, useRef, useState } from 'react';

const formatAttendanceDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

const ISDivisionAttendanceCard = ({ enabled, refreshKey, onLoaded }) => {
  const [loading, setLoading] = useState(false);
  const [attendanceDate, setAttendanceDate] = useState('');
  const [employees, setEmployees] = useState([]);
  const [showFullAttendance, setShowFullAttendance] = useState(false);
  const [isSectionFilters, setIsSectionFilters] = useState({
    is: true,
    admin: true
  });

  const loadedRef = useRef(onLoaded);
  const lastFetchKeyRef = useRef(null);

  useEffect(() => {
    loadedRef.current = onLoaded;
  }, [onLoaded]);

  useEffect(() => {
    if (!enabled) return;

    if (lastFetchKeyRef.current === refreshKey) return;
    lastFetchKeyRef.current = refreshKey;

    let cancelled = false;
    const token = localStorage.getItem('token');

    setLoading(true);
    fetch('/api/dashboard/is-division-attendance', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        if (data?.success) {
          const list = data?.data?.employees || [];
          setEmployees(Array.isArray(list) ? list : []);
          setAttendanceDate(data?.lastUpdated || '');
        }
      })
      .catch(() => {
        // keep prior
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          loadedRef.current?.();
        }
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, refreshKey]);

  const handleSectionFilterChange = (key) => {
    setIsSectionFilters(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const resolveSectionGroup = (sectionName) => {
    if (!sectionName) return null;
    const normalized = String(sectionName).toLowerCase().replace(/\s+/g, ' ').trim();

    if (normalized.includes('administration')) return 'admin';
    if (normalized.includes('information systems') || normalized.includes('(is)') || normalized.includes('( is )')) return 'is';

    return null;
  };

  const filteredAttendanceData = useMemo(() => {
    const list = Array.isArray(employees) ? employees : [];
    return list.filter((employee) => {
      const group = resolveSectionGroup(employee?.section_name);
      if (!group) return true;
      return !!isSectionFilters[group];
    });
  }, [employees, isSectionFilters]);

  return (
    <>
      <div className="chart-card is-attendance-card">
        <div className="chart-card-header">
          <div className="chart-title">
            <i className="bi bi-table"></i>
            <div className="title-content">
              <h3>IS Division Attendance</h3>
              <span className="attendance-date">{formatAttendanceDate(attendanceDate)}</span>
            </div>
          </div>
          <div className="attendance-header-controls">
            <div className="is-section-filters">
              <label className="section-filter">
                <input
                  type="checkbox"
                  checked={!!isSectionFilters.is}
                  onChange={() => handleSectionFilterChange('is')}
                />
                <span className="filter-label">IS Section</span>
              </label>
              <label className="section-filter">
                <input
                  type="checkbox"
                  checked={!!isSectionFilters.admin}
                  onChange={() => handleSectionFilterChange('admin')}
                />
                <span className="filter-label">Admin Section</span>
              </label>
            </div>
            <div className="is-counts">
              <span className="is-present">{filteredAttendanceData.length} employees</span>
            </div>
          </div>
        </div>
        <div className="chart-card-body">
          {loading ? (
            <div className="loading-container">
              <div className="spinner-border spinner-border-sm" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <span className="loading-text">Loading IS attendance...</span>
            </div>
          ) : filteredAttendanceData.length > 0 ? (
            <div className="attendance-table-container">
              <table className="attendance-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Section</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAttendanceData.slice(0, 20).map((employee) => (
                    <tr
                      key={employee.employee_id}
                      className={employee.is_present ? 'present-row' : 'absent-row'}
                    >
                      <td className="employee-cell">
                        <div className="employee-name">{employee.employee_name}</div>
                        <div className="employee-id">{employee.employee_id}</div>
                      </td>
                      <td className="section-cell">{employee.section_name || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredAttendanceData.length > 20 && (
                <div
                  className="show-more"
                  onClick={() => setShowFullAttendance(true)}
                  style={{ cursor: 'pointer' }}
                >
                  <span>... and {filteredAttendanceData.length - 20} more employees</span>
                </div>
              )}
            </div>
          ) : (
            <div className="no-attendance">No attendance data found for IS division</div>
          )}
        </div>
      </div>

      {showFullAttendance && (
        <div className="attendance-modal-overlay" onClick={() => setShowFullAttendance(false)}>
          <div className="attendance-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="attendance-modal-header">
              <h3>IS Division Attendance - Full List</h3>
              <button className="modal-close-btn" onClick={() => setShowFullAttendance(false)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="attendance-modal-body">
              <div className="attendance-table-container full-view">
                <table className="attendance-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Section</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAttendanceData.map((employee) => (
                      <tr
                        key={employee.employee_id}
                        className={employee.is_present ? 'present-row' : 'absent-row'}
                      >
                        <td className="employee-cell">
                          <div className="employee-name">{employee.employee_name}</div>
                          <div className="employee-id">{employee.employee_id}</div>
                        </td>
                        <td className="section-cell">{employee.section_name || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ISDivisionAttendanceCard;
