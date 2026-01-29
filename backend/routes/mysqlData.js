/**
 * MySQL Data Routes - Fast data access from synced MySQL tables
 * These endpoints replace HRIS API calls with MySQL queries
 */

const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { 
  cacheEmployeeData, 
  saveToCache 
} = require('../middleware/employeeCacheMiddleware');
const {
  cacheDivisions,
  cacheSections,
  cacheSubSections
} = require('../middleware/managementCacheMiddleware');

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

const {
  getEmployeesByDivisionFromIndex,
  getDivisionsWithCountsFromIndex,
  getISEmployeesWithAttendance
} = require('../controllers/mysqlEmpIndexController');

// Divisions (with dual Redis caching - employee management + division management)
router.get('/divisions', 
  cacheDivisions(),
  cacheEmployeeData('divisions'), 
  saveToCache(600), 
  getMySQLDivisions
);
router.get('/divisions/:code', getMySQLDivisionByCode);

// Sections (with dual Redis caching - employee management + section management)
router.get('/sections', 
  cacheSections(),
  cacheEmployeeData('sections'), 
  saveToCache(600), 
  getMySQLSections
);
router.get('/sections/:code', getMySQLSectionByCode);

// Subsections (with dual Redis caching - employee management + subsection management)
router.get('/subsections', 
  cacheSubSections(),
  cacheEmployeeData('subsections'), 
  saveToCache(600), 
  getMySQLSubSections
);
// Raw debug subsections (returns raw DB rows)
router.get('/subsections/raw', getRawMySQLSubSections);

// Employees (with Redis caching for employee management page - 5 min TTL)
router.get('/employees', 
  cacheEmployeeData('employees'), 
  saveToCache(300), 
  getMySQLEmployees
);
router.get('/employees/:empNo', getMySQLEmployeeByNumber);

// Attendance - Get unique employee IDs by date range
router.get('/attendance/employees-by-date', getEmployeesByDateFromAttendance);

// Emp Index List - Get employees by division
router.get('/emp-index/division/:divisionId', getEmployeesByDivisionFromIndex);
router.get('/emp-index/divisions', getDivisionsWithCountsFromIndex);
router.get('/emp-index/division/66/attendance', getISEmployeesWithAttendance);

module.exports = router;
