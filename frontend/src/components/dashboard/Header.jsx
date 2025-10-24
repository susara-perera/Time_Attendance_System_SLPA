import React, { useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Header = ({ toggleSidebar, user }) => {
  const { logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const getCurrentTime = () => {
    const now = new Date();
    return {
      time: now.toLocaleTimeString('en-US', { 
        hour12: true,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }),
      date: now.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    };
  };

  const [currentTime, setCurrentTime] = React.useState(getCurrentTime());

  React.useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(getCurrentTime());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <header className="dashboard-header">
      <div className="header-left">
        <button className="sidebar-toggle" onClick={toggleSidebar}>
          <i className="bi bi-list"></i>
        </button>
        
        <div className="dashboard-badge">
          <i className="bi bi-speedometer2"></i>
          Dashboard
        </div>
      </div>

      <div className="header-center">
        <h1 className="system-title">
          <i className="bi bi-clock-history"></i>
          Time Attendance System
        </h1>
      </div>

      <div className="header-right">
        <div className="welcome-section">
          <div className="welcome-text">
            <h2>👋 Welcome Admin</h2>
            <p className="greeting">👋 {getGreeting()}</p>
            <p className="datetime">{currentTime.date}</p>
            <p className="time">{currentTime.time}</p>
          </div>
        </div>

        <div className="header-actions">
          <button className="action-btn notification-btn">
            <i className="bi bi-bell"></i>
          </button>
          
          <button className="action-btn refresh-btn">
            <i className="bi bi-arrow-clockwise"></i>
            Refresh
          </button>
          
          <button className="action-btn logout-btn" onClick={handleLogout}>
            <i className="bi bi-box-arrow-right"></i>
            Logout
          </button>
        </div>

        <div className="user-profile">
          <span className="admin-text">Admin</span>
        </div>
      </div>
    </header>
  );
};

export default Header;