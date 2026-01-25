import React, { useEffect, useRef, useState } from 'react';

const TotalSectionsCard = ({ enabled, refreshKey, onLoaded }) => {
  const [count, setCount] = useState(0);
  const [animated, setAnimated] = useState(0);

  const loadedRef = useRef(onLoaded);
  const lastFetchKeyRef = useRef(null);

  useEffect(() => {
    loadedRef.current = onLoaded;
  }, [onLoaded]);

  useEffect(() => {
    if (!enabled) return;

    if (lastFetchKeyRef.current === refreshKey) return;
    lastFetchKeyRef.current = refreshKey;

    let cancelled = false;
    const token = localStorage.getItem('token');

    fetch('/api/dashboard/total-sections', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        if (data?.success) setCount(Number(data.count) || 0);
      })
      .catch(() => {
        // keep prior count
      })
      .finally(() => {
        if (!cancelled) loadedRef.current?.();
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, refreshKey]);

  useEffect(() => {
    const duration = 800;
    const steps = 40;
    const stepDuration = duration / steps;
    let step = 0;

    const start = animated;
    const target = count;

    const timer = setInterval(() => {
      step += 1;
      const progress = step / steps;
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = Math.round(start + (target - start) * eased);
      setAnimated(next);
      if (step >= steps) clearInterval(timer);
    }, stepDuration);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  return (
    <div className="stat-card stat-card-gradient stat-card-info" style={{ '--delay': '0.25s' }}>
      <div className="stat-card-inner">
        <div className="stat-card-icon-wrapper">
          <div className="stat-icon-circle">
            <i className="bi bi-diagram-3-fill"></i>
          </div>
          <div className="stat-icon-ring"></div>
        </div>
        <div className="stat-card-data">
          <h3 className="stat-number">{animated || 0}</h3>
          <p className="stat-title">Total Sections</p>
          <span className="stat-subtitle">
            <i className="bi bi-grid-3x3-gap-fill"></i> Department sections
          </span>
        </div>
      </div>
    </div>
  );
};

export default TotalSectionsCard;
