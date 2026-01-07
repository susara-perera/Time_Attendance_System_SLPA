const { createMySQLConnection } = require('../config/mysql');

(async () => {
  const conn = await createMySQLConnection();
  try {
    const inserts = [];
    const employees = ['557736', '557314'];
    const dates = ['2026-01-02','2026-01-03'];

    for (const emp of employees) {
      for (const d of dates) {
        const first = `${d} 08:15:00`;
        const last = `${d} 17:10:00`;
        inserts.push([emp, `Sample ${emp}`, emp, 'DIV_CODE', 'Division Name', 'SEC_CODE', 'Section Name', d, first, last, 2, 'present', 8.90, 1, 'MYSQL']);
      }
    }

    const sql = `INSERT INTO attendance_sync (
      employee_id, employee_name, employee_number, division_code, division_name, section_code, section_name,
      attendance_date, first_punch_time, last_punch_time, total_punch_count, status, working_hours, is_active, data_source
    ) VALUES ?`;

    const [result] = await conn.query(sql, [inserts]);
    console.log('Inserted rows:', result.affectedRows);
  } catch (err) {
    console.error('Seed error:', err.message);
  } finally {
    await conn.end();
  }
})();