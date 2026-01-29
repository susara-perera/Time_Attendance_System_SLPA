# 📅 Attendance Cache Date Range Feature - Setup Guide

## Overview
Added date range selection for attendance caching to handle large attendance tables efficiently. Users can now select specific date ranges when caching attendance data.

## What Changed

### Backend Changes

#### 1. Database Model (`backend/models/mysql/SyncSchedule.js`)
- ✅ Added `date_range_start` field (DATEONLY)
- ✅ Added `date_range_end` field (DATEONLY)

#### 2. Cache Controller (`backend/controllers/cacheController.js`)
- ✅ Updated `warmupCache` to accept `startDate` and `endDate` query parameters
- ✅ Calls `preloadAttendanceRange()` when date range is provided
- ✅ Falls back to default behavior when no date range is specified

#### 3. Auto Sync Scheduler (`backend/services/autoSyncScheduler.js`)
- ✅ Updated `attendance_cache` task to use date range from schedule
- ✅ Uses `preloadAttendanceRange()` when date range is set
- ✅ Falls back to `preloadAll()` if no date range specified

#### 4. Schedule Controller (`backend/controllers/syncScheduleController.js`)
- ✅ Updated `updateSchedule` to handle `date_range_start` and `date_range_end` fields

### Frontend Changes

#### 5. ManualSyncNew Component (`frontend/src/components/dashboard/ManualSyncNew.jsx`)
- ✅ Added attendance_cache to sync tables list
- ✅ Date range modal already exists (reused)
- ✅ Sends date range as query parameters to `/api/cache/warmup`

#### 6. ManualSync Component (`frontend/src/components/dashboard/ManualSync.jsx`)
- ✅ Added date range state management
- ✅ Added date range modal dialog
- ✅ Shows modal when attendance_cache is triggered
- ✅ Sends date range as query parameters

## Setup Instructions

### Step 1: Run Database Migration
Run the migration script to add new columns to the database:

```bash
cd backend
node scripts/addDateRangeToSyncSchedule.js
```

This will add:
- `date_range_start` (DATE)
- `date_range_end` (DATE)

### Step 2: Restart Backend Server
Restart the backend to load the updated model:

```bash
# Stop current server (Ctrl+C)
npm start
```

### Step 3: Test the Feature

#### Manual Cache with Date Range:
1. Navigate to **Manual Sync** page in the dashboard
2. Click the **Start** button for "Attendance Table Cache"
3. A modal will appear asking for date range
4. Select your start and end dates
5. Click **Start Caching**
6. Progress will be shown

#### Scheduled Cache with Date Range:
1. In the Manual Sync page, find the "Attendance Table Cache" row
2. Switch mode to **Auto**
3. Set the schedule date and time
4. The date range fields can be set via API or directly in database
5. Scheduler will use the date range when running automatically

## API Usage

### Manual Cache with Date Range

**Endpoint:** `POST /api/cache/warmup?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`

**Example:**
```bash
curl -X POST "http://localhost:5000/api/cache/warmup?startDate=2026-01-01&endDate=2026-01-26" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "message": "Cache warmed up successfully for 2026-01-01 to 2026-01-26",
  "data": {
    "success": true,
    "stats": {
      "recordsProcessed": 5000,
      "recordsInserted": 4800,
      "recordsUpdated": 200
    }
  }
}
```

### Update Schedule with Date Range

**Endpoint:** `PUT /api/sync-schedule/attendance_cache`

**Body:**
```json
{
  "mode": "auto",
  "schedule_date": "2026-01-27",
  "schedule_time": "02:00:00",
  "date_range_start": "2026-01-01",
  "date_range_end": "2026-01-31"
}
```

## Benefits

✅ **Reduced Memory Usage** - Cache only necessary date ranges
✅ **Faster Caching** - Smaller datasets process quicker  
✅ **Flexible Control** - Users decide what to cache
✅ **Scheduled Automation** - Auto-schedule with custom date ranges
✅ **Better Performance** - Focus caching on active date ranges

## Default Behavior

If no date range is provided:
- Manual sync: Full cache (all data)
- With date range: Only specified date range

Recommended for large tables (>100K records):
- Cache last 3-6 months for regular reports
- Cache specific date ranges for historical reports

## Troubleshooting

### Modal doesn't appear
- Clear browser cache
- Hard refresh (Ctrl+Shift+R)

### Date range not working
- Check migration ran successfully
- Verify columns exist: `DESCRIBE sync_schedules;`

### Scheduled cache ignoring date range
- Verify `date_range_start` and `date_range_end` are set in database
- Check scheduler logs for date range usage

## Files Modified

### Backend (4 files)
- `backend/models/mysql/SyncSchedule.js`
- `backend/controllers/cacheController.js`
- `backend/services/autoSyncScheduler.js`
- `backend/controllers/syncScheduleController.js`

### Frontend (2 files)
- `frontend/src/components/dashboard/ManualSyncNew.jsx`
- `frontend/src/components/dashboard/ManualSync.jsx`

### New Files (2 files)
- `backend/scripts/addDateRangeToSyncSchedule.js` (migration)
- `ATTENDANCE_CACHE_DATE_RANGE_GUIDE.md` (this file)

---

## Quick Reference

| Feature | Status |
|---------|--------|
| Date range in model | ✅ |
| Date range in API | ✅ |
| Date range in scheduler | ✅ |
| Date range modal UI | ✅ |
| Migration script | ✅ |
| Documentation | ✅ |

**Ready to use!** 🎉
