@echo off
REM Performance Optimization Setup Script
REM This script will:
REM 1. Install Redis for Windows
REM 2. Enable Redis caching in .env
REM 3. Start Redis server
REM 4. Test the setup

echo.
echo ========================================================================
echo   PERFORMANCE OPTIMIZATION SETUP
echo ========================================================================
echo.
echo This will install and configure Redis caching for 10-60x speed boost!
echo.
echo Current Performance (without Redis):
echo   - Dashboard load: 500ms
echo   - IS Attendance: 347ms  
echo   - Employee lists: 3100ms
echo.
echo After Redis (expected):
echo   - Dashboard load: 20-50ms (10x faster)
echo   - IS Attendance: 30-40ms (11x faster)
echo   - Employee lists: 50ms (62x faster when cached)
echo.
pause

echo.
echo ========================================================================
echo   STEP 1: Installing Redis
echo ========================================================================
echo.

REM Check if Chocolatey is installed
where choco >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Chocolatey is not installed!
    echo.
    echo Please install Chocolatey first:
    echo   1. Run PowerShell as Administrator
    echo   2. Execute: Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'^)^)
    echo   3. Run this script again
    echo.
    pause
    exit /b 1
)

echo Installing Redis...
choco install redis-64 -y

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Redis installation failed!
    echo Please install manually or check Chocolatey setup.
    pause
    exit /b 1
)

echo.
echo ========================================================================
echo   STEP 2: Configuring .env
echo ========================================================================
echo.

cd /d "%~dp0backend"

REM Check if .env exists
if not exist ".env" (
    echo ERROR: .env file not found!
    echo Please make sure you're in the correct directory.
    pause
    exit /b 1
)

REM Backup .env
copy .env .env.backup >nul 2>nul
echo Created backup: .env.backup

REM Check if REDIS_ENABLED already exists
findstr /C:"REDIS_ENABLED" .env >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo REDIS_ENABLED already exists in .env
    echo Updating value to true...
    
    REM Use PowerShell to update the value
    powershell -Command "(Get-Content .env) -replace 'REDIS_ENABLED=.*', 'REDIS_ENABLED=true' | Set-Content .env"
) else (
    echo Adding Redis configuration to .env...
    echo. >> .env
    echo # Redis Cache Configuration >> .env
    echo REDIS_ENABLED=true >> .env
    echo REDIS_HOST=localhost >> .env
    echo REDIS_PORT=6379 >> .env
    echo REDIS_PASSWORD= >> .env
)

echo.
echo Configuration updated!

echo.
echo ========================================================================
echo   STEP 3: Starting Redis Server
echo ========================================================================
echo.

echo Starting Redis server...
start "Redis Server" redis-server

REM Wait for Redis to start
timeout /t 3 /nobreak >nul

REM Test Redis connection
redis-cli ping >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Redis server started successfully!
) else (
    echo WARNING: Could not connect to Redis
    echo Redis server window should have opened - check if it's running
)

echo.
echo ========================================================================
echo   STEP 4: Testing Setup
echo ========================================================================
echo.

echo Running Redis connection test...
node test-redis.js

echo.
echo ========================================================================
echo   SETUP COMPLETE!
echo ========================================================================
echo.
echo Next steps:
echo   1. Restart your backend server (npm start)
echo   2. Use the system normally
echo   3. First requests will be slow (cache miss)
echo   4. Subsequent requests will be VERY fast (cache hit)
echo.
echo Monitor performance:
echo   - Check cache stats: http://localhost:5000/api/performance/stats
echo   - View cache hits: http://localhost:5000/api/performance/endpoints
echo.
echo Redis server is running in a separate window.
echo Keep that window open while using the system.
echo.
pause
