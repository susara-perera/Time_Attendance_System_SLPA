const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const {
  getDivisionsCount,
  getSectionsCount,
  getSubsectionsCount,
  getEmployeesCount,
  getISAttendance
} = require('../controllers/quickStatsController');

// Quick stat routes for progressive dashboard loading
router.get('/divisions', auth, getDivisionsCount);
router.get('/sections', auth, getSectionsCount);
router.get('/subsections', auth, getSubsectionsCount);
router.get('/employees', auth, getEmployeesCount);
router.get('/is-attendance', auth, getISAttendance);

module.exports = router;
