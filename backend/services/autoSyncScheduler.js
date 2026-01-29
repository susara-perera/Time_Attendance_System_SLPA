const cron = require('node-cron');
const { SyncSchedule } = require('../models/mysql');
const { Op } = require('sequelize');
const hrisSyncService = require('./hrisSyncService');
const cachePreloadService = require('./cachePreloadService');
const { invalidateManagementCaches } = require('../middleware/managementCacheMiddleware');
const { invalidateEmployeeCaches } = require('../middleware/employeeCacheMiddleware');

let schedulerTask = null;

const initialize = () => {
  // Run every 30 seconds (supports second-level intervals)
  // node-cron supports 6-field cron expressions (seconds field)
  schedulerTask = cron.schedule('*/30 * * * * *', async () => {
    await checkAndRunSchedules();
  });
  console.log('✅ Auto Sync Scheduler initialized (checks every 30 seconds)');
};

const checkAndRunSchedules = async () => {
  try {
    const now = new Date();
    
    const schedules = await SyncSchedule.findAll({
      where: {
        mode: 'auto',
        status: { [Op.ne]: 'running' }
      }
    });

    for (const schedule of schedules) {
      // Detailed debug: log schedule state for troubleshooting
      console.debug(`[AutoSync] Checking schedule: ${schedule.task_id} | mode=${schedule.mode} | repeat_enabled=${schedule.repeat_enabled} | repeat_interval=${schedule.repeat_interval} | schedule_date=${schedule.schedule_date} | schedule_time=${schedule.schedule_time} | last_run=${schedule.last_run}`);

      let shouldRun = false;
      let reason = null;

      // Check if repeat is enabled
      if (schedule.repeat_enabled && schedule.repeat_interval !== 'none') {
        const due = checkRepeatSchedule(schedule, now);
        if (due) {
          shouldRun = true;
          reason = `repeat_interval:${schedule.repeat_interval}`;
        }
      } else if (schedule.schedule_date && schedule.schedule_time) {
        // One-time schedule logic
        const scheduledStr = `${schedule.schedule_date}T${schedule.schedule_time}`;
        const scheduledTime = new Date(scheduledStr);
        const lastRun = schedule.last_run ? new Date(schedule.last_run) : new Date(0);
        
        if (now >= scheduledTime && lastRun < scheduledTime) {
          shouldRun = true;
          reason = `one_time:${scheduledStr}`;
        }
      } else if (!schedule.schedule_date && schedule.schedule_time) {
        // Time-only provided: treat as daily schedule (run once per day at this time)
        // Build today's scheduled time in local timezone
        const pad = (n) => (n < 10 ? '0' + n : '' + n);
        const todayLocal = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
        const scheduledStr = `${todayLocal}T${schedule.schedule_time}`;
        const scheduledTime = new Date(scheduledStr);
        const lastRun = schedule.last_run ? new Date(schedule.last_run) : null;

        // If never run, or last run was before today's scheduled time, and scheduled time is passed, run
        if (now >= scheduledTime && (!lastRun || lastRun < scheduledTime)) {
          shouldRun = true;
          reason = `daily_time:${schedule.schedule_time}`;
        }
      }

      if (shouldRun) {
        console.info(`[AutoSync] Triggering schedule: ${schedule.task_id} | reason=${reason} | now=${now.toISOString()}`);
        await runTask(schedule);
      } else if (schedule.repeat_enabled) {
        // Debug: log when a recurring schedule is checked but not due yet (development only)
        if (process.env.NODE_ENV === 'development') {
          console.debug(`[AutoSync] Recurring schedule not due: ${schedule.task_id} (${schedule.repeat_interval})`);
        }
      }
    }
  } catch (err) {
    console.error('Error in Auto Sync Scheduler:', err);
  }
};

const checkRepeatSchedule = (schedule, now) => {
  const lastRun = schedule.last_run ? new Date(schedule.last_run) : null;
  
  // If never run, check if start date/time has passed (if specified)
  if (!lastRun) {
    if (schedule.schedule_date && schedule.schedule_time) {
      const startTime = new Date(`${schedule.schedule_date}T${schedule.schedule_time}`);
      if (now < startTime) return false; // Not yet time to start
    }
    return true; // Run immediately if no start time or start time passed
  }

  // Calculate time difference since last run (in seconds)
  const secondsSinceLastRun = (now - lastRun) / 1000;

  switch (schedule.repeat_interval) {
    case 'every_30_seconds':
      return secondsSinceLastRun >= 30;
    case 'every_minute':
      return secondsSinceLastRun >= 60;
    case 'every_5_minutes':
      return secondsSinceLastRun >= 300;
    case 'every_15_minutes':
      return secondsSinceLastRun >= 900;
    case 'every_30_minutes':
      return secondsSinceLastRun >= 1800;
    case 'hourly':
      return secondsSinceLastRun >= 3600;
    case 'daily':
      return secondsSinceLastRun >= 86400;
    case 'weekly':
      return secondsSinceLastRun >= 604800;
    default:
      return false;
  }
};

const runTask = async (schedule) => {
  const repeatInfo = schedule.repeat_enabled ? ` (${schedule.repeat_interval})` : '';
  console.log(`⏰ Running scheduled task: ${schedule.task_name}${repeatInfo}`);
  
  try {
    await schedule.update({ status: 'running', last_run: new Date() });

    switch(schedule.task_id) {
      case 'divisions_sync':
        await hrisSyncService.syncDivisions();
        break;
      case 'sections_sync':
        await hrisSyncService.syncSections();
        break;
      case 'employees_sync':
        await hrisSyncService.syncEmployees();
        break;
      case 'dashboard_sync':
        const { updateDashboardTotals } = require('./dashboardTotalsService');
        await updateDashboardTotals();
        break;
      case 'attendance_cache':
        // Check if date range is specified for this schedule
        if (schedule.date_range_start && schedule.date_range_end) {
          console.log(`📅 Using date range: ${schedule.date_range_start} to ${schedule.date_range_end}`);
          const cacheResult = await cachePreloadService.preloadAttendanceRange(
            schedule.date_range_start,
            schedule.date_range_end,
            'auto-scheduler',
            null
          );
          if (!cacheResult || !cacheResult.success) {
            throw new Error(`Attendance cache failed: ${cacheResult?.message || 'Unknown error'}`);
          }
        } else {
          // Default: preload all (1 is typically super_admin)
          const cacheResult = await cachePreloadService.preloadAll(1);
          if (!cacheResult || !cacheResult.success) {
            throw new Error(`Cache preload failed: ${cacheResult?.message || 'Unknown error'}`);
          }
        }
        break;
      case 'employees_cache':
        await invalidateEmployeeCaches();
        break;
      case 'divisions_cache':
        await invalidateManagementCaches();
        break;
      case 'sections_cache':
        await invalidateManagementCaches();
        break;
      case 'subsections_cache':
        await invalidateManagementCaches();
        break;
      default:
        console.warn(`Unknown task_id: ${schedule.task_id}`);
    }

    await schedule.update({ status: 'idle', last_message: 'Completed successfully' });
    console.log(`✅ Scheduled task ${schedule.task_name} completed`);

  } catch (err) {
    console.error(`❌ Scheduled task ${schedule.task_name} failed:`, err);
    await schedule.update({ status: 'error', last_message: err.message });
  }
};

module.exports = { initialize, checkAndRunSchedules };
