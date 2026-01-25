require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function createRecentActivitiesTable() {
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
    const sqlPath = path.join(__dirname, 'config', 'createRecentActivitiesTable.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('📄 Executing SQL statements...');

    // Execute SQL
    await connection.query(sql);

    console.log('✅ Recent activities table created successfully!');

    // Verify table exists
    const [tables] = await connection.query(`
      SELECT TABLE_NAME
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = '${process.env.MYSQL_DATABASE || 'slpa_db'}'
      AND TABLE_NAME = 'recent_activities'
    `);

    if (tables.length > 0) {
      console.log('✅ Table verified: recent_activities');

      // Show table structure
      const [columns] = await connection.query('DESCRIBE recent_activities');
      console.log('\n📊 Table structure:');
      columns.forEach(col => console.log(`  ${col.Field} - ${col.Type}`));
    } else {
      console.log('❌ Table creation failed - table not found');
    }

    await connection.end();
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createRecentActivitiesTable();