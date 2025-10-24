import React, { useState, useEffect } from 'react';
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

const DashboardStats = ({ onQuickAction }) => {
  const [stats, setStats] = useState({
    totalEmployees: 12960,
    presentToday: 8547,
    attendanceRate: 87.2,
    activeUsers: 156,
    totalUsers: 234,
    loginRate: 66.7,
    activeDivisions: 27,
    avgPerDivision: 480,
    lateArrivals: 24,
    earlyDepartures: 12
  });

  // Fetch dashboard stats from API
  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Replace with actual API calls
        const response = await fetch('/api/dashboard/stats');
        if (response.ok) {
          const data = await response.json();
          setStats(prevStats => ({
            ...prevStats,
            ...data
          }));
        }
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        // Keep default/mock data on error
      }
    };

    fetchStats();
    
    // Set up interval to refresh stats every 5 minutes
    const interval = setInterval(fetchStats, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
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

  return (
    <div className="dashboard-overview">
      {/* Stats Grid */}
      <div className="stats-grid">
        {/* Total Employees */}
        <div className="stat-card primary">
          <div className="stat-header">
            <div className="stat-title">
              <h3>Total Employees</h3>
              <p>Registered in system</p>
            </div>
            <div className="stat-icon">
              <i className="bi bi-people"></i>
            </div>
          </div>
          <div className="stat-value">{stats.totalEmployees.toLocaleString()}</div>
          <div className="stat-trend positive">
            <i className="bi bi-arrow-up"></i>
            <span>+2.5% from last month</span>
          </div>
        </div>

        {/* Present Today */}
        <div className="stat-card success">
          <div className="stat-header">
            <div className="stat-title">
              <h3>Present Today</h3>
              <p>Active attendance</p>
            </div>
            <div className="stat-icon">
              <i className="bi bi-person-check"></i>
            </div>
          </div>
          <div className="stat-value">{stats.presentToday.toLocaleString()}</div>
          <div className="stat-trend positive">
            <i className="bi bi-arrow-up"></i>
            <span>{stats.attendanceRate}% attendance rate</span>
          </div>
        </div>

        {/* System Users */}
        <div className="stat-card info">
          <div className="stat-header">
            <div className="stat-title">
              <h3>Active Users</h3>
              <p>System logged in</p>
            </div>
            <div className="stat-icon">
              <i className="bi bi-person-gear"></i>
            </div>
          </div>
          <div className="stat-value">{stats.activeUsers}</div>
          <div className="stat-trend neutral">
            <i className="bi bi-dash"></i>
            <span>{stats.loginRate}% of total users</span>
          </div>
        </div>

        {/* Divisions */}
        <div className="stat-card warning">
          <div className="stat-header">
            <div className="stat-title">
              <h3>Active Divisions</h3>
              <p>Operational departments</p>
            </div>
            <div className="stat-icon">
              <i className="bi bi-building"></i>
            </div>
          </div>
          <div className="stat-value">{stats.activeDivisions}</div>
          <div className="stat-trend positive">
            <i className="bi bi-arrow-up"></i>
            <span>Avg {stats.avgPerDivision} employees</span>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="charts-grid">
        {/* Attendance Overview */}
        <div className="chart-card">
          <div className="card-header">
            <div className="header-content">
              <h3>
                <i className="bi bi-pie-chart"></i>
                Today's Attendance
              </h3>
              <p>Real-time attendance status</p>
            </div>
            <div className="chart-stats">
              <div className="chart-stat">
                <span className="stat-number">{stats.presentToday}</span>
                <span className="stat-label">Present</span>
              </div>
              <div className="chart-stat">
                <span className="stat-number">{stats.totalEmployees - stats.presentToday}</span>
                <span className="stat-label">Absent</span>
              </div>
            </div>
          </div>
          <div className="chart-container">
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

        {/* Monthly Trends */}
        <div className="chart-card">
          <div className="card-header">
            <div className="header-content">
              <h3>
                <i className="bi bi-graph-up"></i>
                Monthly Attendance
              </h3>
              <p>6-month attendance trends</p>
            </div>
            <div className="chart-actions">
              <button className="btn-sm primary">
                <i className="bi bi-download"></i>
                Export
              </button>
            </div>
          </div>
          <div className="chart-container">
            <Bar data={monthlyData} options={chartOptions} />
          </div>
        </div>

        {/* Quick Insights */}
        <div className="insights-card">
          <div className="card-header">
            <h3>
              <i className="bi bi-lightbulb"></i>
              Quick Insights
            </h3>
          </div>
          <div className="insights-list">
            <div className="insight-item">
              <div className="insight-icon success">
                <i className="bi bi-check-circle"></i>
              </div>
              <div className="insight-content">
                <h4>High Attendance</h4>
                <p>87.2% attendance rate today</p>
              </div>
            </div>
            <div className="insight-item">
              <div className="insight-icon warning">
                <i className="bi bi-clock"></i>
              </div>
              <div className="insight-content">
                <h4>Late Arrivals</h4>
                <p>{stats.lateArrivals} employees arrived late</p>
              </div>
            </div>
            <div className="insight-item">
              <div className="insight-icon info">
                <i className="bi bi-arrow-left-circle"></i>
              </div>
              <div className="insight-content">
                <h4>Early Departures</h4>
                <p>{stats.earlyDepartures} left before time</p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="activity-card">
          <div className="card-header">
            <h3>
              <i className="bi bi-activity"></i>
              Recent Activity
            </h3>
          </div>
          <div className="activity-list">
            <div className="activity-item">
              <div className="activity-avatar">
                <i className="bi bi-person-plus"></i>
              </div>
              <div className="activity-content">
                <p><strong>John Silva</strong> checked in</p>
                <span>2 minutes ago</span>
              </div>
            </div>
            <div className="activity-item">
              <div className="activity-avatar">
                <i className="bi bi-file-text"></i>
              </div>
              <div className="activity-content">
                <p><strong>Report generated</strong> for Finance dept</p>
                <span>15 minutes ago</span>
              </div>
            </div>
            <div className="activity-item">
              <div className="activity-avatar">
                <i className="bi bi-building"></i>
              </div>
              <div className="activity-content">
                <p><strong>New division</strong> added to system</p>
                <span>1 hour ago</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardStats;