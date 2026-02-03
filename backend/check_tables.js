const mysql = require('mysql2/promise');

async function checkTables() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: 'gads71',
    database: 'slpa_db'
  });

  const [tables] = await conn.execute(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA='slpa_db'"
  );
  
  console.log('All tables in slpa_db:');
  tables.forEach(t => {
    console.log(`  - ${t.TABLE_NAME}`);
  });

  await conn.end();
}

checkTables().catch(console.error);
