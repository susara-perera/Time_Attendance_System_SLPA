import React, { useState, useEffect } from 'react';
import './MealManagement.css';
import { useLanguage } from '../../context/LanguageContext';

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
<<<<<<< HEAD
  const { t } = useLanguage();
=======
  const [userInfo, setUserInfo] = useState(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [showBookingsReport, setShowBookingsReport] = useState(false);
  const [showCountReport, setShowCountReport] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [showPreferenceModal, setShowPreferenceModal] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [mealPreference, setMealPreference] = useState('meal');
>>>>>>> 7dbbc37b950156431cf1a19ea88cac62dc0e4c77

  // Fetch divisions and sections on component mount
  useEffect(() => {
    fetchUserInfo();
    fetchDivisions();
    fetchAllSections();
    fetchTodaysBookingsCount();
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

  const handleSearchEmployee = async () => {
    if (!employeeSearch.trim()) {
      setMessage('Please enter employee ID or name');
      setMessageType('error');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/hris/employees/search?query=${encodeURIComponent(employeeSearch)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        setSearchResults(result.data || []);
        if (result.data.length === 0) {
          setMessage('No employees found');
          setMessageType('error');
        }
      } else {
        setMessage('Error searching employees');
        setMessageType('error');
      }
    } catch (error) {
      console.error('Employee search error:', error);
      setMessage('Network error occurred');
      setMessageType('error');
    }
  };

  const handleSetMealPreference = async () => {
    if (!selectedEmployee) {
      setMessage('Please select an employee');
      setMessageType('error');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/meals/preference', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          employeeId: selectedEmployee.emp_no || selectedEmployee.employeeId,
          employeeName: selectedEmployee.name || selectedEmployee.employeeName,
          preference: mealPreference,
          divisionId: selectedEmployee.division_id || userInfo?.division?.id,
          sectionId: selectedEmployee.section_id || userInfo?.section?.id
        })
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        setMessage(`Employee meal preference set to ${mealPreference === 'meal' ? 'Physical Meal' : 'Meal Allowance'} successfully!`);
        setMessageType('success');
        setShowPreferenceModal(false);
        setEmployeeSearch('');
        setSearchResults([]);
        setSelectedEmployee(null);
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage(result.message || 'Error setting preference');
        setMessageType('error');
      }
    } catch (error) {
      console.error('Set preference error:', error);
      setMessage('Network error occurred');
      setMessageType('error');
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
      {/* Professional Section Header (like UserManagement, no colors) */}
      <div className="section-header" style={{ marginBottom: '32px', padding: '32px 0 16px 0', borderBottom: '2px solid #eee', background: 'none', boxShadow: 'none', borderRadius: '0', textAlign: 'left' }}>
        <h2 style={{ fontSize: '2.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <i className="bi bi-utensils" style={{ fontSize: '2rem' }}></i>
          {t('mealManagementTitle')}
        </h2>
      </div>

      {message && (
        <div className={`alert alert-${messageType === 'success' ? 'success' : 'danger'} alert-professional alert-dismissible fade show`}>
          <strong>{messageType === 'success' ? 'Success!' : 'Error!'}</strong> {message}
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
                          {section.section_name}
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
                className="btn btn-warning w-100" 
                onClick={() => setShowPreferenceModal(true)}
              >
                <i className="bi bi-gear"></i> Set Meal Preference
              </button>
            </div>
          </div>
        </div>

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
            <div className="modal-dialog modal-lg">
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
                      setSearchResults([]);
                      setSelectedEmployee(null);
                    }}
                  ></button>
                </div>
                <div className="modal-body">
                  <div className="alert alert-info">
                    <i className="bi bi-info-circle"></i> Choose whether employees receive physical meals or meal allowance money
                  </div>

                  {/* Employee Search */}
                  <div className="mb-3">
                    <label className="form-label fw-bold">Search Employee</label>
                    <div className="input-group">
                      <input 
                        type="text"
                        className="form-control"
                        placeholder="Enter employee ID or name..."
                        value={employeeSearch}
                        onChange={(e) => setEmployeeSearch(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSearchEmployee()}
                      />
                      <button 
                        className="btn btn-primary" 
                        onClick={handleSearchEmployee}
                      >
                        <i className="bi bi-search"></i> Search
                      </button>
                    </div>
                  </div>

                  {/* Search Results */}
                  {searchResults.length > 0 && (
                    <div className="mb-3">
                      <label className="form-label fw-bold">Select Employee</label>
                      <div className="list-group" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                        {searchResults.map((emp) => (
                          <button
                            key={emp.emp_no || emp.employeeId}
                            className={`list-group-item list-group-item-action ${selectedEmployee?.emp_no === emp.emp_no ? 'active' : ''}`}
                            onClick={() => setSelectedEmployee(emp)}
                          >
                            <div className="d-flex justify-content-between">
                              <div>
                                <strong>{emp.emp_no || emp.employeeId}</strong> - {emp.name || emp.employeeName}
                              </div>
                              <small className="text-muted">{emp.section_name || 'N/A'}</small>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Selected Employee */}
                  {selectedEmployee && (
                    <div className="alert alert-success">
                      <strong>Selected:</strong> {selectedEmployee.emp_no || selectedEmployee.employeeId} - {selectedEmployee.name || selectedEmployee.employeeName}
                    </div>
                  )}

                  {/* Preference Selection */}
                  <div className="mb-3">
                    <label className="form-label fw-bold">Meal Preference</label>
                    <div className="row">
                      <div className="col-md-6">
                        <div 
                          className={`card ${mealPreference === 'meal' ? 'border-primary border-3' : ''}`}
                          style={{ cursor: 'pointer' }}
                          onClick={() => setMealPreference('meal')}
                        >
                          <div className="card-body text-center">
                            <i className="bi bi-egg-fried fs-1 text-primary"></i>
                            <h5 className="mt-2">Physical Meal</h5>
                            <p className="text-muted small">Employee receives actual meal from cafeteria</p>
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
                            <h5 className="mt-2">Meal Allowance</h5>
                            <p className="text-muted small">Employee receives money instead of meal</p>
                            {mealPreference === 'money' && (
                              <i className="bi bi-check-circle-fill text-success fs-4"></i>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={() => {
                      setShowPreferenceModal(false);
                      setEmployeeSearch('');
                      setSearchResults([]);
                      setSelectedEmployee(null);
                    }}
                  >
                    Cancel
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-primary" 
                    onClick={handleSetMealPreference}
                    disabled={!selectedEmployee}
                  >
                    <i className="bi bi-check-circle"></i> Save Preference
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
