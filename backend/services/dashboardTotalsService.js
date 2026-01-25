const { sequelize } = require('../config/mysql');
const DivisionSync = require('../models/mysql/DivisionSync');
const SectionSync = require('../models/mysql/SectionSync');
const EmployeeSync = require('../models/mysql/EmployeeSync');

/**
 * Service to update dashboard totals cache table for fast dashboard loading
 */

/**
 * Update total counts in dashboard cache table
 */
const updateDashboardTotals = async () => {
  try {
    console.log('📊 [DASHBOARD] Updating dashboard totals...');

    // Count from MySQL sync tables (fast indexed queries using raw SQL)
    const [[divisionsResult], [sectionsResult], [activeEmployeesResult]] = await Promise.all([
      sequelize.query('SELECT COUNT(*) as count FROM divisions_sync'),
      sequelize.query('SELECT COUNT(*) as count FROM sections_sync'),
      sequelize.query('SELECT COUNT(*) as count FROM employees_sync')
    ]);

    const divisionsCount = divisionsResult[0].count;
    const sectionsCount = sectionsResult[0].count;
    const activeEmployeesCount = activeEmployeesResult[0].count;

    // Count subsections from MySQL (not MongoDB)
    let subsectionsCount = 0;
    try {
      const [[subsectionsResult]] = await sequelize.query('SELECT COUNT(*) as count FROM sub_sections');
      subsectionsCount = subsectionsResult.count;
    } catch (subsErr) {
      console.warn('⚠️ [DASHBOARD] Failed to count subsections:', subsErr.message);
    }

    // Generate IS division attendance data
    const moment = require('moment');
    const isDivCode = process.env.IS_DIV_CODE || '66';
    
    let isAttendanceTrend = [];
    let presentISEmployees = [];
    let absentISEmployees = [];
    let isDivisionEmployees = [];
    
    try {
      // === IS ATTENDANCE TREND (Last 7 days including today) ===
      const dailyDates = [];
      for (let i = 6; i >= 0; i--) {
        dailyDates.push(moment().subtract(i, 'days').format('YYYY-MM-DD'));
      }

      for (const date of dailyDates) {
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
          
          isAttendanceTrend.push({
            date: date,
            employees: dayStats?.present_count || 0
          });
        } catch (dayErr) {
          isAttendanceTrend.push({ date: date, employees: 0 });
        }
      }
      console.log('✅ [DASHBOARD] IS attendance trend:', isAttendanceTrend.length, 'days');

      // === TODAY'S PRESENT & ABSENT EMPLOYEES (IS Division) ===
      const today = moment().format('YYYY-MM-DD');
      
      // Get all active IS division employees
      const [allISEmployees] = await sequelize.query(`
        SELECT
          e.EMP_NO,
          e.EMP_NAME,
          e.DIV_CODE,
          COALESCE(NULLIF(e.DIV_NAME, ''), NULLIF(d.HIE_NAME, ''), NULL) AS DIV_NAME,
          e.SEC_CODE,
          COALESCE(NULLIF(e.SEC_NAME, ''), NULLIF(s.HIE_NAME_4, ''), NULLIF(s.HIE_NAME, ''), NULL) AS SEC_NAME
        FROM employees_sync e
        LEFT JOIN divisions_sync d
          ON d.HIE_CODE = e.DIV_CODE
        LEFT JOIN sections_sync s
          ON (s.SECTION_ID = e.SEC_CODE OR s.HIE_CODE = e.SEC_CODE)
        WHERE e.DIV_CODE = ? AND e.IS_ACTIVE = 1
      `, { replacements: [isDivCode] });

      console.log(`📊 [DASHBOARD] Found ${allISEmployees.length} total IS division employees`);

      // Get present employees for today
      const [presentToday] = await sequelize.query(`
        SELECT DISTINCT
          e.EMP_NO,
          e.EMP_NAME,
          e.DIV_CODE,
          COALESCE(NULLIF(e.DIV_NAME, ''), NULLIF(d.HIE_NAME, ''), NULL) AS DIV_NAME,
          e.SEC_CODE,
          COALESCE(NULLIF(e.SEC_NAME, ''), NULLIF(s.HIE_NAME_4, ''), NULLIF(s.HIE_NAME, ''), NULL) AS SEC_NAME
        FROM employees_sync e
        LEFT JOIN divisions_sync d
          ON d.HIE_CODE = e.DIV_CODE
        LEFT JOIN sections_sync s
          ON (s.SECTION_ID = e.SEC_CODE OR s.HIE_CODE = e.SEC_CODE)
        INNER JOIN attendance a ON e.EMP_NO = a.employee_id
        WHERE e.DIV_CODE = ? 
          AND e.IS_ACTIVE = 1
          AND DATE(a.date_) = ?
          AND (a.fingerprint_id NOT LIKE '%Emergancy Exit%' OR a.fingerprint_id IS NULL)
        ORDER BY e.EMP_NAME
      `, { replacements: [isDivCode, today] });

      // Build present employees list
      presentISEmployees = presentToday.map(emp => ({
        employee_id: emp.EMP_NO,
        employee_name: emp.EMP_NAME,
        division_code: emp.DIV_CODE || null,
        division_name: emp.DIV_NAME || null,
        section_code: emp.SEC_CODE || null,
        section_name: emp.SEC_NAME || null
      }));

      // Find absent employees (all IS employees minus present ones)
      const presentEmpNos = new Set(presentToday.map(e => e.EMP_NO));
      absentISEmployees = allISEmployees
        .filter(emp => !presentEmpNos.has(emp.EMP_NO))
        .map(emp => ({
          employee_id: emp.EMP_NO,
          employee_name: emp.EMP_NAME,
          division_code: emp.DIV_CODE || null,
          division_name: emp.DIV_NAME || null,
          section_code: emp.SEC_CODE || null,
          section_name: emp.SEC_NAME || null
        }));

      // Unified list for dashboard widget
      const presentSet = new Set(presentISEmployees.map(e => e.employee_id));
      const isDivisionEmployees = allISEmployees.map(emp => ({
        employee_id: emp.EMP_NO,
        employee_name: emp.EMP_NAME,
        division_code: emp.DIV_CODE || null,
        division_name: emp.DIV_NAME || null,
        section_code: emp.SEC_CODE || null,
        section_name: emp.SEC_NAME || null,
        is_present: presentSet.has(emp.EMP_NO)
      }));

      console.log(`✅ [DASHBOARD] IS Division Today: ${presentISEmployees.length} present, ${absentISEmployees.length} absent, ${isDivisionEmployees.length} total in unified list`);

    } catch (err) {
      console.warn('⚠️ [DASHBOARD] Failed to generate IS attendance data:', err.message);
      isAttendanceTrend = [];
      presentISEmployees = [];
      absentISEmployees = [];
    }

    // Update or insert the single row in total_count_dashboard
    await sequelize.query(`
      INSERT INTO total_count_dashboard (
        id, totalDivisions, totalSections, totalSubsections, totalActiveEmployees,
        IS_attendance_trend, present_IS, absent_IS, is_division_attendance
      )
      VALUES (1, :divisions, :sections, :subsections, :activeEmployees, :isTrend, :presentIS, :absentIS, :isDivisionAttendance)
      ON DUPLICATE KEY UPDATE
        totalDivisions = :divisions,
        totalSections = :sections,
        totalSubsections = :subsections,
        totalActiveEmployees = :activeEmployees,
        IS_attendance_trend = :isTrend,
        present_IS = :presentIS,
        absent_IS = :absentIS,
        is_division_attendance = :isDivisionAttendance,
        last_updated = CURRENT_TIMESTAMP
    `, {
      replacements: {
        divisions: divisionsCount,
        sections: sectionsCount,
        subsections: subsectionsCount,
        activeEmployees: activeEmployeesCount,
        isTrend: JSON.stringify(isAttendanceTrend),
        presentIS: JSON.stringify(presentISEmployees),
        absentIS: JSON.stringify(absentISEmployees),
        isDivisionAttendance: JSON.stringify({
          employees: isDivisionEmployees,
          totalEmployees: isDivisionEmployees.length,
          presentCount: presentISEmployees.length,
          absentCount: absentISEmployees.length
        })
      }
    });

    console.log('✅ [DASHBOARD] Dashboard totals updated successfully');
    console.log(`   📊 Divisions: ${divisionsCount}, Sections: ${sectionsCount}, SubSections: ${subsectionsCount}, Active Employees: ${activeEmployeesCount}`);
    console.log(`   📈 IS Attendance Trend: ${isAttendanceTrend.length} days, Present: ${presentISEmployees.length}, Absent: ${absentISEmployees.length}`);

    return {
      success: true,
      totals: {
        totalDivisions: divisionsCount,
        totalSections: sectionsCount,
        totalSubsections: subsectionsCount,
        totalActiveEmployees: activeEmployeesCount,
        isAttendanceTrend: isAttendanceTrend,
        presentIS: presentISEmployees,
        absentIS: absentISEmployees
      }
    };

  } catch (error) {
    console.error('❌ [DASHBOARD] Failed to update dashboard totals:', error.message);
    throw error;
  }
};

const getDashboardTotals = async () => {
  try {
    const [results] = await sequelize.query(`
      SELECT 
        totalDivisions,
        totalSections,
        totalSubsections,
        totalActiveEmployees,
        IS_attendance_trend,
        present_IS,
        absent_IS,
        last_updated
      FROM total_count_dashboard
      WHERE id = 1
      LIMIT 1
    `);

    if (results && results.length > 0) {
      const data = results[0];
      
      // Parse JSON fields
      if (data.IS_attendance_trend && typeof data.IS_attendance_trend === 'string') {
        try {
          data.IS_attendance_trend = JSON.parse(data.IS_attendance_trend);
        } catch (e) {
          data.IS_attendance_trend = [];
        }
      }
      if (data.present_IS && typeof data.present_IS === 'string') {
        try {
          data.present_IS = JSON.parse(data.present_IS);
        } catch (e) {
          data.present_IS = [];
        }
      }
      if (data.absent_IS && typeof data.absent_IS === 'string') {
        try {
          data.absent_IS = JSON.parse(data.absent_IS);
        } catch (e) {
          data.absent_IS = [];
        }
      }
      
      return {
        success: true,
        data: data,
        cached: true
      };
    }

    // If no data, return zeros
    return {
      success: true,
      data: {
        totalDivisions: 0,
        totalSections: 0,
        totalSubsections: 0,
        totalActiveEmployees: 0,
        IS_attendance_trend: [],
        present_IS: [],
        absent_IS: [],
        last_updated: null
      },
      cached: false
    };

  } catch (error) {
    console.error('❌ [DASHBOARD] Failed to get dashboard totals:', error.message);
    throw error;
  }
};

/**
 * Initialize dashboard totals table (create and populate)
 */
const initializeDashboardTotals = async () => {
  try {
    const fs = require('fs');
    const path = require('path');

    // Create table if not exists
    const sqlPath = path.join(__dirname, '..', 'config', 'createDashboardTable.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await sequelize.query(sql);

    console.log('✅ [DASHBOARD] Dashboard totals table initialized');

    // Update counts
    await updateDashboardTotals();

  } catch (error) {
    console.error('❌ [DASHBOARD] Failed to initialize dashboard totals:', error.message);
    throw error;
  }
};

module.exports = {
  updateDashboardTotals,
  getDashboardTotals,
  initializeDashboardTotals
};
