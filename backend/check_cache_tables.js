require('dotenv').config();
const mysql = require('mysql2/promise');

async function checkTables() {
  try {
    const conn = await mysql.createConnection({
      host: process.env.MYSQL_HOST,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE
    });

    const [rows] = await conn.execute('SHOW TABLES LIKE "cache_%"');
    console.log('Cache tables found:', rows.map(r => Object.values(r)[0]));

    // Check specifically for cache_sync_log
    const [syncLog] = await conn.execute('SHOW TABLES LIKE "cache_sync_log"');
    console.log('cache_sync_log exists:', syncLog.length > 0);

    conn.end();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkTables();