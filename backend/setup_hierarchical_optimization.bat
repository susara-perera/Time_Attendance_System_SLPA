@echo off
echo ========================================================================
echo HIERARCHICAL ATTENDANCE OPTIMIZATION - QUICK START
echo ========================================================================
echo.

echo Step 1: Creating optimized table and syncing data...
node setup_optimized_attendance.js
if errorlevel 1 (
    echo.
    echo ERROR: Setup failed! Check the error messages above.
    pause
    exit /b 1
)

echo.
echo ========================================================================
echo Step 2: Testing performance...
echo ========================================================================
echo.
node test_hierarchical_reports.js
if errorlevel 1 (
    echo.
    echo WARNING: Some tests failed, but system may still work.
)

echo.
echo ========================================================================
echo SETUP COMPLETE!
echo ========================================================================
echo.
echo Next steps:
echo 1. Add daily sync to your scheduler (see documentation)
echo 2. Use optimized report service in your controllers
echo 3. Monitor performance improvements
echo.
pause
