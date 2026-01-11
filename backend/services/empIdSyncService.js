/**
 * Employee ID Lookup Sync Service
 * 
 * Maintains 3 optimized employee ID lookup tables:
 * - emp_ids_by_divisions
 * - emp_ids_by_sections  
 * - emp_ids_by_subsections
 * 
 * Each table contains only data for its hierarchical level
 * Data is stored in ascending order for optimal InnoDB performance
 */

const { createMySQLConnection } = require('../config/mysql');
const moment = require('moment');

/**
 * Sync all employee ID lookup tables
 */
const syncEmployeeIdTables = async (triggeredBy = 'system') => {
  const conn = await createMySQLConnection();
  const startTime = Date.now();

  try {
    console.log('🔄 [EMP_ID_SYNC] Starting sync of employee ID lookup tables...');

    const now = moment().format('YYYY-MM-DD HH:mm:ss');
    let results = {
      divisions: { inserted: 0, updated: 0 },
      sections: { inserted: 0, updated: 0 },
      subsections: { inserted: 0, updated: 0 }
    };

    // ========================================
    // SYNC: emp_ids_by_divisions
    // ========================================
    console.log('\n📊 Syncing emp_ids_by_divisions...');

    const [divisions] = await conn.execute('SELECT HIE_CODE AS division_id, HIE_NAME AS division_name FROM divisions_sync');
    const divisionMap = new Map();
    divisions.forEach(d => divisionMap.set(String(d.division_id), d.division_name || null));

    const [employeesByDivision] = await conn.execute(`
      SELECT EMP_NO AS employee_id, EMP_NAME AS employee_name, DIV_CODE AS division_id
      FROM employees_sync
      WHERE IS_ACTIVE = 1 AND DIV_CODE IS NOT NULL AND DIV_CODE != ''
      ORDER BY CAST(DIV_CODE AS UNSIGNED) ASC, EMP_NO ASC
    `);

    for (const emp of employeesByDivision) {
      const divId = String(emp.division_id).trim();
      const divName = divisionMap.get(divId) || null;

      const [existing] = await conn.execute(
        'SELECT id FROM emp_ids_by_divisions WHERE division_id = ? AND employee_id = ? LIMIT 1',
        [divId, emp.employee_id]
      );

      if (existing.length === 0) {
        await conn.execute(`
          INSERT INTO emp_ids_by_divisions (division_id, division_name, employee_id, employee_name, synced_at)
          VALUES (?, ?, ?, ?, ?)
        `, [divId, divName, emp.employee_id, emp.employee_name, now]);
        results.divisions.inserted++;
      } else {
        results.divisions.updated++;
      }
    }

    console.log(`   ✅ Divisions: ${results.divisions.inserted} new, ${results.divisions.updated} existing`);

    // ========================================
    // SYNC: emp_ids_by_sections
    // ========================================
    console.log('\n📊 Syncing emp_ids_by_sections...');

    const [sections] = await conn.execute('SELECT HIE_CODE AS section_id, HIE_NAME AS section_name FROM sections_sync');
    const sectionMap = new Map();
    sections.forEach(s => sectionMap.set(String(s.section_id), s.section_name || null));

    const [employeesBySection] = await conn.execute(`
      SELECT EMP_NO AS employee_id, EMP_NAME AS employee_name, DIV_CODE AS division_id, SEC_CODE AS section_id
      FROM employees_sync
      WHERE IS_ACTIVE = 1 
        AND DIV_CODE IS NOT NULL AND DIV_CODE != ''
        AND SEC_CODE IS NOT NULL AND SEC_CODE != ''
      ORDER BY CAST(DIV_CODE AS UNSIGNED) ASC, CAST(SEC_CODE AS UNSIGNED) ASC, EMP_NO ASC
    `);

    for (const emp of employeesBySection) {
      const divId = String(emp.division_id).trim();
      const secId = String(emp.section_id).trim();
      const secName = sectionMap.get(secId) || null;

      const [existing] = await conn.execute(
        'SELECT id FROM emp_ids_by_sections WHERE division_id = ? AND section_id = ? AND employee_id = ? LIMIT 1',
        [divId, secId, emp.employee_id]
      );

      if (existing.length === 0) {
        await conn.execute(`
          INSERT INTO emp_ids_by_sections (division_id, section_id, section_name, employee_id, employee_name, synced_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [divId, secId, secName, emp.employee_id, emp.employee_name, now]);
        results.sections.inserted++;
      } else {
        results.sections.updated++;
      }
    }

    console.log(`   ✅ Sections: ${results.sections.inserted} new, ${results.sections.updated} existing`);

    // ========================================
    // SYNC: emp_ids_by_subsections
    // ========================================
    console.log('\n📊 Syncing emp_ids_by_subsections...');

    const [subsections] = await conn.execute('SELECT id AS sub_section_id, sub_section_name, section_code AS section_id, division_code AS division_id FROM sub_sections');
    const subMap = new Map();
    subsections.forEach(ss => subMap.set(String(ss.sub_section_id), {
      name: ss.sub_section_name || null,
      section_id: ss.section_id || null,
      division_id: ss.division_id || null
    }));

    const [transfers] = await conn.execute('SELECT employee_id, sub_section_id FROM transferred_employees WHERE transferred_status = 1');
    const transferMap = new Map();
    transfers.forEach(t => transferMap.set(String(t.employee_id), String(t.sub_section_id)));

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

    for (const emp of subsectionEmployees) {
      const [existing] = await conn.execute(
        'SELECT id FROM emp_ids_by_subsections WHERE division_id = ? AND section_id = ? AND sub_section_id = ? AND employee_id = ? LIMIT 1',
        [emp.division_id, emp.section_id, emp.sub_section_id, emp.employee_id]
      );

      if (existing.length === 0) {
        await conn.execute(`
          INSERT INTO emp_ids_by_subsections (division_id, section_id, sub_section_id, sub_section_name, employee_id, employee_name, synced_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [emp.division_id, emp.section_id, emp.sub_section_id, emp.sub_section_name, emp.employee_id, emp.employee_name, now]);
        results.subsections.inserted++;
      } else {
        results.subsections.updated++;
      }
    }

    console.log(`   ✅ Subsections: ${results.subsections.inserted} new, ${results.subsections.updated} existing`);

    const duration = Math.floor((Date.now() - startTime) / 1000);
    console.log(`\n✅ [EMP_ID_SYNC] Completed in ${duration}s`);

    return {
      success: true,
      results,
      duration,
      triggeredBy
    };

  } catch (error) {
    console.error('❌ [EMP_ID_SYNC] Error:', error.message);
    return {
      success: false,
      error: error.message
    };
  } finally {
    await conn.end();
  }
};

module.exports = { syncEmployeeIdTables };
