const { createMySQLConnection } = require('../config/mysql');

// Map DB row -> API shape compatible with existing frontend usage
function mapRow(row) {
  return {
    _id: String(row.id),
    parentDivision: {
      id: String(row.division_id),
      division_code: row.division_code || '',
      division_name: row.division_name || ''
    },
    parentSection: {
      id: String(row.section_id),
      hie_code: row.section_code || '',
      hie_name: row.section_name || ''
    },
    subSection: {
      sub_hie_name: row.sub_name,
      sub_hie_code: row.sub_code
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// GET /api/mysql-subsections
exports.list = async (req, res, next) => {
  let conn;
  try {
    const { sectionId } = req.query;
    conn = await createMySQLConnection();

    let sql = 'SELECT * FROM subsections';
    const params = [];
    if (sectionId && sectionId !== 'all') {
      sql += ' WHERE section_id = ?';
      params.push(String(sectionId));
    }
    sql += ' ORDER BY sub_name ASC';

    const [rows] = await conn.execute(sql, params);
    return res.json({ success: true, data: rows.map(mapRow) });
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
    const sql = `INSERT INTO subsections
      (division_id, division_code, division_name, section_id, section_code, section_name, sub_name, sub_code)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    const params = [
      payload.division_id, payload.division_code, payload.division_name,
      payload.section_id, payload.section_code, payload.section_name,
      payload.sub_name, payload.sub_code
    ];

    await conn.execute(sql, params);

    // Fetch created row id
    const [row] = await conn.execute('SELECT * FROM subsections WHERE section_id = ? AND sub_code = ? LIMIT 1', [payload.section_id, payload.sub_code]);
    const created = Array.isArray(row) && row[0] ? mapRow(row[0]) : null;

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
    if (newName) { setParts.push('sub_name = ?'); params.push(newName); }
    if (newCode) { setParts.push('sub_code = ?'); params.push(newCode); }
    params.push(String(id));

    const sql = `UPDATE subsections SET ${setParts.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    const [result] = await conn.execute(sql, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Sub-section not found' });
    }

    const [rows] = await conn.execute('SELECT * FROM subsections WHERE id = ? LIMIT 1', [String(id)]);
    const updated = Array.isArray(rows) && rows[0] ? mapRow(rows[0]) : null;

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
    const [result] = await conn.execute('DELETE FROM subsections WHERE id = ?', [String(id)]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Sub-section not found' });
    }
    return res.json({ success: true, message: 'Sub-section deleted successfully' });
  } catch (err) {
    console.error('[MySQL] delete subsection failed:', err);
    next(err);
  } finally {
    if (conn) await conn.end();
  }
};
