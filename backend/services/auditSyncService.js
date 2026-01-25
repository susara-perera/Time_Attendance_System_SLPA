/**
 * Audit Sync Service
 * Syncs incomplete punch records from attendance + employees tables to audit_sync
 * Similar architecture to attendanceSyncService.js
 * 
 * Purpose:
 * - Pre-process incomplete punch detection logic
 * - Store results in optimized audit_sync table
 * - Enable ultra-fast audit report generation (10-50x faster)
 * - Use Redis caching for even faster repeated queries
 */

const { createMySQLConnection } = require('../config/mysql');
const { 
  normalizeScanType, 
  categorizeIncompleteIssue,
  isScanTypeIn,
  isScanTypeOut 
} = require('../utils/attendanceNormalizer');
const moment = require('moment');

/**
 * Main sync function: Populate audit_sync table for date range with optional filters
 * @param {string} startDate - Format: YYYY-MM-DD
 * @param {string} endDate - Format: YYYY-MM-DD
 * @param {object} filters - Optional filters: { division_id, section_id, sub_section_id }
 * @param {string} triggeredBy - Who/what triggered this sync
 */
const syncAuditData = async (startDate, endDate, filters = {}, triggeredBy = 'system') => {
  let conn;
  const syncStart = Date.now();
  
  try {
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║         🔍 AUDIT DATA SYNC - INCOMPLETE PUNCH DETECTION      ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
    
    console.log(`📅 Date Range: ${startDate} to ${endDate}`);
    console.log(`👤 Triggered By: ${triggeredBy}`);
    if (filters.division_id) console.log(`🏢 Division Filter: ${filters.division_id}`);
    if (filters.section_id) console.log(`📁 Section Filter: ${filters.section_id}`);
    if (filters.sub_section_id) console.log(`📂 Sub-Section Filter: ${filters.sub_section_id}`);
    console.log(`⏰ Started At: ${moment().format('YYYY-MM-DD HH:mm:ss')}\n`);

    conn = await createMySQLConnection();

    // STEP 0: Get filtered employee IDs based on organizational filters
    let filteredEmployeeIds = null;
    
    if (filters.sub_section_id) {
      console.log('🔍 STEP 0: Fetching employee IDs from sub_sections table...');
      const [subSectionEmps] = await conn.execute(`
        SELECT DISTINCT employee_id FROM sub_sections WHERE sub_section_id = ?
      `, [filters.sub_section_id]);
      filteredEmployeeIds = subSectionEmps.map(r => r.employee_id);
      console.log(`   ✅ Found ${filteredEmployeeIds.length} employees in sub-section\n`);
      
    } else if (filters.section_id) {
      console.log('🔍 STEP 0: Fetching employee IDs from emp_ids_by_sections table...');
      const [sectionEmps] = await conn.execute(`
        SELECT DISTINCT employee_id FROM emp_ids_by_sections WHERE section_id = ?
      `, [filters.section_id]);
      filteredEmployeeIds = sectionEmps.map(r => r.employee_id);
      console.log(`   ✅ Found ${filteredEmployeeIds.length} employees in section\n`);
      
    } else if (filters.division_id) {
      console.log('🔍 STEP 0: Fetching employee IDs from emp_ids_by_divisions table...');
      const [divisionEmps] = await conn.execute(`
        SELECT DISTINCT employee_id FROM emp_ids_by_divisions WHERE division_id = ?
      `, [filters.division_id]);
      filteredEmployeeIds = divisionEmps.map(r => r.employee_id);
      console.log(`   ✅ Found ${filteredEmployeeIds.length} employees in division\n`);
    }

    // STEP 1: Find incomplete punch records (COUNT(*) = 1 per employee per day)
    console.log('📊 STEP 1: Identifying incomplete punch records...');
    
    let incompletePunchSQL = `
      SELECT 
        a.employee_ID,
        a.date_ AS event_date,
        MIN(a.time_) AS first_punch_time,
        MAX(a.time_) AS last_punch_time,
        GROUP_CONCAT(DISTINCT a.scan_type ORDER BY a.time_ SEPARATOR ',') AS scan_types,
        COUNT(*) AS punch_count
      FROM attendance a
      WHERE a.date_ BETWEEN ? AND ?
      AND (a.fingerprint_id NOT LIKE '%Emergancy Exit%' OR a.fingerprint_id IS NULL)
    `;
    
    const queryParams = [startDate, endDate];
    
    // Add employee ID filter if organizational filter is applied
    if (filteredEmployeeIds && filteredEmployeeIds.length > 0) {
      const placeholders = filteredEmployeeIds.map(() => '?').join(',');
      incompletePunchSQL += ` AND a.employee_ID IN (${placeholders})`;
      queryParams.push(...filteredEmployeeIds);
    }
    
    incompletePunchSQL += `
      GROUP BY a.employee_ID, a.date_
      HAVING COUNT(*) = 1
      ORDER BY a.date_ DESC, a.employee_ID
    `;

    const [incompleteRecords] = await conn.execute(incompletePunchSQL, queryParams);
    console.log(`   ✅ Found ${incompleteRecords.length} incomplete punch records\n`);

    if (incompleteRecords.length === 0) {
      console.log('✨ No incomplete punches found in this date range');
      return {
        success: true,
        recordsSynced: 0,
        recordsAdded: 0,
        recordsUpdated: 0,
        dateRange: { start: startDate, end: endDate },
        duration: Date.now() - syncStart
      };
    }

    // STEP 2: Fetch employee details for found records
    console.log('👥 STEP 2: Fetching employee details...');
    
    const employeeIds = incompleteRecords.map(r => r.employee_ID);
    const placeholders = employeeIds.map(() => '?').join(',');
    
    const employeeSQL = `
      SELECT 
        e.employee_id,
        e.employee_name,
        e.designation,
        e.division_id,
        e.division_name,
        e.section_id,
        e.section_name,
        e.sub_section_id,
        e.sub_section_name
      FROM emp_index_list e
      WHERE e.employee_id IN (${placeholders})
    `;

    const [employeeDetails] = await conn.execute(employeeSQL, employeeIds);
    console.log(`   ✅ Retrieved ${employeeDetails.length} employee records\n`);

    // Create employee lookup map
    const employeeMap = new Map();
    employeeDetails.forEach(emp => {
      employeeMap.set(String(emp.employee_id), emp);
    });

    // STEP 3: Process each incomplete punch record
    console.log('🔄 STEP 3: Processing incomplete punch records...');
    
    const auditRecords = [];
    let checkInOnlyCount = 0;
    let checkOutOnlyCount = 0;
    let unknownCount = 0;

    incompleteRecords.forEach(record => {
      const employee = employeeMap.get(String(record.employee_ID));
      
      if (!employee) {
        console.warn(`   ⚠️ No employee data for ID: ${record.employee_ID}, skipping...`);
        return;
      }

      // Determine scan type from the single punch
      const rawScanType = record.scan_types; // Will be just one type since COUNT = 1
      const normalizedScanType = normalizeScanType(rawScanType);
      
      // Categorize the incomplete issue
      const issueCategory = categorizeIncompleteIssue(normalizedScanType);
      
      // Track statistics
      if (issueCategory.issueType === 'CHECK_IN_ONLY') {
        checkInOnlyCount++;
      } else if (issueCategory.issueType === 'CHECK_OUT_ONLY') {
        checkOutOnlyCount++;
      } else {
        unknownCount++;
      }

      // Build audit record
      auditRecords.push({
        employee_id: employee.employee_id,
        employee_name: employee.employee_name,
        designation: employee.designation || 'Unassigned',
        division_id: employee.division_id,
        division_name: employee.division_name || 'N/A',
        section_id: employee.section_id,
        section_name: employee.section_name || 'N/A',
        sub_section_id: employee.sub_section_id,
        sub_section_name: employee.sub_section_name || 'N/A',
        event_date: record.event_date,
        event_time: record.first_punch_time,
        event_timestamp: `${record.event_date} ${record.first_punch_time || '00:00:00'}`,
        scan_type: normalizedScanType,
        raw_scan_type: rawScanType,
        issue_type: issueCategory.issueType,
        severity: issueCategory.severity,
        display_label: issueCategory.displayLabel,
        description: issueCategory.description
      });
    });

    console.log(`   ✅ Processed ${auditRecords.length} records`);
    console.log(`      - Check In Only (HIGH):    ${checkInOnlyCount}`);
    console.log(`      - Check Out Only (MEDIUM): ${checkOutOnlyCount}`);
    console.log(`      - Unknown (LOW):           ${unknownCount}\n`);

    // STEP 4: Clear existing data for date range (to avoid duplicates)
    console.log('🗑️  STEP 4: Clearing existing audit data for date range...');
    
    await conn.execute(`
      DELETE FROM audit_sync
      WHERE event_date BETWEEN ? AND ?
    `, [startDate, endDate]);
    
    console.log('   ✅ Cleared existing data\n');

    // STEP 5: Bulk insert into audit_sync
    console.log('💾 STEP 5: Inserting audit records into audit_sync...');
    
    if (auditRecords.length > 0) {
      // Batch insert for performance
      const batchSize = 500;
      let insertedCount = 0;

      for (let i = 0; i < auditRecords.length; i += batchSize) {
        const batch = auditRecords.slice(i, i + batchSize);
        
        const insertSQL = `
          INSERT INTO audit_sync (
            employee_id, employee_name, designation,
            division_id, division_name,
            section_id, section_name,
            sub_section_id, sub_section_name,
            event_date, event_time, event_timestamp,
            scan_type, raw_scan_type,
            issue_type, severity, display_label, description,
            is_active
          ) VALUES ?
        `;

        const values = batch.map(r => [
          r.employee_id,
          r.employee_name,
          r.designation,
          r.division_id,
          r.division_name,
          r.section_id,
          r.section_name,
          r.sub_section_id,
          r.sub_section_name,
          r.event_date,
          r.event_time,
          r.event_timestamp,
          r.scan_type,
          r.raw_scan_type,
          r.issue_type,
          r.severity,
          r.display_label,
          r.description,
          1 // is_active
        ]);

        await conn.query(insertSQL, [values]);
        insertedCount += batch.length;
        
        console.log(`   📦 Batch ${Math.floor(i / batchSize) + 1}: ${batch.length} records inserted`);
      }

      console.log(`\n   ✅ Total inserted: ${insertedCount} records\n`);
    }

    // STEP 6: Update statistics and verify
    console.log('📊 STEP 6: Verifying sync results...');
    
    const [verifyCount] = await conn.execute(`
      SELECT COUNT(*) AS total FROM audit_sync
      WHERE event_date BETWEEN ? AND ?
    `, [startDate, endDate]);

    const [verifyByIssue] = await conn.execute(`
      SELECT 
        issue_type, 
        severity,
        COUNT(*) AS count
      FROM audit_sync
      WHERE event_date BETWEEN ? AND ?
      GROUP BY issue_type, severity
      ORDER BY severity ASC
    `, [startDate, endDate]);

    console.log(`   ✅ Verification complete:`);
    console.log(`      Total records in audit_sync: ${verifyCount[0].total}`);
    verifyByIssue.forEach(row => {
      console.log(`      ${row.issue_type.padEnd(20)} (${row.severity}): ${row.count}`);
    });
    console.log('');

    const duration = Date.now() - syncStart;
    
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║                 ✅ SYNC COMPLETED SUCCESSFULLY                ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
    console.log(`⏱️  Duration: ${duration}ms (${(duration / 1000).toFixed(2)}s)`);
    console.log(`📊 Records Synced: ${auditRecords.length}`);
    console.log(`🎯 Date Range: ${startDate} to ${endDate}\n`);

    return {
      success: true,
      recordsSynced: auditRecords.length,
      recordsAdded: auditRecords.length,
      recordsUpdated: 0,
      breakdown: {
        checkInOnly: checkInOnlyCount,
        checkOutOnly: checkOutOnlyCount,
        unknown: unknownCount
      },
      dateRange: { start: startDate, end: endDate },
      filters: filters || {},
      duration,
      triggeredBy
    };

  } catch (error) {
    console.error('❌ Error syncing audit data:', error);
    throw error;
  } finally {
    if (conn) {
      await conn.end();
      console.log('🔌 Database connection closed\n');
    }
  }
};

/**
 * Sync last N days of audit data with optional filters
 */
const syncLastNDays = async (days = 30, filters = {}, triggeredBy = 'system') => {
  const endDate = moment().format('YYYY-MM-DD');
  const startDate = moment().subtract(days - 1, 'days').format('YYYY-MM-DD');
  
  console.log(`\n📅 Syncing last ${days} days of audit data...`);
  console.log(`   From: ${startDate}`);
  console.log(`   To:   ${endDate}\n`);
  
  return await syncAuditData(startDate, endDate, filters, triggeredBy);
};

/**
 * Sync current month with optional filters
 */
const syncCurrentMonth = async (filters = {}, triggeredBy = 'system') => {
  const startDate = moment().startOf('month').format('YYYY-MM-DD');
  const endDate = moment().endOf('month').format('YYYY-MM-DD');
  
  console.log('\n📅 Syncing current month audit data...');
  console.log(`   From: ${startDate}`);
  console.log(`   To:   ${endDate}\n`);
  
  return await syncAuditData(startDate, endDate, filters, triggeredBy);
};

/**
 * Sync yesterday (for daily cron)
 */
const syncYesterday = async (triggeredBy = 'cron') => {
  const yesterday = moment().subtract(1, 'day').format('YYYY-MM-DD');
  
  console.log('\n📅 Syncing yesterday\'s audit data...');
  console.log(`   Date: ${yesterday}\n`);
  
  return await syncAuditData(yesterday, yesterday, {}, triggeredBy);
};

/**
 * Get sync statistics
 */
const getAuditSyncStats = async () => {
  let conn;
  
  try {
    conn = await createMySQLConnection();
    
    // Total records
    const [totalCount] = await conn.execute('SELECT COUNT(*) AS total FROM audit_sync');
    
    // By issue type
    const [byIssue] = await conn.execute(`
      SELECT issue_type, severity, COUNT(*) AS count
      FROM audit_sync
      GROUP BY issue_type, severity
      ORDER BY severity ASC
    `);
    
    // Date range
    const [dateRange] = await conn.execute(`
      SELECT MIN(event_date) AS oldest, MAX(event_date) AS newest
      FROM audit_sync
    `);
    
    // Resolution status
    const [resolution] = await conn.execute(`
      SELECT 
        SUM(CASE WHEN is_resolved = 1 THEN 1 ELSE 0 END) AS resolved,
        SUM(CASE WHEN is_resolved = 0 THEN 1 ELSE 0 END) AS unresolved
      FROM audit_sync
    `);

    return {
      totalRecords: totalCount[0].total,
      byIssueType: byIssue,
      dateRange: dateRange[0],
      resolution: resolution[0],
      lastSynced: moment().format('YYYY-MM-DD HH:mm:ss')
    };
    
  } catch (error) {
    console.error('Error getting audit sync stats:', error);
    throw error;
  } finally {
    if (conn) await conn.end();
  }
};

module.exports = {
  syncAuditData,
  syncLastNDays,
  syncCurrentMonth,
  syncYesterday,
  getAuditSyncStats
};
