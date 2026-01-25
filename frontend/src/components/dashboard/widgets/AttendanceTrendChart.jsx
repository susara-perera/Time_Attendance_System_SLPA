import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const lineChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      mode: 'index',
      intersect: false
    }
  },
  interaction: {
    mode: 'nearest',
    axis: 'x',
    intersect: false
  },
  scales: {
    y: {
      beginAtZero: true,
      grid: { color: 'rgba(148, 163, 184, 0.15)' }
    },
    x: {
      grid: { display: false }
    }
  }
};

const AttendanceTrendChart = ({ enabled, refreshKey, onLoaded }) => {
  const [weeklyTrend, setWeeklyTrend] = useState([]);

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

    fetch('/api/dashboard/attendance-trend', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        if (data?.success && Array.isArray(data.data)) setWeeklyTrend(data.data);
      })
      .catch(() => {
        // keep prior
      })
      .finally(() => {
        if (!cancelled) loadedRef.current?.();
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, refreshKey]);

  const chartData = useMemo(() => {
    let weekly = Array.isArray(weeklyTrend) ? weeklyTrend : [];

    if (!weekly || weekly.length === 0) {
      weekly = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        weekly.push({ date: date.toISOString().split('T')[0], employees: 0 });
      }
    }

    const labels = weekly.map(d => {
      const date = new Date(d.date);
      return date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
    });

    const points = weekly.map(d => (typeof d === 'number' ? d : (d?.employees || 0)));

    return {
      labels,
      datasets: [
        {
          label: 'Daily Attendance',
          data: points,
          fill: true,
          backgroundColor: (context) => {
            const ctx = context.chart.ctx;
            const gradient = ctx.createLinearGradient(0, 0, 0, 300);
            gradient.addColorStop(0, 'rgba(59, 130, 246, 0.4)');
            gradient.addColorStop(1, 'rgba(59, 130, 246, 0.05)');
            return gradient;
          },
          borderColor: '#3b82f6',
          borderWidth: 3,
          tension: 0.4,
          pointBackgroundColor: '#3b82f6',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 4
        }
      ]
    };
  }, [weeklyTrend]);

  return (
    <div className="chart-card trend-chart-card">
      <div className="chart-card-header">
        <div className="chart-title">
          <i className="bi bi-graph-up-arrow"></i>
          <h3>Daily Attendance Trend (Last 7 Days)</h3>
        </div>
      </div>
      <div className="chart-card-body">
        <div className="line-chart-container">
          <Line data={chartData} options={lineChartOptions} />
        </div>
      </div>
    </div>
  );
};

export default AttendanceTrendChart;
