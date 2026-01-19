require('dotenv').config();
const { createMySQLConnection } = require('./config/mysql');

async function testAttendanceAPI() {
  let conn;
  try {
    conn = await createMySQLConnection();

    // Get yesterday's date in YYYY-MM-DD format
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    console.log('Querying for date:', yesterdayStr);

    // First get all IS employees
    const empQuery = `
      SELECT employee_id, employee_name, division_id, division_name, section_id, section_name, sub_section_id
      FROM emp_index_list
      WHERE division_id = 66
      ORDER BY employee_name ASC
    `;

    const [empRows] = await conn.execute(empQuery);
    console.log(`Found ${empRows.length} IS employees`);
    console.log('Sample empRows:', empRows.slice(0, 2).map(e => ({ id: e.employee_id, type: typeof e.employee_id })));

    if (empRows.length === 0) {
      console.log('No IS employees found');
      return;
    }

    // Get employee IDs for the query
    const empIds = empRows.map(emp => emp.employee_id);
    
    // First check what dates are available in attendance table
    const dateCheckQuery = `
      SELECT DISTINCT date_ as attendance_date, COUNT(*) as record_count
      FROM attendance 
      GROUP BY date_
      ORDER BY date_ DESC
      LIMIT 5
    `;
    
    const [dateRows] = await conn.execute(dateCheckQuery);
    console.log('Available attendance dates:', dateRows);

    // Get attendance records for today from attendance table
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

    const [attendanceRows] = await conn.execute(attendanceQuery, [...empIds, yesterdayStr]);
    console.log(`Found ${attendanceRows.length} attendance records for today`);
    console.log('Sample attendanceRows:', attendanceRows.slice(0, 2).map(a => ({ id: a.employee_id, type: typeof a.employee_id })));

    if (attendanceRows.length > 0) {
      console.log('Sample attendance record:', attendanceRows[0]);
    }

    // Process attendance data - group by employee and find first and last punch
    const attendanceMap = new Map();

    attendanceRows.forEach(record => {
      const empId = String(record.employee_id); // Convert to string to match emp_index_list
      if (!attendanceMap.has(empId)) {
        attendanceMap.set(empId, {
          punches: []
        });
      }
      
      const empAttendance = attendanceMap.get(empId);
      empAttendance.punches.push(record.check_in_time);
    });

    // For each employee, sort punches and take first as ON time, last as OFF time
    attendanceMap.forEach((attendance, empId) => {
      attendance.punches.sort(); // Sort times ascending
      attendance.onTime = attendance.punches[0] || null; // First punch
      attendance.offTime = attendance.punches.length > 1 ? attendance.punches[attendance.punches.length - 1] : null; // Last punch (only if more than one punch)
    });

    // Combine employee data with attendance
    const employeesWithAttendance = empRows.map(emp => {
      const attendance = attendanceMap.get(emp.employee_id) || { onTime: null, offTime: null };

      return {
        employee_id: emp.employee_id,
        employee_name: emp.employee_name,
        section_name: emp.section_name || 'N/A',
        on_time: attendance.onTime,
        off_time: attendance.offTime,
        has_attendance: !!(attendance.onTime || attendance.offTime)
      };
    });

    console.log('Sample result:', employeesWithAttendance.slice(0, 3));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (conn) await conn.end();
  }
}

testAttendanceAPI();