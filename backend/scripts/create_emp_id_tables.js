/**
 * Create Optimized Employee ID Lookup Tables
 * 
 * Creates 3 denormalized tables for ultra-fast employee ID lookups:
 * 1. emp_ids_by_divisions - Employee IDs grouped by division only
 * 2. emp_ids_by_sections - Employee IDs grouped by section only
 * 3. emp_ids_by_subsections - Employee IDs grouped by subsection only
 * 
 * Each table contains ONLY data for its level (no parent hierarchy duplication)
 * Data is stored in ascending order by ID for optimal InnoDB clustering
 * 
 * Usage in Reports:
 * - User selects only division → use emp_ids_by_divisions
 * - User selects division + section → use emp_ids_by_sections
 * - User selects division + section + subsection → use emp_ids_by_subsections
 */

require('dotenv').config();
const { createMySQLConnection } = require('../config/mysql');
const moment = require('moment');

async function createEmpIdTables() {
  const conn = await createMySQLConnection();

  try {
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║     🔄 CREATE EMPLOYEE ID LOOKUP TABLES                      ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    // ========================================
    // TABLE 1: emp_ids_by_divisions
    // ========================================
    console.log('📋 Creating emp_ids_by_divisions table...');
    await conn.execute('DROP TABLE IF EXISTS emp_ids_by_divisions');
    await conn.execute(`
      CREATE TABLE emp_ids_by_divisions (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        division_id VARCHAR(50) NOT NULL,
        division_name VARCHAR(255) DEFAULT NULL,
        employee_id VARCHAR(100) NOT NULL,
        employee_name VARCHAR(255) DEFAULT NULL,
        synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_division (division_id),
        INDEX idx_employee (employee_id),
        INDEX idx_composite (division_id, employee_id),
        UNIQUE KEY unique_div_emp (division_id, employee_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT='Employee IDs by Division - for division-only filters'
    `);
    console.log('   ✅ emp_ids_by_divisions created');

    // ========================================
    // TABLE 2: emp_ids_by_sections
    // ========================================
    console.log('📋 Creating emp_ids_by_sections table...');
    await conn.execute('DROP TABLE IF EXISTS emp_ids_by_sections');
    await conn.execute(`
      CREATE TABLE emp_ids_by_sections (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        division_id VARCHAR(50) NOT NULL,
        section_id VARCHAR(50) NOT NULL,
        section_name VARCHAR(255) DEFAULT NULL,
        employee_id VARCHAR(100) NOT NULL,
        employee_name VARCHAR(255) DEFAULT NULL,
        synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_section (section_id),
        INDEX idx_division (division_id),
        INDEX idx_employee (employee_id),
        INDEX idx_composite (division_id, section_id, employee_id),
        UNIQUE KEY unique_sec_emp (division_id, section_id, employee_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT='Employee IDs by Section - for division+section filters'
    `);
    console.log('   ✅ emp_ids_by_sections created');

    // ========================================
    // TABLE 3: emp_ids_by_subsections
    // ========================================
    console.log('📋 Creating emp_ids_by_subsections table...');
    await conn.execute('DROP TABLE IF EXISTS emp_ids_by_subsections');
    await conn.execute(`
      CREATE TABLE emp_ids_by_subsections (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        division_id VARCHAR(50) NOT NULL,
        section_id VARCHAR(50) NOT NULL,
        sub_section_id VARCHAR(50) NOT NULL,
        sub_section_name VARCHAR(255) DEFAULT NULL,
        employee_id VARCHAR(100) NOT NULL,
        employee_name VARCHAR(255) DEFAULT NULL,
        synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_subsection (sub_section_id),
        INDEX idx_section (section_id),
        INDEX idx_division (division_id),
        INDEX idx_employee (employee_id),
        INDEX idx_composite (division_id, section_id, sub_section_id, employee_id),
        UNIQUE KEY unique_subsec_emp (division_id, section_id, sub_section_id, employee_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT='Employee IDs by Subsection - for division+section+subsection filters'
    `);
    console.log('   ✅ emp_ids_by_subsections created');

    // ========================================
    // POPULATE DATA
    // ========================================
    console.log('\n🔄 Populating tables with employee data...\n');

    const now = moment().format('YYYY-MM-DD HH:mm:ss');

    // ========================================
    // POPULATE: emp_ids_by_divisions
    // ========================================
    console.log('📊 Populating emp_ids_by_divisions...');
    
    // Fetch divisions map
    const [divisions] = await conn.execute('SELECT HIE_CODE AS division_id, HIE_NAME AS division_name FROM divisions_sync');
    const divisionMap = new Map();
    divisions.forEach(d => divisionMap.set(String(d.division_id), d.division_name || null));

    // Fetch employees sorted by division_id
    const [employeesByDivision] = await conn.execute(`
      SELECT EMP_NO AS employee_id, EMP_NAME AS employee_name, DIV_CODE AS division_id
      FROM employees_sync
      WHERE IS_ACTIVE = 1 AND DIV_CODE IS NOT NULL AND DIV_CODE != ''
      ORDER BY CAST(DIV_CODE AS UNSIGNED) ASC, EMP_NO ASC
    `);

    console.log(`   Found ${employeesByDivision.length} employees with divisions`);
    console.log(`   Inserting in ascending order by division_id...`);

    let divInserted = 0;
    for (const emp of employeesByDivision) {
      const divId = String(emp.division_id).trim();
      const divName = divisionMap.get(divId) || null;

      await conn.execute(`
        INSERT INTO emp_ids_by_divisions (division_id, division_name, employee_id, employee_name, synced_at)
        VALUES (?, ?, ?, ?, ?)
      `, [divId, divName, emp.employee_id, emp.employee_name, now]);
      divInserted++;
    }

    console.log(`   ✅ Inserted ${divInserted} records\n`);

    // ========================================
    // POPULATE: emp_ids_by_sections
    // ========================================
    console.log('📊 Populating emp_ids_by_sections...');

    // Fetch sections map
    const [sections] = await conn.execute('SELECT HIE_CODE AS section_id, HIE_NAME AS section_name, HIE_RELATIONSHIP AS division_id FROM sections_sync');
    const sectionMap = new Map();
    sections.forEach(s => sectionMap.set(String(s.section_id), { name: s.section_name || null, division_id: s.division_id || null }));

    // Fetch employees with sections sorted by division_id, section_id
    const [employeesBySection] = await conn.execute(`
      SELECT EMP_NO AS employee_id, EMP_NAME AS employee_name, DIV_CODE AS division_id, SEC_CODE AS section_id
      FROM employees_sync
      WHERE IS_ACTIVE = 1 
        AND DIV_CODE IS NOT NULL AND DIV_CODE != ''
        AND SEC_CODE IS NOT NULL AND SEC_CODE != ''
      ORDER BY CAST(DIV_CODE AS UNSIGNED) ASC, CAST(SEC_CODE AS UNSIGNED) ASC, EMP_NO ASC
    `);

    console.log(`   Found ${employeesBySection.length} employees with sections`);
    console.log(`   Inserting in ascending order by division_id, section_id...`);

    let secInserted = 0;
    for (const emp of employeesBySection) {
      const divId = String(emp.division_id).trim();
      const secId = String(emp.section_id).trim();
      const secInfo = sectionMap.get(secId);
      const secName = secInfo?.name || null;

      await conn.execute(`
        INSERT INTO emp_ids_by_sections (division_id, section_id, section_name, employee_id, employee_name, synced_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [divId, secId, secName, emp.employee_id, emp.employee_name, now]);
      secInserted++;
    }

    console.log(`   ✅ Inserted ${secInserted} records\n`);

    // ========================================
    // POPULATE: emp_ids_by_subsections
    // ========================================
    console.log('📊 Populating emp_ids_by_subsections...');

    // Fetch subsections
    const [subsections] = await conn.execute('SELECT id AS sub_section_id, sub_section_name, section_code AS section_id, division_code AS division_id FROM sub_sections');
    const subMap = new Map();
    subsections.forEach(ss => subMap.set(String(ss.sub_section_id), {
      name: ss.sub_section_name || null,
      section_id: ss.section_id || null,
      division_id: ss.division_id || null
    }));

    // Fetch transferred employees
    const [transfers] = await conn.execute('SELECT employee_id, sub_section_id FROM transferred_employees WHERE transferred_status = 1');
    const transferMap = new Map();
    transfers.forEach(t => transferMap.set(String(t.employee_id), String(t.sub_section_id)));

    // Build subsection employee list
    const subsectionEmployees = [];
    for (const emp of employeesBySection) {
      const empId = String(emp.employee_id);
      const subSectionId = transferMap.get(empId);

      if (subSectionId && subMap.has(subSectionId)) {
        const subInfo = subMap.get(subSectionId);
        subsectionEmployees.push({
          division_id: subInfo.division_id || emp.division_id,
          section_id: subInfo.section_id || emp.section_id,
          sub_section_id: subSectionId,
          sub_section_name: subInfo.name,
          employee_id: emp.employee_id,
          employee_name: emp.employee_name
        });
      }
    }

    // Sort by division, section, subsection
    subsectionEmployees.sort((a, b) => {
      const divA = parseInt(a.division_id) || 0;
      const divB = parseInt(b.division_id) || 0;
      if (divA !== divB) return divA - divB;

      const secA = parseInt(a.section_id) || 0;
      const secB = parseInt(b.section_id) || 0;
      if (secA !== secB) return secA - secB;

      const subA = parseInt(a.sub_section_id) || 0;
      const subB = parseInt(b.sub_section_id) || 0;
      if (subA !== subB) return subA - subB;

      return String(a.employee_id).localeCompare(String(b.employee_id));
    });

    console.log(`   Found ${subsectionEmployees.length} employees with subsections`);
    console.log(`   Inserting in ascending order by division_id, section_id, sub_section_id...`);

    let subInserted = 0;
    for (const emp of subsectionEmployees) {
      await conn.execute(`
        INSERT INTO emp_ids_by_subsections (division_id, section_id, sub_section_id, sub_section_name, employee_id, employee_name, synced_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [emp.division_id, emp.section_id, emp.sub_section_id, emp.sub_section_name, emp.employee_id, emp.employee_name, now]);
      subInserted++;
    }

    console.log(`   ✅ Inserted ${subInserted} records\n`);

    // ========================================
    // SUMMARY
    // ========================================
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║                    ✅ SYNC COMPLETE                           ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    console.log('📊 Summary:');
    console.log(`   emp_ids_by_divisions:    ${divInserted} records`);
    console.log(`   emp_ids_by_sections:     ${secInserted} records`);
    console.log(`   emp_ids_by_subsections:  ${subInserted} records\n`);

    console.log('✅ All tables optimized with:');
    console.log('   • Data sorted by hierarchical IDs (numerical ascending)');
    console.log('   • InnoDB clustered index optimization');
    console.log('   • No redundant parent data (each table only its level)');
    console.log('   • Ready for ultra-fast attendance report generation\n');

    // Verification
    console.log('🔍 Verification - First 5 records from each table:\n');

    const [divSample] = await conn.execute('SELECT division_id, division_name, employee_id FROM emp_ids_by_divisions ORDER BY id LIMIT 5');
    console.log('emp_ids_by_divisions:');
    divSample.forEach((r, i) => console.log(`   ${i + 1}. DIV ${r.division_id} - EMP ${r.employee_id}`));

    const [secSample] = await conn.execute('SELECT division_id, section_id, employee_id FROM emp_ids_by_sections ORDER BY id LIMIT 5');
    console.log('\nemp_ids_by_sections:');
    secSample.forEach((r, i) => console.log(`   ${i + 1}. DIV ${r.division_id} / SEC ${r.section_id} - EMP ${r.employee_id}`));

    if (subInserted > 0) {
      const [subSample] = await conn.execute('SELECT division_id, section_id, sub_section_id, employee_id FROM emp_ids_by_subsections ORDER BY id LIMIT 5');
      console.log('\nemp_ids_by_subsections:');
      subSample.forEach((r, i) => console.log(`   ${i + 1}. DIV ${r.division_id} / SEC ${r.section_id} / SUB ${r.sub_section_id} - EMP ${r.employee_id}`));
    }

    console.log('\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await conn.end();
  }
}

createEmpIdTables();
