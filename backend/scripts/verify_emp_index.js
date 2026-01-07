/**
 * Verify emp_index_list table data
 * 
 * This script queries the emp_index_list table to verify the sync worked correctly
 * and shows sample data from the table.
 */

const { createMySQLConnection } = require('../config/mysql');

const verify = async () => {
  const conn = await createMySQLConnection();
  
  try {
    console.log('🔍 Verifying emp_index_list table...\n');
    
    // Count total records
    const [countResult] = await conn.execute('SELECT COUNT(*) as total FROM emp_index_list');
    console.log(`📊 Total records: ${countResult[0].total}`);
    
    // Count by division
    const [divCounts] = await conn.execute(`
      SELECT division_id, division_name, COUNT(*) as employee_count 
      FROM emp_index_list 
      GROUP BY division_id, division_name 
      ORDER BY employee_count DESC 
      LIMIT 10
    `);
    console.log('\n📈 Top 10 divisions by employee count:');
    divCounts.forEach(row => {
      console.log(`   ${row.division_id} - ${row.division_name}: ${row.employee_count} employees`);
    });
    
    // Count by section
    const [secCounts] = await conn.execute(`
      SELECT section_id, section_name, COUNT(*) as employee_count 
      FROM emp_index_list 
      WHERE section_id IS NOT NULL
      GROUP BY section_id, section_name 
      ORDER BY employee_count DESC 
      LIMIT 10
    `);
    console.log('\n📈 Top 10 sections by employee count:');
    secCounts.forEach(row => {
      console.log(`   ${row.section_id} - ${row.section_name}: ${row.employee_count} employees`);
    });
    
    // Show sample records
    const [samples] = await conn.execute(`
      SELECT * FROM emp_index_list LIMIT 5
    `);
    console.log('\n📝 Sample records:');
    samples.forEach((row, i) => {
      console.log(`\n   Record ${i + 1}:`);
      console.log(`      Employee: ${row.employee_id} - ${row.employee_name}`);
      console.log(`      Division: ${row.division_id} - ${row.division_name}`);
      console.log(`      Section: ${row.section_id || 'N/A'} - ${row.section_name || 'N/A'}`);
      console.log(`      Sub-section: ${row.sub_section_id || 'N/A'}`);
      console.log(`      Synced at: ${row.synced_at}`);
    });
    
    // Check for any employees without division or section
    const [noDivision] = await conn.execute('SELECT COUNT(*) as count FROM emp_index_list WHERE division_id IS NULL');
    const [noSection] = await conn.execute('SELECT COUNT(*) as count FROM emp_index_list WHERE section_id IS NULL');
    console.log('\n⚠️  Data quality:');
    console.log(`   Employees without division: ${noDivision[0].count}`);
    console.log(`   Employees without section: ${noSection[0].count}`);
    
    console.log('\n✅ Verification complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await conn.end();
  }
};

verify()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
