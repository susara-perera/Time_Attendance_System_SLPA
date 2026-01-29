@echo off
echo ========================================
echo Redis Cache - Quick Test Script
echo ========================================
echo.

echo [1/4] Checking if Redis is installed...
where redis-server >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Redis is not found in PATH
    echo Please make sure Redis is installed
    pause
    exit /b 1
)
echo [OK] Redis found!
echo.

echo [2/4] Checking if Redis is running...
tasklist /FI "IMAGENAME eq redis-server.exe" 2>NUL | find /I /N "redis-server.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo [OK] Redis is running!
) else (
    echo [WARNING] Redis is not running
    echo.
    echo Would you like to start Redis? (Y/N)
    set /p start_redis=
    if /i "%start_redis%"=="Y" (
        echo Starting Redis...
        start "Redis Server" redis-server
        timeout /t 3 /nobreak >nul
        echo [OK] Redis started!
    )
)
echo.

echo [3/4] Testing Redis connection...
redis-cli ping >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Redis connection successful!
    echo Response: PONG
) else (
    echo [ERROR] Cannot connect to Redis
    echo Please check if Redis is running on localhost:6379
    pause
    exit /b 1
)
echo.

echo [4/4] Redis Information...
echo Server: localhost:6379
echo Status: Connected
echo.
redis-cli info server | findstr redis_version
redis-cli info server | findstr os
echo.

echo ========================================
echo Redis Cache Status: READY ✓
echo ========================================
echo.
echo You can now start the backend server:
echo   cd backend
echo   npm start
echo.
echo Look for: "✅ Redis cache connected"
echo.
pause
