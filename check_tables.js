const mysql = require('mysql2/promise');

async function listTables() {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'slpa_db'
    });

    const [rows] = await connection.execute('SHOW TABLES');
    console.log('Tables in slpa_db:');
    rows.forEach(row => {
      console.log(Object.values(row)[0]);
    });

    await connection.end();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

listTables();