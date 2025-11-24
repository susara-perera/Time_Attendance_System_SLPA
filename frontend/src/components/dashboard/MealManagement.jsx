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
  const { t } = useLanguage();

  // Fetch divisions and sections on component mount
  useEffect(() => {
    fetchDivisions();
    fetchAllSections();
    fetchTodaysBookingsCount();
  }, []);

  // Fetch sections when division changes
  useEffect(() => {
    if (mealBooking.divisionId && mealBooking.divisionId !== 'all') {
      fetchSectionsByDivision(mealBooking.divisionId);
    } else {
      setSections(allSections);
      setMealBooking(prev => ({ ...prev, sectionId: '' }));
    }
  }, [mealBooking.divisionId, allSections]);

  const fetchDivisions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/mysql/divisions', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Divisions API response:', data);
        
        // Handle different response structures
        if (data.data) {
          setDivisions(data.data);
        } else if (data.divisions) {
          setDivisions(data.divisions);
        } else if (Array.isArray(data)) {
          setDivisions(data);
        } else {
          console.error('Unexpected divisions response structure:', data);
          setDivisions([]);
        }
      } else {
        console.error('Failed to fetch divisions:', response.status, response.statusText);
      }
    } catch (err) {
      console.error('Error fetching divisions:', err);
      setMessage(t('errorFetchingDivisions'));
      setMessageType('error');
    }
  };

  const fetchAllSections = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/mysql/sections', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Sections API response:', data);
        
        // Handle different response structures
        if (data.data) {
          setAllSections(data.data);
          setSections(data.data);
        } else if (data.sections) {
          setAllSections(data.sections);
          setSections(data.sections);
        } else if (Array.isArray(data)) {
          setAllSections(data);
          setSections(data);
        } else {
          console.error('Unexpected sections response structure:', data);
          setAllSections([]);
          setSections([]);
        }
      } else {
        console.error('Failed to fetch sections:', response.status, response.statusText);
      }
    } catch (err) {
      console.error('Error fetching sections:', err);
      setMessage(t('errorFetchingSections'));
      setMessageType('error');
    }
  };

  const fetchSectionsByDivision = async (divisionId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/mysql/sections?division_id=${divisionId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Sections by division API response:', data);
        
        // Handle different response structures
        if (data.data) {
          setSections(data.data);
        } else if (data.sections) {
          setSections(data.sections);
        } else if (Array.isArray(data)) {
          setSections(data);
        } else {
          console.error('Unexpected sections by division response structure:', data);
          setSections([]);
        }
      } else {
        console.error('Failed to fetch sections by division:', response.status, response.statusText);
      }
    } catch (err) {
      console.error('Error fetching sections by division:', err);
    }
  };

  const fetchTodaysBookingsCount = async () => {
    try {
      const token = localStorage.getItem('token');
      const today = new Date().toISOString().split('T')[0];
      const requestData = {
        startDate: today,
        endDate: today,
        filters: {},
        groupBy: 'user'
      };

      const response = await fetch('http://localhost:5000/api/reports/meal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestData)
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setTodaysBookings(data.data?.length || 0);
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
        mealType: mealBooking.mealType,
        mealTime: new Date(`${mealBooking.mealDate}T12:00:00`),
        location: 'cafeteria',
        items: [{
          name: 'Standard Meal',
          category: 'main_course',
          quantity: parseInt(mealBooking.quantity),
          unit: 'serving',
          price: 0,
          calories: 0
        }],
        totalAmount: 0,
        paymentMethod: 'company_sponsored',
        paymentStatus: 'paid',
        specialRequirements: mealBooking.specialRequirements,
        // Add division and section information
        divisionId: mealBooking.divisionId,
        divisionName: selectedDivision?.division_name || '',
        sectionId: mealBooking.sectionId,
        sectionName: selectedSection?.section_name || ''
      };

      const response = await fetch('http://localhost:5000/api/meals', {
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default MealManagement;
