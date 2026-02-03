require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'gads71',
    database: process.env.MYSQL_DATABASE || 'slpa_db'
  });
  
  console.log('Checking employee 448225 scan types...\n');
  
  const [raw] = await conn.execute(`
    SELECT time_, scan_type, UPPER(scan_type) as upper_scan
    FROM attendance
    WHERE date_ = '2026-01-26' AND employee_ID = '448225'
    ORDER BY time_
  `);
  
  console.log('Raw scan types:');
  raw.forEach(r => {
    console.log(`  ${r.time_}: scan_type="${r.scan_type}", UPPER="${r.upper_scan}"`);
    const isIn = ['IN', 'I', 'ON'].includes(r.upper_scan);
    const isOut = ['OUT', 'O', 'OFF'].includes(r.upper_scan);
    console.log(`    isIN: ${isIn}, isOUT: ${isOut}`);
  });
  
  const [result] = await conn.execute(`
    SELECT 
      employee_ID, date_,
      GROUP_CONCAT(CONCAT(time_, ':', scan_type) ORDER BY time_ SEPARATOR '|') as punches,
      CAST(SUM(CASE WHEN UPPER(scan_type) IN ('IN', 'I', 'ON') THEN 1 ELSE 0 END) AS SIGNED) as in_count,
      CAST(SUM(CASE WHEN UPPER(scan_type) IN ('OUT', 'O', 'OFF') THEN 1 ELSE 0 END) AS SIGNED) as out_count
    FROM attendance
    WHERE date_ = '2026-01-26' AND employee_ID = '448225'
    GROUP BY employee_ID, date_
    HAVING in_count >= 1 AND out_count = 0
  `);
  
  console.log('\nGrouped result:');
  console.log(result);
  
  if (result.length > 0) {
    console.log(`\nIN count: ${result[0].in_count} | OUT count: ${result[0].out_count}`);
    console.log(`Passes HAVING (in_count >= 1 AND out_count = 0): ${result[0].in_count >= 1 && result[0].out_count === 0}`);
  } else {
    console.log('\nNO RECORDS FOUND');
  }
  
  await conn.end();
})().catch(console.error);
