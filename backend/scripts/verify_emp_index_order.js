require('dotenv').config();
const mysql = require('mysql2/promise');

async function verifyEmpIndexOrder() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: 'gads71',
    database: 'slpa_db'
  });

  try {
    // Check first 10 records by ID order (should be sorted by division_id)
    const [rows] = await conn.execute('SELECT id, division_id, division_name, employee_id FROM emp_index_list ORDER BY id LIMIT 10');

    console.log('First 10 emp_index_list records (ordered by AUTO_INCREMENT id):');
    rows.forEach((r, i) => {
      console.log(`${i + 1}. ID=${r.id} | DIV ${r.division_id} (${r.division_name}) | EMP ${r.employee_id}`);
    });

    // Check division distribution
    const [divStats] = await conn.execute(`
      SELECT division_id, division_name, COUNT(*) as emp_count
      FROM emp_index_list
      GROUP BY division_id, division_name
      ORDER BY CAST(division_id AS UNSIGNED)
      LIMIT 10
    `);

    console.log('\nDivision distribution (first 10 divisions):');
    divStats.forEach(r => {
      console.log(`DIV ${r.division_id} (${r.division_name}): ${r.emp_count} employees`);
    });

    // Verify order is correct
    const [orderCheck] = await conn.execute(`
      SELECT COUNT(*) as total, COUNT(CASE WHEN id = expected_order THEN 1 END) as correct_order
      FROM (
        SELECT id, ROW_NUMBER() OVER (ORDER BY CAST(division_id AS UNSIGNED), employee_id) as expected_order
        FROM emp_index_list
      ) t
    `);

    const isOrdered = orderCheck[0].correct_order === orderCheck[0].total;
    console.log(`\n${isOrdered ? '✅' : '⚠️'} Order verification: ${orderCheck[0].correct_order}/${orderCheck[0].total} records in correct division_id order`);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await conn.end();
  }
}

verifyEmpIndexOrder();