const express = require('express');
const router = express.Router();

// Placeholder MySQL activity route. This avoids server startup failures when the original
// `routes/mysqlActivity` file is missing. You can expand this to query a MySQL activity
// table (e.g., `mysql_activity` or `activities`) using `createMySQLConnection()` from
// `../config/mysql` if you want to expose real activity logs.

// GET /api/mysql-activities/ -> summary
router.get('/', async (req, res) => {
  try {
    return res.status(200).json({ success: true, data: [], message: 'MySQL activity route placeholder' });
  } catch (err) {
    console.error('mysqlActivity route error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
