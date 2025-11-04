import React, { useState, useEffect, useMemo, useRef } from 'react';
import usePermission from '../../hooks/usePermission';

const SectionManagement = () => {
  const [sections, setSections] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isHrisSource, setIsHrisSource] = useState(true); // Read-only when showing HRIS data
  const [selectedDivision, setSelectedDivision] = useState(''); // division _id or 'all'
  const [searchQuery, setSearchQuery] = useState('');
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
  const [expandedSections, setExpandedSections] = useState({}); // { [sectionId]: boolean }
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
  // Toast popup state
  const [toast, setToast] = useState({ show: false, type: 'success', title: '', message: '' });
  const toastTimerRef = useRef(null);
  const canView = usePermission('sections', 'read');
  const canCreate = usePermission('sections', 'create');
  const canUpdate = usePermission('sections', 'update');
  const canDelete = usePermission('sections', 'delete');
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
    setToast({ show: true, type, title, message });
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
      const resp = await fetch(`${API_BASE_URL}/subsections?sectionId=${encodeURIComponent(sectionId)}`, {
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
    setEditingSubSection({ sectionId, subSection: item });
    setEditSubForm({
      name: item?.subSection?.hie_name || item?.subSection?.name || '',
      code: item?.subSection?.hie_code || item?.subSection?.code || ''
    });
    setEditSubErrors({});
    setShowEditSubModal(true);
  };

  const submitEditSubSection = async () => {
    if (!editingSubSection) return;
    
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
      return showToast({ type: 'error', title: 'Auth', message: 'Token missing. Please login.' });
    }

    try {
      const resp = await fetch(`${API_BASE_URL}/subsections/${editingSubSection.subSection._id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          hie_name: editSubForm.name.trim(), 
          hie_code: editSubForm.code.trim(),
          // Keep backward compatibility
          name: editSubForm.name.trim(), 
          code: editSubForm.code.trim() 
        })
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      
      setShowEditSubModal(false);
      setEditingSubSection(null);
      setEditSubForm({ name: '', code: '' });
      setEditSubSubmitting(false);
      
      setTimeout(() => {
        showToast({ type: 'success', title: 'Success!', message: 'Sub-section updated successfully.' });
      }, 150);
      
      await fetchSubSections(editingSubSection.sectionId, { force: true });
    } catch (e) {
      console.error('Edit sub-section failed:', e);
      setEditSubSubmitting(false);
      showToast({ type: 'error', title: 'Failed', message: 'Could not update sub-section.' });
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
    const { sectionId, subSectionId } = deleteTarget;
    const token = localStorage.getItem('token');
    if (!token) {
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
      return showToast({ type: 'error', title: 'Auth', message: 'Token missing. Please login.' });
    }
    try {
      const resp = await fetch(`${API_BASE_URL}/subsections/${subSectionId}`, {
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

  // Fetch transferred employees from MongoDB
  const fetchTransferredEmployees = async (subSectionId, token) => {
    try {
      console.log('🔍 Fetching transferred employees for subsection:', subSectionId);
      
      const response = await fetch(`${API_BASE_URL}/subsections/transferred/${subSectionId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      console.log('📡 Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('📦 Response data:', data);
        
        const transfers = data?.data || [];
        console.log('📊 Number of transfers found:', transfers.length);
        
        if (transfers.length > 0) {
          console.log('📋 Transfer records:', transfers);
        }
        
        // Update the transferred employees list
        const transferredIds = transfers.map(t => ({
          employeeId: t.employeeId,
          subSectionId: t.subSectionId
        }));
        
        console.log('🎯 Mapped transferred IDs:', transferredIds);
        
        setTransferredEmployees(prev => {
          // Remove old entries for this subsection first
          const filtered = prev.filter(t => t.subSectionId !== subSectionId);
          // Add new entries
          const updated = [...filtered, ...transferredIds];
          console.log('✅ Updated transferred employees list:', updated);
          return updated;
        });
      } else {
        console.error('❌ Failed to fetch transferred employees. Status:', response.status);
      }
    } catch (error) {
      console.error('❌ Error fetching transferred employees:', error);
      // Don't show error toast, just log it
    }
  };

  // Handle opening employee list modal
  const handleAddEmployeeToSubSection = async (subSection) => {
    setSelectedSubSection(subSection);
    setShowEmployeeModal(true);
    setEmployeeLoading(true);
    setEmployeeList([]);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token');
      }

      // Fetch already transferred employees for this subsection
      await fetchTransferredEmployees(subSection._id, token);

      // Get division and section info from the subsection
      const divisionCode = subSection?.parentDivision?.division_code || '';
      const divisionName = subSection?.parentDivision?.division_name || '';
      const sectionCode = subSection?.parentSection?.hie_code || '';
      const sectionName = subSection?.parentSection?.hie_name || '';

      console.log('🔍 Fetching employees from cache for:', { divisionCode, divisionName, sectionCode, sectionName });

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

      // Filter employees by matching division and section
      const filteredEmployees = allEmployees.filter(emp => {
        // Get employee's division info from various possible fields
        const empDivCode = emp?.HIE_CODE_3 || emp?.hie_code_3 || emp?.DIVISION_CODE || emp?.division_code || 
                          emp?.currentwork?.HIE_CODE_3 || emp?.currentwork?.DIVISION_CODE || '';
        const empDivName = emp?.HIE_NAME_3 || emp?.hie_name_3 || emp?.DIVISION_NAME || emp?.division_name || 
                          emp?.currentwork?.HIE_NAME_3 || emp?.currentwork?.DIVISION_NAME || '';
        
        // Get employee's section info from various possible fields
        const empSecCode = emp?.HIE_CODE_4 || emp?.hie_code_4 || emp?.SECTION_CODE || emp?.section_code || 
                          emp?.currentwork?.HIE_CODE_4 || emp?.currentwork?.SECTION_CODE || '';
        const empSecName = emp?.HIE_NAME_4 || emp?.hie_name_4 || emp?.SECTION_NAME || emp?.section_name || 
                          emp?.currentwork?.HIE_NAME_4 || emp?.currentwork?.SECTION_NAME || '';

        console.log('Employee check:', {
          empNumber: emp?.EMP_NUMBER || emp?.empNumber,
          empDivCode,
          empDivName,
          empSecCode,
          empSecName,
          targetDivCode: divisionCode,
          targetDivName: divisionName,
          targetSecCode: sectionCode,
          targetSecName: sectionName
        });

        // Match by code OR name (more flexible matching)
        const divisionMatch = (empDivCode && empDivCode === divisionCode) || 
                             (empDivName && empDivName === divisionName);
        const sectionMatch = (empSecCode && empSecCode === sectionCode) || 
                            (empSecName && empSecName === sectionName);

        return divisionMatch && sectionMatch;
      });

      console.log('✅ Filtered employees:', filteredEmployees.length);

      setEmployeeList(filteredEmployees);
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
  };

  // Handle transfer button click
  const handleTransferEmployee = (employee) => {
    setTransferEmployee(employee);
    setShowTransferConfirm(true);
  };

  // Confirm transfer and save to MongoDB
  const confirmTransferEmployee = async () => {
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
        employeeId: transferEmployee?.EMP_NUMBER || transferEmployee?.empNumber || transferEmployee?.EMP_ID || '',
        employeeName: transferEmployee?.FULLNAME || transferEmployee?.fullName || transferEmployee?.CALLING_NAME || '',
        division_code: selectedSubSection?.parentDivision?.division_code || '',
        division_name: selectedSubSection?.parentDivision?.division_name || '',
        hie_code: selectedSubSection?.parentSection?.hie_code || '',
        hie_name: selectedSubSection?.parentSection?.hie_name || '',
        subSectionId: selectedSubSection?._id || '',
        subSectionCode: selectedSubSection?.subSection?.hie_code || '',
        subSectionName: selectedSubSection?.subSection?.hie_name || '',
        transferredAt: new Date().toISOString(),
        employeeData: transferEmployee // Store full employee record
      };

      console.log('📤 Transferring employee:', transferData);

      // Save to MongoDB
      const response = await fetch(`${API_BASE_URL}/subsections/transfer`, {
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
      
      // Add employee to transferred list
      const newTransfer = {
        employeeId: transferData.employeeId,
        subSectionId: transferData.subSectionId
      };
      console.log('➕ Adding to transferred list:', newTransfer);
      
      setTransferredEmployees(prev => {
        const updated = [...prev, newTransfer];
        console.log('📋 Updated transferred employees:', updated);
        return updated;
      });
      
      setShowTransferConfirm(false);
      setTransferEmployee(null);
      setTransferSubmitting(false);

      showToast({ 
        type: 'success', 
        title: 'Success!', 
        message: `Employee ${transferData.employeeName} has been successfully transferred to ${transferData.subSectionName}!` 
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

  // Handle recall button click - show confirmation modal
  const handleRecallTransfer = (emp) => {
    setRecallEmployee(emp);
    setShowRecallConfirm(true);
  };

  // Confirm recall and delete from MongoDB
  const confirmRecallTransfer = async () => {
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
      console.log('🔄 Recalling transfer for:', { empId, subSectionId: selectedSubSection._id });

      const response = await fetch(`${API_BASE_URL}/subsections/recall-transfer`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          employeeId: empId,
          subSectionId: selectedSubSection._id
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();

      // Remove from transferred list
      setTransferredEmployees(prev => 
        prev.filter(t => !(t.employeeId === empId && t.subSectionId === selectedSubSection._id))
      );

      setShowRecallConfirm(false);
      setRecallEmployee(null);
      setRecallSubmitting(false);

      showToast({ 
        type: 'success', 
        title: 'Recalled!', 
        message: `Successfully recalled the transfer for ${empName}!` 
      });

      console.log('✅ Recall successful:', result);

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

  const cancelDeleteSubSection = () => {
    setShowDeleteConfirm(false);
    setDeleteTarget(null);
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

  // Fetch sections and divisions from HRIS APIs (read-only)
  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        console.error('No authentication token found');
        setLoading(false);
        return;
      }

      // Fetch both in parallel from HRIS
      const [sectionsResponse, divisionsResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/sections/hris`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        }),
        fetch(`${API_BASE_URL}/divisions/hris`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        })
      ]);

      if (sectionsResponse.ok) {
        const sData = await sectionsResponse.json();
        const rows = Array.isArray(sData?.data) ? sData.data : [];
        setRawSections(rows);
        const normalizedSections = rows.map((s) => {
          const divisionId = String(s?.division_id ?? s?.DIVISION_ID ?? s?.division_code ?? s?.DIVISION_CODE ?? s?.hie_relationship ?? '');
          const divisionName = s?.division_name ?? s?.DIVISION_NAME ?? '';
          const sectionId = String(s?._id ?? s?.id ?? s?.SECTION_ID ?? s?.code ?? s?.hie_code ?? s?.SECTION_CODE ?? s?.section_code ?? '');
          return {
            _id: sectionId,
            name: s?.name ?? s?.section_name ?? s?.SECTION_NAME ?? s?.hie_name ?? s?.hie_relationship ?? `Section ${sectionId}`,
            division: divisionName ? { _id: divisionId || undefined, name: divisionName } : (divisionId || ''),
            code: String(s?.code ?? s?.SECTION_CODE ?? s?.hie_code ?? s?.section_code ?? ''),
            divisionCode: String(s?.division_code ?? s?.DIVISION_CODE ?? ''),
            isActive: typeof s?.isActive === 'boolean' ? s.isActive : (typeof s?.active === 'boolean' ? s.active : true),
            status: s?.status ?? undefined,
            createdAt: s?.createdAt ?? s?.created_at ?? s?.CREATED_AT ?? s?.createdOn ?? s?.CREATED_ON ?? null,
            _raw: s,
          };
        }).sort((a, b) => a.name.localeCompare(b.name));
        setSections(normalizedSections);
        setIsHrisSource(true);
      } else {
        console.error('Failed to fetch HRIS sections:', sectionsResponse.status, sectionsResponse.statusText);
        setSections([]);
      }

      if (divisionsResponse.ok) {
        const dData = await divisionsResponse.json();
        const rows = Array.isArray(dData?.data) ? dData.data : [];
        setRawDivisions(rows);
        const normalizedDivisions = rows.map((d) => ({
          _id: String(d?._id ?? d?.id ?? d?.DIVISION_ID ?? d?.code ?? d?.hie_code ?? d?.DIVISION_CODE ?? ''),
          code: String(d?.code ?? d?.DIVISION_CODE ?? d?.hie_code ?? ''),
          name: d?.name ?? d?.DIVISION_NAME ?? d?.hie_name ?? d?.hie_relationship ?? 'Unknown Division',
          _raw: d,
        })).sort((a, b) => a.name.localeCompare(b.name));
        setDivisions(normalizedDivisions);
        // Set default to IS division if not chosen yet
        const defId = findDefaultDivisionId(normalizedDivisions);
        setSelectedDivision(prev => prev || defId);
      } else {
        console.error('Failed to fetch HRIS divisions:', divisionsResponse.status, divisionsResponse.statusText);
        setDivisions([]);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
    }
  };

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
    // Front-end permission safeguard
    if (!canCreate && !canUpdate) {
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
  const handleEdit = (section) => {
    console.log('Editing section:', section);
    setCurrentSection(section);
    setFormData({
      name: section.name || '',
      division: section.division?._id || section.division || ''
    });
    setFormErrors({});
    setShowEditModal(true);
  };

  // Handle delete section
  const handleDelete = async (section) => {
    if (window.confirm(`Are you sure you want to delete "${section.name}" section? This action cannot be undone.`)) {
      try {
        const token = localStorage.getItem('token');
        
        if (!token) {
          alert('Authentication token not found. Please log in again.');
          return;
        }

        const response = await fetch(`http://localhost:5000/api/sections/${section._id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        });

        if (response.ok) {
          console.log('Section deleted:', section._id);
          
          // Refresh data to get updated information
          await fetchData();
          alert('Section deleted successfully!');
        } else {
          let errorMessage = 'Unknown error';
          try {
            const errorData = await response.json();
            console.error('Failed to delete section:', response.status, errorData);
            
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
          
          alert(`Failed to delete section: ${errorMessage}`);
        }
      } catch (error) {
        console.error('Error deleting section:', error);
        alert('Error deleting section. Please try again.');
      }
    }
  };

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

      const payload = {
        parentDivision: {
          id: division._id || divId || '',
          division_code: rawDivision?.DIVISION_CODE || rawDivision?.division_code || division.code || parent.divisionCode || '',
          division_name: rawDivision?.DIVISION_NAME || rawDivision?.division_name || division.name || (typeof parent.division === 'object' ? parent.division?.name : ''),
        },
        parentSection: {
          id: parent._id,
          hie_code: rawSection?.hie_code || rawSection?.SECTION_CODE || rawSection?.code || parent.code || '',
          hie_name: rawSection?.hie_name || rawSection?.SECTION_NAME || rawSection?.name || parent.name || '',
        },
        subSection: {
          hie_name: subForm.name.trim(),
          hie_code: subForm.code.trim(),
        },
        hrisSnapshot: {
          division: rawDivision || null,
          section: rawSection || null,
        },
      };

      console.log('🔍 Subsection Payload:', JSON.stringify(payload, null, 2));

      const resp = await fetch(`${API_BASE_URL}/subsections`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (resp.ok) {
        let created;
        try { const j = await resp.json(); created = j?.data; } catch (_) {}
        closeSubModal();
        showToast({ type: 'success', title: 'Success', message: 'Sub-section created successfully.' });
        // Refresh and expand the parent section's sub-sections
        const parentId = subParentSection?._id;
        if (parentId) {
          await fetchSubSections(parentId, { force: true });
          // Keep collapsed by default as requested
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
  const handleAdd = () => {
    setCurrentSection(null);
    setFormData({ name: '', division: '' });
    setFormErrors({});
    setShowAddModal(true);
  };

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
  }, []);

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
          <div className="section-header">
            <h2><i className="bi bi-diagram-3"></i> Section Management</h2>
          </div>
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
    if (!q) return displayedSections;
    return displayedSections.filter(s => {
      const idStr = String(s._id || '');
      const nameKey = normalizeTextKey(s.name || '');
      return idStr.includes(q) || nameKey.includes(q);
    });
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
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .modal-overlay {
          backdrop-filter: blur(2px);
        }
      `}</style>
      {/* Professional Section Header */}
      <div className="section-header">
        <h2><i className="bi bi-diagram-3"></i> Section Management</h2>
      </div>



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
                <th>Status</th>
                <th>Created Date</th>
                <th>Sub Section</th>
              </tr>
            </thead>
            <tbody>
              {searchedSections.map(section => (
                <tr key={section._id}>
                  <td><strong>{section.name}</strong></td>
                  <td>
                    <span className="role-badge role-admin">
                      {getDivisionName(section.division)}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${(section.status === 'active' || section.isActive) ? 'status-active' : 'status-inactive'}`}>
                      {(section.status === 'active' || section.isActive) ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    {section.createdAt ? (parseHrisDate(section.createdAt) || 'N/A') : 'N/A'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button 
                        className="btn-professional btn-success"
                        onClick={canCreate ? () => handleCreateSubSection(section) : undefined}
                        title={!canCreate ? 'No permission to create sub sections' : 'Create Sub-Section'}
                        disabled={!canCreate}
                        style={{ padding: '8px 12px', fontSize: '12px', cursor: canCreate ? 'pointer' : 'not-allowed' }}
                      >
                        <i className="bi bi-plus"></i>
                      </button>
                      <button 
                        className="btn-professional btn-light"
                        onClick={() => toggleSubSections(section)}
                        title="View Sub-Sections"
                        style={{ padding: '8px 12px', fontSize: '12px' }}
                      >
                        <i className="bi bi-chevron-right"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {sections.length === 0 && (
          <div className="no-data">
            <p>No sections found. Click "Add Section" to create the first section.</p>
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
                  disabled={submitting || (!canCreate && !canUpdate)}
                  aria-disabled={submitting || (!canCreate && !canUpdate)}
                  title={!canCreate && !canUpdate ? 'You do not have permission to perform this action' : ''}
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
              {/* Parent Info Section */}
              <div style={{ 
                backgroundColor: '#f8f9ff', 
                borderRadius: '12px', 
                padding: '20px', 
                marginBottom: '20px',
                border: '1px solid #e1e5f2'
              }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '10px', 
                  marginBottom: '18px' 
                }}>
                  <i className="bi bi-info-circle-fill" style={{ color: '#667eea', fontSize: '16px' }}></i>
                  <h4 style={{ 
                    margin: 0, 
                    fontSize: '15px', 
                    fontWeight: '600', 
                    color: '#374151' 
                  }}>
                    Parent Structure Information
                  </h4>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  {/* Division Info */}
                  <div style={{ 
                    backgroundColor: 'white',
                    borderRadius: '8px',
                    padding: '16px',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                  }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px',
                      marginBottom: '12px'
                    }}>
                      <i className="bi bi-building" style={{ color: '#667eea', fontSize: '14px' }}></i>
                      <span style={{ 
                        fontSize: '13px', 
                        fontWeight: '700', 
                        color: '#6b7280', 
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>
                        Division
                      </span>
                    </div>
                    <div>
                      <div style={{ 
                        fontSize: '15px', 
                        fontWeight: '600', 
                        color: '#1f2937',
                        marginBottom: '6px'
                      }}>
                        {divisions.find(d => String(d._id) === String((typeof subParentSection.division === 'object' && subParentSection.division?._id) ? subParentSection.division._id : String(subParentSection.division || '')))?.name || (typeof subParentSection.division === 'object' ? subParentSection.division?.name : '') || 'N/A'}
                      </div>
                      <div style={{ 
                        fontSize: '12px', 
                        color: '#6b7280',
                        fontFamily: 'monospace',
                        backgroundColor: '#f3f4f6',
                        padding: '3px 6px',
                        borderRadius: '4px',
                        display: 'inline-block'
                      }}>
                        ID: {(() => { 
                          const d = divisions.find(d => String(d._id) === String((typeof subParentSection.division === 'object' && subParentSection.division?._id) ? subParentSection.division._id : String(subParentSection.division || '')));
                          return d?.code || d?._id || 'N/A';
                        })()}
                      </div>
                    </div>
                  </div>
                  
                  {/* Section Info */}
                  <div style={{ 
                    backgroundColor: 'white',
                    borderRadius: '8px',
                    padding: '16px',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                  }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px',
                      marginBottom: '12px'
                    }}>
                      <i className="bi bi-diagram-3" style={{ color: '#667eea', fontSize: '14px' }}></i>
                      <span style={{ 
                        fontSize: '13px', 
                        fontWeight: '700', 
                        color: '#6b7280', 
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>
                        Section
                      </span>
                    </div>
                    <div>
                      <div style={{ 
                        fontSize: '15px', 
                        fontWeight: '600', 
                        color: '#1f2937',
                        marginBottom: '6px'
                      }}>
                        {subParentSection.name || 'N/A'}
                      </div>
                      <div style={{ 
                        fontSize: '12px', 
                        color: '#6b7280',
                        fontFamily: 'monospace',
                        backgroundColor: '#f3f4f6',
                        padding: '3px 6px',
                        borderRadius: '4px',
                        display: 'inline-block'
                      }}>
                        ID: {subParentSection.code || subParentSection._id || 'N/A'}
                      </div>
                    </div>
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
            backgroundColor: 'rgba(0, 0, 0, 0.65)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 11500,
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            padding: '20px',
            boxSizing: 'border-box'
          }}
        >
          <div 
            className="modal-content" 
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#fff',
              borderRadius: '20px',
              boxShadow: '0 25px 80px rgba(0, 0, 0, 0.25)',
              width: '100%',
              maxWidth: '850px',
              maxHeight: 'calc(100vh - 40px)',
              position: 'relative',
              border: 'none',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Header */}
            <div 
              style={{ 
                background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #60a5fa 100%)',
                color: 'white',
                padding: '32px 40px',
                borderRadius: '20px 20px 0 0',
                position: 'relative',
                overflow: 'hidden',
                flexShrink: 0
              }}
            >
              {/* Decorative background elements */}
              <div style={{
                position: 'absolute',
                top: '-20%',
                right: '-5%',
                width: '250px',
                height: '250px',
                background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)',
                borderRadius: '50%',
                pointerEvents: 'none'
              }}></div>
              <div style={{
                position: 'absolute',
                bottom: '-30%',
                left: '-8%',
                width: '200px',
                height: '200px',
                background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
                borderRadius: '50%',
                pointerEvents: 'none'
              }}></div>

              <div style={{ position: 'relative', zIndex: 2 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div 
                      style={{ 
                        backgroundColor: 'rgba(255, 255, 255, 0.25)', 
                        borderRadius: '16px', 
                        padding: '16px',
                        backdropFilter: 'blur(10px)',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
                      }}
                    >
                      <i className="bi bi-pencil-square" style={{ fontSize: '32px', color: 'white' }}></i>
                    </div>
                    <div>
                      <h3 style={{ 
                        margin: 0, 
                        fontSize: '28px', 
                        fontWeight: '800', 
                        letterSpacing: '-0.8px',
                        textShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
                      }}>
                        Edit Sub-Section
                      </h3>
                    </div>
                  </div>
                  <button 
                    onClick={closeEditSubModal}
                    disabled={editSubSubmitting}
                    style={{ 
                      background: 'rgba(255, 255, 255, 0.2)',
                      border: '2px solid rgba(255, 255, 255, 0.3)',
                      borderRadius: '8px',
                      color: 'white',
                      cursor: editSubSubmitting ? 'not-allowed' : 'pointer',
                      padding: '8px',
                      fontSize: '18px',
                      width: '36px',
                      height: '36px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease',
                      backdropFilter: 'blur(10px)',
                      opacity: editSubSubmitting ? 0.5 : 1
                    }}
                    onMouseOver={(e) => {
                      if (!editSubSubmitting) {
                        e.target.style.background = 'rgba(255, 255, 255, 0.3)';
                        e.target.style.transform = 'scale(1.05)';
                      }
                    }}
                    onMouseOut={(e) => {
                      if (!editSubSubmitting) {
                        e.target.style.background = 'rgba(255, 255, 255, 0.2)';
                        e.target.style.transform = 'scale(1)';
                      }
                    }}
                  >
                    <i className="bi bi-x-lg"></i>
                  </button>
                </div>
              </div>
            </div>

            {/* Body */}
            <div style={{ 
              padding: '40px 40px 32px', 
              flex: 1,
              overflowY: 'auto',
              minHeight: 0,
              background: 'linear-gradient(to bottom, #ffffff 0%, #f9fafb 100%)'
            }}>
              <div style={{ display: 'grid', gap: '28px' }}>
                {/* Name Field */}
                <div>
                  <label style={{ 
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '15px', 
                    fontWeight: '700', 
                    color: '#1f2937', 
                    marginBottom: '12px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    <div style={{
                      background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                      borderRadius: '6px',
                      padding: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <i className="bi bi-type" style={{ color: 'white', fontSize: '14px' }}></i>
                    </div>
                    Sub-Section Name
                    <span style={{ color: '#ef4444', fontSize: '16px', marginLeft: '2px' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={editSubForm.name}
                    onChange={(e) => {
                      setEditSubForm({ ...editSubForm, name: e.target.value });
                      if (editSubErrors.name) setEditSubErrors({ ...editSubErrors, name: '' });
                    }}
                    placeholder="Enter sub-section name"
                    disabled={editSubSubmitting}
                    style={{
                      width: '100%',
                      padding: '16px 18px',
                      border: editSubErrors.name ? '2px solid #ef4444' : '2px solid #d1d5db',
                      borderRadius: '10px',
                      fontSize: '15px',
                      transition: 'all 0.2s ease',
                      backgroundColor: editSubSubmitting ? '#f3f4f6' : '#fff',
                      fontFamily: 'inherit',
                      outline: 'none',
                      boxSizing: 'border-box',
                      fontWeight: '500',
                      color: '#1f2937'
                    }}
                    onFocus={(e) => {
                      if (!editSubErrors.name && !editSubSubmitting) {
                        e.target.style.borderColor = '#3b82f6';
                        e.target.style.boxShadow = '0 0 0 4px rgba(59, 130, 246, 0.15)';
                      }
                    }}
                    onBlur={(e) => {
                      if (!editSubErrors.name) e.target.style.borderColor = '#d1d5db';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                  {editSubErrors.name && (
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px', 
                      color: '#dc2626', 
                      fontSize: '14px', 
                      marginTop: '10px',
                      fontWeight: '600',
                      padding: '10px 12px',
                      background: '#fee2e2',
                      borderRadius: '8px',
                      border: '1px solid #fecaca'
                    }}>
                      <i className="bi bi-exclamation-circle-fill"></i>
                      {editSubErrors.name}
                    </div>
                  )}
                </div>

                {/* Code Field */}
                <div>
                  <label style={{ 
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '15px', 
                    fontWeight: '700', 
                    color: '#1f2937', 
                    marginBottom: '12px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    <div style={{
                      background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                      borderRadius: '6px',
                      padding: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <i className="bi bi-hash" style={{ color: 'white', fontSize: '14px' }}></i>
                    </div>
                    Sub-Section Code/ID
                    <span style={{ color: '#ef4444', fontSize: '16px', marginLeft: '2px' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={editSubForm.code}
                    onChange={(e) => {
                      setEditSubForm({ ...editSubForm, code: e.target.value });
                      if (editSubErrors.code) setEditSubErrors({ ...editSubErrors, code: '' });
                    }}
                    placeholder="Enter unique code (e.g., SS-001)"
                    disabled={editSubSubmitting}
                    style={{
                      width: '100%',
                      padding: '16px 18px',
                      border: editSubErrors.code ? '2px solid #ef4444' : '2px solid #d1d5db',
                      borderRadius: '10px',
                      fontSize: '15px',
                      transition: 'all 0.2s ease',
                      backgroundColor: editSubSubmitting ? '#f3f4f6' : '#fff',
                      fontFamily: 'monospace',
                      outline: 'none',
                      boxSizing: 'border-box',
                      fontWeight: '600',
                      color: '#1f2937',
                      letterSpacing: '0.5px'
                    }}
                    onFocus={(e) => {
                      if (!editSubErrors.code && !editSubSubmitting) {
                        e.target.style.borderColor = '#3b82f6';
                        e.target.style.boxShadow = '0 0 0 4px rgba(59, 130, 246, 0.15)';
                      }
                    }}
                    onBlur={(e) => {
                      if (!editSubErrors.code) e.target.style.borderColor = '#d1d5db';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                  {editSubErrors.code && (
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px', 
                      color: '#dc2626', 
                      fontSize: '14px', 
                      marginTop: '10px',
                      fontWeight: '600',
                      padding: '10px 12px',
                      background: '#fee2e2',
                      borderRadius: '8px',
                      border: '1px solid #fecaca'
                    }}>
                      <i className="bi bi-exclamation-circle-fill"></i>
                      {editSubErrors.code}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ 
              padding: '18px 40px 20px',
              borderTop: '2px solid #e5e7eb',
              backgroundColor: '#f9fafb',
              display: 'flex', 
              gap: '10px', 
              justifyContent: 'flex-end',
              borderRadius: '0 0 20px 20px',
              flexShrink: 0
            }}>
              <button 
                onClick={closeEditSubModal} 
                disabled={editSubSubmitting}
                style={{
                  padding: '10px 20px',
                  border: '2px solid #d1d5db',
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

            {/* Parent Section & Division Info - Highlighted */}
            <div style={{
              padding: '24px 32px',
              background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)',
              borderBottom: '3px solid #667eea',
              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.1)',
              flexShrink: 0
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <div>
                  <div style={{ 
                    fontSize: '12px', 
                    fontWeight: '700', 
                    color: '#667eea', 
                    textTransform: 'uppercase',
                    letterSpacing: '0.8px',
                    marginBottom: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <i className="bi bi-building"></i>
                    Division
                  </div>
                  <div style={{
                    padding: '14px 18px',
                    background: 'white',
                    border: '2px solid #a5b4fc',
                    borderRadius: '10px',
                    fontSize: '16px',
                    fontWeight: '700',
                    color: '#1f2937',
                    boxShadow: '0 2px 6px rgba(102, 126, 234, 0.1)'
                  }}>
                    {getDivisionName(currentSectionForSubSections.division)}
                  </div>
                  {currentSectionForSubSections.divisionCode && (
                    <div style={{ 
                      marginTop: '8px', 
                      fontSize: '13px', 
                      color: '#4338ca',
                      fontFamily: 'monospace',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'white',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      width: 'fit-content'
                    }}>
                      <i className="bi bi-hash"></i>
                      Division ID: {currentSectionForSubSections.divisionCode}
                    </div>
                  )}
                </div>
                <div>
                  <div style={{ 
                    fontSize: '12px', 
                    fontWeight: '700', 
                    color: '#667eea', 
                    textTransform: 'uppercase',
                    letterSpacing: '0.8px',
                    marginBottom: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <i className="bi bi-diagram-3"></i>
                    Section
                  </div>
                  <div style={{
                    padding: '14px 18px',
                    background: 'white',
                    border: '2px solid #a5b4fc',
                    borderRadius: '10px',
                    fontSize: '16px',
                    fontWeight: '700',
                    color: '#1f2937',
                    boxShadow: '0 2px 6px rgba(102, 126, 234, 0.1)'
                  }}>
                    {currentSectionForSubSections.name}
                  </div>
                  {currentSectionForSubSections.code && (
                    <div style={{ 
                      marginTop: '8px', 
                      fontSize: '13px', 
                      color: '#4338ca',
                      fontFamily: 'monospace',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'white',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      width: 'fit-content'
                    }}>
                      <i className="bi bi-hash"></i>
                      Section ID: {currentSectionForSubSections.code}
                    </div>
                  )}
                </div>
              </div>
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
                            {ss?.subSection?.hie_name || ss?.subSection?.name || '-'}
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
                              {ss?.subSection?.hie_code || ss?.subSection?.code || '-'}
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
                                title="Add Employee"
                              >
                                <i className="bi bi-person-plus"></i>
                              </button>
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
                  Employee List - {selectedSubSection?.subSection?.hie_name || 'Sub-Section'}
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

            {/* Sub-section Info */}
            <div style={{
              padding: '20px 32px',
              borderBottom: '1px solid #e5e7eb',
              background: '#f9fafb'
            }}>
              <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Division</div>
                  <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '600' }}>
                    {selectedSubSection?.parentDivision?.division_name || 'N/A'}
                    <span style={{ marginLeft: '8px', color: '#667eea', fontSize: '12px' }}>
                      ({selectedSubSection?.parentDivision?.division_code || 'N/A'})
                    </span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Section</div>
                  <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '600' }}>
                    {selectedSubSection?.parentSection?.hie_name || 'N/A'}
                    <span style={{ marginLeft: '8px', color: '#667eea', fontSize: '12px' }}>
                      ({selectedSubSection?.parentSection?.hie_code || 'N/A'})
                    </span>
                  </div>
                </div>
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
              ) : employeeList.length === 0 ? (
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
                    No employees found for this division and section
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
                        <th style={{ padding: '14px 16px', textAlign: 'left', color: 'white', fontWeight: '600', fontSize: '13px' }}>
                          EMPLOYEE ID
                        </th>
                        <th style={{ padding: '14px 16px', textAlign: 'left', color: 'white', fontWeight: '600', fontSize: '13px' }}>
                          NAME
                        </th>
                        <th style={{ padding: '14px 16px', textAlign: 'center', color: 'white', fontWeight: '600', fontSize: '13px' }}>
                          ACTION
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {employeeList.map((emp, index) => {
                        const empId = emp?.EMP_NUMBER || emp?.empNumber || emp?.EMP_ID || emp?.emp_id;
                        const isTransferred = transferredEmployees.some(
                          te => te.employeeId === empId && te.subSectionId === selectedSubSection?._id
                        );
                        
                        return (
                          <tr 
                            key={empId || index}
                            style={{
                              borderBottom: index < employeeList.length - 1 ? '1px solid #e5e7eb' : 'none',
                              transition: 'all 0.2s ease'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.background = '#f9fafb'}
                            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <td style={{ padding: '12px 16px', fontSize: '14px', color: '#1f2937', fontWeight: '600' }}>
                              {empId || 'N/A'}
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: '14px', color: '#1f2937' }}>
                              {emp?.FULLNAME || emp?.fullName || emp?.CALLING_NAME || emp?.calling_name || emp?.name || 'N/A'}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                              {isTransferred ? (
                                <button
                                  onClick={() => handleRecallTransfer(emp)}
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
                              ) : (
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
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
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
                <strong style={{ color: '#1f2937' }}>{employeeList.length}</strong> employee{employeeList.length !== 1 ? 's' : ''} found
              </div>
              <button
                onClick={closeEmployeeModal}
                style={{
                  padding: '10px 24px',
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
                Close
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
                      <strong>Sub-Section:</strong> {selectedSubSection?.subSection?.hie_name || 'N/A'}
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
                      <strong>Sub-Section:</strong> {selectedSubSection?.subSection?.hie_name || 'N/A'}
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
    </div>
  );
};

export default SectionManagement;