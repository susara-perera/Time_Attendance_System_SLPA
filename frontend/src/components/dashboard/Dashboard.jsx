import React, { useState, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import usePermission from '../../hooks/usePermission';
import DashboardStats from './DashboardStats';
import UserManagement from './UserManagement';
import EmployeeManagement from './EmployeeManagement';
import ReportGeneration from './ReportGeneration';
import MealManagement from './MealManagement';
import DivisionManagement from './DivisionManagement';
import SectionManagement from './SectionManagement';
import RoleAccessManagement from './RoleAccessManagement';
import RoleManagement from './RoleManagement';
import ApiDataViewer from './ApiDataViewer';
import Settings from './Settings';
import Footer from './Footer';
import './Dashboard.css';
import logo from '../../assets/logo.jpg';

const Dashboard = () => {
  const [activeSection, setActiveSection] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const { user, logout } = useContext(AuthContext);
  const { t } = useLanguage();
  const canViewSettingsPerm = usePermission('settings', 'view');
  // Also support legacy/explicit permission key `settings_view` stored under `permissions.settings`
  const canViewSettings = (user && user.role === 'super_admin') || canViewSettingsPerm || !!(user?.permissions && user.permissions.settings && (user.permissions.settings.settings_view === true || user.permissions.settings.view === true));

  // Employee view permission (master view for Employee Management)
  const canViewEmployeesPerm = usePermission('employees', 'read');
  // Also support legacy keys stored under `permissions.employees` (e.g., `employees_view` or `view`)
  const canViewEmployees = (user && user.role === 'super_admin') || canViewEmployeesPerm || !!(user?.permissions && user.permissions.employees && (user.permissions.employees.employees_view === true || user.permissions.employees.view === true));

  // Division view permission (master view for Division Management)
  const canViewDivisionsPerm = usePermission('divisions', 'read');
  const canViewDivisions = (user && user.role === 'super_admin') || canViewDivisionsPerm || !!(user?.permissions && user.permissions.divisions && (user.permissions.divisions.divisions_view === true || user.permissions.divisions.view === true));

  // Section view permission (master view for Section Management)
  const canViewSectionsPerm = usePermission('sections', 'read');
  const canViewSections = (user && user.role === 'super_admin') || canViewSectionsPerm || !!(user?.permissions && user.permissions.sections && (user.permissions.sections.sections_view === true || user.permissions.sections.view === true));

  // Permission Management view permission controls visibility of Roles & Permissions quick action
  const canViewPermissionManagementPerm = usePermission('permission_management', 'view_permission');
  const canViewPermissionManagement = (user && user.role === 'super_admin') || canViewPermissionManagementPerm || !!(user?.permissions && user.permissions.roles && (user.permissions.roles.read === true || user.permissions.roles.view === true));

  // Helper to display possibly-object profile fields safely
  const getDisplay = (v) => {
    if (v === null || v === undefined) return 'N/A';
    if (typeof v === 'string' || typeof v === 'number') return String(v);
    if (typeof v === 'object') {
      return v.name || v.code || v.fullCode || v._id || JSON.stringify(v);
    }
    return String(v);
  };
  

  const handleLogout = async () => {
    try {
      await logout();
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleQuickAction = (action) => {
    switch (action) {
      case 'home':
        setActiveSection('dashboard');
        break;
      case 'users':
        setActiveSection('users');
        break;
      case 'employees':
        setActiveSection('employees');
        break;
      case 'reports':
        setActiveSection('reports');
        break;
      case 'meals':
        setActiveSection('meals');
        break;
      case 'divisions':
        setActiveSection('divisions');
        break;
      case 'sections':
        setActiveSection('sections');
        break;
      case 'roles':
        setActiveSection('roles');
        break;
      case 'settings':
        setActiveSection('settings');
        break;
      case 'api':
        setActiveSection('api');
        break;
      default:
        break;
    }
  };

  

  // Handle keyboard events for accessibility
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (sidebarOpen) {
          setSidebarOpen(false);
        }
        if (showProfileDropdown) {
          setShowProfileDropdown(false);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [sidebarOpen, showProfileDropdown]);

  const getCurrentTime = () => {
    const now = new Date();
    return {
      time: now.toLocaleTimeString('en-US', { 
        hour12: true,
        hour: '2-digit',
        minute: '2-digit'
      }),
      date: now.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
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

  // Time-based greeting (Good morning / afternoon / evening)
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'good morning';
    if (hour < 18) return 'good afternoon';
    return 'good evening';
  };

  // Prefer "First Last" when available, fall back to other identifiers
  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || user?.name || user?.username || user?.email || '';
  // Build initials for a small avatar fallback
  const initials = (() => {
    try {
      if (displayName) {
        const parts = displayName.split(' ').filter(Boolean);
        return parts.map(p => p[0]).slice(0, 2).join('').toUpperCase();
      }
      if (user?.email) return String(user.email[0] || 'U').toUpperCase();
    } catch (e) {
      // fallback
    }
    return 'U';
  })();
  

  // Listen for external navigation events (e.g., from other components)
  React.useEffect(() => {
    const handler = (e) => {
      const target = e?.detail;
      if (typeof target === 'string') {
        setActiveSection(target);
      }
    };

    window.addEventListener('navigateTo', handler);
    return () => window.removeEventListener('navigateTo', handler);
  }, []);

  const renderActiveSection = () => {
    switch (activeSection) {
      case 'dashboard':
        return <DashboardStats onQuickAction={handleQuickAction} />;
      case 'users':
        return <UserManagement />;
      case 'employees':
        return <EmployeeManagement />;
      case 'reports':
      case 'unit-attendance':
      case 'audit-report':
      case 'meal-report':
        return <ReportGeneration />;
      case 'meals':
        return <MealManagement />;
      case 'divisions':
        return <DivisionManagement />;
      case 'sections':
        return <SectionManagement />;
      case 'roles':
        return <RoleAccessManagement />;
      case 'role-management':
        return <RoleManagement />;
      case 'api':
        return <ApiDataViewer />;
      case 'settings':
        return <Settings />;
      default:
        return <DashboardStats onQuickAction={handleQuickAction} />;
    }
  };

  // Users view permission (master view for User Management quick-action)
  const canViewUsersPerm = usePermission('users', 'read');
  const canViewUsers = (user && user.role === 'super_admin') || canViewUsersPerm || !!(user?.permissions && user.permissions.users && (user.permissions.users.users_view === true || user.permissions.users.view === true));

  // Reports view permission controls visibility of Report Generation quick action
  const canViewReportsPerm = usePermission('reports', 'view_reports');
  const canViewReports = (user && user.role === 'super_admin') || canViewReportsPerm || !!(user?.permissions && user.permissions.reports && (user.permissions.reports.view_reports === true || user.permissions.reports.view === true));
  const quickActions = [
    {
      id: 'home',
      label: t('dashboard'),
      icon: 'bi-house',
      color: 'primary',
      roles: ['super_admin', 'admin', 'clerk', 'administrative_clerk', 'employee']
    },
    {
      id: 'users',
      label: t('addUser'),
      icon: 'bi-people',
      color: 'success',
      roles: ['super_admin', 'admin', 'administrative_clerk']
    },
    {
      id: 'reports',
      label: t('reportGeneration'),
      icon: 'bi-graph-up',
      color: 'info',
      roles: ['super_admin', 'admin', 'clerk', 'administrative_clerk']
    },
    {
      id: 'meals',
      label: t('mealManagement'),
      icon: 'bi-cup-hot',
      color: 'orange',
      roles: ['super_admin', 'admin', 'clerk', 'administrative_clerk']
    },
    {
      id: 'divisions',
      label: t('divisionManagement'),
      icon: 'bi-building',
      color: 'warning',
      roles: ['super_admin']
    },
    {
      id: 'sections',
      label: t('sectionManagement'),
      icon: 'bi-diagram-3',
      color: 'purple',
      roles: ['super_admin', 'admin']
    },
    {
      id: 'roles',
      label: t('rolesPermissions'),
      icon: 'bi-shield-check',
      color: 'secondary',
      roles: ['super_admin']
    },
    // {
    //   id: 'api',
    //   label: 'API Data',
    //   icon: 'bi-cloud-download',
    //   color: 'info',
    //   roles: ['super_admin', 'admin']
    // },
    {
      id: 'employees',
      label: 'Employee Management',
      icon: 'bi-people',
      color: 'secondary',
      roles: ['super_admin', 'admin', 'administrative_clerk']
    },
    {
      id: 'settings',
      label: t('settings'),
      icon: 'bi-gear',
      color: 'secondary',
      roles: ['super_admin', 'admin', 'clerk', 'administrative_clerk', 'employee']
    }
  ];

  const hasAccess = (roles) => {
    // For now, return true to show all navigation items
    // TODO: Implement proper role checking when user authentication is fixed
    return true;
    // return roles.includes(user?.role);
  };

  return (
    <div className="modern-dashboard">
      {/* Sidebar */}
      <div className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <div className="brand-icon">
              <img src={logo} alt="SLPA Logo" className="brand-logo" />
            </div>
            <div className="brand-text">
              <h3>{t('attendanceSystem')}</h3>
              <span>{t('poweredBy')}</span>
            </div>
          </div>
          <button 
            className="sidebar-close-btn"
            onClick={() => setSidebarOpen(false)}
            title={t('closeSidebar')}
          >
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        <div className="sidebar-content">
          <div className="sidebar-section">
            <div className="sidebar-section-title">{t('quickActions')}</div>
            <div className="sidebar-actions">
              {quickActions.map((action) => {
                if (!hasAccess(action.roles)) return null;
                // Hide the settings quick action if the user lacks the settings view permission
                if (action.id === 'settings' && !canViewSettings) return null;
                // Hide the reports quick action if user lacks reports view permission
                if (action.id === 'reports' && !canViewReports) return null;
                // Hide Employee Management quick action if user lacks employee view permission
                if (action.id === 'employees' && !canViewEmployees) return null;
                // Hide Division Management quick action if user lacks division view permission
                if (action.id === 'divisions' && !canViewDivisions) return null;
                // Hide Section Management quick action if user lacks section view permission
                if (action.id === 'sections' && !canViewSections) return null;
                // Hide Users quick action if user lacks users view permission
                if (action.id === 'users' && !canViewUsers) return null;
                // Hide Roles & Permissions quick action if user lacks permission management view permission
                if (action.id === 'roles' && !canViewPermissionManagement) return null;

                return (
                  <button
                    key={action.id}
                    className={`sidebar-btn ${action.color} ${activeSection === action.id ? 'active' : ''}`}
                    onClick={() => {
                      handleQuickAction(action.id);
                      setSidebarOpen(false);
                    }}
                    title={action.label}
                  >
                    <i className={`bi ${action.icon}`}></i>
                    <span>{action.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="sidebar-overlay active"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* Top Navigation */}
      <nav className="top-nav">
        <div className="nav-container">
          {/* Toggle Button and Logo Section */}
          <div className="nav-left">
            <button 
              className="sidebar-toggle-btn"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              title={t('toggleSidebar')}
            >
              <i className="bi bi-list"></i>
            </button>
            
            <div className="nav-brand">
              <div className="brand-icon">
                <img src={logo} alt="SLPA Logo" className="brand-logo" />
              </div>
              <div className="brand-text">
                <h1>{t('slpaTitle')}</h1>
                <span>{t('createdBy')}</span>
              </div>
            </div>
          </div>

          {/* Center Greeting - appears in the header center column */}
          <div className="nav-center">
            <div className="header-greeting" aria-live="polite" aria-label={`Greeting: Hello ${displayName || user?.email || 'User'}`}>
              <div className="greeting-pill" title={`Hello ${displayName || user?.email || 'User'}`}>
                <div className="greeting-avatar" aria-hidden="true">{initials}</div>
                <div className="greeting-content">
                  <div className="greeting-line">Hello <span className="greeting-name">{displayName || user?.email || 'User'}</span></div>
                  <div className="greeting-when">{getGreeting()}</div>
                </div>
              </div>
            </div>
          </div>

          {/* User Section */}
          <div className="nav-user">
            <div className="header-info" aria-live="polite">
              <div className="header-time-center">
                <div className="time">{currentTime.time}</div>
                <div className="date">{currentTime.date}</div>
              </div>
            </div>
            {/* Header Actions */}
            <div className="header-actions">
              <button 
                className="header-action-btn profile-btn" 
                onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                title={t('profile')}
              >
                <i className="bi bi-person-circle"></i>
              </button>
              
              {canViewSettings && (
                <button 
                  className="header-action-btn settings-btn" 
                  onClick={() => handleQuickAction('settings')}
                  title={t('settings')}
                >
                  <i className="bi bi-gear"></i>
                </button>
              )}
              
              <button className="logout-btn" onClick={handleLogout}>
                <span>{t('logout')}</span>
              </button>

              {/* Dark mode toggle removed per request */}
            </div>
          </div>
          
          {/* Profile Dropdown */}
          {showProfileDropdown && (
            <div className="profile-dropdown">
              <div className="profile-dropdown-header">
                <div className="profile-avatar-large">
                  <i className="bi bi-person-circle"></i>
                </div>
                <div className="profile-info">
                  <h3>{user?.firstName || 'User'} {user?.lastName || ''}</h3>
                  <p className="profile-role">{(typeof user?.role === 'string' ? user.role.replace('_', ' ') : getDisplay(user?.role)) || 'Super Admin'}</p>
                </div>
              </div>
              <div className="profile-dropdown-body">
                <div className="profile-detail">
                  <i className="bi bi-envelope"></i>
                  <span>{user?.email || 'email@example.com'}</span>
                </div>
                <div className="profile-detail">
                  <i className="bi bi-phone"></i>
                  <span>{user?.phone || 'N/A'}</span>
                </div>
                <div className="profile-detail">
                  <i className="bi bi-building"></i>
                  <span>{getDisplay(user?.division)}</span>
                </div>
                <div className="profile-detail">
                  <i className="bi bi-diagram-3"></i>
                  <span>{getDisplay(user?.section)}</span>
                </div>
              </div>
              <div className="profile-dropdown-footer">
                {canViewSettings && (
                  <button 
                    className="profile-dropdown-btn"
                    onClick={() => {
                      setShowProfileDropdown(false);
                      handleQuickAction('settings');
                    }}
                  >
                    <i className="bi bi-gear"></i>
                    <span>{t('settings')}</span>
                  </button>
                )}
              </div>
            </div>
          )}
          
          {/* Dropdown Overlay */}
          {showProfileDropdown && (
            <div 
              className="dropdown-overlay"
              onClick={() => setShowProfileDropdown(false)}
            ></div>
          )}
        </div>
      </nav>

      {/* Main Content */}
      <main className="main-content">
        <div className="content-container">
          {renderActiveSection()}
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default Dashboard;