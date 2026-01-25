import React, { useState, useEffect } from 'react';
import './ConfirmModal.css';

/**
 * Modern Confirmation Modal Component
 * 
 * Usage:
 * import { showConfirm } from './components/dashboard/ConfirmModal';
 * 
 * const confirmed = await showConfirm({
 *   title: 'Delete User',
 *   message: 'Are you sure you want to delete this user?',
 *   confirmText: 'Delete',
 *   cancelText: 'Cancel',
 *   type: 'danger' // 'danger', 'warning', 'info', 'success'
 * });
 * 
 * if (confirmed) {
 *   // User confirmed
 * }
 */

let confirmCallback = null;
let showConfirmCallback = null;

export const showConfirm = (options) => {
  return new Promise((resolve) => {
    if (showConfirmCallback) {
      showConfirmCallback(options, resolve);
    }
  });
};

const ConfirmModal = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [config, setConfig] = useState({
    title: 'Confirm Action',
    message: 'Are you sure?',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    type: 'info'
  });
  const [resolveCallback, setResolveCallback] = useState(null);

  useEffect(() => {
    showConfirmCallback = (options, resolve) => {
      setConfig({ ...config, ...options });
      setResolveCallback(() => resolve);
      setIsVisible(true);
    };

    return () => {
      showConfirmCallback = null;
    };
  }, []);

  const handleConfirm = () => {
    setIsVisible(false);
    if (resolveCallback) {
      resolveCallback(true);
    }
  };

  const handleCancel = () => {
    setIsVisible(false);
    if (resolveCallback) {
      resolveCallback(false);
    }
  };

  const getIcon = () => {
    switch (config.type) {
      case 'danger':
        return 'bi-exclamation-triangle-fill';
      case 'warning':
        return 'bi-exclamation-circle-fill';
      case 'success':
        return 'bi-check-circle-fill';
      case 'info':
      default:
        return 'bi-info-circle-fill';
    }
  };

  if (!isVisible) return null;

  return (
    <div className="confirm-overlay" onClick={handleCancel}>
      <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-header">
          <div className={`confirm-icon-wrapper confirm-icon-${config.type}`}>
            <i className={`bi ${getIcon()}`}></i>
          </div>
        </div>
        <div className="confirm-body">
          <h3 className="confirm-title">{config.title}</h3>
          <p className="confirm-message">{config.message}</p>
        </div>
        <div className="confirm-footer">
          <button
            className="confirm-btn confirm-btn-cancel"
            onClick={handleCancel}
          >
            <i className="bi bi-x-circle"></i>
            {config.cancelText}
          </button>
          <button
            className={`confirm-btn confirm-btn-${config.type}`}
            onClick={handleConfirm}
          >
            <i className={`bi ${config.type === 'danger' ? 'bi-trash' : 'bi-check-circle'}`}></i>
            {config.confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
