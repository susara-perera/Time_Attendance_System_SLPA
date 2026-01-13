import React, { useState, useEffect } from 'react';
import './MealManagement.css';
import { useLanguage } from '../../context/LanguageContext';
import PageHeader from './PageHeader';

const MealManagement = () => {
  const [divisions, setDivisions] = useState([]);
  const [sections, setSections] = useState([]);
  const [allSections, setAllSections] = useState([]);
  const [mealBooking, setMealBooking] = useState({
    divisionId: '',
    sectionId: '',
    mealDate: new Date().toISOString().split('T')[0],
    mealType: '',
    quantity: 1,
    specialRequirements: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [todaysBookings, setTodaysBookings] = useState(0);
  const { t } = useLanguage();
  const [userInfo, setUserInfo] = useState(null);

  // Helper to sanitize section display name (removes IDs/codes and counts in parentheses)
  const formatSectionName = (name) => {
    if (!name) return '';
    let cleaned = String(name).replace(/\s*\([^)]*\)/g, '').trim();
    cleaned = cleaned.replace(/\s*-\s*$/, '').trim();
    return cleaned;
  };
  const [generatingReport, setGeneratingReport] = useState(false);
  const [showBookingsReport, setShowBookingsReport] = useState(false);
  const [showCountReport, setShowCountReport] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [showPreferenceModal, setShowPreferenceModal] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [hrisEmployees, setHrisEmployees] = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [mealPreference, setMealPreference] = useState('meal');
  const [modalDivision, setModalDivision] = useState('all');
  const [modalSection, setModalSection] = useState('all');
  const [modalSubSection, setModalSubSection] = useState('all');
  const [modalSections, setModalSections] = useState([]);
  const [modalSubSections, setModalSubSections] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [submittingPreferences, setSubmittingPreferences] = useState(false);
  const [filterDivision, setFilterDivision] = useState('all');
  const [filterSection, setFilterSection] = useState('all');
  const [filterSubSection, setFilterSubSection] = useState('all');
  const [mealPackageEmployees, setMealPackageEmployees] = useState([]);
  const [moneyAllowanceEmployees, setMoneyAllowanceEmployees] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [showEmployeeList, setShowEmployeeList] = useState(false);
  const [activeTab, setActiveTab] = useState('meal');

  // Fetch divisions and sections on component mount
  useEffect(() => {
    fetchUserInfo();
    fetchDivisions();
    fetchAllSections();
    fetchTodaysBookingsCount();
    // Ensure employee list is hidden on initial load
    setShowEmployeeList(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-fill user's division and section when data is loaded
  useEffect(() => {
    if (userInfo && divisions.length > 0 && allSections.length > 0) {
      const userDivisionId = userInfo.division?._id || userInfo.division || userInfo.divisionId;
      const userSectionId = userInfo.section?._id || userInfo.section || userInfo.sectionId;
      
      if (userDivisionId && !mealBooking.divisionId) {
        setMealBooking(prev => ({
          ...prev,
          divisionId: userDivisionId,
          sectionId: userSectionId || ''
        }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userInfo, divisions, allSections]);

  // Filter sections when division changes (client-side filtering like ReportGeneration)
  useEffect(() => {
    if (!mealBooking.divisionId || mealBooking.divisionId === '') {
      setSections(allSections);
      setMealBooking(prev => ({ ...prev, sectionId: '' }));
    } else {
      // Filter sections by matching divisionId
      const sectionsForDivision = allSections.filter(section => {
        const sectionDivId = String(section.division_id || section.divisionId || section.DIVISION_ID || '');
        const selectedDivId = String(mealBooking.divisionId);
        return sectionDivId === selectedDivId;
      });
      
      console.log(`🔍 Filtered ${sectionsForDivision.length} sections for division ${mealBooking.divisionId}`);
      setSections(sectionsForDivision);
      setMealBooking(prev => ({ ...prev, sectionId: '' }));
    }
  }, [mealBooking.divisionId, allSections]);

  // Sub-section removed - no longer needed

  // Filter modal sections when division changes
  useEffect(() => {
    if (modalDivision === 'all') {
      setModalSections(allSections);
      setModalSection('all');
      setModalSubSections([]);
      setModalSubSection('all');
    } else {
      const sectionsForDivision = allSections.filter(section => {
        const sectionDivId = String(section.division_id || section.divisionId || section.DIVISION_ID || '');
        const selectedDivId = String(modalDivision);
        return sectionDivId === selectedDivId;
      });
      setModalSections(sectionsForDivision);
      setModalSection('all');
      setModalSubSections([]);
      setModalSubSection('all');
    }
  }, [modalDivision, allSections]);

  // Modal subsections removed - no longer needed

  // Filter employees when search or filters change
  useEffect(() => {
    filterHRISEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeSearch, modalDivision, modalSection, modalSubSection, hrisEmployees]);

  // Manual loading - removed automatic refresh

  const fetchUserInfo = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/auth/verify', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.user) {
          console.log('👤 User info loaded:', data.user);
          setUserInfo(data.user);
        }
      }
    } catch (error) {
      console.error('Error fetching user info:', error);
    }
  };

  // Normalize divisions data (same as ReportGeneration)
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
        division_id: id,
        code: String(d.code ?? d.DIVISION_CODE ?? d.hie_code ?? d._id ?? d.id ?? id),
        name: d.name ?? d.DIVISION_NAME ?? d.hie_name ?? d.hie_relationship ?? 'Unknown Division',
        division_name: d.name ?? d.DIVISION_NAME ?? d.hie_name ?? 'Unknown Division',
      });
    });
    return out.sort((a, b) => a.name.localeCompare(b.name));
  };

  // Normalize sections data (same as ReportGeneration)
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
        _id: id,
        id,
        section_id: id,
        code: String(s.code ?? s.SECTION_CODE ?? s.hie_code ?? s.section_code ?? id),
        name: s.name ?? s.section_name ?? s.SECTION_NAME ?? s.hie_relationship ?? `Section ${id}`,
        section_name: s.name ?? s.section_name ?? s.SECTION_NAME ?? `Section ${id}`,
        division_id: divisionId || '',
        divisionId: divisionId || '',
        DIVISION_ID: divisionId || '',
      });
    });
    return out.sort((a, b) => a.name.localeCompare(b.name));
  };

  const fetchDivisions = async () => {
    try {
      const token = localStorage.getItem('token');
      console.log('📥 Fetching HRIS divisions...');
      
      const response = await fetch('http://localhost:5000/api/divisions/hris', {
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

        const normalized = normalizeDivisions(divisionsArray);
        console.log(`✅ Loaded ${normalized.length} HRIS divisions`);
        setDivisions(normalized);
      } else {
        console.error('Failed to fetch divisions:', response.status);
        setDivisions([]);
      }
    } catch (err) {
      console.error('Error fetching divisions:', err);
      setMessage(t('errorFetchingDivisions'));
      setMessageType('error');
      setDivisions([]);
    }
  };

  const fetchAllSections = async () => {
    try {
      const token = localStorage.getItem('token');
      console.log('📥 Fetching HRIS sections...');
      
      // Use HRIS sections endpoint (same as ReportGeneration)
      let response = await fetch('http://localhost:5000/api/sections/hris', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
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
        let sectionsArray = [];
        if (Array.isArray(data)) {
          sectionsArray = data;
        } else if (data.data && Array.isArray(data.data)) {
          sectionsArray = data.data;
        } else if (data.sections && Array.isArray(data.sections)) {
          sectionsArray = data.sections;
        }

        const normalized = normalizeSections(sectionsArray);
        console.log(`✅ Loaded ${normalized.length} HRIS sections`);
        console.log('Sample sections with division_id:', normalized.slice(0, 3).map(s => ({
          section: s.name,
          section_id: s._id,
          division_id: s.division_id
        })));

        setAllSections(normalized);
        setSections(normalized);
      } else {
        console.error('Failed to fetch sections:', response.status, response.statusText);
        setAllSections([]);
        setSections([]);
      }
    } catch (err) {
      console.error('Error fetching sections:', err);
      setMessage(t('errorFetchingSections'));
      setMessageType('error');
      setAllSections([]);
      setSections([]);
    }
  };

  const fetchTodaysBookingsCount = async () => {
    try {
      const token = localStorage.getItem('token');

      const response = await fetch('http://localhost:5000/api/meals/bookings/today/count', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setTodaysBookings(data.count || 0);
      }
    } catch (error) {
      console.error('Error fetching today\'s bookings:', error);
    }
  };



  const handleSearchHRISEmployees = async () => {
    if (!employeeSearch || employeeSearch.trim().length < 2) {
      setMessage('Please enter at least 2 characters to search');
      setMessageType('warning');
      return;
    }

    setLoadingEmployees(true);
    try {
      const response = await fetch(`http://localhost:5000/api/employee/hris/search?q=${encodeURIComponent(employeeSearch)}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setHrisEmployees(data);
        setMessage('');
        if (data.length === 0) {
          setMessage('No employees found');
          setMessageType('info');
        }
      } else {
        setMessage('Failed to search employees');
        setMessageType('danger');
      }
    } catch (error) {
      console.error('Error searching HRIS employees:', error);
      setMessage('Error searching employees');
      setMessageType('danger');
    } finally {
      setLoadingEmployees(false);
    }
  };

  const filterHRISEmployees = () => {
    let filtered = [...hrisEmployees];

    if (modalDivision !== 'all') {
      filtered = filtered.filter(emp => {
        const empDivId = String(emp.division_id || emp.divisionId || emp.DIVISION_ID || '');
        return empDivId === String(modalDivision);
      });
    }

    if (modalSection !== 'all') {
      filtered = filtered.filter(emp => {
        const empSecId = String(emp.section_id || emp.sectionId || emp.SECTION_ID || '');
        return empSecId === String(modalSection);
      });
    }

    if (modalSubSection !== 'all') {
      filtered = filtered.filter(emp => {
        const empSubSecId = String(emp.subsection_id || emp.subsectionId || emp.SUBSECTION_ID || '');
        return empSubSecId === String(modalSubSection);
      });
    }

    setFilteredEmployees(filtered);
  };

  const handleSelectEmployee = (employee) => {
    const empId = employee.employee_id || employee.id || employee.EMPLOYEE_ID;
    const isSelected = selectedEmployees.some(emp => 
      (emp.employee_id || emp.id || emp.EMPLOYEE_ID) === empId
    );

    if (isSelected) {
      setSelectedEmployees(selectedEmployees.filter(emp => 
        (emp.employee_id || emp.id || emp.EMPLOYEE_ID) !== empId
      ));
    } else {
      setSelectedEmployees([...selectedEmployees, employee]);
    }
  };

  const handleSelectAll = (employees = null) => {
    const targetList = employees || filteredEmployees;
    if (selectedEmployees.length === targetList.length && targetList.length > 0) {
      setSelectedEmployees([]);
    } else {
      setSelectedEmployees([...targetList]);
    }
  };

  const handleSubmitBatchPreferences = async () => {
    if (selectedEmployees.length === 0) {
      setMessage('Please select at least one employee');
      setMessageType('warning');
      return;
    }

    if (!mealPreference) {
      setMessage('Please select meal preference type');
      setMessageType('warning');
      return;
    }

    setSubmittingPreferences(true);
    try {
      let successCount = 0;
      let failCount = 0;

      for (const employee of selectedEmployees) {
        try {
          const response = await fetch('http://localhost:5000/api/meals/preference', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
              employeeId: employee.employee_id || employee.id || employee.EMPLOYEE_ID,
              employeeName: employee.employee_name || employee.name || employee.EMPLOYEE_NAME,
              email: employee.email || employee.EMAIL || '',
              divisionId: employee.division_id || employee.divisionId || employee.DIVISION_ID,
              divisionName: employee.division_name || employee.divisionName || employee.DIVISION_NAME,
              sectionId: employee.section_id || employee.sectionId || employee.SECTION_ID,
              sectionName: employee.section_name || employee.sectionName || employee.SECTION_NAME,
              subsectionId: employee.subsection_id || employee.subsectionId || employee.SUBSECTION_ID || null,
              subsectionName: employee.subsection_name || employee.subsectionName || employee.SUBSECTION_NAME || null,
              preference: mealPreference,
              allowanceAmount: mealPreference === 'money' ? 500.00 : 0
            })
          });

          if (response.ok) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (error) {
          console.error('Error assigning preference for employee:', employee, error);
          failCount++;
        }
      }

      if (successCount > 0) {
        setMessage(`Successfully assigned preferences for ${successCount} employee(s)${failCount > 0 ? `, ${failCount} failed` : ''}`);
        setMessageType(failCount > 0 ? 'warning' : 'success');
        
        setSelectedEmployees([]);
        setHrisEmployees([]);
        setFilteredEmployees([]);
        setEmployeeSearch('');
        setModalDivision('all');
        setModalSection('all');
        setModalSubSection('all');
        setShowPreferenceModal(false);
        
        searchEmployees();
      } else {
        setMessage('Failed to assign preferences');
        setMessageType('danger');
      }
    } catch (error) {
      console.error('Error submitting batch preferences:', error);
      setMessage('Error submitting preferences');
      setMessageType('danger');
    } finally {
      setSubmittingPreferences(false);
    }
  };

  const searchEmployees = async () => {
    if (filterDivision === 'all' || filterSection === 'all') {
      setMessage('Please select both Division and Section to search');
      setMessageType('warning');
      return;
    }

    setLoadingSearch(true);
    setSearchResults([]);
    setSelectedEmployees([]);
    
    try {
      const token = localStorage.getItem('token');
      
      // First, get all employees from HRIS for the division
      const divisionObj = divisions.find(d => d.division_id === filterDivision);
      const sectionObj = allSections.find(s => s.section_id === filterSection);
      
      if (!divisionObj || !sectionObj) {
        setMessage('Invalid division or section selected');
        setMessageType('danger');
        setLoadingSearch(false);
        return;
      }

      console.log('🔍 Searching HRIS for division:', divisionObj.code, divisionObj.name, 'section:', sectionObj.code, sectionObj.name);
      
      // Fetch from HRIS - get all employees
      const divisionCode = divisionObj.code || divisionObj.division_id || divisionObj._id;
      const sectionCode = sectionObj.code || sectionObj.section_id || sectionObj._id;
      
      console.log('Using codes - Division:', divisionCode, 'Section:', sectionCode);
      
      const hrisResponse = await fetch(`http://localhost:5000/api/users/hris`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!hrisResponse.ok) {
        setMessage('Failed to fetch HRIS employees');
        setMessageType('danger');
        setLoadingSearch(false);
        return;
      }
      
      const hrisData = await hrisResponse.json();
      let allEmployees = [];
      
      if (Array.isArray(hrisData)) {
        allEmployees = hrisData;
      } else if (hrisData.data && Array.isArray(hrisData.data)) {
        allEmployees = hrisData.data;
      } else if (hrisData.employees && Array.isArray(hrisData.employees)) {
        allEmployees = hrisData.employees;
      }
      
      console.log(`📊 Got ${allEmployees.length} total employees from HRIS`);
      
      if (allEmployees.length > 0) {
        console.log('📋 Sample employee structure:', allEmployees[0]);
        console.log('🔑 Sample employee keys:', Object.keys(allEmployees[0]));
      }
      
      // Show what we're looking for
      console.log('🎯 Target Division:', filterDivision, divisionCode, divisionObj);
      console.log('🎯 Target Section:', filterSection, sectionCode, sectionObj);
      console.log('🔑 Section object full:', sectionObj);
      
      // Get the actual HRIS code from the section object - it might be in 'code' field
      // The section dropdown uses section_id but HRIS uses the actual code
      const targetDivCode = String(divisionObj.code || divisionObj.DIVISION_CODE || divisionCode).trim();
      const targetSecCode = String(sectionObj.code || sectionObj.SECTION_CODE || sectionCode).trim();
      
      console.log('📍 Using codes for matching - Division:', targetDivCode, 'Section:', targetSecCode);
      
      // Filter by division and section - use exact field names from HRIS
      let matchCount = 0;
      const filteredEmployees = allEmployees.filter(emp => {
        // HRIS uses DIVISION_CODE and SECTION_CODE (uppercase)
        const empDivCode = String(emp.DIVISION_CODE || emp.division_code || '').trim();
        const empSecCode = String(emp.SECTION_CODE || emp.section_code || '').trim();
        
        const divMatch = empDivCode === targetDivCode;
        const secMatch = empSecCode === targetSecCode;
        
        // Log first few to debug
        if (matchCount < 5) {
          console.log(`Employee ${emp.EMP_NUMBER || emp._id}:`, {
            empDiv: empDivCode,
            targetDiv: targetDivCode,
            divMatch,
            empSec: empSecCode,
            targetSec: targetSecCode,
            secMatch,
            result: divMatch && secMatch ? '✅ MATCH' : '❌ NO MATCH'
          });
        }
        
        if (divMatch && secMatch) {
          matchCount++;
        }
        
        return divMatch && secMatch;
      });
      
      console.log(`✅ Filtered to ${filteredEmployees.length} employees for division ${divisionCode} and section ${sectionCode}`);
      
      if (filteredEmployees.length > 0) {
        console.log('✅ Sample filtered employee:', filteredEmployees[0]);
      }
      
      // Map to standard format (no assignment checking - show all employees)
      const employeeList = filteredEmployees.map(emp => ({
        employee_id: emp.EMP_NUMBER || emp.EMPLOYEE_ID || emp.employee_id || emp._id,
        employee_name: emp.FULLNAME || emp.EMPLOYEE_NAME || emp.employee_name || emp.name ||
                      `${emp.CALLING_NAME || emp.FIRST_NAME || ''} ${emp.LAST_NAME || ''}`.trim(),
        division_id: emp.DIVISION_CODE || emp.division_code || emp.DIVISION_ID,
        division_code: emp.DIVISION_CODE || emp.division_code,
        division_name: emp.DIVISION_NAME || emp.division_name || divisionObj.division_name || divisionObj.name,
        section_id: emp.SECTION_CODE || emp.section_code || emp.SECTION_ID,
        section_code: emp.SECTION_CODE || emp.section_code,
        section_name: emp.SECTION_NAME || emp.section_name || sectionObj.section_name || sectionObj.name,
        email: emp.EMAIL || emp.email || ''
      }));
      
      console.log(`🎯 Found ${employeeList.length} employees for division ${divisionCode} and section ${sectionCode}`);
      
      setSearchResults(employeeList);
      setActiveTab('search');
      
      if (employeeList.length === 0) {
        setMessage('No employees found for selected filters');
        setMessageType('info');
      } else {
        setMessage(`Found ${employeeList.length} employee(s)`);
        setMessageType('success');
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
      setMessage('Error loading employees: ' + error.message);
      setMessageType('danger');
    } finally {
      setLoadingSearch(false);
    }
  };

  const handleTransferToPreference = async (preference) => {
    if (selectedEmployees.length === 0) {
      setMessage('Please select at least one employee');
      setMessageType('warning');
      return;
    }

    setTransferring(true);
    let successCount = 0;
    let failCount = 0;

    try {
      const token = localStorage.getItem('token');
      
      for (const employee of selectedEmployees) {
        try {
          let parsedData = {};
          if (employee.employee_data) {
            try {
              parsedData = typeof employee.employee_data === 'string' 
                ? JSON.parse(employee.employee_data) 
                : employee.employee_data;
            } catch (e) {
              console.error('Error parsing employee_data:', e);
            }
          }

          const response = await fetch('http://localhost:5000/api/meals/preference', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              employeeId: employee.employee_id,
              employeeName: employee.employee_name,
              email: parsedData.email || employee.email || '',
              preference: preference,
              divisionId: employee.division_code || employee.division_id,
              divisionName: employee.division_name,
              sectionId: employee.section_code || employee.section_id,
              sectionName: employee.section_name,
              subsectionId: employee.sub_section_id || employee.subsection_id,
              subsectionName: employee.sub_hie_name || employee.subsection_name,
              allowanceAmount: preference === 'money' ? 500.00 : 0
            })
          });

          if (response.ok) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (error) {
          console.error('Error transferring employee:', employee, error);
          failCount++;
        }
      }

      if (successCount > 0) {
        setMessage(`✅ Successfully transferred ${successCount} employee(s) to ${preference === 'meal' ? 'Meal Package' : 'Money Allowance'}${failCount > 0 ? `, ${failCount} failed` : ''}`);
        setMessageType(failCount > 0 ? 'warning' : 'success');
        
        // Refresh search results
        setSelectedEmployees([]);
        await searchEmployees();
      } else {
        setMessage('Failed to transfer employees');
        setMessageType('danger');
      }
    } catch (error) {
      console.error('Error in transfer process:', error);
      setMessage('Error transferring employees');
      setMessageType('danger');
    } finally {
      setTransferring(false);
    }
  };

  const fetchMealPackageEmployees = async () => {
    try {
      const token = localStorage.getItem('token');
      let url = 'http://localhost:5000/api/meals/employees/meal-package?';
      if (filterDivision !== 'all') url += `divisionId=${filterDivision}&`;
      if (filterSection !== 'all') url += `sectionId=${filterSection}&`;
      if (filterSubSection !== 'all') url += `subsectionId=${filterSubSection}&`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      if (response.ok && data.success) {
        setMealPackageEmployees(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching meal package employees:', error);
    }
  };

  const fetchMoneyAllowanceEmployees = async () => {
    try {
      const token = localStorage.getItem('token');
      let url = 'http://localhost:5000/api/meals/employees/money-allowance?';
      if (filterDivision !== 'all') url += `divisionId=${filterDivision}&`;
      if (filterSection !== 'all') url += `sectionId=${filterSection}&`;
      if (filterSubSection !== 'all') url += `subsectionId=${filterSubSection}&`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      if (response.ok && data.success) {
        setMoneyAllowanceEmployees(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching money allowance employees:', error);
    }
  };





  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const token = localStorage.getItem('token');
      
      // Get division and section names for better reporting
      const selectedDivision = divisions.find(div => div.division_id === mealBooking.divisionId);
      const selectedSection = sections.find(sec => sec.section_id === mealBooking.sectionId);
      
      const mealData = {
        divisionId: mealBooking.divisionId,
        divisionName: selectedDivision?.name || selectedDivision?.division_name || '',
        sectionId: mealBooking.sectionId,
        sectionName: selectedSection?.name || selectedSection?.section_name || '',
        mealDate: mealBooking.mealDate,
        mealType: mealBooking.mealType,
        quantity: parseInt(mealBooking.quantity),
        specialRequirements: mealBooking.specialRequirements
      };

      const response = await fetch('http://localhost:5000/api/meals/book', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(mealData)
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setMessage(t('mealBookingCreated'));
        setMessageType('success');
        setMealBooking({
          divisionId: '',
          sectionId: '',
          mealDate: new Date().toISOString().split('T')[0],
          mealType: '',
          quantity: 1,
          specialRequirements: ''
        });
        // Refresh today's bookings count
        fetchTodaysBookingsCount();
        
        // Auto-dismiss success message after 3 seconds
        setTimeout(() => {
          setMessage('');
        }, 3000);
      } else {
        setMessage(result.message || 'Error creating meal booking');
        setMessageType('error');
      }
    } catch (error) {
      console.error('Meal booking error:', error);
      setMessage(t('mealBookingNetworkError'));
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };



  const handleGenerateTodaysBookings = async () => {
    setGeneratingReport(true);
    setShowCountReport(false);
    try {
      const token = localStorage.getItem('token');
      const today = new Date().toISOString().split('T')[0];
      
      // Fetch today's bookings from MySQL database
      const response = await fetch('http://localhost:5000/api/meals/bookings/today', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        const bookings = result.data || [];
        
        if (bookings.length === 0) {
          setMessage('No bookings found for today');
          setMessageType('error');
          setGeneratingReport(false);
          setTimeout(() => setMessage(''), 3000);
          return;
        }
        
        // Fetch division names
        const divResponse = await fetch('http://localhost:5000/api/divisions/hris', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const divData = await divResponse.json();
        const divisionsMap = {};
        const divArray = Array.isArray(divData) ? divData : divData.data || [];
        divArray.forEach(div => {
          const id = div._id || div.id || div.DIVISION_ID || div.code;
          divisionsMap[id] = div.name || div.DIVISION_NAME || div.hie_name || 'Unknown';
        });
        
        // Store the data and show the report inline
        setReportData({ bookings, date: today, type: 'bookings', divisionsMap });
        setShowBookingsReport(true);
      } else {
        setMessage(result.message || 'Error generating report');
        setMessageType('error');
      }
    } catch (error) {
      console.error('Generate report error:', error);
      setMessage('Network error occurred while generating report');
      setMessageType('error');
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleGenerateMealCountReport = async () => {
    setGeneratingReport(true);
    setShowBookingsReport(false);
    try {
      const token = localStorage.getItem('token');
      const today = new Date().toISOString().split('T')[0];
      
      // Fetch today's bookings from MySQL database
      const response = await fetch('http://localhost:5000/api/meals/bookings/today', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        const bookings = result.data || [];
        
        if (bookings.length === 0) {
          setMessage('No bookings found for today');
          setMessageType('error');
          setGeneratingReport(false);
          setTimeout(() => setMessage(''), 3000);
          return;
        }
        
        // Group by meal type and count
        const mealTypeCounts = bookings.reduce((acc, booking) => {
          const mealType = booking.mealType || 'Unknown';
          if (!acc[mealType]) {
            acc[mealType] = { count: 0, quantity: 0 };
          }
          acc[mealType].count += 1;
          acc[mealType].quantity += booking.quantity || 1;
          return acc;
        }, {});

        // Store the data and show the report inline
        setReportData({ mealTypeCounts, date: today, type: 'count', bookings });
        setShowCountReport(true);
      } else {
        setMessage(result.message || 'Error generating report');
        setMessageType('error');
      }
    } catch (error) {
      console.error('Generate count report error:', error);
      setMessage('Network error occurred while generating report');
      setMessageType('error');
    } finally {
      setGeneratingReport(false);
    }
  };

  return (
    <div className="meal-management">
      {/* Professional Section Header with Logo */}
      <PageHeader
        title={t('mealManagementTitle')}
        subtitle="Manage meal bookings and employee preferences"
        icon="bi-cup-hot-fill"
      />

      {message && (
        <div className={`alert alert-${messageType === 'success' ? 'success' : messageType === 'warning' ? 'warning' : 'danger'} alert-dismissible fade show`} 
             style={{ 
               position: 'sticky', 
               top: '10px', 
               zIndex: 1050,
               boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
               fontSize: '1.1rem',
               fontWeight: '500'
             }}>
          <i className={`bi bi-${messageType === 'success' ? 'check-circle-fill' : messageType === 'warning' ? 'exclamation-triangle-fill' : 'x-circle-fill'} me-2`}></i>
          <strong>{messageType === 'success' ? 'Success!' : messageType === 'warning' ? 'Warning!' : 'Error!'}</strong> {message}
          <button type="button" className="btn-close" onClick={() => setMessage('')}></button>
        </div>
      )}

      <div className="meal-container">
        <div className="row justify-content-center">
          {/* Meal Booking Form */}
          <div className="col-lg-6 col-md-8">
            <div className="meal-card">
              <div className="meal-card-header">
                <h4 className="mb-0">📋 Book New Meal</h4>
              </div>
              <div className="card-body p-4">
                <form onSubmit={handleBookingSubmit}>
                  <div className="meal-form-group">
                    <label className="meal-form-label">Division</label>
                    <select 
                      className="form-select meal-form-control"
                      value={mealBooking.divisionId}
                      onChange={(e) => setMealBooking(prev => ({ ...prev, divisionId: e.target.value }))}
                      required
                    >
                      <option value="">{t('selectDivision')}</option>
                      {divisions.map((division) => (
                        <option key={division.division_id} value={division.division_id}>
                          {division.division_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="meal-form-group">
                    <label className="meal-form-label">Section</label>
                    <select 
                      className="form-select meal-form-control"
                      value={mealBooking.sectionId}
                      onChange={(e) => setMealBooking(prev => ({ ...prev, sectionId: e.target.value }))}
                      required
                    >
                      <option value="">{t('selectSection')}</option>
                      {sections.map((section) => (
                        <option key={section.section_id} value={section.section_id}>
                          {formatSectionName(section.section_name)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="meal-form-group">
                    <label className="meal-form-label">Meal Date</label>
                    <input 
                      type="date"
                      className="form-control meal-form-control"
                      value={mealBooking.mealDate}
                      onChange={(e) => setMealBooking(prev => ({ ...prev, mealDate: e.target.value }))}
                      min={new Date().toISOString().split('T')[0]}
                      required
                    />
                  </div>

                  <div className="meal-form-group">
                    <label className="meal-form-label">Meal Type</label>
                    <select 
                      className="form-select meal-form-control"
                      value={mealBooking.mealType}
                      onChange={(e) => setMealBooking(prev => ({ ...prev, mealType: e.target.value }))}
                      required
                    >
                      <option value="">{t('selectMealType')}</option>
                      <option value="breakfast">{t('mealTypeBreakfast')}</option>
                      <option value="lunch">{t('mealTypeLunch')}</option>
                      <option value="dinner">{t('mealTypeDinner')}</option>
                      <option value="snack">{t('mealTypeSnack')}</option>
                    </select>
                  </div>

                  <div className="meal-form-group">
                    <label className="meal-form-label">Expected Quantity</label>
                    <input 
                      type="number"
                      className="form-control meal-form-control"
                      value={mealBooking.quantity}
                      onChange={(e) => setMealBooking(prev => ({ ...prev, quantity: e.target.value }))}
                      min="1"
                      max="500"
                      required
                    />
                  </div>

                  <div className="meal-form-group">
                    <label className="meal-form-label">Special Requirements</label>
                    <textarea 
                      className="form-control meal-form-control"
                      rows="3"
                      value={mealBooking.specialRequirements}
                      onChange={(e) => setMealBooking(prev => ({ ...prev, specialRequirements: e.target.value }))}
                      placeholder={t('specialRequirementsPlaceholder')}
                    />
                  </div>
                  
                  <button type="submit" className="btn meal-btn meal-btn-primary w-100" disabled={loading}>
                    {loading ? (
                      <>
                        <i className="bi bi-arrow-clockwise spin"></i> {t('bookingInProgress')}
                      </>
                    ) : (
                      <>
                        <i className="bi bi-utensils"></i> Book Meal
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* Quick Stats Panel */}
          <div className="col-lg-3 col-md-4">
            <div className="meal-stats-card">
              <div className="meal-stats-number">
                {todaysBookings}
              </div>
              <div className="meal-stats-label">{t('todaysBookingsLabel')}</div>
            </div>

            <div className="info-card">
              <div className="info-card-header">
                <h5 className="mb-0">ℹ️ Booking Information</h5>
              </div>
              <div className="info-card-body">
                <ul className="info-list">
                  <li>📅 {t('bookingInfo_line1')}</li>
                  <li>🕐 {t('bookingInfo_line2')}</li>
                  <li>🍽️ {t('bookingInfo_line3')}</li>
                  <li>⚠️ {t('bookingInfo_line4')}</li>
                  <li>📋 {t('bookingInfo_line5')}</li>
                </ul>
              </div>
            </div>

            {/* Report Generation Buttons */}
            <div className="mt-3">
              <button 
                className="btn btn-primary w-100 mb-2" 
                onClick={handleGenerateTodaysBookings}
                disabled={generatingReport}
              >
                {generatingReport ? (
                  <>
                    <i className="bi bi-arrow-clockwise spin"></i> Generating...
                  </>
                ) : (
                  <>
                    <i className="bi bi-file-earmark-text"></i> Generate Today's Bookings
                  </>
                )}
              </button>
              
              <button 
                className="btn btn-success w-100 mb-2" 
                onClick={handleGenerateMealCountReport}
                disabled={generatingReport}
              >
                {generatingReport ? (
                  <>
                    <i className="bi bi-arrow-clockwise spin"></i> Generating...
                  </>
                ) : (
                  <>
                    <i className="bi bi-bar-chart"></i> Generate Meal Count Report
                  </>
                )}
              </button>
              
              <button 
                className="btn btn-warning w-100 mb-2" 
                onClick={() => setShowPreferenceModal(true)}
              >
                <i className="bi bi-gear"></i> Set Meal Preference
              </button>
              
              <button 
                className="btn btn-info w-100" 
                onClick={() => setShowEmployeeList(!showEmployeeList)}
              >
                <i className="bi bi-people"></i> {showEmployeeList ? 'Hide' : 'Show'} Employee Lists
              </button>
            </div>
          </div>
        </div>

        {/* Employee Lists with Filters */}
        {showEmployeeList && (
          <div className="row mt-4">
            <div className="col-12">
              <div className="card">
                <div className="card-header bg-info text-white">
                  <h4 className="mb-0"><i className="bi bi-people-fill"></i> Employee Meal Preferences</h4>
                </div>
                <div className="card-body">
                  {/* Instructions */}
                  <div className="alert alert-info mb-4">
                    <i className="bi bi-info-circle me-2"></i>
                    <strong>How to use:</strong> Select Division and Section, click Search to find unassigned employees, select employees, then transfer them to Meal Package or Money Allowance.
                  </div>

                  {/* Filters */}
                  <div className="row mb-4">
                    <div className="col-md-6">
                      <label className="form-label fw-bold">Division <span className="text-danger">*</span></label>
                      <select 
                        className="form-select"
                        value={filterDivision}
                        onChange={(e) => {
                          console.log('Division selected:', e.target.value);
                          const selectedDiv = divisions.find(d => d.division_id === e.target.value);
                          console.log('Division object:', selectedDiv);
                          const filteredSecs = allSections.filter(s => 
                            String(s.division_id || s.divisionId || s.DIVISION_ID || '') === String(e.target.value)
                          );
                          console.log(`Found ${filteredSecs.length} sections for this division`);
                          setFilterDivision(e.target.value);
                          setFilterSection('all');
                          setFilterSubSection('all');
                        }}
                      >
                        <option value="all">All Divisions</option>
                        {divisions.map((division) => (
                          <option key={division.division_id} value={division.division_id}>
                            {division.division_name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-bold">Section <span className="text-danger">*</span></label>
                      <select 
                        className="form-select"
                        value={filterSection}
                        onChange={(e) => {
                          console.log('Section selected:', e.target.value);
                          setFilterSection(e.target.value);
                          setFilterSubSection('all');
                        }}
                        disabled={filterDivision === 'all'}
                      >
                        <option value="all">Select Section</option>
                        {allSections
                          .filter(s => {
                            if (filterDivision === 'all') return true;
                            const sectionDivId = String(s.division_id || s.divisionId || s.DIVISION_ID || '');
                            const selectedDivId = String(filterDivision);
                            const matches = sectionDivId === selectedDivId;
                            return matches;
                          })
                          .map((section) => (
                            <option key={section.section_id} value={section.section_id}>
                              {section.section_name}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  {/* Search Button */}
                  <div className="row mb-4">
                    <div className="col-12">
                      <button 
                        className="btn btn-primary btn-lg w-100"
                        onClick={searchEmployees}
                        disabled={loadingSearch || filterDivision === 'all' || filterSection === 'all'}
                      >
                        {loadingSearch ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2"></span>
                            Searching...
                          </>
                        ) : (
                          <>
                            <i className="bi bi-search me-2"></i>
                            Search Employees
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Results Tabs */}
                  <ul className="nav nav-tabs mb-3">
                    {searchResults.length > 0 && (
                      <li className="nav-item">
                        <button 
                          className={`nav-link ${activeTab === 'search' ? 'active' : ''}`}
                          onClick={() => setActiveTab('search')}
                        >
                          <i className="bi bi-people"></i> Search Results ({searchResults.length})
                        </button>
                      </li>
                    )}
                    <li className="nav-item">
                      <button 
                        className={`nav-link ${activeTab === 'meal' ? 'active' : ''}`}
                        onClick={() => {
                          setActiveTab('meal');
                          fetchMealPackageEmployees();
                        }}
                      >
                        <i className="bi bi-egg-fried"></i> Meal Package ({mealPackageEmployees.length})
                      </button>
                    </li>
                    <li className="nav-item">
                      <button 
                        className={`nav-link ${activeTab === 'money' ? 'active' : ''}`}
                        onClick={() => {
                          setActiveTab('money');
                          fetchMoneyAllowanceEmployees();
                        }}
                      >
                        <i className="bi bi-cash-coin"></i> Money Allowance ({moneyAllowanceEmployees.length})
                      </button>
                    </li>
                  </ul>

                  {/* Employee Tables */}
                  {activeTab === 'search' && (
                    <div>
                      {searchResults.length > 0 && (
                        <>
                          {/* Transfer Buttons */}
                          <div className="row mb-3">
                            <div className="col-md-6">
                              <button 
                                className="btn btn-primary w-100"
                                onClick={() => handleTransferToPreference('meal')}
                                disabled={selectedEmployees.length === 0 || transferring}
                              >
                                {transferring ? (
                                  <span className="spinner-border spinner-border-sm me-2"></span>
                                ) : (
                                  <i className="bi bi-egg-fried me-2"></i>
                                )}
                                Transfer to Meal Package ({selectedEmployees.length})
                              </button>
                            </div>
                            <div className="col-md-6">
                              <button 
                                className="btn btn-success w-100"
                                onClick={() => handleTransferToPreference('money')}
                                disabled={selectedEmployees.length === 0 || transferring}
                              >
                                {transferring ? (
                                  <span className="spinner-border spinner-border-sm me-2"></span>
                                ) : (
                                  <i className="bi bi-cash-coin me-2"></i>
                                )}
                                Transfer to Money Allowance ({selectedEmployees.length})
                              </button>
                            </div>
                          </div>

                          <div className="table-responsive">
                            <table className="table table-striped table-hover">
                              <thead className="table-primary">
                                <tr>
                                  <th style={{ width: '50px' }}>
                                    <input 
                                      type="checkbox"
                                      className="form-check-input"
                                      checked={selectedEmployees.length === searchResults.length && searchResults.length > 0}
                                      onChange={() => handleSelectAll(searchResults)}
                                    />
                                  </th>
                                  <th>#</th>
                                  <th>Employee ID</th>
                                  <th>Employee Name</th>
                                </tr>
                              </thead>
                              <tbody>
                                {searchResults.map((emp, index) => {
                                  const isSelected = selectedEmployees.some(e => e.employee_id === emp.employee_id);
                                  return (
                                    <tr 
                                      key={emp.employee_id}
                                      style={{ cursor: 'pointer' }}
                                      onClick={() => handleSelectEmployee(emp)}
                                      className={isSelected ? 'table-active' : ''}
                                    >
                                      <td onClick={(e) => e.stopPropagation()}>
                                        <input 
                                          type="checkbox"
                                          className="form-check-input"
                                          checked={isSelected}
                                          onChange={() => handleSelectEmployee(emp)}
                                        />
                                      </td>
                                      <td>{index + 1}</td>
                                      <td><strong>{emp.employee_id}</strong></td>
                                      <td>{emp.employee_name}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {activeTab === 'meal' && (
                    <div className="table-responsive">
                      <table className="table table-striped table-hover">
                        <thead className="table-primary">
                          <tr>
                            <th>#</th>
                            <th>Employee ID</th>
                            <th>Employee Name</th>
                          </tr>
                        </thead>
                        <tbody>
                          {mealPackageEmployees.length > 0 ? (
                            mealPackageEmployees.map((emp, index) => (
                              <tr key={emp.id}>
                                <td>{index + 1}</td>
                                <td><strong>{emp.employee_id}</strong></td>
                                <td>{emp.employee_name}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan="3" className="text-center text-muted">
                                No employees in meal package
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {activeTab === 'money' && (
                    <div className="table-responsive">
                      <table className="table table-striped table-hover">
                        <thead className="table-success">
                          <tr>
                            <th>#</th>
                            <th>Employee ID</th>
                            <th>Employee Name</th>
                            <th>Allowance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {moneyAllowanceEmployees.length > 0 ? (
                            moneyAllowanceEmployees.map((emp, index) => (
                              <tr key={emp.id}>
                                <td>{index + 1}</td>
                                <td><strong>{emp.employee_id}</strong></td>
                                <td>{emp.employee_name}</td>
                                <td><strong>Rs. {parseFloat(emp.allowance_amount).toFixed(2)}</strong></td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan="4" className="text-center text-muted">
                                No employees with money allowance
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Display Today's Bookings Report */}
        {showBookingsReport && reportData && reportData.type === 'bookings' && (
          <div className="row mt-4">
            <div className="col-12">
              <div className="card">
                <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
                  <h4 className="mb-0">📋 Today's Meal Bookings Report</h4>
                  <button 
                    className="btn btn-sm btn-light"
                    onClick={() => setShowBookingsReport(false)}
                  >
                    ✕ Close
                  </button>
                </div>
                <div className="card-body">
                  <div className="row mb-3">
                    <div className="col-md-3 col-sm-6 mb-2">
                      <div className="alert alert-info mb-0">
                        <strong>📅 Date:</strong><br/>
                        {new Date(reportData.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                      </div>
                    </div>
                    <div className="col-md-3 col-sm-6 mb-2">
                      <div className="alert alert-success mb-0">
                        <strong>📊 Total Bookings:</strong><br/>
                        <h3 className="mb-0">{reportData.bookings.length}</h3>
                      </div>
                    </div>
                    <div className="col-md-3 col-sm-6 mb-2">
                      <div className="alert alert-warning mb-0">
                        <strong>🍽️ Total Meals:</strong><br/>
                        <h3 className="mb-0">{reportData.bookings.reduce((sum, b) => sum + (b.quantity || 0), 0)}</h3>
                      </div>
                    </div>
                    <div className="col-md-3 col-sm-6 mb-2">
                      <div className="alert alert-primary mb-0">
                        <strong>🕐 Generated At:</strong><br/>
                        {new Date().toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                  
                  <div className="table-responsive">
                    <table className="table table-striped table-hover">
                      <thead className="table-primary">
                        <tr>
                          <th>#</th>
                          <th>Employee ID</th>
                          <th>Employee Name</th>
                          <th>Email</th>
                          <th>Division</th>
                          <th>Meal Type</th>
                          <th>Quantity</th>
                          <th>Status</th>
                          <th>Special Requirements</th>
                          <th>Booked At</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.bookings.map((booking, index) => (
                          <tr key={booking.id || index}>
                            <td>{index + 1}</td>
                            <td>{booking.employeeId || 'N/A'}</td>
                            <td><strong>{booking.employeeName || 'Unknown'}</strong></td>
                            <td>{booking.email || 'N/A'}</td>
                            <td>{reportData.divisionsMap[booking.divisionId] || booking.divisionId || 'N/A'}</td>
                            <td><span className="badge bg-info text-capitalize">{booking.mealType || 'N/A'}</span></td>
                            <td><strong>{booking.quantity || 1}</strong></td>
                            <td><span className={`badge bg-${booking.status === 'confirmed' ? 'success' : 'warning'}`}>{booking.status || 'pending'}</span></td>
                            <td>{booking.specialRequirements || '-'}</td>
                            <td>{new Date(booking.createdAt).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Display Meal Count Report */}
        {showCountReport && reportData && reportData.type === 'count' && (
          <div className="row mt-4">
            <div className="col-12">
              <div className="card">
                <div className="card-header bg-success text-white d-flex justify-content-between align-items-center">
                  <h4 className="mb-0">📊 Meal Count Report</h4>
                  <button 
                    className="btn btn-sm btn-light"
                    onClick={() => setShowCountReport(false)}
                  >
                    ✕ Close
                  </button>
                </div>
                <div className="card-body">
                  <div className="row mb-3">
                    <div className="col-md-3 col-sm-6 mb-2">
                      <div className="alert alert-info mb-0">
                        <strong>📅 Date:</strong><br/>
                        {new Date(reportData.date).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="col-md-3 col-sm-6 mb-2">
                      <div className="alert alert-success mb-0">
                        <strong>📋 Total Bookings:</strong><br/>
                        <h3 className="mb-0">{reportData.bookings.length}</h3>
                      </div>
                    </div>
                    <div className="col-md-3 col-sm-6 mb-2">
                      <div className="alert alert-warning mb-0">
                        <strong>🍽️ Total Meals:</strong><br/>
                        <h3 className="mb-0">{Object.values(reportData.mealTypeCounts).reduce((sum, item) => sum + item.quantity, 0)}</h3>
                      </div>
                    </div>
                    <div className="col-md-3 col-sm-6 mb-2">
                      <div className="alert alert-primary mb-0">
                        <strong>🕐 Generated At:</strong><br/>
                        {new Date().toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                  
                  <div className="table-responsive">
                    <table className="table table-striped table-hover">
                      <thead className="table-success">
                        <tr>
                          <th>Meal Type</th>
                          <th>Number of Bookings</th>
                          <th>Total Quantity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(reportData.mealTypeCounts).map(([mealType, data]) => (
                          <tr key={mealType}>
                            <td className="text-capitalize"><strong>🍽️ {mealType}</strong></td>
                            <td><h5 className="text-success mb-0">{data.count}</h5></td>
                            <td><h5 className="text-success mb-0">{data.quantity}</h5></td>
                          </tr>
                        ))}
                        <tr className="table-success fw-bold">
                          <td><strong>📊 TOTAL</strong></td>
                          <td><strong>{Object.values(reportData.mealTypeCounts).reduce((sum, item) => sum + item.count, 0)}</strong></td>
                          <td><strong>{Object.values(reportData.mealTypeCounts).reduce((sum, item) => sum + item.quantity, 0)}</strong></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Meal Preference Modal */}
        {showPreferenceModal && (
          <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog modal-xl">
              <div className="modal-content">
                <div className="modal-header bg-warning">
                  <h5 className="modal-title">
                    <i className="bi bi-gear"></i> Set Employee Meal Preference
                  </h5>
                  <button 
                    type="button" 
                    className="btn-close" 
                    onClick={() => {
                      setShowPreferenceModal(false);
                      setEmployeeSearch('');
                      setHrisEmployees([]);
                      setFilteredEmployees([]);
                      setSelectedEmployees([]);
                      setModalDivision('all');
                      setModalSection('all');
                      setModalSubSection('all');
                      setMealPreference('');
                    }}
                  ></button>
                </div>
                <div className="modal-body">
                  <div className="alert alert-info">
                    <i className="bi bi-info-circle"></i> Search employees by ID or name from HRIS, then filter and select multiple employees to assign meal preferences
                  </div>

                  {/* Employee Search */}
                  <div className="row mb-3">
                    <div className="col-md-12">
                      <label className="form-label fw-bold">Search Employee (ID or Name)</label>
                      <div className="input-group">
                        <input 
                          type="text"
                          className="form-control"
                          placeholder="Enter employee ID or name (min 2 characters)..."
                          value={employeeSearch}
                          onChange={(e) => setEmployeeSearch(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleSearchHRISEmployees()}
                        />
                        <button 
                          className="btn btn-primary" 
                          onClick={handleSearchHRISEmployees}
                          disabled={loadingEmployees}
                        >
                          {loadingEmployees ? (
                            <><span className="spinner-border spinner-border-sm me-2"></span>Searching...</>
                          ) : (
                            <><i className="bi bi-search"></i> Search HRIS</>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Show initial instruction if no search performed */}
                  {hrisEmployees.length === 0 && !loadingEmployees && (
                    <div className="alert alert-light border text-center py-4">
                      <i className="bi bi-search fs-1 text-muted d-block mb-3"></i>
                      <h5 className="text-muted">Search for employees to get started</h5>
                      <p className="text-muted mb-0">Enter an employee ID or name above and click "Search HRIS"</p>
                    </div>
                  )}

                  {/* Filters */}
                  {hrisEmployees.length > 0 && (
                    <div className="row mb-3">
                      <div className="col-md-4">
                        <label className="form-label fw-bold">Filter by Division</label>
                        <select 
                          className="form-select"
                          value={modalDivision}
                          onChange={(e) => setModalDivision(e.target.value)}
                        >
                          <option value="all">All Divisions</option>
                          {divisions.map((division) => (
                            <option key={division.division_id} value={division.division_id}>
                              {division.division_name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-md-4">
                        <label className="form-label fw-bold">Filter by Section</label>
                        <select 
                          className="form-select"
                          value={modalSection}
                          onChange={(e) => setModalSection(e.target.value)}
                          disabled={modalDivision === 'all'}
                        >
                          <option value="all">All Sections</option>
                          {modalSections.map((section) => (
                            <option key={section.section_id} value={section.section_id}>
                              {section.section_name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-md-4">
                        <label className="form-label fw-bold">Filter by Sub-Section</label>
                        <select 
                          className="form-select"
                          value={modalSubSection}
                          onChange={(e) => setModalSubSection(e.target.value)}
                          disabled={modalSection === 'all'}
                        >
                          <option value="all">All Sub-Sections</option>
                          {modalSubSections.map((subsection) => (
                            <option key={subsection.id} value={subsection.id}>
                              {subsection.sub_name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Employee Results Table */}
                  {filteredEmployees.length > 0 && (
                    <>
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <label className="form-label fw-bold mb-0">
                          Select Employees ({selectedEmployees.length} of {filteredEmployees.length} selected)
                        </label>
                        <button 
                          className="btn btn-sm btn-outline-primary"
                          onClick={handleSelectAll}
                        >
                          {selectedEmployees.length === filteredEmployees.length && filteredEmployees.length > 0 
                            ? <><i className="bi bi-square"></i> Deselect All</>
                            : <><i className="bi bi-check-square"></i> Select All</>
                          }
                        </button>
                      </div>
                      <div className="table-responsive" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                        <table className="table table-hover table-sm">
                          <thead className="table-light sticky-top">
                            <tr>
                              <th style={{ width: '50px' }}>
                                <input 
                                  type="checkbox"
                                  className="form-check-input"
                                  checked={selectedEmployees.length === filteredEmployees.length && filteredEmployees.length > 0}
                                  onChange={handleSelectAll}
                                />
                              </th>
                              <th>ID</th>
                              <th>Name</th>
                              <th>Division</th>
                              <th>Section</th>
                              <th>Sub-Section</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredEmployees.map((emp) => {
                              const empId = emp.employee_id || emp.id || emp.EMPLOYEE_ID;
                              const isSelected = selectedEmployees.some(e => 
                                (e.employee_id || e.id || e.EMPLOYEE_ID) === empId
                              );
                              return (
                                <tr 
                                  key={empId}
                                  style={{ cursor: 'pointer' }}
                                  onClick={() => handleSelectEmployee(emp)}
                                  className={isSelected ? 'table-active' : ''}
                                >
                                  <td>
                                    <input 
                                      type="checkbox"
                                      className="form-check-input"
                                      checked={isSelected}
                                      onChange={() => handleSelectEmployee(emp)}
                                    />
                                  </td>
                                  <td><strong>{empId}</strong></td>
                                  <td>{emp.employee_name || emp.name || emp.EMPLOYEE_NAME}</td>
                                  <td>{emp.division_name || emp.divisionName || emp.DIVISION_NAME || 'N/A'}</td>
                                  <td>{emp.section_name || emp.sectionName || emp.SECTION_NAME || 'N/A'}</td>
                                  <td>{emp.subsection_name || emp.subsectionName || emp.SUBSECTION_NAME || 'N/A'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}

                  {/* No Results Message */}
                  {hrisEmployees.length > 0 && filteredEmployees.length === 0 && (
                    <div className="alert alert-warning">
                      <i className="bi bi-exclamation-triangle"></i> No employees match the selected filters
                    </div>
                  )}

                  {/* Preference Selection */}
                  {selectedEmployees.length > 0 && (
                    <div className="mt-4">
                      <label className="form-label fw-bold">Select Meal Preference for {selectedEmployees.length} Employee(s)</label>
                      <div className="row">
                        <div className="col-md-6">
                          <div 
                            className={`card ${mealPreference === 'meal' ? 'border-primary border-3' : ''}`}
                            style={{ cursor: 'pointer' }}
                            onClick={() => setMealPreference('meal')}
                          >
                            <div className="card-body text-center">
                              <i className="bi bi-egg-fried fs-1 text-primary"></i>
                              <h5 className="mt-2">Physical Meal Package</h5>
                              <p className="text-muted small">Employees receive actual meals from cafeteria</p>
                              {mealPreference === 'meal' && (
                                <i className="bi bi-check-circle-fill text-primary fs-4"></i>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="col-md-6">
                          <div 
                            className={`card ${mealPreference === 'money' ? 'border-success border-3' : ''}`}
                            style={{ cursor: 'pointer' }}
                            onClick={() => setMealPreference('money')}
                          >
                            <div className="card-body text-center">
                              <i className="bi bi-cash-coin fs-1 text-success"></i>
                              <h5 className="mt-2">Money Allowance</h5>
                              <p className="text-muted small">Employees receive money instead of meals</p>
                              {mealPreference === 'money' && (
                                <i className="bi bi-check-circle-fill text-success fs-4"></i>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="modal-footer">
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={() => {
                      setShowPreferenceModal(false);
                      setEmployeeSearch('');
                      setHrisEmployees([]);
                      setFilteredEmployees([]);
                      setSelectedEmployees([]);
                      setModalDivision('all');
                      setModalSection('all');
                      setModalSubSection('all');
                      setMealPreference('');
                    }}
                  >
                    Cancel
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-primary" 
                    onClick={handleSubmitBatchPreferences}
                    disabled={selectedEmployees.length === 0 || !mealPreference || submittingPreferences}
                  >
                    {submittingPreferences ? (
                      <><span className="spinner-border spinner-border-sm me-2"></span>Saving...</>
                    ) : (
                      <><i className="bi bi-check-circle"></i> Save Preferences ({selectedEmployees.length} employees)</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MealManagement;
