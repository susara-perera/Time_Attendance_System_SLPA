require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function createTables() {
  try {
    // Create connection
    const connection = await mysql.createConnection({
      host: process.env.MYSQL_HOST || 'localhost',
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'slpa_db',
      multipleStatements: true
    });

    console.log('✅ Connected to MySQL');

    // Read SQL file
    const sqlPath = path.join(__dirname, 'config', 'createSyncTables.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('📄 Executing SQL statements...');

    // Execute SQL
    await connection.query(sql);

    console.log('✅ Tables created successfully!');
    
    // Verify tables exist
    const [tables] = await connection.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = '${process.env.MYSQL_DATABASE || 'slpa_db'}' 
      AND TABLE_NAME LIKE '%_sync%'
    `);

    console.log('\n📊 Sync tables in database:');
    tables.forEach(t => console.log(`  - ${t.TABLE_NAME}`));

    await connection.end();
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createTables();
