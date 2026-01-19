require('dotenv').config();
const { createMySQLConnection } = require('./config/mysql');

async function testToday() {
  const conn = await createMySQLConnection();
  const today = new Date().toISOString().split('T')[0];

  console.log('Testing for today:', today);

  // Get IS employees
  const empQuery = `SELECT employee_id FROM emp_index_list WHERE division_id = 66`;
  const [empRows] = await conn.execute(empQuery);
  const empIds = empRows.map(emp => emp.employee_id);

  console.log('IS employees found:', empRows.length);

  // Get attendance for today
  const attendanceQuery = `SELECT employee_ID FROM attendance WHERE employee_ID IN (${empIds.map(() => '?').join(',')}) AND date_ = ?`;
  const [attendanceRows] = await conn.execute(attendanceQuery, [...empIds, today]);

  console.log('Attendance records found:', attendanceRows.length);

  // Create present set
  const presentEmployeeIds = new Set(attendanceRows.map(record => String(record.employee_ID)));
  console.log('Present employees:', presentEmployeeIds.size);

  // Check first few employees
  empRows.slice(0, 5).forEach(emp => {
    const isPresent = presentEmployeeIds.has(emp.employee_id);
    console.log(`Employee ${emp.employee_id}: ${isPresent ? 'PRESENT' : 'ABSENT'}`);
  });

  await conn.end();
}

testToday().catch(console.error);