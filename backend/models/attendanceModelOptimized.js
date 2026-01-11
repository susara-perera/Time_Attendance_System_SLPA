/**
 * Optimized Attendance Model - Using Employee ID Lookup Tables
 * 
 * Uses 3 optimized tables for ultra-fast employee ID lookups:
 * - emp_ids_by_divisions (for division-only filters)
 * - emp_ids_by_sections (for division+section filters)
 * - emp_ids_by_subsections (for division+section+subsection filters)
 * 
 * Selection Logic:
 * 1. If only division selected → use emp_ids_by_divisions
 * 2. If division + section selected → use emp_ids_by_sections
 * 3. If division + section + subsection selected → use emp_ids_by_subsections
 * 
 * This avoids complex JOINs and provides pre-computed employee lists
 */

const { sequelize } = require('../config/mysql');

/**
 * Fetch attendance report using optimized employee ID lookup tables
 */
const fetchAttendanceReportOptimized = async (filters) => {
  try {
    const {
      from_date,
      to_date,
      division_id,
      section_id,
      sub_section_id,
      grouping = 'employee'
    } = filters;

    // Validate required fields
    if (!from_date || !to_date) {
      throw new Error('from_date and to_date are required');
    }

    // ========================================
    // STEP 1: Determine which lookup table to use
    // ========================================
    let employeeIdTable;
    let whereConditions = [];
    let replacements = {};

    if (sub_section_id) {
      // Level 3: Use emp_ids_by_subsections
      employeeIdTable = 'emp_ids_by_subsections';
      whereConditions.push('emp.sub_section_id = :sub_section_id');
      replacements.sub_section_id = sub_section_id;
      replacements.section_id = section_id;
      replacements.division_id = division_id;
    } else if (section_id) {
      // Level 2: Use emp_ids_by_sections
      employeeIdTable = 'emp_ids_by_sections';
      whereConditions.push('emp.section_id = :section_id');
      replacements.section_id = section_id;
      replacements.division_id = division_id;
    } else if (division_id) {
      // Level 1: Use emp_ids_by_divisions
      employeeIdTable = 'emp_ids_by_divisions';
      whereConditions.push('emp.division_id = :division_id');
      replacements.division_id = division_id;
    } else {
      // No hierarchical filter - use employees_sync directly
      employeeIdTable = 'employees_sync';
      whereConditions.push('emp.IS_ACTIVE = 1');
    }

    replacements.from_date = from_date;
    replacements.to_date = to_date;

    // ========================================
    // STEP 2: Build optimized query
    // ========================================
    let query;

    if (employeeIdTable === 'employees_sync') {
      // Fallback: No filters, use employees_sync
      query = `
        SELECT 
          a.employee_ID AS employee_id,
          emp.EMP_NAME AS employee_name,
          emp.DIV_CODE AS division_id,
          emp.DIV_NAME AS division_name,
          emp.SEC_CODE AS section_id,
          emp.SEC_NAME AS section_name,
          a.date_ AS event_date,
          a.time_ AS event_time,
          a.scan_type
        FROM attendance a
        INNER JOIN employees_sync emp ON a.employee_ID = emp.EMP_NO
        WHERE ${whereConditions.join(' AND ')}
          AND a.date_ BETWEEN :from_date AND :to_date
        ORDER BY a.employee_ID, a.date_, a.time_
      `;
    } else {
      // Optimized: Use pre-computed employee ID lookup table
      query = `
        SELECT 
          a.employee_ID AS employee_id,
          emp.employee_name,
          emp.division_id,
          ${employeeIdTable === 'emp_ids_by_divisions' ? 'emp.division_name' : 'NULL'} AS division_name,
          ${employeeIdTable !== 'emp_ids_by_divisions' ? 'emp.section_id' : 'NULL'} AS section_id,
          ${employeeIdTable === 'emp_ids_by_sections' || employeeIdTable === 'emp_ids_by_subsections' ? 'emp.section_name' : 'NULL'} AS section_name,
          ${employeeIdTable === 'emp_ids_by_subsections' ? 'emp.sub_section_id' : 'NULL'} AS sub_section_id,
          ${employeeIdTable === 'emp_ids_by_subsections' ? 'emp.sub_section_name' : 'NULL'} AS sub_section_name,
          a.date_ AS event_date,
          a.time_ AS event_time,
          a.scan_type
        FROM attendance a
        INNER JOIN ${employeeIdTable} emp ON a.employee_ID = emp.employee_id
        WHERE ${whereConditions.join(' AND ')}
          AND a.date_ BETWEEN :from_date AND :to_date
        ORDER BY a.employee_ID, a.date_, a.time_
      `;
    }

    // ========================================
    // STEP 3: Execute query
    // ========================================
    const [records] = await sequelize.query(query, {
      replacements,
      raw: true
    });

    // Handle empty results
    if (!records || records.length === 0) {
      return {
        success: true,
        data: [],
        count: 0,
        lookup_table_used: employeeIdTable,
        filters: filters
      };
    }

    // ========================================
    // STEP 4: Apply grouping logic
    // ========================================
    let result;

    if (grouping === 'employee') {
      // Group by employee
      const employeeMap = new Map();

      records.forEach(record => {
        const empId = record.employee_id;
        if (!employeeMap.has(empId)) {
          employeeMap.set(empId, {
            employee_id: empId,
            employee_name: record.employee_name,
            division_id: record.division_id,
            division_name: record.division_name,
            section_id: record.section_id,
            section_name: record.section_name,
            sub_section_id: record.sub_section_id,
            sub_section_name: record.sub_section_name,
            attendance_records: []
          });
        }

        employeeMap.get(empId).attendance_records.push({
          event_date: record.event_date,
          event_time: record.event_time,
          scan_type: record.scan_type
        });
      });

      result = Array.from(employeeMap.values());
    } else {
      // Raw records
      result = records;
    }

    return {
      success: true,
      data: result,
      count: result.length,
      lookup_table_used: employeeIdTable,
      filters: filters
    };

  } catch (error) {
    console.error('❌ Error fetching attendance report (optimized):', error.message);
    throw error;
  }
};

/**
 * Get employee IDs for a specific filter (utility function)
 */
const getEmployeeIdsForFilter = async (filters) => {
  try {
    const {
      division_id,
      section_id,
      sub_section_id
    } = filters;

    let query;
    let replacements = {};

    if (sub_section_id) {
      // Use subsections table
      query = `
        SELECT DISTINCT employee_id 
        FROM emp_ids_by_subsections
        WHERE division_id = :division_id 
          AND section_id = :section_id
          AND sub_section_id = :sub_section_id
        ORDER BY employee_id
      `;
      replacements = { division_id, section_id, sub_section_id };
    } else if (section_id) {
      // Use sections table
      query = `
        SELECT DISTINCT employee_id
        FROM emp_ids_by_sections
        WHERE division_id = :division_id 
          AND section_id = :section_id
        ORDER BY employee_id
      `;
      replacements = { division_id, section_id };
    } else if (division_id) {
      // Use divisions table
      query = `
        SELECT DISTINCT employee_id
        FROM emp_ids_by_divisions
        WHERE division_id = :division_id
        ORDER BY employee_id
      `;
      replacements = { division_id };
    } else {
      // No filter - get all active employees
      query = `
        SELECT DISTINCT EMP_NO AS employee_id
        FROM employees_sync
        WHERE IS_ACTIVE = 1
        ORDER BY employee_id
      `;
    }

    const [employeeIds] = await sequelize.query(query, {
      replacements,
      raw: true
    });

    return employeeIds.map(row => row.employee_id);

  } catch (error) {
    console.error('❌ Error fetching employee IDs:', error.message);
    throw error;
  }
};

module.exports = {
  fetchAttendanceReportOptimized,
  getEmployeeIdsForFilter
};
