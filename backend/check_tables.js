const mysql = require('mysql2/promise');

async function checkTables() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: 'gads71',
    database: 'slpa_db'
  });

  const [tables] = await conn.execute(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA='slpa_db' AND TABLE_NAME LIKE '%attend%'"
  );
  
  console.log('Tables containing attend:', tables.map(t => t.TABLE_NAME));

  // Check columns in attendance table
  const [columns] = await conn.execute('DESCRIBE attendance');
  console.log('\nAttendance table columns:');
  columns.forEach(col => {
    console.log(`  - ${col.Field} (${col.Type})`);
  });

  await conn.end();
}

checkTables().catch(console.error);
