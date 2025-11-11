import React, { useState, useEffect, useCallback, useRef } from 'react';
import usePermission from '../../hooks/usePermission';
import './ReportGeneration.css';
import GroupReport from './GroupReport';
import IndividualReport from './IndividualReport';

const ReportGeneration = () => {
  const [reportType, setReportType] = useState('attendance');
  const [reportScope, setReportScope] = useState('individual');
  const [employeeId, setEmployeeId] = useState('');
  const [divisionId, setDivisionId] = useState('all');
  const [sectionId, setSectionId] = useState('all');
  const [divisions, setDivisions] = useState([]);
  const [sections, setSections] = useState([]);
  const [allSections, setAllSections] = useState([]);
  const [subSections, setSubSections] = useState([]);
  const [subSectionId, setSubSectionId] = useState('all');
  // Fetch sub sections when section changes (only for group scope and when section is selected)
  useEffect(() => {
    if (reportScope === 'group' && sectionId && sectionId !== 'all') {
      console.log(`Fetching sub sections for section: ${sectionId}`);
      const token = localStorage.getItem('token');
      fetch(`http://localhost:5000/api/subsections?sectionId=${sectionId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
        .then(res => res.json())
        .then(data => {
          console.log('Sub sections response:', data);
          if (data.success && Array.isArray(data.data)) {
            setSubSections(data.data);
            setSubSectionId('all');
          } else {
            setSubSections([]);
            setSubSectionId('all');
          }
        })
        .catch((error) => {
          console.error('Error fetching sub sections:', error);
          setSubSections([]);
          setSubSectionId('all');
        });
    } else {
      // Clear sub sections when no specific section is selected
      setSubSections([]);
      setSubSectionId('all');
    }
  }, [reportScope, sectionId]);
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  });
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [error, setError] = useState('');
  const [employeeInfo, setEmployeeInfo] = useState(null);
  const autoSelectedDivisionRef = useRef(false);
  const autoSelectedSectionRef = useRef(false);
  const groupReportRef = useRef(null);
  const individualReportRef = useRef(null);
  const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

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
  const canGenerate = usePermission('reports', 'create');

  // Fetch divisions and sections on component mount
  useEffect(() => {
    fetchDivisions();
    fetchAllSections();
    
    // Set default date range to today
    const today = new Date().toISOString().split('T')[0];
    setDateRange({
      startDate: today,
      endDate: today
    });
  }, []);


  // When scope changes to group, clear and block employeeId
  useEffect(() => {
    if (reportScope === 'group') {
      setEmployeeId('');
    }
  }, [reportScope]);

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

  const fetchSectionsByDivision = useCallback(async (divId) => {
    try {
      const token = localStorage.getItem('token');
      
      // Use MySQL sections endpoint for attendance reports to get correct section IDs
      const isAttendanceReport = reportType === 'attendance';
      const sectionsEndpoint = isAttendanceReport 
        ? `http://localhost:5000/api/divisions/${divId}/mysql-sections`
        : `http://localhost:5000/api/divisions/${divId}/sections`;
      
      console.log(`Fetching sections from: ${sectionsEndpoint}`); // Debug log
      
      const response = await fetch(sectionsEndpoint, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Sections response for division:', divId, data); // Debug log
        
        // Handle different response formats for MongoDB and MySQL
        let sectionsArray = [];
        if (Array.isArray(data)) {
          sectionsArray = data;
        } else if (data.data && Array.isArray(data.data)) {
          sectionsArray = data.data;
        } else if (data.sections && Array.isArray(data.sections)) {
          sectionsArray = data.sections;
        } else if (data.success && data.sections) {
          sectionsArray = Array.isArray(data.sections) ? data.sections : [];
        }
        
        console.log('Processed sections array:', sectionsArray); // Debug log
        setSections(sectionsArray);

        // Reset section selection to 'all' when division changes
        if (sectionsArray.length > 0) {
          setSectionId('all');
        } else {
          // If endpoint returned empty, try fallback to client-side filtering from allSections
          const fallback = filterAllSectionsByDivision(divId, allSections, divisions);
          setSections(fallback);
          setSectionId('all');
        }
      } else {
        console.error('Failed to fetch sections:', response.status, response.statusText);
        // Don't show error for divisions that don't have MySQL sections
        // Just set empty sections array
        const fallback = filterAllSectionsByDivision(divId, allSections, divisions);
        setSections(fallback);
        setSectionId('all');
      }
    } catch (err) {
      console.error('Error fetching sections by division:', err);
      const fallback = filterAllSectionsByDivision(divId, allSections, divisions);
      setSections(fallback);
      setSectionId('all');
    }
  }, [reportType, allSections, divisions]); // include allSections/divisions so fallback uses latest

  // Helper: fallback filter to derive sections from allSections when backend endpoint is unavailable
  const filterAllSectionsByDivision = (divId, allSecs = [], divs = []) => {
    if (!divId || divId === 'all') return allSecs || [];
    const normalized = (allSecs || []).filter(s => {
      if (!s) return false;
      // section.division may be object or id or name
      if (typeof s.division === 'object' && s.division?._id) return String(s.division._id) === String(divId);
      if (typeof s.division === 'string' && s.division) {
        if (s.division === divId) return true;
        // maybe division code stored instead of id
        const byCode = divs.find(d => String(d.code) === String(s.division) || String(d._id) === String(s.division));
        if (byCode && String(byCode._id) === String(divId)) return true;
      }
      // fallback: match by division name if section holds division name
      const sectionDivName = (typeof s.division === 'object' ? s.division?.name : s.division) || s.divisionName || s.DIVISION_NAME || '';
      if (sectionDivName) {
        const divObj = divs.find(d => String(d._id) === String(divId) || normalizeString(d.name) === normalizeString(sectionDivName));
        if (divObj) return true;
      }
      return false;
    });
    return normalized;
  };

  const normalizeString = (v) => (typeof v === 'string' ? v.trim().toLowerCase().replace(/\s+/g, ' ') : '');

  // Fetch sections when division changes
  useEffect(() => {
    if (divisionId && divisionId !== 'all') {
      console.log('Fetching sections for division:', divisionId); // Debug log
      fetchSectionsByDivision(divisionId);
    } else {
      console.log('Setting all sections'); // Debug log
      setSections(allSections);
      setSectionId('all');
    }
  }, [divisionId, allSections, fetchSectionsByDivision]);

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
      // Prefer HRIS divisions endpoint to match SectionManagement
      let response = await fetch('http://localhost:5000/api/divisions/hris', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.warn('HRIS divisions endpoint non-OK, falling back to /api/divisions', response.status);
        response = await fetch('http://localhost:5000/api/divisions', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
      }

      if (response.ok) {
        const data = await response.json();
        // Accept multiple response formats and normalize divisions
        let divisionsArray = [];
        if (Array.isArray(data)) {
          divisionsArray = data;
        } else if (data.data && Array.isArray(data.data)) {
          divisionsArray = data.data;
        } else if (data.divisions && Array.isArray(data.divisions)) {
          divisionsArray = data.divisions;
        }

        const normalized = divisionsArray.map(d => ({
          _id: String(d._id ?? d.id ?? d.DIVISION_ID ?? d.code ?? d.DIVISION_CODE ?? ''),
          code: String(d.code ?? d.DIVISION_CODE ?? ''),
          name: d.name ?? d.DIVISION_NAME ?? d.hie_name ?? d.hie_relationship ?? 'Unknown Division',
          ...d
        })).sort((a, b) => a.name.localeCompare(b.name));

        setDivisions(normalized);
      } else {
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
      // Prefer HRIS sections (same source as SectionManagement) and fallback to generic /sections
      let response = await fetch('http://localhost:5000/api/sections/hris', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        // Fallback to legacy endpoint
        console.warn('HRIS sections endpoint returned non-OK, falling back to /api/sections', response.status);
        response = await fetch('http://localhost:5000/api/sections', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
      }

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

        // Normalize fields (handle HRIS/raw shapes) so dropdown shows name and id consistently
        const normalized = sectionsArray.map(s => {
          const divisionId = String(s?.division_id ?? s?.DIVISION_ID ?? s?.division_code ?? s?.DIVISION_CODE ?? s?.hie_code ?? s?.hie_relationship ?? '');
          const divisionName = s?.division_name ?? s?.DIVISION_NAME ?? s?.hie_name ?? s?.hie_relationship ?? '';
          const sectionId = String(s?._id ?? s?.id ?? s?.SECTION_ID ?? s?.code ?? s?.hie_code ?? s?.SECTION_CODE ?? s?.section_code ?? '');
          const sectionName = s?.name || s?.section_name || s?.SECTION_NAME || s?.hie_name || s?.hie_relationship || '';
          return {
            _id: sectionId || undefined,
            name: sectionName || `Section ${sectionId}`,
            division: divisionName ? { _id: divisionId || undefined, name: divisionName } : (divisionId || ''),
            divisionCode: String(s?.division_code ?? s?.DIVISION_CODE ?? ''),
            code: String(s?.code ?? s?.SECTION_CODE ?? s?.hie_code ?? s?.section_code ?? ''),
            _raw: s,
            ...s
          };
        });

        setAllSections(normalized);
        setSections(normalized);
      } else {
        setAllSections([]);
        setSections([]);
      }
    } catch (err) {
      console.error('Error fetching sections:', err);
      setAllSections([]);
      setSections([]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!canGenerate) {
      setError('You do not have permission to generate reports');
      return;
    }

    if (!dateRange.startDate || !dateRange.endDate) {
      setError('Please select both start and end dates');
      return;
    }

    if (reportScope === 'individual' && !employeeId) {
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
          to_date: dateRange.endDate
        };
        if (reportScope === 'individual') {
          payload.employee_id = employeeId;
        }
        // For attendance, do NOT send division or section info to MySQL. Only use employee ID and date range.
      } else if (reportType === 'meal') {
        // Use MongoDB API for meal reports
        apiUrl = 'http://localhost:5000/api/meal-reports';
        const params = new URLSearchParams({
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          scope: reportScope,
          ...(reportScope === 'individual' && { employeeId }),
          ...(reportScope === 'group' && {
            divisionId: divisionId !== 'all' ? divisionId : '',
            sectionId: sectionId !== 'all' ? sectionId : ''
          })
        });
        apiUrl += `?${params}`;
      }

      let response;
      if (reportType === 'attendance') {
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
      } catch (jsonErr) {
        setError('Invalid response from server.');
        setReportData(null);
        return;
      }

      if (!response.ok) {
        setError(data.message || `HTTP error! status: ${response.status}`);
        setReportData(null);
        return;
      }

      // Handle MongoDB response format
      const reportArray = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
      if ((data.success && reportArray.length > 0) || (!data.hasOwnProperty('success') && reportArray.length > 0)) {
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
      } else if (reportArray.length === 0) {
        setError('No records found for the selected criteria.');
        setReportData({ ...data, data: [] });
      } else {
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
    if (!reportData || !reportData.data || reportData.data.length === 0) {
      setError('No data to export. Please generate a report first.');
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
    if (reportScope === 'group') {
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
      return reportScope === 'individual'
        ? ['Date', 'Time', 'Meal Type', 'Location', 'Quantity', 'Items']
        : ['Employee ID', 'Employee Name', 'Date', 'Time', 'Meal Type', 'Location', 'Quantity', 'Items'];
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
      const mealTime = new Date(record.mealTime || record.meal_time).toLocaleTimeString();
      const items = record.items?.map(item => `${item.name} (${item.quantity})`).join(', ') || 'Standard Meal';
      const quantity = record.items?.reduce((total, item) => total + item.quantity, 0) || 1;
      
      return reportScope === 'individual'
        ? [record.date || record.meal_date, mealTime, record.mealType || record.meal_type, record.location || 'Cafeteria', quantity, items]
        : [record.employee_id || record.user?.employeeId, record.employee_name || `${record.user?.firstName} ${record.user?.lastName}`, record.date || record.meal_date, mealTime, record.mealType || record.meal_type, record.location || 'Cafeteria', quantity, items];
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

  const printReport = () => {
    if (!reportData || !reportData.data || reportData.data.length === 0) {
      alert('No data to print. Please generate a report first.');
      return;
    }
    
  // Create a new window for printing with formatted content, avoid about:blank in URL
  const printWindow = window.open(' ', '', 'width=900,height=700');
  const printContent = generatePrintContent();
  printWindow.document.open();
  printWindow.document.write(printContent);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  printWindow.close();
  };

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
    // Employee info for print
    let empNo = '';
    let empName = '';
    if (reportScope === 'individual' && employeeInfo) {
      empNo = employeeInfo.employee_id || employeeInfo.employee_ID || employeeId || '';
      empName = employeeInfo.name || employeeInfo.employee_name || employeeInfo.employeeName || '';
    } else if (reportData && reportData.data && reportData.data.length > 0) {
      // Try to extract from first record for group reports
      const first = reportData.data[0];
      empNo =
        first.employee_id ||
        first.employee_ID ||
        first.emp_no ||
        first.empNo ||
        first.empid ||
        first.employeeId ||
        '';
      empName =
        first.employee_name ||
        first.employeeName ||
        first.emp_name ||
        first.name ||
        '';
    }

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

  return (
    <div className="report-generation">
      {/* Header Section */}
      <div className="report-header">
        <div className="header-content">
          <h1>
            <i className="bi bi-graph-up-arrow"></i>
            Report Generation Center
          </h1>
          <p className="header-subtitle">Generate comprehensive attendance and meal reports with advanced filtering options</p>
        </div>
      </div>

      {/* Report Configuration Form */}
      <div className="report-config">
        <form onSubmit={handleSubmit} className="config-form">
          <div className="form-grid" style={{display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '16px', alignItems: 'end'}}>
            {/* Report Type Selection */}
            <div className="form-group">
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
                <option value="attendance">Attendance Report</option>
                <option value="meal">Meal Report</option>
              </select>
            </div>

            {/* Report Scope Selection */}
            <div className="form-group">
              <label htmlFor="reportScope">
                <i className="bi bi-people"></i>
                Report Scope
              </label>
              <select
                id="reportScope"
                value={reportScope}
                onChange={(e) => setReportScope(e.target.value)}
                className="form-control"
              >
                <option value="individual">Individual Report</option>
                <option value="group">Group Report</option>
                <option value="audit">Audit</option>
              </select>
            </div>

            {/* Employee ID - only visible for individual scope */}
            {reportScope === 'individual' && (
              <div className="form-group" style={{gridColumn: 'span 1'}}>
                <label htmlFor="employeeId">
                  <i className="bi bi-person-badge"></i>
                  Employee ID
                </label>
                <input
                  type="text"
                  id="employeeId"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="form-control"
                  placeholder="Enter employee ID"
                  required={reportScope === 'individual'}
                  title="Enter employee ID"
                />
              </div>
            )}

            {/* Division and Section - only visible for group scope */}
            {reportScope === 'group' && (
              <>
                {/* Division - always visible, disabled for individual scope */}
                <div className="form-group" style={{gridColumn: 'span 1'}}>
                  <label htmlFor="divisionId">
                    <i className="bi bi-building"></i>
                    Division
                  </label>
                  <select
                    id="divisionId"
                    value={divisionId}
                    onChange={(e) => setDivisionId(e.target.value)}
                    className="form-control"
                    disabled={reportScope === 'individual'}
                    style={{ cursor: reportScope === 'individual' ? 'not-allowed' : 'pointer' }}
                  >
                    <option value="all">All Divisions</option>
                    {(Array.isArray(divisions) ? divisions : []).map(division => (
                      <option key={division._id || division.id} value={division._id || division.id}>
                        {division.name || division.division_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Section - always visible, disabled for individual scope */}
                <div className="form-group" style={{gridColumn: 'span 1'}}>
                  <label htmlFor="sectionId">
                    <i className="bi bi-diagram-3"></i>
                    Section
                  </label>
                  <select
                    id="sectionId"
                    value={sectionId}
                    onChange={(e) => setSectionId(e.target.value)}
                    className="form-control"
                    disabled={reportScope === 'individual' || divisionId === 'all'}
                    style={{ cursor: (reportScope === 'individual' || divisionId === 'all') ? 'not-allowed' : 'pointer' }}
                    title={divisionId === 'all' ? 'All Divisions selected - Section must be All' : 'Select a section'}
                  >
                    <option value="all">
                      {divisionId === 'all' ? 'All Sections' : 'All Sections'}
                    </option>
                    {divisionId !== 'all' && (Array.isArray(sections) ? sections : []).map(section => (
                      <option key={section._id || section.id} value={section._id || section.id}>
                        {section.name || section.section_name}
                      </option>
                    ))}
                  </select>
                </div>
                {/* Sub Section - only visible for group scope */}
                <div className="form-group" style={{gridColumn: 'span 1'}}>
                  <label htmlFor="subSectionId">
                    <i className="bi bi-diagram-2"></i>
                    Sub Section
                  </label>
                  <select
                    id="subSectionId"
                    value={subSectionId}
                    onChange={e => setSubSectionId(e.target.value)}
                    className="form-control"
                    disabled={reportScope !== 'group' || sectionId === 'all' || divisionId === 'all'}
                    style={{ cursor: (reportScope !== 'group' || sectionId === 'all' || divisionId === 'all') ? 'not-allowed' : 'pointer' }}
                    title={divisionId === 'all' ? 'All Divisions selected - Sub Section must be All' : sectionId === 'all' ? 'Please select a section first' : 'Select a sub section'}
                  >
                    <option value="all">
                      {divisionId === 'all' ? 'All Sub Sections' : sectionId === 'all' ? 'Select Section First' : 'All Sub Sections'}
                    </option>
                    {sectionId !== 'all' && divisionId !== 'all' && (Array.isArray(subSections) ? subSections : []).map(sub => (
                      <option key={sub._id || sub.id} value={sub._id || sub.id}>
                        {sub.subSection?.sub_hie_name || sub.subSection?.name || sub.subSection?.hie_name || sub.subSection?.sub_hie_code || sub.subSection?.code || 'Unnamed'}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {/* Date Range */}
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
          </div>

          {/* Employee info preview (appears when division, section and employee ID are provided) */}
          {employeeId && employeeInfo && (
            <div style={{ gridColumn: '1 / -1', margin: '14px 0', display: 'flex', justifyContent: 'center' }}>
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

          {/* If employeeId provided but no match found, show warning */}
          {employeeId && !employeeInfo && (
            <div style={{ gridColumn: '1 / -1', margin: '8px 0 18px', display: 'flex', justifyContent: 'center' }}>
              <div style={{ background: '#fff6f6', border: '1px solid #fde2e2', padding: '10px 14px', borderRadius: 8, color: '#c53030', minWidth: 360, textAlign: 'center' }}>
                No employee found for the entered ID in the selected division/section.
              </div>
            </div>
          )}

          {/* Generate Button */}
          <div className="form-actions" style={{ marginBottom: '40px', display: 'flex', justifyContent: 'center' }}>
            <button
              type="submit"
              disabled={loading || !canGenerate}
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
        </form>
      </div>

      {/* Error Display */}
      {error && (
        <div className="error-message">
          <i className="bi bi-exclamation-triangle"></i>
          {error}
        </div>
      )}

      {/* Report Results */}
      {reportData && (
        (reportData.data && reportData.data.length > 0)
      ) ? (
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
                <span>Type: <b>{reportType === 'attendance' ? 'Attendance Report' : 'Meal Report'}</b></span>
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
                <span>{reportData.reportType === 'group' ? 'Employees Found:' : 'Records Found:'} <b>{reportData.data?.length || 0}</b></span>
                <span style={{color: '#666', fontWeight: 400, fontSize: '0.98rem', marginLeft: 'auto'}}>Generated at {new Date().toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Data Preview + Export Row */}
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '18px', marginBottom: '8px'}}>
            <div style={{display: 'flex', alignItems: 'center', fontWeight: 600, fontSize: '1.15rem'}}>
              <i className="bi bi-table" style={{marginRight: 10, marginLeft: 12, fontSize: '1.2rem'}}></i>
              Data Preview
            </div>
            <div className="action-group" style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
              <span style={{fontWeight: 600, fontSize: '1.15rem', display: 'flex', alignItems: 'center', marginLeft: 12}}>
                <i className="bi bi-download" style={{marginRight: 6, fontSize: '1.2rem'}}></i>
                Export Options
              </span>
              <button
                onClick={() => exportReport('pdf')}
                className="btn btn-outline-primary"
                style={{marginLeft: 8, marginRight: 18, display: 'flex', alignItems: 'center', fontWeight: 500, fontSize: '1rem'}}
              >
                <i className="bi bi-file-earmark-pdf" style={{marginRight: 5, fontSize: '1.1rem'}}></i>
                Print PDF
              </button>
            </div>
          </div>
          <div className="data-preview">
            <div className="table-responsive">
              {reportScope === 'group' ? (
                <GroupReport
                  ref={groupReportRef}
                  reportData={reportData}
                  getHeaders={getHeaders}
                  formatRow={formatRow}
                  reportType={reportType}
                  dateRange={dateRange}
                />
              ) : (
                <IndividualReport
                  ref={individualReportRef}
                  reportData={reportData}
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
      ) : reportData && (
        (!reportData.data || reportData.data.length === 0)
      ) ? (
        <div className="report-results">
          <div className="empty-state">
            <div className="empty-icon">
              <i className="bi bi-inbox"></i>
            </div>
            <h4 className="empty-title">No Data Found</h4>
            <p className="empty-text">No records found for the selected criteria. Try adjusting your filters.</p>
          </div>
        </div>
      ) : !loading && (
        <div className="report-results">
          <div className="empty-state">
            <div className="empty-icon">
              <i className="bi bi-file-earmark-bar-graph"></i>
            </div>
            <h4 className="empty-title">Ready to Generate Reports</h4>
            <p className="empty-text">Configure your report parameters above and click "Generate Report" to start.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportGeneration;
