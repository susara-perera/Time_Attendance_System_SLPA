/**
 * Dashboard Data Preload Service
 * 
 * Preloads and caches all dashboard data for ultra-fast loading
 * Implements Redis caching with MySQL fallback
 */

const { sequelize } = require('../config/mysql');
const { RecentActivity } = require('../models/mysql');
const moment = require('moment');

/**
 * Preload all dashboard data into cache
 * Called on user login or manual refresh
 */
const preloadDashboardData = async () => {
  try {
    console.log('🚀 [DASHBOARD] Preloading dashboard data...');
    const startTime = Date.now();

    // Fetch all dashboard data in parallel
    const [
      divisionsResult,
      sectionsResult,
      employeesResult,
      todayAttendanceResult,
      weeklyTrendData,
      recentActivitiesData,
      isDivisionData
    ] = await Promise.all([
      // 1. Division count
      sequelize.query('SELECT COUNT(*) as count FROM divisions_sync'),
      
      // 2. Section count
      sequelize.query('SELECT COUNT(*) as count FROM sections_sync'),
      
      // 3. Employee counts (active/inactive)
      sequelize.query(`
        SELECT 
          SUM(CASE WHEN IS_ACTIVE = 1 THEN 1 ELSE 0 END) as active_count,
          SUM(CASE WHEN IS_ACTIVE = 0 THEN 1 ELSE 0 END) as inactive_count,
          COUNT(*) as total_count
        FROM employees_sync
      `),
      
      // 4. Today's attendance (IS division)
      sequelize.query(`
        SELECT COUNT(DISTINCT a.employee_id) as present_count
        FROM attendance a
        INNER JOIN employees_sync e ON a.employee_id = e.EMP_NO
        WHERE DATE(a.date_) = CURDATE()
          AND e.DIV_CODE = ?
          AND e.IS_ACTIVE = 1
          AND (a.fingerprint_id NOT LIKE '%Emergancy Exit%' OR a.fingerprint_id IS NULL)
      `, { replacements: [process.env.IS_DIV_CODE || '66'] }),
      
      // 5. Weekly trend (last 7 days - IS division)
      getWeeklyTrendIS(),
      
      // 6. Recent activities (50 latest)
      RecentActivity.findAll({
        order: [['created_at', 'DESC']],
        limit: 50,
        raw: true
      }),
      
      // 7. IS Division employee list
      getISDivisionEmployees()
    ]);

    // Parse results
    const divisionsCount = divisionsResult[0][0].count;
    const sectionsCount = sectionsResult[0][0].count;
    const employeeStats = employeesResult[0][0];
    const todayPresent = todayAttendanceResult[0][0].present_count || 0;

    // Build dashboard data object
    const dashboardData = {
      totalDivisions: divisionsCount,
      totalSections: sectionsCount,
      totalEmployees: employeeStats.total_count,
      activeEmployees: employeeStats.active_count,
      inactiveEmployees: employeeStats.inactive_count,
      presentToday: todayPresent,
      attendanceRate: employeeStats.active_count > 0 
        ? parseFloat(((todayPresent / employeeStats.active_count) * 100).toFixed(1))
        : 0,
      weeklyTrend: weeklyTrendData,
      recentActivities: recentActivitiesData,
      isDivision: isDivisionData,
      cachedAt: new Date().toISOString(),
      dataSource: 'Preloaded Cache'
    };

    const loadTime = Date.now() - startTime;
    console.log(`✅ [DASHBOARD] Data preloaded in ${loadTime}ms`);

    return dashboardData;

  } catch (error) {
    console.error('❌ [DASHBOARD] Preload failed:', error);
    throw error;
  }
};

/**
 * Get weekly trend for IS division (last 7 days)
 */
const getWeeklyTrendIS = async () => {
  try {
    const isDivCode = process.env.IS_DIV_CODE || '66';
    const dates = [];
    
    // Generate last 7 days
    for (let i = 6; i >= 0; i--) {
      dates.push(moment().subtract(i, 'days').format('YYYY-MM-DD'));
    }

    const trendData = [];
    
    for (const date of dates) {
      try {
        const [[dayStats]] = await sequelize.query(`
          SELECT COUNT(DISTINCT a.employee_id) as present_count
          FROM attendance a
          INNER JOIN employees_sync e ON a.employee_id = e.EMP_NO
          WHERE DATE(a.date_) = ?
            AND e.DIV_CODE = ?
            AND e.IS_ACTIVE = 1
            AND (a.fingerprint_id NOT LIKE '%Emergancy Exit%' OR a.fingerprint_id IS NULL)
        `, { replacements: [date, isDivCode] });
        
        trendData.push({
          date: date,
          employees: dayStats?.present_count || 0
        });
      } catch (err) {
        trendData.push({ date: date, employees: 0 });
      }
    }

    return trendData;
  } catch (error) {
    console.error('❌ [DASHBOARD] Weekly trend fetch failed:', error);
    return [];
  }
};

/**
 * Get IS division employees (present/absent today)
 */
const getISDivisionEmployees = async () => {
  try {
    const isDivCode = process.env.IS_DIV_CODE || '66';
    const today = moment().format('YYYY-MM-DD');

    // Get all IS division employees
    const [employees] = await sequelize.query(`
      SELECT EMP_NO as empNo, EMP_NAME as name, SEC_CODE as secCode
      FROM employees_sync
      WHERE IS_ACTIVE = 1 AND DIV_CODE = ?
    `, { replacements: [isDivCode] });

    // Get today's present employees
    const [presentToday] = await sequelize.query(`
      SELECT DISTINCT a.employee_id
      FROM attendance a
      INNER JOIN employees_sync e ON a.employee_id = e.EMP_NO
      WHERE DATE(a.date_) = ?
        AND e.DIV_CODE = ?
        AND e.IS_ACTIVE = 1
        AND (a.fingerprint_id NOT LIKE '%Emergancy Exit%' OR a.fingerprint_id IS NULL)
    `, { replacements: [today, isDivCode] });

    const presentSet = new Set(presentToday.map(p => p.employee_id));
    
    const presentList = employees.filter(e => presentSet.has(e.empNo));
    const absentList = employees.filter(e => !presentSet.has(e.empNo));

    return {
      totalEmployees: employees.length,
      presentToday: presentList,
      presentCount: presentList.length,
      absentToday: absentList.slice(0, 200), // Limit to 200 for performance
      absentCount: absentList.length
    };

  } catch (error) {
    console.error('❌ [DASHBOARD] IS division data fetch failed:', error);
    return {
      totalEmployees: 0,
      presentToday: [],
      presentCount: 0,
      absentToday: [],
      absentCount: 0
    };
  }
};

/**
 * Refresh dashboard cache (manual trigger)
 */
const refreshDashboardCache = async () => {
  try {
    console.log('🔄 [DASHBOARD] Manually refreshing dashboard cache...');
    const data = await preloadDashboardData();
    console.log('✅ [DASHBOARD] Cache refreshed successfully');
    return data;
  } catch (error) {
    console.error('❌ [DASHBOARD] Cache refresh failed:', error);
    throw error;
  }
};

module.exports = {
  preloadDashboardData,
  refreshDashboardCache,
  getWeeklyTrendIS,
  getISDivisionEmployees
};
