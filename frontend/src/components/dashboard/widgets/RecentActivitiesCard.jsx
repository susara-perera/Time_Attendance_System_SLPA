import React, { useEffect, useMemo, useRef, useState } from 'react';

const formatTimeAgo = (date, time) => {
  try {
    const then = new Date(`${date}T${time}`);
    const now = new Date();
    const diffMs = now - then;

    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} min ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;

    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  } catch (e) {
    return '';
  }
};

const RecentActivitiesCard = ({ enabled, refreshKey, onLoaded }) => {
  const [allActivities, setAllActivities] = useState([]);
  const [showAllActivities, setShowAllActivities] = useState(false);

  const loadedRef = useRef(onLoaded);
  const lastFetchKeyRef = useRef(null);

  useEffect(() => {
    loadedRef.current = onLoaded;
  }, [onLoaded]);

  // Fetch activities function (used for initial load and polling)
  const fetchActivities = React.useCallback((isPolling = false) => {
    if (!enabled) return;

    const token = localStorage.getItem('token');

    fetch('/api/dashboard/activities/recent?limit=50', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
      .then(r => (r.ok ? r.json() : { data: [] }))
      .then(activitiesData => {
        const list = (activitiesData?.data || [])
          .map((a, index) => ({
            ...a,
            id: a.id || `activity-${index}-${Math.random().toString(36).slice(2)}`
          }))
          .sort((a, b) => new Date(`${b.date}T${b.time}`) - new Date(`${a.date}T${a.time}`));

        setAllActivities(list);
        
        // Only call onLoaded for initial fetch, not during polling
        if (!isPolling) {
          loadedRef.current?.();
        }
      })
      .catch(() => {
        // keep prior activities on error
      });
  }, [enabled]);

  // Initial fetch when enabled or refreshKey changes
  useEffect(() => {
    if (!enabled) return;

    if (lastFetchKeyRef.current === refreshKey) return;
    lastFetchKeyRef.current = refreshKey;

    fetchActivities(false);
  }, [enabled, refreshKey, fetchActivities]);

  // Auto-refresh polling every 5 seconds for real-time updates
  useEffect(() => {
    if (!enabled) return;

    const pollInterval = setInterval(() => {
      fetchActivities(true); // Polling fetch (doesn't call onLoaded)
    }, 5000); // 5 seconds

    return () => clearInterval(pollInterval);
  }, [enabled, fetchActivities]);

  const activitiesToShow = useMemo(() => {
    if (showAllActivities) return allActivities;
    return allActivities.slice(0, 5);
  }, [allActivities, showAllActivities]);

  return (
    <div className="bottom-section">
      <div className="activities-card activities-card-enhanced">
        <div className="activities-card-header">
          <div className="activities-title">
            <i className="bi bi-activity"></i>
            <h3>Recent Activities</h3>
          </div>
          <div className="activities-header-actions">
            <span className="activities-badge">{activitiesToShow.length} activities</span>
            <button className="view-all-btn" onClick={() => setShowAllActivities(v => !v)}>
              {showAllActivities ? (
                <>
                  <i className="bi bi-chevron-up"></i> Show Less
                </>
              ) : (
                <>
                  <i className="bi bi-list-ul"></i> View All ({allActivities.length})
                </>
              )}
            </button>
          </div>
        </div>
        <div className={`activities-card-body ${showAllActivities ? 'expanded' : ''}`}>
          {activitiesToShow.length === 0 ? (
            <div className="no-activities">
              <i className="bi bi-inbox"></i>
              <p>No recent activities</p>
            </div>
          ) : (
            <div className="activities-list">
              {activitiesToShow.map((activity, index) => (
                <div
                  className={`activity-item activity-item-${activity.severity || 'low'}`}
                  key={activity.id || index}
                  style={{ '--delay': `${index * 0.05}s` }}
                >
                  <div className={`activity-icon ${activity.severity || 'low'}`}>
                    <i className={activity.icon || 'bi bi-activity'}></i>
                  </div>
                  <div className="activity-content">
                    <div className="activity-header">
                      <h4 className="activity-title">{activity.title}</h4>
                      <span className={`activity-badge activity-badge-${activity.severity || 'low'}`}>
                        {activity.action?.includes('login')
                          ? 'Login'
                          : activity.action?.includes('logout')
                            ? 'Logout'
                            : activity.action?.includes('created')
                              ? 'Created'
                              : activity.action?.includes('updated')
                                ? 'Updated'
                                : activity.action?.includes('deleted')
                                  ? 'Deleted'
                                  : activity.action?.includes('transfer')
                                    ? 'Transfer'
                                    : 'Activity'}
                      </span>
                    </div>
                    <p className="activity-description">{activity.description}</p>
                    <div className="activity-meta">
                      {activity.user && (
                        <span className="activity-user">
                          <i className="bi bi-person-circle"></i> {activity.user}
                        </span>
                      )}
                      <span className="activity-time">
                        <i className="bi bi-clock-history"></i>
                        {formatTimeAgo(activity.date, activity.time)}
                      </span>
                      <span className="activity-date-full">
                        <i className="bi bi-calendar3"></i>
                        {activity.date} {activity.time}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecentActivitiesCard;
