
const mysql = require('mysql2/promise');

async function check() {
  try {
    const c = await mysql.createConnection({
      host: '127.0.0.1', user: 'root', password: 'gads71', database: 'slpa_db'
    });
    
    console.log('Connected.');

    try {
        const [desc] = await c.query('DESCRIBE optimized_attendance');
        console.log('\n--- optimized_attendance ---');
        console.table(desc);
    } catch(e) { console.log('optimized_attendance table error:', e.message); }

    const [idx] = await c.query('SHOW INDEX FROM attendance');
    console.log('\n--- attendance indexes ---');
    console.table(idx);

    c.end();
  } catch(e) { console.error('Error:', e); }
}
check();
