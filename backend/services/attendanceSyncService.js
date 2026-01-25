/**
 * Attendance Sync Service
 * 
 * Syncs attendance data from multiple sources to attendance_sync table
 * for fast report generation without HRIS API calls
 * 
 * Data Sources:
 * 1. MySQL attendance table (punch times from biometric devices)
 * 2. MongoDB Attendance collection (check-in/check-out with status)
 * 3. employees_sync table (employee details)
 * 4. divisions_sync, sections_sync (organization structure)
 */

const { sequelize } = require('../models/mysql');
const { MySQLAttendance: Attendance, MySQLUser: User } = require('../models/mysql');
const moment = require('moment');

/**
 * Sync attendance data for a date range
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @param {string} triggeredBy - Who/what triggered the sync
 */
const syncAttendanceData = async (startDate, endDate, triggeredBy = 'system') => {
  const syncStartTime = Date.now();
  
  try {
    console.log('🔄 [ATTENDANCE SYNC] Starting attendance data sync...');
    console.log(`   Date range: ${startDate} to ${endDate}`);
    console.log(`   Triggered by: ${triggeredBy}\n`);

    let recordsProcessed = 0;
    let recordsInserted = 0;
    let recordsUpdated = 0;
    let recordsFailed = 0;

    // Step 1: Get all attendance records from MySQL attendance table (punch times)
    console.log('📊 Step 1: Fetching punch data from MySQL attendance table...');
    // Note: some source attendance tables only store date_ and time_ (no employee_name or other fields).
    // We aggregate by employee_ID and date and rely on employees_sync for names and org info.
    const mysqlAttendance = await sequelize.query(`
      SELECT
        employee_ID,
        DATE(date_) as attendance_date,
        MIN(time_) as first_punch,
        MAX(time_) as last_punch,
        COUNT(*) as punch_count
      FROM attendance
      WHERE DATE(date_) BETWEEN ? AND ?
      GROUP BY employee_ID, DATE(date_)
      ORDER BY employee_ID, attendance_date
    `, {
      replacements: [startDate, endDate],
      type: sequelize.QueryTypes.SELECT
    });
    console.log(`   ✅ Found ${mysqlAttendance.length} attendance records\n`);

    // Step 2: Get employee details from employees_sync
    console.log('📊 Step 2: Fetching employee details from employees_sync...');
    const employees = await sequelize.query(`
      SELECT 
        EMP_NO,
        EMP_NAME,
        EMP_DESIGNATION AS DESIG_NAME,
        NULL AS DESIG_CODE,
        DIV_CODE,
        DIV_NAME,
        SEC_CODE,
        SEC_NAME,
        IS_ACTIVE AS ACTIVE_HRM_FLG
      FROM employees_sync
      WHERE IS_ACTIVE = 1
    `, {
      type: sequelize.QueryTypes.SELECT
    });
    
    // Create employee lookup map
    const employeeMap = new Map();
    employees.forEach(emp => {
      employeeMap.set(String(emp.EMP_NO), emp);
    });
    console.log(`   ✅ Loaded ${employees.length} active employees\n`);

    // Step 3: Get MongoDB attendance data (for status and calculated fields)
    console.log('📊 Step 3: Fetching attendance status from MongoDB...');
    let mongoAttendance = [];
    try {
      mongoAttendance = await Attendance.find({
        date: {
          $gte: new Date(`${startDate}T00:00:00`),
          $lte: new Date(`${endDate}T23:59:59`)
        }
      })
      .populate('user', 'employeeId')
      .lean();

      console.log(`   ✅ Loaded ${mongoAttendance.length} MongoDB attendance records\n`);
    } catch (mongoErr) {
      console.warn('⚠️ [ATTENDANCE SYNC] Could not fetch MongoDB attendance data:', mongoErr.message);
      console.warn('⚠️ Proceeding without MongoDB attendance details (check-in/out, status will default)\n');
      mongoAttendance = [];
    }

    // Create MongoDB attendance lookup map
    const mongoAttendanceMap = new Map();
    mongoAttendance.forEach(att => {
      if (att.user && att.user.employeeId) {
        const key = `${att.user.employeeId}_${moment(att.date).format('YYYY-MM-DD')}`;
        mongoAttendanceMap.set(key, att);
      }
    });

    // Step 4: Process and sync each attendance record
    console.log('📊 Step 4: Processing and syncing attendance data...\n');
    
    for (const record of mysqlAttendance) {
      try {
        recordsProcessed++;

        // Get employee details
        const employee = employeeMap.get(String(record.employee_ID));
        
        // Get MongoDB attendance data for this employee and date
        const mongoKey = `${record.employee_ID}_${record.attendance_date}`;
        const mongoData = mongoAttendanceMap.get(mongoKey);

        // Prepare sync data
        const syncData = {
          employee_id: record.employee_ID,
          employee_name: record.employee_name || employee?.EMP_NAME || 'Unknown',
          employee_number: record.employee_ID,
          designation: record.designation || employee?.DESIG_NAME || null,
          designation_code: employee?.DESIG_CODE || null,
          
          // Organization structure from employees_sync (more reliable)
          division_code: employee?.DIV_CODE || null,
          division_name: record.division_name || employee?.DIV_NAME || null,
          section_code: employee?.SEC_CODE || null,
          section_name: record.section_name || employee?.SEC_NAME || null,
          sub_section_id: null, // Will be filled from subsection_transfers if needed
          sub_section_name: null,
          
          // Date information
          attendance_date: record.attendance_date,
          day_of_week: moment(record.attendance_date).format('dddd'),
          is_weekend: [0, 6].includes(moment(record.attendance_date).day()) ? 1 : 0,
          is_holiday: 0, // TODO: Check holiday calendar
          
          // Punch times from MySQL
          first_punch_time: record.first_punch,
          last_punch_time: record.last_punch,
          total_punch_count: record.punch_count,
          
          // Check in/out from MongoDB (if available)
          check_in_time: mongoData?.checkIn?.time || record.first_punch,
          check_out_time: mongoData?.checkOut?.time || record.last_punch,
          
          // Calculated fields from MongoDB (if available)
          status: mongoData?.status || 'present',
          working_hours: mongoData?.workingHours || 0,
          overtime_hours: mongoData?.overtime || 0,
          late_minutes: mongoData?.lateMinutes || 0,
          early_leave_minutes: 0,
          
          // Shift information from MongoDB
          shift_start_time: mongoData?.shift?.startTime || '08:00:00',
          shift_end_time: mongoData?.shift?.endTime || '17:00:00',
          shift_name: mongoData?.shift?.name || 'Regular',
          
          // Leave information
          leave_type: mongoData?.leaveType || null,
          leave_status: mongoData?.leaveStatus || null,
          
          // Meal information (from MongoDB Meal collection if available)
          meal_taken: 0,
          meal_type: null,
          meal_location: null,
          
          // Active status
          is_active: employee?.ACTIVE_HRM_FLG || 1,
          
          // Sync metadata
          synced_at: new Date(),
          data_source: 'MySQL+MongoDB',
          sync_version: 1
        };

        // Insert or update record
        const [existingRecord] = await sequelize.query(`
          SELECT id FROM attendance_sync 
          WHERE employee_id = ? AND attendance_date = ?
        `, {
          replacements: [syncData.employee_id, syncData.attendance_date],
          type: sequelize.QueryTypes.SELECT
        });

        if (existingRecord) {
          // Update existing record
          await sequelize.query(`
            UPDATE attendance_sync SET
              employee_name = ?,
              employee_number = ?,
              designation = ?,
              designation_code = ?,
              division_code = ?,
              division_name = ?,
              section_code = ?,
              section_name = ?,
              day_of_week = ?,
              is_weekend = ?,
              first_punch_time = ?,
              last_punch_time = ?,
              total_punch_count = ?,
              check_in_time = ?,
              check_out_time = ?,
              status = ?,
              working_hours = ?,
              overtime_hours = ?,
              late_minutes = ?,
              shift_start_time = ?,
              shift_end_time = ?,
              shift_name = ?,
              leave_type = ?,
              is_active = ?,
              synced_at = ?,
              data_source = ?
            WHERE id = ?
          `, {
            replacements: [
              syncData.employee_name,
              syncData.employee_number,
              syncData.designation,
              syncData.designation_code,
              syncData.division_code,
              syncData.division_name,
              syncData.section_code,
              syncData.section_name,
              syncData.day_of_week,
              syncData.is_weekend,
              syncData.first_punch_time,
              syncData.last_punch_time,
              syncData.total_punch_count,
              syncData.check_in_time,
              syncData.check_out_time,
              syncData.status,
              syncData.working_hours,
              syncData.overtime_hours,
              syncData.late_minutes,
              syncData.shift_start_time,
              syncData.shift_end_time,
              syncData.shift_name,
              syncData.leave_type,
              syncData.is_active,
              syncData.synced_at,
              syncData.data_source,
              existingRecord.id
            ]
          });
          recordsUpdated++;
        } else {
          // Insert new record
          await sequelize.query(`
            INSERT INTO attendance_sync (
              employee_id, employee_name, employee_number, designation, designation_code,
              division_code, division_name, section_code, section_name,
              attendance_date, day_of_week, is_weekend,
              first_punch_time, last_punch_time, total_punch_count,
              check_in_time, check_out_time,
              status, working_hours, overtime_hours, late_minutes,
              shift_start_time, shift_end_time, shift_name,
              leave_type, is_active, synced_at, data_source
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, {
            replacements: [
              syncData.employee_id, syncData.employee_name, syncData.employee_number,
              syncData.designation, syncData.designation_code,
              syncData.division_code, syncData.division_name,
              syncData.section_code, syncData.section_name,
              syncData.attendance_date, syncData.day_of_week, syncData.is_weekend,
              syncData.first_punch_time, syncData.last_punch_time, syncData.total_punch_count,
              syncData.check_in_time, syncData.check_out_time,
              syncData.status, syncData.working_hours, syncData.overtime_hours, syncData.late_minutes,
              syncData.shift_start_time, syncData.shift_end_time, syncData.shift_name,
              syncData.leave_type, syncData.is_active, syncData.synced_at, syncData.data_source
            ]
          });
          recordsInserted++;
        }

        // Show progress every 100 records
        if (recordsProcessed % 100 === 0) {
          console.log(`   ⏳ Processed ${recordsProcessed}/${mysqlAttendance.length} records...`);
        }

      } catch (error) {
        console.error(`   ❌ Failed to sync record for employee ${record.employee_ID}:`, error.message);
        recordsFailed++;
      }
    }

    const syncDuration = Math.floor((Date.now() - syncStartTime) / 1000);

    console.log('\n✅ [ATTENDANCE SYNC] Completed successfully!');
    console.log(`   📊 Processed: ${recordsProcessed}`);
    console.log(`   ➕ Inserted: ${recordsInserted}`);
    console.log(`   🔄 Updated: ${recordsUpdated}`);
    console.log(`   ❌ Failed: ${recordsFailed}`);
    console.log(`   ⏱️  Duration: ${syncDuration}s\n`);

    // Update daily statistics
    await updateDailyStatistics(startDate, endDate);

    // Invalidate report cache
    await invalidateReportCache(startDate, endDate);

    return {
      success: true,
      recordsProcessed,
      recordsInserted,
      recordsUpdated,
      recordsFailed,
      duration: syncDuration
    };

  } catch (error) {
    console.error('❌ [ATTENDANCE SYNC] Failed:', error.message);
    throw error;
  }
};

/**
 * Update daily statistics table
 */
const updateDailyStatistics = async (startDate, endDate) => {
  try {
    console.log('📊 Updating daily statistics...');

    await sequelize.query(`
      INSERT INTO attendance_daily_stats (
        stat_date, division_code, division_name, section_code, section_name,
        total_employees, present_count, absent_count, late_count,
        attendance_rate, late_rate,
        total_working_hours, total_overtime_hours, avg_working_hours,
        calculated_at
      )
      SELECT 
        attendance_date as stat_date,
        division_code,
        division_name,
        section_code,
        section_name,
        COUNT(DISTINCT employee_id) as total_employees,
        SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_count,
        SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_count,
        SUM(CASE WHEN late_minutes > 0 THEN 1 ELSE 0 END) as late_count,
        ROUND((SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) / COUNT(*)) * 100, 2) as attendance_rate,
        ROUND((SUM(CASE WHEN late_minutes > 0 THEN 1 ELSE 0 END) / COUNT(*)) * 100, 2) as late_rate,
        SUM(working_hours) as total_working_hours,
        SUM(overtime_hours) as total_overtime_hours,
        ROUND(AVG(working_hours), 2) as avg_working_hours,
        NOW() as calculated_at
      FROM attendance_sync
      WHERE attendance_date BETWEEN ? AND ?
        AND is_active = 1
      GROUP BY attendance_date, division_code, division_name, section_code, section_name
      ON DUPLICATE KEY UPDATE
        total_employees = VALUES(total_employees),
        present_count = VALUES(present_count),
        absent_count = VALUES(absent_count),
        late_count = VALUES(late_count),
        attendance_rate = VALUES(attendance_rate),
        late_rate = VALUES(late_rate),
        total_working_hours = VALUES(total_working_hours),
        total_overtime_hours = VALUES(total_overtime_hours),
        avg_working_hours = VALUES(avg_working_hours),
        calculated_at = VALUES(calculated_at)
    `, {
      replacements: [startDate, endDate]
    });

    console.log('   ✅ Daily statistics updated\n');
  } catch (error) {
    console.error('   ❌ Failed to update daily statistics:', error.message);
  }
};

/**
 * Invalidate report cache for date range
 */
const invalidateReportCache = async (startDate, endDate) => {
  try {
    console.log('🗑️  Invalidating report cache...');

    await sequelize.query(`
      UPDATE report_cache 
      SET is_valid = 0, invalidated_at = NOW()
      WHERE (start_date BETWEEN ? AND ? OR end_date BETWEEN ? AND ?)
        AND is_valid = 1
    `, {
      replacements: [startDate, endDate, startDate, endDate]
    });

    console.log('   ✅ Report cache invalidated\n');
  } catch (error) {
    console.error('   ❌ Failed to invalidate cache:', error.message);
  }
};

/**
 * Sync attendance for last N days
 */
const syncLastNDays = async (days = 30, triggeredBy = 'system') => {
  const endDate = moment().format('YYYY-MM-DD');
  const startDate = moment().subtract(days, 'days').format('YYYY-MM-DD');
  
  return await syncAttendanceData(startDate, endDate, triggeredBy);
};

/**
 * Sync attendance for current month
 */
const syncCurrentMonth = async (triggeredBy = 'system') => {
  const startDate = moment().startOf('month').format('YYYY-MM-DD');
  const endDate = moment().endOf('month').format('YYYY-MM-DD');
  
  return await syncAttendanceData(startDate, endDate, triggeredBy);
};

/**
 * Sync attendance for yesterday (for daily cron job)
 */
const syncYesterday = async (triggeredBy = 'cron') => {
  const yesterday = moment().subtract(1, 'day').format('YYYY-MM-DD');
  
  return await syncAttendanceData(yesterday, yesterday, triggeredBy);
};

/**
 * Main sync function wrapper for API calls
 */
const syncAttendance = async (startDate, endDate, triggeredBy = 'system') => {
  // Default to last 7 days if no dates provided
  if (!startDate || !endDate) {
    return await syncLastNDays(7, triggeredBy);
  }
  
  return await syncAttendanceData(startDate, endDate, triggeredBy);
};

module.exports = {
  syncAttendanceData,
  syncLastNDays,
  syncCurrentMonth,
  syncYesterday,
  syncAttendance,
  updateDailyStatistics,
  invalidateReportCache
};
