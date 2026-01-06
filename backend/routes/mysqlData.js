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
  getMySQLEmployees,
  getMySQLEmployeeByNumber
} = require('../controllers/mysqlEmployeeController');

// Divisions
router.get('/divisions', getMySQLDivisions);
router.get('/divisions/:code', getMySQLDivisionByCode);

// Sections
router.get('/sections', getMySQLSections);
router.get('/sections/:code', getMySQLSectionByCode);

// Employees
router.get('/employees', getMySQLEmployees);
router.get('/employees/:empNo', getMySQLEmployeeByNumber);

module.exports = router;
