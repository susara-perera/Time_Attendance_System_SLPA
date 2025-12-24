import React from 'react';
import './ProfileCard.css';

const ProfileCard = ({ user = {}, t = (s)=>s, onClose = ()=>{}, onSettings = ()=>{}, onLogout = ()=>{}, canViewSettings = false }) => {
  const getDisplay = (v) => {
    if (v === null || v === undefined) return 'N/A';
    if (typeof v === 'string' || typeof v === 'number') return String(v);
    if (typeof v === 'object') {
      return v.name || v.code || v.fullCode || v._id || JSON.stringify(v);
    }
    return String(v);
  };

  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || user?.name || user?.username || user?.email || '';
  const initials = (() => {
    try {
      if (displayName) {
        const parts = displayName.split(' ').filter(Boolean);
        return parts.map(p => p[0]).slice(0, 2).join('').toUpperCase();
      }
      if (user?.email) return String(user.email[0] || 'U').toUpperCase();
    } catch (e) {}
    return 'U';
  })();

  return (
    <div className="profile-card" role="dialog" aria-label={t('profile')}
      onClick={(e)=>e.stopPropagation()}>
      <div className="profile-card-header">
        <div className="profile-card-avatar">{user?.avatar ? <img src={user.avatar} alt="avatar" /> : <div className="pc-initials">{initials}</div>}</div>
        <div className="profile-card-meta">
          <h3>{displayName || user?.email || 'User'}</h3>
          <div className="profile-card-role">{(typeof user?.role === 'string' ? user.role.replace('_', ' ') : getDisplay(user?.role)) || 'N/A'}</div>
        </div>
        <button className="profile-card-close" onClick={onClose} title={t('close')}>×</button>
      </div>

      <div className="profile-card-body">
        <div className="pc-row"><i className="bi bi-envelope"></i><span>{user?.email || 'N/A'}</span></div>
        <div className="pc-row"><i className="bi bi-phone"></i><span>{user?.phone || 'N/A'}</span></div>
        <div className="pc-row"><i className="bi bi-building"></i><span>{getDisplay(user?.division)}</span></div>
        <div className="pc-row"><i className="bi bi-diagram-3"></i><span>{getDisplay(user?.section)}</span></div>
      </div>

      <div className="profile-card-footer">
        {canViewSettings && (
          <button className="pc-btn pc-settings" onClick={()=>{ onClose(); onSettings(); }}>
            <i className="bi bi-gear"></i>
            <span>{t('settings')}</span>
          </button>
        )}
        <button className="pc-btn pc-logout" onClick={onLogout}>
          <i className="bi bi-box-arrow-right"></i>
          <span>{t('logout')}</span>
        </button>
      </div>
    </div>
  );
};

export default ProfileCard;
