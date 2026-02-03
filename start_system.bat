@echo off
echo ========================================
echo  Starting Time Attendance System
echo ========================================
echo.

REM Get server IP
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 Address"') do (
    set IP=%%a
    goto :found
)

:found
for /f "tokens=* delims= " %%a in ("%IP%") do set SERVER_IP=%%a

echo Server IP: %SERVER_IP%
echo.
echo Starting services...
echo.

REM Check if MySQL is running
echo [1/4] Checking MySQL...
tasklist /FI "IMAGENAME eq mysqld.exe" 2>NUL | find /I /N "mysqld.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo ✓ MySQL is running
) else (
    echo ! MySQL is not running
    echo   Please start MySQL service first
    echo.
)

REM Check if Redis is running (optional)
echo [2/4] Checking Redis...
tasklist /FI "IMAGENAME eq redis-server.exe" 2>NUL | find /I /N "redis-server.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo ✓ Redis is running
) else (
    echo ! Redis is not running ^(optional but recommended^)
)
echo.

REM Start Backend
echo [3/4] Starting Backend Server...
echo.
start "Time Attendance Backend" cmd /k "cd backend && echo Backend starting on http://%SERVER_IP%:5000 && npm start"
timeout /t 3 /nobreak >nul
echo ✓ Backend started in new window
echo.

REM Start Frontend
echo [4/4] Starting Frontend Application...
echo.
start "Time Attendance Frontend" cmd /k "cd frontend && echo Frontend starting on http://%SERVER_IP%:3000 && set BROWSER=none && npm start"
timeout /t 3 /nobreak >nul
echo ✓ Frontend started in new window
echo.

echo ========================================
echo  System Started Successfully! 🎉
echo ========================================
echo.
echo Access the system:
echo.
echo 🖥️  On this PC:
echo    http://localhost:3000
echo.
echo 🌐 On network devices:
echo    http://%SERVER_IP%:3000
echo.
echo ========================================
echo.
echo Backend and Frontend are running in separate windows
echo Close those windows to stop the system
echo.
echo Press any key to close this window...
pause >nul
