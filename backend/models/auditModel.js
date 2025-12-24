const { createMySQLConnection } = require('../config/mysql');

/**
 * Fetch audit data according to grouping and filters.
 * filters: { from_date, to_date, grouping, division_id, section_id, sub_section_id, time_period }
 */
async function fetchAuditReport(filters) {
  const { from_date, to_date, grouping = 'none', division_id, section_id, sub_section_id } = filters;
  const params = [`${from_date} 00:00:00`, `${to_date} 23:59:59`];
  const filtersSql = [];
  if (division_id) { filtersSql.push('division_name = ?'); params.push(division_id); }
  if (section_id)  { filtersSql.push('section_name = ?');  params.push(section_id); }
  if (sub_section_id) { filtersSql.push('sub_section_id = ?'); params.push(sub_section_id); }
  const whereExtra = filtersSql.length ? `AND ${filtersSql.join(' AND ')}` : '';

  let conn;
  try {
    conn = await createMySQLConnection();

    if (grouping === 'punch') {
      const sql = `
        SELECT
          employee_id AS employeeId,
          employee_name AS employeeName,
          designation,
          DATE(event_time) AS eventDate,
          TIME(event_time) AS eventTime,
          division_name AS divisionName,
          section_name AS sectionName
        FROM attendance
        WHERE event_time BETWEEN ? AND ?
        ${whereExtra}
        ORDER BY employee_name, event_time
        LIMIT 50000
      `;
      const [rows] = await conn.execute(sql, params);
      const group = {
        groupName: 'All Records',
        count: rows.length,
        employees: rows.map(r => ({
          employeeId: r.employeeId,
          employeeName: r.employeeName,
          designation: r.designation,
          eventDate: r.eventDate,
          eventTime: r.eventTime,
          divisionName: r.divisionName,
          sectionName: r.sectionName,
        })),
      };
      const summary = {
        totalEmployees: new Set(rows.map(r => r.employeeId)).size,
        totalGroups: 1,
        totalRecords: rows.length,
        divisionFilter: division_id || 'All',
        sectionFilter: section_id || 'All',
      };
      return { data: [group], summary, dateRange: { from: from_date, to: to_date }, grouping: 'punch' };
    }

    if (grouping === 'designation') {
      const sql = `
        SELECT
          designation,
          employee_id AS employeeId,
          employee_name AS employeeName,
          division_name AS divisionName,
          section_name AS sectionName
        FROM attendance
        WHERE event_time BETWEEN ? AND ?
        ${whereExtra}
        ORDER BY designation, employee_name
      `;
      const [rows] = await conn.execute(sql, params);
      const map = new Map();
      rows.forEach(r => {
        const key = r.designation || 'Unknown';
        if (!map.has(key)) map.set(key, { groupName: key, employees: [], count: 0 });
        const g = map.get(key);
        g.employees.push({
          employeeId: r.employeeId,
          employeeName: r.employeeName,
          designation: r.designation,
          divisionName: r.divisionName,
          sectionName: r.sectionName,
        });
        g.count = g.employees.length;
      });
      const groups = Array.from(map.values());
      const totalRecords = rows.length;
      const totalEmployees = new Set(rows.map(r => r.employeeId)).size;
      const summary = { totalEmployees, totalGroups: groups.length, totalRecords, divisionFilter: division_id || 'All', sectionFilter: section_id || 'All' };
      return { data: groups, summary, dateRange: { from: from_date, to: to_date }, grouping: 'designation' };
    }

    // default: aggregated issues per employee (no grouping)
    const sql = `
      SELECT
        employee_id AS employeeId,
        employee_name AS employeeName,
        designation,
        COUNT(*) AS issueCount,
        division_name AS divisionName,
        section_name AS sectionName
      FROM attendance
      WHERE event_time BETWEEN ? AND ?
      ${whereExtra}
      GROUP BY employee_id, employee_name, designation, division_name, section_name
      ORDER BY issueCount DESC, employee_name
    `;
    const [rows] = await conn.execute(sql, params);
    const group = {
      groupName: 'All Employees',
      count: rows.length,
      employees: rows.map(r => ({
        employeeId: r.employeeId,
        employeeName: r.employeeName,
        designation: r.designation,
        issueCount: r.issueCount,
        divisionName: r.divisionName,
        sectionName: r.sectionName,
      })),
    };
    const summary = {
      totalEmployees: rows.length,
      totalGroups: 1,
      totalRecords: rows.reduce((s, r) => s + (r.issueCount || 0), 0),
      divisionFilter: division_id || 'All',
      sectionFilter: section_id || 'All',
    };
    return { data: [group], summary, dateRange: { from: from_date, to: to_date }, grouping: 'none' };
  } finally {
    if (conn) await conn.end();
  }
}

module.exports = { fetchAuditReport };
