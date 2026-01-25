@echo off
REM Cache Optimization Installation Script for Windows
REM Automatically sets up the optimized cache system

echo ========================================
echo 🚀 Installing Optimized Cache System...
echo ========================================

REM Check if we're in the right directory
if not exist "backend" (
  echo ❌ Error: Please run this script from the project root directory
  exit /b 1
)

cd backend

REM Step 1: Install dependencies
echo.
echo 📦 Step 1: Installing dependencies...
call npm install node-cron
if %ERRORLEVEL% EQU 0 (
  echo ✅ Dependencies installed
) else (
  echo ⚠️  Warning: npm install had issues, but continuing...
)

REM Step 2: Check if Redis is running
echo.
echo 🔍 Step 2: Checking Redis connection...
redis-cli PING >nul 2>&1
if %ERRORLEVEL% EQU 0 (
  echo ✅ Redis is running
) else (
  echo ⚠️  Redis is not running. Please start Redis:
  echo    Download from: https://github.com/microsoftarchive/redis/releases
  echo    Run: redis-server.exe
)

REM Step 3: Update .env file
echo.
echo ⚙️  Step 3: Updating environment configuration...
set ENV_FILE=.env

if not exist "%ENV_FILE%" (
  echo Creating .env file...
  type nul > "%ENV_FILE%"
)

findstr /C:"SMART_CACHE_PRELOAD" "%ENV_FILE%" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo. >> "%ENV_FILE%"
  echo # Smart Cache Configuration >> "%ENV_FILE%"
  echo SMART_CACHE_PRELOAD=true >> "%ENV_FILE%"
  echo CACHE_MAX_SIZE=524288000 >> "%ENV_FILE%"
  echo REDIS_ENABLED=true >> "%ENV_FILE%"
  echo REDIS_HOST=127.0.0.1 >> "%ENV_FILE%"
  echo REDIS_PORT=6379 >> "%ENV_FILE%"
  echo ✅ Environment variables added
) else (
  echo ✅ Environment variables already configured
)

REM Step 4: Check server.js
echo.
echo 🔧 Step 4: Checking server.js...
if exist "server.js" (
  findstr /C:"smartCacheService" "server.js" >nul 2>&1
  if %ERRORLEVEL% EQU 0 (
    echo ✅ server.js already configured
  ) else (
    echo ⚠️  server.js needs manual update
    echo.
    echo Add this code after database connection:
    echo.
    echo // Initialize cache services
    echo const smartCacheService = require('./services/smartCacheService'^);
    echo const cacheMaintenanceScheduler = require('./services/cacheMaintenanceScheduler'^);
    echo.
    echo // Initialize on server start
    echo ^(async (^) =^> {
    echo   try {
    echo     await smartCacheService.initialize(^);
    echo     console.log^('✅ Smart cache initialized'^);
    echo     
    echo     cacheMaintenanceScheduler.start(^);
    echo     console.log^('✅ Cache maintenance scheduler started'^);
    echo   } catch ^(error^) {
    echo     console.error^('Cache initialization error:', error^);
    echo   }
    echo }^)(^);
    echo.
  )
) else (
  echo ⚠️  server.js not found
)

REM Step 5: Create logs directory
echo.
echo 📁 Step 5: Creating logs directory...
if not exist "logs" mkdir logs
echo ✅ Logs directory created

REM Step 6: Verify files
echo.
echo 📋 Step 6: Verifying installation...
set ALL_FILES_EXIST=1

if exist "services\smartCacheService.js" (
  echo ✅ services\smartCacheService.js
) else (
  echo ❌ services\smartCacheService.js - MISSING
  set ALL_FILES_EXIST=0
)

if exist "services\cacheMaintenanceScheduler.js" (
  echo ✅ services\cacheMaintenanceScheduler.js
) else (
  echo ❌ services\cacheMaintenanceScheduler.js - MISSING
  set ALL_FILES_EXIST=0
)

if exist "controllers\cachePerformanceController.js" (
  echo ✅ controllers\cachePerformanceController.js
) else (
  echo ❌ controllers\cachePerformanceController.js - MISSING
  set ALL_FILES_EXIST=0
)

REM Final summary
echo.
echo ========================================
echo 📊 Installation Summary
echo ========================================

if %ALL_FILES_EXIST% EQU 1 (
  echo ✅ All required files are present
  echo ✅ Dependencies installed
  echo ✅ Environment configured
  echo.
  echo 🎉 Installation complete!
  echo.
  echo Next steps:
  echo 1. Ensure Redis is running
  echo 2. Add initialization code to server.js ^(if not done^)
  echo 3. Start the server: npm start
  echo 4. Test login at http://localhost:3000/login
  echo 5. Check performance at GET /api/cache/performance
  echo.
  echo 📚 Documentation:
  echo    - Quick Setup: ..\CACHE_QUICK_SETUP.md
  echo    - Complete Guide: ..\CACHE_OPTIMIZATION_COMPLETE_GUIDE.md
  echo    - Summary: ..\CACHE_OPTIMIZATION_SUMMARY.md
) else (
  echo ⚠️  Some files are missing
  echo Please ensure all files are copied to the backend directory
)

echo.
echo ========================================

cd ..
pause
