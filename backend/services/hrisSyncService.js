/**
 * HRIS to MySQL Synchronization Service
 * 
 * This service handles syncing data from HRIS API to local MySQL database
 * for improved performance and reduced API dependency.
 * 
 * Syncs:
 * - Divisions (company_hierarchy level 3)
 * - Sections (company_hierarchy level 4)
 * - Employees (employee collection)
 */

const { login, readData } = require('./hrisApiService');
const { DivisionSync, SectionSync, EmployeeSync, SyncLog, sequelize } = require('../models/mysql');

/**
 * Log sync activity to database
 */
const createSyncLog = async (syncType, syncStatus, data = {}) => {
  try {
    return await SyncLog.create({
      sync_type: syncType,
      sync_status: syncStatus,
      records_synced: data.records_synced || 0,
      records_added: data.records_added || 0,
      records_updated: data.records_updated || 0,
      records_failed: data.records_failed || 0,
      error_message: data.error_message || null,
      started_at: data.started_at || new Date(),
      completed_at: data.completed_at || null,
      duration_seconds: data.duration_seconds || null,
      triggered_by: data.triggered_by || 'system',
      sync_details: data.sync_details || null
    });
  } catch (error) {
    console.error('❌ Failed to create sync log:', error.message);
    return null;
  }
};

/**
 * Update existing sync log
 */
const updateSyncLog = async (logId, updates) => {
  try {
    await SyncLog.update(updates, { where: { id: logId } });
  } catch (error) {
    console.error('❌ Failed to update sync log:', error.message);
  }
};

/**
 * Sync divisions from HRIS to MySQL
 */
const syncDivisions = async (triggeredBy = 'system') => {
  const startTime = Date.now();
  const syncLog = await createSyncLog('divisions', 'started', {
    started_at: new Date(),
    triggered_by: triggeredBy
  });

  let recordsAdded = 0;
  let recordsUpdated = 0;
  let recordsFailed = 0;
  let recordsSynced = 0;
  const newRecords = []; // Track newly added records

  try {
    console.log('🔄 [SYNC] Starting divisions sync...');

    // Login to HRIS API
    await login();

    // Fetch company hierarchy
    const hierarchy = await readData('company_hierarchy', {});
    
    // Filter divisions (DEF_LEVEL = 3)
    let divisions = hierarchy.filter(item => 
      item.DEF_LEVEL === 3 || item.DEF_LEVEL === '3'
    );

    // Sort by HIE_CODE in ASCENDING NUMERICAL ORDER for optimal InnoDB insertion
    divisions.sort((a, b) => {
      const codeA = parseInt(a.HIE_CODE) || 0;
      const codeB = parseInt(b.HIE_CODE) || 0;
      return codeA - codeB;
    });

    console.log(`📊 [SYNC] Found ${divisions.length} divisions in HRIS (sorted by HIE_CODE)`);

    // Sync each division
    for (const division of divisions) {
      try {
        const divisionData = {
          HIE_CODE: division.HIE_CODE || `DIV_${Date.now()}_${Math.random()}`,
          HIE_NAME: division.HIE_NAME || 'Unknown Division',
          HIE_NAME_SINHALA: division.HIE_NAME_SINHALA || division.HIE_NAME_2 || null,
          HIE_NAME_TAMIL: division.HIE_NAME_TAMIL || null,
          HIE_RELATIONSHIP: division.HIE_RELATIONSHIP || null,
          DEF_LEVEL: parseInt(division.DEF_LEVEL) || 3,
          STATUS: division.STATUS || 'ACTIVE',
          DESCRIPTION: division.DESCRIPTION || null,
          synced_at: new Date()
        };

        // Check if division exists
        const existing = await DivisionSync.findOne({
          where: { HIE_CODE: divisionData.HIE_CODE }
        });

        if (existing) {
          // Skip existing (don't update)
          recordsUpdated++;
        } else {
          // Create new only
          const newDivision = await DivisionSync.create(divisionData);
          recordsAdded++;
          newRecords.push({
            HIE_CODE: newDivision.HIE_CODE,
            HIE_NAME: newDivision.HIE_NAME,
            HIE_NAME_SINHALA: newDivision.HIE_NAME_SINHALA,
            STATUS: newDivision.STATUS,
            synced_at: newDivision.synced_at
          });
        }

        recordsSynced++;
      } catch (error) {
        console.error(`❌ [SYNC] Failed to sync division ${division.HIE_CODE}:`, error.message);
        recordsFailed++;
      }
    }

    const duration = Math.floor((Date.now() - startTime) / 1000);

    // Update sync log
    if (syncLog) {
      await updateSyncLog(syncLog.id, {
        sync_status: 'completed',
        records_synced: recordsSynced,
        records_added: recordsAdded,
        records_updated: recordsUpdated,
        records_failed: recordsFailed,
        completed_at: new Date(),
        duration_seconds: duration,
        sync_details: {
          total_hris_records: divisions.length,
          success_rate: ((recordsSynced / divisions.length) * 100).toFixed(2) + '%'
        }
      });
    }

    console.log(`✅ [SYNC] Divisions sync completed in ${duration}s`);
    console.log(`   📊 Added: ${recordsAdded}, Skipped (existing): ${recordsUpdated}, Failed: ${recordsFailed}`);

    return {
      success: true,
      recordsSynced,
      recordsAdded,
      recordsUpdated,
      recordsFailed,
      duration,
      newRecords // Return list of newly added records
    };

  } catch (error) {
    console.error('❌ [SYNC] Divisions sync failed:', error.message);
    
    if (syncLog) {
      await updateSyncLog(syncLog.id, {
        sync_status: 'failed',
        error_message: error.message,
        completed_at: new Date(),
        duration_seconds: Math.floor((Date.now() - startTime) / 1000)
      });
    }

    return {
      success: false,
      error: error.message,
      recordsSynced,
      recordsAdded,
      recordsUpdated,
      recordsFailed
    };
  }
};

/**
 * Sync sections from HRIS to MySQL
 */
const syncSections = async (triggeredBy = 'system') => {
  const startTime = Date.now();
  const syncLog = await createSyncLog('sections', 'started', {
    started_at: new Date(),
    triggered_by: triggeredBy
  });

  let recordsAdded = 0;
  let recordsUpdated = 0;
  let recordsFailed = 0;
  let recordsSynced = 0;
  const newRecords = []; // Track newly added records

  try {
    console.log('🔄 [SYNC] Starting sections sync...');

    // Login to HRIS API
    await login();

    // Fetch company hierarchy
    const hierarchy = await readData('company_hierarchy', {});
    
    // Filter sections (DEF_LEVEL = 4)
    let sections = hierarchy.filter(item => 
      item.DEF_LEVEL === 4 || item.DEF_LEVEL === '4'
    );

    // Sort by HIE_CODE in ASCENDING NUMERICAL ORDER for optimal InnoDB insertion
    sections.sort((a, b) => {
      const codeA = parseInt(a.HIE_CODE) || 0;
      const codeB = parseInt(b.HIE_CODE) || 0;
      return codeA - codeB;
    });

    console.log(`📊 [SYNC] Found ${sections.length} sections in HRIS (sorted by HIE_CODE)`);

    // Sync each section
    for (const section of sections) {
      try {
        const sectionData = {
          HIE_CODE: section.HIE_CODE || `SEC_${Date.now()}_${Math.random()}`,
          HIE_CODE_3: section.HIE_CODE_3 || null,
          HIE_NAME: section.HIE_NAME || null,
          HIE_NAME_3: section.HIE_NAME_3 || null,
          HIE_NAME_4: section.HIE_NAME_4 || section.HIE_NAME || 'Unknown Section',
          HIE_NAME_SINHALA: section.HIE_NAME_SINHALA || section.HIE_NAME_2 || null,
          HIE_NAME_TAMIL: section.HIE_NAME_TAMIL || null,
          HIE_RELATIONSHIP: section.HIE_RELATIONSHIP || null,
          SECTION_ID: section.SECTION_ID || section.HIE_CODE || null,
          DEF_LEVEL: parseInt(section.DEF_LEVEL) || 4,
          STATUS: section.STATUS || 'ACTIVE',
          DESCRIPTION: section.DESCRIPTION || null,
          synced_at: new Date()
        };

        // Check if section exists
        const existing = await SectionSync.findOne({
          where: { HIE_CODE: sectionData.HIE_CODE }
        });

        if (existing) {
          // Skip existing (don't update)
          recordsUpdated++;
        } else {
          // Create new only
          const newSection = await SectionSync.create(sectionData);
          recordsAdded++;
          newRecords.push({
            HIE_CODE: newSection.HIE_CODE,
            HIE_NAME_4: newSection.HIE_NAME_4,
            HIE_NAME_SINHALA: newSection.HIE_NAME_SINHALA,
            HIE_RELATIONSHIP: newSection.HIE_RELATIONSHIP,
            STATUS: newSection.STATUS,
            synced_at: newSection.synced_at
          });
        }

        recordsSynced++;
      } catch (error) {
        console.error(`❌ [SYNC] Failed to sync section ${section.HIE_CODE}:`, error.message);
        recordsFailed++;
      }
    }

    const duration = Math.floor((Date.now() - startTime) / 1000);

    // Update sync log
    if (syncLog) {
      await updateSyncLog(syncLog.id, {
        sync_status: 'completed',
        records_synced: recordsSynced,
        records_added: recordsAdded,
        records_updated: recordsUpdated,
        records_failed: recordsFailed,
        completed_at: new Date(),
        duration_seconds: duration,
        sync_details: {
          total_hris_records: sections.length,
          success_rate: ((recordsSynced / sections.length) * 100).toFixed(2) + '%'
        }
      });
    }

    console.log(`✅ [SYNC] Sections sync completed in ${duration}s`);
    console.log(`   📊 Added: ${recordsAdded}, Skipped (existing): ${recordsUpdated}, Failed: ${recordsFailed}`);

    return {
      success: true,
      recordsSynced,
      recordsAdded,
      recordsUpdated,
      recordsFailed,
      duration,
      newRecords // Return list of newly added records
    };

  } catch (error) {
    console.error('❌ [SYNC] Sections sync failed:', error.message);
    
    if (syncLog) {
      await updateSyncLog(syncLog.id, {
        sync_status: 'failed',
        error_message: error.message,
        completed_at: new Date(),
        duration_seconds: Math.floor((Date.now() - startTime) / 1000)
      });
    }

    return {
      success: false,
      error: error.message,
      recordsSynced,
      recordsAdded,
      recordsUpdated,
      recordsFailed
    };
  }
};

/**
 * Sync employees from HRIS to MySQL
 */
const syncEmployees = async (triggeredBy = 'system') => {
  const startTime = Date.now();
  const syncLog = await createSyncLog('employees', 'started', {
    started_at: new Date(),
    triggered_by: triggeredBy
  });

  let recordsAdded = 0;
  let recordsUpdated = 0;
  let recordsFailed = 0;
  let recordsSynced = 0;
  const newRecords = []; // Track newly added records

  try {
    console.log('🔄 [SYNC] Starting employees sync...');

    // Login to HRIS API
    await login();

    // Fetch employees
    const employees = await readData('employee', {});

    // Filter only active employees (ACTIVE_HRM_FLG=1)
    let activeEmployees = employees.filter(emp => emp.ACTIVE_HRM_FLG === 1);

    // Sort by EMP_NO in ASCENDING ORDER for optimal InnoDB insertion
    activeEmployees.sort((a, b) => {
      const empNoA = String(a.EMP_NUMBER || a.EMP_NO || '');
      const empNoB = String(b.EMP_NUMBER || b.EMP_NO || '');
      return empNoA.localeCompare(empNoB);
    });

    console.log(`📊 [SYNC] Found ${employees.length} employees in HRIS (${activeEmployees.length} active, sorted by EMP_NO)`);

    // Helper function to extract date
    const parseHrisDate = (dateVal) => {
      if (!dateVal) return null;
      if (typeof dateVal === 'string') return dateVal;
      if (dateVal.$date && dateVal.$date.$numberLong) {
        return new Date(parseInt(dateVal.$date.$numberLong));
      }
      return null;
    };

    // Sync each active employee
    for (const employee of activeEmployees) {
      try {
        const currentWork = employee.currentwork || {};
        
        let address = [employee.PER_ADDRESS1, employee.PER_ADDRESS2, employee.PER_ADDRESS3]
          .filter(Boolean).join(', ');

        const employeeData = {
          EMP_NO: employee.EMP_NUMBER || employee.EMP_NO || `EMP_${Date.now()}_${Math.random()}`,
          EMP_NAME: employee.FULLNAME || employee.EMP_NAME || 'Unknown Employee',
          EMP_NAME_WITH_INITIALS: employee.DISPLAY_NAME || employee.EMP_NAME_WITH_INITIALS || null,
          EMP_FIRST_NAME: employee.FIRST_NAME || employee.EMP_FIRST_NAME || null,
          EMP_LAST_NAME: employee.LAST_NAME || employee.EMP_LAST_NAME || null,
          EMP_NIC: employee.NIC || employee.EMP_NIC || null,
          EMP_EMAIL: employee.PER_EMAIL || employee.EMP_EMAIL || null,
          EMP_PHONE: employee.PER_TELEPHONE || employee.EMP_PHONE || null,
          EMP_MOBILE: employee.PER_MOBILE || employee.EMP_MOBILE || null,
          EMP_ADDRESS: address || employee.EMP_ADDRESS || null,
          EMP_GENDER: employee.GENDER || employee.SEX || employee.gender || null,
          
          // Employment details
          EMP_STATUS: employee.EMP_STATUS || 'ACTIVE', // Defaulting to ACTIVE since we filtered by ACTIVE_HRM_FLG=1
          EMP_TYPE: employee.TYPE || employee.EMP_TYPE || null,
          EMP_DESIGNATION: currentWork.designation || employee.EMP_DESIGNATION || null,
          EMP_GRADE: employee.SAL_GRD_CODE || employee.EMP_GRADE || null,
          EMP_DATE_JOINED: parseHrisDate(employee.DATE_JOINED) || employee.EMP_DATE_JOINED || null,
          EMP_DATE_PERMANENT: parseHrisDate(employee.CONFIRM_DATE) || employee.EMP_DATE_PERMANENT || null,
          EMP_DATE_RETIRE: parseHrisDate(employee.RETIRE_DATE) || employee.EMP_DATE_RETIRE || null,
          
          // Organizational assignment
          DIV_CODE: employee.HIE_CODE_3 || employee.DIV_CODE || null,
          DIV_NAME: currentWork.HIE_NAME_3 || employee.DIV_NAME || null,
          SEC_CODE: employee.HIE_CODE_4 || employee.SEC_CODE || null,
          SEC_NAME: currentWork.HIE_NAME_4 || employee.SEC_NAME || null,
          DEPT_CODE: employee.HIE_CODE_2 || employee.DEPT_CODE || null, // Assuming Level 2 is Dept/Port
          DEPT_NAME: currentWork.HIE_NAME_2 || employee.DEPT_NAME || null,
          
          // Additional fields
          HIE_CODE: employee.HIE_CODE || null,
          HIE_NAME: employee.HIE_NAME || null,
          LOCATION: employee.LOC_CODE || employee.LOCATION || null,
          COST_CENTER: employee.COST_CENTER || null,
          
          // Status
          STATUS: 'ACTIVE',
          IS_ACTIVE: employee.ACTIVE_HRM_FLG === 1,
          
          synced_at: new Date()
        };

        // Check if employee exists
        const existing = await EmployeeSync.findOne({
          where: { EMP_NO: employeeData.EMP_NO }
        });

        if (existing) {
          // Skip existing (don't update)
          recordsUpdated++;
        } else {
          // Create new only
          const newEmployee = await EmployeeSync.create(employeeData);
          recordsAdded++;
          newRecords.push({
            EMP_NO: newEmployee.EMP_NO,
            EMP_NAME: newEmployee.EMP_NAME,
            EMP_NIC: newEmployee.EMP_NIC,
            EMP_DESIGNATION: newEmployee.EMP_DESIGNATION,
            DIV_NAME: newEmployee.DIV_NAME,
            SEC_NAME: newEmployee.SEC_NAME,
            EMP_STATUS: newEmployee.EMP_STATUS,
            synced_at: newEmployee.synced_at
          });
        }

        recordsSynced++;
      } catch (error) {
        console.error(`❌ [SYNC] Failed to sync employee ${employee.EMP_NO}:`, error.message);
        recordsFailed++;
      }
    }

    const duration = Math.floor((Date.now() - startTime) / 1000);

    // Update sync log
    if (syncLog) {
      await updateSyncLog(syncLog.id, {
        sync_status: 'completed',
        records_synced: recordsSynced,
        records_added: recordsAdded,
        records_updated: recordsUpdated,
        records_failed: recordsFailed,
        completed_at: new Date(),
        duration_seconds: duration,
        sync_details: {
          total_hris_records: employees.length,
          active_employees: activeEmployees.length,
          success_rate: ((recordsSynced / activeEmployees.length) * 100).toFixed(2) + '%'
        }
      });
    }

    console.log(`✅ [SYNC] Employees sync completed in ${duration}s`);
    console.log(`   📊 Added: ${recordsAdded}, Skipped (existing): ${recordsUpdated}, Failed: ${recordsFailed}`);

    return {
      success: true,
      recordsSynced,
      recordsAdded,
      recordsUpdated,
      recordsFailed,
      duration,
      newRecords // Return list of newly added records
    };

  } catch (error) {
    console.error('❌ [SYNC] Employees sync failed:', error.message);
    
    if (syncLog) {
      await updateSyncLog(syncLog.id, {
        sync_status: 'failed',
        error_message: error.message,
        completed_at: new Date(),
        duration_seconds: Math.floor((Date.now() - startTime) / 1000)
      });
    }

    return {
      success: false,
      error: error.message,
      recordsSynced,
      recordsAdded,
      recordsUpdated,
      recordsFailed
    };
  }
};

/**
 * Perform full sync (divisions, sections, and employees)
 */
const performFullSync = async (triggeredBy = 'system') => {
  const startTime = Date.now();
  console.log('🚀 [SYNC] Starting full HRIS sync...');

  const results = {
    divisions: null,
    sections: null,
    employees: null,
    attendance: null,
    overall: {
      success: false,
      duration: 0,
      totalRecordsSynced: 0
    }
  };

  try {
    // Sync divisions first
    results.divisions = await syncDivisions(triggeredBy);
    
    // Sync sections
    results.sections = await syncSections(triggeredBy);
    
    // Sync employees
    results.employees = await syncEmployees(triggeredBy);

    // Sync attendance data for reports (last 30 days)
    try {
      const { syncLastNDays } = require('./attendanceSyncService');
      console.log('🔄 [SYNC] Syncing attendance data for reports...');
      results.attendance = await syncLastNDays(30, triggeredBy);
      console.log('✅ [SYNC] Attendance data synced');
    } catch (err) {
      console.error('⚠️ [SYNC] Failed to sync attendance data:', err.message);
      results.attendance = { success: false, error: err.message };
    }

    // Sync emp_index_list (combines divisions, sections, subsections, and active employees)
    try {
      const { syncEmpIndex } = require('./empIndexSyncService');
      console.log('🔄 [SYNC] Syncing emp_index_list (hierarchical employee index)...');
      results.empIndex = await syncEmpIndex();
      console.log('✅ [SYNC] emp_index_list synced');
    } catch (err) {
      console.error('⚠️ [SYNC] Failed to sync emp_index_list:', err.message);
      results.empIndex = { success: false, error: err.message };
    }

    const duration = Math.floor((Date.now() - startTime) / 1000);
    const totalRecordsSynced = 
      (results.divisions?.recordsSynced || 0) +
      (results.sections?.recordsSynced || 0) +
      (results.employees?.recordsSynced || 0) +
      (results.attendance?.recordsProcessed || 0);

    results.overall = {
      success: true,
      duration,
      totalRecordsSynced
    };

    console.log(`✅ [SYNC] Full sync completed in ${duration}s`);
    console.log(`   📊 Total records synced: ${totalRecordsSynced}\n`);

    return results;

  } catch (error) {
    console.error('❌ [SYNC] Full sync failed:', error.message);
    results.overall.success = false;
    results.overall.error = error.message;
    return results;
  }
};

/**
 * Get sync status and recent logs
 */
const getSyncStatus = async (limit = 10) => {
  try {
    const recentLogs = await SyncLog.findAll({
      order: [['started_at', 'DESC']],
      limit: limit
    });

    // Get latest sync for each type
    const latestDivisionSync = await SyncLog.findOne({
      where: { sync_type: 'divisions' },
      order: [['started_at', 'DESC']]
    });

    const latestSectionSync = await SyncLog.findOne({
      where: { sync_type: 'sections' },
      order: [['started_at', 'DESC']]
    });

    const latestEmployeeSync = await SyncLog.findOne({
      where: { sync_type: 'employees' },
      order: [['started_at', 'DESC']]
    });

    // Get counts
    const [divisionCount, sectionCount, employeeCount] = await Promise.all([
      DivisionSync.count(),
      SectionSync.count(),
      EmployeeSync.count()
    ]);

    return {
      success: true,
      counts: {
        divisions: divisionCount,
        sections: sectionCount,
        employees: employeeCount
      },
      latestSync: {
        divisions: latestDivisionSync,
        sections: latestSectionSync,
        employees: latestEmployeeSync
      },
      recentLogs: recentLogs
    };

  } catch (error) {
    console.error('❌ Failed to get sync status:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = {
  syncDivisions,
  syncSections,
  syncEmployees,
  performFullSync,
  getSyncStatus,
  createSyncLog,
  updateSyncLog
};
