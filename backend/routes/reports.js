const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
// const { getAuditReport } = require('../controllers/auditController'); // Disabled - needs reimplementation
const { generateMySQLAttendanceReport } = require('../controllers/reportController');

/*
 POST /api/reports/mysql/audit
 expected body:
 {
   from_date: "YYYY-MM-DD",
   to_date: "YYYY-MM-DD",
   time_period: "all" | "...",
   grouping: "punch" | "designation" | "none",
   division_id: "...",   // optional filter
   section_id: "...",
   sub_section_id: "..." // optional DB id
 }
 Response format:
 {
   success: true,
   data: [ { groupName, count, totalIssues?, employees: [ ... ] } ],
   summary: { totalEmployees, totalGroups, totalRecords, divisionFilter, sectionFilter },
   dateRange: { from, to },
   grouping: "punch"
 }
*/

// Lightweight route that delegates to controller + model
// router.post('/audit', auth, getAuditReport); // Disabled - needs reimplementation

// Attendance report (Individual/Group) using MySQL sync tables
router.post('/attendance', generateMySQLAttendanceReport);

module.exports = router;
