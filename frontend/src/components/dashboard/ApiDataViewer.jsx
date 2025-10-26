import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './ApiDataViewer.css';

const ApiDataViewer = () => {
  // Normalized state: all entities use id/code/name and link by IDs
  const [divisions, setDivisions] = useState([]); // [{ id, code, name, ... }]
  const [sections, setSections] = useState([]);   // filtered view
  const [employees, setEmployees] = useState([]); // filtered view
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('divisions');
  const [error, setError] = useState(null);
  const [allSections, setAllSections] = useState([]); // full list of normalized sections
  const [selectedDivision, setSelectedDivision] = useState('all'); // stores divisionId or 'all'
  const [allEmployees, setAllEmployees] = useState([]); // full list of normalized employees
  const [selectedEmployeeDivision, setSelectedEmployeeDivision] = useState('all'); // divisionId or 'all'
  const [selectedSection, setSelectedSection] = useState('all'); // sectionId or 'all'
  const [availableSections, setAvailableSections] = useState([]); // Sections for selected employee division
  const [showEmployeeJson, setShowEmployeeJson] = useState(false);
  const [showDivisionJson, setShowDivisionJson] = useState(false);
  const [showSectionJson, setShowSectionJson] = useState(false);

  // Raw API data (for dynamic tables/JSON displays)
  const [rawDivisions, setRawDivisions] = useState([]);
  const [rawSections, setRawSections] = useState([]);
  const [rawEmployees, setRawEmployees] = useState([]);

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  // Helpers: normalize backend data into a consistent shape
  const orderKeys = (keys, preferredOrder = []) => {
    const set = new Set(keys);
    const ordered = [];
    preferredOrder.forEach(k => {
      if (set.has(k)) {
        ordered.push(k);
        set.delete(k);
      }
    });
    const remaining = Array.from(set).sort();
    return [...ordered, ...remaining];
  };

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
        // Mongo extended JSON patterns
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

  // Helpers: Colombo-only filter logic
  const isColomboString = (s) =>
    typeof s === 'string' && s.toLowerCase().includes('colombo');

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

  // String normalization for fuzzy matches (e.g., spacing/casing differences)
  const normalizeTextKey = (s) => {
    if (!s || typeof s !== 'string') return '';
    return s.replace(/\s+/g, ' ').trim().toLowerCase();
  };

  // Get displayable section name for an employee (prefers hierarchy name)
  const getEmployeeSectionName = (e) => (
    e.sectionHierarchyName || e.sectionName || String(e.sectionId || e.sectionCode || '')
  );

  const normalizeDivisions = (data = []) => {
    const out = [];
    const seen = new Set();
    data.forEach((d) => {
      const id = String(
        d._id ?? d.id ?? d.DIVISION_ID ?? d.code ?? d.hie_code ?? d.DIVISION_CODE ?? ''
      );
      if (!id) return;
      if (seen.has(id)) return;
      seen.add(id);
      out.push({
        id,
        code: String(
          d.code ?? d.DIVISION_CODE ?? d.hie_code ?? d._id ?? d.id ?? id
        ),
        name: d.name ?? d.DIVISION_NAME ?? d.hie_name ?? d.hie_relationship ?? 'Unknown Division',
        def_level: d.def_level ?? d.DEF_LEVEL,
        hie_relationship: d.hie_relationship,
        isActive: d.isActive ?? d.active ?? true,
      });
    });
    // sort by name for nicer UX
    return out.sort((a, b) => a.name.localeCompare(b.name));
  };

  const normalizeSections = (data = []) => {
    const out = [];
    const seen = new Set();
    data.forEach((s) => {
      const id = String(
        s._id ?? s.id ?? s.SECTION_ID ?? s.code ?? s.hie_code ?? s.SECTION_CODE ?? s.section_code ?? ''
      );
      if (!id) return;
      if (seen.has(id)) return;
      seen.add(id);
      const divisionId = String(
        s.division_id ?? s.DIVISION_ID ?? s.division_code ?? s.DIVISION_CODE ?? s.hie_relationship ?? ''
      );
      out.push({
        id,
        code: String(
          s.code ?? s.SECTION_CODE ?? s.hie_code ?? s.section_code ?? id
        ),
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

  const normalizeSectionMeta = (s) => {
    // Return minimal normalized keys from a raw section row
    const id = String(
      s?._id ?? s?.id ?? s?.SECTION_ID ?? s?.code ?? s?.hie_code ?? s?.SECTION_CODE ?? s?.section_code ?? ''
    );
    const divisionId = String(
      s?.division_id ?? s?.DIVISION_ID ?? s?.division_code ?? s?.DIVISION_CODE ?? s?.hie_relationship ?? ''
    );
    return { id, divisionId };
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
        dateOfBirth: parseHrisDate(e.DATE_OF_BIRTH ?? e.date_of_birth ?? e.dob),
        dateOfJoining: parseHrisDate(e.DATE_OF_JOINING ?? e.date_of_joining ?? e.doj),
        divisionHierarchyName: hie3 ?? '',
        sectionHierarchyName: hie4 ?? '',
      });
    });
    return out;
  };

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

  const normalizeEmployeeMeta = (e) => {
    const empNumber = String(e?.EMP_NUMBER ?? e?.empNumber ?? e?.id ?? '');
    const divisionId = String(e?.DIVISION_ID ?? e?.division_id ?? e?.DIVISION_CODE ?? e?.division_code ?? '');
    const sectionId = String(e?.SECTION_ID ?? e?.section_id ?? e?.SECTION_CODE ?? e?.section_code ?? '');
    return { empNumber, divisionId, sectionId };
  };

  const filterSectionsByDivision = (divisionFilter, sourceSections = allSections) => {
    if (!sourceSections.length) {
      setSections([]);
      return;
    }

    if (divisionFilter === 'all') {
      setSections(sourceSections);
      return;
    }

    const filtered = sourceSections.filter(section => String(section.divisionId) === String(divisionFilter));

    setSections(filtered);
  };

  const fetchDivisions = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`${API_BASE_URL}/divisions/hris`);
      if (response.data.success) {
        const apiRows = response.data.data || [];
        setRawDivisions(apiRows);
        const normalized = normalizeDivisions(apiRows);
        setDivisions(normalized);
        
        // Show fallback message if using local data
        if (response.data.fallback) {
          setError(`⚠️ ${response.data.message}`);
        }
      } else {
        setError('Failed to fetch divisions from HRIS API');
      }
    } catch (error) {
      console.error('Error fetching divisions:', error);
      setError(`Failed to fetch divisions: ${error.response?.status || 500}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchSections = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`${API_BASE_URL}/sections/hris`);
      if (response.data.success) {
        const apiRows = response.data.data || [];
        setRawSections(apiRows);
        const sectionData = normalizeSections(apiRows);
        setAllSections(sectionData); // Store all normalized sections
        filterSectionsByDivision(selectedDivision, sectionData); // Apply current division filter
        
        // Show fallback message if using local data
        if (response.data.fallback) {
          setError(`⚠️ ${response.data.message}`);
        }
      } else {
        setError('Failed to fetch sections from HRIS API');
      }
    } catch (error) {
      console.error('Error fetching sections:', error);
      setError(`Failed to fetch sections: ${error.response?.status || 500}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllData = async () => {
    try {
      setLoading(true);
      setError(null);

      const requests = [
        axios.get(`${API_BASE_URL}/users/hris`),
        axios.get(`${API_BASE_URL}/sections/hris`),
        axios.get(`${API_BASE_URL}/divisions/hris`),
      ];

      const [employeeResponse, sectionResponse, divisionResponse] = await Promise.all(requests);

      // Process Divisions
      if (divisionResponse.data.success) {
        const apiRows = divisionResponse.data.data || [];
        setRawDivisions(apiRows);
        const normalizedDivisions = normalizeDivisions(apiRows);
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
        setRawSections(apiRows);
        const sectionData = normalizeSections(apiRows);
        setAllSections(sectionData);
        filterSectionsByDivision(selectedDivision, sectionData);
        if (sectionResponse.data.fallback) {
          setError(prev => prev ?? `⚠️ ${sectionResponse.data.message}`);
        }
      } else {
        setError('Failed to fetch sections from HRIS API');
      }

      // Process Employees
      if (employeeResponse.data.success) {
        const apiRows = employeeResponse.data.data || [];
        const filteredApiRows = apiRows.filter(isColomboEmployeeRaw);
        setRawEmployees(filteredApiRows);
        const normalizedEmployees = normalizeEmployees(filteredApiRows);
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
      setError(`Failed to fetch data: ${error.response?.status || 500}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      setError(null);

      const employeeRequest = axios.get(`${API_BASE_URL}/users/hris`);
      const sectionRequest = allSections.length
        ? Promise.resolve(null)
        : axios.get(`${API_BASE_URL}/sections/hris`);

      const [employeeResponse, sectionResponse] = await Promise.all([employeeRequest, sectionRequest]);

      if (employeeResponse.data.success) {
        const apiRows = employeeResponse.data.data || [];
        const filteredApiRows = apiRows.filter(isColomboEmployeeRaw);
        setRawEmployees(filteredApiRows);
        const normalizedEmployees = normalizeEmployees(filteredApiRows);
        setAllEmployees(normalizedEmployees); // Store all employees (Colombo only)
        setEmployees(normalizedEmployees); // Initially show filtered employees

        if (employeeResponse.data.fallback) {
          setError(`⚠️ ${employeeResponse.data.message}`);
        }
      } else {
        setError('Failed to fetch employees from HRIS API');
      }

      if (sectionResponse) {
        if (sectionResponse.data.success) {
          const apiRows = sectionResponse.data.data || [];
          setRawSections(apiRows);
          const sectionData = normalizeSections(apiRows);
          setAllSections(sectionData);
          filterSectionsByDivision(selectedDivision, sectionData);

          if (sectionResponse.data.fallback) {
            setError(prev => prev ?? `⚠️ ${sectionResponse.data.message}`);
          }
        } else if (!allSections.length) {
          setError('Failed to fetch sections from HRIS API');
        }
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
      setError(`Failed to fetch employees: ${error.response?.status || 500}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'divisions') {
      fetchDivisions();
    } else if (activeTab === 'sections') {
      fetchSections();
    } else if (activeTab === 'employees') {
      fetchAllData();
    }
  }, [activeTab]);

  const renderDivisions = () => (
    <div className="api-table-container">
      <h3>HRIS Divisions (Level 3)</h3>

      <div className="mb-3">
        <button
          className="btn btn-sm btn-outline-secondary"
          onClick={() => setShowDivisionJson(!showDivisionJson)}
        >
          {showDivisionJson ? 'Hide' : 'Show'} Division JSON
        </button>
      </div>

      {showDivisionJson && (
        <div className="json-viewer">
          <pre>{JSON.stringify(divisions, null, 2)}</pre>
        </div>
      )}

      <div className="table-responsive">
        <table className="table table-striped">
          <thead>
            <tr>
              <th>_ID</th>
              <th>NAME</th>
              <th>STATUS</th>
              <th>EMP COUNT</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              // Build a name-normalized count map from the current employee set
              const countsByDivName = new Map();
              allEmployees.forEach(e => {
                const name = (e.divisionHierarchyName || e.divisionName || '');
                const key = normalizeTextKey(name);
                if (!key) return;
                countsByDivName.set(key, (countsByDivName.get(key) || 0) + 1);
              });

              return rawDivisions.map((row, idx) => {
              const key = String(row?._id ?? row?.id ?? row?.code ?? idx);
              const idVal = row?._id ?? row?.id ?? '';
                const nameVal = row?.name ?? row?.DIVISION_NAME ?? row?.hie_name ?? '';
              const statusVal = row?.status ?? (typeof row?.isActive === 'boolean' ? (row.isActive ? 'ACTIVE' : 'INACTIVE') : '');
                const computedCount = countsByDivName.get(normalizeTextKey(String(nameVal))) || 0;
                const empCount = computedCount;
                return (
                  <tr key={key}>
                    <td>{String(idVal)}</td>
                    <td>{String(nameVal)}</td>
                    <td>{String(statusVal)}</td>
                    <td>{String(empCount)}</td>
                  </tr>
                );
              });
            })()}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderSections = () => (
    <div className="api-table-container">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h3>
          HRIS Sections (Level 4)
          <span className="badge bg-primary ms-2">
            {sections.length}
            {selectedDivision !== 'all' && ` of ${allSections.length}`}
          </span>
        </h3>
        <div className="division-filter">
          <label htmlFor="division-select" className="form-label me-2">Filter by Division:</label>
          <select 
            id="division-select"
            className="form-select" 
            value={selectedDivision} 
            onChange={handleDivisionChange}
            style={{ width: 'auto', display: 'inline-block' }}
          >
            <option value="all">All Divisions ({allSections.length} sections)</option>
            {getUniqueDivisions().map(division => (
              <option key={division.id} value={division.id}>
                {division.name} ({allSections.filter(s => String(s.divisionId) === String(division.id)).length} sections)
              </option>
            ))}
          </select>
        </div>
      </div>
      
      {selectedDivision !== 'all' && (
        <div className="alert alert-info mb-3">
          <i className="bi bi-filter"></i>
          Showing sections from: <strong>{getUniqueDivisions().find(d => String(d.id) === String(selectedDivision))?.name || selectedDivision}</strong>
          <span className="ms-2">({sections.length} of {allSections.length} sections)</span>
        </div>
      )}
      
      <div className="mb-3">
        <button
          className="btn btn-sm btn-outline-secondary"
          onClick={() => setShowSectionJson(!showSectionJson)}
        >
          {showSectionJson ? 'Hide' : 'Show'} Section JSON
        </button>
      </div>

      {showSectionJson && (
        <div className="json-viewer">
          {(() => {
            const filteredRaw = selectedDivision === 'all'
              ? rawSections
              : rawSections.filter(rs => String(normalizeSectionMeta(rs).divisionId) === String(selectedDivision));
            return <pre>{JSON.stringify(filteredRaw, null, 2)}</pre>;
          })()}
        </div>
      )}

      <div className="table-responsive">
        <table className="table table-striped">
          <thead>
            <tr>
              <th>_ID</th>
              <th>NAME</th>
              <th>DIVISION CODE</th>
              <th>DIVISION NAME</th>
              <th>EMP COUNT</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              // Build section employee counts across the currently loaded employees (Colombo subset)
              const sectionCounts = new Map();
              allEmployees.forEach(emp => {
                const idKey = emp.sectionId ? String(emp.sectionId) : '';
                const codeKey = emp.sectionCode ? String(emp.sectionCode) : '';
                const nameKey = normalizeTextKey(emp.sectionHierarchyName || emp.sectionName || '');
                if (idKey) sectionCounts.set(idKey, (sectionCounts.get(idKey) || 0) + 1);
                if (codeKey) sectionCounts.set(codeKey, (sectionCounts.get(codeKey) || 0) + 1);
                if (nameKey) sectionCounts.set(nameKey, (sectionCounts.get(nameKey) || 0) + 1);
              });

              // Use normalized, filtered sections for display
              return sections.map((s) => {
                const idKey = String(s.id || '');
                const codeKey = String(s.code || '');
                const nameKey = normalizeTextKey(s.name || '');
                const empCount = (
                  sectionCounts.get(idKey) ||
                  sectionCounts.get(codeKey) ||
                  sectionCounts.get(nameKey) ||
                  0
                );
                return (
                  <tr key={idKey || codeKey || nameKey}>
                    <td>{String(s.id || '')}</td>
                    <td>{String(s.name || '')}</td>
                    <td>{String(s.divisionCode || '')}</td>
                    <td>{String(s.divisionName || '')}</td>
                    <td>{String(empCount)}</td>
                  </tr>
                );
              });
            })()}
          </tbody>
        </table>
      </div>
    </div>
  );

  // Removed separate Display tabs; JSON toggles remain within each section

  const renderEmployees = () => {
    const divisionSelected = selectedEmployeeDivision !== 'all';
    const maps = buildDivisionMaps();
    const employeesInSelectedDivision = divisionSelected
      ? allEmployees.filter(e => getEmployeeDivisionKey(e, maps) === String(selectedEmployeeDivision))
      : [];
    const sectionEmployeeCounts = new Map();

    employeesInSelectedDivision.forEach(employee => {
      const keyId = employee.sectionId ? String(employee.sectionId) : '';
      const keyCode = employee.sectionCode ? String(employee.sectionCode) : '';
      const keyName = normalizeTextKey(employee.sectionHierarchyName || employee.sectionName || '');
      if (keyId) sectionEmployeeCounts.set(keyId, (sectionEmployeeCounts.get(keyId) || 0) + 1);
      if (keyCode) sectionEmployeeCounts.set(keyCode, (sectionEmployeeCounts.get(keyCode) || 0) + 1);
      if (keyName) sectionEmployeeCounts.set(keyName, (sectionEmployeeCounts.get(keyName) || 0) + 1);
    });

  const divisionMap = new Map(divisions.map(d => [String(d.id), d.name]));
    const sectionMap = new Map(allSections.map(s => [String(s.id), s.name]));

    return (
      <div className="api-table-container">
        <div className="d-flex justify-content-between align-items-start mb-3">
          <h3>
            HRIS Employees
            <span className="badge bg-primary ms-2">
              {employees.length}
              {(divisionSelected || selectedSection !== 'all') && allEmployees.length > 0 && (
                ` of ${allEmployees.length}`
              )}
            </span>
          </h3>
            <div className="employee-filters d-flex gap-3">
            {/* Division Filter */}
            <div className="division-filter">
              <label htmlFor="employee-division-select" className="form-label me-2">Division:</label>
              <select 
                id="employee-division-select"
                className="form-select" 
                value={selectedEmployeeDivision} 
                onChange={handleEmployeeDivisionChange}
                style={{ width: 'auto', minWidth: '200px' }}
              >
                <option value="all">All Divisions ({allEmployees.length} employees)</option>
                {getEmployeeDivisions().map(division => (
                  <option key={division.key} value={division.key}>
                    {division.name} ({division.count} employees)
                  </option>
                ))}
              </select>
            </div>
            {/* Section Filter */}
            <div className="section-filter">
              <label htmlFor="employee-section-select" className="form-label me-2">Section:</label>
              <select 
                id="employee-section-select"
                className="form-select" 
                value={selectedSection} 
                onChange={handleSectionChange}
                style={{ width: 'auto', minWidth: '200px' }}
                disabled={!divisionSelected}
              >
                {!divisionSelected ? (
                  <option value="all">Select a division first</option>
                ) : (
                  <>
                    <option value="all">All Sections ({employeesInSelectedDivision.length} employees)</option>
                    {availableSections.length ? (
                      availableSections.map(section => {
                        const idKey = String(section.id || '');
                        const codeKey = String(section.code || '');
                        const nameKey = normalizeTextKey(section.name || '');
                        const count = (
                          sectionEmployeeCounts.get(idKey) ||
                          sectionEmployeeCounts.get(codeKey) ||
                          sectionEmployeeCounts.get(nameKey) ||
                          0
                        );
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

      <div className="mb-3">
        <button
          className="btn btn-sm btn-outline-secondary"
          onClick={() => setShowEmployeeJson(!showEmployeeJson)}
        >
          {showEmployeeJson ? 'Hide' : 'Show'} Employee JSON
        </button>
      </div>

      {showEmployeeJson && (
        <div className="json-viewer">
          {(() => {
            const selObj = availableSections.find(s => String(s.id) === String(selectedSection));
            const selNameKey = normalizeTextKey(selObj?.name || '');
            const filteredRaw = rawEmployees.filter((row) => {
              const meta = normalizeEmployeeMeta(row);
              if (selectedEmployeeDivision !== 'all' && String(meta.divisionId) !== String(selectedEmployeeDivision)) return false;
              if (selectedSection !== 'all') {
                const byIdOrCode = String(meta.sectionId) === String(selectedSection);
                if (byIdOrCode) return true;
                const rowSecName = row.HIE_NAME_4 || row.SECTION_NAME || row?.currentwork?.HIE_NAME_4 || '';
                const rowNameKey = normalizeTextKey(rowSecName);
                return selNameKey && rowNameKey === selNameKey;
              }
              return true;
            });
            return <pre>{JSON.stringify(filteredRaw, null, 2)}</pre>;
          })()}
        </div>
      )}

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
                <td>{employee.divisionHierarchyName || employee.divisionName || divisionMap.get(String(employee.divisionId)) || employee.divisionCode || '-'}</td>
                <td>{employee.sectionHierarchyName || employee.sectionName || sectionMap.get(String(employee.sectionId)) || employee.sectionCode || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>
    );
  };

  // Handle division selection change
  const handleDivisionChange = (event) => {
    const selectedDiv = event.target.value;
    setSelectedDivision(selectedDiv);
    filterSectionsByDivision(selectedDiv);
  };

  // Get unique divisions for the dropdown
  const getUniqueDivisions = () => {
    // Use normalized divisions list directly
    return divisions;
  };

  // Get unique divisions for employee filtering
  const getEmployeeDivisions = () => {
    const maps = buildDivisionMaps();

    // Prefer canonical `divisions` list for dropdown options so users always see known
    // divisions even when employee list is empty. Compute counts from `allEmployees`.
    if (divisions && divisions.length) {
      const counts = new Map();
      allEmployees.forEach(e => {
        const key = getEmployeeDivisionKey(e, maps);
        counts.set(key, (counts.get(key) || 0) + 1);
      });

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

      return [...result, ...extra].sort((a, b) => a.name.localeCompare(b.name));
    }

    // Fallback: derive from employees if no canonical divisions are available
    const buckets = new Map(); // key -> { key, name, count }
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
    return Array.from(buckets.values()).sort((a, b) => a.name.localeCompare(b.name));
  };

  // Get sections for selected division (for employees)
  const deriveSectionsForDivision = (divisionKey) => {
    if (divisionKey === 'all') return [];
    const maps = buildDivisionMaps();
    // If key is id:XYZ, prefer sections by that divisionId
    if (divisionKey.startsWith('id:')) {
      const id = divisionKey.slice(3);
      const byDivision = allSections
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
  }, [selectedEmployeeDivision, allSections, allEmployees]);

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
      // Use the same key format produced by getEmployeeDivisions (id:ID)
      setSelectedEmployeeDivision(`id:${String(target.id)}`);
      autoSelectedDivisionRef.current = true;
      // reset section auto-select flag so the section auto-select can run for this division
      autoSelectedSectionRef.current = false;
    }
  }, [divisions, selectedEmployeeDivision]);

  // After availableSections are derived for the selected division, auto-select an IS section if present
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
      const selNameKey = normalizeTextKey(selObj?.name || '');
      filtered = filtered.filter(emp => {
        const byIdOrCode = String(emp.sectionId || emp.sectionCode) === String(selectedSection);
        if (byIdOrCode) return true;
        const empNameKey = normalizeTextKey(getEmployeeSectionName(emp));
        return selNameKey && empNameKey === selNameKey;
      });
    }

    // Ensure Colombo-only is enforced even if source changes
    filtered = filtered.filter(isColomboEmployeeNormalized);

    setEmployees(filtered);
  }, [allEmployees, selectedEmployeeDivision, selectedSection]);

  const refreshData = () => {
    if (activeTab === 'divisions') {
      fetchDivisions();
    } else if (activeTab === 'sections') {
      fetchSections();
      setSelectedDivision('all'); // Reset filter when refreshing
    } else if (activeTab === 'employees') {
      fetchAllData();
      setSelectedEmployeeDivision('all'); // Reset employee filters when refreshing
      setSelectedSection('all');
      setAvailableSections([]);
    }
    setShowEmployeeJson(false);
    setShowDivisionJson(false);
    setShowSectionJson(false);
  };

  return (
    <div className="api-data-viewer">
      <div className="api-header">
        <h2>
          <i className="bi bi-cloud-download"></i>
          HRIS API Data Viewer
        </h2>
        <button 
          className="btn btn-outline-primary refresh-btn"
          onClick={refreshData}
          disabled={loading}
        >
          <i className="bi bi-arrow-clockwise"></i>
          Refresh
        </button>
      </div>

      <div className="api-tabs">
        <button
          className={`tab-btn ${activeTab === 'divisions' ? 'active' : ''}`}
          onClick={() => setActiveTab('divisions')}
        >
          <i className="bi bi-building"></i>
          Divisions
        </button>
        <button
          className={`tab-btn ${activeTab === 'sections' ? 'active' : ''}`}
          onClick={() => setActiveTab('sections')}
        >
          <i className="bi bi-diagram-3"></i>
          Sections
        </button>
        <button
          className={`tab-btn ${activeTab === 'employees' ? 'active' : ''}`}
          onClick={() => setActiveTab('employees')}
        >
          <i className="bi bi-people"></i>
          Employees
        </button>
      </div>

      <div className="api-content">
        {error && (
          <div className={`alert ${error.includes('⚠️') ? 'alert-warning' : 'alert-danger'}`}>
            <i className={`bi ${error.includes('⚠️') ? 'bi-exclamation-triangle' : 'bi-exclamation-circle'}`}></i>
            {error}
          </div>
        )}

        {loading ? (
          <div className="loading-container">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p>Fetching data from HRIS API...</p>
          </div>
        ) : (
          <>
            {activeTab === 'divisions' && renderDivisions()}
            {activeTab === 'sections' && renderSections()}
            {activeTab === 'employees' && renderEmployees()}
          </>
        )}
      </div>

      <div className="api-stats">
        <div className="stat-card">
          <div className="stat-value">{divisions.length}</div>
          <div className="stat-label">Divisions</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {sections.length}
            {selectedDivision !== 'all' && allSections.length > 0 && (
              <small style={{ fontSize: '0.6em', display: 'block' }}>
                of {allSections.length}
              </small>
            )}
          </div>
          <div className="stat-label">Sections</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {employees.length}
            {(selectedEmployeeDivision !== 'all' || selectedSection !== 'all') && allEmployees.length > 0 && (
              <small style={{ fontSize: '0.6em', display: 'block' }}>
                of {allEmployees.length}
              </small>
            )}
          </div>
          <div className="stat-label">Employees</div>
        </div>
      </div>
    </div>
  );
};

export default ApiDataViewer;