const express = require('express');
const { getEmployeesWithStats } = require('../controllers/employeeController');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Public for now; in future restrict with auth
router.get('/', /*auth,*/ getEmployeesWithStats);

module.exports = router;
