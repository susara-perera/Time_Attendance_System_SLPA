import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './ReportGeneration.css';
import { useLanguage } from '../../context/LanguageContext';

const EmployeeManagement = () => {
  const [divisions, setDivisions] = useState([]);
  const [sections, setSections] = useState([]);
  const [subSections, setSubSections] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [transferredEmployees, setTransferredEmployees] = useState([]);
  const [transferMatchesCount, setTransferMatchesCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedEmployeeDivision, setSelectedEmployeeDivision] = useState('all');
  const [selectedSection, setSelectedSection] = useState('all');
  const [selectedSubSection, setSelectedSubSection] = useState('all');
  const [availableSections, setAvailableSections] = useState([]);
  const [availableSubSections, setAvailableSubSections] = useState([]);
  // raw HRIS rows (unfiltered) -- used to lookup employees for transfers even if they don't match Colombo filter
  const [rawEmployees, setRawEmployees] = useState([]);
  // normalized list of *all* HRIS employees (not Colombo filtered), used for matching transfers and cross-check
  const [normalizedAllHrisEmployees, setNormalizedAllHrisEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
  const { t } = useLanguage();

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

      // Log base URL and token state for easier debugging of 404s
      console.log('Fetching HRIS data', { API_BASE_URL, tokenPresent: !!token });

      const endpoints = [
        { key: 'employees', url: `${API_BASE_URL}/users/hris` },
        { key: 'sections', url: `${API_BASE_URL}/sections/hris` },
        { key: 'divisions', url: `${API_BASE_URL}/divisions/hris` },
        // Use MySQL-backed subsections endpoint (MongoDB subsections route disabled on server)
        { key: 'subsections', url: `${API_BASE_URL}/mysql-subsections` },
      ];

      // Execute requests without failing them all if a single endpoint returns an error
      const results = await Promise.allSettled(endpoints.map(ep => axios.get(ep.url, { headers })));
      const responses = {};
      const failedEndpoints = [];
      results.forEach((r, idx) => {
        const ep = endpoints[idx];
        if (r.status === 'fulfilled') {
          responses[ep.key] = r.value;
          console.log(`${ep.key} OK:`, ep.url);
        } else {
          failedEndpoints.push({ key: ep.key, url: ep.url, reason: r.reason });
          console.warn(`${ep.key} failed:`, ep.url, r.reason?.response?.status || r.reason?.message);
          responses[ep.key] = null;
        }
      });

      const employeeResponse = responses.employees;
      const sectionResponse = responses.sections;
      const divisionResponse = responses.divisions;
      const subSectionResponse = responses.subsections;

      // If some endpoints failed, create a helpful aggregated message for the UI
      if (failedEndpoints.length) {
        const failList = failedEndpoints.map(f => {
          const status = f.reason?.response?.status || 'network_error';
          return `${f.key} (${status})`;
        }).join(', ');
        const anySuccess = Object.values(responses).some(r => !!r);
        const endpointWarning = anySuccess ? `⚠️ Some endpoints failed: ${failList}` : `Failed to fetch: ${failList}`;
        // If no other error already set, set the aggregated message
        setError(prev => prev ?? endpointWarning);
      }

      console.log('Division Response:', divisionResponse?.data);
      console.log('Section Response:', sectionResponse?.data);
      console.log('Employee Response:', employeeResponse?.data);

      // Process Divisions
      if (divisionResponse?.data?.success) {
        const apiRows = divisionResponse.data.data || [];
        console.log('Raw divisions:', apiRows.length);
        const normalizedDivisions = normalizeDivisions(apiRows);
        console.log('Normalized divisions:', normalizedDivisions.length);
        setDivisions(normalizedDivisions);
        if (divisionResponse.data.fallback) {
          setError(`⚠️ ${divisionResponse.data.message}`);
        }
      } else if (!divisionResponse) {
        setError(prev => prev ?? `Failed to fetch divisions: endpoint not reachable (404/Network)`);
      } else {
        setError(prev => prev ?? 'Failed to fetch divisions from HRIS API');
      }

      // Process Sections
      if (sectionResponse?.data?.success) {
        const apiRows = sectionResponse.data.data || [];
        console.log('Raw sections:', apiRows.length);
        const sectionData = normalizeSections(apiRows);
        console.log('Normalized sections:', sectionData.length);
        setSections(sectionData);
        if (sectionResponse.data.fallback) {
          setError(prev => prev ?? `⚠️ ${sectionResponse.data.message}`);
        }
      } else if (!sectionResponse) {
        setError(prev => prev ?? `Failed to fetch sections: endpoint not reachable (404/Network)`);
      } else {
        setError(prev => prev ?? 'Failed to fetch sections from HRIS API');
      }

      // Process Sub-Sections
      if (subSectionResponse?.data?.success) {
        const apiRows = subSectionResponse.data.data || [];
        console.log('Raw sub-sections:', apiRows.length);
        console.log('Sub-sections data:', apiRows);
        if (apiRows.length > 0) {
          console.log('Sample sub-section:', apiRows[0]);
        }
        setSubSections(apiRows);
      } else if (!subSectionResponse) {
        console.warn('Failed to fetch sub-sections: endpoint not reachable (404/Network)');
      } else {
        console.warn('Failed to fetch sub-sections');
      }

      // Process Employees
      if (employeeResponse?.data?.success) {
        const apiRows = employeeResponse.data.data || [];
        console.log('Raw (HRIS) employees total:', apiRows.length);
        // keep full HRIS list (normalized) for transfer lookups and other fallbacks
        const allNormalized = normalizeEmployees(apiRows);
        setNormalizedAllHrisEmployees(allNormalized);

        // Apply existing Colombo filter for default UI list
        const filteredApiRows = apiRows.filter(isColomboEmployeeRaw);
        console.log('Filtered (Colombo) HRIS employees:', filteredApiRows.length);
        setRawEmployees(filteredApiRows);
        const normalizedEmployees = normalizeEmployees(filteredApiRows);
        console.log('Normalized (Colombo) employees:', normalizedEmployees.length);
        setAllEmployees(normalizedEmployees);
        setEmployees(normalizedEmployees);
        if (employeeResponse.data.fallback) {
          setError(prev => prev ?? `⚠️ ${employeeResponse.data.message}`);
        }
      } else if (!employeeResponse) {
        setError(prev => prev ?? `Failed to fetch employees: endpoint not reachable (404/Network)`);
      } else {
        setError(prev => prev ?? 'Failed to fetch employees from HRIS API');
      }

      // Fetch all transferred employees
      // Use MySQL-backed transfer endpoint
      const transferResponse = await axios.get(`${API_BASE_URL}/mysql-subsections/transferred/all/list`, { headers }).catch(err => {
        console.warn('transfer endpoint fetch failed:', err?.response?.status || err?.message);
        return null;
      });
      if (transferResponse?.data?.success) {
        const transferredData = transferResponse.data.data || [];
        console.log('Transferred employees:', transferredData.length);
        console.log('Transferred employees data:', transferredData);
        if (transferredData.length > 0) {
          console.log('Sample transferred employee:', transferredData[0]);
        }
        setTransferredEmployees(transferredData);
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
    setSelectedSubSection('all'); // Reset sub-section when division changes
  };

  // Handle employee section selection change
  const handleSectionChange = (event) => {
    const selectedSec = event.target.value;
    setSelectedSection(selectedSec);
    setSelectedSubSection('all'); // Reset sub-section when section changes
  };

  // Handle sub-section selection change
  const handleSubSectionChange = (event) => {
    const selectedSubSec = event.target.value;
    setSelectedSubSection(selectedSubSec);
  };

  useEffect(() => {
    if (selectedEmployeeDivision === 'all') {
      setAvailableSections([]);
      setAvailableSubSections([]);
      return;
    }

    const sectionsForDivision = deriveSectionsForDivision(selectedEmployeeDivision);
    setAvailableSections(sectionsForDivision);
  }, [selectedEmployeeDivision, sections, allEmployees]);

  // Update available sub-sections when section changes
  useEffect(() => {
    if (selectedSection === 'all' || !selectedSection) {
      setAvailableSubSections([]);
      return;
    }

    // Get the selected section object to access its code and name
    const selectedSectionObj = sections.find(s => String(s.id) === String(selectedSection));
    
    console.log('Selected section object:', selectedSectionObj);
    console.log('All sub-sections:', subSections.length);
    
    if (!selectedSectionObj) {
      console.warn('Selected section not found:', selectedSection);
      setAvailableSubSections([]);
      return;
    }

    // Filter sub-sections by matching:
    // 1. parentSection.id === selectedSection (direct match)
    // 2. parentSection.hie_code === section.code (match by code)
    // 3. parentSection.id === section.code (alternate match)
    const subSectionsForSection = subSections.filter(subSec => {
      const parentSecId = String(subSec.parentSection?.id || '');
      const parentSecCode = String(subSec.parentSection?.hie_code || '');
      const selectedSecId = String(selectedSection);
      const selectedSecCode = String(selectedSectionObj.code || '');
      
      const matchById = parentSecId === selectedSecId;
      const matchByCode = parentSecCode && selectedSecCode && parentSecCode === selectedSecCode;
      const matchByIdToCode = parentSecId && selectedSecCode && parentSecId === selectedSecCode;
      
      const isMatch = matchById || matchByCode || matchByIdToCode;
      
      if (isMatch) {
        console.log(`✅ SubSection match found: ${subSec.subSection?.sub_hie_name}`, {
          parentSecId,
          parentSecCode,
          selectedSecId,
          selectedSecCode,
          matchById,
          matchByCode,
          matchByIdToCode
        });
      }
      
      return isMatch;
    });
    
    console.log('Sub-sections for section', selectedSection, ':', subSectionsForSection.length);
    setAvailableSubSections(subSectionsForSection);
  }, [selectedSection, subSections, sections]);

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

    // Special handling for sub-section selection
    if (selectedSubSection !== 'all') {
      console.log('=== Sub-section filtering active ===');
      console.log('Selected sub-section:', selectedSubSection);
      console.log('Total transferred employees:', transferredEmployees.length);
      console.log('Total HRIS employees:', allEmployees.length);
      
      // Get transferred employees for this sub-section
      const transfersInSubSection = transferredEmployees.filter(transfer => 
        String(transfer.sub_section_id) === String(selectedSubSection)
      );
      setTransferMatchesCount(transfersInSubSection.length);
      
      console.log('Transfers in this sub-section:', transfersInSubSection.length);
      transfersInSubSection.forEach(t => {
        console.log('  - transfer record:', {
          employeeId: t.employeeId || t.employee_id || t.employeeId || t.empId,
          employeeName: t.employeeName || t.employee_name || t.employeeName,
          divisionCode: t.division_code || t.divisionCode,
          divisionName: t.division_name || t.divisionName,
          sectionCode: t.hie_code || t.section_code || t.sectionCode,
          sectionName: t.hie_name || t.section_name || t.sectionName,
          sub_section_id: t.sub_section_id
        });
      });
      
      const transferredEmployeeIds = transfersInSubSection.map(t => String(
        t.employeeId || t.employee_id || t.employeeId || t.empId || t.employeeId || t.employee_id
      ));
      console.log('Transferred employee IDs:', transferredEmployeeIds);

      // Match with the full normalized HRIS dataset regardless of Colombo filter, so transferred employees show even if
      // they aren't in the Colombo-only `allEmployees` set used for the main grid.
      const hrisToSearch = (normalizedAllHrisEmployees && normalizedAllHrisEmployees.length) ? normalizedAllHrisEmployees : allEmployees;
      // Also collect a set of parsed integer values of transfer ids for numeric ID matching
      const transferIdsAsNumbers = new Set(transferredEmployeeIds.map(id => {
        const n = Number(id);
        return (isNaN(n) ? id : String(n));
      }));
      filtered = hrisToSearch.filter(emp => {
        const empId = String(emp.empNumber || emp.EMP_NUMBER || emp.employeeId || emp.employee_ID || emp.employee_id || '');
        const isMatch = transferredEmployeeIds.includes(empId) || transferIdsAsNumbers.has(empId);
        if (isMatch) {
          console.log(`✅ Found employee: ${emp.fullName} (${empId})`);
        }
        return isMatch;
      });
      
      console.log(`Matched ${filtered.length} employees for sub-section`);
      if (transfersInSubSection.length > 0 && filtered.length === 0) {
        console.warn('No HRIS employee records found for transferred employee IDs in this sub-section', transfersInSubSection.map(t => t.employeeId));
      }
    } else {
      // Normal division/section filtering (when no sub-section is selected)
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
    }

    // If no sub-section is selected, enforce Colombo-only filter to keep the default list Colombo-focused.
    // If a sub-section is selected, we intentionally skip the Colombo-only filter so transferred employees
    // (which may belong to other divisions) are still shown.
    if (selectedSubSection === 'all') {
      filtered = filtered.filter(isColomboEmployeeNormalized);
    }

    // Apply search filter
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(emp => {
        const empId = String(emp.empNumber || '').toLowerCase();
        const empName = String(emp.fullName || '').toLowerCase();
        const empDesignation = String(emp.designation || '').toLowerCase();
        const empNic = String(emp.nic || '').toLowerCase();
        
        return empId.includes(search) || 
               empName.includes(search) || 
               empDesignation.includes(search) ||
               empNic.includes(search);
      });
    }

    setEmployees(filtered);
  }, [allEmployees, normalizedAllHrisEmployees, selectedEmployeeDivision, selectedSection, selectedSubSection, transferredEmployees, availableSections, searchTerm]);

  const refreshData = () => {
    fetchAllData();
    setSelectedEmployeeDivision('all');
    setSelectedSection('all');
    setSelectedSubSection('all');
    setAvailableSections([]);
    setAvailableSubSections([]);
    setSearchTerm('');
  };

  return (
    <div className="report-generation">
      <div className="report-header">
        <div className="header-content">
          <h1>
            <i className="bi bi-people"></i>
            {t('employeeManagement')}
          </h1>
          <p className="header-subtitle">{t('employeeHeaderSubtitle')}</p>
        </div>
      </div>

      {/* Active Filters Display - Moved before filter section */}
      {(selectedEmployeeDivision !== 'all' || selectedSection !== 'all' || selectedSubSection !== 'all') && (
        <div style={{
          background: 'linear-gradient(135deg, #667eea15 0%, #764ba215 100%)',
          border: '2px solid #667eea',
          borderRadius: '8px',
          padding: '16px 20px',
          margin: '20px 20px 0 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <i className="bi bi-funnel-fill" style={{ color: '#667eea', fontSize: '20px' }}></i>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: '600', color: '#495057', marginBottom: '4px' }}>{t('activeFiltersLabel')}</div>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              {selectedEmployeeDivision !== 'all' && (
                <span style={{
                  background: '#667eea',
                  color: 'white',
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontSize: '13px',
                  fontWeight: '500'
                }}>
                  {getEmployeeDivisions().find(d => String(d.key) === String(selectedEmployeeDivision))?.name || selectedEmployeeDivision}
                </span>
              )}
              {selectedSection !== 'all' && (
                <>
                  <i className="bi bi-chevron-right" style={{ color: '#667eea' }}></i>
                  <span style={{
                    background: '#764ba2',
                    color: 'white',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '13px',
                    fontWeight: '500'
                  }}>
                    {availableSections.find(s => String(s.id) === String(selectedSection))?.name || selectedSection}
                  </span>
                </>
              )}
              {selectedSubSection !== 'all' && (
                <>
                  <i className="bi bi-chevron-right" style={{ color: '#667eea' }}></i>
                  <span style={{
                    background: '#f093fb',
                    color: 'white',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '13px',
                    fontWeight: '500'
                  }}>
                    {availableSubSections.find(ss => String(ss._id) === String(selectedSubSection))?.subSection?.sub_hie_name || 
                     availableSubSections.find(ss => String(ss._id) === String(selectedSubSection))?.subSection?.hie_name || 
                     selectedSubSection}
                  </span>
                </>
              )}
            </div>
          </div>
          <div style={{
            background: 'white',
            padding: '8px 16px',
            borderRadius: '20px',
            fontWeight: '600',
            color: '#667eea',
            fontSize: '14px',
            border: '2px solid #667eea'
          }}>
            {employees.length} of {allEmployees.length} employees
          </div>
        </div>
      )}

      <div className="report-config" style={{ padding: '16px 20px', background: 'white', borderRadius: '8px', margin: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.08)' }}>
        {/* Compact Filters Section */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          {/* Division Filter */}
          <div style={{ flex: '1', minWidth: '200px' }}>
            <label htmlFor="employee-division-select" style={{ 
              fontWeight: '600', 
              color: '#495057',
              fontSize: '12px',
              display: 'block',
              marginBottom: '4px'
            }}>
              {t('divisionLabel')}
            </label>
            <select 
              id="employee-division-select"
              className="form-select" 
              value={selectedEmployeeDivision} 
              onChange={handleEmployeeDivisionChange}
              style={{ 
                padding: '8px 10px',
                fontSize: '13px',
                border: '1px solid #dee2e6',
                borderRadius: '4px'
              }}
              disabled={loading}
            >
              <option value="all">{t('allDivisionsLabel')}</option>
              {!loading && getEmployeeDivisions().map(division => (
                <option key={division.key} value={division.key}>
                  {division.name} ({division.count})
                </option>
              ))}
            </select>
          </div>

          {/* Section Filter */}
          <div style={{ flex: '1', minWidth: '200px' }}>
            <label htmlFor="employee-section-select" style={{ 
              fontWeight: '600', 
              color: '#495057',
              fontSize: '12px',
              display: 'block',
              marginBottom: '4px'
            }}>
              {t('sectionLabel')}
            </label>
            <select 
              id="employee-section-select"
              className="form-select" 
              value={selectedSection} 
              onChange={handleSectionChange}
              style={{ 
                padding: '8px 10px',
                fontSize: '13px',
                border: '1px solid #dee2e6',
                borderRadius: '4px'
              }}
              disabled={!selectedEmployeeDivision || selectedEmployeeDivision === 'all'}
            >
                {!selectedEmployeeDivision || selectedEmployeeDivision === 'all' ? (
                  <option value="all">{t('selectDivisionFirst')}</option>
                ) : (
                  <>
                    <option value="all">{t('allSectionsLabel')}</option>
                    {availableSections.length ? (
                      availableSections.map(section => (
                        <option key={section.id} value={section.id}>
                          {section.name}
                        </option>
                      ))
                    ) : (
                      <option value="__no_sections" disabled>{t('noSections')}</option>
                    )}
                  </>
                )}
              </select>
          </div>

          {/* Sub-Section Filter */}
          <div style={{ flex: '1', minWidth: '200px' }}>
            <label htmlFor="employee-subsection-select" style={{ 
              fontWeight: '600', 
              color: '#495057',
              fontSize: '12px',
              display: 'block',
              marginBottom: '4px'
            }}>
              {t('subSectionLabel')}
            </label>
            <select 
              id="employee-subsection-select"
              className="form-select" 
              value={selectedSubSection} 
              onChange={handleSubSectionChange}
              style={{ 
                padding: '8px 10px',
                fontSize: '13px',
                border: '1px solid #dee2e6',
                borderRadius: '4px'
              }}
              disabled={!selectedSection || selectedSection === 'all'}
            >
                {!selectedSection || selectedSection === 'all' ? (
                  <option value="all">{t('selectSectionFirst')}</option>
                ) : (
                  <>
                    <option value="all">{t('allSubSectionsLabel')}</option>
                    {availableSubSections.length ? (
                      availableSubSections.map(subSection => (
                        <option key={subSection._id} value={subSection._id}>
                          {subSection.subSection?.sub_hie_name || subSection.subSection?.hie_name || 'Unnamed'}
                        </option>
                      ))
                    ) : (
                      <option value="__no_subsections" disabled>{t('noSubsections')}</option>
                    )}
                  </>
                )}
              </select>
          </div>

          {/* Search Bar */}
          <div style={{ flex: '1.5', minWidth: '250px' }}>
            <label htmlFor="employee-search" style={{ 
              fontWeight: '600', 
              color: '#495057',
              fontSize: '12px',
              display: 'block',
              marginBottom: '4px'
            }}>
              {t('searchLabel')}
            </label>
            <div style={{ position: 'relative' }}>
              <i className="bi bi-search" style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#6c757d',
                fontSize: '14px'
              }}></i>
              <input
                id="employee-search"
                type="text"
                className="form-control"
                placeholder={t('searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  padding: '8px 10px 8px 32px',
                  fontSize: '13px',
                  border: '1px solid #dee2e6',
                  borderRadius: '4px'
                }}
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#6c757d',
                    cursor: 'pointer',
                    padding: '4px',
                    fontSize: '16px'
                  }}
                  title={t('clearSearchTitle')}
                >
                  <i className="bi bi-x-circle-fill"></i>
                </button>
              )}
            </div>
          </div>

          {/* Refresh Button */}
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button 
              onClick={refreshData}
              disabled={loading}
              style={{
                padding: '8px 16px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s',
                opacity: loading ? 0.6 : 1,
                height: '34px'
              }}
              onMouseOver={(e) => !loading && (e.target.style.transform = 'translateY(-1px)')}
              onMouseOut={(e) => (e.target.style.transform = 'translateY(0)')}
            >
              <i className="bi bi-arrow-clockwise"></i>
              {t('refresh')}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className={`alert ${error.includes('⚠️') ? 'alert-warning' : 'alert-danger'}`} style={{margin: '18px'}}>
          <i className={`bi ${error.includes('⚠️') ? 'bi-exclamation-triangle' : 'bi-exclamation-circle'}`}></i>
          {error}
        </div>
      )}

      {loading ? (
          <div style={{ 
          padding: '60px 20px', 
          textAlign: 'center',
          background: 'white',
          margin: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.08)'
        }}>
          <div className="spinner-border" style={{ color: '#667eea', width: '3rem', height: '3rem' }} role="status">
            <span className="visually-hidden">{t('loading')}</span>
          </div>
          <p style={{ marginTop: '20px', color: '#6c757d', fontSize: '16px' }}>{t('fetchingHris')}</p>
        </div>
      ) : (
        <div style={{ padding: '0 20px 20px 20px' }}>
          {selectedSubSection !== 'all' && transferMatchesCount > 0 && (
            <div style={{ margin: '12px 0 8px 12px', color: '#495057', fontSize: '14px', fontWeight: 600 }}>
              <i className="bi bi-arrow-repeat" style={{ marginRight: 8, color: '#667eea' }}></i>
              Showing <strong style={{ color: '#333' }}>{transferMatchesCount}</strong> transferred employee{transferMatchesCount > 1 ? 's' : ''}
            </div>
          )}
          <div style={{
            background: 'white',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
            overflow: 'hidden'
          }}>
            <div className="table-responsive">
              <table className="table" style={{ marginBottom: 0 }}>
                <thead>
                  <tr style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                    <th style={{ 
                      color: 'white !important', 
                      fontWeight: '600', 
                      padding: '14px 16px',
                      fontSize: '13px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      border: 'none',
                      whiteSpace: 'nowrap'
                    }}>Employee ID</th>
                    <th style={{ 
                      color: 'white !important', 
                      fontWeight: '600', 
                      padding: '14px 16px',
                      fontSize: '13px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      border: 'none',
                      whiteSpace: 'nowrap'
                    }}>Full Name</th>
                    <th style={{ 
                      color: 'white !important', 
                      fontWeight: '600', 
                      padding: '14px 16px',
                      fontSize: '13px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      border: 'none',
                      whiteSpace: 'nowrap'
                    }}>Designation</th>
                    <th style={{ 
                      color: 'white !important', 
                      fontWeight: '600', 
                      padding: '14px 16px',
                      fontSize: '13px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      border: 'none',
                      whiteSpace: 'nowrap'
                    }}>Gender</th>
                    <th style={{ 
                      color: 'white !important', 
                      fontWeight: '600', 
                      padding: '14px 16px',
                      fontSize: '13px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      border: 'none',
                      whiteSpace: 'nowrap'
                    }}>NIC</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((employee, index) => (
                    <tr key={employee.empNumber} style={{
                      background: index % 2 === 0 ? '#ffffff' : '#f8f9fa',
                      transition: 'all 0.2s',
                      cursor: 'default'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = '#667eea15';
                      e.currentTarget.style.transform = 'scale(1.01)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = index % 2 === 0 ? '#ffffff' : '#f8f9fa';
                      e.currentTarget.style.transform = 'scale(1)';
                    }}>
                      <td style={{ 
                        padding: '12px 16px',
                        fontSize: '13px',
                        color: '#495057',
                        fontWeight: '600',
                        borderBottom: '1px solid #e9ecef'
                      }}>{employee.empNumber}</td>
                      <td style={{ 
                        padding: '12px 16px',
                        fontSize: '13px',
                        color: '#212529',
                        fontWeight: '500',
                        borderBottom: '1px solid #e9ecef'
                      }}>{employee.fullName}</td>
                      <td style={{ 
                        padding: '12px 16px',
                        fontSize: '13px',
                        color: '#6c757d',
                        borderBottom: '1px solid #e9ecef'
                      }}>{employee.designation}</td>
                      <td style={{ 
                        padding: '12px 16px',
                        fontSize: '13px',
                        color: '#6c757d',
                        borderBottom: '1px solid #e9ecef'
                      }}>
                        <span style={{
                          background: employee.gender === 'Male' ? '#e3f2fd' : employee.gender === 'Female' ? '#fce4ec' : '#f5f5f5',
                          color: employee.gender === 'Male' ? '#1976d2' : employee.gender === 'Female' ? '#c2185b' : '#757575',
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '500'
                        }}>
                          {employee.gender}
                        </span>
                      </td>
                      <td style={{ 
                        padding: '12px 16px',
                        fontSize: '13px',
                        color: '#6c757d',
                        fontFamily: 'monospace',
                        borderBottom: '1px solid #e9ecef'
                      }}>{employee.nic}</td>
                    </tr>
                  ))}
                  {employees.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{
                        textAlign: 'center', 
                        padding: '60px 24px',
                        color: '#9e9e9e',
                        fontSize: '16px'
                      }}>
                        <i className="bi bi-inbox" style={{ fontSize: '48px', display: 'block', marginBottom: '16px', opacity: 0.5 }}></i>
                        {t('noEmployeesFoundMsg')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeManagement;
