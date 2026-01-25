const express = require('express');
const AuditLog = require('../models/mysql/AuditLog');
const User = require('../models/mysql/User');
const { auth } = require('../middleware/auth');

const router = express.Router();

// @desc    List audit/activity logs (MySQL)
// @route   GET /api/activities
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const requestedLimit = parseInt(req.query.limit, 10);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 200) : 50;

    const logs = await AuditLog.findAll({
      where: { isArchived: false },
      order: [['createdAt', 'DESC']],
      limit: limit,
      include: [{
        model: User,
        as: 'user',
        attributes: ['firstName', 'lastName', 'email', 'employeeId']
      }]
    });

    return res.status(200).json({ success: true, data: logs });
  } catch (err) {
    console.error('Activities route error:', err);
    return res.status(500).json({ success: false, message: 'Server error fetching activities' });
  }
});

module.exports = router;
