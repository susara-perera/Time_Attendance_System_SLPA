@echo off
echo ========================================
echo  Windows Firewall Configuration
echo  Time Attendance System
echo ========================================
echo.

REM Check if running as administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: This script requires Administrator privileges
    echo.
    echo Please right-click this file and select "Run as administrator"
    echo.
    pause
    exit /b 1
)

echo Running with Administrator privileges...
echo.

echo [1/3] Checking existing firewall rules...
echo.

netsh advfirewall firewall show rule name="Time Attendance System" >nul 2>&1
if %errorlevel%==0 (
    echo Found existing rules. Removing...
    netsh advfirewall firewall delete rule name="Time Attendance System"
    echo ✓ Old rules removed
    echo.
)

echo [2/3] Creating new firewall rules...
echo.

REM Add rule for frontend (port 3000)
netsh advfirewall firewall add rule name="Time Attendance System - Frontend" dir=in action=allow protocol=TCP localport=3000 description="Allow incoming connections to Time Attendance System frontend"
echo ✓ Frontend port 3000 - Allowed

REM Add rule for backend (port 5000)
netsh advfirewall firewall add rule name="Time Attendance System - Backend" dir=in action=allow protocol=TCP localport=5000 description="Allow incoming connections to Time Attendance System backend API"
echo ✓ Backend port 5000 - Allowed

echo.
echo [3/3] Verifying firewall rules...
echo.

netsh advfirewall firewall show rule name="Time Attendance System - Frontend"
echo.
netsh advfirewall firewall show rule name="Time Attendance System - Backend"
echo.

echo ========================================
echo  Firewall Configuration Complete! ✓
echo ========================================
echo.
echo Ports 3000 and 5000 are now open for incoming connections
echo Your Time Attendance System is accessible from network devices
echo.
echo Next step: Run start_system.bat to start the application
echo.
pause
