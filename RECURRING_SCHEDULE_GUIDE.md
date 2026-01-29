# 🔄 Recurring Schedule Feature - Complete Guide

## Overview
The Manual Sync page now supports **recurring schedules** with multiple interval options, allowing automated tasks to repeat at specified intervals (from 30 seconds to weekly).

## ✨ Features

### Repeat Interval Options
- **Every 30 Seconds** - For testing or high-frequency syncs
- **Every Minute** - Quick recurring updates
- **Every 5 Minutes** - Moderate frequency
- **Every 15 Minutes** - Standard sync interval
- **Every 30 Minutes** - Half-hourly updates
- **Hourly** - Once per hour
- **Daily** - Once per day
- **Weekly** - Once per week
- **No Repeat** - One-time execution (default)

## 📋 Installation

Run the installation script:
```bash
install_repeat_schedule.bat
```

Or manually:
```bash
cd backend
node add_repeat_interval_to_sync_schedule.js
```

Then **restart your backend server**.

## 🎯 How to Use

### Setting Up a Recurring Schedule

1. **Navigate to Manual Sync Page**
   - Go to your dashboard
   - Click on "Manual Sync" in the navigation menu

2. **Enable Auto Mode**
   - For the task you want to automate, toggle the mode from "Manual" to "Auto"

3. **Select Repeat Interval**
   - Click the dropdown in the "Repeat Interval" column
   - Choose your desired interval (e.g., "Every 15 Minutes")
   - The system automatically enables recurring when you select an interval

4. **Set Start Date/Time (Optional)**
   - For recurring tasks, the date/time acts as the "start time"
   - If left blank, the task starts immediately
   - Example: Set to "2026-01-27 09:00:00" to start recurring at 9 AM

5. **View Status**
   - Tasks with recurring schedules show a "🔄 Recurring" badge
   - Last run time is displayed below the task name
   - Check the scheduler logs for execution confirmations

## 🔧 Configuration Examples

### Example 1: Cache Attendance Data Every 30 Minutes
```
Task: Attendance Table Cache
Mode: Auto
Repeat Interval: Every 30 Minutes
Start Date: (today)
Start Time: 00:00:00
```
Result: Caches attendance data every 30 minutes, starting immediately

### Example 2: Sync Employees Daily at Midnight
```
Task: Employees Sync
Mode: Auto
Repeat Interval: Daily
Start Date: 2026-01-27
Start Time: 00:00:00
```
Result: Syncs employees every day at midnight

### Example 3: Update Dashboard Every 5 Minutes
```
Task: Dashboard Totals Sync
Mode: Auto
Repeat Interval: Every 5 Minutes
Start Date: (leave empty)
Start Time: (leave empty)
```
Result: Updates dashboard immediately and every 5 minutes thereafter

### Example 4: Weekly Full Division Sync
```
Task: Divisions Sync
Mode: Auto
Repeat Interval: Weekly
Start Date: 2026-01-28
Start Time: 02:00:00
```
Result: Syncs divisions every Monday at 2 AM (starting from specified date)

## 📊 Scheduler Behavior

### How It Works
1. **Every Minute Check**: The scheduler runs every minute to check all auto schedules
2. **Time Calculation**: For recurring tasks, it calculates time since last run
3. **Interval Matching**: If the interval time has passed, the task executes
4. **Continuous Loop**: After execution, the timer resets for the next interval

### Important Notes
- ✅ Tasks set to "Manual" mode will NOT run automatically
- ✅ Changing the repeat interval takes effect immediately
- ✅ You can still manually trigger tasks even if on recurring schedule
- ✅ Tasks won't run twice if already running (status check prevents duplicates)
- ✅ Last run time updates after each execution

## 🎨 UI Features

### Visual Indicators
- **Recurring Badge**: Shows "🔄 Recurring" for enabled recurring tasks
- **Disabled State**: Date/time fields are disabled when mode is "Manual"
- **Dropdown Selection**: Clean dropdown menu with all interval options
- **Last Run Display**: Shows when the task last executed

### Table Layout
```
┌────────────┬─────────────┬──────────┬────────┬──────┬───────────────┬──────────┐
│    Name    │ Description │ Progress │ Action │ Mode │ Repeat Inter. │ Schedule │
├────────────┼─────────────┼──────────┼────────┼──────┼───────────────┼──────────┤
│ Employees  │ Sync emp... │  Ready   │ [Start]│ Auto │ Every 15 Mins │ Date/Time│
│ Sync       │             │          │        │      │ 🔄 Recurring  │          │
└────────────┴─────────────┴──────────┴────────┴──────┴───────────────┴──────────┘
```

## 🔍 Monitoring & Troubleshooting

### Check Scheduler Logs
Look for these console messages in your backend:
```
✅ Auto Sync Scheduler initialized (checks every minute)
⏰ Running scheduled task: Employees Sync (every_15_minutes)
✅ Scheduled task Employees Sync completed
```

### Common Issues

**Task Not Running:**
- Verify mode is set to "Auto"
- Check repeat interval is not "No Repeat"
- Ensure start date/time hasn't been set to future
- Check backend server is running

**Task Running Too Often:**
- Verify the selected interval is correct
- Check server time is accurate
- Review last_run timestamp in database

**Task Never Executed:**
- Check `sync_schedules` table exists
- Verify repeat columns were added (run migration)
- Check for errors in backend console

### Database Check
```sql
SELECT task_id, task_name, mode, repeat_interval, repeat_enabled, last_run, status
FROM sync_schedules
WHERE mode = 'auto';
```

## 🗄️ Database Schema

### New Columns Added
```sql
repeat_interval ENUM(
  'none', 
  'every_30_seconds', 
  'every_minute', 
  'every_5_minutes', 
  'every_15_minutes', 
  'every_30_minutes', 
  'hourly', 
  'daily', 
  'weekly'
) DEFAULT 'none'

repeat_enabled BOOLEAN DEFAULT FALSE
```

## 🚀 Advanced Usage

### Combining One-Time and Recurring
You can set a future start date/time with a recurring interval:
- **Start Date/Time**: When the recurring schedule begins
- **Repeat Interval**: How often it repeats after starting
- Result: Task waits until start time, then repeats at the specified interval

### High-Frequency Testing
For development/testing:
1. Use "Every 30 Seconds" for rapid testing
2. Monitor backend console for execution logs
3. Switch to appropriate interval for production

### Performance Considerations
- **Every 30 Seconds/Minute**: Best for lightweight cache operations
- **Every 5-15 Minutes**: Ideal for most sync operations
- **Hourly/Daily**: Suitable for heavy HRIS syncs
- **Weekly**: Good for comprehensive full system syncs

## 📝 Best Practices

1. **Start Conservative**: Begin with longer intervals, reduce if needed
2. **Monitor Performance**: Watch server load during recurring tasks
3. **Stagger Tasks**: Avoid scheduling all tasks at the same time
4. **Test First**: Use manual triggers before enabling recurring
5. **Document Schedule**: Note why specific intervals were chosen

## 🔄 Upgrading from Previous Version

If you had existing schedules:
1. Run the migration script
2. Existing schedules default to "No Repeat"
3. Update each task individually to enable recurring
4. No data loss - all previous settings preserved

## 🎯 Quick Reference

| Interval | Seconds | Use Case |
|----------|---------|----------|
| 30 sec | 30 | Testing only |
| 1 min | 60 | Real-time cache updates |
| 5 min | 300 | Frequent data sync |
| 15 min | 900 | Standard operations |
| 30 min | 1,800 | Moderate frequency |
| Hourly | 3,600 | Regular updates |
| Daily | 86,400 | Nightly processes |
| Weekly | 604,800 | Full system sync |

## 📞 Support

If you encounter issues:
1. Check backend console logs
2. Verify database migration completed
3. Ensure server restart after installation
4. Review this documentation
5. Check the `sync_schedules` table directly

---

**Version**: 2.0  
**Last Updated**: January 26, 2026  
**Status**: ✅ Ready for Production
