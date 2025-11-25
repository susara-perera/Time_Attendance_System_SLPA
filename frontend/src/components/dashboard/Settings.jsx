

import React, { useState, useEffect, useContext } from 'react';
import './settings-theme.css';
import { useLanguage } from '../../context/LanguageContext';
import { AuthContext } from '../../context/AuthContext';

const TOOLTIP = {
  systemName: 'The name displayed across the system.',
  timezone: 'Select the timezone for attendance records.',
  workingHours: 'Set the official working hours for employees.',
  emailNotifications: 'Enable or disable system email notifications.',
  autoLogout: 'Time in minutes before automatic logout due to inactivity.',
};

const Settings = () => {
  const formatAddress = (addr) => {
    if (!addr) return '';
    if (typeof addr === 'string') return addr;
    if (typeof addr === 'object') {
      return addr.city || addr.street || addr.address || addr.line1 || Object.values(addr).find(v => typeof v === 'string') || JSON.stringify(addr);
    }
    return String(addr);
  };
  const [settings, setSettings] = useState({
    systemName: 'Time Attendance System',
    timezone: 'Asia/Colombo',
    workingHours: {
      start: '09:00',
      end: '17:00',
    },
    emailNotifications: true,
    autoLogout: 30,
  });
  const [activeTab, setActiveTab] = useState('general');
  // Additional settings state
  const { lang, setLang, t } = useLanguage();
  const { user } = useContext(AuthContext);

  const hasSettingPerm = (permId) => {
    if (!user) return false;
    if (user.role === 'super_admin') return true;
    const s = user.permissions?.settings || {};
    // support boolean or string 'true' values
    return s[permId] === true || s[permId] === 'true' || false;
  };

  // Ensure activeTab defaults to the first permitted tab and cannot point to a tab the user
  // does not have permission for.
  useEffect(() => {
    const tabsOrder = ['profile', 'general', 'appearance', 'security'];
    const mapping = {
      profile: 'profile_update',
      general: 'settings_general',
      appearance: 'settings_appearance',
      security: 'settings_security'
    };
    // If current activeTab is not permitted, pick the first permitted tab
    if (!hasSettingPerm(mapping[activeTab])) {
      const firstAllowed = tabsOrder.find(t => hasSettingPerm(mapping[t]));
      if (firstAllowed) setActiveTab(firstAllowed);
    }
  }, [user, activeTab]);
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('appTheme') || 'Light';
    } catch (e) {
      return 'Light';
    }
  });
  const [password, setPassword] = useState('');
  const [notificationSound, setNotificationSound] = useState(true);
  const [exportType, setExportType] = useState('CSV');
  const [notificationEmails, setNotificationEmails] = useState(() => {
    try {
      const raw = localStorage.getItem('notificationEmails');
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  });
  const [newMail, setNewMail] = useState('');
  const [mailError, setMailError] = useState('');
  // Profile edit states
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSubmitting, setProfileSubmitting] = useState(false);
  const [profileMsg, setProfileMsg] = useState(null);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileFirstName, setProfileFirstName] = useState('');
  const [profileLastName, setProfileLastName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileAddress, setProfileAddress] = useState('');
  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  // Password change / verify states
  const [oldPassword, setOldPassword] = useState('');
  const [oldPasswordValid, setOldPasswordValid] = useState(false);
  const [oldPasswordChecking, setOldPasswordChecking] = useState(false);
  const [oldPasswordError, setOldPasswordError] = useState('');
  const [oldPasswordSuccess, setOldPasswordSuccess] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [changeMsg, setChangeMsg] = useState('');
  const [submittingPassword, setSubmittingPassword] = useState(false);
  const [changeSuccess, setChangeSuccess] = useState(false);
  const [showForgotForm, setShowForgotForm] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStatus, setForgotStatus] = useState(null);
  // OTP / reset flow states
  const [otpSent, setOtpSent] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [otpError, setOtpError] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [showResetForm, setShowResetForm] = useState(false);
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);
  const [resetStatus, setResetStatus] = useState(null);

  

  // Apply theme to document root and persist choice
  useEffect(() => {
    try {
      const mode = theme === 'Dark' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', mode);
      localStorage.setItem('appTheme', theme);
    } catch (e) {
      // ignore
    }
  }, [theme]);

  // Persist notification emails whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('notificationEmails', JSON.stringify(notificationEmails));
    } catch (e) {
      // ignore
    }
  }, [notificationEmails]);

  // Prevent background scroll when forgot-password modal is open
  useEffect(() => {
    if (showForgotForm) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [showForgotForm]);

  // Load profile when profile tab becomes active
  useEffect(() => {
    const loadProfile = async () => {
      setProfileLoading(true);
      setProfileMsg(null);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE_URL}/auth/me`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
          credentials: 'include'
        });
        if (res.ok) {
          const data = await res.json();
          const user = data.data;
          setProfileFirstName(user.firstName || '');
          setProfileLastName(user.lastName || '');
          setProfilePhone(user.phone || '');
          setProfileAddress(formatAddress(user.address));
        } else {
          setProfileMsg('Failed to load profile');
        }
      } catch (err) {
        console.error('Load profile error', err);
        setProfileMsg('Failed to load profile');
      } finally {
        setProfileLoading(false);
      }
    };

    if (activeTab === 'profile') {
      loadProfile();
    }
  }, [activeTab]);

  const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
  };

  const handleAddMail = () => {
    const mail = newMail.trim();
    if (!mail) {
      setMailError('Please enter an email address');
      return;
    }
    if (!validateEmail(mail)) {
      setMailError('Please enter a valid email address');
      return;
    }
    if (notificationEmails.includes(mail)) {
      setMailError('This email is already added');
      return;
    }
    setNotificationEmails((prev) => [...prev, mail]);
    setNewMail('');
    setMailError('');
  };

  const handleRemoveMail = (mailToRemove) => {
    setNotificationEmails((prev) => prev.filter((m) => m !== mailToRemove));
  };

  return (
    <div
      className="settings-page container-fluid"
      style={{ width: '100%', margin: '6px 0', padding: '12px 12px', boxSizing: 'border-box' }}
    >
      <div className="row">
        {/* Sidebar Navigation */}
        <div className="col-12 col-md-3 col-lg-2 mb-4">
          <div className="list-group shadow-sm" style={{ maxWidth: 220 }}>
            {hasSettingPerm('profile_update') && (
              <button
                className={`list-group-item list-group-item-action${activeTab === 'profile' ? ' active' : ''}`}
                onClick={() => setActiveTab('profile')}
              >
                <i className="bi bi-person me-2"></i> {t('profile')}
              </button>
            )}

            {hasSettingPerm('settings_general') && (
              <button
                className={`list-group-item list-group-item-action${activeTab === 'general' ? ' active' : ''}`}
                onClick={() => setActiveTab('general')}
              >
                <i className="bi bi-gear me-2"></i> {t('general')}
              </button>
            )}

            {hasSettingPerm('settings_appearance') && (
              <button
                className={`list-group-item list-group-item-action${activeTab === 'appearance' ? ' active' : ''}`}
                onClick={() => setActiveTab('appearance')}
              >
                <i className="bi bi-palette me-2"></i> {t('appearance')}
              </button>
            )}

            {hasSettingPerm('settings_security') && (
              <button
                className={`list-group-item list-group-item-action${activeTab === 'security' ? ' active' : ''}`}
                onClick={() => setActiveTab('security')}
              >
                <i className="bi bi-shield-lock me-2"></i> {t('security')}
              </button>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="col-12 col-md-9 col-lg-10">
          <div className="card shadow-sm mb-3" style={{ width: '100%' }}>
            <div className="card-body" style={{ padding: '18px 22px' }}>
              <h3 className="mb-0"><i className="bi bi-gear me-2"></i>{t('systemSettings')}</h3>
            </div>
          </div>
          {/* Subsection buttons are hidden when the user lacks their permissions. */}
          {activeTab === 'general' && (
            <div className="card shadow-sm" style={{ width: '100%' }}>
              <div className="card-body" style={{ padding: '22px' }}>
                <h5 className="fw-bold mb-4">{t('general')}</h5>
                {/* System Name */}
                <div className="mb-4">
                  <label className="form-label fw-bold">
                    {t('systemName')}
                    <span className="ms-1 text-muted" title={TOOLTIP.systemName}>
                      <i className="bi bi-info-circle"></i>
                    </span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={settings.systemName}
                    onChange={(e) => setSettings({ ...settings, systemName: e.target.value })}
                  />
                  <small className="form-text text-muted">{TOOLTIP.systemName}</small>
                </div>

                {/* Timezone */}
                <div className="mb-4">
                  <label className="form-label fw-bold">
                    {t('timezone')}
                    <span className="ms-1 text-muted" title={TOOLTIP.timezone}>
                      <i className="bi bi-info-circle"></i>
                    </span>
                  </label>
                  <select
                    className="form-select"
                    value={settings.timezone}
                    onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                  >
                    <option value="Asia/Colombo">Asia/Colombo</option>
                    <option value="UTC">UTC</option>
                  </select>
                  <small className="form-text text-muted">{TOOLTIP.timezone}</small>
                </div>

                {/* Working Hours */}
                <div className="mb-4 p-3 bg-light rounded" style={{ background: '#fafbfc' }}>
                  <h6 className="fw-bold mb-3">
                    <i className="bi bi-clock me-2"></i>{t('workingHours')}
                    <span className="ms-1 text-muted" title={TOOLTIP.workingHours}>
                      <i className="bi bi-info-circle"></i>
                    </span>
                  </h6>
                  <div className="row g-3">
                    <div className="col-12 col-sm-6">
                      <label className="form-label">{t('startTime')}</label>
                      <input
                        type="time"
                        className="form-control"
                        value={settings.workingHours.start}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            workingHours: { ...settings.workingHours, start: e.target.value },
                          })
                        }
                      />
                    </div>
                    <div className="col-12 col-sm-6">
                      <label className="form-label">{t('endTime')}</label>
                      <input
                        type="time"
                        className="form-control"
                        value={settings.workingHours.end}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            workingHours: { ...settings.workingHours, end: e.target.value },
                          })
                        }
                      />
                    </div>
                  </div>
                  <small className="form-text text-muted">{TOOLTIP.workingHours}</small>
                </div>

                {/* Language */}
                <div className="mb-4">
                  <label className="form-label fw-bold">{t('language')}</label>
                  <select
                    className="form-select"
                    value={lang}
                    onChange={(e) => setLang(e.target.value)}
                  >
                    <option value="en">English</option>
                    <option value="si">Sinhala</option>
                    <option value="ta">Tamil</option>
                  </select>
                  <small className="form-text text-muted">Select your preferred language.</small>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="card shadow-sm" style={{ width: '100%' }}>
              <div className="card-body" style={{ padding: '22px' }}>
                <h5 className="fw-bold mb-4">{t('profile')}</h5>
                {profileLoading ? (
                  <div className="text-muted">{t('loading')}</div>
                ) : (
                  <form onSubmit={async (e) => { e.preventDefault();
                    setProfileSubmitting(true); setProfileMsg(null);
                    try {
                      const token = localStorage.getItem('token');
                      const res = await fetch(`${API_BASE_URL}/auth/profile`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
                        credentials: 'include',
                        // normalize address to an object (backend accepts either string or object)
                        body: JSON.stringify({ firstName: profileFirstName, lastName: profileLastName, phone: profilePhone, address: profileAddress ? { city: profileAddress } : '' })
                      });
                      const data = await res.json();
                      if (res.ok) {
                        setProfileMsg(data.message || 'Profile updated');
                        setProfileSuccess(true);
                        setTimeout(() => setProfileSuccess(false), 3000);
                        // Notify AuthContext / other components about updated profile
                        try {
                          const updatedUser = data.data || null;
                          if (updatedUser && updatedUser.address) {
                            setProfileAddress(formatAddress(updatedUser.address));
                          }
                          window.dispatchEvent(new CustomEvent('profileUpdated', { detail: updatedUser }));
                        } catch (evErr) {
                          // ignore
                        }
                      } else {
                        setProfileMsg(data.message || 'Failed to update profile');
                        setProfileSuccess(false);
                      }
                    } catch (err) {
                      console.error('Update profile error', err);
                      setProfileMsg('Failed to update profile');
                      setProfileSuccess(false);
                    } finally {
                      setProfileSubmitting(false);
                    }
                  }}>
                    <div className="row g-3">
                      <div className="col-12 col-sm-6">
                        <label className="form-label">{t('firstName')}</label>
                        <input className="form-control" value={profileFirstName} onChange={(e) => setProfileFirstName(e.target.value)} />
                      </div>
                      <div className="col-12 col-sm-6">
                        <label className="form-label">{t('lastName')}</label>
                        <input className="form-control" value={profileLastName} onChange={(e) => setProfileLastName(e.target.value)} />
                      </div>
                      <div className="col-12 col-sm-6">
                        <label className="form-label">Phone</label>
                        <input className="form-control" value={profilePhone} onChange={(e) => setProfilePhone(e.target.value)} />
                      </div>
                      <div className="col-12">
                        <label className="form-label">Address</label>
                        <input className="form-control" value={profileAddress} onChange={(e) => setProfileAddress(e.target.value)} />
                      </div>
                    </div>
                    <div className="mt-3 d-flex gap-2">
                      <button className="btn btn-primary" type="submit" disabled={profileSubmitting}>{profileSubmitting ? t('loading') : t('saveChanges')}</button>
                      <button className="btn btn-outline-secondary" type="button" onClick={() => {
                        // reload profile
                        setActiveTab('profile');
                      }}>{t('cancel')}</button>
                    </div>
                    {profileMsg && <div className="mt-3" style={{ color: profileSuccess ? 'var(--bs-success)' : 'var(--bs-danger)' }}>{profileMsg}</div>}
                  </form>
                )}
              </div>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="card shadow-sm">
              <div className="card-body">
                <h5 className="fw-bold mb-4">{t('appearance')}</h5>
                <div className="mb-4">
                  <label className="form-label fw-bold">{t('theme')}</label>
                  <select
                    className="form-select"
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                  >
                    <option value="Light">Light</option>
                    <option value="Dark">Dark</option>
                  </select>
                  <small className="form-text text-muted">Choose your preferred theme.</small>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="card shadow-sm">
              <div className="card-body">
                <h5 className="fw-bold mb-4">{t('security')}</h5>

                <form onSubmit={(e) => e.preventDefault()}>
                  <div className="mb-3">
                    <label className="form-label fw-bold">{t('changePasswordTitle')}</label>

                    <div>
                      <input
                        type="password"
                        className="form-control"
                        placeholder={t('enterCurrentPasswordPlaceholder')}
                        value={oldPassword}
                        onChange={(e) => { setOldPassword(e.target.value); setOldPasswordValid(false); setChangeMsg(''); setOldPasswordError(''); }}
                        onBlur={async () => {
                          // auto-verify on blur
                          if (!oldPassword) return;
                          setOldPasswordChecking(true);
                          setOldPasswordError('');
                          try {
                            const token = localStorage.getItem('token');
                            const res = await fetch(`${API_BASE_URL}/auth/verify-password`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
                              credentials: 'include',
                              body: JSON.stringify({ password: oldPassword })
                            });
                              if (res.ok) {
                                setOldPasswordValid(true);
                                setOldPasswordSuccess(t('passwordVerifiedSuccess'));
                                // clear success after a short delay
                                setTimeout(() => setOldPasswordSuccess(''), 3000);
                              } else {
                                setOldPasswordValid(false);
                                setOldPasswordError(t('verifyPasswordFailed'));
                              }
                          } catch (err) {
                            console.error('Verify password error', err);
                            setOldPasswordValid(false);
                            setOldPasswordError(t('passwordChangeError'));
                          } finally {
                            setOldPasswordChecking(false);
                          }
                        }}
                      />
                      <div className="d-flex justify-content-between align-items-center mt-2">
                        <small className="form-text text-muted">{oldPasswordChecking ? t('verifyingPassword') : ''}</small>
                        <button type="button" className="btn btn-link p-0" onClick={() => setShowForgotForm(s => !s)}>{t('forgotPasswordText')}</button>
                      </div>
                      {oldPasswordError && <div className="mt-2 text-danger">{oldPasswordError}</div>}
                      {oldPasswordSuccess && <div className="mt-2 text-success">{oldPasswordSuccess}</div>}
                    </div>

                      <div className="mt-3">
                        <label className="form-label">{t('enterNewPasswordLabel')}</label>
                        <input
                          type="password"
                          className="form-control"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          disabled={!oldPasswordValid}
                        />
                      </div>

                      <div className="mt-3">
                        <label className="form-label">{t('confirmNewPasswordLabel')}</label>
                        <input
                          type="password"
                          className="form-control"
                          value={confirmNewPassword}
                          onChange={(e) => setConfirmNewPassword(e.target.value)}
                          disabled={!oldPasswordValid}
                        />
                      </div>

                      <div className="mt-3">
                        <button
                          className="btn btn-primary"
                          type="button"
                          disabled={submittingPassword || !oldPasswordValid}
                          onClick={async () => {
                            setChangeMsg('');
                            if (newPassword !== confirmNewPassword) {
                              setChangeMsg(t('passwordMismatch'));
                              return;
                            }
                            if (!oldPasswordValid) {
                              setChangeMsg(t('verifyPasswordFailed'));
                              return;
                            }
                            setSubmittingPassword(true);
                            try {
                              const token = localStorage.getItem('token');
                                const res = await fetch(`${API_BASE_URL}/auth/change-password`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
                                  credentials: 'include',
                                  body: JSON.stringify({ currentPassword: oldPassword, newPassword, confirmPassword: confirmNewPassword })
                                });
                              const data = await res.json();
                              if (res.ok) {
                                setChangeMsg(t('passwordChangedSuccess'));
                                setChangeSuccess(true);
                                setOldPassword('');
                                setNewPassword('');
                                setConfirmNewPassword('');
                                setOldPasswordValid(false);
                                // clear success after a short delay
                                setTimeout(() => setChangeSuccess(false), 4000);
                              } else {
                                setChangeMsg(data.message || t('passwordChangeError'));
                                setChangeSuccess(false);
                              }
                            } catch (err) {
                              console.error('Change password error', err);
                              setChangeMsg(t('passwordChangeError'));
                            } finally {
                              setSubmittingPassword(false);
                            }
                          }}
                        >
                          {submittingPassword ? t('verifyingPassword') : t('changePasswordButton')}
                        </button>
                      </div>

                    {changeMsg && (
                      <div className="mt-3" style={{ color: changeSuccess ? 'var(--bs-success)' : 'var(--bs-danger)' }}>
                        {changeMsg}
                      </div>
                    )}
                  </div>

                  {/* Forgot password modal (renders as overlay) */}
                  {showForgotForm && (
                    <div className="custom-modal-overlay" role="dialog" aria-modal="true" style={{ zIndex: 1080 }}>
                      <div className="custom-modal-backdrop" onClick={() => setShowForgotForm(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)' }} />
                      <div className="custom-modal-content" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', maxWidth: 640, width: '95%', background: '#fff', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', padding: 20 }}>
                        <div className="d-flex justify-content-between align-items-center mb-3">
                          <h5 className="mb-0">{t('forgotPasswordText')}</h5>
                          <button className="btn btn-sm btn-light" onClick={() => setShowForgotForm(false)}>×</button>
                        </div>
                        <div className="mb-2"><small className="text-muted">{t('forgotPasswordInstructions')}</small></div>
                        <div className="d-flex gap-2 align-items-start mb-3">
                          <input type="email" className="form-control" placeholder="you@company.com" value={forgotEmail} onChange={(e) => { setForgotEmail(e.target.value); setForgotStatus(null); }} style={{ maxWidth: 360 }} />
                          <button className="btn btn-secondary" onClick={async () => {
                            setForgotStatus(null);
                            setOtpError('');
                            setOtpSent(false);
                            setResetStatus(null);
                            try {
                              if (!forgotEmail) {
                                setForgotStatus('Please enter an email');
                                return;
                              }
                              const res = await fetch(`${API_BASE_URL}/auth/request-otp`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ email: forgotEmail })
                              });
                              const data = await res.json();
                              if (res.ok) {
                                setOtpSent(true);
                                setForgotStatus(data.message || t('resetEmailSentMsg'));
                                if (data.otp) setForgotStatus((prev) => prev + ` OTP: ${data.otp}`);
                              } else {
                                setForgotStatus(data.message || t('resetEmailSentMsg'));
                              }
                            } catch (err) {
                              console.error('Request OTP error', err);
                              setForgotStatus(t('passwordChangeError'));
                            }
                          }}>Send</button>
                        </div>
                        {forgotStatus && <div className="mb-2 text-muted">{forgotStatus}</div>}

                        {otpSent && (
                          <div className="mb-3 p-3 bg-light border rounded">
                            <label className="form-label fw-bold">Enter OTP</label>
                            <div className="d-flex gap-2">
                              <input type="text" className="form-control" placeholder="6-digit OTP" value={otpValue} onChange={(e) => { setOtpValue(e.target.value); setOtpError(''); }} style={{ maxWidth: 220 }} />
                              <button className="btn btn-primary" onClick={async () => {
                                setOtpError('');
                                setVerifyingOtp(true);
                                try {
                                  const res = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ email: forgotEmail, otp: otpValue })
                                  });
                                  const data = await res.json();
                                  if (res.ok) {
                                    if (data.resetToken) {
                                      setResetToken(data.resetToken);
                                      setShowResetForm(true);
                                      setResetStatus('OTP verified. You can now set a new password.');
                                    } else {
                                      setResetStatus(data.message || 'OTP verified. Check your email for reset link.');
                                    }
                                  } else {
                                    setOtpError(data.message || 'Invalid OTP');
                                  }
                                } catch (err) {
                                  console.error('Verify OTP error', err);
                                  setOtpError('Failed to verify OTP');
                                } finally {
                                  setVerifyingOtp(false);
                                }
                              }}>{verifyingOtp ? t('verifyingPassword') : 'Verify OTP'}</button>
                            </div>
                            {otpError && <div className="mt-2 text-danger">{otpError}</div>}
                            {resetStatus && <div className="mt-2 text-success">{resetStatus}</div>}
                          </div>
                        )}

                        {showResetForm && (
                          <div className="mb-0 p-3 bg-white border rounded">
                            <label className="form-label fw-bold">Reset Password</label>
                            <div className="mb-2">
                              <input type="password" className="form-control" placeholder={t('enterNewPasswordLabel')} value={resetNewPassword} onChange={(e) => setResetNewPassword(e.target.value)} />
                            </div>
                            <div className="mb-2">
                              <input type="password" className="form-control" placeholder={t('confirmNewPasswordLabel')} value={resetConfirmPassword} onChange={(e) => setResetConfirmPassword(e.target.value)} />
                            </div>
                            <div className="d-flex gap-2">
                              <button className="btn btn-success" onClick={async () => {
                                setResetStatus(null);
                                if (!resetNewPassword || !resetConfirmPassword) {
                                  setResetStatus('Please fill both password fields');
                                  return;
                                }
                                if (resetNewPassword !== resetConfirmPassword) {
                                  setResetStatus(t('passwordMismatch'));
                                  return;
                                }
                                setResettingPassword(true);
                                try {
                                  const tokenToUse = resetToken;
                                  const res = await fetch(`${API_BASE_URL}/auth/reset-password/${tokenToUse}`, {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ password: resetNewPassword })
                                  });
                                  const data = await res.json();
                                  if (res.ok) {
                                    setResetStatus(t('passwordChangedSuccess'));
                                    setShowForgotForm(false);
                                    // cleanup
                                    setShowResetForm(false);
                                    setOtpSent(false);
                                    setForgotEmail('');
                                    setOtpValue('');
                                    setResetNewPassword('');
                                    setResetConfirmPassword('');
                                  } else {
                                    setResetStatus(data.message || t('passwordChangeError'));
                                  }
                                } catch (err) {
                                  console.error('Reset password error', err);
                                  setResetStatus(t('passwordChangeError'));
                                } finally {
                                  setResettingPassword(false);
                                }
                              }} disabled={resettingPassword}>{resettingPassword ? t('verifyingPassword') : 'Reset Password'}</button>
                              <button className="btn btn-outline-secondary" onClick={() => { setShowResetForm(false); setResetToken(''); }}>{t('cancel')}</button>
                            </div>
                            {resetStatus && <div className="mt-2" style={{ color: resetStatus === t('passwordChangedSuccess') ? 'var(--bs-success)' : 'var(--bs-danger)' }}>{resetStatus}</div>}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </form>
              </div>
            </div>
          )}

          

          
        </div>
      </div>
    </div>
  );
};

export default Settings;