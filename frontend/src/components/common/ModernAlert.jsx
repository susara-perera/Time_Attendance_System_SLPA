import './ModernAlert.css';

/**
 * Modern Alert/Notification System
 * Replaces basic alert() with beautiful, animated notifications
 * 
 * Usage:
 * import { showModernAlert, showConfirmDialog } from './ModernAlert';
 * 
 * showModernAlert({
 *   type: 'success',
 *   title: 'Success!',
 *   message: 'User created successfully',
 *   duration: 3000
 * });
 * 
 * const confirmed = await showConfirmDialog({
 *   title: 'Delete User',
 *   message: 'Are you sure you want to delete this user?',
 *   confirmText: 'Delete',
 *   cancelText: 'Cancel',
 *   type: 'danger'
 * });
 */

let alertContainer = null;

// Create alert container if it doesn't exist
const getAlertContainer = () => {
  if (!alertContainer) {
    alertContainer = document.createElement('div');
    alertContainer.id = 'modern-alert-container';
    alertContainer.className = 'modern-alert-container';
    document.body.appendChild(alertContainer);
  }
  return alertContainer;
};

// Generate unique ID
const generateId = () => `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Icons for different alert types
const getIcon = (type) => {
  const icons = {
    success: 'bi-check-circle-fill',
    error: 'bi-x-circle-fill',
    warning: 'bi-exclamation-triangle-fill',
    info: 'bi-info-circle-fill',
    question: 'bi-question-circle-fill'
  };
  return icons[type] || icons.info;
};

/**
 * Show a modern alert notification
 * @param {Object} options - Alert options
 * @param {string} options.type - Alert type: 'success', 'error', 'warning', 'info'
 * @param {string} options.title - Alert title
 * @param {string} options.message - Alert message
 * @param {number} options.duration - Duration in ms (default: 3000, 0 for persistent)
 * @param {boolean} options.showConfetti - Show confetti animation (success only)
 */
export const showModernAlert = ({
  type = 'info',
  title = '',
  message = '',
  duration = 3000,
  showConfetti = false
}) => {
  const container = getAlertContainer();
  const alertId = generateId();
  
  const alertEl = document.createElement('div');
  alertEl.id = alertId;
  alertEl.className = `modern-alert modern-alert-${type} modern-alert-enter`;
  
  alertEl.innerHTML = `
    <div class="modern-alert-content">
      <div class="modern-alert-icon">
        <i class="bi ${getIcon(type)}"></i>
      </div>
      <div class="modern-alert-body">
        ${title ? `<div class="modern-alert-title">${title}</div>` : ''}
        <div class="modern-alert-message">${message}</div>
      </div>
      <button class="modern-alert-close" onclick="this.closest('.modern-alert').remove()">
        <i class="bi bi-x"></i>
      </button>
    </div>
    <div class="modern-alert-progress"></div>
  `;
  
  container.appendChild(alertEl);
  
  // Trigger animation
  setTimeout(() => {
    alertEl.classList.remove('modern-alert-enter');
    alertEl.classList.add('modern-alert-active');
  }, 10);
  
  // Show confetti for success
  if (showConfetti && type === 'success') {
    triggerConfetti();
  }
  
  // Auto remove after duration
  if (duration > 0) {
    const progressBar = alertEl.querySelector('.modern-alert-progress');
    if (progressBar) {
      progressBar.style.animationDuration = `${duration}ms`;
    }
    
    setTimeout(() => {
      removeAlert(alertId);
    }, duration);
  }
  
  return alertId;
};

/**
 * Show a confirmation dialog
 * @param {Object} options - Dialog options
 * @returns {Promise<boolean>} - True if confirmed, false if cancelled
 */
export const showConfirmDialog = ({
  title = 'Confirm',
  message = 'Are you sure?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'warning', // 'warning', 'danger', 'info'
  showIcon = true
}) => {
  return new Promise((resolve) => {
    const container = getAlertContainer();
    const dialogId = generateId();
    
    const overlay = document.createElement('div');
    overlay.id = dialogId;
    overlay.className = 'modern-dialog-overlay modern-dialog-enter';
    
    overlay.innerHTML = `
      <div class="modern-dialog modern-dialog-${type}">
        <div class="modern-dialog-content">
          ${showIcon ? `
            <div class="modern-dialog-icon">
              <i class="bi ${getIcon(type === 'danger' ? 'error' : type)}"></i>
            </div>
          ` : ''}
          <div class="modern-dialog-body">
            <h3 class="modern-dialog-title">${title}</h3>
            <p class="modern-dialog-message">${message}</p>
          </div>
        </div>
        <div class="modern-dialog-footer">
          <button class="modern-btn modern-btn-cancel" data-action="cancel">
            <i class="bi bi-x-circle"></i>
            ${cancelText}
          </button>
          <button class="modern-btn modern-btn-confirm modern-btn-${type}" data-action="confirm">
            <i class="bi bi-check-circle"></i>
            ${confirmText}
          </button>
        </div>
      </div>
    `;
    
    container.appendChild(overlay);
    
    // Trigger animation
    setTimeout(() => {
      overlay.classList.remove('modern-dialog-enter');
      overlay.classList.add('modern-dialog-active');
    }, 10);
    
    // Handle button clicks
    overlay.addEventListener('click', (e) => {
      if (e.target.closest('[data-action]')) {
        const action = e.target.closest('[data-action]').dataset.action;
        removeDialog(dialogId);
        resolve(action === 'confirm');
      } else if (e.target === overlay) {
        // Click outside to cancel
        removeDialog(dialogId);
        resolve(false);
      }
    });
  });
};

/**
 * Show a loading dialog
 * @param {string} message - Loading message
 * @returns {string} - Dialog ID for later removal
 */
export const showLoadingDialog = (message = 'Processing...') => {
  const container = getAlertContainer();
  const dialogId = generateId();
  
  const overlay = document.createElement('div');
  overlay.id = dialogId;
  overlay.className = 'modern-dialog-overlay modern-dialog-enter';
  
  overlay.innerHTML = `
    <div class="modern-dialog modern-dialog-loading">
      <div class="modern-dialog-content">
        <div class="modern-loading-spinner">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
        </div>
        <p class="modern-dialog-message">${message}</p>
      </div>
    </div>
  `;
  
  container.appendChild(overlay);
  
  setTimeout(() => {
    overlay.classList.remove('modern-dialog-enter');
    overlay.classList.add('modern-dialog-active');
  }, 10);
  
  return dialogId;
};

/**
 * Remove a specific alert
 */
const removeAlert = (alertId) => {
  const alert = document.getElementById(alertId);
  if (alert) {
    alert.classList.remove('modern-alert-active');
    alert.classList.add('modern-alert-exit');
    setTimeout(() => {
      alert.remove();
    }, 300);
  }
};

/**
 * Remove a specific dialog
 */
const removeDialog = (dialogId) => {
  const dialog = document.getElementById(dialogId);
  if (dialog) {
    dialog.classList.remove('modern-dialog-active');
    dialog.classList.add('modern-dialog-exit');
    setTimeout(() => {
      dialog.remove();
    }, 300);
  }
};

/**
 * Close a loading dialog
 */
export const closeLoadingDialog = (dialogId) => {
  removeDialog(dialogId);
};

/**
 * Confetti animation for success
 */
const triggerConfetti = () => {
  const confettiCount = 50;
  const container = document.body;
  
  for (let i = 0; i < confettiCount; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti';
    confetti.style.left = `${Math.random() * 100}%`;
    confetti.style.animationDelay = `${Math.random() * 0.5}s`;
    confetti.style.backgroundColor = getRandomColor();
    container.appendChild(confetti);
    
    setTimeout(() => confetti.remove(), 3000);
  }
};

const getRandomColor = () => {
  const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#6c5ce7', '#a29bfe', '#fd79a8'];
  return colors[Math.floor(Math.random() * colors.length)];
};

