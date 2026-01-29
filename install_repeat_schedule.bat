@echo off
echo ========================================
echo Installing Repeat Schedule Feature
echo ========================================
echo.

cd backend

echo Step 1: Adding repeat columns to database...
node add_repeat_interval_to_sync_schedule.js

echo.
echo ========================================
echo Installation Complete!
echo ========================================
echo.
echo Please restart your backend server to apply changes.
echo.
pause
