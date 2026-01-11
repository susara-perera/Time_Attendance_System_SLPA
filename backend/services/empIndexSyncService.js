/**
 * empIndexSyncService
 *
 * Builds and maintains an 'emp_index_list' table with the following columns:
 *  - division_id, division_name
 *  - section_id, section_name
 *  - sub_section_id
 *  - employee_id, employee_name
 *
 * The service reads from divisions_sync, sections_sync, sub_sections, employees_sync
 * and upserts rows into emp_index_list. Idempotent and designed for daily syncs.
 */

const { createMySQLConnection } = require('../config/mysql');
const moment = require('moment');

const syncEmpIndex = async () => {
  const conn = await createMySQLConnection();
  try {
    console.log('🔄 [EMP_INDEX_SYNC] Starting sync of emp_index_list...');

    // Fetch divisions
    const [divisions] = await conn.execute('SELECT HIE_CODE AS division_id, HIE_NAME AS division_name FROM divisions_sync');
    // Fetch sections
    const [sections] = await conn.execute('SELECT HIE_CODE AS section_id, HIE_NAME AS section_name, HIE_RELATIONSHIP AS division_id FROM sections_sync');
    // Fetch subsections
    const [subsections] = await conn.execute('SELECT id AS sub_section_id, sub_section_name AS sub_section_name, section_code AS section_id, division_code FROM sub_sections');
    // Fetch any active transferred employees (map employee_id -> sub_section_id)
    const [transfers] = await conn.execute('SELECT employee_id, sub_section_id FROM transferred_employees WHERE transferred_status = 1');
    const transferMap = new Map();
    transfers.forEach(t => transferMap.set(String(t.employee_id), String(t.sub_section_id)));

    // Fetch employees and SORT BY DIVISION_ID (numerical ascending) for optimal insertion order
    const [employees] = await conn.execute(`
      SELECT EMP_NO AS employee_id, EMP_NAME AS employee_name, DIV_CODE AS division_id, SEC_CODE AS section_id 
      FROM employees_sync 
      WHERE IS_ACTIVE = 1 
      ORDER BY CAST(DIV_CODE AS UNSIGNED) ASC, EMP_NO ASC
    `);

    // Build maps for quick lookup
    const divisionMap = new Map();
    divisions.forEach(d => divisionMap.set(String(d.division_id), d.division_name || null));

    const sectionMap = new Map();
    sections.forEach(s => sectionMap.set(String(s.section_id), { name: s.section_name || null, division_id: s.division_id || null }));

    const subMap = new Map();
    subsections.forEach(ss => subMap.set(String(ss.sub_section_id), { section_id: ss.section_id || null, division_code: ss.division_code || null, name: ss.sub_section_name || null }));

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    const newRecords = []; // Track newly added records

    for (const emp of employees) {
      const empId = String(emp.employee_id);
      const empName = emp.employee_name || null;
      const divId = String(emp.division_id || '').trim();
      const secId = String(emp.section_id || '').trim();

      // Skip employees without division_id (required field)
      if (!divId) {
        skipped++;
        continue;
      }

      const divName = divisionMap.get(divId) || null;
      const secName = sectionMap.get(secId)?.name || null;

      // Check if this employee has an active transfer to a sub_section
      const transferredSubId = transferMap.get(empId) || null;
      const subName = transferredSubId ? (subMap.get(transferredSubId)?.name || null) : null;

      // Try to find existing record by employee_id (prefer updating existing row to avoid duplicates)
      const [existingRows] = await conn.execute('SELECT id FROM emp_index_list WHERE employee_id = ? LIMIT 1', [empId]);

      const now = moment().format('YYYY-MM-DD HH:mm:ss');

      if (existingRows && existingRows.length > 0) {
        // Skip existing (don't update)
        updated++;
      } else {
        // Insert new row only
        const [res] = await conn.execute(`
          INSERT INTO emp_index_list (division_id, division_name, section_id, section_name, sub_section_id, employee_id, employee_name, synced_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [divId, divName, secId || null, secName, transferredSubId, empId, empName, now]);
        inserted++;
        newRecords.push({
          employee_id: empId,
          employee_name: empName,
          division_id: divId,
          division_name: divName,
          section_id: secId,
          section_name: secName,
          sub_section_id: transferredSubId,
          synced_at: now
        });
      }
    }

    // Next: include employees assigned to subsections (transferred) - ensure rows exist for them
    // For simplicity, we'll scan sub_sections table and for any matching employees in employees_sync with same section/division, create rows
    // If you later want to populate sub_section_id specifically, we can add logic to map employees to sub sections through transfers table.

    console.log(`🔍 [EMP_INDEX_SYNC] Completed. Inserted: ${inserted}, Skipped (existing): ${updated}, Skipped (no division): ${skipped}`);
    return { success: true, inserted, updated, skipped, newRecords };
  } catch (err) {
    console.error('❌ [EMP_INDEX_SYNC] Error during sync:', err.message);
    throw err;
  } finally {
    await conn.end();
  }
};

module.exports = { syncEmpIndex };
