@echo off
echo ============================================================
echo   MANAGEMENT PAGES OPTIMIZATION
echo   Division, Section, Sub-Section Management
echo ============================================================
echo.

cd backend

echo [Step 1] Checking Table Schemas...
node check_management_schema.js
echo.

echo [Step 2] Applying Database Indexes...
node apply_management_indexes.js
echo.

echo [Step 3] Testing Redis Connection...
node test_redis_v5.js
echo.

echo ============================================================
echo   OPTIMIZATION COMPLETE!
echo ============================================================
echo.
echo Redis caching is already configured in routes.
echo Restart your backend server to activate all optimizations.
echo.
echo To verify:
echo   1. Start backend: npm start
echo   2. Check cache stats: http://localhost:5000/api/cache/stats
echo   3. Test endpoints:
echo      - http://localhost:5000/api/divisions
echo      - http://localhost:5000/api/sections
echo      - http://localhost:5000/api/mysql-data/subsections
echo.
pause
