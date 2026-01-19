import React, { useState, useEffect, useCallback, useRef } from 'react';
import usePermission from '../../hooks/usePermission';
import PageHeader from './PageHeader';
import './SectionManagement.css';

const SectionManagement = ({ onBack }) => {
  const [sections, setSections] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [loading, setLoading] = useState(true);
  // HRIS source flag removed (was unused) - keep rawSections/rawDivisions for snapshots
  const [selectedDivision, setSelectedDivision] = useState(''); // division _id or 'all'
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState('name_asc'); // name_asc, name_desc, id_asc, id_desc
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentSection, setCurrentSection] = useState(null);
  // Sub-section modal state
  const [showSubModal, setShowSubModal] = useState(false);
  const [subParentSection, setSubParentSection] = useState(null);
  const [subForm, setSubForm] = useState({ name: '', code: '' });
  const [subSubmitting, setSubSubmitting] = useState(false);
  const [subErrors, setSubErrors] = useState({});
  // Sub-section edit modal state
  const [showEditSubModal, setShowEditSubModal] = useState(false);
  const [editingSubSection, setEditingSubSection] = useState(null); // { sectionId, subSection }
  const [editSubForm, setEditSubForm] = useState({ name: '', code: '' });
  const [editSubSubmitting, setEditSubSubmitting] = useState(false);
  const [editSubErrors, setEditSubErrors] = useState({});
  // Raw snapshots from HRIS
  const [rawSections, setRawSections] = useState([]);
  const [rawDivisions, setRawDivisions] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    division: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  // Sub-sections display state
  // expandedSections removed (not used)
  const [subSectionsBySection, setSubSectionsBySection] = useState({}); // { [sectionId]: Array }
  const [subSectionsLoading, setSubSectionsLoading] = useState({}); // { [sectionId]: boolean }
  const [subSectionsError, setSubSectionsError] = useState({}); // { [sectionId]: string }
  // Sub-sections popup modal state
  const [showSubSectionsModal, setShowSubSectionsModal] = useState(false);
  const [currentSectionForSubSections, setCurrentSectionForSubSections] = useState(null);
  // Delete confirmation modal state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // { sectionId, subSectionId }
  // Employee list modal state
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  // Bulk transfer selection state
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState(new Set());
  const [showBulkTransferConfirm, setShowBulkTransferConfirm] = useState(false);
  const [employeeList, setEmployeeList] = useState([]);
  const [employeeLoading, setEmployeeLoading] = useState(false);
  const [selectedSubSection, setSelectedSubSection] = useState(null);
  // Transfer confirmation modal state
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);
  const [transferEmployee, setTransferEmployee] = useState(null);
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  // Track transferred employees
  const [transferredEmployees, setTransferredEmployees] = useState([]);
  // Recall confirmation modal state
  const [showRecallConfirm, setShowRecallConfirm] = useState(false);
  const [recallEmployee, setRecallEmployee] = useState(null);
  const [recallSubmitting, setRecallSubmitting] = useState(false);
  // Transferred employees modal state
  const [showTransferredEmployeesModal, setShowTransferredEmployeesModal] = useState(false);
  // Bulk recall selection state
  const [selectedTransferredEmployeeIds, setSelectedTransferredEmployeeIds] = useState(new Set());
  const [showBulkRecallConfirm, setShowBulkRecallConfirm] = useState(false);
  const [bulkRecallSubmitting, setBulkRecallSubmitting] = useState(false);
  const [transferredEmployeesList, setTransferredEmployeesList] = useState([]);
  const [transferredLoading, setTransferredLoading] = useState(false);
  // Employee counts
  const [activeEmployeeCount, setActiveEmployeeCount] = useState(0);
  const [inactiveEmployeeCount, setInactiveEmployeeCount] = useState(0);
  // Search state for employee modals
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState('');
  const [transferredSearchQuery, setTransferredSearchQuery] = useState('');
  // Toast popup state
  const [toast, setToast] = useState({ show: false, type: 'success', title: '', message: '' });
  const toastTimerRef = useRef(null);
  const canView = usePermission('sections', 'read');
  const canCreate = usePermission('sections', 'create');
  const canViewSubsections = usePermission('subsections', 'read');
  const canCreateSubsection = usePermission('subsections', 'create');
  const canUpdateSubsection = usePermission('subsections', 'update');
  const canDeleteSubsection = usePermission('subsections', 'delete');
  const canTransferSubsection = usePermission('subsections', 'transfer');
  const canRecallSubsection = usePermission('subsections', 'recall');
  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  // Toast helpers
  const hideToast = () => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToast((t) => ({ ...t, show: false }));
  };

  const showToast = ({ type = 'success', title = '', message = '', duration = 3000 }) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    // Ensure message is a string to avoid React rendering objects as children
    const safeMessage = (message && typeof message === 'object') ? (message.message || JSON.stringify(message)) : String(message || '');
    setToast({ show: true, type, title, message: safeMessage });
    toastTimerRef.current = setTimeout(() => {
      setToast((t) => ({ ...t, show: false }));
      toastTimerRef.current = null;
    }, duration);
  };

  // Helpers: robust date parsing for HRIS/Mongo-like payloads
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

  // Utils
  const getAuthToken = () => localStorage.getItem('token');

  // Fetch sub-sections for a given section id
  const fetchSubSections = async (sectionId, { force = false } = {}) => {
    if (!sectionId) return;
    if (subSectionsBySection[sectionId] && !force) return; // cached
    const token = getAuthToken();
    if (!token) return;
    setSubSectionsLoading(prev => ({ ...prev, [sectionId]: true }));
    setSubSectionsError(prev => ({ ...prev, [sectionId]: '' }));
    try {
      // Find the section to get its code
      const section = sections.find(s => s._id === sectionId);
      const sectionCode = section?.code || sectionId;
      
      const resp = await fetch(`${API_BASE_URL}/mysql-subsections?sectionId=${encodeURIComponent(sectionCode)}`, {
        headers: { 'Authorization': `Bearer ${token}` },
        credentials: 'include'
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const items = Array.isArray(data?.data) ? data.data : [];
      setSubSectionsBySection(prev => ({ ...prev, [sectionId]: items }));
    } catch (e) {
      console.error('Failed to fetch sub-sections:', e);
      setSubSectionsError(prev => ({ ...prev, [sectionId]: 'Failed to load sub-sections' }));
    } finally {
      setSubSectionsLoading(prev => ({ ...prev, [sectionId]: false }));
    }
  };

  const toggleSubSections = async (section) => {
    setCurrentSectionForSubSections(section);
    setShowSubSectionsModal(true);
    const id = section._id;
    if (!subSectionsBySection[id]) {
      await fetchSubSections(id);
    }
  };

  const handleCloseSubSectionsModal = () => {
    setShowSubSectionsModal(false);
    setCurrentSectionForSubSections(null);
  };

  // Sub-section edit/delete
  const handleEditSubSection = (sectionId, item) => {
    // Get parent division and section names from currentSectionForSubSections
    const divisionName = getDivisionName(currentSectionForSubSections?.division);
    const sectionName = currentSectionForSubSections?.name || 'N/A';
    
    setEditingSubSection({ 
      sectionId, 
      subSection: item,
      parentDivision: divisionName,
      parentSection: sectionName
    });
    setEditSubForm({
      name: item?.subSection?.sub_hie_name || item?.subSection?.hie_name || item?.subSection?.name || '',
      code: item?.subSection?.sub_hie_code || item?.subSection?.hie_code || item?.subSection?.code || ''
    });
    setEditSubErrors({});
    setShowEditSubModal(true);
  };

  const submitEditSubSection = async () => {
    if (!editingSubSection) return;
    if (!canUpdateSubsection) {
      showToast({ type: 'error', title: 'Permission', message: 'You do not have permission to update sub-sections.' });
      return;
    }

    // Validate
    const errors = {};
    if (!editSubForm.name.trim()) errors.name = 'Sub-section name is required';
    if (!editSubForm.code.trim()) errors.code = 'Sub-section code is required';

    if (Object.keys(errors).length > 0) {
      setEditSubErrors(errors);
      return;
    }

    setEditSubSubmitting(true);
    const token = localStorage.getItem('token');
    if (!token) {
      setEditSubSubmitting(false);
      showToast({ type: 'error', title: 'Auth', message: 'Token missing. Please login.' });
      return;
    }

    try {
      const subSectionId = editingSubSection?.subSection?._id || editingSubSection?.subSection?._id || editingSubSection?.subSection?.id || editingSubSection?.subSection?.section_id || '';
      const payload = {
        // Provide multiple keys for compatibility with different backend routes
        sub_hie_name: editSubForm.name.trim(),
        sub_hie_code: editSubForm.code.trim(),
        hie_name: editSubForm.name.trim(),
        hie_code: editSubForm.code.trim(),
        name: editSubForm.name.trim(),
        code: editSubForm.code.trim()
      };

      const resp = await fetch(`${API_BASE_URL}/mysql-subsections/${encodeURIComponent(subSectionId)}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (!resp.ok) {
        let msg = `Failed to update sub-section (HTTP ${resp.status})`;
        try { const j = await resp.json(); msg = j?.message || msg; } catch (_) {}
        throw new Error(msg);
      }

      // Close and reset
      setShowEditSubModal(false);
      setEditingSubSection(null);
      setEditSubForm({ name: '', code: '' });
      setEditSubSubmitting(false);

      setTimeout(() => {
        showToast({ type: 'success', title: 'Success!', message: 'Sub-section updated successfully.' });
      }, 150);

      // Refresh sub-section list
      await fetchSubSections(editingSubSection.sectionId, { force: true });
    } catch (e) {
      console.error('Edit sub-section failed:', e);
      setEditSubSubmitting(false);
      showToast({ type: 'error', title: 'Failed', message: (e?.message || 'Could not update sub-section.') });
    }
  };

  const closeEditSubModal = () => {
    setShowEditSubModal(false);
    setEditingSubSection(null);
    setEditSubForm({ name: '', code: '' });
    setEditSubErrors({});
    setEditSubSubmitting(false);
  };

  const handleDeleteSubSection = (sectionId, id) => {
    setDeleteTarget({ sectionId, subSectionId: id });
    setShowDeleteConfirm(true);
  };

  const confirmDeleteSubSection = async () => {
    if (!deleteTarget) return;
    if (!canDeleteSubsection) {
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
      return showToast({ type: 'error', title: 'Permission', message: 'You do not have permission to delete sub-sections.' });
    }
    const { sectionId, subSectionId } = deleteTarget;
    const token = localStorage.getItem('token');
    if (!token) {
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
      return showToast({ type: 'error', title: 'Auth', message: 'Token missing. Please login.' });
    }
    try {
  const resp = await fetch(`${API_BASE_URL}/mysql-subsections/${subSectionId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
        credentials: 'include',
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      
      // Close modal first
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
      
      // Small delay to ensure modal is closed before showing toast
      setTimeout(() => {
        showToast({ type: 'success', title: 'Success!', message: 'Sub-section deleted successfully.' });
      }, 150);
      
      await fetchSubSections(sectionId, { force: true });
    } catch (e) {
      console.error('Delete sub-section failed:', e);
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
      setTimeout(() => {
        showToast({ type: 'error', title: 'Failed', message: 'Could not delete sub-section.' });
      }, 150);
    }
  };

  // Fetch transferred employees (MySQL) and return mapped IDs for immediate filtering
  const fetchTransferredEmployees = async (subSectionId, token) => {
    try {
      console.log('🔍 Fetching transferred employees for subsection:', subSectionId);
      
  const response = await fetch(`${API_BASE_URL}/mysql-subsections/transferred/${subSectionId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      console.log('📡 Response status:', response.status);

      if (!response.ok) {
        console.error('❌ Failed to fetch transferred employees. Status:', response.status);
        return [];
      }
      const data = await response.json();
      console.log('📦 Response data:', data);
      const transfers = data?.data || [];
      console.log('📊 Number of transfers found:', transfers.length);
      if (transfers.length > 0) console.log('📋 Transfer records:', transfers);

      const transferredIds = transfers.map(t => ({
        employeeId: String(t.employeeId || t.employee_id || t.empId || t.emp_id || ''),
        sub_section_id: t.sub_section_id || t.subSectionId || t.subsection_id || t.subsectionId
      }));
      console.log('🎯 Mapped transferred IDs:', transferredIds);
      setTransferredEmployees(prev => {
        const filtered = prev.filter(t => t.sub_section_id !== subSectionId);
        const updated = [...filtered, ...transferredIds];
        console.log('✅ Updated transferred employees list:', updated);
        return updated;
      });
      return transferredIds;
    } catch (error) {
      console.error('❌ Error fetching transferred employees:', error);
      // Don't show error toast, just log it
      return [];
    }
  };

  // Handle opening employee list modal
  const handleAddEmployeeToSubSection = async (subSection) => {
    if (!canTransferSubsection) {
      showToast({ type: 'error', title: 'Permission', message: 'You do not have permission to transfer employees.' });
      return;
    }
    setSelectedSubSection(subSection);
    setShowEmployeeModal(true);
    setSelectedEmployeeIds(new Set());
    setEmployeeLoading(true);
    setEmployeeList([]);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token');
      }

      // Fetch already transferred employees for this subsection and keep local copy
      const currentTransferred = await fetchTransferredEmployees(subSection._id, token);

      // Helper: normalization and tolerant matching
      const norm = (v) => (v === undefined || v === null ? '' : String(v).trim().toLowerCase());
      const anyMatch = (values, target) => {
        const t = norm(target);
        if (!t) return false;
        return (values || []).some(v => {
          const vv = norm(v);
          return vv && (vv === t || vv.includes(t) || t.includes(vv));
        });
      };

      // Extract division and section identifiers from subSection using multiple keys
      const divisionCode = subSection?.parentDivision?.division_code || subSection?.parentDivision?.divisionCode || subSection?.parentDivision?.code || '';
      const divisionName = subSection?.parentDivision?.division_name || subSection?.parentDivision?.divisionName || subSection?.parentDivision?.name || '';
      const sectionCode = subSection?.parentSection?.hie_code || subSection?.parentSection?.hieCode || subSection?.parentSection?.code || '';
      const sectionName = subSection?.parentSection?.hie_name || subSection?.parentSection?.hieName || subSection?.parentSection?.name || '';

      console.log('🔍 Fetching employees from cache for (relaxed match):', { divisionCode, divisionName, sectionCode, sectionName });

      // Fetch employees from cache (much faster than direct HRIS API call)
      const response = await fetch(`${API_BASE_URL}/hris-cache/employees`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const allEmployees = data?.data || data || [];

      console.log('📊 Fetched from cache - Total employees:', allEmployees.length);

      // Candidate extractor: returns many possible fields where division/section might live
      const getEmpDivCandidates = (emp) => [
        emp?.HIE_CODE_4, emp?.hie_code_4, emp?.DIVISION_CODE, emp?.division_code, emp?.divisionCode,
        emp?.currentwork?.HIE_CODE_4, emp?.currentwork?.DIVISION_CODE, emp?.currentwork?.division_code, emp?.currentwork?.divisionCode,
        emp?.HIE_NAME_3, emp?.hie_name_3, emp?.DIVISION_NAME, emp?.division_name, emp?.divisionName,
        emp?.currentwork?.HIE_NAME_3, emp?.currentwork?.DIVISION_NAME, emp?.currentwork?.division_name
      ].filter(Boolean);

      const getEmpSecCandidates = (emp) => [
        emp?.HIE_CODE_3, emp?.hie_code_3, emp?.SECTION_CODE, emp?.section_code, emp?.sectionCode,
        emp?.currentwork?.HIE_CODE_3, emp?.currentwork?.SECTION_CODE, emp?.currentwork?.section_code, emp?.currentwork?.sectionCode,
        emp?.HIE_NAME_4, emp?.hie_name_4, emp?.SECTION_NAME, emp?.section_name, emp?.sectionName,
        emp?.currentwork?.HIE_NAME_4, emp?.currentwork?.SECTION_NAME, emp?.currentwork?.section_name
      ].filter(Boolean);

      // Primary strict filter (code or exact name)
      let filteredEmployees = allEmployees.filter(emp => {
        const divCandidates = getEmpDivCandidates(emp);
        const secCandidates = getEmpSecCandidates(emp);

        const divisionMatch = (divisionCode && anyMatch(divCandidates, divisionCode)) || (divisionName && anyMatch(divCandidates, divisionName));
        const sectionMatch = (sectionCode && anyMatch(secCandidates, sectionCode)) || (sectionName && anyMatch(secCandidates, sectionName));
        return divisionMatch && sectionMatch;
      });

      // If strict filter yields nothing, relax the matching rules (partial & name-based)
      if (filteredEmployees.length === 0) {
        console.warn('No employees found with strict matching; trying relaxed matching (partial / name-based)');
        filteredEmployees = allEmployees.filter(emp => {
          const divCandidates = getEmpDivCandidates(emp);
          const secCandidates = getEmpSecCandidates(emp);

          const divisionRelax = divisionCode ? anyMatch(divCandidates, divisionCode) || anyMatch([divisionCode], divCandidates.join(' ')) : (divisionName ? anyMatch(divCandidates, divisionName) : false);
          const sectionRelax = sectionCode ? anyMatch(secCandidates, sectionCode) || anyMatch([sectionCode], secCandidates.join(' ')) : (sectionName ? anyMatch(secCandidates, sectionName) : false);

          return (divisionRelax || (!divisionCode && divisionName && anyMatch(divCandidates, divisionName))) && (sectionRelax || (!sectionCode && sectionName && anyMatch(secCandidates, sectionName)));
        });
      }

      console.log('✅ Filtered employees (after relaxed matching):', filteredEmployees.length);

      // Exclude already transferred employees (both the authoritative currentTransferred and session-cached transferredEmployees)
      const notTransferredEmployees = filteredEmployees.filter(emp => {
        const empId = String(emp?.EMP_NUMBER || emp?.empNumber || emp?.EMP_ID || emp?.emp_id || '');

        const isInCurrent = (currentTransferred || []).some(
          te => String(te.employeeId) === empId && String(te.sub_section_id) === String(subSection._id)
        );

        const isInSession = (transferredEmployees || []).some(
          te => String(te.employeeId) === empId && String(te.sub_section_id) === String(subSection._id)
        );

        return !isInCurrent && !isInSession;
      });

      console.log('✅ Not transferred employees (after filtering):', notTransferredEmployees.length);

      // Keep only active employees
      const activeNotTransferred = notTransferredEmployees.filter(isEmployeeActive);
      console.log('🎯 Active not-transferred employees:', activeNotTransferred.length, '(filtered out:', notTransferredEmployees.length - activeNotTransferred.length, ')');

      setEmployeeList(activeNotTransferred);
      setEmployeeLoading(false);

    } catch (error) {
      console.error('Error fetching employees:', error);
      setEmployeeLoading(false);
      showToast({ 
        type: 'error', 
        title: 'Error', 
        message: 'Failed to fetch employees from HRIS API' 
      });
    }
  };

  const closeEmployeeModal = () => {
    setShowEmployeeModal(false);
    setSelectedSubSection(null);
    setEmployeeList([]);
    setEmployeeSearchQuery('');
    setSelectedEmployeeIds(new Set());
    setShowBulkTransferConfirm(false);
  };

  // Toggle selection of employee for bulk transfer
  const toggleSelectEmployee = (employee) => {
    const id = String(employee?.EMP_NUMBER || employee?.empNumber || employee?.EMP_ID || employee?.emp_id || '');
    setSelectedEmployeeIds(prev => {
      const next = new Set(Array.from(prev));
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllCurrent = (allChecked, currentEmployeeList) => {
    if (allChecked) {
      const allIds = new Set((currentEmployeeList || employeeList).map(emp => String(emp?.EMP_NUMBER || emp?.empNumber || emp?.EMP_ID || emp?.emp_id || '')));
      setSelectedEmployeeIds(allIds);
    } else {
      setSelectedEmployeeIds(new Set());
    }
  };

  // Handle transfer button click
  const handleTransferEmployee = (employee) => {
    setTransferEmployee(employee);
    setShowTransferConfirm(true);
  };

  // Confirm transfer and save to MongoDB
  const confirmTransferEmployee = async () => {
    if (!canTransferSubsection) {
      setShowTransferConfirm(false);
      setTransferEmployee(null);
      return showToast({ type: 'error', title: 'Permission', message: 'You do not have permission to transfer employees.' });
    }

    if (!transferEmployee || !selectedSubSection) return;

    setTransferSubmitting(true);
    const token = localStorage.getItem('token');
    if (!token) {
      setTransferSubmitting(false);
      setShowTransferConfirm(false);
      return showToast({ type: 'error', title: 'Auth', message: 'Token missing. Please login.' });
    }

    try {
      // Prepare transfer data
      const transferData = {
        employeeId: String(transferEmployee?.EMP_NUMBER || transferEmployee?.empNumber || transferEmployee?.EMP_ID || ''),
        employeeName: transferEmployee?.FULLNAME || transferEmployee?.fullName || transferEmployee?.CALLING_NAME || '',
        division_code: selectedSubSection?.parentDivision?.division_code || '',
        division_name: selectedSubSection?.parentDivision?.division_name || '',
        hie_code: selectedSubSection?.parentSection?.hie_code || '',
        hie_name: selectedSubSection?.parentSection?.hie_name || '',
        sub_section_id: selectedSubSection?._id || '',
        sub_hie_code: selectedSubSection?.subSection?.sub_hie_code || selectedSubSection?.subSection?.hie_code || '',
        sub_hie_name: selectedSubSection?.subSection?.sub_hie_name || selectedSubSection?.subSection?.hie_name || '',
        transferredAt: new Date().toISOString(),
        employeeData: transferEmployee // Store full employee record
      };

      console.log('📤 Transferring employee:', transferData);

    // Save to MySQL
    const response = await fetch(`${API_BASE_URL}/mysql-subsections/transfer`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(transferData)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Transfer successful - API response:', result);
      
      // Add employee to transferred list and immediately remove from selectable employee list
      const newTransfer = { employeeId: transferData.employeeId, sub_section_id: transferData.sub_section_id };
      setTransferredEmployees(prev => [...prev, newTransfer]);
      setEmployeeList(prev => prev.filter(e => String(e?.EMP_NUMBER || e?.empNumber || e?.EMP_ID || '') !== String(transferData.employeeId)));
      // Remove from the selection set if present
      setSelectedEmployeeIds(prev => {
        const next = new Set(Array.from(prev));
        if (next.has(String(transferData.employeeId))) next.delete(String(transferData.employeeId));
        return next;
      });
      setShowTransferConfirm(false);
      setTransferEmployee(null);
      setTransferSubmitting(false);

      showToast({ 
        type: 'success', 
        title: 'Success!', 
        message: `Employee ${transferData.employeeName} has been successfully transferred to ${transferData.sub_hie_name}!` 
      });

      console.log('✅ Transfer complete - Record saved to DB with ID:', result?.data?._id);

    } catch (error) {
      console.error('❌ Transfer failed:', error);
      setTransferSubmitting(false);
      setShowTransferConfirm(false);
      showToast({ 
        type: 'error', 
        title: 'Transfer Failed', 
        message: 'Failed to transfer employee. Please try again.' 
      });
    }
  };

  const cancelTransfer = () => {
    setShowTransferConfirm(false);
    setTransferEmployee(null);
  };

  // Bulk transfer state
  const [bulkTransferSubmitting, setBulkTransferSubmitting] = useState(false);

  const confirmBulkTransfer = async () => {
    if (!canTransferSubsection) {
      setShowBulkTransferConfirm(false);
      return showToast({ type: 'error', title: 'Permission', message: 'You do not have permission to transfer employees.' });
    }

    if (!selectedSubSection || selectedEmployeeIds.size === 0) return;
    setBulkTransferSubmitting(true);
    const token = localStorage.getItem('token');
    if (!token) {
      setBulkTransferSubmitting(false);
      setShowBulkTransferConfirm(false);
      return showToast({ type: 'error', title: 'Auth', message: 'Token missing. Please login.' });
    }

    try {
      // build array of transfer objects
      const selectedIdsArray = Array.from(selectedEmployeeIds);
      const selectedEmployees = employeeList.filter(emp => selectedIdsArray.includes(String(emp?.EMP_NUMBER || emp?.empNumber || emp?.EMP_ID || emp?.emp_id || '')));
      const transfers = selectedEmployees.map(emp => ({
        employeeId: String(emp?.EMP_NUMBER || emp?.empNumber || emp?.EMP_ID || emp?.emp_id || ''),
        employeeName: emp?.FULLNAME || emp?.fullName || emp?.CALLING_NAME || emp?.calling_name || emp?.name || '',
        division_code: selectedSubSection?.parentDivision?.division_code || '',
        division_name: selectedSubSection?.parentDivision?.division_name || '',
        hie_code: selectedSubSection?.parentSection?.hie_code || '',
        hie_name: selectedSubSection?.parentSection?.hie_name || '',
        sub_section_id: selectedSubSection?._id || '',
        sub_hie_code: selectedSubSection?.subSection?.sub_hie_code || selectedSubSection?.subSection?.hie_code || '',
        sub_hie_name: selectedSubSection?.subSection?.sub_hie_name || selectedSubSection?.subSection?.hie_name || '',
        transferredAt: new Date().toISOString(),
        employeeData: emp
      }));

      // Try bulk endpoint first
      let response = await fetch(`${API_BASE_URL}/mysql-subsections/transfer/bulk`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(transfers)
      });

      if (!response.ok) {
        console.warn('Bulk transfer failed, will fallback to single inserts if supported. Status:', response.status);
        // If not ok and status not 404, check 404 or fallback
        if (response.status === 404 || response.status === 501 || response.status === 405) {
          // fallback to sequential single transfers
          const singleResults = [];
          for (const t of transfers) {
            const r = await fetch(`${API_BASE_URL}/mysql-subsections/transfer`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              credentials: 'include',
              body: JSON.stringify(t)
            });
            singleResults.push(r);
          }
          const failed = singleResults.some(r => !r.ok);
          if (failed) throw new Error('One or more single transfers failed in fallback');
        } else {
          // For other failures: attempt fallback too
          const singleResults = [];
          for (const t of transfers) {
            const r = await fetch(`${API_BASE_URL}/mysql-subsections/transfer`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              credentials: 'include',
              body: JSON.stringify(t)
            });
            singleResults.push(r);
          }
          const failed = singleResults.some(r => !r.ok);
          if (failed) throw new Error('One or more single transfers failed in fallback');
        }
      } else {
        // bulk ok
        const bulkResult = await response.json();
        console.log('Bulk transfer result:', bulkResult);
      }

      // Update local state: mark employees as transferred and remove from employeeList
      setTransferredEmployees(prev => {
        const newEntries = transfers.map(t => ({ employeeId: String(t.employeeId), sub_section_id: String(t.sub_section_id) }));
        // Remove duplicates
        const combined = [...prev, ...newEntries];
        const uniq = [];
        const seen = new Set();
        combined.forEach(c => {
          const key = `${c.employeeId}_${c.sub_section_id}`;
          if (!seen.has(key)) { seen.add(key); uniq.push(c); }
        });
        return uniq;
      });

      setEmployeeList(prev => prev.filter(emp => !selectedEmployeeIds.has(String(emp?.EMP_NUMBER || emp?.empNumber || emp?.EMP_ID || emp?.emp_id || ''))));
      setSelectedEmployeeIds(new Set());
      setShowBulkTransferConfirm(false);
      setBulkTransferSubmitting(false);

      showToast({ type: 'success', title: 'Bulk Transfer Completed', message: `${transfers.length} employee${transfers.length !== 1 ? 's were' : ' was'} transferred successfully.` });
      // Refresh authoritative transferred list for this sub-section
      try {
        await fetchTransferredEmployees(selectedSubSection._id, token);
      } catch (e) {
        console.warn('Failed to refresh transfers after bulk operation', e);
      }
    } catch (error) {
      console.error('Bulk transfer failed:', error);
      setShowBulkTransferConfirm(false);
      setBulkTransferSubmitting(false);
      showToast({ type: 'error', title: 'Transfer Failed', message: 'Bulk transfer failed. Check console for details.' });
    }
  };

  // Handle recall button click - show confirmation modal
  const handleRecallTransfer = (emp) => {
    setRecallEmployee(emp);
    setShowRecallConfirm(true);
  };

  // Confirm recall and delete from MongoDB
  const confirmRecallTransfer = async () => {
    if (!canRecallSubsection) {
      setShowRecallConfirm(false);
      setRecallEmployee(null);
      return showToast({ type: 'error', title: 'Permission', message: 'You do not have permission to recall transfers.' });
    }
    if (!recallEmployee || !selectedSubSection) return;

    setRecallSubmitting(true);
    const token = localStorage.getItem('token');
    if (!token) {
      setRecallSubmitting(false);
      setShowRecallConfirm(false);
      return showToast({ type: 'error', title: 'Auth', message: 'Token missing. Please login.' });
    }

  const empId = recallEmployee?.EMP_NUMBER || recallEmployee?.empNumber || recallEmployee?.EMP_ID || recallEmployee?.emp_id;
  const empName = recallEmployee?.FULLNAME || recallEmployee?.fullName || recallEmployee?.CALLING_NAME || recallEmployee?.calling_name || recallEmployee?.name || 'Employee';

    try {
      // Extra debug to validate payload shape
      console.log('RECALL PAYLOAD:', { employeeId: String(empId), sub_section_id: selectedSubSection?._id });
      console.log('🔄 Recalling transfer for:', { empId, sub_section_id: selectedSubSection._id });

      // Provide query params redundantly to handle environments that drop DELETE bodies
      const recallUrl = `${API_BASE_URL}/mysql-subsections/recall-transfer?employeeId=${encodeURIComponent(String(empId))}&sub_section_id=${encodeURIComponent(String(selectedSubSection._id))}`;

      let response = await fetch(recallUrl, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          employeeId: String(empId),
          sub_section_id: selectedSubSection._id
        })
      });

      // If DELETE fails (e.g., body stripped or method blocked), fall back to POST
      if (!response.ok) {
        console.warn('DELETE recall failed, attempting POST fallback...', response.status);
        response = await fetch(`${API_BASE_URL}/mysql-subsections/recall-transfer`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify({
            employeeId: String(empId),
            sub_section_id: selectedSubSection._id
          })
        });
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();

      // Remove from internal transferred IDs cache (only affects session-added transfers)
      setTransferredEmployees(prev => prev.filter(t => !(String(t.employeeId) === String(empId) && String(t.sub_section_id) === String(selectedSubSection._id))));

      // Re-fetch authoritative transferred list to ensure consistency even for legacy entries
      try {
        await fetchTransferredEmployees(selectedSubSection._id, token);
      } catch (e) {
        console.warn('⚠️ Failed to refresh transferred list after recall:', e);
      }

      // If the add-employee modal is open, reinsert the recalled employee (avoid duplicates)
      setEmployeeList(prev => {
        const exists = prev.some(e => String(e?.EMP_NUMBER || e?.empNumber || e?.EMP_ID || '') === String(empId));
        if (exists) return prev; // already present
        return [...prev, recallEmployee];
      });

      // Remove this id from the selected transferred set, if present
      setSelectedTransferredEmployeeIds(prev => {
        const next = new Set(Array.from(prev));
        if (next.has(String(empId))) next.delete(String(empId));
        return next;
      });

      setShowRecallConfirm(false);
      setRecallEmployee(null);
      setRecallSubmitting(false);

      showToast({ 
        type: 'success', 
        title: 'Recalled!', 
        message: `Successfully recalled the transfer for ${empName}!` 
      });

      console.log('✅ Recall successful:', result);

      // Refresh visible transferred employees modal if still open
      if (showTransferredEmployeesModal) {
        await handleShowTransferredEmployees(selectedSubSection);
      }

    } catch (error) {
      console.error('❌ Recall failed:', error);
      setRecallSubmitting(false);
      setShowRecallConfirm(false);
      showToast({ 
        type: 'error', 
        title: 'Recall Failed', 
        message: 'Failed to recall the transfer. Please try again.' 
      });
    }
  };

  const cancelRecall = () => {
    setShowRecallConfirm(false);
    setRecallEmployee(null);
  };

  // Bulk recall confirm
  const confirmBulkRecall = async () => {
    if (!canRecallSubsection) {
      setShowBulkRecallConfirm(false);
      return showToast({ type: 'error', title: 'Permission', message: 'You do not have permission to recall transfers.' });
    }
    if (!selectedSubSection || selectedTransferredEmployeeIds.size === 0) return;
    setBulkRecallSubmitting(true);
    const token = localStorage.getItem('token');
    if (!token) {
      setBulkRecallSubmitting(false);
      setShowBulkRecallConfirm(false);
      return showToast({ type: 'error', title: 'Auth', message: 'Token missing. Please login.' });
    }

    try {
      const employees = Array.from(selectedTransferredEmployeeIds);
      const recalls = employees.map(id => ({ employeeId: String(id), sub_section_id: selectedSubSection._id }));

      // Try bulk recall endpoint first
      let response = await fetch(`${API_BASE_URL}/mysql-subsections/recall-transfer/bulk`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(recalls)
      });

      if (!response.ok) {
        console.warn('Bulk recall failed; falling back to individual recals', response.status);
        // fallback: sequential recalls using existing endpoint
        const results = [];
        for (const r of recalls) {
          const res = await fetch(`${API_BASE_URL}/mysql-subsections/recall-transfer`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(r)
          });
          results.push(res);
        }
        const anyFailed = results.some(r => !r.ok);
        if (anyFailed) throw new Error('One or more individual recalls failed during fallback');
      } else {
        // success bulk
        const bulkResult = await response.json();
        console.log('Bulk recall result:', bulkResult);
      }

      // Remove recalled employees from local array list and global state
      setTransferredEmployeesList(prev => prev.filter(emp => !selectedTransferredEmployeeIds.has(String(emp?.EMP_NUMBER || emp?.empNumber || emp?.EMP_ID || emp?.emp_id || ''))));
      setTransferredEmployees(prev => prev.filter(t => !selectedTransferredEmployeeIds.has(String(t.employeeId || t.employee_id || t.empId || t.emp_id))));
      setSelectedTransferredEmployeeIds(new Set());
      setShowBulkRecallConfirm(false);
      setBulkRecallSubmitting(false);

      showToast({ type: 'success', title: 'Recalled', message: `${employees.length} transfer${employees.length !== 1 ? 's' : ''} recalled successfully` });
      // refresh authoritative transfers for this subsection
      try { await fetchTransferredEmployees(selectedSubSection._id, token); } catch (e) { console.warn('Failed to refresh transferred employees after bulk recall', e); }
    } catch (error) {
      console.error('Bulk recall failed:', error);
      setBulkRecallSubmitting(false);
      setShowBulkRecallConfirm(false);
      showToast({ type: 'error', title: 'Recall Failed', message: 'Bulk recall failed. Check console for details.' });
    }
  };

  const cancelDeleteSubSection = () => {
    setShowDeleteConfirm(false);
    setDeleteTarget(null);
  };

  // Handle showing transferred employees only
  const handleShowTransferredEmployees = async (subSection) => {
    if (!canRecallSubsection) {
      showToast({ type: 'error', title: 'Permission', message: 'You do not have permission to view transferred employees.' });
      return;
    }
    setSelectedSubSection(subSection);
    setShowTransferredEmployeesModal(true);
    setSelectedTransferredEmployeeIds(new Set());
    setTransferredLoading(true);
    setTransferredEmployeesList([]);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token');
      }

      console.log('🔍 Fetching transferred employees for subsection:', subSection._id);

      // Fetch transferred employees from MongoDB
  const response = await fetch(`${API_BASE_URL}/mysql-subsections/transferred/${subSection._id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

  const data = await response.json();
  const transfers = data?.data || [];
      
      console.log('📊 Transferred employees:', transfers);

      // Extract employee data from transfer records
      const employeeDataList = transfers.map(transfer => {
        // Support both Mongo-style 'employeeData' and MySQL 'employee_data'
        const raw = transfer.employeeData ?? transfer.employee_data ?? null;
        if (!raw) return {};
        try {
          // MySQL may return JSON as string; parse if needed
          return typeof raw === 'string' ? JSON.parse(raw) : raw;
        } catch (_) {
          return {};
        }
      });
      
      // Keep only active employees in the transferred list
      const activeEmployeeDataList = employeeDataList.filter(isEmployeeActive);
      console.log('🎯 Active transferred employees:', activeEmployeeDataList.length, '(filtered out:', employeeDataList.length - activeEmployeeDataList.length, ')');
      setTransferredEmployeesList(activeEmployeeDataList);
      setTransferredLoading(false);

    } catch (error) {
      console.error('Error fetching transferred employees:', error);
      setTransferredLoading(false);
      showToast({ 
        type: 'error', 
        title: 'Error', 
        message: 'Failed to fetch transferred employees' 
      });
    }
  };

  const closeTransferredEmployeesModal = () => {
    setShowTransferredEmployeesModal(false);
    setSelectedSubSection(null);
    setTransferredEmployeesList([]);
    setTransferredSearchQuery('');
    setSelectedTransferredEmployeeIds(new Set());
    setShowBulkRecallConfirm(false);
  };

  // Helpers: string normalization and defaults
  const normalizeTextKey = (s) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().toLowerCase() : '');
  const findDefaultDivisionId = (divs = []) => {
    // Priority: code === 'IS' -> name contains 'information system' -> code === 'IT' -> name contains 'information technology'
    const byCodeIS = divs.find(d => String(d.code || '').toLowerCase() === 'is');
    if (byCodeIS) return String(byCodeIS._id);
    const byNameIS = divs.find(d => /information\s*systems?/i.test(String(d.name || '')));
    if (byNameIS) return String(byNameIS._id);
    const byCodeIT = divs.find(d => String(d.code || '').toLowerCase() === 'it');
    if (byCodeIT) return String(byCodeIT._id);
    const byNameIT = divs.find(d => /information\s*technology/i.test(String(d.name || '')));
    if (byNameIT) return String(byNameIT._id);
    return 'all';
  };

  // Helper: determine if an employee object represents an active employee
  const isEmployeeActive = (emp) => {
    // HRIS uses ACTIVE_HRM_FLG === 1, some endpoints use STATUS/status === 'ACTIVE', local objects may have isActive boolean
    return emp?.ACTIVE_HRM_FLG === 1 || emp?.STATUS === 'ACTIVE' || emp?.status === 'ACTIVE' || emp?.isActive === true;
  };

  // Fetch sections and divisions from MySQL sync tables (fallback to HRIS)
  const fetchData = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');

      // Primary: Use fast MySQL sync data (no auth required)
      // Fallback: Use HRIS endpoints (may require auth)
      const [sectionsResponse, divisionsResponse] = await Promise.all([
        // Try MySQL sections first, fallback to HRIS
        fetch(`${API_BASE_URL}/mysql-data/sections`, {
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        }).catch(() => fetch(`${API_BASE_URL}/sections/hris`, {
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        })),
        // Try MySQL divisions first, fallback to HRIS
        fetch(`${API_BASE_URL}/mysql-data/divisions`, {
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        }).catch(() => fetch(`${API_BASE_URL}/divisions/hris`, {
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        }))
      ]);

      let sectionData = [];
      let divisionData = [];
      let divisionMap = {}; // Map of code -> _id

      // 1. Process Divisions First to build the lookup map
      if (divisionsResponse.ok) {
        const dData = await divisionsResponse.json();
        const rows = Array.isArray(dData?.data) ? dData.data : [];
        setRawDivisions(rows);
        
        divisionData = rows.map((d) => {
          const divisionId = String(d?._id ?? d?.id ?? d?.DIVISION_ID ?? d?.code ?? d?.division_code ?? d?.DIVISION_CODE ?? d?.hie_code ?? d?.HIE_CODE ?? '');
          const divisionCode = String(d?.code ?? d?.DIVISION_CODE ?? d?.division_code ?? d?.hie_code ?? d?.HIE_CODE ?? '');
          
          if (divisionCode) divisionMap[divisionCode] = divisionId;
          
          return {
            _id: divisionId,
            name: d?.name ?? d?.division_name ?? d?.DIVISION_NAME ?? d?.hie_name ?? d?.HIE_NAME ?? d?.HIE_NAME_3 ?? `Division ${divisionId}`,
            code: divisionCode,
            isActive: typeof d?.isActive === 'boolean' ? d.isActive : (typeof d?.active === 'boolean' ? d.active : (d?.STATUS === 'ACTIVE')),
            status: d?.status ?? d?.STATUS ?? undefined,
            createdAt: d?.createdAt ?? d?.created_at ?? d?.CREATED_AT ?? d?.createdOn ?? d?.CREATED_ON ?? d?.synced_at ?? null,
            source: d?.source ?? (divisionsResponse.url?.includes('/mysql-data') ? 'MySQL Sync' : 'HRIS'),
            _raw: d,
          };
        }).sort((a, b) => a.name.localeCompare(b.name));
        
        console.log('Division Map (Code -> ID):', Object.keys(divisionMap).length, 'entries');
        setDivisions(divisionData);
        // Default to 'all' to ensure data shows up even if ID mapping is tricky
        setSelectedDivision(prev => prev || 'all');
      }

      // 2. Process Sections using the division map
      if (sectionsResponse.ok) {
        const sData = await sectionsResponse.json();
        const rows = Array.isArray(sData?.data) ? sData.data : [];
        setRawSections(rows);
        
        sectionData = rows.map((s) => {
          // Identify division code from section data
          const divCode = String(s?.division_code ?? s?.DIVISION_CODE ?? s?.HIE_RELATIONSHIP ?? s?.HIE_CODE_3 ?? '');
          
          // Try to resolve division ID from map, fallback to raw division_id field
          const resolvedDivisionId = divCode && divisionMap[divCode] ? divisionMap[divCode] : String(s?.division_id ?? s?.DIVISION_ID ?? divCode ?? '');
          
          const divisionName = s?.division_name ?? s?.DIVISION_NAME ?? s?.parentDivision?.division_name ?? s?.parentDivision?.name ?? '';
          const sectionId = String(s?._id ?? s?.id ?? s?.SECTION_ID ?? s?.code ?? s?.hie_code ?? s?.SECTION_CODE ?? s?.section_code ?? s?.HIE_CODE ?? '');
          
          return {
            _id: sectionId,
            name: s?.name ?? s?.section_name ?? s?.SECTION_NAME ?? s?.hie_name ?? s?.HIE_NAME ?? s?.HIE_NAME_4 ?? s?.hie_relationship ?? `Section ${sectionId}`,
            // IMPORTANT: division field must match the _id used in division filter
            division: divisionName ? { _id: resolvedDivisionId || undefined, name: divisionName } : (resolvedDivisionId || ''),
            code: String(s?.code ?? s?.SECTION_CODE ?? s?.hie_code ?? s?.HIE_CODE ?? s?.section_code ?? ''),
            divisionCode: divCode,
            isActive: typeof s?.isActive === 'boolean' ? s.isActive : (typeof s?.active === 'boolean' ? s.active : (s?.STATUS === 'ACTIVE')),
            status: s?.status ?? s?.STATUS ?? undefined,
            createdAt: s?.createdAt ?? s?.created_at ?? s?.CREATED_AT ?? s?.createdOn ?? s?.CREATED_ON ?? s?.synced_at ?? null,
            source: s?.source ?? (sectionsResponse.url?.includes('/mysql-data') ? 'MySQL Sync' : 'HRIS'),
            _raw: s,
          };
        }).sort((a, b) => a.name.localeCompare(b.name));
        
        setSections(sectionData);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
    }
  }, [API_BASE_URL]);

  // Helper: get division name from id/code or populated object
  const getDivisionName = (divisionRef) => {
    if (typeof divisionRef === 'object' && divisionRef?.name) return divisionRef.name;
    if (!divisionRef) return 'N/A';
    const division = divisions.find(div => String(div._id) === String(divisionRef) || String(div.code) === String(divisionRef));
    return division ? division.name : 'N/A';
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error for this field
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  // Validate form
  const validateForm = () => {
    const errors = {};
    if (!formData.name.trim()) {
      errors.name = 'Section name is required';
    }
    
    if (!formData.division) {
      errors.division = 'Division is required';
    }
    
    console.log('Form validation:', { formData, errors, divisionsCount: divisions.length });
    
    return errors;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    // Front-end permission safeguard (create-only on this view)
    if (!canCreate) {
      alert('You do not have permission to perform this action.');
      return;
    }

    const errors = validateForm();
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        alert('Authentication token not found. Please log in again.');
        setSubmitting(false);
        return;
      }

      // Prepare the data
      const submitData = {
        name: formData.name.trim(),
        division: formData.division,
        code: formData.name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_').slice(0, 10), // Generate valid code from name
        status: 'active'
      };

      console.log('Submitting section data:', submitData);
      console.log('Token available:', !!token);
      console.log('Request URL:', currentSection ? 
        `http://localhost:5000/api/sections/${currentSection._id}` : 
        'http://localhost:5000/api/sections'
      );
      
      if (currentSection) {
        // Update existing section
        const response = await fetch(`http://localhost:5000/api/sections/${currentSection._id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify(submitData)
        });

        console.log('Update response status:', response.status);
        console.log('Update response headers:', Object.fromEntries(response.headers.entries()));

        if (response.ok) {
          const updatedSection = await response.json();
          console.log('Section updated:', updatedSection);
          
          // Refresh data to get updated information
          await fetchData();
          alert('Section updated successfully!');
        } else {
          let errorMessage = 'Unknown error';
          try {
            const errorData = await response.json();
            console.error('Failed to update section:', response.status, errorData);
            
            if (errorData.errors && Array.isArray(errorData.errors)) {
              errorMessage = errorData.errors.map(err => err.message).join(', ');
            } else if (errorData.error) {
              errorMessage = errorData.error;
            } else if (errorData.message) {
              errorMessage = errorData.message;
            }
          } catch (jsonError) {
            console.error('Error parsing response:', jsonError);
            errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          }
          
          alert(`Failed to update section: ${errorMessage}`);
        }
      } else {
        // Add new section
        const response = await fetch('http://localhost:5000/api/sections', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify(submitData)
        });

        console.log('Create response status:', response.status);
        console.log('Create response headers:', Object.fromEntries(response.headers.entries()));

        if (response.ok) {
          const newSection = await response.json();
          console.log('Section created:', newSection);
          
          // Refresh data to get updated information
          await fetchData();
          alert('Section created successfully!');
        } else {
          let errorMessage = 'Unknown error';
          try {
            const errorData = await response.json();
            console.error('Failed to create section:', response.status, errorData);
            
            if (errorData.errors && Array.isArray(errorData.errors)) {
              errorMessage = errorData.errors.map(err => err.message).join(', ');
            } else if (errorData.error) {
              errorMessage = errorData.error;
            } else if (errorData.message) {
              errorMessage = errorData.message;
            }
          } catch (jsonError) {
            console.error('Error parsing response:', jsonError);
            errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          }
          
          alert(`Failed to create section: ${errorMessage}`);
        }
      }
      
      handleCloseModal();
    } catch (error) {
      console.error('Error submitting section:', error);
      alert(`Error ${currentSection ? 'updating' : 'adding'} section. Please try again.`);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle opening edit modal
  // Edit/Delete removed: this view is read-only for sections (only sub-sections can be created/viewed)

  // Handle create sub-section
  const handleCreateSubSection = (section) => {
    setSubParentSection(section);
    setSubForm({ name: '', code: '' });
    setSubErrors({});
    setShowSubModal(true);
  };

  const closeSubModal = () => {
    setShowSubModal(false);
    setSubParentSection(null);
    setSubForm({ name: '', code: '' });
    setSubErrors({});
  };

  const validateSubForm = () => {
    const errs = {};
    if (!subForm.name.trim()) errs.name = 'Sub-section name is required';
    if (!subForm.code.trim()) errs.code = 'Sub-section code is required';
    return errs;
  };

  const submitSubSection = async () => {
    if (!canCreateSubsection) {
      showToast({ type: 'error', title: 'Permission', message: 'You do not have permission to create sub-sections.' });
      return;
    }
    const errs = validateSubForm();
    if (Object.keys(errs).length) { setSubErrors(errs); return; }
    try {
      setSubSubmitting(true);
      const token = localStorage.getItem('token');
      const parent = subParentSection;
      const divId = (typeof parent.division === 'object' && parent.division?._id) ? parent.division._id : String(parent.division || '');
      const division = divisions.find(d => String(d._id) === String(divId)) || {};
      const rawDivision = rawDivisions.find(rd => {
        const id = String(rd?._id ?? rd?.id ?? rd?.DIVISION_ID ?? rd?.code ?? rd?.DIVISION_CODE ?? '');
        return id && String(id) === String(division._id || divId);
      });
      const rawSection = parent._raw || rawSections.find(rs => {
        const sid = String(rs?._id ?? rs?.id ?? rs?.SECTION_ID ?? rs?.code ?? rs?.SECTION_CODE ?? '');
        return sid && String(sid) === String(parent._id);
      });

      const sectionCode = rawSection?.hie_code || rawSection?.SECTION_CODE || rawSection?.code || parent.code || '';
      const divisionCode = rawDivision?.DIVISION_CODE || rawDivision?.division_code || division.code || parent.divisionCode || '';
      
      const payload = {
        parentDivision: {
          id: divisionCode, // Use code instead of _id with mysql prefix
          division_code: divisionCode,
          division_name: rawDivision?.DIVISION_NAME || rawDivision?.division_name || division.name || (typeof parent.division === 'object' ? parent.division?.name : ''),
        },
        parentSection: {
          id: sectionCode, // Use code instead of _id with mysql prefix
          hie_code: sectionCode,
          hie_name: rawSection?.hie_name || rawSection?.SECTION_NAME || rawSection?.name || parent.name || '',
        },
        subSection: {
          sub_hie_name: subForm.name.trim(),
          sub_hie_code: subForm.code.trim(),
        },
        hrisSnapshot: {
          division: rawDivision || null,
          section: rawSection || null,
        },
      };

      console.log('🔍 Subsection Payload:', JSON.stringify(payload, null, 2));

  const resp = await fetch(`${API_BASE_URL}/mysql-subsections`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (resp.ok) {
        // Try to read created item from response for optimistic update
        const createdResp = await resp.json().catch(() => null);
        closeSubModal();
        showToast({ type: 'success', title: 'Success', message: 'Sub-section created successfully.' });
        // Refresh / optimistically update the parent section's sub-sections
        const parentId = subParentSection?._id;
        if (parentId) {
          const key = String(parentId);
          // derive created item from common response shapes
          const createdItem = createdResp?.data ?? createdResp?.created ?? createdResp?.subSection ?? createdResp ?? null;
          if (createdItem) {
            setSubSectionsBySection(prev => ({ ...prev, [key]: [...(prev[key] || []), createdItem] }));
          }
          // ensure authoritative refresh (handles server-side transforms)
          await fetchSubSections(parentId, { force: true });
        }
      } else {
        let msg = 'Failed to create sub-section';
        try { const err = await resp.json(); msg = err?.message || msg; } catch (_) {}
        showToast({ type: 'error', title: 'Request Failed', message: msg });
      }
    } catch (e) {
      console.error('Error creating sub-section:', e);
      showToast({ type: 'error', title: 'Unexpected Error', message: 'Error creating sub-section.' });
    } finally {
      setSubSubmitting(false);
    }
  };

  // Handle opening add modal
  // Add/Edit removed from main UI; modal remains but opening is only via other flows if required.

  // Handle closing modals
  const handleCloseModal = () => {
    setShowAddModal(false);
    setShowEditModal(false);
    setCurrentSection(null);
    setFormData({ name: '', division: '' });
    setFormErrors({});
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

    if (!canView) {
      return (
        <div className="section-management">
          <PageHeader
            title="Section Management"
            subtitle="Manage organizational sections, sub-sections and employee assignments"
            icon="bi-diagram-3"
          />
          <div className="professional-card">
            <div className="no-data">
              <p>You do not have permission to view sections. Contact a Super Admin for access.</p>
            </div>
          </div>
        </div>
      );
    }

  // Derive filtered sections for current selection
  const getSectionDivisionId = (section) => {
    if (!section) return '';
    if (typeof section.division === 'object' && section.division?._id) return String(section.division._id);
    if (typeof section.division === 'string') return String(section.division);
    return '';
  };

  const displayedSections = selectedDivision && selectedDivision !== 'all'
    ? sections.filter(s => {
        const sid = getSectionDivisionId(s);
        if (sid) return String(sid) === String(selectedDivision);
        // Fallback by name if only names are available
        const sNameKey = normalizeTextKey(typeof s.division === 'object' ? s.division?.name : '');
        const selectedName = divisions.find(d => String(d._id) === String(selectedDivision))?.name || '';
        const selKey = normalizeTextKey(selectedName);
        return sNameKey && selKey && sNameKey === selKey;
      })
    : sections;

  // Apply search by section id or section name
  const searchedSections = (() => {
    const q = normalizeTextKey(searchQuery);
    const filtered = !q ? displayedSections : displayedSections.filter(s => {
      const idStr = String(s._id || s.code || s.sectionId || '');
      const nameKey = normalizeTextKey(s.name || '');
      return idStr.includes(q) || nameKey.includes(q);
    });

    // Apply sorting
    const sorted = filtered.slice().sort((a, b) => {
      const getName = (x) => String(x?.name || '').toLowerCase();
      const getIdNum = (x) => {
        const v = x?.code ?? x?.sectionId ?? x?._id ?? '';
        const n = Number(String(v).replace(/[^0-9.-]/g, ''));
        return Number.isFinite(n) ? n : String(v);
      };

      if (sortOption === 'name_asc') return getName(a).localeCompare(getName(b));
      if (sortOption === 'name_desc') return getName(b).localeCompare(getName(a));
      if (sortOption === 'id_asc') {
        const ai = getIdNum(a); const bi = getIdNum(b);
        if (typeof ai === 'number' && typeof bi === 'number') return ai - bi;
        return String(ai).localeCompare(String(bi));
      }
      if (sortOption === 'id_desc') {
        const ai = getIdNum(a); const bi = getIdNum(b);
        if (typeof ai === 'number' && typeof bi === 'number') return bi - ai;
        return String(bi).localeCompare(String(ai));
      }
      return 0;
    });

    return sorted;
  })();

  const handleDivisionSelect = (e) => setSelectedDivision(e.target.value);

  return (
    <div className="section-management">
      {/* Toast Styles and Component */}
      <style>{`
        @keyframes toast-slide-in { from { transform: translateY(-12px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        @keyframes toast-progress { from { width: 100% } to { width: 0 } }
      `}</style>
      {toast.show && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            top: 20,
            right: 20,
            zIndex: 12000,
          }}
        >
          <div
            style={{
              minWidth: 320,
              maxWidth: 420,
              background: '#111827',
              color: 'white',
              borderRadius: 12,
              boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
              padding: 14,
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
              animation: 'toast-slide-in 200ms ease-out',
              borderLeft: `6px solid ${toast.type === 'success' ? '#10b981' : toast.type === 'warning' ? '#f59e0b' : '#ef4444'}`,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: toast.type === 'success' ? 'rgba(16,185,129,0.18)' : toast.type === 'warning' ? 'rgba(245,158,11,0.18)' : 'rgba(239,68,68,0.18)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: toast.type === 'success' ? '#34d399' : toast.type === 'warning' ? '#fbbf24' : '#f87171',
                flexShrink: 0,
              }}
            >
              <i className={`bi ${toast.type === 'success' ? 'bi-check2-circle' : toast.type === 'warning' ? 'bi-exclamation-triangle' : 'bi-x-circle'}`} style={{ fontSize: 18 }}></i>
            </div>
            <div style={{ flex: 1 }}>
              {toast.title ? (
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{toast.title}</div>
              ) : null}
              <div style={{ fontSize: 14, opacity: 0.95 }}>{toast.message}</div>
              <div
                style={{
                  height: 3,
                  background: 'rgba(255,255,255,0.2)',
                  borderRadius: 2,
                  marginTop: 10,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    background: toast.type === 'success' ? '#34d399' : toast.type === 'warning' ? '#fbbf24' : '#f87171',
                    animation: 'toast-progress 3s linear forwards',
                  }}
                />
              </div>
            </div>
            <button
              onClick={hideToast}
              aria-label="Close notification"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(255,255,255,0.8)',
                cursor: 'pointer',
                padding: 6,
                borderRadius: 6,
                alignSelf: 'center',
              }}
            >
              <i className="bi bi-x-lg"></i>
            </button>
          </div>
        </div>
      )}

      {/* Bulk Transfer Confirmation Modal */}
      {showBulkTransferConfirm && selectedSubSection && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10001,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            maxWidth: '700px',
            width: '100%',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            overflow: 'hidden'
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              padding: '20px 28px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <i className="bi bi-people-fill" style={{ fontSize: '22px', color: 'white' }}></i>
              <h3 style={{ margin: 0, color: 'white', fontSize: '18px', fontWeight: '600' }}>
                Confirm Bulk Transfer ({selectedEmployeeIds.size} selected)
              </h3>
            </div>
            <div style={{ padding: '24px' }}>
              <p style={{ fontSize: '14px', color: '#374151', marginBottom: '12px' }}>
                You're about to transfer <strong>{selectedEmployeeIds.size}</strong> employee{selectedEmployeeIds.size !== 1 ? 's' : ''} to:
              </p>
              <div style={{ padding: '12px 16px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '600' }}>{selectedSubSection?.subSection?.sub_hie_name || selectedSubSection?.subSection?.hie_name || 'N/A'}</div>
                <div style={{ fontSize: '13px', color: '#6b7280' }}>{selectedSubSection?.parentSection?.hie_name || 'Section: N/A'}</div>
                <div style={{ fontSize: '13px', color: '#6b7280' }}>{selectedSubSection?.parentDivision?.division_name || 'Division: N/A'}</div>
              </div>
              <div style={{ marginTop: '18px' }}>
                <strong style={{ color: '#374151' }}>Selected employees preview:</strong>
                <div style={{ marginTop: '8px', maxHeight: '160px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px' }}>
                  {Array.from(selectedEmployeeIds).slice(0, 10).map((id, idx) => {
                    const emp = employeeList.find(e => String(e?.EMP_NUMBER || e?.empNumber || e?.EMP_ID || e?.emp_id || '') === id);
                    const name = emp?.FULLNAME || emp?.fullName || emp?.CALLING_NAME || emp?.calling_name || emp?.name || id;
                    return (
                      <div key={id + idx} style={{ padding: '6px 8px', borderBottom: '1px dashed #e5e7eb', fontSize: '13px' }}>{id} - {name}</div>
                    );
                  })}
                  {selectedEmployeeIds.size > 10 && (
                    <div style={{ padding: '6px 8px', color: '#6b7280', fontSize: '13px' }}>+ {selectedEmployeeIds.size - 10} more...</div>
                  )}
                </div>
              </div>
            </div>
            <div style={{ padding: '20px 28px', borderTop: '1px solid #e5e7eb', background: '#f9fafb', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => setShowBulkTransferConfirm(false)}
                disabled={bulkTransferSubmitting}
                style={{
                  padding: '10px 20px',
                  border: '2px solid #d1d5db',
                  borderRadius: '8px',
                  backgroundColor: 'white',
                  color: '#6b7280',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: bulkTransferSubmitting ? 'not-allowed' : 'pointer'
                }}
              >Cancel</button>
              <button
                onClick={confirmBulkTransfer}
                disabled={bulkTransferSubmitting}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '8px',
                  background: bulkTransferSubmitting ? '#9ca3af' : 'linear-gradient(135deg, #10b981, #059669)',
                  color: 'white',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: bulkTransferSubmitting ? 'not-allowed' : 'pointer'
                }}
              >
                {bulkTransferSubmitting ? 'Transferring...' : `Confirm (${selectedEmployeeIds.size})`}
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .modal-overlay {
          backdrop-filter: blur(2px);
        }
      `}</style>
      {/* Professional Header with Logo */}
      <PageHeader
        title="Section Management"
        subtitle="Manage organizational sections, sub-sections and employee assignments"
        icon="bi-diagram-3"
        onBack={onBack}
      />

      {/* Unified Filter & Search Section */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#fff',
        borderRadius: '16px',
        boxShadow: '0 2px 12px rgba(102,126,234,0.07)',
        padding: '28px 32px',
        marginBottom: '28px',
        gap: '32px',
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flex: 1, minWidth: 320 }}>
          <label htmlFor="divisionFilter" className="form-label m-0" style={{ fontWeight: 600, color: '#374151', fontSize: '16px' }}>
            Filter by Division:
          </label>
          {(() => {
            // Build counts per division based on normalized sections
            const divisionCounts = new Map();
            const nameToId = new Map(divisions.map(d => [normalizeTextKey(d.name || ''), String(d._id)]));
            sections.forEach(s => {
              let did = getSectionDivisionId(s);
              if (!did) {
                const sName = typeof s.division === 'object' ? s.division?.name : '';
                const mapped = nameToId.get(normalizeTextKey(sName || ''));
                if (mapped) did = mapped;
              }
              if (did) divisionCounts.set(String(did), (divisionCounts.get(String(did)) || 0) + 1);
            });
            const renderCount = (id) => divisionCounts.get(String(id)) || 0;
            return (
              <select
                id="divisionFilter"
                className="form-select"
                value={selectedDivision || 'all'}
                onChange={handleDivisionSelect}
                style={{
                  minWidth: '260px',
                  fontSize: '15px',
                  borderRadius: '8px',
                  border: '2px solid #e0e7ff',
                  background: '#f8fafc',
                  color: '#374151',
                  fontWeight: 500,
                  boxShadow: '0 1px 4px rgba(102,126,234,0.04)',
                  padding: '10px 18px',
                  outline: 'none',
                  transition: 'border 0.2s',
                }}
              >
                <option value="all">All Divisions ({sections.length} sections)</option>
                {divisions.map(d => (
                  <option key={d._id} value={d._id}>{d.name} ({renderCount(d._id)})</option>
                ))}
              </select>
            );
          })()}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 320, justifyContent: 'flex-end' }}>
          <label htmlFor="sectionSearch" className="form-label m-0" style={{ fontWeight: 600, color: '#374151', fontSize: '16px' }}>
            Search:
          </label>
          <select
            id="sectionSort"
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value)}
            style={{
              fontSize: '14px',
              borderRadius: '8px',
              border: '2px solid #e0e7ff',
              background: '#fff',
              color: '#374151',
              fontWeight: 600,
              boxShadow: '0 1px 4px rgba(102,126,234,0.04)',
              padding: '8px 12px',
              outline: 'none',
              marginRight: '8px'
            }}
          >
            <option value="name_asc">Name A → Z</option>
            <option value="name_desc">Name Z → A</option>
            <option value="id_asc">ID Small → High</option>
            <option value="id_desc">ID High → Small</option>
          </select>

          <input
            id="sectionSearch"
            type="text"
            className="form-control"
            placeholder="Search by Section ID or Name"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              maxWidth: '320px',
              fontSize: '15px',
              borderRadius: '8px',
              border: '2px solid #e0e7ff',
              background: '#f8fafc',
              color: '#374151',
              fontWeight: 500,
              boxShadow: '0 1px 4px rgba(102,126,234,0.04)',
              padding: '10px 18px',
              outline: 'none',
              transition: 'border 0.2s',
            }}
          />
        </div>
      </div>

      {/* Professional Sections Table */}
      <div className="professional-card">
        <div className="table-responsive">
          <table className="professional-table">
            <thead>
              <tr>
                <th>Section Name</th>
                <th>Division</th>
                <th>Sub Section</th>
              </tr>
            </thead>
            <tbody>
              {searchedSections.map(section => (
                <tr key={section._id} className="section-row section-card">
  
                  <td data-label="Section Name" style={{ minWidth: 320 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>{section.name}</div>
                      <div style={{ color: '#6b7280', fontSize: '13px' }}>{String(section.code || '').toUpperCase()}</div>
                    </div>
                  </td>

                  <td data-label="Division" style={{ width: 260 }}>
                    <span className="role-badge">
                      {getDivisionName(section.division)}
                    </span>
                  </td>

                  <td data-label="Sub Section">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                      <div className="sub-count">{(subSectionsBySection[section._id]?.length ?? 0)} sub-section{( (subSectionsBySection[section._id]?.length ?? 0) !== 1 ? 's' : '' )}</div>
                      <div className="sub-actions">
                        <button 
                          className="btn-professional btn-success"
                          onClick={canCreateSubsection ? () => handleCreateSubSection(section) : undefined}
                          title={!canCreateSubsection ? 'No permission to create sub sections' : 'Create Sub-Section'}
                          disabled={!canCreateSubsection}
                          style={{ padding: '8px 12px', fontSize: '12px', cursor: canCreateSubsection ? 'pointer' : 'not-allowed' }}
                        >
                          <i className="bi bi-plus"></i>
                        </button>
                        {canViewSubsections ? (
                          <button 
                            className="btn-professional btn-light"
                            onClick={() => toggleSubSections(section)}
                            title="View Sub-Sections"
                            style={{ padding: '8px 12px', fontSize: '12px' }}
                          >
                            <i className="bi bi-chevron-right"></i>
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {sections.length === 0 && (
          <div className="no-data">
            <p>No sections found.</p>
          </div>
        )}
      </div>

      {/* Add/Edit Section Modal */}
      {(showAddModal || showEditModal) && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content professional-form" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ borderBottom: '2px solid var(--gray-200)', paddingBottom: '20px', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--gray-900)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <i className={`bi ${currentSection ? "bi-pencil-square" : "bi-plus-circle"}`} style={{ color: 'var(--primary)' }}></i>
                {currentSection ? 'Edit Section' : 'Add New Section'}
              </h3>
              <button 
                className="modal-close btn-professional btn-danger"
                onClick={handleCloseModal}
                style={{ padding: '8px 12px', fontSize: '16px' }}
              >
                <i className="bi bi-x"></i>
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="modal-body">
              <div className="form-group">
                <label className="form-label">Section Name *</label>
                <input
                  type="text"
                  name="name"
                  className={`form-input ${formErrors.name ? 'error' : ''}`}
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Enter section name"
                  required
                />
                {formErrors.name && <span className="error-text">{formErrors.name}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">Division *</label>
                <select
                  name="division"
                  className={`form-select ${formErrors.division ? 'error' : ''}`}
                  value={formData.division}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Select Division</option>
                  {divisions.map(division => (
                    <option key={division._id} value={division._id}>
                      {division.name} ({division.code})
                    </option>
                  ))}
                </select>
                {formErrors.division && <span className="error-text">{formErrors.division}</span>}
              </div>

              <div className="modal-footer" style={{ borderTop: '2px solid var(--gray-200)', paddingTop: '20px', marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button 
                  type="button"
                  className="btn-professional btn-secondary"
                  onClick={handleCloseModal}
                  disabled={submitting}
                  style={{ background: 'var(--gray-500)' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="btn-professional btn-success"
                  disabled={submitting || !canCreate}
                  aria-disabled={submitting || !canCreate}
                  title={!canCreate ? 'You do not have permission to perform this action' : ''}
                >
                  <i className={`bi ${currentSection ? "bi-check-circle" : "bi-plus-circle"}`}></i>
                  {submitting ? (
                    currentSection ? 'Updating...' : 'Adding...'
                  ) : (
                    currentSection ? 'Update Section' : 'Add Section'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Sub-Section Modal */}
      {showSubModal && subParentSection && (
        <div 
          className="modal-overlay" 
          onClick={closeSubModal}
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            width: '100%', 
            height: '100%', 
            backgroundColor: 'rgba(0, 0, 0, 0.6)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 1050,
            backdropFilter: 'blur(2px)',
            padding: '20px',
            boxSizing: 'border-box'
          }}
        >
          <div 
            className="modal-content" 
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#fff',
              borderRadius: '16px',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)',
              width: '100%',
              maxWidth: '950px',
              maxHeight: 'calc(100vh - 40px)',
              position: 'relative',
              border: 'none',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Enhanced Header */}
            <div 
              style={{ 
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                padding: '24px 32px 20px',
                borderRadius: '16px 16px 0 0',
                position: 'relative',
                overflow: 'hidden',
                flexShrink: 0
              }}
            >
              <div style={{ position: 'relative', zIndex: 2 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div 
                      style={{ 
                        backgroundColor: 'rgba(255, 255, 255, 0.2)', 
                        borderRadius: '12px', 
                        padding: '12px',
                        backdropFilter: 'blur(10px)'
                      }}
                    >
                      <i className="bi bi-diagram-3-fill" style={{ fontSize: '24px', color: 'white' }}></i>
                    </div>
                    <div>
                      <h3 style={{ 
                        margin: 0, 
                        fontSize: '22px', 
                        fontWeight: '700', 
                        letterSpacing: '-0.5px',
                        textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                      }}>
                        Create Sub-Section
                      </h3>
                      <p style={{ 
                        margin: '4px 0 0', 
                        fontSize: '14px', 
                        opacity: 0.9,
                        fontWeight: '400'
                      }}>
                        Add a new sub-division to organize your structure
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={closeSubModal}
                    style={{ 
                      background: 'rgba(255, 255, 255, 0.2)',
                      border: 'none',
                      borderRadius: '8px',
                      color: 'white',
                      cursor: 'pointer',
                      padding: '8px',
                      fontSize: '20px',
                      transition: 'all 0.2s ease',
                      backdropFilter: 'blur(10px)'
                    }}
                    onMouseOver={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.3)'}
                    onMouseOut={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.2)'}
                  >
                    <i className="bi bi-x-lg"></i>
                  </button>
                </div>
              </div>
              <div 
                style={{
                  position: 'absolute',
                  top: '-50%',
                  right: '-10%',
                  width: '200px',
                  height: '200px',
                  background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
                  borderRadius: '50%'
                }}
              ></div>
            </div>

            {/* Enhanced Body */}
            <div style={{ 
              padding: '24px 32px', 
              flex: 1,
              overflowY: 'auto',
              minHeight: 0
            }}>
              {/* Active Filters Display */}
              <div style={{
                background: 'linear-gradient(135deg, #667eea15 0%, #764ba215 100%)',
                border: '2px solid #667eea',
                borderRadius: '8px',
                padding: '16px 20px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <i className="bi bi-funnel-fill" style={{ color: '#667eea', fontSize: '20px' }}></i>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '600', color: '#495057', marginBottom: '4px' }}>Parent Structure:</div>
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <span style={{
                      background: '#667eea',
                      color: 'white',
                      padding: '4px 12px',
                      borderRadius: '20px',
                      fontSize: '13px',
                      fontWeight: '500'
                    }}>
                      {divisions.find(d => String(d._id) === String((typeof subParentSection.division === 'object' && subParentSection.division?._id) ? subParentSection.division._id : String(subParentSection.division || '')))?.name || (typeof subParentSection.division === 'object' ? subParentSection.division?.name : '') || 'N/A'}
                    </span>
                    <i className="bi bi-chevron-right" style={{ color: '#667eea' }}></i>
                    <span style={{
                      background: '#764ba2',
                      color: 'white',
                      padding: '4px 12px',
                      borderRadius: '20px',
                      fontSize: '13px',
                      fontWeight: '500'
                    }}>
                      {subParentSection.name || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* New Sub-Section Details */}
              <div style={{ 
                backgroundColor: 'white',
                borderRadius: '10px',
                border: '2px solid #e1e5f2',
                padding: '20px'
              }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '10px', 
                  marginBottom: '18px' 
                }}>
                  <i className="bi bi-plus-circle-fill" style={{ color: '#10b981', fontSize: '16px' }}></i>
                  <h4 style={{ 
                    margin: 0, 
                    fontSize: '15px', 
                    fontWeight: '600', 
                    color: '#374151' 
                  }}>
                    New Sub-Section Details
                  </h4>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
                  <div>
                    <label style={{ 
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '14px', 
                      fontWeight: '600', 
                      color: '#374151', 
                      marginBottom: '10px'
                    }}>
                      <i className="bi bi-type" style={{ color: '#667eea' }}></i>
                      Sub-Section Name
                      <span style={{ color: '#ef4444', fontSize: '14px' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={subForm.name}
                      onChange={(e) => setSubForm({ ...subForm, name: e.target.value })}
                      placeholder="Enter a descriptive name for the sub-section"
                      style={{
                        width: '100%',
                        padding: '14px',
                        border: subErrors.name ? '2px solid #ef4444' : '2px solid #e5e7eb',
                        borderRadius: '8px',
                        fontSize: '14px',
                        transition: 'all 0.2s ease',
                        backgroundColor: '#fff',
                        fontFamily: 'inherit',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                      onFocus={(e) => {
                        if (!subErrors.name) e.target.style.borderColor = '#667eea';
                        e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
                      }}
                      onBlur={(e) => {
                        if (!subErrors.name) e.target.style.borderColor = '#e5e7eb';
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                    {subErrors.name && (
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '6px', 
                        color: '#ef4444', 
                        fontSize: '13px', 
                        marginTop: '8px',
                        fontWeight: '500'
                      }}>
                        <i className="bi bi-exclamation-circle-fill"></i>
                        {subErrors.name}
                      </div>
                    )}
                  </div>

                  <div>
                    <label style={{ 
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '14px', 
                      fontWeight: '600', 
                      color: '#374151', 
                      marginBottom: '10px'
                    }}>
                      <i className="bi bi-hash" style={{ color: '#667eea' }}></i>
                      Sub-Section Code/ID
                      <span style={{ color: '#ef4444', fontSize: '14px' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={subForm.code}
                      onChange={(e) => setSubForm({ ...subForm, code: e.target.value })}
                      placeholder="e.g., SS-001"
                      style={{
                        width: '100%',
                        padding: '14px',
                        border: subErrors.code ? '2px solid #ef4444' : '2px solid #e5e7eb',
                        borderRadius: '8px',
                        fontSize: '14px',
                        transition: 'all 0.2s ease',
                        backgroundColor: '#fff',
                        fontFamily: 'inherit',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                      onFocus={(e) => {
                        if (!subErrors.code) e.target.style.borderColor = '#667eea';
                        e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
                      }}
                      onBlur={(e) => {
                        if (!subErrors.code) e.target.style.borderColor = '#e5e7eb';
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                    {subErrors.code && (
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '6px', 
                        color: '#ef4444', 
                        fontSize: '13px', 
                        marginTop: '8px',
                        fontWeight: '500'
                      }}>
                        <i className="bi bi-exclamation-circle-fill"></i>
                        {subErrors.code}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Enhanced Footer */}
            <div style={{ 
              padding: '16px 32px 20px',
              borderTop: '1px solid #f3f4f6',
              backgroundColor: '#fafafa',
              display: 'flex', 
              gap: '12px', 
              justifyContent: 'flex-end',
              borderRadius: '0 0 16px 16px',
              flexShrink: 0
            }}>
              <button 
                onClick={closeSubModal} 
                disabled={subSubmitting}
                style={{
                  padding: '12px 24px',
                  border: '2px solid #d1d5db',
                  borderRadius: '8px',
                  backgroundColor: 'white',
                  color: '#6b7280',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: subSubmitting ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  opacity: subSubmitting ? 0.6 : 1
                }}
                onMouseOver={(e) => {
                  if (!subSubmitting) {
                    e.target.style.borderColor = '#9ca3af';
                    e.target.style.color = '#374151';
                  }
                }}
                onMouseOut={(e) => {
                  if (!subSubmitting) {
                    e.target.style.borderColor = '#d1d5db';
                    e.target.style.color = '#6b7280';
                  }
                }}
              >
                <i className="bi bi-x-circle" style={{ marginRight: '6px' }}></i>
                Cancel
              </button>
              <button 
                onClick={submitSubSection} 
                disabled={subSubmitting}
                style={{
                  padding: '12px 24px',
                  border: 'none',
                  borderRadius: '8px',
                  background: subSubmitting 
                    ? 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)'
                    : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: subSubmitting ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: subSubmitting ? 'none' : '0 3px 10px rgba(16, 185, 129, 0.3)'
                }}
                onMouseOver={(e) => {
                  if (!subSubmitting) {
                    e.target.style.transform = 'translateY(-1px)';
                    e.target.style.boxShadow = '0 4px 15px rgba(16, 185, 129, 0.4)';
                  }
                }}
                onMouseOut={(e) => {
                  if (!subSubmitting) {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 3px 10px rgba(16, 185, 129, 0.3)';
                  }
                }}
              >
                <i className={`bi ${subSubmitting ? 'bi-arrow-repeat' : 'bi-check-circle'}`} 
                   style={{ 
                     marginRight: '8px',
                     animation: subSubmitting ? 'spin 1s linear infinite' : 'none'
                   }}></i>
                {subSubmitting ? 'Creating...' : 'Create Sub-Section'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Sub-Section Modal */}
      {showEditSubModal && editingSubSection && (
        <div 
          className="modal-overlay" 
          onClick={closeEditSubModal}
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            width: '100%', 
            height: '100%', 
            backgroundColor: 'rgba(0, 0, 0, 0.6)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 11500,
            backdropFilter: 'blur(2px)',
            padding: '20px',
            boxSizing: 'border-box'
          }}
        >
          <div 
            className="modal-content" 
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#fff',
              borderRadius: '16px',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)',
              width: '100%',
              maxWidth: '950px',
              maxHeight: 'calc(100vh - 40px)',
              position: 'relative',
              border: 'none',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Enhanced Header */}
            <div 
              style={{ 
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                padding: '24px 32px 20px',
                borderRadius: '16px 16px 0 0',
                position: 'relative',
                overflow: 'hidden',
                flexShrink: 0
              }}
            >
              <div style={{ position: 'relative', zIndex: 2 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div 
                      style={{ 
                        backgroundColor: 'rgba(255, 255, 255, 0.2)', 
                        borderRadius: '12px', 
                        padding: '12px',
                        backdropFilter: 'blur(10px)'
                      }}
                    >
                      <i className="bi bi-pencil-square" style={{ fontSize: '24px', color: 'white' }}></i>
                    </div>
                    <div>
                      <h3 style={{ 
                        margin: 0, 
                        fontSize: '22px', 
                        fontWeight: '700', 
                        letterSpacing: '-0.5px',
                        textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                      }}>
                        Edit Sub-Section
                      </h3>
                      <p style={{ 
                        margin: '4px 0 0', 
                        fontSize: '14px', 
                        opacity: 0.9,
                        fontWeight: '400'
                      }}>
                        Modify the sub-section details
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={closeEditSubModal}
                    disabled={editSubSubmitting}
                    style={{ 
                      background: 'rgba(255, 255, 255, 0.2)',
                      border: 'none',
                      borderRadius: '8px',
                      color: 'white',
                      cursor: editSubSubmitting ? 'not-allowed' : 'pointer',
                      padding: '8px',
                      fontSize: '20px',
                      transition: 'all 0.2s ease',
                      backdropFilter: 'blur(10px)',
                      opacity: editSubSubmitting ? 0.5 : 1
                    }}
                    onMouseOver={(e) => {
                      if (!editSubSubmitting) e.target.style.background = 'rgba(255, 255, 255, 0.3)';
                    }}
                    onMouseOut={(e) => {
                      if (!editSubSubmitting) e.target.style.background = 'rgba(255, 255, 255, 0.2)';
                    }}
                  >
                    <i className="bi bi-x-lg"></i>
                  </button>
                </div>
              </div>
              <div 
                style={{
                  position: 'absolute',
                  top: '-50%',
                  right: '-10%',
                  width: '200px',
                  height: '200px',
                  background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
                  borderRadius: '50%'
                }}
              ></div>
            </div>

            {/* Enhanced Body */}
            <div style={{ 
              padding: '24px 32px', 
              flex: 1,
              overflowY: 'auto',
              minHeight: 0
            }}>
              {/* Active Filters Display */}
              <div style={{
                background: 'linear-gradient(135deg, #667eea15 0%, #764ba215 100%)',
                border: '2px solid #667eea',
                borderRadius: '8px',
                padding: '16px 20px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <i className="bi bi-funnel-fill" style={{ color: '#667eea', fontSize: '20px' }}></i>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '600', color: '#495057', marginBottom: '4px' }}>Parent Structure:</div>
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <span style={{
                      background: '#667eea',
                      color: 'white',
                      padding: '4px 12px',
                      borderRadius: '20px',
                      fontSize: '13px',
                      fontWeight: '500'
                    }}>
                      {editingSubSection?.parentDivision || 'N/A'}
                    </span>
                    <i className="bi bi-chevron-right" style={{ color: '#667eea' }}></i>
                    <span style={{
                      background: '#764ba2',
                      color: 'white',
                      padding: '4px 12px',
                      borderRadius: '20px',
                      fontSize: '13px',
                      fontWeight: '500'
                    }}>
                      {editingSubSection?.parentSection || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Edit Sub-Section Details */}
              <div style={{ 
                backgroundColor: 'white',
                borderRadius: '10px',
                border: '2px solid #e1e5f2',
                padding: '20px'
              }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '10px', 
                  marginBottom: '18px' 
                }}>
                  <i className="bi bi-pencil-fill" style={{ color: '#667eea', fontSize: '16px' }}></i>
                  <h4 style={{ 
                    margin: 0, 
                    fontSize: '15px', 
                    fontWeight: '600', 
                    color: '#374151' 
                  }}>
                    Edit Sub-Section Details
                  </h4>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
                  <div>
                    <label style={{ 
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '14px', 
                      fontWeight: '600', 
                      color: '#374151', 
                      marginBottom: '10px'
                    }}>
                      <i className="bi bi-type" style={{ color: '#667eea' }}></i>
                      Sub-Section Name
                      <span style={{ color: '#ef4444', fontSize: '14px' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={editSubForm.name}
                      onChange={(e) => {
                        setEditSubForm({ ...editSubForm, name: e.target.value });
                        if (editSubErrors.name) setEditSubErrors({ ...editSubErrors, name: '' });
                      }}
                      placeholder="Enter a descriptive name for the sub-section"
                      disabled={editSubSubmitting}
                      style={{
                        width: '100%',
                        padding: '14px',
                        border: editSubErrors.name ? '2px solid #ef4444' : '2px solid #e5e7eb',
                        borderRadius: '8px',
                        fontSize: '14px',
                        transition: 'all 0.2s ease',
                        backgroundColor: editSubSubmitting ? '#f3f4f6' : '#fff',
                        fontFamily: 'inherit',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                      onFocus={(e) => {
                        if (!editSubErrors.name && !editSubSubmitting) {
                          e.target.style.borderColor = '#667eea';
                          e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
                        }
                      }}
                      onBlur={(e) => {
                        if (!editSubErrors.name) e.target.style.borderColor = '#e5e7eb';
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                    {editSubErrors.name && (
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '6px', 
                        color: '#ef4444', 
                        fontSize: '13px', 
                        marginTop: '8px',
                        fontWeight: '500'
                      }}>
                        <i className="bi bi-exclamation-circle-fill"></i>
                        {editSubErrors.name}
                      </div>
                    )}
                  </div>

                  <div>
                    <label style={{ 
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '14px', 
                      fontWeight: '600', 
                      color: '#374151', 
                      marginBottom: '10px'
                    }}>
                      <i className="bi bi-hash" style={{ color: '#667eea' }}></i>
                      Sub-Section Code/ID
                      <span style={{ color: '#ef4444', fontSize: '14px' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={editSubForm.code}
                      onChange={(e) => {
                        setEditSubForm({ ...editSubForm, code: e.target.value });
                        if (editSubErrors.code) setEditSubErrors({ ...editSubErrors, code: '' });
                      }}
                      placeholder="e.g., SS-001"
                      disabled={editSubSubmitting}
                      style={{
                        width: '100%',
                        padding: '14px',
                        border: editSubErrors.code ? '2px solid #ef4444' : '2px solid #e5e7eb',
                        borderRadius: '8px',
                        fontSize: '14px',
                        transition: 'all 0.2s ease',
                        backgroundColor: editSubSubmitting ? '#f3f4f6' : '#fff',
                        fontFamily: 'inherit',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                      onFocus={(e) => {
                        if (!editSubErrors.code && !editSubSubmitting) {
                          e.target.style.borderColor = '#667eea';
                          e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
                        }
                      }}
                      onBlur={(e) => {
                        if (!editSubErrors.code) e.target.style.borderColor = '#e5e7eb';
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                    {editSubErrors.code && (
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '6px', 
                        color: '#ef4444', 
                        fontSize: '13px', 
                        marginTop: '8px',
                        fontWeight: '500'
                      }}>
                        <i className="bi bi-exclamation-circle-fill"></i>
                        {editSubErrors.code}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ 
              padding: '16px 32px',
              borderTop: '1px solid #e5e7eb',
              backgroundColor: '#f9fafb',
              display: 'flex', 
              gap: '10px', 
              justifyContent: 'flex-end',
              borderRadius: '0 0 16px 16px',
              flexShrink: 0
            }}>
              <button 
                onClick={closeEditSubModal} 
                disabled={editSubSubmitting}
                style={{
                  padding: '10px 20px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  backgroundColor: 'white',
                  color: '#6b7280',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: editSubSubmitting ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  opacity: editSubSubmitting ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                onMouseOver={(e) => {
                  if (!editSubSubmitting) {
                    e.target.style.borderColor = '#9ca3af';
                    e.target.style.color = '#374151';
                    e.target.style.transform = 'translateY(-1px)';
                    e.target.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
                  }
                }}
                onMouseOut={(e) => {
                  if (!editSubSubmitting) {
                    e.target.style.borderColor = '#d1d5db';
                    e.target.style.color = '#6b7280';
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = 'none';
                  }
                }}
              >
                <i className="bi bi-x-circle" style={{ fontSize: '14px' }}></i>
                Cancel
              </button>
              <button 
                onClick={submitEditSubSection} 
                disabled={editSubSubmitting}
                style={{
                  padding: '10px 24px',
                  border: 'none',
                  borderRadius: '8px',
                  background: editSubSubmitting 
                    ? 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)'
                    : 'linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #60a5fa 100%)',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: editSubSubmitting ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: editSubSubmitting ? 'none' : '0 3px 10px rgba(59, 130, 246, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onMouseOver={(e) => {
                  if (!editSubSubmitting) {
                    e.target.style.transform = 'translateY(-1px)';
                    e.target.style.boxShadow = '0 4px 15px rgba(59, 130, 246, 0.5)';
                  }
                }}
                onMouseOut={(e) => {
                  if (!editSubSubmitting) {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 3px 10px rgba(59, 130, 246, 0.4)';
                  }
                }}
              >
                <i className={`bi ${editSubSubmitting ? 'bi-arrow-repeat' : 'bi-check-circle-fill'}`} 
                   style={{ 
                     fontSize: '14px',
                     animation: editSubSubmitting ? 'spin 1s linear infinite' : 'none'
                   }}></i>
                {editSubSubmitting ? 'Updating...' : 'Update Sub-Section'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Sections Popup Modal */}
      {showSubSectionsModal && currentSectionForSubSections && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px'
          }}
          onClick={handleCloseSubSectionsModal}
        >
          <div 
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              width: '95%',
              maxWidth: '1400px',
              height: '90vh',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              padding: '24px 32px',
              borderBottom: '2px solid #e5e7eb',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0
            }}>
              <h3 style={{ 
                fontSize: '24px', 
                fontWeight: '700', 
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <i className="bi bi-layers"></i>
                Sub-Sections
              </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {canCreateSubsection ? (
                <button
                  onClick={() => {
                    setShowSubSectionsModal(false); // Close the Sub-Sections modal first
                    setTimeout(() => {
                      setSubParentSection(currentSectionForSubSections);
                      setSubForm({ name: '', code: '' });
                      setSubErrors({});
                      setShowSubModal(true);
                    }, 250); // Wait for modal close animation (if any)
                  }}
                  style={{
                    background: '#fff',
                    color: '#764ba2',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '15px',
                    padding: '8px 18px',
                    marginRight: '8px',
                    boxShadow: '0 2px 8px rgba(102, 126, 234, 0.08)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '7px',
                    transition: 'background 0.2s, color 0.2s',
                  }}
                  title="Add Subsection"
                >
                  <i className="bi bi-plus-circle"></i> Add Subsection
                </button>
                ) : null}
                <button 
                  onClick={handleCloseSubSectionsModal}
                  style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '20px',
                    width: '40px',
                    height: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseOver={(e) => {
                    e.target.style.background = 'rgba(255, 255, 255, 0.3)';
                  }}
                  onMouseOut={(e) => {
                    e.target.style.background = 'rgba(255, 255, 255, 0.2)';
                  }}
                >
                  <i className="bi bi-x"></i>
                </button>
              </div>
            </div>

            {/* Parent Section & Division Info - Active Filters Style */}
            <div style={{
              background: 'linear-gradient(135deg, #667eea15 0%, #764ba215 100%)',
              border: '2px solid #667eea',
              borderRadius: '8px',
              padding: '16px 20px',
              margin: '16px 32px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              flexShrink: 0
            }}>
              <i className="bi bi-funnel-fill" style={{ color: '#667eea', fontSize: '20px' }}></i>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '600', color: '#495057', marginBottom: '4px' }}>Active Filters:</div>
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <span style={{
                    background: '#667eea',
                    color: 'white',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '13px',
                    fontWeight: '500'
                  }}>
                    {getDivisionName(currentSectionForSubSections.division)}
                  </span>
                  <i className="bi bi-chevron-right" style={{ color: '#667eea' }}></i>
                  <span style={{
                    background: '#764ba2',
                    color: 'white',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '13px',
                    fontWeight: '500'
                  }}>
                    {currentSectionForSubSections.name}
                  </span>
                </div>
              </div>
              {(Array.isArray(subSectionsBySection[currentSectionForSubSections._id]) && subSectionsBySection[currentSectionForSubSections._id].length > 0) && (
                <div style={{
                  background: 'white',
                  padding: '8px 16px',
                  borderRadius: '20px',
                  fontWeight: '600',
                  color: '#667eea',
                  fontSize: '14px',
                  border: '2px solid #667eea'
                }}>
                  {subSectionsBySection[currentSectionForSubSections._id].length} {subSectionsBySection[currentSectionForSubSections._id].length === 1 ? 'sub-section' : 'sub-sections'}
                </div>
              )}
            </div>

            {/* Sub-Sections List */}
            <div style={{ 
              flex: 1, 
              overflowY: 'auto', 
              padding: '24px 32px'
            }}>
              {subSectionsLoading[currentSectionForSubSections._id] ? (
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  padding: '40px 0',
                  color: '#6b7280'
                }}>
                  <div className="spinner-border" role="status" style={{ width: 40, height: 40, marginBottom: 16 }}>
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <div>Loading sub-sections...</div>
                </div>
              ) : subSectionsError[currentSectionForSubSections._id] ? (
                <div style={{
                  padding: '40px 20px',
                  textAlign: 'center',
                  color: '#ef4444',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <i className="bi bi-exclamation-triangle" style={{ fontSize: '48px' }}></i>
                  <p style={{ margin: 0, fontSize: '15px' }}>{subSectionsError[currentSectionForSubSections._id]}</p>
                </div>
              ) : (Array.isArray(subSectionsBySection[currentSectionForSubSections._id]) && subSectionsBySection[currentSectionForSubSections._id].length > 0) ? (
                <div style={{ 
                  background: 'white',
                  borderRadius: '12px',
                  border: '2px solid #e5e7eb',
                  overflow: 'hidden',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)'
                }}>
                  <table style={{ 
                    width: '100%', 
                    borderCollapse: 'collapse',
                    fontSize: '14px'
                  }}>
                    <thead>
                      <tr style={{ 
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white'
                      }}>
                        <th style={{ 
                          padding: '16px 20px', 
                          textAlign: 'left',
                          fontWeight: '700',
                          fontSize: '13px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          Sub-Section Name
                        </th>
                        <th style={{ 
                          padding: '16px 20px', 
                          textAlign: 'left',
                          fontWeight: '700',
                          fontSize: '13px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          Code
                        </th>
                        <th style={{ 
                          padding: '16px 20px', 
                          textAlign: 'left',
                          fontWeight: '700',
                          fontSize: '13px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          Created Date
                        </th>
                        <th style={{ 
                          padding: '16px 20px', 
                          textAlign: 'center',
                          fontWeight: '700',
                          fontSize: '13px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          Transferring
                        </th>
                        <th style={{ 
                          padding: '16px 20px', 
                          textAlign: 'center',
                          fontWeight: '700',
                          fontSize: '13px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {subSectionsBySection[currentSectionForSubSections._id].map((ss, index) => (
                        <tr key={ss._id} style={{
                          borderBottom: index < subSectionsBySection[currentSectionForSubSections._id].length - 1 ? '1px solid #e5e7eb' : 'none',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.background = '#f9fafb';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.background = 'transparent';
                        }}
                        >
                          <td style={{ 
                            padding: '12px 20px',
                            fontWeight: '600',
                            color: '#1f2937'
                          }}>
                            {ss?.subSection?.sub_hie_name || ss?.subSection?.hie_name || ss?.subSection?.name || '-'}
                          </td>
                          <td style={{ padding: '12px 20px' }}>
                            <span style={{ 
                              fontFamily: 'monospace', 
                              color: '#667eea', 
                              background: '#eef2ff', 
                              padding: '4px 10px', 
                              borderRadius: 6,
                              fontSize: '13px',
                              fontWeight: '600',
                              display: 'inline-block'
                            }}>
                              {ss?.subSection?.sub_hie_code || ss?.subSection?.hie_code || ss?.subSection?.code || '-'}
                            </span>
                          </td>
                          <td style={{ 
                            padding: '12px 20px',
                            color: '#6b7280'
                          }}>
                            <div style={{ 
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}>
                              <i className="bi bi-calendar3"></i>
                              {ss?.createdAt ? formatDateYmd(new Date(ss.createdAt)) : '—'}
                            </div>
                          </td>
                          <td style={{ 
                            padding: '12px 20px',
                            textAlign: 'center'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                              {canTransferSubsection ? (
                              <button
                                className="btn-professional"
                                onClick={() => handleAddEmployeeToSubSection(ss)}
                                style={{ 
                                  padding: '6px 8px', 
                                  fontSize: 13,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  minWidth: '32px',
                                  minHeight: '32px',
                                  backgroundColor: '#10b981',
                                  color: 'white',
                                  border: 'none'
                                }}
                                title="Add Employee - Shows all not-transferred employees"
                              >
                                <i className="bi bi-person-plus"></i>
                              </button>
                              ) : null}
                              {canRecallSubsection ? (
                              <button
                                className="btn-professional"
                                onClick={() => handleShowTransferredEmployees(ss)}
                                style={{ 
                                  padding: '6px 8px', 
                                  fontSize: 13,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  minWidth: '32px',
                                  minHeight: '32px',
                                  backgroundColor: '#f59e0b',
                                  color: 'white',
                                  border: 'none'
                                }}
                                title="Recall - Shows all transferred employees"
                              >
                                <i className="bi bi-arrow-counterclockwise"></i>
                              </button>
                              ) : null}
                            </div>
                          </td>
                          <td style={{ 
                            padding: '12px 20px',
                            textAlign: 'center'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                              {canUpdateSubsection ? (
                              <button
                                className="btn-professional btn-primary"
                                onClick={() => handleEditSubSection(currentSectionForSubSections._id, ss)}
                                style={{ 
                                  padding: '6px 8px', 
                                  fontSize: 13,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  minWidth: '32px',
                                  minHeight: '32px'
                                }}
                                title="Edit Sub-Section"
                              >
                                <i className="bi bi-pencil"></i>
                              </button>
                              ) : null}
                              {canDeleteSubsection ? (
                              <button
                                className="btn-professional btn-danger"
                                onClick={() => handleDeleteSubSection(currentSectionForSubSections._id, ss._id)}
                                style={{ 
                                  padding: '6px 8px', 
                                  fontSize: 13,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  minWidth: '32px',
                                  minHeight: '32px'
                                }}
                                title="Delete Sub-Section"
                              >
                                <i className="bi bi-trash"></i>
                              </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{
                  padding: '40px 20px',
                  textAlign: 'center',
                  color: '#6b7280',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <i className="bi bi-inbox" style={{ fontSize: '48px', opacity: 0.5 }}></i>
                  <p style={{ margin: 0, fontSize: '15px' }}>No sub-sections yet. Click the <strong>+</strong> button to create one.</p>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 11000,
            padding: '20px'
          }}
          onClick={cancelDeleteSubSection}
        >
          <div 
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
              width: '90%',
              maxWidth: '500px',
              overflow: 'hidden',
              animation: 'slideIn 0.3s ease-out'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              padding: '24px 28px',
              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <i className="bi bi-exclamation-triangle-fill" style={{ fontSize: '28px' }}></i>
              <h3 style={{ 
                fontSize: '22px', 
                fontWeight: '700', 
                margin: 0
              }}>
                Confirm Deletion
              </h3>
            </div>

            {/* Body */}
            <div style={{ padding: '28px' }}>
              <p style={{ 
                fontSize: '16px', 
                color: '#374151', 
                margin: 0,
                lineHeight: '1.6'
              }}>
                Are you sure you want to delete this sub-section? This action cannot be undone.
              </p>
            </div>

            {/* Footer */}
            <div style={{
              padding: '20px 28px',
              borderTop: '1px solid #e5e7eb',
              background: '#f9fafb',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px'
            }}>
              <button
                onClick={cancelDeleteSubSection}
                style={{
                  padding: '12px 24px',
                  border: '2px solid #d1d5db',
                  borderRadius: '8px',
                  backgroundColor: 'white',
                  color: '#6b7280',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => {
                  e.target.style.borderColor = '#9ca3af';
                  e.target.style.color = '#374151';
                }}
                onMouseOut={(e) => {
                  e.target.style.borderColor = '#d1d5db';
                  e.target.style.color = '#6b7280';
                }}
              >
                <i className="bi bi-x-circle" style={{ marginRight: '8px' }}></i>
                Cancel
              </button>
              <button
                onClick={confirmDeleteSubSection}
                style={{
                  padding: '12px 24px',
                  border: 'none',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 3px 10px rgba(239, 68, 68, 0.3)'
                }}
                onMouseOver={(e) => {
                  e.target.style.transform = 'translateY(-1px)';
                  e.target.style.boxShadow = '0 4px 15px rgba(239, 68, 68, 0.4)';
                }}
                onMouseOut={(e) => {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 3px 10px rgba(239, 68, 68, 0.3)';
                }}
              >
                <i className="bi bi-trash" style={{ marginRight: '8px' }}></i>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Employee List Modal */}
      {showEmployeeModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            maxWidth: '1000px',
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              padding: '24px 32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <i className="bi bi-people-fill" style={{ fontSize: '24px', color: 'white' }}></i>
                <h2 style={{ margin: 0, color: 'white', fontSize: '20px', fontWeight: '600' }}>
                  Employee List - {selectedSubSection?.subSection?.sub_hie_name || selectedSubSection?.subSection?.hie_name || 'Sub-Section'}
                </h2>
              </div>
              <button
                onClick={closeEmployeeModal}
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: 'none',
                  borderRadius: '8px',
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  color: 'white',
                  fontSize: '20px'
                }}
                onMouseOver={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.3)'}
                onMouseOut={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.2)'}
              >
                <i className="bi bi-x"></i>
              </button>
            </div>

            {/* Active Filters Display - Employee Management Style */}
            <div style={{
              background: 'linear-gradient(135deg, #667eea15 0%, #764ba215 100%)',
              border: '2px solid #667eea',
              borderRadius: '8px',
              padding: '16px 20px',
              margin: '16px 32px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <i className="bi bi-funnel-fill" style={{ color: '#667eea', fontSize: '20px' }}></i>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '600', color: '#495057', marginBottom: '4px' }}>Active Filters:</div>
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <span style={{
                    background: '#667eea',
                    color: 'white',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '13px',
                    fontWeight: '500'
                  }}>
                    {selectedSubSection?.parentDivision?.division_name || 'N/A'}
                  </span>
                  <i className="bi bi-chevron-right" style={{ color: '#667eea' }}></i>
                  <span style={{
                    background: '#764ba2',
                    color: 'white',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '13px',
                    fontWeight: '500'
                  }}>
                    {selectedSubSection?.parentSection?.hie_name || 'N/A'}
                  </span>
                  <i className="bi bi-chevron-right" style={{ color: '#667eea' }}></i>
                  <span style={{
                    background: '#f093fb',
                    color: 'white',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '13px',
                    fontWeight: '500'
                  }}>
                    {selectedSubSection?.subSection?.sub_hie_name || selectedSubSection?.subSection?.hie_name || 'Sub-Section'}
                  </span>
                </div>
              </div>
            </div>

            {/* Search Bar */}
            <div style={{
              padding: '16px 32px',
              borderBottom: '1px solid #e5e7eb',
              background: '#f9fafb'
            }}>
              <div style={{ position: 'relative' }}>
                <i className="bi bi-search" style={{
                  position: 'absolute',
                  left: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#9ca3af',
                  fontSize: '16px'
                }}></i>
                <input
                  type="text"
                  placeholder="Search by Employee ID or Name..."
                  value={employeeSearchQuery}
                  onChange={(e) => setEmployeeSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px 12px 42px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'all 0.2s ease'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#667eea';
                    e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.boxShadow = 'none';
                  }}
                />
                <div style={{ marginTop: '8px', color: '#6b7280', fontSize: '13px' }}>Showing <strong>active</strong> employees only</div>
              </div>
            </div>

            {/* Content */}
            <div style={{
              padding: '24px 32px',
              flex: 1,
              overflow: 'auto'
            }}>
              {employeeLoading ? (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '60px 20px',
                  gap: '16px'
                }}>
                  <div className="spinner-border" role="status" style={{ color: '#667eea' }}>
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p style={{ color: '#6b7280', margin: 0 }}>Loading employees from HRIS...</p>
                </div>
              ) : (() => {
                // Filter employees based on search query
                const filteredEmployees = employeeList.filter(emp => {
                  if (!employeeSearchQuery.trim()) return true;
                  
                  const searchLower = employeeSearchQuery.toLowerCase().trim();
                  const empId = String(emp?.EMP_NUMBER || emp?.empNumber || emp?.EMP_ID || emp?.emp_id || '').toLowerCase();
                  const empName = String(emp?.FULLNAME || emp?.fullName || emp?.CALLING_NAME || emp?.calling_name || emp?.name || '').toLowerCase();
                  
                  return empId.includes(searchLower) || empName.includes(searchLower);
                });

                return filteredEmployees.length === 0 ? (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '60px 20px',
                  gap: '12px'
                }}>
                  <i className="bi bi-person-x" style={{ fontSize: '48px', color: '#d1d5db' }}></i>
                  <p style={{ color: '#6b7280', margin: 0, fontSize: '16px' }}>
                    {employeeSearchQuery ? 'No employees match your search' : 'No employees found for this division and section'}
                  </p>
                </div>
              ) : (
                <div style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: '12px',
                  overflow: 'hidden'
                }}>
                  <table style={{
                    width: '100%',
                    borderCollapse: 'collapse'
                  }}>
                    <thead>
                      <tr style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                        <th style={{ padding: '14px 16px', width: '40px', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={(() => {
                              try {
                                const filteredEmployees = employeeList.filter(emp => {
                                  if (!employeeSearchQuery.trim()) return true;
                                  const searchLower = employeeSearchQuery.toLowerCase().trim();
                                  const empId = String(emp?.EMP_NUMBER || emp?.empNumber || emp?.EMP_ID || emp?.emp_id || '').toLowerCase();
                                  const empName = String(emp?.FULLNAME || emp?.fullName || emp?.CALLING_NAME || emp?.calling_name || emp?.name || '').toLowerCase();
                                  return empId.includes(searchLower) || empName.includes(searchLower);
                                });
                                return filteredEmployees.length > 0 && selectedEmployeeIds.size === filteredEmployees.length;
                              } catch (e) { return false; }
                            })()}
                            onChange={(e) => {
                              const checked = !!e.target.checked;
                              // find current filtered list
                              const filteredEmployees = employeeList.filter(emp => {
                                if (!employeeSearchQuery.trim()) return true;
                                const searchLower = employeeSearchQuery.toLowerCase().trim();
                                const empId = String(emp?.EMP_NUMBER || emp?.empNumber || emp?.EMP_ID || emp?.emp_id || '').toLowerCase();
                                const empName = String(emp?.FULLNAME || emp?.fullName || emp?.CALLING_NAME || emp?.calling_name || emp?.name || '').toLowerCase();
                                return empId.includes(searchLower) || empName.includes(searchLower);
                              });
                              selectAllCurrent(checked, filteredEmployees);
                            }}
                            title="Select all visible employees"
                          />
                        </th>
                        <th style={{ padding: '14px 16px', textAlign: 'left', color: 'white', fontWeight: '600', fontSize: '13px' }}>
                          EMPLOYEE ID
                        </th>
                        <th style={{ padding: '14px 16px', textAlign: 'left', color: 'white', fontWeight: '600', fontSize: '13px' }}>
                          NAME
                        </th>
                        <th style={{ padding: '14px 16px', textAlign: 'center', color: 'white', fontWeight: '600', fontSize: '13px' }}>
                          STATUS
                        </th>
                        <th style={{ padding: '14px 16px', textAlign: 'center', color: 'white', fontWeight: '600', fontSize: '13px' }}>
                          ACTION
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEmployees.map((emp, index) => {
                        const empId = emp?.EMP_NUMBER || emp?.empNumber || emp?.EMP_ID || emp?.emp_id;
                        
                        return (
                          <tr 
                            key={empId || index}
                            style={{
                              borderBottom: index < filteredEmployees.length - 1 ? '1px solid #e5e7eb' : 'none',
                              transition: 'all 0.2s ease'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.background = '#f9fafb'}
                            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={selectedEmployeeIds.has(String(empId))}
                                onChange={() => toggleSelectEmployee(emp)}
                                title="Select employee for bulk transfer"
                              />
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: '14px', color: '#1f2937', fontWeight: '600' }}>
                              {empId || 'N/A'}
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: '14px', color: '#1f2937' }}>
                              {emp?.FULLNAME || emp?.fullName || emp?.CALLING_NAME || emp?.calling_name || emp?.name || 'N/A'}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                              {(() => {
                                const isActive = emp?.ACTIVE_HRM_FLG === 1 || emp?.STATUS === 'ACTIVE' || emp?.status === 'ACTIVE' || emp?.isActive === true;
                                return (
                                  <span style={{
                                    padding: '4px 12px',
                                    borderRadius: '12px',
                                    fontSize: '12px',
                                    fontWeight: '600',
                                    background: isActive ? '#dcfce7' : '#fee2e2',
                                    color: isActive ? '#16a34a' : '#dc2626',
                                    display: 'inline-block'
                                  }}>
                                    {isActive ? 'Active' : 'Inactive'}
                                  </span>
                                );
                              })()}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                              <button
                                onClick={() => handleTransferEmployee(emp)}
                                style={{
                                  padding: '8px 16px',
                                  border: 'none',
                                  borderRadius: '6px',
                                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                  color: 'white',
                                  fontSize: '13px',
                                  fontWeight: '600',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px'
                                }}
                                onMouseOver={(e) => {
                                  e.currentTarget.style.transform = 'translateY(-1px)';
                                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
                                }}
                                onMouseOut={(e) => {
                                  e.currentTarget.style.transform = 'translateY(0)';
                                  e.currentTarget.style.boxShadow = 'none';
                                }}
                                title="Transfer employee to this sub-section"
                              >
                                <i className="bi bi-arrow-left-right"></i>
                                Transfer
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
              })()}
            </div>

            {/* Footer */}
            <div style={{
              padding: '20px 32px',
              borderTop: '1px solid #e5e7eb',
              background: '#f9fafb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ fontSize: '14px', color: '#6b7280' }}>
                {(() => {
                  const filteredCount = employeeList.filter(emp => {
                    if (!employeeSearchQuery.trim()) return true;
                    const searchLower = employeeSearchQuery.toLowerCase().trim();
                    const empId = String(emp?.EMP_NUMBER || emp?.empNumber || emp?.EMP_ID || emp?.emp_id || '').toLowerCase();
                    const empName = String(emp?.FULLNAME || emp?.fullName || emp?.CALLING_NAME || emp?.calling_name || emp?.name || '').toLowerCase();
                    return empId.includes(searchLower) || empName.includes(searchLower);
                  }).length;
                  
                  return (
                    <>
                      <strong style={{ color: '#1f2937' }}>{filteredCount}</strong> employee{filteredCount !== 1 ? 's' : ''} found
                      {employeeSearchQuery && filteredCount !== employeeList.length && (
                        <span style={{ marginLeft: '8px', color: '#9ca3af' }}>
                          (filtered from {employeeList.length})
                        </span>
                      )}
                    </>
                  );
                })()}
              </div>
              {/* Footer Close button removed per request; use header X to close modal */}
              <button
                onClick={() => setShowBulkTransferConfirm(true)}
                disabled={selectedEmployeeIds.size === 0}
                style={{
                  padding: '10px 24px',
                  border: 'none',
                  borderRadius: '8px',
                  background: selectedEmployeeIds.size === 0 ? '#d1d5db' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: selectedEmployeeIds.size === 0 ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  marginLeft: '12px'
                }}
              >
                Transfer Selected
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Confirmation Modal */}
      {showTransferConfirm && transferEmployee && selectedSubSection && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10001,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            maxWidth: '550px',
            width: '100%',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              padding: '24px 32px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <i className="bi bi-arrow-left-right-circle" style={{ fontSize: '28px', color: 'white' }}></i>
              <h3 style={{ margin: 0, color: 'white', fontSize: '20px', fontWeight: '600' }}>
                Confirm Transfer
              </h3>
            </div>

            {/* Content */}
            <div style={{ padding: '32px' }}>
              <div style={{
                background: '#f9fafb',
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '24px',
                border: '2px solid #e5e7eb'
              }}>
                <div style={{ 
                  fontSize: '16px', 
                  color: '#374151', 
                  marginBottom: '20px',
                  lineHeight: '1.6'
                }}>
                  Are you sure you want to transfer this employee?
                </div>

                {/* Employee Info */}
                <div style={{
                  background: 'white',
                  borderRadius: '8px',
                  padding: '16px',
                  marginBottom: '16px',
                  border: '1px solid #e5e7eb'
                }}>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Employee</div>
                  <div style={{ fontSize: '16px', color: '#1f2937', fontWeight: '600' }}>
                    {transferEmployee?.FULLNAME || transferEmployee?.fullName || transferEmployee?.CALLING_NAME || 'N/A'}
                  </div>
                  <div style={{ fontSize: '13px', color: '#667eea', marginTop: '4px' }}>
                    ID: {transferEmployee?.EMP_NUMBER || transferEmployee?.empNumber || 'N/A'}
                  </div>
                </div>

                {/* Destination Info */}
                <div style={{
                  background: 'white',
                  borderRadius: '8px',
                  padding: '16px',
                  border: '1px solid #e5e7eb'
                }}>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>
                    <i className="bi bi-arrow-down"></i> Transferring to:
                  </div>
                  <div style={{ marginLeft: '16px' }}>
                    <div style={{ fontSize: '14px', color: '#1f2937', marginBottom: '6px' }}>
                      <strong>Sub-Section:</strong> {selectedSubSection?.subSection?.sub_hie_name || selectedSubSection?.subSection?.hie_name || 'N/A'}
                    </div>
                    <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
                      <strong>Section:</strong> {selectedSubSection?.parentSection?.hie_name || 'N/A'}
                    </div>
                    <div style={{ fontSize: '13px', color: '#6b7280' }}>
                      <strong>Division:</strong> {selectedSubSection?.parentDivision?.division_name || 'N/A'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ 
                display: 'flex', 
                gap: '12px', 
                justifyContent: 'flex-end' 
              }}>
                <button
                  onClick={cancelTransfer}
                  disabled={transferSubmitting}
                  style={{
                    padding: '12px 24px',
                    border: '2px solid #d1d5db',
                    borderRadius: '8px',
                    backgroundColor: 'white',
                    color: '#6b7280',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: transferSubmitting ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                    opacity: transferSubmitting ? 0.5 : 1
                  }}
                  onMouseOver={(e) => {
                    if (!transferSubmitting) {
                      e.target.style.borderColor = '#9ca3af';
                      e.target.style.color = '#374151';
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!transferSubmitting) {
                      e.target.style.borderColor = '#d1d5db';
                      e.target.style.color = '#6b7280';
                    }
                  }}
                >
                  <i className="bi bi-x-circle" style={{ marginRight: '8px' }}></i>
                  Cancel
                </button>
                <button
                  onClick={confirmTransferEmployee}
                  disabled={transferSubmitting}
                  style={{
                    padding: '12px 24px',
                    border: 'none',
                    borderRadius: '8px',
                    background: transferSubmitting 
                      ? '#9ca3af' 
                      : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: transferSubmitting ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 3px 10px rgba(102, 126, 234, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                  onMouseOver={(e) => {
                    if (!transferSubmitting) {
                      e.target.style.transform = 'translateY(-1px)';
                      e.target.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!transferSubmitting) {
                      e.target.style.transform = 'translateY(0)';
                      e.target.style.boxShadow = '0 3px 10px rgba(102, 126, 234, 0.3)';
                    }
                  }}
                >
                  {transferSubmitting ? (
                    <>
                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                      Transferring...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-check-circle"></i>
                      Confirm Transfer
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transferred Employees Modal */}
      {showTransferredEmployeesModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            maxWidth: '1000px',
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              padding: '24px 32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <i className="bi bi-arrow-counterclockwise" style={{ fontSize: '24px', color: 'white' }}></i>
                <h2 style={{ margin: 0, color: 'white', fontSize: '20px', fontWeight: '600' }}>
                  Transferred Employees - {selectedSubSection?.subSection?.sub_hie_name || selectedSubSection?.subSection?.hie_name || 'Sub-Section'}
                </h2>
              </div>
              <button
                onClick={closeTransferredEmployeesModal}
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: 'none',
                  borderRadius: '8px',
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  color: 'white',
                  fontSize: '20px'
                }}
                onMouseOver={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.3)'}
                onMouseOut={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.2)'}
              >
                <i className="bi bi-x"></i>
              </button>
            </div>

            {/* Active Filters Display */}
            <div style={{
              background: 'linear-gradient(135deg, #667eea15 0%, #764ba215 100%)',
              border: '2px solid #667eea',
              borderRadius: '8px',
              padding: '16px 20px',
              margin: '16px 32px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <i className="bi bi-funnel-fill" style={{ color: '#667eea', fontSize: '20px' }}></i>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '600', color: '#495057', marginBottom: '4px' }}>Active Filters:</div>
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <span style={{
                    background: '#667eea',
                    color: 'white',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '13px',
                    fontWeight: '500'
                  }}>
                    {selectedSubSection?.parentDivision?.division_name || 'N/A'}
                  </span>
                  <i className="bi bi-chevron-right" style={{ color: '#667eea' }}></i>
                  <span style={{
                    background: '#764ba2',
                    color: 'white',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '13px',
                    fontWeight: '500'
                  }}>
                    {selectedSubSection?.parentSection?.hie_name || 'N/A'}
                  </span>
                  <i className="bi bi-chevron-right" style={{ color: '#667eea' }}></i>
                  <span style={{
                    background: '#f093fb',
                    color: 'white',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '13px',
                    fontWeight: '500'
                  }}>
                    {selectedSubSection?.subSection?.sub_hie_name || selectedSubSection?.subSection?.hie_name || 'Sub-Section'}
                  </span>
                </div>
              </div>
            </div>

            {/* Search Bar */}
            <div style={{
              padding: '16px 32px',
              borderBottom: '1px solid #e5e7eb',
              background: '#fef3c7'
            }}>
              <div style={{ position: 'relative' }}>
                <i className="bi bi-search" style={{
                  position: 'absolute',
                  left: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#d97706',
                  fontSize: '16px'
                }}></i>
                <input
                  type="text"
                  placeholder="Search by Employee ID or Name..."
                  value={transferredSearchQuery}
                  onChange={(e) => setTransferredSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px 12px 42px',
                    border: '2px solid #fbbf24',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'all 0.2s ease',
                    background: 'white'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#f59e0b';
                    e.target.style.boxShadow = '0 0 0 3px rgba(245, 158, 11, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#fbbf24';
                    e.target.style.boxShadow = 'none';
                  }}
                />
                <div style={{ marginTop: '8px', color: '#6b7280', fontSize: '13px' }}>Showing <strong>active</strong> transferred employees only</div>
              </div>
            </div>

            {/* Content */}
            <div style={{
              padding: '24px 32px',
              flex: 1,
              overflow: 'auto'
            }}>
              {transferredLoading ? (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '60px 20px',
                  gap: '16px'
                }}>
                  <div className="spinner-border" role="status" style={{ color: '#f59e0b' }}>
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p style={{ color: '#6b7280', margin: 0 }}>Loading transferred employees...</p>
                </div>
              ) : (() => {
                // Filter transferred employees based on search query
                const filteredTransferred = transferredEmployeesList.filter(emp => {
                  if (!transferredSearchQuery.trim()) return true;
                  
                  const searchLower = transferredSearchQuery.toLowerCase().trim();
                  const empId = String(emp?.EMP_NUMBER || emp?.empNumber || emp?.EMP_ID || emp?.emp_id || '').toLowerCase();
                  const empName = String(emp?.FULLNAME || emp?.fullName || emp?.CALLING_NAME || emp?.calling_name || emp?.name || '').toLowerCase();
                  
                  return empId.includes(searchLower) || empName.includes(searchLower);
                });

                return filteredTransferred.length === 0 ? (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '60px 20px',
                  gap: '12px'
                }}>
                  <i className="bi bi-inbox" style={{ fontSize: '48px', color: '#d1d5db' }}></i>
                  <p style={{ color: '#6b7280', margin: 0, fontSize: '16px' }}>
                    {transferredSearchQuery ? 'No transferred employees match your search' : 'No transferred employees found for this sub-section'}
                  </p>
                </div>
              ) : (
                <div style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: '12px',
                  overflow: 'hidden'
                }}>
                  <table style={{
                    width: '100%',
                    borderCollapse: 'collapse'
                  }}>
                    <thead>
                      <tr style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
                            <th style={{ padding: '14px 16px', width: '40px', textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={(() => {
                                  try {
                                    const filteredTransferred = transferredEmployeesList.filter(emp => {
                                      if (!transferredSearchQuery.trim()) return true;
                                      const searchLower = transferredSearchQuery.toLowerCase().trim();
                                      const empId = String(emp?.EMP_NUMBER || emp?.empNumber || emp?.EMP_ID || emp?.emp_id || '').toLowerCase();
                                      const empName = String(emp?.FULLNAME || emp?.fullName || emp?.CALLING_NAME || emp?.calling_name || emp?.name || '').toLowerCase();
                                      return empId.includes(searchLower) || empName.includes(searchLower);
                                    });
                                    return filteredTransferred.length > 0 && selectedTransferredEmployeeIds.size === filteredTransferred.length;
                                  } catch (e) { return false; }
                                })()}
                                onChange={(e) => {
                                  const checked = !!e.target.checked;
                                  const filteredTransferred = transferredEmployeesList.filter(emp => {
                                    if (!transferredSearchQuery.trim()) return true;
                                    const searchLower = transferredSearchQuery.toLowerCase().trim();
                                    const empId = String(emp?.EMP_NUMBER || emp?.empNumber || emp?.EMP_ID || emp?.emp_id || '').toLowerCase();
                                    const empName = String(emp?.FULLNAME || emp?.fullName || emp?.CALLING_NAME || emp?.calling_name || emp?.name || '').toLowerCase();
                                    return empId.includes(searchLower) || empName.includes(searchLower);
                                  });
                                  if (checked) {
                                    const ids = new Set(filteredTransferred.map(emp => String(emp?.EMP_NUMBER || emp?.empNumber || emp?.EMP_ID || emp?.emp_id || '')));
                                    setSelectedTransferredEmployeeIds(ids);
                                  } else {
                                    setSelectedTransferredEmployeeIds(new Set());
                                  }
                                }}
                                title="Select all visible transferred employees"
                              />
                            </th>
                        <th style={{ padding: '14px 16px', textAlign: 'left', color: 'white', fontWeight: '600', fontSize: '13px' }}>
                          EMPLOYEE ID
                        </th>
                        <th style={{ padding: '14px 16px', textAlign: 'left', color: 'white', fontWeight: '600', fontSize: '13px' }}>
                          NAME
                        </th>
                        <th style={{ padding: '14px 16px', textAlign: 'center', color: 'white', fontWeight: '600', fontSize: '13px' }}>
                          STATUS
                        </th>
                        <th style={{ padding: '14px 16px', textAlign: 'center', color: 'white', fontWeight: '600', fontSize: '13px' }}>
                          ACTION
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTransferred.map((emp, index) => {
                        const empId = emp?.EMP_NUMBER || emp?.empNumber || emp?.EMP_ID || emp?.emp_id;
                        
                        return (
                          <tr 
                            key={empId || index}
                            style={{
                              borderBottom: index < filteredTransferred.length - 1 ? '1px solid #e5e7eb' : 'none',
                              transition: 'all 0.2s ease'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.background = '#fef3c7'}
                            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={selectedTransferredEmployeeIds.has(String(empId))}
                                onChange={() => {
                                  const id = String(empId);
                                  setSelectedTransferredEmployeeIds(prev => {
                                    const next = new Set(Array.from(prev));
                                    if (next.has(id)) next.delete(id);
                                    else next.add(id);
                                    return next;
                                  });
                                }}
                                title="Select transferred employee for recall"
                              />
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: '14px', color: '#1f2937', fontWeight: '600' }}>
                              {empId || 'N/A'}
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: '14px', color: '#1f2937' }}>
                              {emp?.FULLNAME || emp?.fullName || emp?.CALLING_NAME || emp?.calling_name || emp?.name || 'N/A'}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                              {(() => {
                                const isActive = emp?.ACTIVE_HRM_FLG === 1 || emp?.STATUS === 'ACTIVE' || emp?.status === 'ACTIVE' || emp?.isActive === true;
                                return (
                                  <span style={{
                                    padding: '4px 12px',
                                    borderRadius: '12px',
                                    fontSize: '12px',
                                    fontWeight: '600',
                                    background: isActive ? '#dcfce7' : '#fee2e2',
                                    color: isActive ? '#16a34a' : '#dc2626',
                                    display: 'inline-block'
                                  }}>
                                    {isActive ? 'Active' : 'Inactive'}
                                  </span>
                                );
                              })()}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                              <button
                                onClick={() => {
                                  // Close transferred modal and trigger recall
                                  setShowTransferredEmployeesModal(false);
                                  setTimeout(() => {
                                    handleRecallTransfer(emp);
                                  }, 200);
                                }}
                                style={{
                                  padding: '8px 16px',
                                  border: 'none',
                                  borderRadius: '6px',
                                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                                  color: 'white',
                                  fontSize: '13px',
                                  fontWeight: '600',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px'
                                }}
                                onMouseOver={(e) => {
                                  e.currentTarget.style.transform = 'translateY(-1px)';
                                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.4)';
                                }}
                                onMouseOut={(e) => {
                                  e.currentTarget.style.transform = 'translateY(0)';
                                  e.currentTarget.style.boxShadow = 'none';
                                }}
                                title="Recall employee transfer from this sub-section"
                              >
                                <i className="bi bi-arrow-counterclockwise"></i>
                                Recall
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
              })()}
            </div>

            {/* Footer */}
            <div style={{
              padding: '20px 32px',
              borderTop: '1px solid #e5e7eb',
              background: '#f9fafb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ fontSize: '14px', color: '#6b7280' }}>
                {(() => {
                  const filteredCount = transferredEmployeesList.filter(emp => {
                    if (!transferredSearchQuery.trim()) return true;
                    const searchLower = transferredSearchQuery.toLowerCase().trim();
                    const empId = String(emp?.EMP_NUMBER || emp?.empNumber || emp?.EMP_ID || emp?.emp_id || '').toLowerCase();
                    const empName = String(emp?.FULLNAME || emp?.fullName || emp?.CALLING_NAME || emp?.calling_name || emp?.name || '').toLowerCase();
                    return empId.includes(searchLower) || empName.includes(searchLower);
                  }).length;
                  
                  return (
                    <>
                      <strong style={{ color: '#1f2937' }}>{filteredCount}</strong> transferred employee{filteredCount !== 1 ? 's' : ''}
                      {transferredSearchQuery && filteredCount !== transferredEmployeesList.length && (
                        <span style={{ marginLeft: '8px', color: '#9ca3af' }}>
                          (filtered from {transferredEmployeesList.length})
                        </span>
                      )}
                    </>
                  );
                })()}
              </div>
              {/* Removed footer Close button per request; modal can still be closed via header X */}
              <button
                onClick={() => setShowBulkRecallConfirm(true)}
                disabled={selectedTransferredEmployeeIds.size === 0}
                style={{
                  padding: '10px 24px',
                  border: 'none',
                  borderRadius: '8px',
                  background: selectedTransferredEmployeeIds.size === 0 ? '#d1d5db' : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: selectedTransferredEmployeeIds.size === 0 ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  marginLeft: '12px'
                }}
              >
                Recall Selected
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recall Confirmation Modal */}
      {showRecallConfirm && recallEmployee && selectedSubSection && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10001,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            maxWidth: '550px',
            width: '100%',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{
              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
              padding: '24px 32px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <i className="bi bi-arrow-counterclockwise" style={{ fontSize: '28px', color: 'white' }}></i>
              <h3 style={{ margin: 0, color: 'white', fontSize: '20px', fontWeight: '600' }}>
                Confirm Recall Transfer
              </h3>
            </div>

            {/* Content */}
            <div style={{ padding: '32px' }}>
              <div style={{
                background: '#fef2f2',
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '24px',
                border: '2px solid #fecaca'
              }}>
                <div style={{ 
                  fontSize: '16px', 
                  color: '#991b1b', 
                  marginBottom: '20px',
                  lineHeight: '1.6',
                  fontWeight: '600'
                }}>
                  Are you sure you want to recall the transfer for this employee?
                </div>

                <div style={{ 
                  fontSize: '14px', 
                  color: '#7f1d1d', 
                  marginBottom: '20px',
                  lineHeight: '1.6'
                }}>
                  This will remove the employee from this sub-section.
                </div>

                {/* Employee Info */}
                <div style={{
                  background: 'white',
                  borderRadius: '8px',
                  padding: '16px',
                  marginBottom: '16px',
                  border: '1px solid #fecaca'
                }}>
                  <div style={{ fontSize: '12px', color: '#991b1b', marginBottom: '4px' }}>Employee</div>
                  <div style={{ fontSize: '16px', color: '#1f2937', fontWeight: '600' }}>
                    {recallEmployee?.FULLNAME || recallEmployee?.fullName || recallEmployee?.CALLING_NAME || 'N/A'}
                  </div>
                  <div style={{ fontSize: '13px', color: '#dc2626', marginTop: '4px' }}>
                    ID: {recallEmployee?.EMP_NUMBER || recallEmployee?.empNumber || 'N/A'}
                  </div>
                </div>

                {/* Current Sub-Section Info */}
                <div style={{
                  background: 'white',
                  borderRadius: '8px',
                  padding: '16px',
                  border: '1px solid #fecaca'
                }}>
                  <div style={{ fontSize: '12px', color: '#991b1b', marginBottom: '8px' }}>
                    <i className="bi bi-building"></i> Current Assignment:
                  </div>
                  <div style={{ marginLeft: '16px' }}>
                    <div style={{ fontSize: '14px', color: '#1f2937', marginBottom: '6px' }}>
                      <strong>Sub-Section:</strong> {selectedSubSection?.subSection?.sub_hie_name || selectedSubSection?.subSection?.hie_name || 'N/A'}
                    </div>
                    <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
                      <strong>Section:</strong> {selectedSubSection?.parentSection?.hie_name || 'N/A'}
                    </div>
                    <div style={{ fontSize: '13px', color: '#6b7280' }}>
                      <strong>Division:</strong> {selectedSubSection?.parentDivision?.division_name || 'N/A'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ 
                display: 'flex', 
                gap: '12px', 
                justifyContent: 'flex-end' 
              }}>
                <button
                  onClick={cancelRecall}
                  disabled={recallSubmitting}
                  style={{
                    padding: '12px 24px',
                    border: '2px solid #d1d5db',
                    borderRadius: '8px',
                    backgroundColor: 'white',
                    color: '#6b7280',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: recallSubmitting ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                    opacity: recallSubmitting ? 0.5 : 1
                  }}
                  onMouseOver={(e) => {
                    if (!recallSubmitting) {
                      e.target.style.borderColor = '#9ca3af';
                      e.target.style.color = '#374151';
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!recallSubmitting) {
                      e.target.style.borderColor = '#d1d5db';
                      e.target.style.color = '#6b7280';
                    }
                  }}
                >
                  <i className="bi bi-x-circle" style={{ marginRight: '8px' }}></i>
                  Cancel
                </button>
                <button
                  onClick={confirmRecallTransfer}
                  disabled={recallSubmitting}
                  style={{
                    padding: '12px 24px',
                    border: 'none',
                    borderRadius: '8px',
                    background: recallSubmitting 
                      ? '#9ca3af' 
                      : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: recallSubmitting ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 3px 10px rgba(239, 68, 68, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                  onMouseOver={(e) => {
                    if (!recallSubmitting) {
                      e.target.style.transform = 'translateY(-1px)';
                      e.target.style.boxShadow = '0 4px 15px rgba(239, 68, 68, 0.4)';
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!recallSubmitting) {
                      e.target.style.transform = 'translateY(0)';
                      e.target.style.boxShadow = '0 3px 10px rgba(239, 68, 68, 0.3)';
                    }
                  }}
                >
                  {recallSubmitting ? (
                    <>
                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                      Recalling...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-check-circle"></i>
                      Confirm Recall
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Recall Confirmation Modal */}
      {showBulkRecallConfirm && selectedSubSection && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10001,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            maxWidth: '700px',
            width: '100%',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            overflow: 'hidden'
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
              padding: '20px 28px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <i className="bi bi-arrow-counterclockwise" style={{ fontSize: '22px', color: 'white' }}></i>
              <h3 style={{ margin: 0, color: 'white', fontSize: '18px', fontWeight: '600' }}>
                Confirm Bulk Recall ({selectedTransferredEmployeeIds.size} selected)
              </h3>
            </div>
            <div style={{ padding: '24px' }}>
              <p style={{ fontSize: '14px', color: '#374151', marginBottom: '12px' }}>
                You're about to recall the transfer for <strong>{selectedTransferredEmployeeIds.size}</strong> employee{selectedTransferredEmployeeIds.size !== 1 ? 's' : ''} from:
              </p>
              <div style={{ padding: '12px 16px', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}>
                <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '600' }}>{selectedSubSection?.subSection?.sub_hie_name || selectedSubSection?.subSection?.hie_name || 'N/A'}</div>
                <div style={{ fontSize: '13px', color: '#6b7280' }}>{selectedSubSection?.parentSection?.hie_name || 'Section: N/A'}</div>
                <div style={{ fontSize: '13px', color: '#6b7280' }}>{selectedSubSection?.parentDivision?.division_name || 'Division: N/A'}</div>
              </div>
              <div style={{ marginTop: '18px' }}>
                <strong style={{ color: '#374151' }}>Selected employees preview:</strong>
                <div style={{ marginTop: '8px', maxHeight: '160px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px' }}>
                  {Array.from(selectedTransferredEmployeeIds).slice(0, 10).map((id, idx) => {
                    const emp = transferredEmployeesList.find(e => String(e?.EMP_NUMBER || e?.empNumber || e?.EMP_ID || e?.emp_id || '') === id);
                    const name = emp?.FULLNAME || emp?.fullName || emp?.CALLING_NAME || emp?.calling_name || emp?.name || id;
                    return (
                      <div key={id + idx} style={{ padding: '6px 8px', borderBottom: '1px dashed #e5e7eb', fontSize: '13px' }}>{id} - {name}</div>
                    );
                  })}
                  {selectedTransferredEmployeeIds.size > 10 && (
                    <div style={{ padding: '6px 8px', color: '#6b7280', fontSize: '13px' }}>+ {selectedTransferredEmployeeIds.size - 10} more...</div>
                  )}
                </div>
              </div>
            </div>
            <div style={{ padding: '20px 28px', borderTop: '1px solid #e5e7eb', background: '#f9fafb', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => setShowBulkRecallConfirm(false)}
                disabled={bulkRecallSubmitting}
                style={{
                  padding: '10px 20px',
                  border: '2px solid #d1d5db',
                  borderRadius: '8px',
                  backgroundColor: 'white',
                  color: '#6b7280',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: bulkRecallSubmitting ? 'not-allowed' : 'pointer'
                }}
              >Cancel</button>
              <button
                onClick={confirmBulkRecall}
                disabled={bulkRecallSubmitting}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '8px',
                  background: bulkRecallSubmitting ? '#9ca3af' : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  color: 'white',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: bulkRecallSubmitting ? 'not-allowed' : 'pointer'
                }}
              >
                {bulkRecallSubmitting ? 'Recalling...' : `Confirm (${selectedTransferredEmployeeIds.size})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SectionManagement;