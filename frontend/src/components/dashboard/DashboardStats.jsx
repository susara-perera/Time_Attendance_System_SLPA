import React, { useEffect, useState } from 'react';
import './DashboardStats.css';
import './loading-overlay.css';

import TotalEmployeesCard from './widgets/TotalEmployeesCard';
import TotalDivisionsCard from './widgets/TotalDivisionsCard';
import TotalSectionsCard from './widgets/TotalSectionsCard';
import TotalSubSectionsCard from './widgets/TotalSubSectionsCard';
import AttendanceTrendChart from './widgets/AttendanceTrendChart';
import RecentActivitiesCard from './widgets/RecentActivitiesCard';
import ISDivisionAttendanceCard from './widgets/ISDivisionAttendanceCard';

const DashboardStats = ({ onQuickAction }) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  // Sequential load control (required order):
  // divisions -> sections -> subsections -> employees -> attendance trend -> recent activities -> IS division attendance
  const [loadIndex, setLoadIndex] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  // Auto-refresh on mount (every time user navigates to dashboard)
  useEffect(() => {
    setLoadIndex(0);
    setRefreshKey(k => k + 1);
  }, []);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleRefresh = () => {
    setLoadIndex(0);
    setRefreshKey(k => k + 1);
  };

  return (
    <div className="dashboard-stats-container">
      {/* Header Section */}
      <div className="stats-header">
        <div className="stats-header-content">
          <div className="header-title-section">
            <h1 className="stats-title">
              <span className="title-icon">
                <i className="bi bi-speedometer2"></i>
              </span>
              Dashboard Overview
            </h1>
            <p className="stats-subtitle">
              Real-time insights and analytics for your attendance system
            </p>
          </div>
          <div className="header-time-section">
            <div className="live-clock">
              <span className="clock-date">
                {currentTime.toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </span>
            </div>
            <button className="refresh-btn" onClick={handleRefresh} title="Refresh Data">
              <i className="bi bi-arrow-clockwise"></i>
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards Grid - Enhanced Modern Design */}
      <div className="stats-cards-grid">
        <TotalDivisionsCard
          enabled={loadIndex >= 0}
          refreshKey={refreshKey}
          onLoaded={() => setLoadIndex(i => Math.max(i, 1))}
        />
        <TotalSectionsCard
          enabled={loadIndex >= 1}
          refreshKey={refreshKey}
          onLoaded={() => setLoadIndex(i => Math.max(i, 2))}
        />
        <TotalSubSectionsCard
          enabled={loadIndex >= 2}
          refreshKey={refreshKey}
          onLoaded={() => setLoadIndex(i => Math.max(i, 3))}
        />
        <TotalEmployeesCard
          enabled={loadIndex >= 3}
          refreshKey={refreshKey}
          onLoaded={() => setLoadIndex(i => Math.max(i, 4))}
        />
      </div>

      {/* Charts and Progress Section */}
      <div className="charts-section">
        <AttendanceTrendChart
          enabled={loadIndex >= 4}
          refreshKey={refreshKey}
          onLoaded={() => setLoadIndex(i => Math.max(i, 5))}
        />

        <ISDivisionAttendanceCard
          enabled={loadIndex >= 6}
          refreshKey={refreshKey}
          onLoaded={() => setLoadIndex(i => Math.max(i, 6))}
        />
      </div>

      <RecentActivitiesCard
        enabled={loadIndex >= 5}
        refreshKey={refreshKey}
        onLoaded={() => setLoadIndex(i => Math.max(i, 6))}
      />

    </div>

  );
};

export default DashboardStats;
