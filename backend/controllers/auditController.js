const { fetchAuditReport } = require('../models/auditModel');

async function getAuditReport(req, res) {
  try {
    const body = req.body || {};
    const { from_date, to_date } = body;
    if (!from_date || !to_date) {
      return res.status(400).json({ success: false, message: 'from_date and to_date are required' });
    }

    const result = await fetchAuditReport(body);
    // If no records
    if (!result || !result.data || (Array.isArray(result.data) && result.data.length === 0)) {
      return res.status(200).json({ success: true, data: [], summary: { totalEmployees: 0, totalGroups: 0, totalRecords: 0 }, dateRange: { from: from_date, to: to_date }, grouping: body.grouping || 'none' });
    }

    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('auditController.getAuditReport error:', err);
    return res.status(500).json({ success: false, message: 'Server error generating audit report' });
  }
}

module.exports = { getAuditReport };
