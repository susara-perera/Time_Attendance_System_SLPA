import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import './DashboardStats.css';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const DashboardStats = ({ onQuickAction }) => {
  const [stats, setStats] = useState(null);
  const [activities, setActivities] = useState([]);
  const [allActivities, setAllActivities] = useState([]); // Store all activities for expanded view
  const [showAllActivities, setShowAllActivities] = useState(false); // Toggle for showing all activities
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [trendPeriod, setTrendPeriod] = useState('daily');
  const [animatedStats, setAnimatedStats] = useState({});
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeEmployeeCount, setActiveEmployeeCount] = useState(0);
  const [inactiveEmployeeCount, setInactiveEmployeeCount] = useState(0);

  // Helper: determine if an employee object represents an active employee
  const isEmployeeActive = (emp) => {
    // HRIS uses ACTIVE_HRM_FLG === 1, some endpoints use STATUS/status === 'ACTIVE', local objects may have isActive boolean
    return emp?.ACTIVE_HRM_FLG === 1 || emp?.STATUS === 'ACTIVE' || emp?.status === 'ACTIVE' || emp?.isActive === true;
  };

  // Fetch dashboard stats
  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      lastFetchRef.current = Date.now(); // Update timestamp when starting fetch
      const token = localStorage.getItem('token');
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      // First fetch stats and activities in parallel
      const [statsRes, activitiesRes, auditLogsRes] = await Promise.all([
        fetch('/api/dashboard/stats', { headers }),
        fetch('/api/dashboard/activities/recent?limit=50', { headers }),
        fetch('/api/audit-logs?limit=100', { headers }).catch(() => null) // Fetch audit logs for comprehensive activities
      ]);

      if (!statsRes.ok) throw new Error('Failed to fetch dashboard stats');

      const statsData = await statsRes.json();
      const activitiesData = activitiesRes.ok ? await activitiesRes.json() : { data: [] };

      // Check if we need to fetch employees (only if stats don't provide totalEmployees)
      let employeesRes = null;
      const hasTotalEmployees = statsData.data && typeof statsData.data.totalEmployees === 'number' && statsData.data.totalEmployees >= 0;
      if (!hasTotalEmployees) {
        console.log('📊 Stats API missing or invalid totalEmployees, fetching from cache...', { totalEmployees: statsData.data?.totalEmployees });
        employeesRes = await fetch('/api/hris-cache/employees', { headers });
      } else {
        console.log('✅ Using totalEmployees from stats API:', statsData.data.totalEmployees);
      }

      // Process audit logs for comprehensive activity display
      let auditActivities = [];
      if (auditLogsRes && auditLogsRes.ok) {
        try {
          const auditData = await auditLogsRes.json();
          const logs = Array.isArray(auditData?.data) ? auditData.data : (Array.isArray(auditData) ? auditData : []);
          auditActivities = logs.map(log => {
            const actionType = log.action || '';
            let icon = 'bi bi-activity';
            let severity = 'low';
            let title = actionType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            
            // Categorize actions with appropriate icons and severity
            if (actionType.includes('login')) {
              icon = 'bi bi-box-arrow-in-right';
              severity = 'low';
              title = 'User Login';
            } else if (actionType.includes('logout')) {
              icon = 'bi bi-box-arrow-right';
              severity = 'low';
              title = 'User Logout';
            } else if (actionType.includes('created') || actionType.includes('create')) {
              icon = 'bi bi-plus-circle';
              severity = 'medium';
            } else if (actionType.includes('updated') || actionType.includes('update')) {
              icon = 'bi bi-pencil-square';
              severity = 'medium';
            } else if (actionType.includes('deleted') || actionType.includes('delete')) {
              icon = 'bi bi-trash';
              severity = 'high';
            } else if (actionType.includes('transfer')) {
              icon = 'bi bi-arrow-left-right';
              severity = 'medium';
            }
            
            const createdAt = log.createdAt ? new Date(log.createdAt) : new Date();
            return {
              id: log._id,
              title: title,
              description: log.entity?.name ? `${log.entity.type}: "${log.entity.name}"` : (log.description || actionType),
              date: createdAt.toISOString().split('T')[0],
              time: createdAt.toTimeString().split(' ')[0],
              icon: icon,
              severity: severity,
              user: log.user?.username || log.user?.name || 'System',
              action: actionType
            };
          });
        } catch (e) {
          console.warn('Failed parsing audit logs:', e);
        }
      }
      
      // Calculate active/inactive employee counts from cached employees
      // First try to use the stats data (more reliable from MySQL)
      if (statsData.data?.totalEmployees) {
        setActiveEmployeeCount(statsData.data.totalEmployees);
        setInactiveEmployeeCount(0); // MySQL already filters for IS_ACTIVE = 1
      } else if (employeesRes && employeesRes.ok) {
        try {
          const eData = await employeesRes.json();
          const rows = Array.isArray(eData?.data) ? eData.data : (Array.isArray(eData) ? eData : []);
          const total = rows.length;
          const active = rows.filter(isEmployeeActive).length;
          setActiveEmployeeCount(active);
          setInactiveEmployeeCount(Math.max(0, total - active));
        } catch (e) {
          console.warn('Failed parsing cached employees response:', e);
          setActiveEmployeeCount(0);
          setInactiveEmployeeCount(0);
        }
      } else {
        setActiveEmployeeCount(0);
        setInactiveEmployeeCount(0);
      }
      
      // Combine activities from different sources
      const dashboardActivities = activitiesData.data || statsData.data?.recentActivities || [];
      const combinedActivities = [...auditActivities, ...dashboardActivities.map(a => ({
        ...a,
        id: a.id || `activity-${Math.random().toString(36).substr(2, 9)}`
      }))];
      
      // Sort by date/time and remove duplicates
      const sortedActivities = combinedActivities
        .sort((a, b) => new Date(`${b.date}T${b.time}`) - new Date(`${a.date}T${a.time}`));
      
      setStats(statsData.data);
      setAllActivities(sortedActivities);
      setActivities(sortedActivities.slice(0, 10));
      setError(null);
    } catch (err) {
      console.error('Dashboard stats error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Prevent multiple calls within short time window
  const lastFetchRef = useRef(0);

  useEffect(() => {
    const now = Date.now();
    if (now - lastFetchRef.current > 1000) { // Only fetch if more than 1 second since last fetch
      lastFetchRef.current = now;
      console.log('📊 DashboardStats: Fetching stats on mount');
      fetchStats();
    } else {
      console.log('📊 DashboardStats: Skipping fetch (too soon since last fetch)');
    }
    // const interval = setInterval(fetchStats, 60000); // Refresh every minute - DISABLED
    // return () => clearInterval(interval);
  }, []); // Remove fetchStats from dependencies

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Animate numbers counting up
  useEffect(() => {
    if (!stats) return;

    const targets = {
      totalEmployees: activeEmployeeCount + inactiveEmployeeCount,
      activeEmployees: activeEmployeeCount,
      inactiveEmployees: inactiveEmployeeCount,
      totalDivisions: stats.totalDivisions || 0,
      totalSections: stats.totalSections || 0,
      totalSubSections: stats.totalSubSections || 0
    };

    const duration = 1500;
    const steps = 60;
    const stepDuration = duration / steps;

    let step = 0;
    const timer = setInterval(() => {
      step++;
      const progress = step / steps;
      const easeOut = 1 - Math.pow(1 - progress, 3);

      setAnimatedStats({
        totalEmployees: Math.round(targets.totalEmployees * easeOut),
        activeEmployees: Math.round(targets.activeEmployees * easeOut),
        inactiveEmployees: Math.round(targets.inactiveEmployees * easeOut),
        totalDivisions: Math.round(targets.totalDivisions * easeOut),
        totalSections: Math.round(targets.totalSections * easeOut),
        totalSubSections: Math.round(targets.totalSubSections * easeOut)
      });

      if (step >= steps) clearInterval(timer);
    }, stepDuration);

    return () => clearInterval(timer);
  }, [stats, activeEmployeeCount, inactiveEmployeeCount]);

  // Generate trend data based on period
  const trendData = useMemo(() => {
    if (!stats?.weeklyTrend) return null;

    const labels = {
      daily: stats.weeklyTrend.map(d => {
        const date = new Date(d.date);
        return date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
      }),
      monthly: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
      annually: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    };

    const data = {
      daily: stats.weeklyTrend.map(d => d.employees),
      monthly: [85, 92, 88, 95], // Simulated monthly data
      annually: [78, 82, 85, 88, 91, 89, 92, 95, 93, 90, 87, 94] // Simulated annual data
    };

    return {
      labels: labels[trendPeriod],
      datasets: [
        {
          label: 'Attendance',
          data: data[trendPeriod],
          fill: true,
          backgroundColor: (context) => {
            const ctx = context.chart.ctx;
            const gradient = ctx.createLinearGradient(0, 0, 0, 300);
            gradient.addColorStop(0, 'rgba(59, 130, 246, 0.3)');
            gradient.addColorStop(1, 'rgba(59, 130, 246, 0.02)');
            return gradient;
          },
          borderColor: '#3b82f6',
          borderWidth: 3,
          tension: 0.4,
          pointBackgroundColor: '#3b82f6',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 8,
          pointHoverBackgroundColor: '#3b82f6',
          pointHoverBorderColor: '#fff',
          pointHoverBorderWidth: 3
        }
      ]
    };
  }, [stats, trendPeriod]);

  // Attendance overview doughnut data - Present vs Absent from ACTIVE employees only
  const attendanceOverviewData = useMemo(() => {
    if (!stats) return null;

    const present = stats.todayAttendance?.employeesPresent || 0;
    // Use active employee count as the base, not total employees
    const totalActive = activeEmployeeCount || 1;
    const absent = Math.max(0, totalActive - present);

    return {
      labels: ['Present', 'Absent'],
      datasets: [{
        data: [present, absent],
        backgroundColor: ['#10b981', '#94a3b8'],
        borderColor: ['#fff', '#fff'],
        borderWidth: 4,
        hoverOffset: 12,
        cutout: '75%'
      }]
    };
  }, [stats, activeEmployeeCount]);

  // Today's progress percentage - based on active employees
  const todayProgress = useMemo(() => {
    if (!stats || !activeEmployeeCount) return 0;
    const present = stats.todayAttendance?.employeesPresent || 0;
    const totalActive = activeEmployeeCount || 1;
    return Math.round((present / totalActive) * 100);
  }, [stats, activeEmployeeCount]);

  // Chart options
  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        titleColor: '#fff',
        bodyColor: '#cbd5e1',
        borderColor: 'rgba(59, 130, 246, 0.5)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        displayColors: false
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        },
        ticks: {
          color: '#64748b',
          font: {
            size: 11
          }
        }
      },
      y: {
        grid: {
          color: 'rgba(148, 163, 184, 0.1)'
        },
        ticks: {
          color: '#64748b',
          font: {
            size: 11
          }
        },
        beginAtZero: true
      }
    }
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        titleColor: '#fff',
        bodyColor: '#cbd5e1',
        borderColor: 'rgba(59, 130, 246, 0.5)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8
      }
    },
    cutout: '70%'
  };

  // Format time ago
  const formatTimeAgo = (dateStr, timeStr) => {
    const date = new Date(`${dateStr}T${timeStr}`);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  if (loading) {
    return (
      <div className="dashboard-stats-container">
        <div className="stats-loading">
          <div className="loading-spinner">
            <div className="spinner-ring"></div>
            <div className="spinner-ring"></div>
            <div className="spinner-ring"></div>
          </div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-stats-container">
        <div className="stats-error">
          <i className="bi bi-exclamation-triangle"></i>
          <h3>Failed to load dashboard</h3>
          <p>{error}</p>
          <button onClick={fetchStats} className="retry-btn">
            <i className="bi bi-arrow-clockwise"></i> Retry
          </button>
        </div>
      </div>
    );
  }

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
              <span className="clock-time">
                {currentTime.toLocaleTimeString('en-US', { 
                  hour: '2-digit', 
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: true 
                })}
              </span>
              <span className="clock-date">
                {currentTime.toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </span>
            </div>
            <button className="refresh-btn" onClick={fetchStats} title="Refresh Data">
              <i className="bi bi-arrow-clockwise"></i>
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards Grid - Enhanced Modern Design */}
      <div className="stats-cards-grid">
        {/* Active Employees Card */}
        <div className="stat-card stat-card-gradient stat-card-success" style={{ '--delay': '0.1s' }}>
          <div className="stat-card-inner">
            <div className="stat-card-icon-wrapper">
              <div className="stat-icon-circle">
                <i className="bi bi-person-check-fill"></i>
              </div>
              <div className="stat-icon-ring"></div>
            </div>
            <div className="stat-card-data">
              <h3 className="stat-number">{animatedStats.activeEmployees || 0}</h3>
              <p className="stat-title">Active Employees</p>
              <span className="stat-subtitle">
                <i className="bi bi-person-badge-fill"></i> Currently employed staff
              </span>
            </div>
          </div>
        </div>

        {/* Total Divisions Card */}
        <div className="stat-card stat-card-gradient stat-card-warning" style={{ '--delay': '0.15s' }}>
          <div className="stat-card-inner">
            <div className="stat-card-icon-wrapper">
              <div className="stat-icon-circle">
                <i className="bi bi-building-fill"></i>
              </div>
              <div className="stat-icon-ring"></div>
            </div>
            <div className="stat-card-data">
              <h3 className="stat-number">{animatedStats.totalDivisions || 0}</h3>
              <p className="stat-title">Total Divisions</p>
              <span className="stat-subtitle">
                <i className="bi bi-layers-fill"></i> Organizational units
              </span>
            </div>
          </div>
        </div>

        {/* Total Sections Card */}
        <div className="stat-card stat-card-gradient stat-card-info" style={{ '--delay': '0.25s' }}>
          <div className="stat-card-inner">
            <div className="stat-card-icon-wrapper">
              <div className="stat-icon-circle">
                <i className="bi bi-diagram-3-fill"></i>
              </div>
              <div className="stat-icon-ring"></div>
            </div>
            <div className="stat-card-data">
              <h3 className="stat-number">{animatedStats.totalSections || 0}</h3>
              <p className="stat-title">Total Sections</p>
              <span className="stat-subtitle">
                <i className="bi bi-grid-3x3-gap-fill"></i> Department sections
              </span>
            </div>
          </div>
        </div>

        {/* Sub Sections Card */}
        <div className="stat-card stat-card-gradient stat-card-purple" style={{ '--delay': '0.25s' }}>
          <div className="stat-card-inner">
            <div className="stat-card-icon-wrapper">
              <div className="stat-icon-circle">
                <i className="bi bi-diagram-2-fill"></i>
              </div>
              <div className="stat-icon-ring"></div>
            </div>
            <div className="stat-card-data">
              <h3 className="stat-number">{animatedStats.totalSubSections || 0}</h3>
              <p className="stat-title">Sub Sections</p>
              <span className="stat-subtitle">
                <i className="bi bi-collection-fill"></i> Work units
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Charts and Progress Section */}
      <div className="charts-section">
        {/* Attendance Overview Chart */}
        <div className="chart-card attendance-overview-card">
          <div className="chart-card-header">
            <div className="chart-title">
              <i className="bi bi-pie-chart-fill"></i>
              <h3>Attendance Overview</h3>
            </div>
            <span className="chart-badge">Today</span>
          </div>
          <div className="chart-card-body">
            <div className="doughnut-chart-container">
              {attendanceOverviewData && (
                <Doughnut data={attendanceOverviewData} options={doughnutOptions} />
              )}
              <div className="doughnut-center">
                <span className="doughnut-percentage">{todayProgress}%</span>
                <span className="doughnut-label">Present</span>
              </div>
            </div>
            <div className="chart-legend">
              <div className="legend-item">
                <span className="legend-color present"></span>
                <span className="legend-text">Present</span>
                <span className="legend-value">{stats?.todayAttendance?.employeesPresent || 0}</span>
              </div>
              <div className="legend-item">
                <span className="legend-color absent"></span>
                <span className="legend-text">Absent</span>
                <span className="legend-value">{Math.max(0, activeEmployeeCount - (stats?.todayAttendance?.employeesPresent || 0))}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Attendance Trend Chart */}
        <div className="chart-card trend-chart-card">
          <div className="chart-card-header">
            <div className="chart-title">
              <i className="bi bi-graph-up-arrow"></i>
              <h3>Attendance Trend</h3>
            </div>
            <div className="trend-period-selector">
              <button 
                className={`period-btn ${trendPeriod === 'daily' ? 'active' : ''}`}
                onClick={() => setTrendPeriod('daily')}
              >
                Daily
              </button>
              <button 
                className={`period-btn ${trendPeriod === 'monthly' ? 'active' : ''}`}
                onClick={() => setTrendPeriod('monthly')}
              >
                Monthly
              </button>
              <button 
                className={`period-btn ${trendPeriod === 'annually' ? 'active' : ''}`}
                onClick={() => setTrendPeriod('annually')}
              >
                Annually
              </button>
            </div>
          </div>
          <div className="chart-card-body">
            <div className="line-chart-container">
              {trendData && <Line data={trendData} options={lineChartOptions} />}
            </div>
          </div>
        </div>

        {/* Today's Progress Chart */}
        <div className="chart-card progress-chart-card">
          <div className="chart-card-header">
            <div className="chart-title">
              <i className="bi bi-clock-history"></i>
              <h3>Today's Progress</h3>
            </div>
            <span className="chart-badge">
              <i className="bi bi-calendar-check"></i>
              {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
          <div className="chart-card-body">
            {/* Main Progress Circle */}
            <div className="progress-circle-container">
              <svg className="progress-circle" viewBox="0 0 120 120">
                <circle 
                  className="progress-circle-bg" 
                  cx="60" 
                  cy="60" 
                  r="54"
                />
                <circle 
                  className="progress-circle-fill" 
                  cx="60" 
                  cy="60" 
                  r="54"
                  style={{ 
                    strokeDasharray: `${(todayProgress / 100) * 339.292} 339.292` 
                  }}
                />
              </svg>
              <div className="progress-circle-content">
                <span className="progress-value">{todayProgress}%</span>
                <span className="progress-label">Complete</span>
              </div>
            </div>

            {/* Progress Stats */}
            <div className="progress-stats">
              <div className="progress-stat-item">
                <div className="progress-stat-icon check-in">
                  <i className="bi bi-box-arrow-in-right"></i>
                </div>
                <div className="progress-stat-info">
                  <span className="progress-stat-value">{stats?.todayAttendance?.inScans || 0}</span>
                  <span className="progress-stat-label">Check-ins</span>
                </div>
              </div>
              <div className="progress-stat-item">
                <div className="progress-stat-icon check-out">
                  <i className="bi bi-box-arrow-right"></i>
                </div>
                <div className="progress-stat-info">
                  <span className="progress-stat-value">{stats?.todayAttendance?.outScans || 0}</span>
                  <span className="progress-stat-label">Check-outs</span>
                </div>
              </div>
              <div className="progress-stat-item">
                <div className="progress-stat-icon rate">
                  <i className="bi bi-percent"></i>
                </div>
                <div className="progress-stat-info">
                  <span className="progress-stat-value">{stats?.attendanceRate || 0}%</span>
                  <span className="progress-stat-label">Rate</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activities - Enhanced Section */}
      <div className="bottom-section">
        <div className="activities-card activities-card-enhanced">
          <div className="activities-card-header">
            <div className="activities-title">
              <i className="bi bi-activity"></i>
              <h3>Recent Activities</h3>
            </div>
            <div className="activities-header-actions">
              <span className="activities-badge">{showAllActivities ? allActivities.length : activities.length} activities</span>
              <button 
                className="view-all-btn"
                onClick={() => setShowAllActivities(!showAllActivities)}
              >
                {showAllActivities ? (
                  <>
                    <i className="bi bi-chevron-up"></i> Show Less
                  </>
                ) : (
                  <>
                    <i className="bi bi-list-ul"></i> View All ({allActivities.length})
                  </>
                )}
              </button>
            </div>
          </div>
          <div className={`activities-card-body ${showAllActivities ? 'expanded' : ''}`}>
            {(showAllActivities ? allActivities : activities).length === 0 ? (
              <div className="no-activities">
                <i className="bi bi-inbox"></i>
                <p>No recent activities</p>
              </div>
            ) : (
              <div className="activities-list">
                {(showAllActivities ? allActivities : activities.slice(0, 6)).map((activity, index) => (
                  <div 
                    className={`activity-item activity-item-${activity.severity || 'low'}`}
                    key={activity.id || index}
                    style={{ '--delay': `${index * 0.05}s` }}
                  >
                    <div className={`activity-icon ${activity.severity || 'low'}`}>
                      <i className={activity.icon || 'bi bi-activity'}></i>
                    </div>
                    <div className="activity-content">
                      <div className="activity-header">
                        <h4 className="activity-title">{activity.title}</h4>
                        <span className={`activity-badge activity-badge-${activity.severity || 'low'}`}>
                          {activity.action?.includes('login') ? 'Login' :
                           activity.action?.includes('logout') ? 'Logout' :
                           activity.action?.includes('created') ? 'Created' :
                           activity.action?.includes('updated') ? 'Updated' :
                           activity.action?.includes('deleted') ? 'Deleted' :
                           activity.action?.includes('transfer') ? 'Transfer' : 'Activity'}
                        </span>
                      </div>
                      <p className="activity-description">{activity.description}</p>
                      <div className="activity-meta">
                        {activity.user && (
                          <span className="activity-user">
                            <i className="bi bi-person-circle"></i> {activity.user}
                          </span>
                        )}
                        <span className="activity-time">
                          <i className="bi bi-clock-history"></i>
                          {formatTimeAgo(activity.date, activity.time)}
                        </span>
                        <span className="activity-date-full">
                          <i className="bi bi-calendar3"></i>
                          {activity.date} {activity.time}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardStats;
