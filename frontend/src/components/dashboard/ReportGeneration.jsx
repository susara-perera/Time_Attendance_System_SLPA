import React, { useState, useEffect, useRef, useMemo } from 'react';
import usePermission from '../../hooks/usePermission';
import './ReportGeneration.css';
import GroupReport from './GroupReport';
import IndividualReport from './IndividualReport';
import AuditReport from './AuditReport';
import { useLanguage } from '../../context/LanguageContext';
import PageHeader from './PageHeader';

const ReportGeneration = () => {
  const { t } = useLanguage();
  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
  
  // Helper function to format date without timezone issues
  const formatDateToYYYYMMDD = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const [activeStep, setActiveStep] = useState('report');
  const [reportType, setReportType] = useState('attendance');
  const [reportScope, setReportScope] = useState('individual');
  const [timePeriod, setTimePeriod] = useState('none');
  const [reportGrouping, setReportGrouping] = useState('none');
  const [employeeId, setEmployeeId] = useState('');
  const [divisionId, setDivisionId] = useState('all');
  const [sectionId, setSectionId] = useState('all');
  const [divisions, setDivisions] = useState([]);
  const [sections, setSections] = useState([]);
  const [allSections, setAllSections] = useState([]);
  const [subSections, setSubSections] = useState([]);
  const [subSectionId, setSubSectionId] = useState('all');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [endMonth, setEndMonth] = useState(new Date());
  const [showReportModal, setShowReportModal] = useState(false);
  const [calendarSelectMode, setCalendarSelectMode] = useState('start'); // 'start' or 'end'
  const [lastClickTime, setLastClickTime] = useState(0);
  const [lastClickedDay, setLastClickedDay] = useState(null);
  
  // Filter sections for selected division (client-side filtering like EmployeeManagement)
  useEffect(() => {
    if (divisionId === 'all') {
      setSections(allSections);
      setSectionId('all');
      setSubSections([]);
      setSubSectionId('all');
    } else {
      // Filter sections by matching divisionId (MySQL sync uses division_code field)
      const sectionsForDivision = allSections.filter(section => {
        const sectionDivId = String(section.division_code || section.division_id || section.divisionId || section.DIVISION_ID || '');
        let selectedDivId = String(divisionId);
        
        // Handle MySQL sync ID prefix if present (from getHrisDivisions)
        if (selectedDivId.startsWith('mysql_div_')) {
          selectedDivId = selectedDivId.replace('mysql_div_', '');
        }
        
        return sectionDivId === selectedDivId;
      });
      
      console.log(`🔍 Filtered ${sectionsForDivision.length} sections for division ${divisionId}`);
      if (sectionsForDivision.length > 0) {
        console.log('Sample sections:', sectionsForDivision.slice(0, 3).map(s => ({
          id: s._id,
          name: s.name,
          division_id: s.division_id
        })));
      }
      
      setSections(sectionsForDivision);
      setSectionId('all'); // Reset section when division changes
      setSubSections([]);
      setSubSectionId('all');
    }
  }, [divisionId, allSections]);
  
  // Fetch subsections when section changes
  useEffect(() => {
    if (sectionId && sectionId !== 'all' && divisionId !== 'all') {
      fetchSubSections(sectionId);
    } else {
      setSubSections([]);
      setSubSectionId('all');
    }
  }, [sectionId, divisionId]);
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  });
  
  // Selection mode: 'single-date' | 'date-range' | 'single-month' | 'single-year'
  const [selectionMode, setSelectionMode] = useState('date-range');
  
  // Start/End mode for date picker: 'date' | 'month' | 'year'
  const [startMode, setStartMode] = useState('date');
  const [endMode, setEndMode] = useState('date');
  
  // For single-month: selected year and month
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [error, setError] = useState('');
  const [employeeInfo, setEmployeeInfo] = useState(null);
  const [searchQuery] = useState('');
  const autoSelectedDivisionRef = useRef(false);
  const autoSelectedSectionRef = useRef(false);
  const groupReportRef = useRef(null);
  const individualReportRef = useRef(null);

  // Compute filtered data when user types in search box (employee id or name)
  const filteredData = useMemo(() => {
    if (!reportData || !Array.isArray(reportData.data)) return [];
    const q = (searchQuery || '').trim().toLowerCase();
    if (!q) return reportData.data;
    return reportData.data.filter(item => {
      const empId = String(item.employee_id || item.employee_ID || item.employeeId || item.emp_no || item.empNo || '').toLowerCase();
      const empName = String(item.employee_name || item.employeeName || item.name || '').toLowerCase();
      return empId.includes(q) || empName.includes(q);
    });
  }, [reportData, searchQuery]);

  const filteredReportData = reportData ? { ...reportData, data: filteredData } : reportData;
  // Helpers: normalize backend data (same as EmployeeManagement.jsx)
  const normalizeDivisions = (data = []) => {
    const out = [];
    const seen = new Set();
    data.forEach((d) => {
      const id = String(d._id ?? d.id ?? d.DIVISION_ID ?? d.code ?? d.hie_code ?? d.DIVISION_CODE ?? '');
      if (!id) return;
      if (seen.has(id)) return;
      seen.add(id);
      out.push({
        _id: id,
        id,
        code: String(d.code ?? d.DIVISION_CODE ?? d.hie_code ?? d._id ?? d.id ?? id),
        name: d.name ?? d.DIVISION_NAME ?? d.hie_name ?? d.hie_relationship ?? 'Unknown Division',
        hie_code: d.hie_code ?? d.code,
        hie_name: d.hie_name ?? d.name,
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
      // MySQL sync returns division_code, not division_id
      const divisionId = String(s.division_code ?? s.division_id ?? s.DIVISION_ID ?? s.division_code ?? s.DIVISION_CODE ?? s.hie_relationship ?? '');
      out.push({
        _id: id,
        id,
        code: String(s.code ?? s.SECTION_CODE ?? s.hie_code ?? s.section_code ?? id),
        name: s.name ?? s.section_name ?? s.SECTION_NAME ?? s.hie_relationship ?? `Section ${id}`,
        division_code: divisionId || '',  // Primary field from MySQL sync
        division_id: divisionId || '',
        divisionId: divisionId || '',
        DIVISION_ID: divisionId || '',
        divisionCode: String(s.division_code ?? s.DIVISION_CODE ?? ''),
        divisionName: s.division_name ?? s.DIVISION_NAME ?? '',
        def_level: s.def_level ?? s.DEF_LEVEL,
        isActive: s.isActive ?? s.active ?? true,
      });
    });
    return out.sort((a, b) => a.name.localeCompare(b.name));
  };

  // Return DB-provided time strings unchanged. If a Date or ISO string is provided, format to HH:mm:ss.
  const ensureSeconds = (timeVal) => {
    if (!timeVal && timeVal !== 0) return '';
    if (typeof timeVal === 'string') return timeVal;
    try {
      const d = new Date(timeVal);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString('en-GB', { hour12: false });
      }
    } catch (e) {
      // fallback
    }
    return String(timeVal);
  };

  // permission checks
  // Granular report permissions
  const canGenerateFallback = usePermission('reports', 'create'); // legacy fallback
  const canGenerateAttendance = usePermission('reports', 'attendance_generate');
  const canDownloadAttendance = usePermission('reports', 'attendance_download');
  const canGenerateAudit = usePermission('reports', 'audit_generate');
  const canGenerateMeal = usePermission('reports', 'meal_generate');
  const canViewReports = usePermission('reports', 'view_reports');

  const hasGeneratePermissionForType = (type) => {
    // Require view_reports permission AND specific generate permission
    if (!canViewReports) return false;
    
    if (type === 'attendance') return !!(canGenerateAttendance || canGenerateFallback);
    if (type === 'audit') return !!(canGenerateAudit || canGenerateFallback);
    if (type === 'meal') return !!(canGenerateMeal || canGenerateFallback);
    return !!canGenerateFallback;
  };

  // Fetch divisions and sections on component mount
  useEffect(() => {
    fetchDivisions();
    fetchAllSections();
    
    // Set default date range to today
    const today = formatDateToYYYYMMDD(new Date());
    setDateRange({
      startDate: today,
      endDate: today
    });
    setSelectedYear(new Date().getFullYear());
    setSelectedMonth(new Date().getMonth());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update date range based on time period selection
  useEffect(() => {
    // Don't auto-update dates when 'none' is selected
    if (timePeriod === 'none') {
      return;
    }

    const today = new Date();
    let startDate, endDate;

    switch (timePeriod) {
      case 'daily':
        startDate = endDate = formatDateToYYYYMMDD(today);
        break;
      
      case 'weekly':
        // Start of current week (Sunday)
        const dayOfWeek = today.getDay();
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - dayOfWeek);
        startDate = formatDateToYYYYMMDD(startOfWeek);
        endDate = formatDateToYYYYMMDD(today);
        break;
      
      case 'monthly':
        // Start of current month
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        startDate = formatDateToYYYYMMDD(startOfMonth);
        endDate = formatDateToYYYYMMDD(today);
        break;
      
      case 'annually':
        // Start of current year
        const startOfYear = new Date(today.getFullYear(), 0, 1);
        startDate = formatDateToYYYYMMDD(startOfYear);
        endDate = formatDateToYYYYMMDD(today);
        break;
      
      default:
        startDate = endDate = formatDateToYYYYMMDD(today);
    }

    setDateRange({ startDate, endDate });
  }, [timePeriod]);

  // When scope changes to group, clear and block employeeId
  useEffect(() => {
    if (reportScope === 'group') {
      setEmployeeId('');
    }
  }, [reportScope]);

  // When report type changes to audit, automatically set scope to group
  useEffect(() => {
    if (reportType === 'audit') {
      setReportScope('group');
    }
  }, [reportType]);

  // Ensure selected report type is allowed based on permissions
  useEffect(() => {
    if (!hasGeneratePermissionForType(reportType)) {
      // Find the first allowed report type
      const allowedTypes = ['attendance', 'audit', 'meal'].filter(type => hasGeneratePermissionForType(type));
      if (allowedTypes.length > 0) {
        setReportType(allowedTypes[0]);
      }
    }
  }, [canGenerateAttendance, canGenerateAudit, canGenerateMeal, canViewReports, reportType]);

  // When division changes, reset section and sub-section
  useEffect(() => {
    if (divisionId === 'all') {
      setSectionId('all');
      setSubSectionId('all');
    } else {
      // Keep section selection if valid, otherwise reset
      setSectionId('all');
      setSubSectionId('all');
    }
  }, [divisionId]);

  // When section changes, reset sub-section
  useEffect(() => {
    if (sectionId === 'all' || divisionId === 'all') {
      setSubSectionId('all');
    } else {
      setSubSectionId('all');
    }
  }, [sectionId, divisionId]);

  // Note: Section filtering is now handled by the useEffect above (client-side filtering)

  // Auto-select default division 'IS' (Information Systems) when available
  useEffect(() => {
    if (divisionId && divisionId !== 'all') return; // don't override user's choice
    if (!divisions || divisions.length === 0) return;
    if (autoSelectedDivisionRef.current) return;

    const target = divisions.find(d => {
      const code = String(d.code || d.DIVISION_CODE || '').toLowerCase();
      const name = String(d.name || d.DIVISION_NAME || '').toLowerCase();
      return code === 'is' || name.includes('information systems') || name.includes('information system');
    });

    if (target) {
      setDivisionId(target._id || target.id);
      autoSelectedDivisionRef.current = true;
      // allow section auto-select to run after sections for this division are loaded
      autoSelectedSectionRef.current = false;
    }
  }, [divisions, divisionId]);

  // Auto-select an IS section when sections are loaded for the selected division
  useEffect(() => {
    if (!sections || sections.length === 0) return;
    if (sectionId && sectionId !== 'all') return; // don't override user's choice
    if (autoSelectedSectionRef.current) return;

    const sec = sections.find(s => {
      const code = String(s.code || s.section_code || s.SECTION_CODE || '').toLowerCase();
      const name = String(s.name || s.section_name || s.SECTION_NAME || '').toLowerCase();
      return code === 'is' || name.includes('information systems') || name.includes('information system') || name.includes('(is)');
    });

    if (sec) {
      setSectionId(sec._id || sec.id || sec.section_id);
      autoSelectedSectionRef.current = true;
    }
  }, [sections, sectionId]);

  const fetchDivisions = async () => {
    try {
      const token = localStorage.getItem('token');
      console.log('📥 Fetching divisions from MySQL data...');
      
      const response = await fetch(`${API_BASE_URL}/mysql-data/divisions?includeEmployeeCount=true`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        let divisionsArray = [];
        if (Array.isArray(data)) {
          divisionsArray = data;
        } else if (data.data && Array.isArray(data.data)) {
          divisionsArray = data.data;
        }

        // Use normalizeDivisions helper (same as EmployeeManagement)
        const normalized = normalizeDivisions(divisionsArray);
        console.log(`✅ Loaded ${normalized.length} divisions from MySQL data`);
        setDivisions(normalized);
      } else {
        console.error('Failed to fetch divisions:', response.status);
        setDivisions([]);
      }
    } catch (err) {
      console.error('Error fetching divisions:', err);
      setDivisions([]);
    }
  };

  const fetchAllSections = async () => {
    try {
      const token = localStorage.getItem('token');
      console.log('📥 Fetching sections from MySQL data...');
      
      const response = await fetch(`${API_BASE_URL}/mysql-data/sections`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        // Handle different response formats
        let sectionsArray = [];
        if (Array.isArray(data)) {
          sectionsArray = data;
        } else if (data.data && Array.isArray(data.data)) {
          sectionsArray = data.data;
        } else if (data.sections && Array.isArray(data.sections)) {
          sectionsArray = data.sections;
        }

        // Use normalizeSections helper (same as EmployeeManagement)
        const normalized = normalizeSections(sectionsArray);
        console.log(`✅ Loaded ${normalized.length} sections from MySQL data`);
        console.log('Sample sections with division_id:', normalized.slice(0, 3).map(s => ({
          id: s.id,
          name: s.name,
          divisionId: s.divisionId,
          divisionCode: s.divisionCode
        })));
        setAllSections(normalized);
      } else {
        console.error('Failed to fetch sections:', response.status);
        setAllSections([]);
      }
    } catch (err) {
      console.error('Error fetching sections:', err);
      setAllSections([]);
    }
  };

  const fetchSubSections = async (sectionId) => {
    try {
      const token = localStorage.getItem('token');
      // Strip 'mysql_sec_' prefix if present to get the actual code
      let cleanSectionId = sectionId;
      if (typeof sectionId === 'string' && sectionId.startsWith('mysql_sec_')) {
        cleanSectionId = sectionId.replace('mysql_sec_', '');
      }

      console.log(`📥 Fetching sub sections for section: ${sectionId} (clean: ${cleanSectionId})`);
      
      const response = await fetch(`${API_BASE_URL}/mysql-subsections?sectionId=${encodeURIComponent(cleanSectionId)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        let subSectionsArray = [];
        if (Array.isArray(data)) {
          subSectionsArray = data;
        } else if (data.data && Array.isArray(data.data)) {
          subSectionsArray = data.data;
        }

        console.log(`✅ Loaded ${subSectionsArray.length} sub sections for section ${sectionId}`);
        setSubSections(subSectionsArray);
      } else {
        console.error('Failed to fetch sub sections:', response.status);
        setSubSections([]);
      }
    } catch (err) {
      console.error('Error fetching sub sections:', err);
      setSubSections([]);
    }
  };

  // Fetch a small preview list of employees matching the filters (used to validate group filters)
  const fetchFilteredEmployeesPreview = async (payload, token) => {
    try {
      let employeesUrl = '';
      if (payload.sub_section_id) {
        employeesUrl = `${API_BASE_URL}/mysql-subsections/transferred/${encodeURIComponent(payload.sub_section_id)}`;
      } else if (payload.section_id) {
        employeesUrl = `${API_BASE_URL}/mysql-data/employees?sectionCode=${encodeURIComponent(payload.section_id)}&limit=1000`;
      } else if (payload.division_id) {
        employeesUrl = `${API_BASE_URL}/mysql-data/employees?divisionCode=${encodeURIComponent(payload.division_id)}&limit=1000`;
      }

      if (!employeesUrl) return null;

      const resp = await fetch(employeesUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!resp.ok) return null;
      const data = await resp.json();
      let arr = [];
      if (Array.isArray(data)) arr = data;
      else if (data.data && Array.isArray(data.data)) arr = data.data;
      else if (data.data && data.data.data && Array.isArray(data.data.data)) arr = data.data.data;
      return arr;
    } catch (err) {
      console.warn('Error fetching filtered employees preview:', err);
      return null;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!hasGeneratePermissionForType(reportType)) {
      setError('You do not have permission to generate this type of report');
      return;
    }

    if (!dateRange.startDate || !dateRange.endDate) {
      setError('Please select both start and end dates');
      return;
    }

    // Only validate employee ID for individual scope reports (not for meal reports)
    if (reportType !== 'meal' && reportScope === 'individual' && !employeeId) {
      setError('Please enter an employee ID for individual reports');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      let apiUrl = '';
      let payload = {};

      if (reportType === 'attendance') {
        // Use MySQL API for attendance reports
        apiUrl = 'http://localhost:5000/api/reports/mysql/attendance';
        payload = {
          report_type: reportScope,
          from_date: dateRange.startDate,
          to_date: dateRange.endDate,
          time_period: timePeriod,
          grouping: reportGrouping
        };
        if (reportScope === 'individual') {
          payload.employee_id = employeeId;
        } else if (reportScope === 'group') {
          // For group reports, derive concrete identifiers expected by the backend (emp_index_list uses
          // division_id=HIE_CODE, section_id=HIE_CODE, sub_section_id=sub_sections.id)
          if (subSectionId !== 'all' && sectionId !== 'all') {
            const selectedSubSection = subSections.find(ss => (ss._id || ss.id || ss.sub_section_id) === subSectionId);
            if (selectedSubSection) {
              // Use the database id for sub sections (this matches emp_index_list.sub_section_id)
              payload.sub_section_id = selectedSubSection.sub_section_id || selectedSubSection.id || selectedSubSection._id || subSectionId;
              // Clear section/division to include transferred employees across sections/divisions
              payload.section_id = '';
              payload.division_id = '';

              console.log('Selected sub section details:', {
                sub_section_db_id: payload.sub_section_id,
                sub_section_name: selectedSubSection.subSection?.sub_hie_name || selectedSubSection.subSection?.name || selectedSubSection.sub_name || selectedSubSection.sub_code || selectedSubSection.sub_section_name || selectedSubSection.name || '',
                full_sub_section: selectedSubSection
              });
            }
          } else if (sectionId !== 'all') {
            const selectedSection = sections.find(s => (s._id || s.id || s.section_id || s.code) === sectionId);
            if (selectedSection) {
              // For emp_index_list we use HIE_CODE for section_id
              payload.section_id = selectedSection.code || selectedSection.hie_code || selectedSection.section_code || selectedSection.section_id || selectedSection.id || '';
              // Division may be a code as well
              payload.division_id = selectedSection.divisionCode || selectedSection.division_code || selectedSection.division_id || selectedSection.divisionId || '';

              console.log('🎯 Selected section details:', {
                section_id: sectionId,
                section_code: payload.section_id,
                division_code: payload.division_id,
                full_section: selectedSection
              });
            }
          } else if (divisionId !== 'all') {
            const selectedDivision = divisions.find(d => (d._id || d.id) === divisionId);
            if (selectedDivision) {
              // Use the division HIE code as division_id
              payload.division_id = selectedDivision.code || selectedDivision.hie_code || selectedDivision.division_id || selectedDivision.id || '';
              payload.section_id = '';

              console.log('🎯 Selected division with all sections:', {
                division_id: divisionId,
                division_code: payload.division_id,
                section_filter: 'All Sections',
                full_division: selectedDivision
              });
            }
          } else {
            payload.division_id = '';
            payload.section_id = '';
          }

          console.log('Sending group report filters:', {
            division_name: payload.division_id,
            section_name: payload.section_id,
            sub_section_id: payload.sub_section_id
          });

          // Verify filtered employees for group report (preview)
          const empPreview = await fetchFilteredEmployeesPreview(payload, token);
          if (Array.isArray(empPreview)) {
            console.log(`✅ Found ${empPreview.length} employees matching filters`);
            if (empPreview.length === 0) {
              setError('No employees found for selected filters. Please check your division/section/sub-section selection.');
              setLoading(false);
              return;
            }
            payload.preview_employee_count = empPreview.length;
          } else {
            console.warn('Failed to verify filtered employees (preview unavailable)');
          }
        }
      } else if (reportType === 'audit') {
        // Validate dates for audit report
        if (!dateRange.startDate || !dateRange.endDate) {
          setError('Audit reports require both start and end dates. Please select dates.');
          setLoading(false);
          return;
        }

        // Use MySQL API for audit reports
        apiUrl = 'http://localhost:5000/api/reports/mysql/audit';
        payload = {
          from_date: dateRange.startDate,
          to_date: dateRange.endDate,
          time_period: timePeriod,
          grouping: reportGrouping
        };
        
        // Audit reports always use group scope with division/section filtering
        if (subSectionId !== 'all' && sectionId !== 'all') {
          // If sub section is selected, send the database ID for querying transfers
          const selectedSubSection = subSections.find(ss => (ss._id || ss.id) === subSectionId);
          if (selectedSubSection) {
            // Send the actual database ID (not the name) for querying subsection_transfers table
            payload.sub_section_id = subSectionId;
            payload.section_id = selectedSubSection.parentSection?.hie_name || selectedSubSection.section_name || '';
            payload.division_id = selectedSubSection.parentDivision?.division_name || selectedSubSection.division_name || '';
            console.log('🔍 Audit sub section filter:', {
              sub_section_db_id: subSectionId,
              sub_section_name: selectedSubSection.subSection?.sub_hie_name || selectedSubSection.subSection?.name || selectedSubSection.sub_name || selectedSubSection.sub_code || '',
              section_id: payload.section_id,
              division_id: payload.division_id,
              selectedSubSection
            });
          }
        } else if (sectionId !== 'all') {
          const selectedSection = sections.find(s => (s._id || s.id || s.section_id) === sectionId);
          if (selectedSection) {
            payload.section_id = selectedSection.name || selectedSection.section_name || '';
            payload.division_id = selectedSection.divisionName || selectedSection.division_name || '';
            console.log('🔍 Audit section filter:', {
              section_id: payload.section_id,
              division_id: payload.division_id,
              selectedSection
            });
          }
        } else if (divisionId !== 'all') {
          const selectedDivision = divisions.find(d => (d._id || d.id) === divisionId);
          if (selectedDivision) {
            payload.division_id = selectedDivision.hie_name || selectedDivision.name || '';
            console.log('🔍 Audit division filter:', {
              division_id: payload.division_id,
              selectedDivision
            });
          }
          payload.section_id = '';
        } else {
          payload.division_id = '';
          payload.section_id = '';
        }
        
        console.log('🔍 Sending audit report request:', {
          from_date: payload.from_date,
          to_date: payload.to_date,
          grouping: payload.grouping,
          division_id: payload.division_id,
          section_id: payload.section_id
        });
      } else if (reportType === 'meal') {
        // Use MySQL API for meal reports from attendance table (GROUP SCOPE ONLY)
        apiUrl = 'http://localhost:5000/api/reports/mysql/meal';
        
        // Prepare payload for group meal report
        payload = {
          from_date: dateRange.startDate,
          to_date: dateRange.endDate,
          division_id: '',
          section_id: '',
          sub_section_id: ''
        };

        // Set division/section filters
        if (divisionId && divisionId !== 'all') {
          const selectedDivision = divisions.find(d => (d._id || d.id) === divisionId);
          if (selectedDivision) {
            payload.division_id = selectedDivision.hie_name || selectedDivision.name || '';
          }
        }
        
        if (sectionId && sectionId !== 'all') {
          const selectedSection = sections.find(s => (s._id || s.id) === sectionId);
          if (selectedSection) {
            payload.section_id = selectedSection.hie_name || selectedSection.name || '';
          }
        }

        if (subSectionId && subSectionId !== 'all') {
          payload.sub_section_id = subSectionId;
        }
        
        console.log('🍽️ Meal Report Payload (Group Scope):', payload);
      }

      let response;
      if (reportType === 'attendance' || reportType === 'audit' || reportType === 'meal') {
        console.log('📤 Sending request to:', apiUrl);
        console.log('📤 Request payload:', JSON.stringify(payload, null, 2));
        
        response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
      } else {
        response = await fetch(apiUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
      }

      let data;
      try {
        data = await response.json();
        console.log('📥 Response status:', response.status);
        console.log('📥 Response data:', JSON.stringify(data, null, 2));
      } catch (jsonErr) {
        console.error('❌ JSON parse error:', jsonErr);
        setError('Invalid response from server.');
        setReportData(null);
        return;
      }

      if (!response.ok) {
        console.error('❌ Response not OK:', response.status, data.message);
        setError(data.message || `HTTP error! status: ${response.status}`);
        setReportData(null);
        return;
      }

      // Handle MongoDB response format
      const reportArray = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
      console.log('📊 Report array length:', reportArray.length);
      console.log('📊 Data success flag:', data.success);
      console.log('📊 Sample data (first 2 items):', reportArray.slice(0, 2));
      
      if ((data.success && reportArray.length > 0) || (!data.hasOwnProperty('success') && reportArray.length > 0)) {
        console.log('✅ Report generated successfully with', reportArray.length, 'records');
        // For group reports, add reportType and dates to the response
        const processedData = {
          ...data,
          data: reportArray
        };
        
        // If this is a group report, add the reportType for frontend handling
        if (reportScope === 'group' && data.reportType === 'group') {
          processedData.reportType = 'group';
          processedData.employees = reportArray; // For backward compatibility
        }
        
        setReportData(processedData);
        if (data.employee_info) {
          setEmployeeInfo(data.employee_info);
        }
        setError('');
        setShowReportModal(true); // Open modal when report is generated
      } else if (reportArray.length === 0) {
        console.warn('⚠️ No records found in response');
        console.log('Response details:', {
          success: data.success,
          message: data.message,
          summary: data.summary,
          employees: data.employees
        });
        setError('No records found for the selected criteria.');
        setReportData({ ...data, data: [] });
      } else {
        console.error('❌ Report generation failed:', data.message);
        setError(data.message || 'Failed to generate report');
        setReportData(null);
      }
    } catch (err) {
      console.error('Error generating report:', err);
      setError(err.message || 'Failed to generate report. Please try again.');
      setReportData(null);
    } finally {
      setLoading(false);
    }
  };

  const exportReport = (format) => {
    const dataToExport = filteredReportData;
    if (!dataToExport || !dataToExport.data || dataToExport.data.length === 0) {
      setError('No data to export. Please generate a report first or adjust search filters.');
      return;
    }
    if (format === 'pdf') {
      handlePrint();
    }
  };

  const handlePrint = () => {
    if (!reportData || !reportData.data || reportData.data.length === 0) {
      alert('No data to print. Please generate a report first.');
      return;
    }
    // Check download/print permission for attendance reports
    if (reportType === 'attendance' && !canDownloadAttendance) {
      setError('You do not have permission to download/print attendance reports');
      return;
    }
    if (reportType === 'audit') {
      // Simple print for audit report
      window.print();
    } else if (reportScope === 'group') {
      if (groupReportRef.current && typeof groupReportRef.current.print === 'function') {
        groupReportRef.current.print();
      } else {
        alert('Group report print not available.');
      }
    } else {
      if (individualReportRef.current && typeof individualReportRef.current.print === 'function') {
        individualReportRef.current.print();
      } else {
        alert('Individual report print not available.');
      }
    }
  };

  const getHeaders = () => {
    if (reportType === 'meal') {
      // Meal report headers matching the MySQL attendance table structure
      return ['Emp No', 'Emp Name', 'Division', 'Section', 'Date', 'Meal Packet', 'Meal Money'];
    } else if (reportScope === 'group' && reportData?.reportType === 'group') {
        // For group scope we want a flat punch-list style table similar to individual reports.
        return ['Emp No', 'Emp Name', 'Meal-Pkt-Mny', 'Punch Date', 'Punch Time', 'Function', 'Event Description'];
    } else {
      // Individual attendance report headers to match your reference exactly
      return ['Emp No', 'Emp Name', 'Meal-Pkt-Mny', 'Punch Date', 'Punch Time', 'Function', 'Event Description'];
    }
  };

  // formatRow returns an array of cell values for a single punch/record
  // If called with an attendance 'punch' object, it returns the standard row.
  const formatRow = (record) => {
    if (reportType === 'meal') {
      // Format meal report row from attendance table
      return [
        record.employeeId || '',
        record.employeeName || '',
        record.division || 'N/A',
        record.section || 'N/A',
        record.date || '',
        record.mealPacket || 'No',
        record.mealMoney || 'No'
      ];
    } else if (reportScope === 'group' && reportData?.reportType === 'group') {
      // For group reports we may be formatting individual punch records.
      // The incoming `record` in the group-preview mapping will be a punch-like object
      // if we transformed the server response earlier. We expect fields similar to individual records.
      // Format: Emp No, Emp Name, Meal-Pkt-Mny, Punch Date, Punch Time, Function, Event Description
      const punchDateObj = record.date_ ? new Date(record.date_) : (record.punchDate ? new Date(record.punchDate) : null);
      const formattedDate = punchDateObj && !isNaN(punchDateObj.getTime())
        ? (punchDateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).replace(/\//g, '-') + ' ' + punchDateObj.toLocaleDateString('en-US', { weekday: 'short' }))
        : (record.punchDate || record.date_ || '');

      const functionCode = record.scan_type?.toUpperCase() === 'IN' ? 'F1-0' : 'F4-0';
      const eventDescription = `${record.scan_type?.toUpperCase() === 'IN' ? 'ON' : 'OFF'}Granted(ID & F tally plan COM0002)`;

      return [
        record.employee_ID || record.employeeId || record.emp_no || record.empNo || '',
        record.employee_name || record.employeeName || record.name || 'Unknown',
        'I',
        formattedDate,
        ensureSeconds(record.time_ || record.time || record.punchTime || ''),
        functionCode,
        eventDescription
      ];
    } else {
      // Individual attendance report format to match your reference exactly
      // Format: Emp No, Emp Name, Meal-Pkt-Mny, Punch Date, Punch Time, Function, Event Description
      
      // Format the punch date as "DD-MMM-YY Day" like "19-Aug-25 Tue"
      const punchDate = new Date(record.date_);
      const formattedDate = punchDate.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: '2-digit'
      }).replace(/\//g, '-') + ' ' + punchDate.toLocaleDateString('en-US', { weekday: 'short' });
      
      // Determine function code based on scan type
      const functionCode = record.scan_type?.toUpperCase() === 'IN' ? 'F1-0' : 'F4-0';
      
      // Format event description like your reference
      const eventDescription = `${record.scan_type?.toUpperCase() === 'IN' ? 'ON' : 'OFF'}Granted(ID & F tally plan COM0002)`;
      
      return [
        record.employee_ID || record.employeeId, // Emp No
        record.employee_name || record.employeeName || 'Unknown', // Emp Name
        'I', // Meal-Pkt-Mny (always "I" for attendance records as shown in your reference)
        formattedDate, // Punch Date
  ensureSeconds(record.time_), // Punch Time
        functionCode, // Function
        eventDescription // Event Description
      ];
    }
  };

  // Unused function - kept for future use
  // const printReport = () => {
  //   if (!reportData || !reportData.data || reportData.data.length === 0) {
  //     alert('No data to print. Please generate a report first.');
  //     return;
  //   }
  //   
  //   // Create a new window for printing with formatted content, avoid about:blank in URL
  //   const printWindow = window.open(' ', '', 'width=900,height=700');
  //   const printContent = generatePrintContent();
  //   printWindow.document.open();
  //   printWindow.document.write(printContent);
  //   printWindow.document.close();
  //   printWindow.focus();
  //   printWindow.print();
  //   printWindow.close();
  // };

  // eslint-disable-next-line no-unused-vars
  const generatePrintContent = () => {
    const reportTitle = reportType === 'attendance' ? 'History Transaction Report' : 'Meal Consumption Report';
    // const subtitle = reportType === 'attendance' ? 'All Granted(ID & FP) Records' : 'All Meal Records';
    
    let employeeHeader = '';
    if (reportScope === 'individual' && (employeeInfo || employeeId)) {
      const empNoVal = (employeeInfo && (employeeInfo.employee_id || employeeInfo.employee_ID)) || employeeId || '';
      const empNameVal = (employeeInfo && (employeeInfo.name || employeeInfo.employee_name || employeeInfo.employeeName)) || '';
      employeeHeader = `
        <table style="margin-bottom: 12px; border-collapse: collapse;">
          <tr>
            <td style="vertical-align: top; padding-right: 8px; font-weight: bold; width: 90px;">Emp No :</td>
            <td style="vertical-align: top;">${empNoVal}</td>
          </tr>
          <tr>
            <td style="vertical-align: top; padding-right: 8px; font-weight: bold;">Emp Name :</td>
            <td style="vertical-align: top;">${empNameVal}</td>
          </tr>
          <tr>
            <td style="vertical-align: top; padding-right: 8px; font-weight: bold;">Date From :</td>
            <td style="vertical-align: top;">${dateRange.startDate} &nbsp; To : &nbsp; ${dateRange.endDate}</td>
          </tr>
        </table>
      `;
    }

  const headers = getHeaders();
  // Rows per printed page. Use a sensible default for individual reports and keep
  // a larger capacity for group reports. Make the individual value easy to tweak.
  const INDIVIDUAL_ROWS_PER_PAGE = 40; // increased to show more records per individual printed page
  const GROUP_ROWS_PER_PAGE = 32;
  const rowsPerPage = reportScope === 'individual' ? INDIVIDUAL_ROWS_PER_PAGE : GROUP_ROWS_PER_PAGE;
  // Build flattened punches array (date-first) so print matches the group preview
  const punches = [];
  // Determine date order and flatten depending on report shape
  let dateOrder = [];

  if (Array.isArray(reportData.dates) && reportData.dates.length > 0) {
    dateOrder = reportData.dates;
  } else if (reportScope === 'individual') {
    // reportData.data for individual reports is expected to be a flat array of punch/record objects.
    // Collect unique dates from those records and build punches directly.
    const dateSet = new Set();
    (Array.isArray(reportData.data) ? reportData.data : []).forEach(p => {
      const d = p.date || p.punchDate || p.date_;
      if (d) dateSet.add(d);
    });
    dateOrder = Array.from(dateSet).sort((a, b) => new Date(a) - new Date(b));

    // For each date, push all punches that belong to that date
    dateOrder.forEach(date => {
      (Array.isArray(reportData.data) ? reportData.data : []).forEach(p => {
        const pd = p.date || p.punchDate || p.date_;
        if (String(pd) !== String(date)) return;
        const inferredType = (p && (p.scan_type || p.type || p.direction))
          ? (p.scan_type || p.type || p.direction)
          : 'IN';
        punches.push({
          employee_ID: p.employee_ID || p.employeeId || p.emp_no || p.empNo || '',
          employee_name: p.employee_name || p.employeeName || p.name || '',
          date_: date,
          time_: p.time || p.punchTime || p.time_ || (typeof p === 'string' ? p : ''),
          scan_type: inferredType
        });
      });
    });
  } else {
    // Group-shaped report: each element is an employee with punches/dailyAttendance
    const dateSet = new Set();
    reportData.data.forEach(emp => {
      if (Array.isArray(emp.punches)) {
        emp.punches.forEach(p => {
          const d = p.date || p.punchDate || p.date_;
          if (d) dateSet.add(d);
        });
      }
      if (emp.dailyAttendance) {
        Object.keys(emp.dailyAttendance).forEach(k => dateSet.add(k));
      }
    });
    dateOrder = Array.from(dateSet).sort((a, b) => new Date(a) - new Date(b));

    dateOrder.forEach(date => {
      reportData.data.forEach(emp => {
        if (Array.isArray(emp.punches) && emp.punches.length > 0) {
          const dayPunches = emp.punches.filter(p => {
            const pd = p.date || p.punchDate || p.date_;
            return String(pd) === String(date);
          });
          dayPunches.forEach((p, pIndex) => {
            const inferredType = (p && (p.scan_type || p.type || p.direction))
              ? (p.scan_type || p.type || p.direction)
              : (pIndex % 2 === 0 ? 'IN' : 'OUT');
            punches.push({
              employee_ID: emp.employeeId || emp.employee_ID || emp.emp_no || emp.empNo,
              employee_name: emp.employeeName || emp.employee_name || emp.name,
              date_: date,
              time_: p.time || p.punchTime || p.time_ || (typeof p === 'string' ? p : ''),
              scan_type: inferredType
            });
          });
        } else if (emp.dailyAttendance && emp.dailyAttendance[date]) {
          const dayData = emp.dailyAttendance[date];
          if (Array.isArray(dayData.punches) && dayData.punches.length > 0) {
            dayData.punches.forEach((p, pIndex) => {
              const inferredType = (p && (p.scan_type || p.type || p.direction))
                ? (p.scan_type || p.type || p.direction)
                : (pIndex % 2 === 0 ? 'IN' : 'OUT');
              punches.push({
                employee_ID: emp.employeeId || emp.employee_ID || emp.emp_no || emp.empNo,
                employee_name: emp.employeeName || emp.employee_name || emp.name,
                date_: date,
                time_: p.time || (typeof p === 'string' ? p : ''),
                scan_type: inferredType
              });
            });
          } else {
            if (dayData.checkIn) {
              punches.push({
                employee_ID: emp.employeeId || emp.employee_ID || emp.emp_no || emp.empNo,
                employee_name: emp.employeeName || emp.employee_name || emp.name,
                date_: date,
                time_: dayData.checkIn,
                scan_type: 'IN'
              });
            }
            if (dayData.checkOut) {
              punches.push({
                employee_ID: emp.employeeId || emp.employee_ID || emp.emp_no || emp.empNo,
                employee_name: emp.employeeName || emp.employee_name || emp.name,
                date_: date,
                time_: dayData.checkOut,
                scan_type: 'OUT'
              });
            }
          }
        }
      });
    });
  }

  // Sort punches by date, employee, time, with IN before OUT for ties
  punches.sort((a, b) => {
    const da = new Date(a.date_ || '');
    const db = new Date(b.date_ || '');
    if (!isNaN(da.getTime()) && !isNaN(db.getTime())) {
      if (da < db) return -1;
      if (da > db) return 1;
    } else {
      if ((a.date_ || '') < (b.date_ || '')) return -1;
      if ((a.date_ || '') > (b.date_ || '')) return 1;
    }
    const empA = String(a.employee_ID || '');
    const empB = String(b.employee_ID || '');
    if (empA < empB) return -1;
    if (empA > empB) return 1;
    const ta = a.time_ || '';
    const tb = b.time_ || '';
    if (ta < tb) return -1;
    if (ta > tb) return 1;
    const aIsIn = (a.scan_type || '').toUpperCase() === 'IN';
    const bIsIn = (b.scan_type || '').toUpperCase() === 'IN';
    if (aIsIn && !bIsIn) return -1;
    if (!aIsIn && bIsIn) return 1;
    return 0;
  });

  // Build sortedRecords compatible with later print rendering
  const sortedRecords = punches.map((p, idx) => {
    const rec = { ...p };
    // build human readable punch date key used for display grouping
    const punchDate = new Date(p.date_);
    rec._punchDateKey = !isNaN(punchDate.getTime())
      ? (punchDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).replace(/\//g, '-') + ' ' + punchDate.toLocaleDateString('en-US', { weekday: 'short' }))
      : p.date_;
    return rec;
  });

  // For print, suppress duplicate Emp/Name/Meal-Pkt-Mny/Punch Date similar to preview
  // Build pages so every new date starts on a fresh page
  const pages = (() => {
    const pagesOut = [];
  let currentPage = [];
  let lastKey = null; // empId|date
  let lastDateHeader = null;
  let currentCount = 0;
  // For individual reports, count distinct dates per page (user requested 8 dates/page)
  let currentDateCount = 0;

    const pushPage = () => {
      if (currentPage.length > 0) {
        pagesOut.push(currentPage.slice());
        currentPage = [];
        currentCount = 0;
        lastKey = null; // reset duplicate suppression at page boundary
      }
    };

    sortedRecords.forEach(record => {
      const dateHeader = record._punchDateKey || (record.date_ || '');
      // If date changed, insert a date header. For group reports we ensure the header
      // sits at the top of a new page; for individual reports we just inject the header
      // without forcing a page break.
      if (lastDateHeader !== dateHeader) {
        lastDateHeader = dateHeader;
        if ((reportScope === 'group' || reportData.reportType === 'group') && currentCount > 0) {
          // finish current page and start a new one so date header sits at top (group only)
          pushPage();
        }
        // inject date header row on the current page
        currentPage.push(`<tr style="background: #e9ecef;"><td colspan="7" style="font-weight: bold; font-size: 11px; text-align: left; padding: 8px 12px; border: 1px solid #000;">Date: ${dateHeader}</td></tr>`);
        currentCount++;
        // If individual report, increment the distinct date counter and check page limit
        if (reportScope === 'individual') {
          currentDateCount++;
        }
        lastKey = null; // reset duplicate suppression when date header changes
      }

      const row = formatRow(record);
      const empIdVal = record.employee_ID || record.employeeId || record.emp_no || record.empNo || '';
      const dateVal = dateHeader;
      const key = `${empIdVal}||${dateVal}`;
      if (lastKey === key) {
        if (row.length > 0) row[0] = '';
        if (row.length > 1) row[1] = '';
        if (row.length > 2) row[2] = '';
        if (row.length > 3) row[3] = '';
      } else {
        lastKey = key;
      }

  currentPage.push(`<tr>${row.map((cell, ci) => `<td style="border: 1px solid #000; padding: 4px 6px; text-align: left; font-size: 10px; white-space: pre-line;">${ci === 0 ? '<strong>' + cell + '</strong>' : cell}</td>`).join('')}</tr>`);
      currentCount++;

      // If page capacity reached, push page and continue
      if (reportScope === 'individual') {
        // For individual scope, paginate by distinct date headers: 8 dates per page
        const DATES_PER_PAGE = 8;
        if (currentDateCount >= DATES_PER_PAGE) {
          pushPage();
          currentDateCount = 0;
        }
      } else {
        if (currentCount >= rowsPerPage) {
          pushPage();
        }
      }
    });

    // push remaining
    if (currentPage.length > 0) pagesOut.push(currentPage.slice());
    return pagesOut;
  })();
  const totalPages = pages.length || 1;

    // Subtitle for attendance report
    const subtitle = reportType === 'attendance' ? 'All Granted(ID & FP) Records' : 'All Meal Records';
    // Employee info extraction - currently unused but kept for reference
    // if (reportScope === 'individual' && employeeInfo) {
    //   const empNo = employeeInfo.employee_id || employeeInfo.employee_ID || employeeId || '';
    //   const empName = employeeInfo.name || employeeInfo.employee_name || employeeInfo.employeeName || '';
    // } else if (reportData && reportData.data && reportData.data.length > 0) {
    //   // Try to extract from first record for group reports
    //   const first = reportData.data[0];
    //   const empNo =
    //     first.employee_id ||
    //     first.employee_ID ||
    //     first.emp_no ||
    //     first.empNo ||
    //     first.empid ||
    //     first.employeeId ||
    //     '';
    //   const empName =
    //     first.employee_name ||
    //     first.employeeName ||
    //     first.emp_name ||
    //     first.name ||
    //     '';
    // }

    function renderPage(pageNum) {
  const pageRows = (pages[pageNum - 1] || []).join('');
      // Common header for each page
      // Add signature lines only on the last page
      const isLastPage = pageNum === totalPages;
      return `
        <div class="common-header" style="page-break-before: ${pageNum > 1 ? 'always' : 'auto'}; width: 100%;">
          <!-- Reuse app header markup so printed header matches .report-header styles -->
          <div class="report-header" style="padding:8px 0; margin-bottom:6px;">
            <div class="header-content" style="text-align:left; display:flex; justify-content:space-between; align-items:flex-start;">
              <div style="max-width:70%;">
                <h1 style="margin:0; display:flex; align-items:center; gap:8px; font-family: 'Courier New', monospace;">${reportTitle}</h1>
                <div class="header-subtitle" style="font-size:11px; margin-top:4px;"><strong>${subtitle}</strong></div>
                <!-- spacer to create a blank line between subtitle and date-range -->
                <div style="height:8px;">&nbsp;</div>
                ${reportScope === 'individual' ? (employeeHeader || `<div class="date-range" style="margin-top:6px; font-size:11px;"><strong>Date From :</strong> ${dateRange.startDate} <strong>To :</strong> ${dateRange.endDate}</div>`) : `<div class="date-range" style="margin-top:6px; font-size:11px;"><strong>Date From :</strong> ${dateRange.startDate} <strong>To :</strong> ${dateRange.endDate}</div>`}
              </div>
              <div style="text-align:left; font-size:10px;" class="print-meta">
                <div style="font-size:10px;">Printed Date : ${new Date().toLocaleDateString()}</div>
                <div style="font-size:10px;">Printed Time : ${new Date().toLocaleTimeString()}</div>
                <div style="font-size:10px;">Page ${pageNum} of ${totalPages}</div>
              </div>
            </div>
          </div>
          <div class="header-content" style="max-width:1200px; margin:0 auto; padding:0 12px;">
            <table style="width:100%; border-collapse: collapse;">
              <thead>
                <tr>${headers.map(header => `<th style="font-size: 11px; padding: 4px 2px; border: 0.5px solid #000; text-align: left;">${header === 'Emp No' ? '<strong>' + header + '</strong>' : header}</th>`).join('')}</tr>
              </thead>
              <tbody>
                ${pageRows}
              </tbody>
            </table>
          </div>
          ${isLastPage ? `
          <div style="margin-top: 60px; width: 100%;">
            <table style="width:100%; border-collapse: collapse; border: none;">
              <tbody>
                <tr>
                  <td style="width:15%; vertical-align: middle; padding:6px 8px; border: none; font-size:11px; white-space: nowrap;">Date</td>
                  <td style="width:35%; vertical-align: middle; padding:6px 8px; border: none; white-space: nowrap;"><span style="display:inline-block; font-family: 'Courier New', monospace; font-size:9px; letter-spacing:1px; line-height:1;">....................</span></td>
                  <td style="width:15%; vertical-align: middle; padding:6px 8px; border: none; font-size:11px; white-space: nowrap;">Date</td>
                  <td style="width:35%; vertical-align: middle; padding:6px 8px; border: none; white-space: nowrap;"><span style="display:inline-block; font-family: 'Courier New', monospace; font-size:9px; letter-spacing:1px; line-height:1;">....................</span></td>
                </tr>
                <tr>
                  <td style="vertical-align: middle; padding:6px 8px; border: none; font-size:11px; white-space: nowrap;">Authorized Signature 1</td>
                  <td style="vertical-align: middle; padding:6px 8px; border: none; white-space: nowrap;"><span style="display:inline-block; font-family: 'Courier New', monospace; font-size:9px; letter-spacing:1px; line-height:1;">....................</span></td>
                  <td style="vertical-align: middle; padding:6px 8px; border: none; font-size:11px; white-space: nowrap;">Authorized Signature 2</td>
                  <td style="vertical-align: middle; padding:6px 8px; border: none; white-space: nowrap;"><span style="display:inline-block; font-family: 'Courier New', monospace; font-size:9px; letter-spacing:1px; line-height:1;">....................</span></td>
                </tr>
              </tbody>
            </table>
          </div>
          ` : ''}
        </div>
      `;
    }
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${reportTitle}</title>
        <style>
          /* Minimal header styles copied from ReportGeneration.css but adjusted for print: white background and black text */
          .report-header { background: #ffffff; padding: 8px 0; margin-bottom: 6px; }
          .header-content { max-width: 1200px; margin: 0 auto; padding: 0 12px; text-align: left; position: relative; z-index: 2; }
          .header-content h1 { font-weight: 700; font-size: 14px; margin: 0; color: #000; }
          .header-subtitle { font-size: 11px; margin-top: 4px; color: #000; }
          .employee-info, .date-range { font-size: 11px; margin-top: 6px; color: #000; }
          .common-header { width: 100%; }
          body { font-family: 'Courier New', monospace; font-size: 11px; margin: 20px; padding: 24px 24px 0 24px; }
          .common-header { width: 100%; }
          .print-header-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0; }
          .print-header-left { text-align: left; }
          .print-header-right { text-align: left; font-size: 10px; }
          .report-title { font-weight: bold; font-size: 14px; margin-bottom: 6px; }
          .report-subtitle { font-size: 11px; margin-bottom: 8px; }
          .emp-info { font-size: 11px; margin-bottom: 6px; }
          .date-range { font-size: 11px; margin-bottom: 10px; }
          .print-meta { font-size: 10px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 0.5px solid #000; padding: 4px 6px; text-align: left; }
          th { background: #f5f5f5; font-weight: bold; font-size: 11px; }
          td { font-size: 10px; white-space: pre-line; }
          @media print {
            @page { margin: 0.5in; size: landscape; }
            body { margin: 0; }
            table { font-size: 11px; }
            th, td { padding: 2px 4px; }
            thead { display: table-header-group !important; }
            /* Hide browser print header/footer */
            @page {
              margin-top: 0;
              margin-bottom: 0;
              margin-left: 0;
              margin-right: 0;
            }
            body::before, body::after { display: none !important; }
          }
        </style>
      </head>
      <body>
        ${Array.from({length: totalPages}, (_, i) => renderPage(i + 1)).join('')}
      </body>
      </html>
    `;
  };

  // Calendar helper functions
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month, 1).getDay();
  };

  const generateCalendarDays = (monthDate) => {
    const daysInMonth = getDaysInMonth(monthDate);
    const firstDay = getFirstDayOfMonth(monthDate);
    const days = [];
    
    // Add empty cells for days before the first day of month
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    
    // Add actual days
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    
    return days;
  };

  // Unified calendar date click handler - single click selects the date
  const handleCalendarDateClick = (day, monthDate) => {
    if (!day) return;

    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();

    // Determine selected date based on current start/end modes and which side is being selected
    if (!dateRange.startDate || calendarSelectMode === 'start') {
      // Selecting start
      let selectedDate;
      if (startMode === 'month') selectedDate = new Date(year, month, 1);
      else if (startMode === 'year') selectedDate = new Date(year, 0, 1);
      else selectedDate = new Date(year, month, day);

      const dateStr = formatDateToYYYYMMDD(selectedDate);
      setDateRange({ startDate: dateStr, endDate: dateStr });
      setCurrentMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
      setCalendarSelectMode('end');
      return;
    }

    // Selecting end
    if (calendarSelectMode === 'end') {
      let selectedDate;
      if (endMode === 'month') selectedDate = new Date(year, month + 1, 0);
      else if (endMode === 'year') selectedDate = new Date(year, 11, 31);
      else selectedDate = new Date(year, month, day);

      const dateStr = formatDateToYYYYMMDD(selectedDate);

      if (dateStr < dateRange.startDate) {
        setDateRange({ startDate: dateStr, endDate: dateRange.startDate });
      } else if (dateStr === dateRange.startDate) {
        setDateRange({ startDate: dateStr, endDate: dateStr });
      } else {
        setDateRange({ ...dateRange, endDate: dateStr });
      }
      setEndMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
      setCalendarSelectMode('start');
    }
  };

  const handleStartDateClick = (day) => {
    if (day) {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();

      let selectedDate;
      if (startMode === 'month') {
        selectedDate = new Date(year, month, 1);
      } else if (startMode === 'year') {
        selectedDate = new Date(year, 0, 1);
      } else {
        selectedDate = new Date(year, month, day);
      }

      const dateStr = formatDateToYYYYMMDD(selectedDate);

      // If end date exists and new start date is after end date, update end date to match
      if (dateRange.endDate && dateStr > dateRange.endDate) {
        setDateRange({ startDate: dateStr, endDate: dateStr });
      } else {
        setDateRange({ ...dateRange, startDate: dateStr });
      }
    }
  };

  const handleEndDateClick = (day) => {
    if (day) {
      const year = endMonth.getFullYear();
      const month = endMonth.getMonth();

      let selectedDate;
      if (endMode === 'month') {
        selectedDate = new Date(year, month + 1, 0); // last day of month
      } else if (endMode === 'year') {
        selectedDate = new Date(year, 11, 31); // end of year
      } else {
        selectedDate = new Date(year, month, day);
      }

      const dateStr = selectedDate.toISOString().split('T')[0];

      // If start date exists and new end date is before start date, update start date to match
      if (dateRange.startDate && dateStr < dateRange.startDate) {
        setDateRange({ startDate: dateStr, endDate: dateStr });
      } else {
        setDateRange({ ...dateRange, endDate: dateStr });
      }
    }
  };

  // Check if a date is the start date
  const isStartDate = (day, monthDate) => {
    if (!day || !dateRange.startDate) return false;
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const dateStr = formatDateToYYYYMMDD(new Date(year, month, day));
    return dateStr === dateRange.startDate;
  };

  // Check if a date is the end date
  const isEndDate = (day, monthDate) => {
    if (!day || !dateRange.endDate) return false;
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const dateStr = formatDateToYYYYMMDD(new Date(year, month, day));
    return dateStr === dateRange.endDate;
  };

  // Check if date is today
  const isToday = (day, monthDate) => {
    if (!day) return false;
    const today = new Date();
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    return day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
  };

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const previousEndMonth = () => {
    setEndMonth(new Date(endMonth.getFullYear(), endMonth.getMonth() - 1, 1));
  };

  const nextEndMonth = () => {
    setEndMonth(new Date(endMonth.getFullYear(), endMonth.getMonth() + 1, 1));
  };

  const isStartDateSelected = (day, monthDate) => {
    if (!day) return false;
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const dateStr = formatDateToYYYYMMDD(new Date(year, month, day));
    return dateStr === dateRange.startDate;
  };

  const isEndDateSelected = (day, monthDate) => {
    if (!day) return false;
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const dateStr = formatDateToYYYYMMDD(new Date(year, month, day));
    return dateStr === dateRange.endDate;
  };

  const isDateInRange = (day, monthDate) => {
    if (!day || !dateRange.startDate || !dateRange.endDate) return false;
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const dateStr = formatDateToYYYYMMDD(new Date(year, month, day));
    return dateStr >= dateRange.startDate && dateStr <= dateRange.endDate;
  };

  const isDateDisabledForStart = (day, monthDate) => {
    if (!day || !dateRange.endDate) return false;
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const dateStr = formatDateToYYYYMMDD(new Date(year, month, day));
    return dateStr > dateRange.endDate;
  };

  const isDateDisabledForEnd = (day, monthDate) => {
    if (!day || !dateRange.startDate) return false;
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const dateStr = formatDateToYYYYMMDD(new Date(year, month, day));
    return dateStr < dateRange.startDate;
  };

  const steps = [
    { id: 'report', label: 'Report', icon: 'bi-file-earmark-check' },
    { id: 'filters', label: 'Filters', icon: 'bi-funnel' },
    { id: 'dateRange', label: 'Date Range', icon: 'bi-calendar-range' }
  ];

  return (
    <div className="report-generation">
      {/* Header Section with Logo */}
      <PageHeader
        title="Report Generation Center"
        subtitle="Generate attendance, audit, and meal reports"
        icon="bi-graph-up-arrow"
      />

      {/* Form Container */}
      <div className="report-form-container">
        <form onSubmit={handleSubmit} className="config-form">
            
            <div className="simple-form-layout">
            
            {/* Section 1: Report Type & Scope */}
            <div className="form-section-group">
              <div className="form-row">
                <div className="form-field">
                  <label htmlFor="reportType">
                    <i className="bi bi-file-earmark-text"></i>
                    Report Type
                  </label>
                  <select
                    id="reportType"
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value)}
                    className="form-control"
                  >
                    {hasGeneratePermissionForType('attendance') && (
                      <option value="attendance">Attendance Report</option>
                    )}
                    {hasGeneratePermissionForType('audit') && (
                      <option value="audit">Audit Report</option>
                    )}
                    {hasGeneratePermissionForType('meal') && (
                      <option value="meal">Meal Report</option>
                    )}
                  </select>
                </div>

                <div className="form-field">
                  <label htmlFor="reportScope">
                    <i className="bi bi-people"></i>
                    Report Scope
                  </label>
                  <select
                    id="reportScope"
                    value={reportScope}
                    onChange={(e) => setReportScope(e.target.value)}
                    className="form-control"
                    disabled={reportType === 'audit'}
                  >
                    <option value="individual">Individual Report</option>
                    <option value="group">Group Report</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Section 2: Filters */}
            <div className="form-section-group">
              {/* Employee ID for Individual Scope */}
              {reportScope === 'individual' && reportType !== 'meal' && (
                <div className="form-row">
                  <div className="form-field full-width">
                    <label htmlFor="employeeId">
                      <i className="bi bi-person-badge"></i>
                      {t('employeeIdLabel')}
                    </label>
                    <input
                      type="text"
                      id="employeeId"
                      value={employeeId}
                      onChange={(e) => setEmployeeId(e.target.value)}
                      className="form-control"
                      placeholder={t('enterEmployeeId')}
                      required={reportScope === 'individual'}
                    />
                  </div>
                </div>
              )}

              {/* Division, Section, Sub-Section - All in one row */}
              {reportScope !== 'individual' && (
                <div className="form-row">
                  <div className="form-field">
                    <label htmlFor="divisionId">
                      <i className="bi bi-building"></i>
                      {t('divisionLabel')}
                    </label>
                    <select
                      id="divisionId"
                      value={divisionId}
                      onChange={(e) => setDivisionId(e.target.value)}
                      className="form-control"
                    >
                      <option value="all">{t('allDivisionsLabel')}</option>
                      {(Array.isArray(divisions) ? divisions : []).map(division => (
                        <option key={division._id || division.id} value={division._id || division.id}>
                          {division.name || division.division_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-field">
                    <label htmlFor="sectionId">
                      <i className="bi bi-diagram-3"></i>
                      {t('sectionLabel')}
                    </label>
                    <select
                      id="sectionId"
                      value={sectionId}
                      onChange={(e) => setSectionId(e.target.value)}
                      className="form-control"
                      disabled={divisionId === 'all'}
                    >
                      <option value="all">{t('allSectionsLabel')}</option>
                      {divisionId !== 'all' && (Array.isArray(sections) ? sections : []).map(section => (
                        <option key={section._id || section.id} value={section._id || section.id}>
                          {section.name || section.section_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-field">
                    <label htmlFor="subSectionId">
                      <i className="bi bi-diagram-2"></i>
                      {t('subSectionLabel')}
                    </label>
                    <select
                      id="subSectionId"
                      value={subSectionId}
                      onChange={e => setSubSectionId(e.target.value)}
                      className="form-control"
                      disabled={sectionId === 'all' || divisionId === 'all'}
                    >
                      <option value="all">{t('allSubSectionsLabel')}</option>
                      {(sectionId !== 'all' && divisionId !== 'all') && (Array.isArray(subSections) ? subSections : []).map(sub => {
                        const subName = sub.subSection?.sub_hie_name || sub.subSection?.name || sub.subSection?.hie_name || sub.sub_name || sub.sub_hie_name || sub.sub_section_name || sub.sub_code || 'Unnamed';
                        return (
                          <option key={sub._id || sub.id} value={sub._id || sub.id}>
                            {subName}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
              )}

              {/* Report Grouping & Time Period */}
              {reportScope === 'group' && reportType !== 'attendance' && reportType !== 'meal' && (
                <div className="form-row">
                  <div className="form-field">
                    <label htmlFor="reportGrouping">
                      <i className="bi bi-collection"></i>
                      Group By
                    </label>
                    <select
                      id="reportGrouping"
                      value={reportGrouping}
                      onChange={(e) => setReportGrouping(e.target.value)}
                      className="form-control"
                    >
                      <option value="none">None</option>
                      <option value="designation">Designation Wise</option>
                      <option value="punch">F1-0 (Punch Type)</option>
                    </select>
                  </div>

                  {reportGrouping !== 'designation' && (
                    <div className="form-field">
                      <label htmlFor="timePeriod">
                        <i className="bi bi-calendar-range"></i>
                        Time Period
                      </label>
                      <select
                        id="timePeriod"
                        value={timePeriod}
                        onChange={(e) => setTimePeriod(e.target.value)}
                        className="form-control"
                      >
                        <option value="none">None</option>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="annually">Annually</option>
                      </select>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Section 3: Date Selection (Dual Calendar Layout) - ALWAYS REQUIRED FOR AUDIT REPORTS */}
            {reportType === 'audit' || reportGrouping !== 'designation' ? (
              <div className="form-section-group date-range-section">
                <div style={{ padding: '20px', background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                  
                  {/* Header with From/To inputs */}
                  <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#334155' }}>Select Dates</h3>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#64748b', marginBottom: 4 }}>From</label>
                        <input 
                          type="date" 
                          value={dateRange.startDate} 
                          onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                          style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 14, background: '#fff' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#64748b', marginBottom: 4 }}>To</label>
                        <input 
                          type="date" 
                          value={dateRange.endDate} 
                          onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                          style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 14, background: '#fff' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Main Content: Sidebar + Dual Calendars */}
                  <div style={{ display: 'flex', gap: 20 }}>
                    
                    {/* Left Sidebar - Presets */}
                    <div style={{ minWidth: 120, borderRight: '1px solid #e2e8f0', paddingRight: 16 }}>
                      {[
                        { label: 'Custom', action: () => {} },
                        { label: 'Today', action: () => { const t = formatDateToYYYYMMDD(new Date()); setDateRange({ startDate: t, endDate: t }); } },
                        { label: 'Yesterday', action: () => { const y = new Date(); y.setDate(y.getDate() - 1); const d = formatDateToYYYYMMDD(y); setDateRange({ startDate: d, endDate: d }); } },
                        { label: 'This Week', action: () => { const today = new Date(); const first = today.getDate() - today.getDay(); const start = new Date(today.setDate(first)); setDateRange({ startDate: formatDateToYYYYMMDD(start), endDate: formatDateToYYYYMMDD(new Date()) }); } },
                        { label: 'Last Week', action: () => { const today = new Date(); const first = today.getDate() - today.getDay() - 7; const start = new Date(today.setDate(first)); const end = new Date(today.setDate(first + 6)); setDateRange({ startDate: formatDateToYYYYMMDD(start), endDate: formatDateToYYYYMMDD(end) }); } },
                        { label: 'This Month', action: () => { const today = new Date(); const start = new Date(today.getFullYear(), today.getMonth(), 1); const end = new Date(today.getFullYear(), today.getMonth() + 1, 0); setDateRange({ startDate: formatDateToYYYYMMDD(start), endDate: formatDateToYYYYMMDD(end) }); } },
                        { label: 'Last Month', action: () => { const today = new Date(); const start = new Date(today.getFullYear(), today.getMonth() - 1, 1); const end = new Date(today.getFullYear(), today.getMonth(), 0); setDateRange({ startDate: formatDateToYYYYMMDD(start), endDate: formatDateToYYYYMMDD(end) }); } },
                        { label: 'This Year', action: () => { const y = new Date().getFullYear(); setDateRange({ startDate: `${y}-01-01`, endDate: `${y}-12-31` }); } },
                        { label: 'Last Year', action: () => { const y = new Date().getFullYear() - 1; setDateRange({ startDate: `${y}-01-01`, endDate: `${y}-12-31` }); } }
                      ].map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={preset.action}
                          style={{
                            display: 'block',
                            width: '100%',
                            padding: '8px 12px',
                            marginBottom: 4,
                            textAlign: 'left',
                            background: idx === 0 ? '#f0f9ff' : 'transparent',
                            border: 'none',
                            borderRadius: 6,
                            fontSize: 14,
                            fontWeight: idx === 0 ? 600 : 500,
                            color: '#334155',
                            cursor: 'pointer',
                            transition: 'background 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#f0f9ff'}
                          onMouseLeave={(e) => e.currentTarget.style.background = idx === 0 ? '#f0f9ff' : 'transparent'}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>

                    {/* Right Side - Dual Calendar Views */}
                    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
                      
                      {/* First Calendar */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                          <button type="button" onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() - 1)))} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 18 }}>‹</button>
                          <span style={{ fontSize: 14, fontWeight: 600, color: '#334155' }}>{currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                          <button type="button" onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() + 1)))} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 18 }}>›</button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, textAlign: 'center' }}>
                          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                            <div key={day} style={{ fontSize: 11, fontWeight: 600, color: '#64748b', padding: '4px 0' }}>{day}</div>
                          ))}
                          {generateCalendarDays(currentMonth).map((day, idx) => {
                            const dayDate = day ? formatDateToYYYYMMDD(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)) : null;
                            const isSelected = dayDate && ((dateRange.startDate === dayDate) || (dateRange.endDate === dayDate));
                            const isInRange = dayDate && dateRange.startDate && dateRange.endDate && dayDate >= dateRange.startDate && dayDate <= dateRange.endDate;
                            return (
                              <div
                                key={idx}
                                onClick={() => day && handleCalendarDateClick(day, currentMonth)}
                                style={{
                                  padding: '6px',
                                  borderRadius: 6,
                                  fontSize: 13,
                                  cursor: day ? 'pointer' : 'default',
                                  background: isSelected ? '#0ea5e9' : isInRange ? '#e0f2fe' : 'transparent',
                                  color: isSelected ? '#fff' : day ? '#334155' : '#cbd5e1',
                                  fontWeight: isSelected ? 600 : 400
                                }}
                              >
                                {day || ''}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Second Calendar */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                          <button type="button" onClick={() => setEndMonth(new Date(endMonth.setMonth(endMonth.getMonth() - 1)))} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 18 }}>‹</button>
                          <span style={{ fontSize: 14, fontWeight: 600, color: '#334155' }}>{endMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                          <button type="button" onClick={() => setEndMonth(new Date(endMonth.setMonth(endMonth.getMonth() + 1)))} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 18 }}>›</button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, textAlign: 'center' }}>
                          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                            <div key={day} style={{ fontSize: 11, fontWeight: 600, color: '#64748b', padding: '4px 0' }}>{day}</div>
                          ))}
                          {generateCalendarDays(endMonth).map((day, idx) => {
                            const dayDate = day ? formatDateToYYYYMMDD(new Date(endMonth.getFullYear(), endMonth.getMonth(), day)) : null;
                            const isSelected = dayDate && ((dateRange.startDate === dayDate) || (dateRange.endDate === dayDate));
                            const isInRange = dayDate && dateRange.startDate && dateRange.endDate && dayDate >= dateRange.startDate && dayDate <= dateRange.endDate;
                            return (
                              <div
                                key={idx}
                                onClick={() => day && handleCalendarDateClick(day, endMonth)}
                                style={{
                                  padding: '6px',
                                  borderRadius: 6,
                                  fontSize: 13,
                                  cursor: day ? 'pointer' : 'default',
                                  background: isSelected ? '#0ea5e9' : isInRange ? '#e0f2fe' : 'transparent',
                                  color: isSelected ? '#fff' : day ? '#334155' : '#cbd5e1',
                                  fontWeight: isSelected ? 600 : 400
                                }}
                              >
                                {day || ''}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Footer - Cancel and Apply buttons */}
                  <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 12, paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
                    <button 
                      type="button" 
                      onClick={() => setDateRange({ startDate: '', endDate: '' })}
                      style={{ padding: '8px 20px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer', color: '#334155' }}
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      disabled={loading || !hasGeneratePermissionForType(reportType)}
                      style={{ padding: '10px 24px', borderRadius: 6, border: 'none', background: loading ? '#94a3b8' : '#14b8a6', fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}
                    >
                      {loading ? (
                        <>
                          <i className="bi bi-hourglass-split spin"></i>
                          Generating...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-play-circle"></i>
                          Apply and Generate
                        </>
                      )}
                    </button>
                  </div>

                  {/* Hidden native date inputs for form validation */}
                  <input type="hidden" id="startDate" value={dateRange.startDate} required />
                  <input type="hidden" id="endDate" value={dateRange.endDate} required />
                </div>
              </div>
            ) : null}

            {/* Hidden Calendar Widgets - keeping structure but hiding */}
            <div
              className="dual-calendar-container"
              style={{
                display: 'none',
                marginTop: '24px',
                gap: '24px',
                marginBottom: '20px',
                padding: '16px 20px',
                background: '#f8fafc',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                flexWrap: 'wrap',
                alignItems: 'flex-end'
              }}
            >
                  {/* Start Date Input with selection modes */}
                  <div style={{ flex: '1', minWidth: '220px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                      <i className="bi bi-calendar-event" style={{ marginRight: '6px' }}></i>Start Date
                    </label>

                    <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                      <button
                        type="button"
                        className={`btn btn-sm ${startMode === 'date' ? 'active' : ''}`}
                        onClick={() => setStartMode('date')}
                        style={{ padding: '6px 10px', borderRadius: 8, border: startMode === 'date' ? '2px solid #2563eb' : '1px solid #e2e8f0', background: startMode === 'date' ? '#eef2ff' : '#fff', cursor: 'pointer' }}
                      >Date</button>
                      <button
                        type="button"
                        className={`btn btn-sm ${startMode === 'month' ? 'active' : ''}`}
                        onClick={() => setStartMode('month')}
                        style={{ padding: '6px 10px', borderRadius: 8, border: startMode === 'month' ? '2px solid #2563eb' : '1px solid #e2e8f0', background: startMode === 'month' ? '#eef2ff' : '#fff', cursor: 'pointer' }}
                      >Month</button>
                      <button
                        type="button"
                        className={`btn btn-sm ${startMode === 'year' ? 'active' : ''}`}
                        onClick={() => setStartMode('year')}
                        style={{ padding: '6px 10px', borderRadius: 8, border: startMode === 'year' ? '2px solid #2563eb' : '1px solid #e2e8f0', background: startMode === 'year' ? '#eef2ff' : '#fff', cursor: 'pointer' }}
                      >Year</button>
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
                      Choose how to select the Start value: <strong>Date</strong> (exact day), <strong>Month</strong> (entire month), or <strong>Year</strong> (entire year).
                    </div>

                    {startMode === 'date' && (
                      <input
                        type="date"
                        value={dateRange.startDate}
                        onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          border: '2px solid #e2e8f0',
                          fontSize: '14px',
                          fontWeight: 500,
                          color: '#1e293b',
                          background: '#fff',
                          cursor: 'pointer'
                        }}
                      />
                    )}

                    {startMode === 'month' && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <select
                          value={new Date(dateRange.startDate || new Date()).getMonth()}
                          onChange={(e) => {
                            const month = parseInt(e.target.value, 10);
                            const year = new Date(dateRange.startDate || new Date()).getFullYear();
                            const startOfMonth = new Date(year, month, 1);
                            const newStart = formatDateToYYYYMMDD(startOfMonth);
                            setCurrentMonth(startOfMonth);
                            setDateRange(prev => ({
                              ...prev,
                              startDate: newStart,
                              endDate: prev.endDate && prev.endDate < newStart ? newStart : prev.endDate
                            }));
                          }}
                          style={{ flex: 1, padding: '10px 12px', borderRadius: '8px', border: '2px solid #e2e8f0', background: '#fff' }}
                        >
                          <option value={0}>January</option>
                          <option value={1}>February</option>
                          <option value={2}>March</option>
                          <option value={3}>April</option>
                          <option value={4}>May</option>
                          <option value={5}>June</option>
                          <option value={6}>July</option>
                          <option value={7}>August</option>
                          <option value={8}>September</option>
                          <option value={9}>October</option>
                          <option value={10}>November</option>
                          <option value={11}>December</option>
                        </select>
                        <select
                          value={new Date(dateRange.startDate || new Date()).getFullYear()}
                          onChange={(e) => {
                            const year = parseInt(e.target.value, 10);
                            const month = new Date(dateRange.startDate || new Date()).getMonth();
                            const startOfMonth = new Date(year, month, 1);
                            const newStart = formatDateToYYYYMMDD(startOfMonth);
                            setCurrentMonth(startOfMonth);
                            setDateRange(prev => ({
                              ...prev,
                              startDate: newStart,
                              endDate: prev.endDate && prev.endDate < newStart ? newStart : prev.endDate
                            }));
                          }}
                          style={{ width: '110px', padding: '10px 12px', borderRadius: '8px', border: '2px solid #e2e8f0', background: '#fff' }}
                        >
                          {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i).map(y => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {startMode === 'year' && (
                      <select
                        value={new Date(dateRange.startDate || new Date()).getFullYear()}
                        onChange={(e) => {
                          const year = parseInt(e.target.value, 10);
                          const startOfYear = new Date(year, 0, 1);
                          const newStart = formatDateToYYYYMMDD(startOfYear);
                          setDateRange(prev => ({
                            ...prev,
                            startDate: newStart,
                            endDate: prev.endDate && prev.endDate < newStart ? newStart : prev.endDate
                          }));
                        }}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '2px solid #e2e8f0', background: '#fff' }}
                      >
                        {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i).map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* End Date Input with selection modes */}
                  <div style={{ flex: '1', minWidth: '220px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                      <i className="bi bi-calendar-event" style={{ marginRight: '6px' }}></i>End Date
                    </label>

                    <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                      <button
                        type="button"
                        className={`btn btn-sm ${endMode === 'date' ? 'active' : ''}`}
                        onClick={() => setEndMode('date')}
                        style={{ padding: '6px 10px', borderRadius: 8, border: endMode === 'date' ? '2px solid #2563eb' : '1px solid #e2e8f0', background: endMode === 'date' ? '#eef2ff' : '#fff', cursor: 'pointer' }}
                      >Date</button>
                      <button
                        type="button"
                        className={`btn btn-sm ${endMode === 'month' ? 'active' : ''}`}
                        onClick={() => setEndMode('month')}
                        style={{ padding: '6px 10px', borderRadius: 8, border: endMode === 'month' ? '2px solid #2563eb' : '1px solid #e2e8f0', background: endMode === 'month' ? '#eef2ff' : '#fff', cursor: 'pointer' }}
                      >Month</button>
                      <button
                        type="button"
                        className={`btn btn-sm ${endMode === 'year' ? 'active' : ''}`}
                        onClick={() => setEndMode('year')}
                        style={{ padding: '6px 10px', borderRadius: 8, border: endMode === 'year' ? '2px solid #2563eb' : '1px solid #e2e8f0', background: endMode === 'year' ? '#eef2ff' : '#fff', cursor: 'pointer' }}
                      >Year</button>
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
                      Choose how to select the End value: <strong>Date</strong> (exact day), <strong>Month</strong> (entire month), or <strong>Year</strong> (entire year).
                    </div>

                    {endMode === 'date' && (
                      <input
                        type="date"
                        value={dateRange.endDate}
                        onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          border: '2px solid #e2e8f0',
                          fontSize: '14px',
                          fontWeight: 500,
                          color: '#1e293b',
                          background: '#fff',
                          cursor: 'pointer'
                        }}
                      />
                    )}

                    {endMode === 'month' && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <select
                          value={new Date(dateRange.endDate || new Date()).getMonth()}
                          onChange={(e) => {
                            const month = parseInt(e.target.value, 10);
                            const year = new Date(dateRange.endDate || new Date()).getFullYear();
                            const endOfMonth = new Date(year, month + 1, 0);
                            const newEnd = formatDateToYYYYMMDD(endOfMonth);
                            setEndMonth(endOfMonth);
                            setDateRange(prev => ({ ...prev, endDate: newEnd, startDate: prev.startDate && prev.startDate > newEnd ? newEnd : prev.startDate }));
                          }}
                          style={{ flex: 1, padding: '10px 12px', borderRadius: '8px', border: '2px solid #e2e8f0', background: '#fff' }}
                        >
                          <option value={0}>January</option>
                          <option value={1}>February</option>
                          <option value={2}>March</option>
                          <option value={3}>April</option>
                          <option value={4}>May</option>
                          <option value={5}>June</option>
                          <option value={6}>July</option>
                          <option value={7}>August</option>
                          <option value={8}>September</option>
                          <option value={9}>October</option>
                          <option value={10}>November</option>
                          <option value={11}>December</option>
                        </select>
                        <select
                          value={new Date(dateRange.endDate || new Date()).getFullYear()}
                          onChange={(e) => {
                            const year = parseInt(e.target.value, 10);
                            const month = new Date(dateRange.endDate || new Date()).getMonth();
                            const endOfMonth = new Date(year, month + 1, 0);
                            const newEnd = formatDateToYYYYMMDD(endOfMonth);
                            setEndMonth(endOfMonth);
                            setDateRange(prev => ({ ...prev, endDate: newEnd, startDate: prev.startDate && prev.startDate > newEnd ? newEnd : prev.startDate }));
                          }}
                          style={{ width: '110px', padding: '10px 12px', borderRadius: '8px', border: '2px solid #e2e8f0', background: '#fff' }}
                        >
                          {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i).map(y => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {endMode === 'year' && (
                      <select
                        value={new Date(dateRange.endDate || new Date()).getFullYear()}
                        onChange={(e) => {
                          const year = parseInt(e.target.value, 10);
                          const endOfYear = new Date(year, 11, 31);
                          setDateRange(prev => ({ ...prev, endDate: formatDateToYYYYMMDD(endOfYear) }));
                        }}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '2px solid #e2e8f0', background: '#fff' }}
                      >
                        {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i).map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Month/Year Quick Select */}
                  <div style={{ flex: '1', minWidth: '280px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                      <i className="bi bi-calendar-month" style={{ marginRight: '6px' }}></i>Quick Month/Year
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <select
                        value={new Date(dateRange.startDate || new Date()).getMonth()}
                        onChange={(e) => {
                          const month = parseInt(e.target.value);
                          const year = new Date(dateRange.startDate || new Date()).getFullYear();
                          const startOfMonth = new Date(year, month, 1);
                          const endOfMonth = new Date(year, month + 1, 0);
                          setDateRange({
                            startDate: startOfMonth.toISOString().split('T')[0],
                            endDate: endOfMonth.toISOString().split('T')[0]
                          });
                        }}
                        style={{
                          flex: '1',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: '2px solid #e2e8f0',
                          fontSize: '14px',
                          fontWeight: 500,
                          color: '#1e293b',
                          background: '#fff',
                          cursor: 'pointer'
                        }}
                      >
                        <option value={0}>January</option>
                        <option value={1}>February</option>
                        <option value={2}>March</option>
                        <option value={3}>April</option>
                        <option value={4}>May</option>
                        <option value={5}>June</option>
                        <option value={6}>July</option>
                        <option value={7}>August</option>
                        <option value={8}>September</option>
                        <option value={9}>October</option>
                        <option value={10}>November</option>
                        <option value={11}>December</option>
                      </select>
                      <select
                        value={new Date(dateRange.startDate || new Date()).getFullYear()}
                        onChange={(e) => {
                          const year = parseInt(e.target.value);
                          const month = new Date(dateRange.startDate || new Date()).getMonth();
                          const startOfMonth = new Date(year, month, 1);
                          const endOfMonth = new Date(year, month + 1, 0);
                          setDateRange({
                            startDate: startOfMonth.toISOString().split('T')[0],
                            endDate: endOfMonth.toISOString().split('T')[0]
                          });
                        }}
                        style={{
                          width: '100px',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: '2px solid #e2e8f0',
                          fontSize: '14px',
                          fontWeight: 500,
                          color: '#1e293b',
                          background: '#fff',
                          cursor: 'pointer'
                        }}
                      >
                        {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i).map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>



                {/* Selection Mode Indicator
                <div className="selection-mode-indicator">
                  <span className={`mode-badge ${calendarSelectMode === 'start' ? 'active' : ''}`}>
                    <i className="bi bi-1-circle"></i> Click date to select
                  </span>
                  <span className={`mode-badge ${calendarSelectMode === 'end' ? 'active' : ''}`}>
                    <i className="bi bi-2-circle"></i> Click another for range
                  </span>
                  <span className="hint-text">
                    <i className="bi bi-info-circle"></i> Single click = one day
                  </span>
                </div> */}

                {/* Quick Date Selection Buttons */}
                {/* <div className="quick-date-buttons enhanced">
                  <button 
                    type="button"
                    onClick={() => {
                      const today = new Date().toISOString().split('T')[0];
                      setDateRange({ startDate: today, endDate: today });
                      setCalendarSelectMode('start');
                    }}
                    className={`btn btn-quick ${dateRange.startDate === new Date().toISOString().split('T')[0] && dateRange.endDate === new Date().toISOString().split('T')[0] ? 'active' : ''}`}
                  >
                    <i className="bi bi-calendar-day"></i> Today
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      const today = new Date();
                      const yesterday = new Date(today);
                      yesterday.setDate(today.getDate() - 1);
                      setDateRange({ 
                        startDate: yesterday.toISOString().split('T')[0], 
                        endDate: yesterday.toISOString().split('T')[0] 
                      });
                      setCalendarSelectMode('start');
                    }}
                    className="btn btn-quick"
                  >
                    <i className="bi bi-calendar-minus"></i> Yesterday
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      const today = new Date();
                      const lastWeek = new Date(today);
                      lastWeek.setDate(today.getDate() - 7);
                      setDateRange({ 
                        startDate: lastWeek.toISOString().split('T')[0], 
                        endDate: today.toISOString().split('T')[0] 
                      });
                      setCalendarSelectMode('start');
                    }}
                    className="btn btn-quick"
                  >
                    <i className="bi bi-calendar-week"></i> Last 7 Days
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      const today = new Date();
                      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
                      setDateRange({ 
                        startDate: startOfMonth.toISOString().split('T')[0], 
                        endDate: today.toISOString().split('T')[0] 
                      });
                      setCalendarSelectMode('start');
                    }}
                    className="btn btn-quick"
                  >
                    <i className="bi bi-calendar-month"></i> This Month
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      const today = new Date();
                      const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                      const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
                      setDateRange({ 
                        startDate: startOfLastMonth.toISOString().split('T')[0], 
                        endDate: endOfLastMonth.toISOString().split('T')[0] 
                      });
                      setCalendarSelectMode('start');
                    }}
                    className="btn btn-quick"
                  >
                    <i className="bi bi-calendar2-minus"></i> Last Month
                  </button>
                </div> */}

                {/* Full Calendar UI */}
                {/* <div className="calendar-container">
                  <div className="calendar-widget main-calendar">
                    <div className="calendar-header-controls">
                      <button type="button" onClick={previousMonth} className="calendar-nav-btn">
                        <i className="bi bi-chevron-left"></i>
                      </button>
                      <div className="calendar-month-year">
                        {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </div>
                      <button type="button" onClick={nextMonth} className="calendar-nav-btn">
                        <i className="bi bi-chevron-right"></i>
                      </button>
                    </div>
                    
                    <div className="calendar-grid">
                      <div className="calendar-weekdays">
                        <div className="calendar-weekday sun">SUN</div>
                        <div className="calendar-weekday">MON</div>
                        <div className="calendar-weekday">TUE</div>
                        <div className="calendar-weekday">WED</div>
                        <div className="calendar-weekday">THU</div>
                        <div className="calendar-weekday">FRI</div>
                        <div className="calendar-weekday sat">SAT</div>
                      </div>
                      
                      <div className="calendar-days">
                        {generateCalendarDays(currentMonth).map((day, index) => {
                          const dayClasses = [
                            'calendar-day',
                            !day ? 'empty' : '',
                            isStartDate(day, currentMonth) ? 'start-date' : '',
                            isEndDate(day, currentMonth) ? 'end-date' : '',
                            isDateInRange(day, currentMonth) ? 'in-range' : '',
                            isToday(day, currentMonth) ? 'today' : '',
                            (index % 7 === 0) ? 'sunday' : '',
                            (index % 7 === 6) ? 'saturday' : ''
                          ].filter(Boolean).join(' ');
                          
                          return (
                            <div
                              key={index}
                              className={dayClasses}
                              onClick={() => handleCalendarDateClick(day, currentMonth)}
                            >
                              {day && <span className="day-number">{day}</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div> */}

                {/* Hidden native date inputs for form validation */}
                <input
                  type="hidden"
                  id="startDate"
                  value={dateRange.startDate}
                  required
                />
                <input
                  type="hidden"
                  id="endDate"
                  value={dateRange.endDate}
                  required
                />
              </div>
            

            {/* Generate Report Button - Hidden (now combined with Apply button in date selector) */}
            <div className="form-actions" style={{ marginTop: '2rem', display: 'none', justifyContent: 'center' }}>
              <button
                type="submit"
                disabled={loading || !hasGeneratePermissionForType(reportType)}
                className="btn btn-primary btn-generate"
              >
                {loading ? (
                  <>
                    <i className="bi bi-hourglass-split spin"></i>
                    Generating...
                  </>
                ) : (
                  <>
                    <i className="bi bi-play-circle"></i>
                    Generate Report
                  </>
                )}
              </button>
            </div>

            {/* Old form structure for reference - will be hidden */}
            <div style={{ display: 'none' }}>
            <div className="form-grid" style={{display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '16px', alignItems: 'end'}}>
            {/* Report Type Selection */}
            <div className="form-group">
              <label htmlFor="reportType-old">
                <i className="bi bi-file-earmark-text"></i>
                {t('reportTypeLabel')}
              </label>
              <select
                id="reportType-old"
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="form-control"
              >
                <option value="attendance">{t('attendanceReport')}</option>
                <option value="audit">{t('auditReport')}</option>
              </select>
            </div>

            {/* Report Scope Selection */}
            <div className="form-group">
              <label htmlFor="reportScope">
                <i className="bi bi-people"></i>
                {t('reportScopeLabel')}
              </label>
              <select
                id="reportScope"
                value={reportScope}
                onChange={(e) => setReportScope(e.target.value)}
                className="form-control"
                disabled={reportType === 'audit'}
                title={reportType === 'audit' ? t('auditReport') + ' ' + t('groupReport') : t('reportScopeLabel')}
              >
                <option value="individual">{t('individualReport')}</option>
                <option value="group">{t('groupReport')}</option>
              </select>
            </div>

            {/* Report Grouping - only for group reports (not for attendance or meal) - Next to Report Scope */}
            {reportScope === 'group' && reportType !== 'attendance' && reportType !== 'meal' && (
              <div className="form-group">
                <label htmlFor="reportGrouping">
                  <i className="bi bi-collection"></i>
                  Group By
                </label>
                <select
                  id="reportGrouping"
                  value={reportGrouping}
                  onChange={(e) => setReportGrouping(e.target.value)}
                  className="form-control"
                >
                  <option value="none">None</option>
                  <option value="designation">Designation Wise</option>
                  <option value="punch">F1-0 (Punch Type)</option>
                </select>
              </div>
            )}

            {/* Employee ID - only visible for individual scope and not for meal report */}
            {reportScope === 'individual' && reportType !== 'meal' && (
              <div className="form-group" style={{gridColumn: 'span 1'}}>
                <label htmlFor="employeeId">
                  <i className="bi bi-person-badge"></i>
                  {t('employeeIdLabel')}
                </label>
                <input
                  type="text"
                  id="employeeId"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="form-control"
                  placeholder={t('enterEmployeeId')}
                  required={reportScope === 'individual'}
                  title={t('enterEmployeeId')}
                />
              </div>
            )}

            {/* Division and Section - only visible for group scope or meal report */}
            {(reportScope === 'group' || reportType === 'meal') && (
              <>
                {/* Division - always visible, disabled for individual scope */}
                <div className="form-group" style={{gridColumn: 'span 1'}}>
                  <label htmlFor="divisionId">
                    <i className="bi bi-building"></i>
                      {t('divisionLabel')}
                  </label>
                  <select
                    id="divisionId"
                    value={divisionId}
                    onChange={(e) => setDivisionId(e.target.value)}
                    className="form-control"
                    disabled={reportScope === 'individual' && reportType !== 'meal'}
                    style={{ cursor: (reportScope === 'individual' && reportType !== 'meal') ? 'not-allowed' : 'pointer' }}
                  >
                    <option value="all">{t('allDivisionsLabel')}</option>
                    {(Array.isArray(divisions) ? divisions : []).map(division => (
                      <option key={division._id || division.id} value={division._id || division.id}>
                        {division.name || division.division_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Section - always visible, disabled for individual scope (but enabled for meal report) */}
                <div className="form-group" style={{gridColumn: 'span 1'}}>
                  <label htmlFor="sectionId">
                    <i className="bi bi-diagram-3"></i>
                      {t('sectionLabel')}
                  </label>
                  <select
                    id="sectionId"
                    value={sectionId}
                    onChange={(e) => setSectionId(e.target.value)}
                    className="form-control"
                    disabled={reportType === 'meal' ? false : (reportScope === 'individual' || divisionId === 'all')}
                    style={{ cursor: (reportType === 'meal' ? 'pointer' : ((reportScope === 'individual' || divisionId === 'all') ? 'not-allowed' : 'pointer')) }}
                    title={reportType === 'meal' ? 'Select a section' : (divisionId === 'all' ? 'All Divisions selected - Section must be All' : 'Select a section')}
                  >
                    <option value="all">
                      {t('allSectionsLabel')}
                    </option>
                    {(reportType === 'meal' || divisionId !== 'all') && (Array.isArray(sections) ? sections : []).map(section => (
                      <option key={section._id || section.id} value={section._id || section.id}>
                        {section.name || section.section_name}
                      </option>
                    ))}
                  </select>
                </div>
                {/* Sub Section - only visible for group scope (optional for meal report) */}
                <div className="form-group" style={{gridColumn: 'span 1'}}>
                  <label htmlFor="subSectionId">
                    <i className="bi bi-diagram-2"></i>
                      {t('subSectionLabel')}
                  </label>
                  <select
                    id="subSectionId"
                    value={subSectionId}
                    onChange={e => setSubSectionId(e.target.value)}
                    className="form-control"
                    disabled={reportType === 'meal' ? false : (reportScope !== 'group' || sectionId === 'all' || divisionId === 'all')}
                    style={{ cursor: (reportType === 'meal' ? 'pointer' : ((reportScope !== 'group' || sectionId === 'all' || divisionId === 'all') ? 'not-allowed' : 'pointer')) }}
                    title={reportType === 'meal' ? 'Select a sub section (optional)' : (divisionId === 'all' ? 'All Divisions selected - Sub Section must be All' : sectionId === 'all' ? 'Please select a section first' : 'Select a sub section')}
                  >
                    <option value="all">
                      {divisionId === 'all' ? t('allSubSectionsLabel') : sectionId === 'all' ? t('selectSectionFirst') : t('allSubSectionsLabel')}
                    </option>
                    {(reportType === 'meal' || (sectionId !== 'all' && divisionId !== 'all')) && (Array.isArray(subSections) ? subSections : []).map(sub => (
                      <option key={sub._id || sub.id} value={sub._id || sub.id}>
                        {sub.subSection?.sub_hie_name || sub.subSection?.name || sub.subSection?.hie_name || sub.subSection?.sub_hie_code || sub.subSection?.code || 'Unnamed'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Time Period Selection - Next to Sub Section - Hidden for Designation grouping, Attendance and Meal reports */}
                {reportGrouping !== 'designation' && reportType !== 'attendance' && reportType !== 'meal' && (
                  <div className="form-group" style={{gridColumn: 'span 1'}}>
                    <label htmlFor="timePeriod">
                      <i className="bi bi-calendar-range"></i>
                      Time Period
                    </label>
                    <select
                      id="timePeriod"
                      value={timePeriod}
                      onChange={(e) => setTimePeriod(e.target.value)}
                      className="form-control"
                    >
                      <option value="none">None</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="annually">Annually</option>
                    </select>
                  </div>
                )}
              </>
            )}

            {/* Date Range - Hidden for Designation grouping */}
            {reportGrouping !== 'designation' && (
              <>
                <div className="form-group">
                  <label htmlFor="startDate">
                    <i className="bi bi-calendar3"></i>
                    Start Date
                  </label>
                  <input
                    type="date"
                    id="startDate"
                    value={dateRange.startDate}
                    onChange={(e) => setDateRange({...dateRange, startDate: e.target.value})}
                    className="form-control"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="endDate">
                    <i className="bi bi-calendar3"></i>
                    End Date
                  </label>
                  <input
                    type="date"
                    id="endDate"
                    value={dateRange.endDate}
                    onChange={(e) => setDateRange({...dateRange, endDate: e.target.value})}
                    className="form-control"
                    required
                  />
                </div>
              </>
            )}
          </div>
          </div>

          {/* Employee info preview (appears when division, section and employee ID are provided) */}
          {employeeId && employeeInfo && (
            <div style={{ margin: '24px 0', display: 'flex', justifyContent: 'center' }}>
              <div style={{ background: '#fff', border: '1px solid #e6eefc', padding: '12px 18px', borderRadius: 10, boxShadow: '0 2px 8px rgba(102,126,234,0.06)', minWidth: 360 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>{employeeInfo.FULLNAME || employeeInfo.FULL_NAME || employeeInfo.CALLING_NAME || employeeInfo.name || employeeInfo.employee_name || ''}</div>
                <div style={{ display: 'flex', gap: 12, fontSize: 14 }}>
                  <div>Emp No: <b>{employeeInfo.EMP_NUMBER || employeeInfo.employee_id || employeeInfo.employeeId || employeeInfo._id}</b></div>
                  <div>Division: <b>{employeeInfo.DIVISION_NAME || employeeInfo.division?.name || ''}</b></div>
                  <div>Section: <b>{employeeInfo.SECTION_NAME || employeeInfo.section?.name || ''}</b></div>
                </div>
              </div>
            </div>
          )}

          {/* If employeeId provided but no match found AND no report data, show warning */}
          {employeeId && !employeeInfo && reportData && reportData.data && reportData.data.length === 0 && (
            <div style={{ margin: '8px 0 18px', display: 'flex', justifyContent: 'center' }}>
              <div style={{ background: '#fff6f6', border: '1px solid #fde2e2', padding: '10px 14px', borderRadius: 8, color: '#c53030', minWidth: 360, textAlign: 'center' }}>
                No employee found with the entered ID.
              </div>
            </div>
          )}

        </form>
      </div>

      {/* Error Display */}
      {error && (
        <div className="error-message">
          <i className="bi bi-exclamation-triangle"></i>
          {t('noDataFoundText') && error && error.includes('No records') ? t('noDataFoundText') : error}
        </div>
      )}

      {/* Report Results Modal */}
      {showReportModal && reportData && (reportData.data && reportData.data.length > 0) && (
        <div className="report-modal-overlay" onClick={() => setShowReportModal(false)}>
          <div className="report-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="report-modal-close" onClick={() => setShowReportModal(false)}>
              <i className="bi bi-x-lg"></i>
            </button>
        <div className="report-results">
          <div className="results-header">
            <div className="filter-summary attractive-summary-card" style={{
              background: '#fff',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              padding: '18px 28px 16px 28px',
              color: '#222',
              fontFamily: 'Segoe UI, Arial, sans-serif',
              fontSize: '1.05rem',
              margin: '0 auto 18px auto',
              boxShadow: '0 2px 8px 0 rgba(80,80,120,0.06)',
              maxWidth: '98vw',
              fontWeight: 500
            }}>
              <div style={{fontWeight: 800, fontSize: '1.25rem', marginBottom: 10, letterSpacing: '0.2px'}}>Report Filter Summary</div>
              <div style={{display: 'flex', flexWrap: 'wrap', gap: '32px 48px', marginBottom: 6}}>
                <span>Type: <b>{reportType === 'attendance' ? 'Attendance Report' : reportType === 'audit' ? 'Audit Report' : 'Meal Report'}</b></span>
                <span>Scope: <b>{reportScope === 'group' ? 'Group' : 'Individual'}</b></span>
                {reportScope === 'individual' && (
                  <span>Employee ID: <b>{employeeId || (employeeInfo && (employeeInfo.employee_id || employeeInfo.id)) || 'N/A'}</b></span>
                )}
                {reportScope === 'group' && (
                  <>
                    <span>Division: <b>{divisionId === 'all' ? 'All' : (divisions.find(d => d._id === divisionId || d.id === divisionId)?.name || divisionId)}</b></span>
                    <span>Section: <b>{sectionId === 'all' ? 'All' : (sections.find(s => s._id === sectionId || s.id === sectionId)?.name || sectionId)}</b></span>
                  </>
                )}
              </div>
              <div style={{display: 'flex', flexWrap: 'wrap', gap: '32px 48px', borderTop: '1px solid #eee', paddingTop: 8}}>
                <span>Date Range: <b>{dateRange.startDate} to {dateRange.endDate}</b></span>
                <span>
                  {reportData.reportType === 'group' ? 'Employees Found:' : 'Records Found:'}
                  <b>{filteredData.length}</b>
                  {filteredData.length !== (reportData.data?.length || 0) && (
                    <span style={{ marginLeft: 8, color: '#666', fontWeight: 400 }}>({reportData.data?.length || 0} total)</span>
                  )}
                </span>
                <span style={{color: '#666', fontWeight: 400, fontSize: '0.98rem', marginLeft: 'auto'}}>Generated at {new Date().toLocaleString()}</span>
              </div>
              
              {/* Meal Report Summary Stats */}
              {reportType === 'meal' && reportData.summary && (
                <div style={{borderTop: '1px solid #eee', paddingTop: 12, marginTop: 10}}>
                  <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '12px'}}>
                    <div style={{
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 12, 
                      padding: '14px 18px', 
                      backgroundColor: '#f0f9ff', 
                      borderRadius: '8px',
                      border: '1px solid #bfdbfe'
                    }}>
                      <i className="bi bi-basket-fill" style={{fontSize: '1.6rem', color: '#0284c7'}}></i>
                      <div>
                        <div style={{fontSize: '0.85rem', color: '#64748b', marginBottom: '2px'}}>Meal Packets Only</div>
                        <div style={{fontSize: '1.5rem', fontWeight: 'bold', color: '#0284c7'}}>{reportData.summary.totalMealPacketEmployees || 0}</div>
                      </div>
                    </div>
                    
                    <div style={{
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 12, 
                      padding: '14px 18px', 
                      backgroundColor: '#fef3c7', 
                      borderRadius: '8px',
                      border: '1px solid #fcd34d'
                    }}>
                      <i className="bi bi-cash-coin" style={{fontSize: '1.6rem', color: '#d97706'}}></i>
                      <div>
                        <div style={{fontSize: '0.85rem', color: '#78716c', marginBottom: '2px'}}>Meal Money Only</div>
                        <div style={{fontSize: '1.5rem', fontWeight: 'bold', color: '#d97706'}}>{reportData.summary.totalMealMoneyEmployees || 0}</div>
                      </div>
                    </div>
                    
                    <div style={{
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 12, 
                      padding: '14px 18px', 
                      backgroundColor: '#f3e8ff', 
                      borderRadius: '8px',
                      border: '1px solid #d8b4fe'
                    }}>
                      <i className="bi bi-award-fill" style={{fontSize: '1.6rem', color: '#9333ea'}}></i>
                      <div>
                        <div style={{fontSize: '0.85rem', color: '#6b7280', marginBottom: '2px'}}>Both Types</div>
                        <div style={{fontSize: '1.5rem', fontWeight: 'bold', color: '#9333ea'}}>{reportData.summary.totalBothTypesEmployees || 0}</div>
                      </div>
                    </div>
                    
                    <div style={{
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 12, 
                      padding: '14px 18px', 
                      backgroundColor: '#dcfce7', 
                      borderRadius: '8px',
                      border: '1px solid #86efac'
                    }}>
                      <i className="bi bi-people-fill" style={{fontSize: '1.6rem', color: '#15803d'}}></i>
                      <div>
                        <div style={{fontSize: '0.85rem', color: '#64748b', marginBottom: '2px'}}>Total Unique Employees</div>
                        <div style={{fontSize: '1.5rem', fontWeight: 'bold', color: '#15803d'}}>{reportData.summary.totalEmployees || 0}</div>
                      </div>
                    </div>
                  </div>
                  
                  <div style={{display: 'flex', justifyContent: 'center', padding: '8px', backgroundColor: '#f8fafc', borderRadius: '6px', fontSize: '0.9rem', color: '#64748b'}}>
                    <i className="bi bi-info-circle" style={{marginRight: '6px'}}></i>
                    Total meal records processed: <b style={{marginLeft: '4px', color: '#475569'}}>{reportData.summary.totalMealRecords || 0}</b>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Data Preview Row */}
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '18px', marginBottom: '8px'}}>
            <div style={{display: 'flex', alignItems: 'center', fontWeight: 600, fontSize: '1.15rem'}}>
              <i className="bi bi-table" style={{marginRight: 10, marginLeft: 12, fontSize: '1.2rem'}}></i>
              Data Preview
            </div>
            {/* Export Options - Only show for non-audit reports */}
            {reportType !== 'audit' && (
              <div className="action-group" style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                <span style={{fontWeight: 600, fontSize: '1.15rem', display: 'flex', alignItems: 'center', marginLeft: 12}}>
                  <i className="bi bi-download" style={{marginRight: 6, fontSize: '1.2rem'}}></i>
                  Export Options
                </span>
                {/* Print PDF should be controlled for attendance reports by attendance_download permission */}
                {!(reportType === 'attendance') || canDownloadAttendance ? (
                  <button
                    onClick={() => exportReport('pdf')}
                    className="btn btn-outline-primary"
                    style={{marginLeft: 8, marginRight: 18, display: 'flex', alignItems: 'center', fontWeight: 500, fontSize: '1rem'}}
                  >
                    <i className="bi bi-file-earmark-pdf" style={{marginRight: 5, fontSize: '1.1rem'}}></i>
                    Print PDF
                  </button>
                ) : (
                  <button
                    disabled
                    title="You do not have permission to download this report"
                    className="btn btn-outline-secondary"
                    style={{marginLeft: 8, marginRight: 18, display: 'flex', alignItems: 'center', fontWeight: 500, fontSize: '1rem', opacity: 0.7}}
                  >
                    <i className="bi bi-file-earmark-pdf" style={{marginRight: 5, fontSize: '1.1rem'}}></i>
                    Print PDF
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="data-preview">
            <div className="table-responsive">
              {reportType === 'audit' ? (
                <AuditReport
                  reportData={reportData}
                />
              ) : reportScope === 'group' ? (
                <GroupReport
                  ref={groupReportRef}
                  reportData={filteredReportData}
                  getHeaders={getHeaders}
                  formatRow={formatRow}
                  reportType={reportType}
                  dateRange={dateRange}
                />
              ) : (
                <IndividualReport
                  ref={individualReportRef}
                  reportData={filteredReportData}
                  getHeaders={getHeaders}
                  formatRow={formatRow}
                  reportType={reportType}
                  dateRange={dateRange}
                  employeeInfo={employeeInfo}
                />
              )}
            </div>
          </div>
        </div>
          </div>
        </div>
      )}

      {showReportModal && reportData && (!reportData.data || reportData.data.length === 0) && (
        <div className="report-modal-overlay" onClick={() => setShowReportModal(false)}>
          <div className="report-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="report-modal-close" onClick={() => setShowReportModal(false)}>
              <i className="bi bi-x-lg"></i>
            </button>
        <div className="report-results">
          <div className="empty-state">
            <div className="empty-icon">
              <i className="bi bi-inbox"></i>
            </div>
            <h4 className="empty-title">{t('noDataFoundTitle')}</h4>
            <p className="empty-text">{t('noDataFoundText')}</p>
          </div>
        </div>
          </div>
        </div>
      )}

      {!loading && showReportModal && !reportData && (
        <div className="report-modal-overlay" onClick={() => setShowReportModal(false)}>
          <div className="report-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="report-modal-close" onClick={() => setShowReportModal(false)}>
              <i className="bi bi-x-lg"></i>
            </button>
        <div className="report-results">
          <div className="empty-state">
            <div className="empty-icon">
              <i className="bi bi-file-earmark-bar-graph"></i>
            </div>
            <h4 className="empty-title">{t('readyToGenerateTitle')}</h4>
            <p className="empty-text">{t('readyToGenerateText')}</p>
          </div>
        </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportGeneration;
