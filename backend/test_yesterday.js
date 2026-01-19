require('dotenv').config();
const { createMySQLConnection } = require('./config/mysql');

async function testAPI() {
  const conn = await createMySQLConnection();

  // Get yesterday's date
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  console.log('Testing API for date:', yesterdayStr);

  // Get IS employees
  const empQuery = `SELECT employee_id FROM emp_index_list WHERE division_id = 66`;
  const [empRows] = await conn.execute(empQuery);
  const empIds = empRows.map(emp => emp.employee_id);

  console.log('IS employees found:', empRows.length);

  // Get attendance for yesterday
  const attendanceQuery = `SELECT employee_ID, time_ FROM attendance WHERE employee_ID IN (${empIds.map(() => '?').join(',')}) AND date_ = ? ORDER BY employee_ID, time_`;
  const [attendanceRows] = await conn.execute(attendanceQuery, [...empIds, yesterdayStr]);

  console.log('Attendance records found:', attendanceRows.length);

  if (attendanceRows.length > 0) {
    console.log('Sample records:');
    attendanceRows.slice(0, 5).forEach(row => {
      console.log(`Employee ${row.employee_ID}: ${row.time_}`);
    });
  }

  await conn.end();
}

testAPI().catch(console.error);