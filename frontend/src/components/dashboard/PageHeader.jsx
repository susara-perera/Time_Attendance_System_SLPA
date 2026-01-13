import React from 'react';
import './PageHeader.css';
import logo from '../../assets/logo.jpg';

/**
 * Reusable Page Header Component with Logo
 * @param {string} title - The page title
 * @param {string} subtitle - The page subtitle/description
 * @param {string} icon - Bootstrap icon class (e.g., "bi-building")
 * @param {React.ReactNode} actions - Optional action buttons
 */
const PageHeader = ({ title, subtitle, icon = 'bi-folder', actions }) => {
  return (
    <div className="page-header-banner">
      <div className="page-header-content">
        <div className="page-header-left">
          <div className="page-header-icon">
            <i className={`bi ${icon}`}></i>
          </div>
          <div className="page-header-text">
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
        </div>
        <div className="page-header-right">
          {actions && <div className="page-header-actions">{actions}</div>}
          <div className="page-header-logo">
            <img src={logo} alt="Company Logo" />
          </div>
        </div>
      </div>
      {/* Decorative Elements */}
      <div className="page-header-decoration">
        <div className="decoration-circle decoration-circle-1"></div>
        <div className="decoration-circle decoration-circle-2"></div>
        <div className="decoration-circle decoration-circle-3"></div>
      </div>
    </div>
  );
};

export default PageHeader;
