require('dotenv').config();
const { createMySQLConnection } = require('./config/mysql');

async function testAPI() {
  const conn = await createMySQLConnection();
  const targetDate = '2026-01-19';

  console.log('Testing API for date:', targetDate);

  const empQuery = `SELECT employee_id FROM emp_index_list WHERE division_id = 66`;
  const [empRows] = await conn.execute(empQuery);
  const empIds = empRows.map(emp => emp.employee_id);

  console.log('IS employees found:', empRows.length);

  const attendanceQuery = `SELECT employee_ID, time_ FROM attendance WHERE employee_ID IN (${empIds.map(() => '?').join(',')}) AND date_ = ? ORDER BY employee_ID, time_`;
  const [attendanceRows] = await conn.execute(attendanceQuery, [...empIds, targetDate]);

  console.log('Attendance records found:', attendanceRows.length);

  if (attendanceRows.length > 0) {
    console.log('Sample records:');
    attendanceRows.slice(0, 10).forEach(row => {
      console.log(`Employee ${row.employee_ID}: ${row.time_}`);
    });

    // Group by employee to see how many punches per employee
    const punchesByEmployee = {};
    attendanceRows.forEach(row => {
      if (!punchesByEmployee[row.employee_ID]) {
        punchesByEmployee[row.employee_ID] = [];
      }
      punchesByEmployee[row.employee_ID].push(row.time_);
    });

    console.log('Punches per employee (first 5):');
    Object.keys(punchesByEmployee).slice(0, 5).forEach(empId => {
      console.log(`Employee ${empId}: ${punchesByEmployee[empId].length} punches - [${punchesByEmployee[empId].join(', ')}]`);
    });
  }

  await conn.end();
}

testAPI().catch(console.error);