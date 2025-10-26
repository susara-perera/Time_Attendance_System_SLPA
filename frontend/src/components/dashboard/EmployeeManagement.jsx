import React, { useState, useEffect } from 'react';
import './ReportGeneration.css';

const EmployeeManagement = () => {
  const [divisionId, setDivisionId] = useState('all');
  const [sectionId, setSectionId] = useState('all');
  const [divisions, setDivisions] = useState([]);
  const [sections, setSections] = useState([]);
  const [allSections, setAllSections] = useState([]);
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [type, setType] = useState('both');
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDivisions();
    fetchAllSections();
    const today = new Date().toISOString().split('T')[0];
    setDateRange({ startDate: today, endDate: today });
  }, []);

  const fetchDivisions = async () => {
    try {
      const token = localStorage.getItem('token');
      let response = await fetch('http://localhost:5000/api/divisions/hris', { headers: { 'Authorization': `Bearer ${token}` } });
      if (!response.ok) response = await fetch('http://localhost:5000/api/divisions', { headers: { 'Authorization': `Bearer ${token}` } });
      if (response.ok) {
        const data = await response.json();
        const arr = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
        const normalized = arr.map(d => ({ _id: d._id || d.id, name: d.name || d.hie_name || d.DIVISION_NAME || d.division_name }));
        setDivisions(normalized);
      }
    } catch (err) {
      console.error('Error fetching divisions', err);
      setDivisions([]);
    }
  };

  const fetchAllSections = async () => {
    try {
      const token = localStorage.getItem('token');
      let response = await fetch('http://localhost:5000/api/sections/hris', { headers: { 'Authorization': `Bearer ${token}` } });
      if (!response.ok) response = await fetch('http://localhost:5000/api/sections', { headers: { 'Authorization': `Bearer ${token}` } });
      if (response.ok) {
        const data = await response.json();
        const arr = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
        const normalized = arr.map(s => ({ _id: s._id || s.id || s.SECTION_ID, name: s.name || s.section_name || s.SECTION_NAME }));
        setAllSections(normalized);
        setSections(normalized);
      }
    } catch (err) {
      console.error('Error fetching sections', err);
      setAllSections([]);
      setSections([]);
    }
  };

  useEffect(() => {
    if (!divisionId || divisionId === 'all') {
      setSections(allSections);
      setSectionId('all');
      return;
    }

    const fetchSections = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`http://localhost:5000/api/divisions/${divisionId}/mysql-sections`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) {
          const data = await res.json();
          const arr = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
          const normalized = arr.map(s => ({ _id: s._id || s.section_id || s.id, name: s.name || s.section_name || s.section_name }));
          setSections(normalized);
          setSectionId('all');
        } else {
          setSections(allSections);
        }
      } catch (err) {
        console.error('Error fetching division sections', err);
        setSections(allSections);
      }
    };

    fetchSections();
  }, [divisionId, allSections]);

  const handleGenerate = async (e) => {
    e.preventDefault();
    setError('');
    if (!dateRange.startDate || !dateRange.endDate) { setError('Select date range'); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams({ startDate: dateRange.startDate, endDate: dateRange.endDate, type, includeRecords: 'false' });
      if (divisionId && divisionId !== 'all') params.append('divisionId', divisionId);
      if (sectionId && sectionId !== 'all') params.append('sectionId', sectionId);

      const res = await fetch(`http://localhost:5000/api/employees?${params.toString()}`, { headers: { 'Content-Type': 'application/json' } });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Failed to fetch'); setEmployees([]); }
      else setEmployees(Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      console.error('Error fetching employees', err);
      setError('Server error');
      setEmployees([]);
    } finally { setLoading(false); }
  };

  return (
    <div className="report-generation">
      <div className="report-header">
        <div className="header-content">
          <h1><i className="bi bi-people"></i> Employee Management</h1>
          <p className="header-subtitle">List employees and view attendance / meal counts by division, section and date range</p>
        </div>
      </div>

      <div className="report-config">
        <form onSubmit={handleGenerate} className="config-form">
          <div className="form-grid" style={{display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '16px', alignItems: 'end'}}>
            <div className="form-group">
              <label><i className="bi bi-building"></i> Division</label>
              <select value={divisionId} onChange={(e) => setDivisionId(e.target.value)} className="form-control">
                <option value="all">All Divisions</option>
                {divisions.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label><i className="bi bi-diagram-3"></i> Section</label>
              <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} className="form-control">
                <option value="all">All Sections</option>
                {sections.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label><i className="bi bi-calendar3"></i> Start Date</label>
              <input type="date" value={dateRange.startDate} onChange={(e) => setDateRange({...dateRange, startDate: e.target.value})} className="form-control" required />
            </div>

            <div className="form-group">
              <label><i className="bi bi-calendar3"></i> End Date</label>
              <input type="date" value={dateRange.endDate} onChange={(e) => setDateRange({...dateRange, endDate: e.target.value})} className="form-control" required />
            </div>

            <div className="form-group">
              <label><i className="bi bi-list"></i> Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)} className="form-control">
                <option value="both">Attendance & Meal</option>
                <option value="attendance">Attendance Only</option>
                <option value="meal">Meal Only</option>
              </select>
            </div>

            <div className="form-actions" style={{gridColumn: 'span 4', display: 'flex', justifyContent: 'center'}}>
              <button type="submit" className="btn btn-primary btn-generate" disabled={loading}>{loading ? 'Loading...' : 'Search Employees'}</button>
            </div>
          </div>
        </form>
      </div>

      {error && <div className="error-message" style={{margin: '18px'}}>{error}</div>}

      <div style={{padding: 16}}>
        <table className="table" style={{width: '100%', borderCollapse: 'collapse'}}>
          <thead>
            <tr>
              <th>Emp ID</th>
              <th>Name</th>
              <th>Division</th>
              <th>Section</th>
              <th>Attendance Count</th>
              <th>Meal Count</th>
            </tr>
          </thead>
          <tbody>
            {employees.map(emp => (
              <tr key={emp._id}>
                <td>{emp.employeeId}</td>
                <td>{emp.name}</td>
                <td>{emp.division?.name || ''}</td>
                <td>{emp.section?.name || ''}</td>
                <td>{emp.attendanceCount}</td>
                <td>{emp.mealCount}</td>
              </tr>
            ))}
            {employees.length === 0 && (
              <tr><td colSpan={6} style={{textAlign: 'center', padding: 24}}>No employees found for selected filters</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EmployeeManagement;
