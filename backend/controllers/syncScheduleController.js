const { SyncSchedule } = require('../models/mysql');
const { Op } = require('sequelize');

exports.getSchedules = async (req, res) => {
  try {
    const schedules = await SyncSchedule.findAll();
    res.status(200).json({
      success: true,
      data: schedules
    });
  } catch (error) {
    console.error('Error fetching schedules:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

exports.updateSchedule = async (req, res) => {
  try {
    const { task_id } = req.params;
    const { task_name, description, mode, schedule_date, schedule_time, date_range_start, date_range_end, repeat_interval, repeat_enabled, last_run, status } = req.body;

    // Validate required fields
    if (!task_id) {
      return res.status(400).json({
        success: false,
        message: 'task_id is required'
      });
    }

    let schedule = await SyncSchedule.findOne({ where: { task_id } });

    if (!schedule) {
      // Create if defaults not migrated yet
      if (!task_name) {
        return res.status(400).json({
          success: false,
          message: 'task_name is required when creating a new schedule'
        });
      }

      schedule = await SyncSchedule.create({
        task_id,
        task_name,
        description: description || '',
        mode: mode || 'manual',
        schedule_date: schedule_date || null,
        schedule_time: schedule_time || null,
        date_range_start: date_range_start || null,
        date_range_end: date_range_end || null,
        repeat_interval: repeat_interval || 'none',
        repeat_enabled: repeat_enabled || false,
        last_run: last_run ? new Date(last_run) : null,
        status: status || 'idle'
      });

      console.log(`✅ Created new schedule: ${task_id}`);
    } else {
      // Update existing schedule
      if (mode !== undefined) schedule.mode = mode;
      if (schedule_date !== undefined) schedule.schedule_date = schedule_date;
      if (schedule_time !== undefined) schedule.schedule_time = schedule_time;
      if (date_range_start !== undefined) schedule.date_range_start = date_range_start;
      if (date_range_end !== undefined) schedule.date_range_end = date_range_end;
      if (repeat_interval !== undefined) schedule.repeat_interval = repeat_interval;
      if (repeat_enabled !== undefined) schedule.repeat_enabled = repeat_enabled;
      if (last_run !== undefined) schedule.last_run = last_run ? new Date(last_run) : null;
      if (status !== undefined) schedule.status = status;
      
      await schedule.save();
      console.log(`✅ Updated schedule: ${task_id}`);
    }

    res.status(200).json({
      success: true,
      data: schedule,
      message: 'Schedule updated successfully'
    });
  } catch (error) {
    console.error('Error updating schedule:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server Error',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// POST /api/sync-schedule/check - trigger schedule check manually
exports.checkNow = async (req, res) => {
  try {
    const { checkAndRunSchedules } = require('../services/autoSyncScheduler');
    await checkAndRunSchedules();
    res.status(200).json({ success: true, message: 'Schedule check triggered' });
  } catch (err) {
    console.error('Error triggering schedule check:', err);
    res.status(500).json({ success: false, message: 'Failed to trigger schedule check' });
  }
};

exports.initializeDefaults = async () => {
  const defaults = [
    { task_id: 'divisions_sync', task_name: 'Divisions Sync', description: 'Sync company divisions from HRIS' },
    { task_id: 'sections_sync', task_name: 'Sections Sync', description: 'Sync organizational sections from HRIS' },
    { task_id: 'employees_sync', task_name: 'Employees Sync', description: 'Sync employee records from HRIS' },
    { task_id: 'dashboard_sync', task_name: 'Dashboard Totals Sync', description: 'Sync total_count_dashboard with divisions, sections, sub-sections and attendance' },
    { task_id: 'attendance_cache', task_name: 'Attendance Table Cache', description: 'Cache attendance data' },
    { task_id: 'employees_cache', task_name: 'Employees Cache', description: 'Preload employees_sync cache' },
    { task_id: 'divisions_cache', task_name: 'Divisions Cache', description: 'Preload divisions_sync cache' },
    { task_id: 'sections_cache', task_name: 'Sections Cache', description: 'Preload sections_sync cache' },
    { task_id: 'subsections_cache', task_name: 'Sub-Sections Cache', description: 'Preload sub_sections cache' }
  ];

  for (const def of defaults) {
    const exists = await SyncSchedule.findOne({ where: { task_id: def.task_id } });
    if (!exists) {
      await SyncSchedule.create(def);
    }
  }
};
