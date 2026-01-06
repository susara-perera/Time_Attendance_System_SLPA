@echo off
REM HRIS Sync System Installation Script for Windows
REM Run this script to install and setup the HRIS sync system

echo ========================================
echo HRIS Sync System Installation
echo ========================================
echo.

REM Step 1: Check Node.js and npm
echo Step 1: Checking Node.js and npm...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed. Please install Node.js first.
    exit /b 1
)
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npm is not installed. Please install npm first.
    exit /b 1
)
node -v
npm -v
echo [OK] Node.js and npm are installed
echo.

REM Step 2: Install dependencies
echo Step 2: Installing Node.js dependencies...
cd backend
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install dependencies
    exit /b 1
)
echo [OK] Dependencies installed successfully
echo.

REM Step 3: Check MySQL connection
echo Step 3: Checking MySQL connection...
echo Please ensure MySQL is running and credentials are configured in .env file
echo    MYSQL_HOST=localhost
echo    MYSQL_PORT=3306
echo    MYSQL_USER=root
echo    MYSQL_PASSWORD=your_password
echo    MYSQL_DATABASE=slpa_db
echo.
set /p mysql_ready="Is MySQL configured and running? (y/n): "
if /i not "%mysql_ready%"=="y" (
    echo [WARNING] Please configure MySQL and run this script again
    exit /b 1
)
echo.

REM Step 4: Create sync tables
echo Step 4: Creating sync tables...
echo Tables will be created automatically on server startup.
echo Alternatively, you can create them manually:
echo    mysql -u root -p slpa_db ^< backend\config\createSyncTables.sql
echo.

REM Step 5: Configuration summary
echo Step 5: Configuration Summary
echo    Sync Schedule: Daily at 12:00 PM (customizable)
echo    Timezone: Asia/Colombo
echo    Sync Tables: divisions_sync, sections_sync, employees_sync, sync_logs
echo    API Endpoint: /api/sync/*
echo.

REM Step 6: Start server
echo Step 6: Starting server...
echo The server will:
echo    1. Connect to MongoDB (for auth and audit logs)
echo    2. Connect to MySQL (for sync tables)
echo    3. Initialize HRIS cache
echo    4. Initialize sync scheduler (daily at 12 PM)
echo.
echo To start the server, run:
echo    cd backend ^&^& npm run dev
echo.

REM Step 7: Verification steps
echo Step 7: Verification (after server starts)
echo.
echo 1. Check server logs for:
echo    [OK] MySQL Connected successfully
echo    [OK] HRIS sync scheduler initialized successfully
echo.
echo 2. Trigger initial sync:
echo    curl -X POST http://localhost:5000/api/sync/trigger/full ^
echo      -H "Authorization: Bearer YOUR_TOKEN" ^
echo      -H "Content-Type: application/json"
echo.
echo 3. Check sync status:
echo    curl http://localhost:5000/api/sync/status ^
echo      -H "Authorization: Bearer YOUR_TOKEN"
echo.
echo 4. Verify database:
echo    mysql -u root -p slpa_db -e "SELECT * FROM sync_logs ORDER BY started_at DESC LIMIT 5;"
echo.

REM Step 8: Documentation
echo Step 8: Documentation
echo    Setup Guide: backend\docs\SYNC_SETUP_GUIDE.md
echo    Full Documentation: backend\docs\HRIS_SYNC_DOCUMENTATION.md
echo    Implementation Summary: backend\docs\IMPLEMENTATION_SUMMARY.md
echo.

REM Completion
echo ========================================
echo [OK] Installation Complete!
echo ========================================
echo.
echo Next Steps:
echo 1. Start the server: cd backend ^&^& npm run dev
echo 2. Trigger initial sync (optional): POST /api/sync/trigger/full
echo 3. Monitor sync logs: Check sync_logs table
echo 4. Update controllers to use mysqlDataService
echo.
echo HRIS Sync System is ready to use!
echo.

cd ..
pause
