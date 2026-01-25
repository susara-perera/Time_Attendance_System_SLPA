@echo off
REM Network Setup Helper Script for Windows
REM This script helps configure your system for network access

echo ====================================================
echo Time Attendance System - Network Access Setup
echo ====================================================
echo.

REM Get IP Address
echo [1/5] Detecting your IP address...
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 Address"') do (
    for /f "tokens=1 delims= " %%b in ("%%a") do set IP=%%b
)

if "%IP%"=="" (
    echo ERROR: Could not detect IP address automatically
    set /p IP="Please enter your IP address manually: "
) else (
    echo Found IP: %IP%
)
echo.

REM Create/Update backend .env
echo [2/5] Updating backend configuration...
if not exist "backend\.env" (
    echo Creating backend\.env file...
    (
        echo PORT=5000
        echo HOST=0.0.0.0
        echo NODE_ENV=development
        echo BACKEND_URL=http://%IP%:5000
    ) > backend\.env
) else (
    echo Backend .env already exists. Please update manually:
    echo    BACKEND_URL=http://%IP%:5000
)
echo.

REM Create/Update frontend .env
echo [3/5] Updating frontend configuration...
if not exist "frontend\.env" (
    echo Creating frontend\.env file...
    (
        echo REACT_APP_API_URL=http://%IP%:5000/api
        echo PORT=3000
    ) > frontend\.env
) else (
    echo Frontend .env already exists. Please update manually:
    echo    REACT_APP_API_URL=http://%IP%:5000/api
)
echo.

REM Add firewall rules
echo [4/5] Adding firewall rules...
echo This requires Administrator privileges.
netsh advfirewall firewall add rule name="Node.js Backend (Port 5000)" dir=in action=allow protocol=TCP localport=5000 >nul 2>&1
if %errorlevel%==0 (
    echo Added firewall rule for port 5000 [OK]
) else (
    echo Please run as Administrator to add firewall rules
)

netsh advfirewall firewall add rule name="React Frontend (Port 3000)" dir=in action=allow protocol=TCP localport=3000 >nul 2>&1
if %errorlevel%==0 (
    echo Added firewall rule for port 3000 [OK]
) else (
    echo Please run as Administrator to add firewall rules
)
echo.

REM Summary
echo [5/5] Setup Complete!
echo ====================================================
echo.
echo Your IP Address: %IP%
echo.
echo Access URLs:
echo   - From this computer: http://localhost:3000
echo   - From other devices: http://%IP%:3000
echo.
echo Next Steps:
echo   1. Open TWO command prompts
echo.
echo   2. In first prompt, start backend:
echo      cd backend
echo      node server.js
echo.
echo   3. In second prompt, start frontend:
echo      cd frontend
echo      npm start
echo.
echo   4. Access from any device on your network using:
echo      http://%IP%:3000
echo.
echo ====================================================
echo.

REM Create quick start scripts
echo Creating quick start scripts...

REM Start Backend Script
(
    echo @echo off
    echo echo Starting Backend Server...
    echo cd backend
    echo node server.js
) > start_backend.bat

REM Start Frontend Script
(
    echo @echo off
    echo echo Starting Frontend Server...
    echo cd frontend
    echo npm start
) > start_frontend.bat

REM Start Both Script
(
    echo @echo off
    echo echo Starting Time Attendance System...
    echo echo.
    echo echo [1] Starting Backend...
    echo start "Attendance Backend" cmd /k "cd backend && node server.js"
    echo timeout /t 3 /nobreak ^>nul
    echo echo [2] Starting Frontend...
    echo start "Attendance Frontend" cmd /k "cd frontend && npm start"
    echo echo.
    echo echo Both servers are starting in separate windows.
    echo echo Backend: http://%IP%:5000
    echo echo Frontend: http://%IP%:3000
    echo echo.
    echo pause
) > start_system.bat

echo Created start_backend.bat
echo Created start_frontend.bat
echo Created start_system.bat
echo.

echo You can now use:
echo   - start_system.bat     (starts both backend and frontend)
echo   - start_backend.bat    (starts only backend)
echo   - start_frontend.bat   (starts only frontend)
echo.

pause
