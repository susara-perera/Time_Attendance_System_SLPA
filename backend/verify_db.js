/**
 * Quick verification of database changes
 */

require('dotenv').config();

const mysql = require('mysql2/promise');

const verify = async () => {
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST || 'localhost',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'slpa_db'
  });

  try {
    // Check columns
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME, DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'total_count_dashboard'
      AND TABLE_SCHEMA = DATABASE()
    `);

    console.log('✅ Dashboard table columns:');
    columns.forEach(col => console.log(`   ${col.COLUMN_NAME}: ${col.DATA_TYPE}`));

    // Check data
    const [data] = await connection.execute(`
      SELECT id, totalDivisions, totalSections, monthly_trend_data, annual_trend_data, last_updated
      FROM total_count_dashboard LIMIT 1
    `);

    console.log('\n✅ Dashboard table data:');
    if (data.length > 0) {
      console.log('   Row exists:', data[0].id);
      console.log('   Monthly trends:', data[0].monthly_trend_data ? 'JSON column ready' : 'NULL');
      console.log('   Annual trends:', data[0].annual_trend_data ? 'JSON column ready' : 'NULL');
    }

  } finally {
    await connection.end();
  }
};

verify().catch(err => console.error('❌ Error:', err.message));
