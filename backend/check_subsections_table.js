require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
  try {
    const conn = await mysql.createConnection({
      host: '127.0.0.1',
      port: 3306,
      user: 'root',
      password: 'gads71',
      database: 'slpa_db'
    });
    
    const [tables] = await conn.query('SHOW TABLES');
    const subTables = tables.map(t => Object.values(t)[0]).filter(n => n.toLowerCase().includes('sub'));
    console.log('Subsection-related tables:', subTables.join(', '));
    
    // Check subsections table structure if it exists
    if (subTables.includes('subsections')) {
      const [cols] = await conn.query('DESCRIBE subsections');
      console.log('\nsubsections table columns:');
      cols.forEach(c => console.log(`  - ${c.Field} (${c.Type})`));
      
      const [[count]] = await conn.query('SELECT COUNT(*) as count FROM subsections');
      console.log(`\nTotal subsections: ${count.count}`);
    }
    
    await conn.end();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
