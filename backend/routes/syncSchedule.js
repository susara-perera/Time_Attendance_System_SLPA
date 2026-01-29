const express = require('express');
const router = express.Router();
const syncScheduleController = require('../controllers/syncScheduleController');
const { auth, authorize } = require('../middleware/auth');

// Get all schedules
router.get('/', auth, syncScheduleController.getSchedules);

// Update a schedule
router.put('/:task_id', auth, authorize('admin', 'super_admin'), syncScheduleController.updateSchedule);

// Trigger a schedule check now (admin only)
router.post('/check', auth, authorize('admin', 'super_admin'), syncScheduleController.checkNow);

module.exports = router;
