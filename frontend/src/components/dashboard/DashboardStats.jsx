
import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { Doughnut, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  BarElement,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  BarElement
);

const quickLinks = (t) => [
  { label: t('addUser'), icon: 'bi-people', action: 'users', color: 'success' },
  { label: t('employeeManagement'), icon: 'bi-person-badge', action: 'employees', color: 'secondary' },
  { label: t('reportGeneration'), icon: 'bi-graph-up', action: 'reports', color: 'info' },
  { label: t('mealManagement'), icon: 'bi-cup-hot', action: 'meals', color: 'orange' },
  { label: t('divisionManagement'), icon: 'bi-building', action: 'divisions', color: 'warning' },
  { label: t('sectionManagement'), icon: 'bi-diagram-3', action: 'sections', color: 'purple' },
];

const DashboardStats = ({ onQuickAction }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const { t } = useLanguage();
  const [stats, setStats] = useState({
    totalEmployees: 12960,
    presentToday: 8547,
    attendanceRate: 87.2,
    activeUsers: 156,
    totalUsers: 234,
    loginRate: 66.7,
    totalDivisions: 27,
    totalSections: 120,
    totalSubSections: 350,
    avgPerDivision: 480,
    lateArrivals: 24,
    earlyDepartures: 12,
    recentActivities: []
  });
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/dashboard/stats');
        if (response.ok) {
          const json = await response.json();
          const payload = json?.data || json;
          setStats(prevStats => ({
            ...prevStats,
            totalEmployees: payload.hrisTotal ?? payload.totalEmployees ?? payload.totalUsers ?? prevStats.totalEmployees,
            presentToday: payload.presentToday ?? payload.todayAttendance?.employeesPresent ?? prevStats.presentToday,
            attendanceRate: payload.attendanceRate ?? prevStats.attendanceRate,
            totalDivisions: payload.totalDivisions ?? prevStats.totalDivisions,
            totalSections: payload.totalSections ?? prevStats.totalSections,
            totalSubSections: payload.totalSubSections ?? prevStats.totalSubSections,
            activeUsers: payload.activeUsers ?? prevStats.activeUsers,
            totalUsers: payload.totalUsers ?? prevStats.totalUsers,
            recentActivities: payload.recentActivities ?? []
          }));
        }
      } catch (error) {
        // ...existing code...
      }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Chart data
  const attendanceData = {
    labels: ['Present', 'Absent'],
    datasets: [
      {
        data: [stats.presentToday, stats.totalEmployees - stats.presentToday],
        backgroundColor: ['#10B981', '#EF4444'],
        borderWidth: 0,
        cutout: '70%',
      },
    ],
  };

  const monthlyData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [
      {
        label: 'Attendance',
        data: [85, 88, 91, 87, 89, 92],
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        borderColor: '#3B82F6',
        borderRadius: 8,
        borderSkipped: false,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)'
        },
        ticks: {
          color: '#64748B'
        }
      },
      x: {
        grid: {
          display: false
        },
        ticks: {
          color: '#64748B'
        }
      }
    }
  };

  // ...existing code...
  return (
    <div className="dashboard-overview">

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card primary" style={{transition:'transform 0.3s', boxShadow:'0 2px 8px rgba(59,130,246,0.07)'}}>
          <div className="stat-header">
                <div className="stat-title">
                  <h3>{t('totalEmployees')}</h3>
                  <p>{t('allSubsections')}</p>
                </div>
            <div className="stat-icon">
              <i className="bi bi-people"></i>
            </div>
          </div>
          <div className="stat-value" style={{fontSize:'2.1rem'}}>{Number(stats.totalEmployees || 0).toLocaleString()}</div>
        </div>
        <div className="stat-card success" style={{transition:'transform 0.3s', boxShadow:'0 2px 8px rgba(16,185,129,0.07)'}}>
          <div className="stat-header">
            <div className="stat-title">
              <h3>{t('presentToday')}</h3>
              <p>{t('activeAttendance')}</p>
            </div>
            <div className="stat-icon">
              <i className="bi bi-person-check"></i>
            </div>
          </div>
          <div className="stat-value" style={{fontSize:'2.1rem'}}>{Number(stats.presentToday || 0).toLocaleString()}</div>
          <div className="stat-trend positive">
            <i className="bi bi-arrow-up"></i>
            <span>{stats.attendanceRate}% attendance rate</span>
          </div>
        </div>
        <div className="stat-card warning" style={{transition:'transform 0.3s', boxShadow:'0 2px 8px rgba(234,179,8,0.07)'}}>
          <div className="stat-header">
            <div className="stat-title">
              <h3>{t('activeDivisions')}</h3>
              <p>{t('allDivisions')}</p>
            </div>
            <div className="stat-icon">
              <i className="bi bi-building"></i>
            </div>
          </div>
          <div className="stat-value" style={{fontSize:'2.1rem'}}>{Number(stats.totalDivisions || 0).toLocaleString()}</div>
        </div>
        <div className="stat-card info" style={{transition:'transform 0.3s', boxShadow:'0 2px 8px rgba(59,130,246,0.07)'}}>
          <div className="stat-header">
            <div className="stat-title">
              <h3>{t('totalSections')}</h3>
              <p>{t('allDivisions') /* reuse a label for brevity */}</p>
            </div>
            <div className="stat-icon">
              <i className="bi bi-diagram-3"></i>
            </div>
          </div>
          <div className="stat-value" style={{fontSize:'2.1rem'}}>{Number(stats.totalSections || 0).toLocaleString()}</div>
        </div>
        <div className="stat-card info" style={{transition:'transform 0.3s', boxShadow:'0 2px 8px rgba(59,130,246,0.07)'}}>
          <div className="stat-header">
            <div className="stat-title">
              <h3>{t('totalSubSections')}</h3>
              <p>{t('allSubsections')}</p>
            </div>
            <div className="stat-icon">
              <i className="bi bi-diagram-2"></i>
            </div>
          </div>
          <div className="stat-value" style={{fontSize:'2.1rem'}}>{Number(stats.totalSubSections || 0).toLocaleString()}</div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="charts-grid">
        <div className="chart-card" style={{animation:'modalSlideIn 0.7s'}}>
          <div className="card-header">
            <div className="header-content">
              <h3>
                <i className="bi bi-pie-chart"></i>
                {t('todaysAttendance')}
              </h3>
              <p>{t('quickInsights') /* small descriptive reuse */}</p>
            </div>
            <div className="chart-stats">
              <div className="chart-stat">
                <span className="stat-number">{stats.presentToday}</span>
                <span className="stat-label">{t('presentLabel')}</span>
              </div>
              <div className="chart-stat">
                <span className="stat-number">{stats.totalEmployees - stats.presentToday}</span>
                <span className="stat-label">{t('absentLabel')}</span>
              </div>
            </div>
          </div>
          <div className="chart-container" style={{minHeight:'220px'}}>
            <Doughnut 
              data={attendanceData} 
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    display: false
                  }
                }
              }}
            />
          </div>
        </div>
        <div className="chart-card" style={{animation:'modalSlideIn 0.7s'}}>
          <div className="card-header">
            <div className="header-content">
              <h3>
                <i className="bi bi-graph-up"></i>
                {t('monthlyAttendance')}
              </h3>
              <p>{t('monthlyAttendance') /* reuse label */}</p>
            </div>
            <div className="chart-actions">
              <button className="btn-sm primary">
                <i className="bi bi-download"></i>
                {t('export')}
              </button>
            </div>
          </div>
          <div className="chart-container" style={{minHeight:'220px'}}>
            <Bar data={monthlyData} options={chartOptions} />
          </div>
        </div>
        <div className="insights-card" style={{animation:'modalSlideIn 0.7s'}}>
          <div className="card-header">
            <h3>
              <i className="bi bi-lightbulb"></i>
              {t('quickInsights')}
            </h3>
          </div>
          <div className="insights-list">
            <div className="insight-item">
              <div className="insight-icon success">
                <i className="bi bi-check-circle"></i>
              </div>
              <div className="insight-content">
                <h4>{t('highAttendance')}</h4>
                <p>{stats.attendanceRate}% {t('attendanceRateLabel')}</p>
              </div>
            </div>
            <div className="insight-item">
              <div className="insight-icon warning">
                <i className="bi bi-clock"></i>
              </div>
              <div className="insight-content">
                <h4>{t('lateArrivals')}</h4>
                <p>{stats.lateArrivals} {t('lateArrivals').toLowerCase()}</p>
              </div>
            </div>
            <div className="insight-item">
              <div className="insight-icon info">
                <i className="bi bi-arrow-left-circle"></i>
              </div>
              <div className="insight-content">
                <h4>{t('earlyDepartures')}</h4>
                <p>{stats.earlyDepartures} {t('earlyDepartures').toLowerCase()}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="activity-card" style={{animation:'modalSlideIn 0.7s'}}>
          <div className="card-header">
            <h3>
              <i className="bi bi-activity"></i>
              {t('recentActivity')}
            </h3>
          </div>
          <div className="activity-list">
            {stats.recentActivities && stats.recentActivities.length > 0 ? (
              stats.recentActivities.slice(0, 3).map((activity, idx) => (
                <div className="activity-item" key={idx}>
                  <div className="activity-avatar">
                    <i className={activity.icon || "bi bi-activity"}></i>
                  </div>
                  <div className="activity-content">
                    <p><strong>{activity.title}</strong> {activity.description}</p>
                    <span>{activity.date} {activity.time}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="activity-item">
                  <div className="activity-content">
                    <p>{t('noRecentActivities')}</p>
                  </div>
              </div>
            )}
            {stats.recentActivities && stats.recentActivities.length > 3 && (
              <button className="btn-sm" style={{marginTop: '10px'}} onClick={() => setModalOpen(true)}>
                {t('showAll')}
              </button>
            )}
            {modalOpen && (
              <div className="modal-overlay" style={{position: 'fixed', top:0, left:0, width:'100vw', height:'100vh', background:'rgba(0,0,0,0.3)', zIndex:1000}} onClick={() => setModalOpen(false)}>
                <div className="modal-content" style={{background:'#fff', borderRadius:'8px', maxWidth:'500px', margin:'60px auto', padding:'24px', position:'relative'}} onClick={e => e.stopPropagation()}>
                  <h3 style={{marginBottom:'16px'}}><i className="bi bi-activity"></i> {t('recentActivity')} (Past Week)</h3>
                  <div>
                    {stats.recentActivities.map((activity, idx) => (
                      <div className="activity-item" key={idx} style={{borderBottom:'1px solid #eee', paddingBottom:'12px', marginBottom:'12px'}}>
                        <div className="activity-avatar">
                          <i className={activity.icon || "bi bi-activity"}></i>
                        </div>
                        <div className="activity-content">
                          <p><strong>{activity.title}</strong> {activity.description}</p>
                          <span>{activity.date} {activity.time}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button className="btn-sm" style={{marginTop:'10px'}} onClick={() => setModalOpen(false)}>{t('close')}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardStats;
// ...existing code...