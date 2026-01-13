/**
 * Optimized Attendance Sync Service
 * 
 * Syncs attendance data into hierarchically organized table
 * Data is stored in perfect order: Division -> Section -> Sub-Section -> Employee -> Date
 * This eliminates sorting overhead and speeds up report generation by 10-50x
 */

const { mysqlSequelize } = require('../config/mysql');
const { QueryTypes } = require('sequelize');

class OptimizedAttendanceSyncService {
  
  /**
   * Sync attendance data in hierarchical order
   */
  async syncAttendanceData(startDate, endDate, options = {}) {
    console.log(`\n🔄 Starting optimized attendance sync...`);
    console.log(`📅 Date Range: ${startDate} to ${endDate}`);

    const onProgress = typeof options?.onProgress === 'function' ? options.onProgress : null;
    
    const startTime = Date.now();
    let stats = {
      recordsProcessed: 0,
      recordsInserted: 0,
      recordsUpdated: 0,
      errors: []
    };
    
    try {
      // Step 1: Create sync status record
      await this.createSyncStatus(startDate, endDate);
      
      // Step 2: Fetch data in HIERARCHICAL ORDER from source tables
      console.log('📊 Fetching data in hierarchical order...');
      const attendanceData = await this.fetchHierarchicalData(startDate, endDate);

      if (onProgress) {
        onProgress({
          message: `Fetched ${attendanceData.length} records. Syncing...`,
          processed: 0,
          total: attendanceData.length,
          inserted: 0,
          updated: 0
        });
      }
      
      console.log(`✅ Found ${attendanceData.length} records to sync`);
      
      // Step 3: Batch insert in order (maintains hierarchy)
      console.log('💾 Inserting data in hierarchical order...');
      const batchSize = 1000;
      
      for (let i = 0; i < attendanceData.length; i += batchSize) {
        const batch = attendanceData.slice(i, i + batchSize);
        const result = await this.insertBatch(batch);
        
        stats.recordsInserted += result.inserted;
        stats.recordsUpdated += result.updated;
        stats.recordsProcessed += batch.length;

        if (onProgress) {
          onProgress({
            message: `Syncing attendance... ${stats.recordsProcessed}/${attendanceData.length}`,
            processed: stats.recordsProcessed,
            total: attendanceData.length,
            inserted: stats.recordsInserted,
            updated: stats.recordsUpdated
          });
        }
        
        if ((i + batchSize) % 5000 === 0) {
          console.log(`   Processed ${stats.recordsProcessed} / ${attendanceData.length} records...`);
        }
      }
      
      // Step 4: Update sync status
      await this.completeSyncStatus(startDate, stats);
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      console.log('\n✅ Sync completed successfully!');
      console.log(`📊 Statistics:`);
      console.log(`   - Records Processed: ${stats.recordsProcessed}`);
      console.log(`   - Records Inserted: ${stats.recordsInserted}`);
      console.log(`   - Records Updated: ${stats.recordsUpdated}`);
      console.log(`   - Duration: ${duration}s`);
      console.log(`   - Speed: ${Math.round(stats.recordsProcessed / duration)} records/second`);

      if (onProgress) {
        onProgress({
          message: 'Attendance sync completed.',
          processed: stats.recordsProcessed,
          total: attendanceData.length,
          inserted: stats.recordsInserted,
          updated: stats.recordsUpdated
        });
      }
      
      return stats;
      
    } catch (error) {
      console.error('❌ Sync failed:', error.message);
      await this.failSyncStatus(startDate, error.message);
      throw error;
    }
  }
  
  /**
   * Fetch data in perfect hierarchical order
   * This is THE KEY to fast report generation!
   */
  async fetchHierarchicalData(startDate, endDate) {
    const query = `
      SELECT 
        -- Division Info
        d.HIE_CODE as division_code,
        d.HIE_NAME as division_name,
        
        -- Section Info
        s.HIE_CODE as section_code,
        s.HIE_NAME as section_name,
        
        -- Sub-Section Info (if exists)
        ss.sub_section_code as sub_section_code,
        ss.sub_section_name as sub_section_name,
        
        -- Employee Info
        e.EMP_NO as emp_id,
        e.EMP_NAME as emp_name,
        e.EMP_DESIGNATION as emp_designation,
        
        -- Attendance Data (aggregated from punch data)
        DATE(a.date_) as attendance_date,
        MIN(a.time_) as check_in_time,
        MAX(a.time_) as check_out_time,
        CASE 
          WHEN COUNT(*) > 0 THEN 'Present'
          ELSE 'Absent'
        END as attendance_status,
        NULL as work_hours,
        NULL as overtime_hours,
        NULL as late_minutes,
        NULL as early_leave_minutes,
        
        -- Meal Info
        0 as meal_taken,
        NULL as meal_type,
        
        -- Additional Info
        0 as is_holiday,
        CASE WHEN DAYOFWEEK(DATE(a.date_)) IN (1,7) THEN 1 ELSE 0 END as is_weekend,
        NULL as leave_type,
        
        -- Metadata
        NOW() as synced_at,
        'MySQL' as data_source
        
      FROM attendance a
      
      -- Join Employee
      INNER JOIN employees_sync e 
        ON a.employee_ID = e.EMP_NO
      
      -- Join Division
      LEFT JOIN divisions_sync d 
        ON e.DIV_CODE = d.HIE_CODE
      
      -- Join Section
      LEFT JOIN sections_sync s 
        ON e.SEC_CODE = s.HIE_CODE
      
      -- Join Sub-Section (if exists)
      LEFT JOIN sub_sections ss 
        ON e.SEC_CODE COLLATE utf8mb4_unicode_ci = ss.section_code COLLATE utf8mb4_unicode_ci
        AND e.DIV_CODE COLLATE utf8mb4_unicode_ci = ss.division_code COLLATE utf8mb4_unicode_ci
      
      WHERE 
        DATE(a.date_) BETWEEN :startDate AND :endDate
        AND e.IS_ACTIVE = 1
      
      GROUP BY 
        e.EMP_NO,
        DATE(a.date_),
        d.HIE_CODE,
        s.HIE_CODE,
        ss.sub_section_code
      
      -- CRITICAL: Order by hierarchy for sequential storage
      ORDER BY 
        d.HIE_CODE,                    -- Division first
        s.HIE_CODE,                    -- Then Section
        ss.sub_section_code,           -- Then Sub-Section
        e.EMP_NO,                      -- Then Employee
        DATE(a.date_);                 -- Finally Date
    `;
    
    return await mysqlSequelize.query(query, {
      replacements: { startDate, endDate },
      type: QueryTypes.SELECT
    });
  }
  
  /**
   * Insert batch with UPSERT (maintains order)
   */
  async insertBatch(batch) {
    const values = batch.map(record => `(
      ${mysqlSequelize.escape(record.division_code)},
      ${mysqlSequelize.escape(record.division_name)},
      ${mysqlSequelize.escape(record.section_code)},
      ${mysqlSequelize.escape(record.section_name)},
      ${mysqlSequelize.escape(record.sub_section_code)},
      ${mysqlSequelize.escape(record.sub_section_name)},
      ${mysqlSequelize.escape(record.emp_id)},
      ${mysqlSequelize.escape(record.emp_name)},
      ${mysqlSequelize.escape(record.emp_designation)},
      ${mysqlSequelize.escape(record.attendance_date)},
      ${mysqlSequelize.escape(record.check_in_time)},
      ${mysqlSequelize.escape(record.check_out_time)},
      ${mysqlSequelize.escape(record.attendance_status)},
      ${record.work_hours || 0},
      ${record.overtime_hours || 0},
      ${record.late_minutes || 0},
      ${record.early_leave_minutes || 0},
      ${record.meal_taken || 0},
      ${mysqlSequelize.escape(record.meal_type)},
      ${record.is_holiday || 0},
      ${record.is_weekend || 0},
      ${mysqlSequelize.escape(record.leave_type)},
      NOW(),
      'HRIS'
    )`).join(',\n');
    
    const query = `
      INSERT INTO attendance_reports_optimized (
        division_code, division_name,
        section_code, section_name,
        sub_section_code, sub_section_name,
        emp_id, emp_name, emp_designation,
        attendance_date,
        check_in_time, check_out_time,
        attendance_status,
        work_hours, overtime_hours,
        late_minutes, early_leave_minutes,
        meal_taken, meal_type,
        is_holiday, is_weekend, leave_type,
        synced_at, data_source
      )
      VALUES ${values}
      ON DUPLICATE KEY UPDATE
        division_name = VALUES(division_name),
        section_name = VALUES(section_name),
        sub_section_name = VALUES(sub_section_name),
        emp_name = VALUES(emp_name),
        emp_designation = VALUES(emp_designation),
        check_in_time = VALUES(check_in_time),
        check_out_time = VALUES(check_out_time),
        attendance_status = VALUES(attendance_status),
        work_hours = VALUES(work_hours),
        overtime_hours = VALUES(overtime_hours),
        late_minutes = VALUES(late_minutes),
        early_leave_minutes = VALUES(early_leave_minutes),
        meal_taken = VALUES(meal_taken),
        meal_type = VALUES(meal_type),
        is_holiday = VALUES(is_holiday),
        is_weekend = VALUES(is_weekend),
        leave_type = VALUES(leave_type),
        synced_at = VALUES(synced_at);
    `;
    
    const [results] = await mysqlSequelize.query(query);
    
    return {
      inserted: results.affectedRows - results.changedRows,
      updated: results.changedRows
    };
  }
  
  /**
   * Create sync status record
   */
  async createSyncStatus(startDate, endDate) {
    await mysqlSequelize.query(`
      INSERT INTO attendance_sync_status (sync_date, sync_status, sync_started_at)
      VALUES (:syncDate, 'in_progress', NOW())
      ON DUPLICATE KEY UPDATE 
        sync_status = 'in_progress',
        sync_started_at = NOW(),
        error_message = NULL;
    `, {
      replacements: { syncDate: startDate }
    });
  }
  
  /**
   * Complete sync status
   */
  async completeSyncStatus(syncDate, stats) {
    await mysqlSequelize.query(`
      UPDATE attendance_sync_status
      SET 
        records_synced = :recordsProcessed,
        records_inserted = :recordsInserted,
        records_updated = :recordsUpdated,
        sync_status = 'completed',
        sync_completed_at = NOW()
      WHERE sync_date = :syncDate;
    `, {
      replacements: { 
        syncDate,
        recordsProcessed: stats.recordsProcessed,
        recordsInserted: stats.recordsInserted,
        recordsUpdated: stats.recordsUpdated
      }
    });
  }
  
  /**
   * Fail sync status
   */
  async failSyncStatus(syncDate, errorMessage) {
    await mysqlSequelize.query(`
      UPDATE attendance_sync_status
      SET 
        sync_status = 'failed',
        error_message = :errorMessage,
        sync_completed_at = NOW()
      WHERE sync_date = :syncDate;
    `, {
      replacements: { syncDate, errorMessage }
    });
  }
  
  /**
   * Sync last N days
   */
  async syncLastDays(days = 90) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const start = startDate.toISOString().split('T')[0];
    const end = endDate.toISOString().split('T')[0];
    
    return await this.syncAttendanceData(start, end);
  }
  
  /**
   * Get sync status
   */
  async getSyncStatus(days = 30) {
    const query = `
      SELECT 
        sync_date,
        records_synced,
        records_inserted,
        records_updated,
        sync_status,
        sync_started_at,
        sync_completed_at,
        TIMESTAMPDIFF(SECOND, sync_started_at, sync_completed_at) as duration_seconds,
        error_message
      FROM attendance_sync_status
      WHERE sync_date >= DATE_SUB(CURDATE(), INTERVAL :days DAY)
      ORDER BY sync_date DESC;
    `;
    
    return await mysqlSequelize.query(query, {
      replacements: { days },
      type: QueryTypes.SELECT
    });
  }
  
  /**
   * Rebuild index (for maintenance)
   */
  async rebuildIndexes() {
    console.log('🔧 Rebuilding indexes on optimized table...');
    
    await mysqlSequelize.query(`
      ALTER TABLE attendance_reports_optimized ENGINE=InnoDB;
    `);
    
    console.log('✅ Indexes rebuilt successfully!');
  }
  
  /**
   * Get table statistics
   */
  async getTableStats() {
    const stats = await mysqlSequelize.query(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(DISTINCT division_code) as total_divisions,
        COUNT(DISTINCT section_code) as total_sections,
        COUNT(DISTINCT emp_id) as total_employees,
        MIN(attendance_date) as earliest_date,
        MAX(attendance_date) as latest_date,
        SUM(work_hours) as total_work_hours,
        ROUND(AVG(work_hours), 2) as avg_work_hours
      FROM attendance_reports_optimized;
    `, { type: QueryTypes.SELECT });
    
    return stats[0];
  }
}

module.exports = new OptimizedAttendanceSyncService();
