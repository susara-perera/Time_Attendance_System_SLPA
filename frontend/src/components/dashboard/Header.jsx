import React, { useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';

const Header = ({ toggleSidebar, user }) => {
  const { logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const { t } = useLanguage();

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
    if (hour < 12) return 'greetingMorning';
    if (hour < 17) return 'greetingAfternoon';
    return 'greetingEvening';
  };

  return (
    <header className="dashboard-header">
      <div className="header-left">
        <button className="sidebar-toggle" onClick={toggleSidebar}>
          <i className="bi bi-list"></i>
        </button>
        
        <div className="dashboard-badge">
          <i className="bi bi-speedometer2"></i>
          {t('dashboard')}
        </div>
      </div>

      <div className="header-center">
        <h1 className="system-title">
          <i className="bi bi-clock-history"></i>
          {t('systemTitle')}
        </h1>
      </div>

      <div className="header-right">
        <div className="welcome-section">
          <div className="welcome-text">
            <h2>👋 {user?.name ? `${t('welcome')} ${user.name}` : t('welcomeAdmin')}</h2>
            <p className="greeting">👋 {t(getGreeting())}, {user?.role ? user.role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'User'}</p>
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
            {t('refresh')}
          </button>
          
          <button className="action-btn logout-btn" onClick={handleLogout}>
            <i className="bi bi-box-arrow-right"></i>
            {t('logout')}
          </button>
        </div>

        <div className="user-profile">
          <span className="admin-text">{user?.name || t('admin')}</span>
          {user?.role && (
            <span className={`role-badge role-${user.role.replace('_', '-')}`}>
              {user.role.replace('_', ' ').toUpperCase()}
            </span>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;