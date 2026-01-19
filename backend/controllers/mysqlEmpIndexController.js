/**
 * MySQL Emp Index List Controller
 */

const { createMySQLConnection } = require('../config/mysql');

// @desc    Get employees by division from emp_index_list
// @route   GET /api/mysql-data/emp-index/division/:divisionId
// @access  Private
const getEmployeesByDivisionFromIndex = async (req, res) => {
  let conn;
  try {
    const { divisionId } = req.params;
    const { page = 1, limit = 1000 } = req.query;

    if (!divisionId) {
      return res.status(400).json({
        success: false,
        message: 'Division ID is required'
      });
    }

    conn = await createMySQLConnection();
    const offset = (page - 1) * limit;

    const query = `
      SELECT employee_id, employee_name, division_id, division_name, section_id, section_name, sub_section_id
      FROM emp_index_list
      WHERE division_id = ?
      ORDER BY employee_name ASC
      LIMIT ? OFFSET ?
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM emp_index_list
      WHERE division_id = ?
    `;

    const [rows] = await conn.execute(query, [divisionId, parseInt(limit), parseInt(offset)]);
    const [countRows] = await conn.execute(countQuery, [divisionId]);

    const total = countRows[0].total;
    const employeeIds = rows.map(row => row.employee_id);

    res.status(200).json({
      success: true,
      division: {
        id: divisionId,
        name: rows[0]?.division_name || 'Unknown'
      },
      count: rows.length,
      total: total,
      page: parseInt(page),
      limit: parseInt(limit),
      employeeIds: employeeIds,
      employees: rows,
      source: 'emp_index_list table'
    });

  } catch (error) {
    console.error('[MySQL Emp Index Controller] Get employees by division error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch employees by division',
      error: error.message
    });
  } finally {
    if (conn) await conn.end();
  }
};

// @desc    Get all divisions with employee counts from emp_index_list
// @route   GET /api/mysql-data/emp-index/divisions
// @access  Private
const getDivisionsWithCountsFromIndex = async (req, res) => {
  let conn;
  try {
    conn = await createMySQLConnection();
    const query = `
      SELECT division_id, division_name, COUNT(*) as employee_count
      FROM emp_index_list
      GROUP BY division_id, division_name
      ORDER BY employee_count DESC
    `;

    const [rows] = await conn.execute(query);

    res.status(200).json({
      success: true,
      count: rows.length,
      divisions: rows,
      source: 'emp_index_list table'
    });

  } catch (error) {
    console.error('[MySQL Emp Index Controller] Get divisions with counts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch divisions with counts',
      error: error.message
    });
  } finally {
    if (conn) await conn.end();
  }
};

// @desc    Get IS division employees with today's attendance (first ON, last OFF)
// @route   GET /api/mysql-data/emp-index/division/66/attendance
// @access  Private
const getISEmployeesWithAttendance = async (req, res) => {
  let conn;
  try {
    conn = await createMySQLConnection();
    
    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];
    
    // First get all IS employees
    const empQuery = `
      SELECT employee_id, employee_name, division_id, division_name, section_id, section_name, sub_section_id
      FROM emp_index_list
      WHERE division_id = 66
      ORDER BY employee_name ASC
    `;
    
    const [empRows] = await conn.execute(empQuery);
    
    if (empRows.length === 0) {
      return res.status(200).json({
        success: true,
        date: today,
        employees: [],
        source: 'emp_index_list + attendance'
      });
    }
    
    // Get employee IDs for the query
    const empIds = empRows.map(emp => emp.employee_id);
    
    // Get attendance records for yesterday from attendance table
    const attendanceQuery = `
      SELECT 
        employee_ID as employee_id,
        date_,
        time_ as check_in_time
      FROM attendance 
      WHERE employee_ID IN (${empIds.map(() => '?').join(',')})
        AND date_ = ?
      ORDER BY employee_ID, time_ ASC
    `;
    
    const [attendanceRows] = await conn.execute(attendanceQuery, [...empIds, today]);
    console.log(`Found ${attendanceRows.length} attendance records`);
    
    // Group attendance records by employee ID
    const attendanceByEmployee = {};
    attendanceRows.forEach(record => {
      const empId = String(record.employee_id);
      if (!attendanceByEmployee[empId]) {
        attendanceByEmployee[empId] = [];
      }
      attendanceByEmployee[empId].push({
        date: record.date_,
        time: record.check_in_time
      });
    });
    
    // Create a set of employee IDs that have attendance today
    const presentEmployeeIds = new Set(attendanceRows.map(record => String(record.employee_id)));
    
    // Combine employee data with attendance status and times
    const employeesWithAttendance = empRows.map(emp => {
      const empId = String(emp.employee_id);
      const isPresent = presentEmployeeIds.has(empId);
      
      return {
        employee_id: emp.employee_id,
        employee_name: emp.employee_name,
        section_name: emp.section_name || 'N/A',
        is_present: isPresent,
        attendance_times: attendanceByEmployee[empId] || []
      };
    });
    
    res.status(200).json({
      success: true,
      date: today,
      count: employeesWithAttendance.length,
      employees: employeesWithAttendance,
      source: 'emp_index_list + attendance'
    });

  } catch (error) {
    console.error('[MySQL Emp Index Controller] Get IS employees with attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch IS employees with attendance',
      error: error.message
    });
  } finally {
    if (conn) await conn.end();
  }
};

module.exports = {
  getEmployeesByDivisionFromIndex,
  getDivisionsWithCountsFromIndex,
  getISEmployeesWithAttendance
};