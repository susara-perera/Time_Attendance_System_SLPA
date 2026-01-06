require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

(async () => {
  try {
    const conn = await mysql.createConnection({
      host: process.env.MYSQL_HOST || 'localhost',
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'slpa_db'
    });

    console.log('Dropping existing table...');
    await conn.query('DROP TABLE IF EXISTS total_count_dashboard');

    console.log('Creating new table...');
    const sql = fs.readFileSync(path.join(__dirname, 'config', 'createDashboardTable.sql'), 'utf8');
    await conn.query(sql);

    console.log('✅ Table created successfully\n');

    const [cols] = await conn.query('DESC total_count_dashboard');
    console.log('Table structure:');
    cols.forEach(c => console.log(`  ${c.Field} - ${c.Type}`));

    await conn.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
