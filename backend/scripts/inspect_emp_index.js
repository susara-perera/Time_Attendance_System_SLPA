const { createMySQLConnection } = require('../config/mysql');

(async () => {
  try {
    const conn = await createMySQLConnection();
    const [rows] = await conn.execute(`SELECT division_id, division_name, COUNT(*) as cnt FROM emp_index_list GROUP BY division_id, division_name ORDER BY cnt DESC LIMIT 20`);
    console.log('Top divisions (by count):');
    rows.forEach(r => console.log(` - division_id: ${r.division_id} | name: ${r.division_name} | count: ${r.cnt}`));

    const [sectionRows] = await conn.execute(`SELECT DISTINCT section_id, section_name FROM emp_index_list ORDER BY section_name LIMIT 20`);
    console.log('\nSample sections:');
    sectionRows.forEach(s => console.log(` - section_id: ${s.section_id} | name: ${s.section_name}`));

    // Show some rows for a specific division name 'Galle'
    const [galleRows] = await conn.execute(`SELECT employee_id, employee_name, division_id, division_name, section_id, section_name, sub_section_id FROM emp_index_list WHERE division_name = ? LIMIT 5`, ['Galle']);
    console.log('\nSample rows for division Galle:');
    console.log(JSON.stringify(galleRows, null, 2));

    await conn.end();
    process.exit(0);
  } catch (err) {
    console.error('Error inspecting emp_index_list:', err.message, err.stack);
    process.exit(1);
  }
})();