require('dotenv').config();
const mysql = require('mysql2/promise');

async function checkDashboardTable() {
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || 'localhost',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'gads71',
    database: process.env.MYSQL_DATABASE || 'slpa_db'
  });

  try {
    console.log('🔍 Checking total_count_dashboard table...\n');
    
    // Show table structure
    const [columns] = await conn.execute('DESCRIBE total_count_dashboard');
    console.log('📋 Table Structure:');
    console.log('='.repeat(80));
    columns.forEach(col => {
      console.log(`  ${col.Field.padEnd(30)} ${col.Type.padEnd(20)} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    
    // Show current data
    const [rows] = await conn.execute('SELECT * FROM total_count_dashboard');
    console.log('\n📊 Current Data:');
    console.log('='.repeat(80));
    if (rows.length === 0) {
      console.log('  ⚠️  No data in table');
    } else {
      rows.forEach((row, idx) => {
        console.log(`\nRow ${idx + 1}:`);
        Object.entries(row).forEach(([key, value]) => {
          console.log(`  ${key}: ${value}`);
        });
      });
    }
    
    console.log('\n✅ Check complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await conn.end();
    process.exit(0);
  }
}

checkDashboardTable();
