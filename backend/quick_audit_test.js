require('dotenv').config();
const mysql = require('mysql2/promise');

async function quickAuditTest() {
  console.log('\n=== QUICK AUDIT TEST FOR EMPLOYEE 448225 ===\n');
  
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'gads71',
    database: process.env.MYSQL_DATABASE || 'slpa_db'
  });
  
  console.log('✅ Connected to database\n');
  
  // Step 1: Run the audit query for the specific date
  console.log('Step 1: Running audit query for 2026-01-26...');
  const [auditRecords] = await conn.execute(`
    SELECT 
      employee_ID,
      date_,
      COUNT(*) as punch_count,
      GROUP_CONCAT(CONCAT(time_, ':', scan_type) ORDER BY time_ SEPARATOR '|') as punches,
      CAST(SUM(CASE 
        WHEN UPPER(scan_type) IN ('IN', 'I', 'ON') THEN 1 
        ELSE 0 
      END) AS SIGNED) as in_count,
      CAST(SUM(CASE 
        WHEN UPPER(scan_type) IN ('OUT', 'O', 'OFF') THEN 1 
        ELSE 0 
      END) AS SIGNED) as out_count
    FROM attendance
    WHERE date_ BETWEEN '2026-01-26' AND '2026-01-26'
    GROUP BY employee_ID, date_
    HAVING in_count >= 1 AND out_count = 0
    ORDER BY date_ DESC, employee_ID ASC
  `);
  
  console.log(`   Found ${auditRecords.length} incomplete punch records (all)`);
  
  // Check if 448225 is in the results
  const emp448225 = auditRecords.find(r => String(r.employee_ID) === '448225');
  if (emp448225) {
    console.log('\n✅✅✅ Employee 448225 IS in audit query results! ✅✅✅');
    console.log(`   Punches: ${emp448225.punches}`);
    console.log(`   IN count: ${emp448225.in_count}`);
    console.log(`   OUT count: ${emp448225.out_count}`);
  } else {
    console.log('\n❌ Employee 448225 NOT in audit query results');
  }
  
  // Step 2: Get employee details for 448225
  console.log('\n\nStep 2: Fetching employee details for 448225...');
  const [empDetails] = await conn.execute(`
    SELECT 
      e.EMP_NO, e.EMP_NAME, e.EMP_NAME_WITH_INITIALS, e.DIV_CODE, e.SEC_CODE, 
      e.EMP_DESIGNATION as designation_name,
      d.HIE_NAME as division_name, s.HIE_NAME_4 as section_name
    FROM employees_sync e
    LEFT JOIN divisions_sync d ON e.DIV_CODE = d.HIE_CODE
    LEFT JOIN sections_sync s ON e.SEC_CODE = s.HIE_CODE
    WHERE e.EMP_NO = '448225'
  `);
  
  if (empDetails.length > 0) {
    const emp = empDetails[0];
    console.log('   ✅ Employee found in employees_sync');
    console.log(`   Name: ${emp.EMP_NAME}`);
    console.log(`   Division: ${emp.division_name} (Code: ${emp.DIV_CODE})`);
    console.log(`   Section: ${emp.section_name} (Code: ${emp.SEC_CODE})`);
    
    // Step 3: Test section filtering
    console.log('\n\nStep 3: Testing section filter...');
    const sectionFilter = 'Information Systems  - ( IS )';
    const divisionFilter = 'Information Systems';
    
    const sectionNameLower = (emp.section_name || '').toLowerCase();
    const sectionFilterLower = sectionFilter.toLowerCase();
    const divisionNameLower = (emp.division_name || '').toLowerCase();
    const divisionFilterLower = divisionFilter.toLowerCase();
    
    console.log(`   Section name (lowercase): "${sectionNameLower}"`);
    console.log(`   Section filter (lowercase): "${sectionFilterLower}"`);
    console.log(`   Includes check: ${sectionNameLower.includes(sectionFilterLower)}`);
    
    console.log(`\n   Division name (lowercase): "${divisionNameLower}"`);
    console.log(`   Division filter (lowercase): "${divisionFilterLower}"`);
    console.log(`   Includes check: ${divisionNameLower.includes(divisionFilterLower)}`);
    
    if (sectionNameLower.includes(sectionFilterLower)) {
      console.log('\n   ✅ Employee PASSES section filter!');
    } else {
      console.log('\n   ❌ Employee FAILS section filter');
    }
    
    if (divisionNameLower.includes(divisionFilterLower)) {
      console.log('   ✅ Employee PASSES division filter!');
    } else {
      console.log('   ❌ Employee FAILS division filter');
    }
  } else {
    console.log('   ❌ Employee NOT found in employees_sync');
  }
  
  // Step 4: Show all IS section employees in audit
  console.log('\n\nStep 4: Finding all IS section employees in audit...');
  const distinctEmployeeIds = [...new Set(auditRecords.map(r => String(r.employee_ID)))];
  
  if (distinctEmployeeIds.length > 0) {
    const placeholders = distinctEmployeeIds.map(() => '?').join(',');
    const [isEmployees] = await conn.execute(`
      SELECT 
        e.EMP_NO, e.EMP_NAME,
        d.HIE_NAME as division_name,
        s.HIE_NAME_4 as section_name
      FROM employees_sync e
      LEFT JOIN divisions_sync d ON e.DIV_CODE = d.HIE_CODE
      LEFT JOIN sections_sync s ON e.SEC_CODE = s.HIE_CODE
      WHERE e.EMP_NO IN (${placeholders})
      AND LOWER(s.HIE_NAME_4) LIKE '%information systems%'
    `, distinctEmployeeIds);
    
    console.log(`   Found ${isEmployees.length} IS section employees in audit results`);
    
    const is448225 = isEmployees.find(e => e.EMP_NO === '448225');
    if (is448225) {
      console.log('\n   ✅✅✅ Employee 448225 IS in filtered IS section list! ✅✅✅');
    } else {
      console.log('\n   ❌ Employee 448225 NOT in filtered IS section list');
      console.log(`   Sample IS employees (first 5):`);
      isEmployees.slice(0, 5).forEach(e => {
        console.log(`      - ${e.EMP_NO}: ${e.EMP_NAME} | ${e.section_name}`);
      });
    }
  }
  
  await conn.end();
  console.log('\n✅ Test complete!\n');
}

quickAuditTest().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
