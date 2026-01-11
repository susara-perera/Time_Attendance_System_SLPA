const mysql = require('mysql2/promise');

async function checkSchema() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: 'gads71',
    database: 'slpa_db'
  });

  const [columns] = await conn.execute('DESCRIBE attendance');
  console.log('Attendance table columns:');
  columns.forEach(col => {
    console.log(`  - ${col.Field} (${col.Type})`);
  });

  await conn.end();
}

checkSchema().catch(console.error);
