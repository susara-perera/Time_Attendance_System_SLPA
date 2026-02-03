@echo off
echo ========================================
echo  Network Setup Verification
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

echo [1/4] Checking Frontend Configuration...
if exist "frontend\.env" (
    echo ✓ Frontend .env file exists
    findstr "REACT_APP_API_URL" frontend\.env
) else (
    echo ✗ Frontend .env file not found!
    echo   Run: setup_network_access.bat
)
echo.

echo [2/4] Checking Backend Configuration...
if exist "backend\.env" (
    echo ✓ Backend .env file exists
    findstr "ALLOWED_ORIGINS" backend\.env | findstr "%SERVER_IP%" >nul
    if %errorlevel%==0 (
        echo ✓ Network IP configured in CORS settings
    ) else (
        echo ! Network IP not found in CORS settings
        echo   Current IP: %SERVER_IP%
    )
) else (
    echo ✗ Backend .env file not found!
)
echo.

echo [3/4] Checking MySQL Service...
tasklist /FI "IMAGENAME eq mysqld.exe" 2>NUL | find /I /N "mysqld.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo ✓ MySQL is running
) else (
    echo ✗ MySQL is not running
    echo   Start MySQL service to continue
)
echo.

echo [4/4] Checking Redis Service...
tasklist /FI "IMAGENAME eq redis-server.exe" 2>NUL | find /I /N "redis-server.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo ✓ Redis is running
) else (
    echo ! Redis is not running (optional but recommended)
)
echo.

echo ========================================
echo  Access Information
echo ========================================
echo.
echo On this server:
echo   http://localhost:3000
echo.
echo From network devices:
echo   http://%SERVER_IP%:3000
echo.
echo Backend API:
echo   http://%SERVER_IP%:5000
echo.
echo ========================================
echo.

pause
