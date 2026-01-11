/**
 * Recreate emp_index_list table with ascending order by division_id
 *
 * This script:
 * 1. Drops the existing emp_index_list table
 * 2. Recreates it with fresh structure
 * 3. Re-syncs data from divisions_sync, sections_sync, employees_sync
 * 4. Sorts employees by division_id (numerical ascending) before inserting
 *
 * This ensures optimal InnoDB clustering for fast hierarchical queries.
 */

require('dotenv').config();
const { createMySQLConnection } = require('../config/mysql');
const moment = require('moment');

async function recreateEmpIndexOrdered() {
  const conn = await createMySQLConnection();

  try {
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║     🔄 RECREATE EMP_INDEX_LIST WITH ASCENDING ORDER          ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    // Step 1: Drop existing table
    console.log('🗑️  Dropping emp_index_list table...');
    await conn.execute('DROP TABLE IF EXISTS emp_index_list');
    console.log('   ✅ Dropped');

    // Step 2: Recreate table
    console.log('\n📋 Creating fresh emp_index_list table...');
    await conn.execute(`
      CREATE TABLE emp_index_list (
        id INT AUTO_INCREMENT PRIMARY KEY,
        division_id VARCHAR(50) NOT NULL,
        division_name VARCHAR(255) DEFAULT NULL,
        section_id VARCHAR(50) DEFAULT NULL,
        section_name VARCHAR(255) DEFAULT NULL,
        sub_section_id VARCHAR(50) DEFAULT NULL,
        employee_id VARCHAR(100) NOT NULL,
        employee_name VARCHAR(255) DEFAULT NULL,
        synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_emp_index (division_id, section_id, sub_section_id, employee_id),
        INDEX idx_division (division_id),
        INDEX idx_section (section_id),
        INDEX idx_sub_section (sub_section_id),
        INDEX idx_employee (employee_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('   ✅ Created with optimized indexes');

    // Step 3: Fetch data from sync tables
    console.log('\n📊 Fetching data from sync tables...');

    // Fetch divisions
    const [divisions] = await conn.execute('SELECT HIE_CODE AS division_id, HIE_NAME AS division_name FROM divisions_sync');
    console.log(`   📊 Found ${divisions.length} divisions`);

    // Fetch sections
    const [sections] = await conn.execute('SELECT HIE_CODE AS section_id, HIE_NAME AS section_name, HIE_RELATIONSHIP AS division_id FROM sections_sync');
    console.log(`   📊 Found ${sections.length} sections`);

    // Fetch subsections
    const [subsections] = await conn.execute('SELECT id AS sub_section_id, sub_section_name AS sub_section_name, section_code AS section_id, division_code FROM sub_sections');
    console.log(`   📊 Found ${subsections.length} subsections`);

    // Fetch transferred employees
    const [transfers] = await conn.execute('SELECT employee_id, sub_section_id FROM transferred_employees WHERE transferred_status = 1');
    const transferMap = new Map();
    transfers.forEach(t => transferMap.set(String(t.employee_id), String(t.sub_section_id)));
    console.log(`   📊 Found ${transfers.length} active transfers`);

    // Fetch employees and SORT BY DIVISION_ID (numerical ascending)
    const [employees] = await conn.execute(`
      SELECT EMP_NO AS employee_id, EMP_NAME AS employee_name, DIV_CODE AS division_id, SEC_CODE AS section_id
      FROM employees_sync
      WHERE IS_ACTIVE = 1
      ORDER BY CAST(DIV_CODE AS UNSIGNED) ASC, EMP_NO ASC
    `);
    console.log(`   📊 Found ${employees.length} active employees (sorted by division_id numerically)`);

    // Build lookup maps
    const divisionMap = new Map();
    divisions.forEach(d => divisionMap.set(String(d.division_id), d.division_name || null));

    const sectionMap = new Map();
    sections.forEach(s => sectionMap.set(String(s.section_id), { name: s.section_name || null, division_id: s.division_id || null }));

    const subMap = new Map();
    subsections.forEach(ss => subMap.set(String(ss.sub_section_id), { section_id: ss.section_id || null, division_code: ss.division_code || null, name: ss.sub_section_name || null }));

    // Step 4: Insert data in sorted order
    console.log('\n🔄 Inserting employee index records in ascending order by division_id...');

    let inserted = 0;
    let skipped = 0;
    const now = moment().format('YYYY-MM-DD HH:mm:ss');

    for (const emp of employees) {
      const empId = String(emp.employee_id);
      const empName = emp.employee_name || null;
      const divId = String(emp.division_id || '').trim();
      const secId = String(emp.section_id || '').trim();

      // Skip employees without division_id
      if (!divId) {
        skipped++;
        continue;
      }

      const divName = divisionMap.get(divId) || null;
      const secName = sectionMap.get(secId)?.name || null;

      // Check for active transfer
      const transferredSubId = transferMap.get(empId) || null;
      const subName = transferredSubId ? (subMap.get(transferredSubId)?.name || null) : null;

      // Insert new row (no duplicates check since table is fresh)
      await conn.execute(`
        INSERT INTO emp_index_list (division_id, division_name, section_id, section_name, sub_section_id, employee_id, employee_name, synced_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [divId, divName, secId || null, secName, transferredSubId, empId, empName, now]);

      inserted++;
    }

    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║                    ✅ SYNC COMPLETE                           ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');

    console.log('\n📊 Summary:');
    console.log(`   Divisions:  ${divisions.length} loaded`);
    console.log(`   Sections:   ${sections.length} loaded`);
    console.log(`   Employees:  ${inserted} inserted (${skipped} skipped - no division)`);
    console.log(`   Transfers:  ${transfers.length} active transfers applied`);

    console.log('\n✅ emp_index_list table now optimized with:');
    console.log('   • Data sorted by division_id (numerical ascending)');
    console.log('   • InnoDB clustered index optimization');
    console.log('   • Fast hierarchical queries');

    // Verify first few records
    console.log('\n🔍 Verification - First 10 records:');
    const [sample] = await conn.execute('SELECT division_id, division_name, employee_id, employee_name FROM emp_index_list ORDER BY id LIMIT 10');
    sample.forEach((row, i) => {
      console.log(`   ${i + 1}. DIV ${row.division_id} (${row.division_name}) - ${row.employee_id} (${row.employee_name})`);
    });

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await conn.end();
  }
}

recreateEmpIndexOrdered();