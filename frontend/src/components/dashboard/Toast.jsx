import React, { useState, useEffect } from 'react';
import './Toast.css';

/**
 * Modern Toast Notification Component
 * 
 * Usage:
 * import { showToast } from './components/dashboard/Toast';
 * 
 * showToast('Operation successful!', 'success');
 * showToast('Something went wrong', 'error');
 * showToast('Please confirm action', 'warning');
 * showToast('Processing...', 'info');
 */

let toastIdCounter = 0;
let addToastCallback = null;

export const showToast = (message, type = 'info', duration = 4000) => {
  if (addToastCallback) {
    addToastCallback({ message, type, duration });
  }
};

const Toast = () => {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    // Set up the global callback
    addToastCallback = (toast) => {
      const id = toastIdCounter++;
      const newToast = { ...toast, id };
      
      setToasts(prev => [...prev, newToast]);

      // Auto-remove after duration
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, toast.duration);
    };

    return () => {
      addToastCallback = null;
    };
  }, []);

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const getIcon = (type) => {
    switch (type) {
      case 'success':
        return 'bi-check-circle-fill';
      case 'error':
        return 'bi-x-circle-fill';
      case 'warning':
        return 'bi-exclamation-triangle-fill';
      case 'info':
      default:
        return 'bi-info-circle-fill';
    }
  };

  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`toast-notification toast-${toast.type}`}
        >
          <div className="toast-icon-wrapper">
            <i className={`bi ${getIcon(toast.type)} toast-icon`}></i>
          </div>
          <div className="toast-content">
            <p className="toast-message">{toast.message}</p>
          </div>
          <button
            className="toast-close"
            onClick={() => removeToast(toast.id)}
          >
            <i className="bi bi-x-lg"></i>
          </button>
        </div>
      ))}
    </div>
  );
};

export default Toast;
