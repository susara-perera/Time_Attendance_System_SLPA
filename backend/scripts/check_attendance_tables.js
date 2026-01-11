require('dotenv').config();
const mysql = require('mysql2/promise');

async function checkAttendanceTables() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: 'gads71',
    database: 'slpa_db'
  });

  try {
    const [tables] = await conn.execute("SHOW TABLES LIKE '%attendance%'");
    console.log('Attendance tables in slpa_db:');
    tables.forEach(t => console.log('  -', Object.values(t)[0]));

    if (tables.length > 0) {
      // Check first attendance table structure
      const tableName = Object.values(tables[0])[0];
      const [columns] = await conn.execute(`DESCRIBE ${tableName}`);
      console.log(`\nStructure of ${tableName}:`);
      columns.forEach(c => console.log(`  ${c.Field} (${c.Type})`));
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await conn.end();
  }
}

checkAttendanceTables();