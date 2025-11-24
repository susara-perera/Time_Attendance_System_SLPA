

import React, { useState, useEffect } from 'react';
import './settings-theme.css';
import { useLanguage } from '../../context/LanguageContext';

const TOOLTIP = {
  systemName: 'The name displayed across the system.',
  timezone: 'Select the timezone for attendance records.',
  workingHours: 'Set the official working hours for employees.',
  emailNotifications: 'Enable or disable system email notifications.',
  autoLogout: 'Time in minutes before automatic logout due to inactivity.',
};

const Settings = () => {
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
  const [saveStatus, setSaveStatus] = useState(null);
  // Additional settings state
  const { lang, setLang, t } = useLanguage();
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
  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  // Password change / verify states
  const [oldPassword, setOldPassword] = useState('');
  const [oldPasswordValid, setOldPasswordValid] = useState(false);
  const [oldPasswordChecking, setOldPasswordChecking] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [changeMsg, setChangeMsg] = useState('');
  const [submittingPassword, setSubmittingPassword] = useState(false);
  const [showForgotForm, setShowForgotForm] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStatus, setForgotStatus] = useState(null);

  const handleSave = () => {
    // Simulate save
    setSaveStatus('Saving...');
    setTimeout(() => {
      setSaveStatus('Settings saved successfully!');
      setTimeout(() => setSaveStatus(null), 2000);
    }, 1200);
    // Implement actual save logic here
  };

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
            <button
              className={`list-group-item list-group-item-action${activeTab === 'general' ? ' active' : ''}`}
              onClick={() => setActiveTab('general')}
            >
              <i className="bi bi-gear me-2"></i> {t('general')}
            </button>
            <button
              className={`list-group-item list-group-item-action${activeTab === 'appearance' ? ' active' : ''}`}
              onClick={() => setActiveTab('appearance')}
            >
              <i className="bi bi-palette me-2"></i> {t('appearance')}
            </button>
            <button
              className={`list-group-item list-group-item-action${activeTab === 'security' ? ' active' : ''}`}
              onClick={() => setActiveTab('security')}
            >
              <i className="bi bi-shield-lock me-2"></i> {t('security')}
            </button>
            <button
              className={`list-group-item list-group-item-action${activeTab === 'notifications' ? ' active' : ''}`}
              onClick={() => setActiveTab('notifications')}
            >
              <i className="bi bi-bell me-2"></i> {t('notifications')}
            </button>
            <button
              className={`list-group-item list-group-item-action${activeTab === 'export' ? ' active' : ''}`}
              onClick={() => setActiveTab('export')}
            >
              <i className="bi bi-file-earmark-arrow-down me-2"></i> {t('dataExport')}
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="col-12 col-md-9 col-lg-10">
          <div className="card shadow-sm mb-3" style={{ width: '100%' }}>
            <div className="card-body d-flex justify-content-between align-items-center" style={{ padding: '18px 22px' }}>
              <h3 className="mb-0"><i className="bi bi-gear me-2"></i>{t('systemSettings')}</h3>
              <button className="btn btn-success px-4" onClick={handleSave}>
                <i className="bi bi-check-circle me-1"></i> {t('saveChanges')}
              </button>
            </div>
            {saveStatus && (
              <div className="alert alert-info m-3 py-2 px-3" role="alert" style={{ marginTop: 8 }}>
                {saveStatus}
              </div>
            )}
          </div>
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

                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                          <input
                            type="password"
                            className="form-control"
                            placeholder={t('enterCurrentPasswordPlaceholder')}
                            value={oldPassword}
                            onChange={(e) => { setOldPassword(e.target.value); setOldPasswordValid(false); setChangeMsg(''); }}
                          />
                          <small className="form-text text-muted">
                            {oldPasswordChecking ? t('verifyingPassword') : ''}
                          </small>
                        </div>
                        <div>
                          <button
                            type="button"
                            className="btn btn-outline-primary"
                            onClick={async () => {
                              if (!oldPassword) {
                                setChangeMsg(t('enterCurrentPasswordPlaceholder'));
                                return;
                              }
                              setOldPasswordChecking(true);
                              setChangeMsg('');
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
                                  setChangeMsg('');
                                } else {
                                  setOldPasswordValid(false);
                                  setChangeMsg(t('verifyPasswordFailed'));
                                }
                              } catch (err) {
                                console.error('Verify password error', err);
                                setOldPasswordValid(false);
                                setChangeMsg(t('passwordChangeError'));
                              } finally {
                                setOldPasswordChecking(false);
                              }
                            }}
                          >
                            {oldPasswordChecking ? t('verifyingPassword') : 'Verify'}
                          </button>
                        </div>
                      </div>

                      <div className="mt-3">
                        <label className="form-label">{t('enterNewPasswordLabel')}</label>
                        <input
                          type="password"
                          className="form-control"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                        />
                      </div>

                      <div className="mt-3">
                        <label className="form-label">{t('confirmNewPasswordLabel')}</label>
                        <input
                          type="password"
                          className="form-control"
                          value={confirmNewPassword}
                          onChange={(e) => setConfirmNewPassword(e.target.value)}
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
                                body: JSON.stringify({ currentPassword: oldPassword, newPassword })
                              });
                              const data = await res.json();
                              if (res.ok) {
                                setChangeMsg(t('passwordChangedSuccess'));
                                setOldPassword('');
                                setNewPassword('');
                                setConfirmNewPassword('');
                                setOldPasswordValid(false);
                              } else {
                                setChangeMsg(data.message || t('passwordChangeError'));
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

                    {changeMsg && <div className="mt-3 text-danger">{changeMsg}</div>}
                  </div>

                  {showForgotForm && (
                    <div className="mb-3 p-3 bg-light rounded">
                      <label className="form-label fw-bold">{t('forgotPasswordText')}</label>
                      <div className="mb-2">
                        <small className="form-text text-muted">{t('forgotPasswordInstructions')}</small>
                      </div>
                      <div className="d-flex gap-2 align-items-start">
                        <input type="email" className="form-control" placeholder="you@company.com" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} style={{ maxWidth: 360 }} />
                        <button
                          className="btn btn-secondary"
                          onClick={async () => {
                            setForgotStatus(null);
                            try {
                              const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ email: forgotEmail })
                              });
                              const data = await res.json();
                              setForgotStatus(data.message || t('resetEmailSentMsg'));
                            } catch (err) {
                              console.error('Forgot password error', err);
                              setForgotStatus(t('passwordChangeError'));
                            }
                          }}
                        >Send</button>
                      </div>
                      {forgotStatus && <div className="mt-2 text-muted">{forgotStatus}</div>}
                    </div>
                  )}
                </form>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="card shadow-sm">
              <div className="card-body">
                <h5 className="fw-bold mb-4">{t('notifications')}</h5>
                <div className="form-check form-switch mb-4">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id="notificationSound"
                    checked={notificationSound}
                    onChange={(e) => setNotificationSound(e.target.checked)}
                  />
                  <label className="form-check-label fw-bold" htmlFor="notificationSound">
                    {t('enableNotificationSound')}
                  </label>
                  <small className="form-text text-muted">Play a sound for new notifications.</small>
                </div>

                {/* Notification emails list + add form */}
                <div className="mb-3">
                  <label className="form-label fw-bold">{t('notificationEmails')}</label>
                  <div className="d-flex align-items-start gap-2">
                    <input
                      type="email"
                      className="form-control"
                      placeholder="user@example.com"
                      value={newMail}
                      onChange={(e) => { setNewMail(e.target.value); setMailError(''); }}
                      style={{ maxWidth: 360 }}
                      aria-label="Add notification email"
                    />
                    <button className="btn btn-primary" onClick={handleAddMail} type="button">
                      {t('addMail')}
                    </button>
                  </div>
                  {mailError && <div className="text-danger mt-2">{mailError}</div>}

                  <div className="mt-3">
                    {notificationEmails.length === 0 && (
                      <div className="text-muted">{t('noEmails')}</div>
                    )}
                    <div className="d-flex flex-wrap gap-2 mt-2">
                      {notificationEmails.map((mail) => (
                        <div key={mail} className="badge bg-light border" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ color: 'var(--text-primary)' }}>{mail}</span>
                          <button className="btn btn-sm btn-outline-danger" onClick={() => handleRemoveMail(mail)} type="button">×</button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'export' && (
            <div className="card shadow-sm">
              <div className="card-body">
                <h5 className="fw-bold mb-4">{t('dataExport')}</h5>
                <div className="mb-4">
                  <label className="form-label fw-bold">Export Type</label>
                  <select
                    className="form-select"
                    value={exportType}
                    onChange={(e) => setExportType(e.target.value)}
                  >
                    <option value="CSV">CSV</option>
                    <option value="Excel">Excel</option>
                    <option value="PDF">PDF</option>
                  </select>
                  <small className="form-text text-muted">Choose the format for exporting your data.</small>
                </div>
                <button className="btn btn-primary">Export Now</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;