/**
 * MySQL Data Routes - Fast data access from synced MySQL tables
 * These endpoints replace HRIS API calls with MySQL queries
 */

const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');

// Controllers
const {
  getMySQLDivisions,
  getMySQLDivisionByCode
} = require('../controllers/mysqlDivisionController');

const {
  getMySQLSections,
  getMySQLSectionByCode
} = require('../controllers/mysqlSectionController');

const {
  getMySQLSubSections
} = require('../controllers/mysqlSubSectionController');

const { getRawMySQLSubSections } = require('../controllers/mysqlSubSectionController');

const {
  getMySQLEmployees,
  getMySQLEmployeeByNumber,
  getEmployeesByDateFromAttendance
} = require('../controllers/mysqlEmployeeController');

// Divisions
router.get('/divisions', getMySQLDivisions);
router.get('/divisions/:code', getMySQLDivisionByCode);

// Sections
router.get('/sections', getMySQLSections);
router.get('/sections/:code', getMySQLSectionByCode);

// Subsections
router.get('/subsections', getMySQLSubSections);
// Raw debug subsections (returns raw DB rows)
router.get('/subsections/raw', getRawMySQLSubSections);

// Employees
router.get('/employees', getMySQLEmployees);
router.get('/employees/:empNo', getMySQLEmployeeByNumber);

// Attendance - Get unique employee IDs by date range
router.get('/attendance/employees-by-date', getEmployeesByDateFromAttendance);

module.exports = router;
