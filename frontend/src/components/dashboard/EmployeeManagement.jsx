import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './ReportGeneration.css';

const EmployeeManagement = () => {
  const [divisions, setDivisions] = useState([]);
  const [sections, setSections] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedEmployeeDivision, setSelectedEmployeeDivision] = useState('all');
  const [selectedSection, setSelectedSection] = useState('all');
  const [availableSections, setAvailableSections] = useState([]);
  const [rawEmployees, setRawEmployees] = useState([]);

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  // Helpers: normalize backend data into a consistent shape
  const normalizeDivisions = (data = []) => {
    const out = [];
    const seen = new Set();
    data.forEach((d) => {
      const id = String(d._id ?? d.id ?? d.DIVISION_ID ?? d.code ?? d.hie_code ?? d.DIVISION_CODE ?? '');
      if (!id) return;
      if (seen.has(id)) return;
      seen.add(id);
      out.push({
        id,
        code: String(d.code ?? d.DIVISION_CODE ?? d.hie_code ?? d._id ?? d.id ?? id),
        name: d.name ?? d.DIVISION_NAME ?? d.hie_name ?? d.hie_relationship ?? 'Unknown Division',
        def_level: d.def_level ?? d.DEF_LEVEL,
        hie_relationship: d.hie_relationship,
        isActive: d.isActive ?? d.active ?? true,
      });
    });
    return out.sort((a, b) => a.name.localeCompare(b.name));
  };

  const normalizeSections = (data = []) => {
    const out = [];
    const seen = new Set();
    data.forEach((s) => {
      const id = String(s._id ?? s.id ?? s.SECTION_ID ?? s.code ?? s.hie_code ?? s.SECTION_CODE ?? s.section_code ?? '');
      if (!id) return;
      if (seen.has(id)) return;
      seen.add(id);
      const divisionId = String(s.division_id ?? s.DIVISION_ID ?? s.division_code ?? s.DIVISION_CODE ?? s.hie_relationship ?? '');
      out.push({
        id,
        code: String(s.code ?? s.SECTION_CODE ?? s.hie_code ?? s.section_code ?? id),
        name: s.name ?? s.section_name ?? s.SECTION_NAME ?? s.hie_relationship ?? `Section ${id}`,
        divisionId: divisionId || '',
        divisionCode: String(s.division_code ?? s.DIVISION_CODE ?? ''),
        divisionName: s.division_name ?? s.DIVISION_NAME ?? '',
        def_level: s.def_level ?? s.DEF_LEVEL,
        isActive: s.isActive ?? s.active ?? true,
      });
    });
    return out.sort((a, b) => a.name.localeCompare(b.name));
  };

  const normalizeEmployees = (data = []) => {
    const out = [];
    const seen = new Set();
    data.forEach((e) => {
      const empNumber = String(e.EMP_NUMBER ?? e.empNumber ?? e.id ?? '');
      if (!empNumber) return;
      if (seen.has(empNumber)) return;
      seen.add(empNumber);
      const hie3 = e.HIE_NAME_3 ?? e.hie_name_3 ?? e?.currentwork?.HIE_NAME_3 ?? e?.currentwork?.hie_name_3;
      const hie4 = e.HIE_NAME_4 ?? e.hie_name_4 ?? e?.currentwork?.HIE_NAME_4 ?? e?.currentwork?.hie_name_4;
      out.push({
        empNumber,
        fullName: e.FULLNAME ?? e.fullName ?? e.name ?? 'Unknown',
        callingName: e.CALLING_NAME ?? e.calling_name ?? e.preferredName ?? '',
        designation: e.DESIGNATION ?? e.designation ?? '',
        nic: String(e.NIC ?? e.nic ?? ''),
        divisionId: String(e.DIVISION_ID ?? e.division_id ?? e.DIVISION_CODE ?? e.division_code ?? ''),
        divisionCode: String(e.DIVISION_CODE ?? e.division_code ?? ''),
        divisionName: e.DIVISION_NAME ?? e.division_name ?? hie3 ?? '',
        sectionId: String(e.SECTION_ID ?? e.section_id ?? e.SECTION_CODE ?? e.section_code ?? ''),
        sectionCode: String(e.SECTION_CODE ?? e.section_code ?? ''),
        sectionName: e.SECTION_NAME ?? e.section_name ?? hie4 ?? '',
        gender: e.GENDER ?? e.gender ?? '',
        status: e.STATUS ?? e.status ?? 'ACTIVE',
        dateOfBirth: e.DATE_OF_BIRTH ?? e.date_of_birth ?? e.dob ?? '',
        dateOfJoining: e.DATE_OF_JOINING ?? e.date_of_joining ?? e.doj ?? '',
        divisionHierarchyName: hie3 ?? '',
        sectionHierarchyName: hie4 ?? '',
      });
    });
    return out;
  };

  // Helpers: Colombo-only filter logic
  const isColomboString = (s) => typeof s === 'string' && s.toLowerCase().includes('colombo');

  const isColomboEmployeeRaw = (row) => {
    if (!row) return false;
    return (
      isColomboString(row.DIVISION_NAME) ||
      isColomboString(row.HIE_NAME_3) ||
      isColomboString(row?.currentwork?.HIE_NAME_3) ||
      isColomboString(row?.division_name) ||
      isColomboString(row?.divisionName)
    );
  };

  const isColomboEmployeeNormalized = (e) =>
    isColomboString(e.divisionHierarchyName) || isColomboString(e.divisionName);

  // Build canonical division key/name from employee + known divisions to avoid duplicates in dropdown
  const buildDivisionMaps = () => {
    const codeToId = new Map();
    const nameToId = new Map();
    const idToName = new Map();
    divisions.forEach(d => {
      if (d.code) codeToId.set(String(d.code), String(d.id));
      if (d.name) nameToId.set(String(d.name), String(d.id));
      idToName.set(String(d.id), d.name);
    });
    return { codeToId, nameToId, idToName };
  };

  const getEmployeeDivisionDisplay = (e) => (
    e.divisionHierarchyName || e.divisionName || String(e.divisionId || e.divisionCode || 'Unknown Division')
  );

  const getEmployeeDivisionKey = (e, maps) => {
    const id = String(e.divisionId || '');
    if (id && maps?.idToName?.has(id)) return `id:${id}`;
    const code = String(e.divisionCode || '');
    if (code && maps?.codeToId?.has(code)) return `id:${maps.codeToId.get(code)}`;
    const name = getEmployeeDivisionDisplay(e);
    if (name && maps?.nameToId?.has(name)) return `id:${maps.nameToId.get(name)}`;
    return `name:${name}`;
  };

  // Get unique divisions for employee filtering
  const getEmployeeDivisions = () => {
    const maps = buildDivisionMaps();
    console.log('getEmployeeDivisions - divisions:', divisions.length, 'allEmployees:', allEmployees.length);

    if (divisions && divisions.length) {
      const counts = new Map();
      allEmployees.forEach(e => {
        const key = getEmployeeDivisionKey(e, maps);
        counts.set(key, (counts.get(key) || 0) + 1);
      });
      console.log('Division counts:', Array.from(counts.entries()));

      const result = divisions.map(d => {
        const key = `id:${String(d.id)}`;
        return {
          key,
          name: d.name,
          count: counts.get(key) || 0,
        };
      });

      // Also include any divisions derived from employees that aren't in the canonical list
      const extra = [];
      const seen = new Set(result.map(r => r.key));
      allEmployees.forEach(e => {
        const k = getEmployeeDivisionKey(e, maps);
        if (!seen.has(k)) {
          seen.add(k);
          extra.push({ key: k, name: getEmployeeDivisionDisplay(e), count: 1 });
        } else {
          // increment count for extras if present
          const ex = extra.find(x => x.key === k);
          if (ex) ex.count += 1;
        }
      });

      const finalResult = [...result, ...extra].sort((a, b) => a.name.localeCompare(b.name));
      console.log('Final divisions:', finalResult);
      return finalResult;
    }

    // Fallback: derive from employees if no canonical divisions are available
    console.log('Using fallback - deriving divisions from employees');
    const buckets = new Map();
    allEmployees.forEach(e => {
      const key = getEmployeeDivisionKey(e, maps);
      const name = getEmployeeDivisionDisplay(e);
      const existing = buckets.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        buckets.set(key, { key, name, count: 1 });
      }
    });
    const fallbackResult = Array.from(buckets.values()).sort((a, b) => a.name.localeCompare(b.name));
    console.log('Fallback divisions:', fallbackResult);
    return fallbackResult;
  };

  // Get sections for selected division (for employees)
  const deriveSectionsForDivision = (divisionKey) => {
    if (divisionKey === 'all') return [];
    const maps = buildDivisionMaps();
    // If key is id:XYZ, prefer sections by that divisionId
    if (divisionKey.startsWith('id:')) {
      const id = divisionKey.slice(3);
      const byDivision = sections
        .filter(section => String(section.divisionId) === String(id))
        .map(section => ({ id: section.id, code: section.code, name: section.name }));
      if (byDivision.length) {
        const seen = new Set();
        const unique = [];
        byDivision.forEach(s => { if (!seen.has(s.id)) { seen.add(s.id); unique.push(s); } });
        return unique.sort((a, b) => a.name.localeCompare(b.name));
      }
    }
    // Fallback: derive from employees in case sections are unavailable or key is name-based
    const employeeSections = [];
    const employeeSeen = new Set();
    allEmployees
      .filter(emp => getEmployeeDivisionKey(emp, maps) === String(divisionKey))
      .forEach(employee => {
        const sectionKey = employee.sectionId || employee.sectionCode;
        const sectionName = employee.sectionHierarchyName || employee.sectionName || String(sectionKey);
        const key = String(sectionKey || '');
        if (key && !employeeSeen.has(key)) {
          employeeSeen.add(key);
          employeeSections.push({ id: key, code: key, name: sectionName });
        }
      });
    return employeeSections.sort((a, b) => a.name.localeCompare(b.name));
  };

  const fetchAllData = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      const requests = [
        axios.get(`${API_BASE_URL}/users/hris`, { headers }),
        axios.get(`${API_BASE_URL}/sections/hris`, { headers }),
        axios.get(`${API_BASE_URL}/divisions/hris`, { headers }),
      ];

      const [employeeResponse, sectionResponse, divisionResponse] = await Promise.all(requests);

      console.log('Division Response:', divisionResponse.data);
      console.log('Section Response:', sectionResponse.data);
      console.log('Employee Response:', employeeResponse.data);

      // Process Divisions
      if (divisionResponse.data.success) {
        const apiRows = divisionResponse.data.data || [];
        console.log('Raw divisions:', apiRows.length);
        const normalizedDivisions = normalizeDivisions(apiRows);
        console.log('Normalized divisions:', normalizedDivisions.length);
        setDivisions(normalizedDivisions);
        if (divisionResponse.data.fallback) {
          setError(`⚠️ ${divisionResponse.data.message}`);
        }
      } else {
        setError('Failed to fetch divisions from HRIS API');
      }

      // Process Sections
      if (sectionResponse.data.success) {
        const apiRows = sectionResponse.data.data || [];
        console.log('Raw sections:', apiRows.length);
        const sectionData = normalizeSections(apiRows);
        console.log('Normalized sections:', sectionData.length);
        setSections(sectionData);
        if (sectionResponse.data.fallback) {
          setError(prev => prev ?? `⚠️ ${sectionResponse.data.message}`);
        }
      } else {
        setError('Failed to fetch sections from HRIS API');
      }

      // Process Employees
      if (employeeResponse.data.success) {
        const apiRows = employeeResponse.data.data || [];
        console.log('Raw employees:', apiRows.length);
        const filteredApiRows = apiRows.filter(isColomboEmployeeRaw);
        console.log('Filtered Colombo employees:', filteredApiRows.length);
        setRawEmployees(filteredApiRows);
        const normalizedEmployees = normalizeEmployees(filteredApiRows);
        console.log('Normalized employees:', normalizedEmployees.length);
        setAllEmployees(normalizedEmployees);
        setEmployees(normalizedEmployees);
        if (employeeResponse.data.fallback) {
          setError(prev => prev ?? `⚠️ ${employeeResponse.data.message}`);
        }
      } else {
        setError('Failed to fetch employees from HRIS API');
      }

    } catch (error) {
      console.error('Error fetching data:', error);
      setError(`Failed to fetch data: ${error.response?.data?.message || error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Handle employee division selection change
  const handleEmployeeDivisionChange = (event) => {
    const selectedDiv = event.target.value;
    setSelectedEmployeeDivision(selectedDiv);
    setSelectedSection('all'); // Reset section when division changes
  };

  // Handle employee section selection change
  const handleSectionChange = (event) => {
    const selectedSec = event.target.value;
    setSelectedSection(selectedSec);
  };

  useEffect(() => {
    if (selectedEmployeeDivision === 'all') {
      setAvailableSections([]);
      return;
    }

    const sectionsForDivision = deriveSectionsForDivision(selectedEmployeeDivision);
    setAvailableSections(sectionsForDivision);
  }, [selectedEmployeeDivision, sections, allEmployees]);

  // Auto-select default division 'IS' (Information Systems) when available
  const autoSelectedDivisionRef = useRef(false);
  const autoSelectedSectionRef = useRef(false);

  useEffect(() => {
    if (selectedEmployeeDivision !== 'all') return; // don't override user's choice
    if (!divisions || !divisions.length) return;
    if (autoSelectedDivisionRef.current) return; // only auto-select once

    const target = divisions.find(d => {
      const code = String(d.code || '').toLowerCase();
      const name = String(d.name || '').toLowerCase();
      return code === 'is' || name.includes('information systems') || name.includes('information system');
    });

    if (target) {
      setSelectedEmployeeDivision(`id:${String(target.id)}`);
      autoSelectedDivisionRef.current = true;
      // reset section auto-select flag so the section auto-select can run for this division
      autoSelectedSectionRef.current = false;
    }
  }, [divisions, selectedEmployeeDivision]);

  // After availableSections are derived for the selected division, auto-select an IS section if present
  useEffect(() => {
    if (selectedSection !== 'all') return; // don't override user's choice
    if (!availableSections || !availableSections.length) return;
    if (autoSelectedSectionRef.current) return; // only auto-select once per lifecycle

    const sec = availableSections.find(s => {
      const code = String(s.code || '').toLowerCase();
      const name = String(s.name || '').toLowerCase();
      return code === 'is' || name.includes('(is)') || name.includes('information systems') || name.includes('information system');
    });

    if (sec) {
      setSelectedSection(String(sec.id));
      autoSelectedSectionRef.current = true;
    }
  }, [availableSections, selectedSection]);

  useEffect(() => {
    let filtered = allEmployees;

    if (selectedEmployeeDivision !== 'all') {
      const maps = buildDivisionMaps();
      filtered = filtered.filter(emp => getEmployeeDivisionKey(emp, maps) === String(selectedEmployeeDivision));
    }
    if (selectedSection !== 'all') {
      const selObj = availableSections.find(s => String(s.id) === String(selectedSection));
      const selNameKey = String(selObj?.name || '').toLowerCase().trim().replace(/\s+/g, ' ');
      filtered = filtered.filter(emp => {
        const byIdOrCode = String(emp.sectionId || emp.sectionCode) === String(selectedSection);
        if (byIdOrCode) return true;
        const empNameKey = String(emp.sectionHierarchyName || emp.sectionName || '').toLowerCase().trim().replace(/\s+/g, ' ');
        return selNameKey && empNameKey === selNameKey;
      });
    }

    // Ensure Colombo-only is enforced even if source changes
    filtered = filtered.filter(isColomboEmployeeNormalized);

    setEmployees(filtered);
  }, [allEmployees, selectedEmployeeDivision, selectedSection]);

  const refreshData = () => {
    fetchAllData();
    setSelectedEmployeeDivision('all');
    setSelectedSection('all');
    setAvailableSections([]);
  };

  return (
    <div className="report-generation">
      <div className="report-header">
        <div className="header-content">
          <h1>
            <i className="bi bi-people"></i>
            Employee Management
          </h1>
          <p className="header-subtitle">View all employee records from HRIS API with division and section filtering</p>
        </div>
      </div>

  <div className="report-config" style={{ marginTop: '12px' }}>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div className="d-flex gap-3">
            {/* Division Filter */}
            <div className="division-filter d-flex align-items-center">
              <label htmlFor="employee-division-select" className="form-label mb-0 me-2" style={{ minWidth: '90px' }}>Division:</label>
              <select 
                id="employee-division-select"
                className="form-select" 
                value={selectedEmployeeDivision} 
                onChange={handleEmployeeDivisionChange}
                style={{ width: 'auto', minWidth: '200px' }}
                disabled={loading}
              >
                <option value="all">All Divisions ({allEmployees.length} employees)</option>
                {!loading && getEmployeeDivisions().map(division => (
                  <option key={division.key} value={division.key}>
                    {division.name} ({division.count} employees)
                  </option>
                ))}
              </select>
            </div>
            {/* Section Filter */}
            <div className="section-filter d-flex align-items-center">
              <label htmlFor="employee-section-select" className="form-label mb-0 me-2" style={{ minWidth: '90px' }}>Section:</label>
              <select 
                id="employee-section-select"
                className="form-select" 
                value={selectedSection} 
                onChange={handleSectionChange}
                style={{ width: 'auto', minWidth: '200px' }}
                disabled={!selectedEmployeeDivision || selectedEmployeeDivision === 'all'}
              >
                {!selectedEmployeeDivision || selectedEmployeeDivision === 'all' ? (
                  <option value="all">Select a division first</option>
                ) : (
                  <>
                    <option value="all">All Sections ({employees.length} employees)</option>
                    {availableSections.length ? (
                      availableSections.map(section => {
                        // Count employees in this section - match by ID, code, or name
                        const maps = buildDivisionMaps();
                        const normalizeTextKey = (s) => String(s || '').toLowerCase().trim().replace(/\s+/g, ' ');
                        const sectionNameKey = normalizeTextKey(section.name);
                        
                        const count = allEmployees.filter(emp => {
                          // Must be in the selected division first
                          if (getEmployeeDivisionKey(emp, maps) !== String(selectedEmployeeDivision)) {
                            return false;
                          }
                          
                          // Match by section ID or code
                          const byIdOrCode = String(emp.sectionId || emp.sectionCode) === String(section.id);
                          if (byIdOrCode) return true;
                          
                          // Match by section name (normalized)
                          const empSectionName = normalizeTextKey(emp.sectionHierarchyName || emp.sectionName || '');
                          return sectionNameKey && empSectionName === sectionNameKey;
                        }).length;
                        
                        return (
                          <option key={section.id} value={section.id}>
                            {section.name} ({count} employees)
                          </option>
                        );
                      })
                    ) : (
                      <option value="__no_sections" disabled>No sections available</option>
                    )}
                  </>
                )}
              </select>
            </div>
          </div>
          <button 
            className="btn btn-outline-primary refresh-btn"
            onClick={refreshData}
            disabled={loading}
          >
            <i className="bi bi-arrow-clockwise"></i>
            Refresh
          </button>
        </div>

        {/* Filter Status Info */}
        {(selectedEmployeeDivision !== 'all' || selectedSection !== 'all') && (
          <div className="alert alert-info mb-3">
            <i className="bi bi-filter"></i>
            Showing employees from: 
            {selectedEmployeeDivision !== 'all' && (
              <strong className="ms-1">
                {getEmployeeDivisions().find(d => String(d.key) === String(selectedEmployeeDivision))?.name || selectedEmployeeDivision}
              </strong>
            )}
            {selectedSection !== 'all' && (
              <>
                <i className="bi bi-arrow-right mx-2"></i>
                <strong>
                  {availableSections.find(s => String(s.id) === String(selectedSection))?.name || selectedSection}
                </strong>
              </>
            )}
            <span className="ms-2">({employees.length} of {allEmployees.length} employees)</span>
          </div>
        )}
      </div>

      {error && (
        <div className={`alert ${error.includes('⚠️') ? 'alert-warning' : 'alert-danger'}`} style={{margin: '18px'}}>
          <i className={`bi ${error.includes('⚠️') ? 'bi-exclamation-triangle' : 'bi-exclamation-circle'}`}></i>
          {error}
        </div>
      )}

      {loading ? (
        <div className="loading-container" style={{padding: 16}}>
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p>Fetching data from HRIS API...</p>
        </div>
      ) : (
        <div style={{padding: 16}}>
          <div className="table-responsive">
            <table className="table table-striped">
              <thead>
                <tr>
                  <th>Employee ID</th>
                  <th>Full Name</th>
                  <th>Designation</th>
                  <th>Gender</th>
                  <th>NIC</th>
                  <th>Division</th>
                  <th>Section</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((employee) => (
                  <tr key={employee.empNumber}>
                    <td>{employee.empNumber}</td>
                    <td>{employee.fullName}</td>
                    <td>{employee.designation}</td>
                    <td>{employee.gender}</td>
                    <td>{employee.nic}</td>
                    <td>{employee.divisionHierarchyName || employee.divisionName || '-'}</td>
                    <td>{employee.sectionHierarchyName || employee.sectionName || '-'}</td>
                  </tr>
                ))}
                {employees.length === 0 && (
                  <tr><td colSpan={7} style={{textAlign: 'center', padding: 24}}>No employees found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeManagement;
