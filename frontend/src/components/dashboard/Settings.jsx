import React, { useState } from 'react';

const Settings = () => {
  const [settings, setSettings] = useState({
    systemName: 'Time Attendance System',
    timezone: 'Asia/Colombo',
    workingHours: {
      start: '09:00',
      end: '17:00'
    },
    emailNotifications: true,
    autoLogout: 30
  });

  const handleSave = () => {
    console.log('Saving settings:', settings);
    // Implement save logic
  };

  return (
    <div className="settings">
      <div className="page-header">
        <h2><i className="bi bi-gear"></i> System Settings</h2>
        <button className="btn btn-success" onClick={handleSave}>
          <i className="bi bi-check-circle"></i> Save Changes
        </button>
      </div>

      <div className="settings-form">
        <div className="form-group">
          <label>System Name</label>
          <input 
            type="text"
            className="form-control"
            value={settings.systemName}
            onChange={(e) => setSettings({...settings, systemName: e.target.value})}
          />
        </div>

        <div className="form-group">
          <label>Timezone</label>
          <select 
            className="form-control"
            value={settings.timezone}
            onChange={(e) => setSettings({...settings, timezone: e.target.value})}
          >
            <option value="Asia/Colombo">Asia/Colombo</option>
            <option value="UTC">UTC</option>
          </select>
        </div>

        <div className="working-hours">
          <h5>Working Hours</h5>
          <div className="form-row">
            <div className="form-group">
              <label>Start Time</label>
              <input 
                type="time"
                className="form-control"
                value={settings.workingHours.start}
                onChange={(e) => setSettings({
                  ...settings, 
                  workingHours: {...settings.workingHours, start: e.target.value}
                })}
              />
            </div>
            <div className="form-group">
              <label>End Time</label>
              <input 
                type="time"
                className="form-control"
                value={settings.workingHours.end}
                onChange={(e) => setSettings({
                  ...settings, 
                  workingHours: {...settings.workingHours, end: e.target.value}
                })}
              />
            </div>
          </div>
        </div>

        <div className="form-group">
          <div className="form-check">
            <input 
              type="checkbox"
              className="form-check-input"
              checked={settings.emailNotifications}
              onChange={(e) => setSettings({...settings, emailNotifications: e.target.checked})}
            />
            <label className="form-check-label">
              Enable Email Notifications
            </label>
          </div>
        </div>

        <div className="form-group">
          <label>Auto Logout (minutes)</label>
          <input 
            type="number"
            className="form-control"
            value={settings.autoLogout}
            onChange={(e) => setSettings({...settings, autoLogout: parseInt(e.target.value)})}
          />
        </div>
      </div>
    </div>
  );
};

export default Settings;