const { createMySQLConnection } = require('../config/mysql');

(async () => {
  const conn = await createMySQLConnection();
  try {
    const [rows] = await conn.execute('SELECT COUNT(*) as cnt, MIN(attendance_date) as minDate, MAX(attendance_date) as maxDate FROM attendance_sync');
    console.log('attendance_sync stats:', rows[0]);

    const [sample] = await conn.execute('SELECT * FROM attendance_sync LIMIT 5');
    console.log('Sample rows:', sample);
  } catch (err) {
    console.error('Error querying attendance_sync:', err.message);
  } finally {
    await conn.end();
  }
})();