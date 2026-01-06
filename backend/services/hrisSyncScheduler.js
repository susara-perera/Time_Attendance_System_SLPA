/**
 * HRIS Sync Scheduler Service
 * 
 * Schedules automatic synchronization of HRIS data to MySQL database
 * Default schedule: Daily at 12:00 PM
 */

const cron = require('node-cron');
const { performFullSync, getSyncStatus } = require('./hrisSyncService');

let syncTask = null;
let isInitialized = false;
let lastSyncResult = null;

/**
 * Initialize scheduler
 * @param {string} cronExpression - Cron expression (default: '0 12 * * *' = daily at 12 PM)
 */
const initializeScheduler = (cronExpression = '0 12 * * *') => {
  if (isInitialized) {
    console.log('⚠️  [SCHEDULER] Already initialized');
    return;
  }

  try {
    // Validate cron expression
    if (!cron.validate(cronExpression)) {
      throw new Error('Invalid cron expression');
    }

    console.log('🕐 [SCHEDULER] Initializing HRIS sync scheduler...');
    console.log(`   Schedule: ${cronExpression} (${getCronDescription(cronExpression)})`);

    // Create scheduled task
    syncTask = cron.schedule(cronExpression, async () => {
      console.log('⏰ [SCHEDULER] Triggered scheduled HRIS sync');
      await runScheduledSync();
    }, {
      scheduled: true,
      timezone: "Asia/Colombo" // Sri Lanka timezone
    });

    isInitialized = true;
    console.log('✅ [SCHEDULER] HRIS sync scheduler initialized successfully');

    // Optionally run initial sync on startup (uncomment if needed)
    // setTimeout(() => {
    //   console.log('🚀 [SCHEDULER] Running initial sync on startup...');
    //   runScheduledSync();
    // }, 5000); // Wait 5 seconds after startup

  } catch (error) {
    console.error('❌ [SCHEDULER] Failed to initialize scheduler:', error.message);
  }
};

/**
 * Run scheduled sync
 */
const runScheduledSync = async () => {
  try {
    console.log('🔄 [SCHEDULER] Starting scheduled HRIS sync...');
    const startTime = new Date();

    const result = await performFullSync('scheduled');

    const endTime = new Date();
    const duration = Math.floor((endTime - startTime) / 1000);

    lastSyncResult = {
      ...result,
      timestamp: endTime,
      duration
    };

    if (result.overall.success) {
      console.log('✅ [SCHEDULER] Scheduled sync completed successfully');
      console.log(`   Duration: ${duration}s`);
      console.log(`   Divisions: ${result.divisions?.recordsSynced || 0} synced`);
      console.log(`   Sections: ${result.sections?.recordsSynced || 0} synced`);
      console.log(`   Employees: ${result.employees?.recordsSynced || 0} synced`);
    } else {
      console.error('❌ [SCHEDULER] Scheduled sync completed with errors');
    }

    return result;

  } catch (error) {
    console.error('❌ [SCHEDULER] Scheduled sync failed:', error.message);
    lastSyncResult = {
      overall: {
        success: false,
        error: error.message
      },
      timestamp: new Date()
    };
    return lastSyncResult;
  }
};

/**
 * Stop scheduler
 */
const stopScheduler = () => {
  if (syncTask) {
    syncTask.stop();
    console.log('🛑 [SCHEDULER] HRIS sync scheduler stopped');
    isInitialized = false;
  }
};

/**
 * Start scheduler
 */
const startScheduler = () => {
  if (syncTask) {
    syncTask.start();
    console.log('▶️  [SCHEDULER] HRIS sync scheduler started');
    isInitialized = true;
  }
};

/**
 * Get scheduler status
 */
const getSchedulerStatus = async () => {
  const syncStatus = await getSyncStatus(5);

  return {
    isRunning: isInitialized && syncTask !== null,
    lastSyncResult,
    ...syncStatus
  };
};

/**
 * Manually trigger sync
 */
const triggerManualSync = async (triggeredBy = 'manual') => {
  console.log(`🔧 [SCHEDULER] Manual sync triggered by: ${triggeredBy}`);
  return await performFullSync(triggeredBy);
};

/**
 * Update scheduler cron expression
 */
const updateSchedule = (newCronExpression) => {
  if (!cron.validate(newCronExpression)) {
    throw new Error('Invalid cron expression');
  }

  stopScheduler();
  syncTask = null;
  isInitialized = false;
  initializeScheduler(newCronExpression);
};

/**
 * Get human-readable description of cron expression
 */
const getCronDescription = (cronExpression) => {
  const descriptions = {
    '0 12 * * *': 'Daily at 12:00 PM',
    '0 0 * * *': 'Daily at midnight',
    '0 */6 * * *': 'Every 6 hours',
    '0 8 * * 1': 'Every Monday at 8:00 AM',
    '*/30 * * * *': 'Every 30 minutes',
    '0 0 * * 0': 'Every Sunday at midnight'
  };

  return descriptions[cronExpression] || 'Custom schedule';
};

module.exports = {
  initializeScheduler,
  stopScheduler,
  startScheduler,
  getSchedulerStatus,
  triggerManualSync,
  updateSchedule,
  runScheduledSync,
  getCronDescription
};
