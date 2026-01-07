require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
  try {
    const conn = await mysql.createConnection({
      host: process.env.MYSQL_HOST || 'localhost',
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'slpa_db'
    });

    const [rows] = await conn.query(
      `SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'attendance'`,
      [process.env.MYSQL_DATABASE || 'slpa_db']
    );

    if (rows.length === 0) {
      console.log('Table `attendance` not found in database.');
    } else {
      console.log('Columns in `attendance`:');
      rows.forEach(r => console.log(` - ${r.COLUMN_NAME} : ${r.DATA_TYPE} (${r.COLUMN_TYPE})`));
    }

    await conn.end();
    process.exit(0);
  } catch (err) {
    console.error('Error describing attendance table:', err.message);
    process.exit(1);
  }
})();