const { createMySQLConnection } = require('../config/mysql');
const AuditLog = require('../models/AuditLog');

// List transfers for a specific subsection (only active transfers)
exports.getTransferredEmployees = async (req, res, next) => {
  let conn;
  try {
    const { subSectionId } = req.params;
    conn = await createMySQLConnection();
    const [rows] = await conn.execute(
      'SELECT * FROM transferred_employees WHERE sub_section_id = ? AND transferred_status = TRUE ORDER BY transferred_at DESC',
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

// List all transfers (only active transfers)
exports.getAllTransferredEmployees = async (req, res, next) => {
  let conn;
  try {
    conn = await createMySQLConnection();
    const [rows] = await conn.execute(
      'SELECT * FROM transferred_employees WHERE transferred_status = TRUE ORDER BY transferred_at DESC'
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
    console.log('[Transfer] Incoming payload:', JSON.stringify(req.body || {}));

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

    const subIdNumeric = parseInt(sub_section_id, 10);
    if (Number.isNaN(subIdNumeric)) {
      return res.status(400).json({ success: false, message: 'Invalid sub_section_id; expected numeric id or numeric string' });
    }

    conn = await createMySQLConnection();

    const sql = `INSERT INTO transferred_employees
      (employee_id, employee_name, division_code, division_name, section_code, section_name,
       sub_section_id, sub_hie_code, sub_hie_name, transferred_at, transferred_by, transferred_status, employee_data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, ?)
      ON DUPLICATE KEY UPDATE
        employee_name = VALUES(employee_name),
        division_code = VALUES(division_code),
        division_name = VALUES(division_name),
        section_code = VALUES(section_code),
        section_name = VALUES(section_name),
        sub_hie_code = VALUES(sub_hie_code),
        sub_hie_name = VALUES(sub_hie_name),
        transferred_at = VALUES(transferred_at),
        transferred_by = VALUES(transferred_by),
        transferred_status = TRUE,
        recalled_at = NULL,
        recalled_by = NULL,
        employee_data = VALUES(employee_data)`;

    const params = [
      String(employeeId), employeeName || null, division_code || null, division_name || null,
      hie_code || null, hie_name || null, subIdNumeric,
      (sub_hie_code || '').toString().toUpperCase() || null, sub_hie_name || null,
      transferredAt ? new Date(transferredAt) : new Date(),
      (req.user && req.user._id) ? String(req.user._id) : null,
      employeeData ? JSON.stringify(employeeData) : null
    ];

    try {
      await conn.execute(sql, params);
    } catch (dbErr) {
      console.error('[MySQL] Insert failed for transfer:', dbErr);
      throw dbErr;
    }

    // Return the created row
    const [rows] = await conn.execute(
      'SELECT * FROM transferred_employees WHERE employee_id = ? AND sub_section_id = ? AND transferred_status = TRUE ORDER BY id DESC LIMIT 1',
      [String(employeeId), subIdNumeric]
    );
    const created = Array.isArray(rows) && rows[0] ? rows[0] : null;

    // Log audit trail for MySQL employee transfer
    if (req.user?._id) {
      try {
        await AuditLog.createLog({
          user: req.user._id,
          action: 'mysql_employee_transferred',
          entity: { type: 'MySQLTransfer', id: created?.id, name: employeeName },
          category: 'data_modification',
          severity: 'medium',
          description: `Employee "${employeeName}" transferred to sub-section "${sub_hie_name}"`,
          details: `Transferred employee ${employeeId} (${employeeName}) to MySQL sub-section "${sub_hie_name}" (${sub_hie_code})`,
          metadata: {
            database: 'mysql',
            employeeId,
            employeeName,
            subSectionId: subIdNumeric,
            subSectionName: sub_hie_name,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            method: req.method,
            endpoint: req.originalUrl
          }
        });
      } catch (auditErr) {
        console.error('[AuditLog] Failed to log MySQL employee transfer:', auditErr);
      }
    }

    return res.status(201).json({ success: true, message: 'Employee transferred successfully', data: created });
  } catch (err) {
    console.error('[MySQL] transferEmployeeToSubSection failed (outer):', err?.message || err, err?.stack || 'no-stack');
    next(err);
  } finally {
    if (conn) await conn.end();
  }
};

// Transfer multiple employees to subsection (bulk create records)
exports.transferEmployeesToSubSectionBulk = async (req, res, next) => {
  let conn;
  try {
    let transfers = req.body || [];
    if (!Array.isArray(transfers) || transfers.length === 0) {
      return res.status(400).json({ success: false, message: 'An array of transfer objects is required' });
    }

    // Normalize and validate: ensure employeeId and numeric sub_section_id
    transfers = transfers
      .map(t => ({
        employeeId: t?.employeeId ? String(t.employeeId).trim() : '',
        employeeName: t?.employeeName || null,
        division_code: t?.division_code || null,
        division_name: t?.division_name || null,
        hie_code: t?.hie_code || null,
        hie_name: t?.hie_name || null,
        sub_section_id: t?.sub_section_id != null ? parseInt(t.sub_section_id, 10) : NaN,
        sub_hie_code: t?.sub_hie_code ? String(t.sub_hie_code).toUpperCase() : null,
        sub_hie_name: t?.sub_hie_name || null,
        transferredAt: t?.transferredAt ? new Date(t.transferredAt) : new Date(),
        employeeData: t?.employeeData ? t.employeeData : null
      }))
      .filter(t => t.employeeId && !Number.isNaN(t.sub_section_id));

    if (transfers.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid transfers provided' });
    }

    // Deduplicate by employeeId + sub_section_id
    const uniqueMap = new Map();
    transfers.forEach(t => {
      const key = `${t.employeeId}_${t.sub_section_id}`;
      if (!uniqueMap.has(key)) uniqueMap.set(key, t);
    });
    transfers = Array.from(uniqueMap.values());

    conn = await createMySQLConnection();

    // Use INSERT IGNORE to allow skipping duplicates without failing the entire batch
    const placeholders = transfers.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, ?)').join(', ');
    const sql = `INSERT INTO transferred_employees
      (employee_id, employee_name, division_code, division_name, section_code, section_name,
       sub_section_id, sub_hie_code, sub_hie_name, transferred_at, transferred_by, transferred_status, employee_data)
      VALUES ${placeholders}
      ON DUPLICATE KEY UPDATE
        transferred_status = TRUE,
        transferred_at = VALUES(transferred_at),
        transferred_by = VALUES(transferred_by),
        recalled_at = NULL,
        recalled_by = NULL`;

    const params = [];
    transfers.forEach(t => {
      params.push(
        String(t.employeeId),
        t.employeeName || null,
        t.division_code || null,
        t.division_name || null,
        t.hie_code || null,
        t.hie_name || null,
        t.sub_section_id,
        t.sub_hie_code || null,
        t.sub_hie_name || null,
        t.transferredAt,
        (req.user && req.user._id) ? String(req.user._id) : null,
        t.employeeData ? JSON.stringify(t.employeeData) : null
      );
    });

    const [result] = await conn.execute(sql, params);
    const inserted = result?.affectedRows || 0;

    // Log audit trail for MySQL bulk employee transfer (use action matching route auditTrail)
    if (req.user?._id) {
      try {
        await AuditLog.createLog({
          user: req.user._id,
          action: 'mysql_employee_transferred_bulk',
          entity: { type: 'MySQLTransfer', name: `${inserted} employees` },
          category: 'data_modification',
          severity: 'medium',
          description: `Bulk transferred ${inserted} employees to sub-sections`,
          details: `Bulk transferred ${inserted} employees to MySQL sub-sections`,
          metadata: {
            database: 'mysql',
            transferCountRequested: transfers.length,
            transferCountInserted: inserted,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            method: req.method,
            endpoint: req.originalUrl
          }
        });
      } catch (auditErr) {
        console.error('[AuditLog] Failed to log MySQL bulk employee transfer:', auditErr);
      }
    }

    return res.status(201).json({ success: true, message: `Bulk transfer completed: ${inserted} records created`, data: { requested: transfers.length, inserted } });
  } catch (err) {
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

    if (Number.isNaN(subKey)) {
      return res.status(400).json({ success: false, message: 'Invalid sub_section_id; expected numeric id or numeric string' });
    }
    
    // Fetch the transfer record before update for audit log
    const [existingRows] = await conn.execute(
      'SELECT * FROM transferred_employees WHERE employee_id = ? AND sub_section_id = ? LIMIT 1',
      [empKey, subKey]
    );
    const existing = Array.isArray(existingRows) && existingRows[0] ? existingRows[0] : null;
    
    // Update transferred_status to FALSE instead of deleting
    const [result] = await conn.execute(
      'UPDATE transferred_employees SET transferred_status = FALSE, recalled_at = NOW(), recalled_by = ? WHERE employee_id = ? AND sub_section_id = ?',
      [(req.user && req.user._id) ? String(req.user._id) : null, empKey, subKey]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Transfer record not found' });
    }

    // Log audit trail for MySQL transfer recall
    if (req.user?._id) {
      try {
        await AuditLog.createLog({
          user: req.user._id,
          action: 'mysql_transfer_recalled',
          entity: { type: 'MySQLTransfer', id: existing?.id, name: existing?.employee_name },
          category: 'data_modification',
          severity: 'medium',
          description: `Employee "${existing?.employee_name || employeeId}" transfer recalled`,
          details: `Recalled transfer of employee ${employeeId} from MySQL sub-section ${existing?.sub_hie_name || finalSubSectionId}`,
          metadata: {
            database: 'mysql',
            employeeId: empKey,
            employeeName: existing?.employee_name,
            subSectionId: subKey,
            subSectionName: existing?.sub_hie_name,
            recalledData: existing,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            method: req.method,
            endpoint: req.originalUrl
          }
        });
      } catch (auditErr) {
        console.error('[AuditLog] Failed to log MySQL transfer recall:', auditErr);
      }
    }

    return res.json({ success: true, message: 'Transfer recalled successfully' });
  } catch (err) {
    console.error('[MySQL] recallTransfer failed:', err);
    next(err);
  } finally {
    if (conn) await conn.end();
  }
};

// Recall multiple transfers (bulk delete) - accepts array of { employeeId, sub_section_id } or array of ids
exports.recallTransfersBulk = async (req, res, next) => {
  let conn;
  try {
    // Accept multiple shapes: body could be array, or { transfers: [] }
    const body = req.body || {};
    let transfers = [];
    if (Array.isArray(body)) transfers = body;
    else if (Array.isArray(body.transfers)) transfers = body.transfers;
    else if (body.ids && Array.isArray(body.ids)) {
      // Allow list of DB row IDs (numeric)
      const ids = body.ids.map(i => parseInt(i, 10)).filter(i => !Number.isNaN(i));
      if (ids.length === 0) return res.status(400).json({ success: false, message: 'No valid IDs provided' });
      conn = await createMySQLConnection();
      await conn.beginTransaction();
      const result = await conn.query(`UPDATE transferred_employees SET transferred_status = FALSE, recalled_at = NOW(), recalled_by = ? WHERE id IN (${ids.map(() => '?').join(',')})`,
        [(req.user && req.user._id) ? String(req.user._id) : null, ...ids]
      );
      await conn.commit();
      return res.json({ success: true, message: `Updated ${result.affectedRows} transfers to recalled`, data: { recalled: result.affectedRows } });
    } else if (body.employeeIds && Array.isArray(body.employeeIds) && body.sub_section_id) {
      // Accept bulk delete by array of employeeIds and single sub_section_id
      transfers = body.employeeIds.map(empId => ({ employeeId: empId, sub_section_id: body.sub_section_id }));
    }

    if (!Array.isArray(transfers) || transfers.length === 0) {
      return res.status(400).json({ success: false, message: 'An array of transfers is required' });
    }

    // Minimal validation: each transfer must carry an employeeId and sub_section_id (or id handled above)
    const invalid = transfers.some(t => !(t.employeeId && t.sub_section_id));
    if (invalid) {
      return res.status(400).json({ success: false, message: 'Each transfer must include employeeId and sub_section_id' });
    }

    // Group by sub_section_id for efficient updates
    const groups = new Map();
    transfers.forEach(t => {
      const sub = String(t.sub_section_id);
      const emp = String(t.employeeId);
      if (!groups.has(sub)) groups.set(sub, new Set());
      groups.get(sub).add(emp);
    });

    conn = await createMySQLConnection();
    await conn.beginTransaction();
    let totalRecalled = 0;
    for (const [subSectionId, empSet] of groups.entries()) {
      const empArr = Array.from(empSet);
      if (!empArr.length) continue;
      const placeholders = empArr.map(() => '?').join(',');
      const params = [
        (req.user && req.user._id) ? String(req.user._id) : null,
        parseInt(subSectionId, 10),
        ...empArr
      ];
      // UPDATE transferred_status to FALSE WHERE sub_section_id = ? AND employee_id IN (?, ?, ...)
      const sql = `UPDATE transferred_employees SET transferred_status = FALSE, recalled_at = NOW(), recalled_by = ? WHERE sub_section_id = ? AND employee_id IN (${placeholders})`;
      const [result] = await conn.execute(sql, params);
      totalRecalled += result.affectedRows || 0;
    }
    await conn.commit();

    // Log audit trail for MySQL bulk transfer recall
    if (req.user?._id) {
      try {
        await AuditLog.createLog({
          user: req.user._id,
          action: 'mysql_transfers_bulk_recalled',
          entity: { type: 'MySQLTransfer', name: `${totalRecalled} transfers` },
          category: 'data_modification',
          severity: 'medium',
          description: `Bulk recalled ${totalRecalled} employee transfers`,
          details: `Bulk recalled ${totalRecalled} employee transfers from MySQL sub-sections`,
          metadata: {
            database: 'mysql',
            recalledCount: totalRecalled,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            method: req.method,
            endpoint: req.originalUrl
          }
        });
      } catch (auditErr) {
        console.error('[AuditLog] Failed to log MySQL bulk transfer recall:', auditErr);
      }
    }

    return res.json({ success: true, message: `Bulk recall completed, ${totalRecalled} records recalled`, data: { recalled: totalRecalled } });
  } catch (err) {
    if (conn) {
      try { await conn.rollback(); } catch (e) { /* ignore rollback errors */ }
    }
    console.error('[MySQL] recallTransfersBulk failed:', err);
    next(err);
  } finally {
    if (conn) await conn.end();
  }
};
