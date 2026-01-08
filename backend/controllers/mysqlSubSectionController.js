const { createMySQLConnection } = require('../config/mysql');
const { getSubSectionsFromMySQL } = require('../services/mysqlDataService');
const AuditLog = require('../models/AuditLog');

// Map DB row -> API shape compatible with existing frontend usage
function mapRow(row) {
  return {
    _id: String(row.id),
    parentDivision: {
      // division_id might not exist in schema, fallback to code
      id: String(row.division_id || row.division_code || ''),
      division_code: row.division_code || '',
      division_name: row.division_name || ''
    },
    parentSection: {
      // section_id might not exist in schema, fallback to code
      id: String(row.section_id || row.section_code || ''),
      hie_code: row.section_code || '',
      hie_name: row.section_name || ''
    },
    subSection: {
      // Support both schema naming conventions
      sub_hie_name: row.sub_name || row.sub_section_name,
      sub_hie_code: row.sub_code || row.sub_section_code
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// @desc    Get all subsections from MySQL (for mysqlData routes)
// @route   GET /api/mysql-data/subsections
// @access  Public (no auth for data fetching)
const getMySQLSubSections = async (req, res) => {
  try {
    const {
      sectionCode,
      divisionCode,
      page = 1,
      limit = 1000
    } = req.query;

    const filters = { sectionCode, divisionCode };
    const subsections = await getSubSectionsFromMySQL(filters);

    res.status(200).json({
      success: true,
      count: subsections.length,
      data: subsections,
      source: 'MySQL Sync',
      message: 'Data fetched from synced MySQL tables'
    });

  } catch (error) {
    console.error('[MySQL SubSection Controller] Get subsections error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subsections from MySQL',
      error: error.message
    });
  }
};

// GET /api/mysql-subsections
exports.list = async (req, res, next) => {
  let conn;
  try {
    const { sectionId } = req.query;
    conn = await createMySQLConnection();

    let sql = 'SELECT * FROM sub_sections';
    const params = [];
    if (sectionId && sectionId !== 'all') {
      // Use section_code instead of section_id to match table schema
      // Frontend now sends section code as the ID
      sql += ' WHERE section_code = ?';
      params.push(String(sectionId));
    }
    // Avoid ordering by DB column names that may differ between schemas
    // (some deployments use `sub_name`, others use `sub_section_name`).
    // Fetch rows and perform stable ordering in JavaScript after mapping.
    const [rows] = await conn.execute(sql, params);
    const mapped = rows.map(mapRow);

    // Sort by subSection.sub_hie_name (case-insensitive), fallback to empty string
    mapped.sort((a, b) => {
      const na = (a?.subSection?.sub_hie_name || '').toString().toLowerCase();
      const nb = (b?.subSection?.sub_hie_name || '').toString().toLowerCase();
      if (na < nb) return -1;
      if (na > nb) return 1;
      return 0;
    });

    return res.json({ success: true, data: mapped });
  } catch (err) {
    console.error('[MySQL] list subsections failed:', err);
    next(err);
  } finally {
    if (conn) await conn.end();
  }
};

// POST /api/mysql-subsections
exports.create = async (req, res, next) => {
  let conn;
  try {
    const { parentDivision, parentSection, subSection } = req.body || {};

    if (!parentDivision?.id || !parentSection?.id) {
      return res.status(400).json({ success: false, message: 'Parent division and section are required.' });
    }
    const nameValue = subSection?.sub_hie_name || subSection?.hie_name || subSection?.name;
    const codeValue = subSection?.sub_hie_code || subSection?.hie_code || subSection?.code;
    if (!nameValue || !String(nameValue).trim() || !codeValue || !String(codeValue).trim()) {
      return res.status(400).json({ success: false, message: 'Sub-section name and code are required.' });
    }

    const payload = {
      division_id: String(parentDivision.id),
      division_code: parentDivision.division_code || parentDivision.code || null,
      division_name: parentDivision.division_name || parentDivision.name || null,
      section_id: String(parentSection.id),
      section_code: parentSection.hie_code || parentSection.code || null,
      section_name: parentSection.hie_name || parentSection.name || null,
      sub_name: String(nameValue).trim(),
      sub_code: String(codeValue).trim().toUpperCase()
    };

    conn = await createMySQLConnection();
    const sql = `INSERT INTO sub_sections
      (division_code, division_name, section_code, section_name, sub_section_name, sub_section_code)
      VALUES (?, ?, ?, ?, ?, ?)`;
    const params = [
      payload.division_code, payload.division_name,
      payload.section_code, payload.section_name,
      payload.sub_name, payload.sub_code
    ];

    await conn.execute(sql, params);

    // Fetch created row id
    const [row] = await conn.execute('SELECT * FROM sub_sections WHERE section_code = ? AND sub_section_code = ? LIMIT 1', [payload.section_code, payload.sub_code]);
    const created = Array.isArray(row) && row[0] ? mapRow(row[0]) : null;

    // Log audit trail for MySQL sub-section creation
    if (req.user?._id) {
      try {
        await AuditLog.createLog({
          user: req.user._id,
          action: 'mysql_subsection_created',
          entity: { type: 'MySQLSubSection', id: created?._id, name: payload.sub_name },
          category: 'data_modification',
          severity: 'medium',
          description: `MySQL Sub-section "${payload.sub_name}" created`,
          details: `Created MySQL sub-section "${payload.sub_name}" (${payload.sub_code}) under section "${payload.section_name}"`,
          metadata: {
            database: 'mysql',
            sectionId: payload.section_id,
            sectionName: payload.section_name,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            method: req.method,
            endpoint: req.originalUrl
          }
        });
      } catch (auditErr) {
        console.error('[AuditLog] Failed to log MySQL sub-section creation:', auditErr);
      }
    }

    return res.status(201).json({ success: true, message: 'Sub-section created successfully', data: created });
  } catch (err) {
    // Duplicate entry
    if (err && err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Sub-section code already exists in this section' });
    }
    console.error('[MySQL] create subsection failed:', err);
    next(err);
  } finally {
    if (conn) await conn.end();
  }
};

// PUT /api/mysql-subsections/:id
exports.update = async (req, res, next) => {
  let conn;
  try {
    const { id } = req.params;
    const { name, code, sub_hie_name, sub_hie_code, hie_name, hie_code } = req.body || {};

    const newName = (sub_hie_name || hie_name || name || '').toString().trim();
    const newCode = (sub_hie_code || hie_code || code || '').toString().trim().toUpperCase();

    if (!newName && !newCode) {
      return res.status(400).json({ success: false, message: 'Nothing to update' });
    }

    conn = await createMySQLConnection();

    const setParts = [];
    const params = [];
    if (newName) { setParts.push('sub_section_name = ?'); params.push(newName); }
    if (newCode) { setParts.push('sub_section_code = ?'); params.push(newCode); }
    params.push(String(id));

    const sql = `UPDATE sub_sections SET ${setParts.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    const [result] = await conn.execute(sql, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Sub-section not found' });
    }

    const [rows] = await conn.execute('SELECT * FROM sub_sections WHERE id = ? LIMIT 1', [String(id)]);
    const updated = Array.isArray(rows) && rows[0] ? mapRow(rows[0]) : null;

    // Log audit trail for MySQL sub-section update
    if (req.user?._id) {
      try {
        await AuditLog.createLog({
          user: req.user._id,
          action: 'mysql_subsection_updated',
          entity: { type: 'MySQLSubSection', id: id, name: updated?.subSection?.sub_hie_name },
          category: 'data_modification',
          severity: 'medium',
          description: `MySQL Sub-section updated`,
          details: `Updated MySQL sub-section to "${newName}" (${newCode})`,
          changes: { after: { name: newName, code: newCode } },
          metadata: {
            database: 'mysql',
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            method: req.method,
            endpoint: req.originalUrl
          }
        });
      } catch (auditErr) {
        console.error('[AuditLog] Failed to log MySQL sub-section update:', auditErr);
      }
    }

    return res.json({ success: true, message: 'Sub-section updated successfully', data: updated });
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Sub-section code already exists in this section' });
    }
    console.error('[MySQL] update subsection failed:', err);
    next(err);
  } finally {
    if (conn) await conn.end();
  }
};

// DELETE /api/mysql-subsections/:id
exports.remove = async (req, res, next) => {
  let conn;
  try {
    const { id } = req.params;
    conn = await createMySQLConnection();
    
    // Fetch the subsection before deletion for audit log
    const [existingRows] = await conn.execute('SELECT * FROM sub_sections WHERE id = ? LIMIT 1', [String(id)]);
    const existing = Array.isArray(existingRows) && existingRows[0] ? existingRows[0] : null;
    
    // Check if there are any transferred employees in this sub-section
    const [transferCheck] = await conn.execute('SELECT COUNT(*) as count FROM transferred_employees WHERE sub_section_id = ? AND transferred_status = TRUE', [String(id)]);
    const transferredCount = transferCheck[0]?.count || 0;
    if (transferredCount > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot delete sub-section that has ${transferredCount} transferred employee(s). Please recall all transfers first.` 
      });
    }
    
    const [result] = await conn.execute('DELETE FROM sub_sections WHERE id = ?', [String(id)]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Sub-section not found' });
    }

    // Log audit trail for MySQL sub-section deletion
    if (req.user?._id) {
      try {
        await AuditLog.createLog({
          user: req.user._id,
          action: 'mysql_subsection_deleted',
          entity: { type: 'MySQLSubSection', id: id, name: existing?.sub_name },
          category: 'data_modification',
          severity: 'high',
          description: `MySQL Sub-section "${existing?.sub_name || id}" deleted`,
          details: `Deleted MySQL sub-section "${existing?.sub_name}" (${existing?.sub_code}) from section "${existing?.section_name}"`,
          metadata: {
            database: 'mysql',
            deletedData: existing,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            method: req.method,
            endpoint: req.originalUrl
          }
        });
      } catch (auditErr) {
        console.error('[AuditLog] Failed to log MySQL sub-section deletion:', auditErr);
      }
    }

    return res.json({ success: true, message: 'Sub-section deleted successfully' });
  } catch (err) {
    console.error('[MySQL] delete subsection failed:', err);
    next(err);
  } finally {
    if (conn) await conn.end();
  }
};

// Export the new function for mysqlData routes
exports.getMySQLSubSections = getMySQLSubSections;
