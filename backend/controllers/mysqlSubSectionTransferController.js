const { createMySQLConnection } = require('../config/mysql');

// List transfers for a specific subsection
exports.getTransferredEmployees = async (req, res, next) => {
  let conn;
  try {
    const { subSectionId } = req.params;
    conn = await createMySQLConnection();
    const [rows] = await conn.execute(
      'SELECT * FROM subsection_transfers WHERE sub_section_id = ? ORDER BY transferred_at DESC',
      [String(subSectionId)]
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[MySQL] getTransferredEmployees failed:', err);
    next(err);
  } finally {
    if (conn) await conn.end();
  }
};

// List all transfers
exports.getAllTransferredEmployees = async (req, res, next) => {
  let conn;
  try {
    conn = await createMySQLConnection();
    const [rows] = await conn.execute(
      'SELECT * FROM subsection_transfers ORDER BY transferred_at DESC'
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[MySQL] getAllTransferredEmployees failed:', err);
    next(err);
  } finally {
    if (conn) await conn.end();
  }
};

// Transfer employee to subsection (create record)
exports.transferEmployeeToSubSection = async (req, res, next) => {
  let conn;
  try {
    const {
      employeeId,
      employeeName,
      division_code,
      division_name,
      hie_code,
      hie_name,
      sub_section_id,
      sub_hie_code,
      sub_hie_name,
      transferredAt,
      employeeData
    } = req.body || {};

    if (!employeeId || !employeeName) {
      return res.status(400).json({ success: false, message: 'Employee ID and name are required' });
    }
    if (!sub_section_id || !sub_hie_name) {
      return res.status(400).json({ success: false, message: 'Sub-section information is required' });
    }

    conn = await createMySQLConnection();

    const sql = `INSERT INTO subsection_transfers
      (employee_id, employee_name, division_code, division_name, section_code, section_name,
       sub_section_id, sub_hie_code, sub_hie_name, transferred_at, transferred_by, employee_data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const params = [
      String(employeeId), employeeName || null, division_code || null, division_name || null,
      hie_code || null, hie_name || null, parseInt(sub_section_id, 10),
      (sub_hie_code || '').toString().toUpperCase() || null, sub_hie_name || null,
      transferredAt ? new Date(transferredAt) : new Date(),
      (req.user && req.user._id) ? String(req.user._id) : null,
      employeeData ? JSON.stringify(employeeData) : null
    ];

    await conn.execute(sql, params);

    // Return the created row
    const [rows] = await conn.execute(
      'SELECT * FROM subsection_transfers WHERE employee_id = ? AND sub_section_id = ? ORDER BY id DESC LIMIT 1',
      [String(employeeId), parseInt(sub_section_id, 10)]
    );
    const created = Array.isArray(rows) && rows[0] ? rows[0] : null;

    return res.status(201).json({ success: true, message: 'Employee transferred successfully', data: created });
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Employee is already transferred to this sub-section' });
    }
    console.error('[MySQL] transferEmployeeToSubSection failed:', err);
    next(err);
  } finally {
    if (conn) await conn.end();
  }
};

// Transfer multiple employees to subsection (bulk create records)
exports.transferEmployeesToSubSectionBulk = async (req, res, next) => {
  let conn;
  try {
    const transfers = req.body || [];
    if (!Array.isArray(transfers) || transfers.length === 0) {
      return res.status(400).json({ success: false, message: 'An array of transfer objects is required' });
    }

    // Minimal validation
    const invalid = transfers.some(t => !(t.employeeId && t.sub_section_id));
    if (invalid) {
      return res.status(400).json({ success: false, message: 'Each transfer must include employeeId and sub_section_id' });
    }

    conn = await createMySQLConnection();

    // Build a multi-row insert
    const placeholders = transfers.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
    const sql = `INSERT INTO subsection_transfers
      (employee_id, employee_name, division_code, division_name, section_code, section_name,
       sub_section_id, sub_hie_code, sub_hie_name, transferred_at, transferred_by, employee_data)
      VALUES ${placeholders}`;

    const params = [];
    transfers.forEach(t => {
      params.push(
        String(t.employeeId),
        t.employeeName || null,
        t.division_code || null,
        t.division_name || null,
        t.hie_code || null,
        t.hie_name || null,
        parseInt(t.sub_section_id, 10),
        (t.sub_hie_code || '').toString().toUpperCase() || null,
        t.sub_hie_name || null,
        t.transferredAt ? new Date(t.transferredAt) : new Date(),
        (req.user && req.user._id) ? String(req.user._id) : null,
        t.employeeData ? JSON.stringify(t.employeeData) : null
      );
    });

    await conn.execute(sql, params);

    // Fetch rows for the last N inserted entries using a reasonable filter (employee IDs and sub_section_id)
    // For simplicity, return the count created as we don't necessarily have the inserted IDs.
    return res.status(201).json({ success: true, message: `Bulk transfer completed: ${transfers.length} records created`, data: { count: transfers.length } });
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'One or more employees are already transferred to these sub-sections' });
    }
    console.error('[MySQL] transferEmployeesToSubSectionBulk failed:', err);
    next(err);
  } finally {
    if (conn) await conn.end();
  }
};

// Recall transfer (delete record)
exports.recallTransfer = async (req, res, next) => {
  let conn;
  try {
    // Accept parameters from body, query, or params for flexibility
    const src = { ...(req.body || {}), ...(req.query || {}), ...(req.params || {}) };
    const employeeId = src.employeeId || src.employee_id || src.empId || src.emp_id;
    const finalSubSectionId = src.sub_section_id || src.subSectionId || src.subsection_id || src.subsectionId || src.id;

    if (!employeeId || !finalSubSectionId) {
      return res.status(400).json({ success: false, message: 'Employee ID and Sub-section ID are required' });
    }

    conn = await createMySQLConnection();
    const empKey = String(employeeId);
    const subKey = parseInt(finalSubSectionId, 10);
    const [result] = await conn.execute(
      'DELETE FROM subsection_transfers WHERE employee_id = ? AND sub_section_id = ?',
      [empKey, subKey]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Transfer record not found' });
    }

    return res.json({ success: true, message: 'Transfer recalled successfully' });
  } catch (err) {
    console.error('[MySQL] recallTransfer failed:', err);
    next(err);
  } finally {
    if (conn) await conn.end();
  }
};
