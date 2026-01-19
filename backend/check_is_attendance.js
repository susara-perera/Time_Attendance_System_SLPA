require('dotenv').config();
const { createMySQLConnection } = require('./config/mysql');

async function checkISEmployees() {
  const conn = await createMySQLConnection();

  // Get IS employees
  const empQuery = `SELECT employee_id, employee_name FROM emp_index_list WHERE division_id = 66 LIMIT 10`;
  const [empRows] = await conn.execute(empQuery);

  console.log('First 10 IS employees:');
  empRows.forEach(row => console.log(`${row.employee_id} (${typeof row.employee_id}): ${row.employee_name}`));

  // Check if any of these have attendance on 2026-01-19
  const empIds = empRows.map(emp => emp.employee_id);
  const attendanceQuery = `SELECT employee_ID, time_ FROM attendance WHERE employee_ID IN (${empIds.map(() => '?').join(',')}) AND date_ = '2026-01-19'`;
  const [attendanceRows] = await conn.execute(attendanceQuery, empIds);

  console.log(`Attendance records for these employees on 2026-01-19: ${attendanceRows.length}`);
  if (attendanceRows.length > 0) {
    attendanceRows.slice(0, 5).forEach(row => console.log(`Employee ${row.employee_ID}: ${row.time_}`));
  }

  await conn.end();
}

checkISEmployees().catch(console.error);