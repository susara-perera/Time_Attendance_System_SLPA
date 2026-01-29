@echo off
echo ================================================
echo  Date Range Migration for Attendance Cache
echo ================================================
echo.
echo This will add date_range_start and date_range_end
echo columns to the sync_schedules table.
echo.
pause

cd backend
node scripts/addDateRangeToSyncSchedule.js

echo.
echo ================================================
echo Migration Complete!
echo ================================================
echo.
pause
