const { createMySQLConnection } = require('./config/mysql');

async function checkData() {
  let conn;
  try {
    conn = await createMySQLConnection();

    console.log('🔍 Checking database data...\n');

    // Check section 333
    const [sectionCount] = await conn.execute(
      'SELECT COUNT(*) as count FROM emp_ids_by_sections WHERE section_id = ?',
      ['333']
    );
    console.log(`👥 Employees in section 333: ${sectionCount[0].count}`);

    // Check division 66
    const [divisionCount] = await conn.execute(
      'SELECT COUNT(*) as count FROM emp_ids_by_divisions WHERE division_id = ?',
      ['66']
    );
    console.log(`🏢 Employees in division 66: ${divisionCount[0].count}`);

    // Check attendance data
    const [attendanceCount] = await conn.execute(
      'SELECT COUNT(*) as count FROM attendance WHERE date_ BETWEEN ? AND ?',
      ['2024-12-01', '2024-12-05']
    );
    console.log(`📅 Attendance records (Dec 1-5, 2024): ${attendanceCount[0].count}`);

    // Check if there are any incomplete punches
    const [incompleteCount] = await conn.execute(`
      SELECT COUNT(*) as total_incomplete FROM (
        SELECT employee_ID, date_, COUNT(*) as punches
        FROM attendance
        WHERE date_ BETWEEN '2024-12-01' AND '2024-12-05'
        GROUP BY employee_ID, date_
        HAVING COUNT(*) = 1
      ) as incomplete
    `);
    console.log(`⚠️  Incomplete punches (Dec 1-5, 2024): ${incompleteCount[0].total_incomplete}`);

    // Check audit_sync table
    const [auditCount] = await conn.execute('SELECT COUNT(*) as count FROM audit_sync');
    console.log(`📊 Records in audit_sync table: ${auditCount[0].count}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (conn) await conn.end();
  }
}

checkData();