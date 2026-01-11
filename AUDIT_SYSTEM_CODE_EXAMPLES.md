# 🛠️ Audit System - Code Implementation Examples

**Purpose:** Ready-to-use code snippets for enhancing your audit system  
**Status:** Production-ready examples  

---

## 1️⃣ Scan Type Normalizer Utility

**File to Create:** `backend/utils/attendanceNormalizer.js`

This utility handles all the different ways scan types are represented in your database.

```javascript
/**
 * Attendance Data Normalizer
 * 
 * Handles different scan type formats from various data sources
 * Provides unified normalization functions
 */

// ============================================================================
// SCAN TYPE MAPPINGS
// ============================================================================

const SCAN_TYPE_MAPPINGS = {
  // Entry/Check-In variants (various systems use different codes)
  'IN': 'IN',
  '08': 'IN',
  'I': 'IN',
  'CHECK_IN': 'IN',
  'ENTRY': 'IN',
  '1': 'IN',
  'F1': 'IN',
  'PUNCH_IN': 'IN',
  
  // Exit/Check-Out variants
  'OUT': 'OUT',
  '46': 'OUT',
  'O': 'OUT',
  'CHECK_OUT': 'OUT',
  'EXIT': 'OUT',
  '0': 'OUT',
  'F2': 'OUT',
  'PUNCH_OUT': 'OUT'
};

/**
 * Normalize a scan type value to standard IN/OUT/UNKNOWN
 * 
 * @param {string} rawType - Raw scan type from database
 * @returns {string} - Normalized type: 'IN', 'OUT', or 'UNKNOWN'
 * 
 * @example
 * normalizeScanType('08');       // Returns 'IN'
 * normalizeScanType('IN');       // Returns 'IN'
 * normalizeScanType('46');       // Returns 'OUT'
 * normalizeScanType('OUT');      // Returns 'OUT'
 * normalizeScanType('UNKNOWN');  // Returns 'UNKNOWN'
 */
function normalizeScanType(rawType) {
  if (!rawType) return 'UNKNOWN';
  
  const upperType = String(rawType).toUpperCase().trim();
  const normalized = SCAN_TYPE_MAPPINGS[upperType];
  
  return normalized || 'UNKNOWN';
}

/**
 * Check if a scan type represents entry/check-in
 * 
 * @param {string} scanType - Scan type (raw or normalized)
 * @returns {boolean} - True if this is an entry punch
 */
function isScanTypeIn(scanType) {
  return normalizeScanType(scanType) === 'IN';
}

/**
 * Check if a scan type represents exit/check-out
 * 
 * @param {string} scanType - Scan type (raw or normalized)
 * @returns {boolean} - True if this is an exit punch
 */
function isScanTypeOut(scanType) {
  return normalizeScanType(scanType) === 'OUT';
}

/**
 * Categorize incomplete punch issues
 * 
 * @param {string} scanType - The punch type found
 * @returns {object} - Issue details with severity and description
 * 
 * @example
 * categorizeIncompleteIssue('IN');
 * // Returns:
 * // {
 * //   issueType: 'CHECK_IN_ONLY',
 * //   displayLabel: '❌ CHECK IN ONLY (Missing Check Out)',
 * //   severity: 'HIGH',
 * //   description: 'Employee checked in but did not check out',
 * //   recommendation: 'Follow up with employee about unexpected departure'
 * // }
 */
function categorizeIncompleteIssue(scanType) {
  const normalizedType = normalizeScanType(scanType);
  
  switch (normalizedType) {
    case 'IN':
      return {
        issueType: 'CHECK_IN_ONLY',
        displayLabel: '❌ CHECK IN ONLY (Missing Check Out)',
        severity: 'HIGH',
        description: 'Employee checked in but did not check out',
        recommendation: 'Follow up with employee about unexpected departure or system error'
      };
      
    case 'OUT':
      return {
        issueType: 'CHECK_OUT_ONLY',
        displayLabel: '⚠️ CHECK OUT ONLY (Missing Check In)',
        severity: 'MEDIUM',
        description: 'Employee checked out without a corresponding check-in',
        recommendation: 'Verify if this is a system error or missed morning punch'
      };
      
    default:
      return {
        issueType: 'UNKNOWN_PUNCH',
        displayLabel: '? UNKNOWN PUNCH TYPE',
        severity: 'LOW',
        description: 'Unknown punch type detected',
        recommendation: 'Review punch type value in database'
      };
  }
}

/**
 * Normalize an attendance record from any source
 * 
 * @param {object} record - Raw attendance record from database
 * @param {string} source - Data source: 'mysql', 'mongodb', 'biometric', etc.
 * @returns {object} - Normalized record with standard fields
 * 
 * @example
 * const mysqlRecord = { employee_ID: 'E001', date_: '2025-01-10', time_: '09:30', scan_type: '08' };
 * normalizeAttendanceRecord(mysqlRecord, 'mysql');
 * // Returns:
 * // {
 * //   employeeId: 'E001',
 * //   punchDate: '2025-01-10',
 * //   punchTime: '09:30',
 * //   scanType: 'IN',
 * //   source: 'mysql'
 * // }
 */
function normalizeAttendanceRecord(record, source = 'mysql') {
  switch (source.toLowerCase()) {
    case 'mysql':
      return {
        employeeId: String(record.employee_ID || record.emp_no || ''),
        punchDate: record.date_,
        punchTime: record.time_,
        scanType: normalizeScanType(record.scan_type),
        rawScanType: record.scan_type,
        source: 'mysql'
      };
      
    case 'mongodb':
      return {
        employeeId: String(record.user?.employeeId || record.employeeId || ''),
        punchDate: record.date,
        punchTime: record.checkIn?.time || record.checkOut?.time || '',
        scanType: record.checkIn ? 'IN' : (record.checkOut ? 'OUT' : 'UNKNOWN'),
        rawScanType: record.checkIn ? 'IN' : (record.checkOut ? 'OUT' : 'UNKNOWN'),
        source: 'mongodb'
      };
      
    case 'biometric':
      return {
        employeeId: String(record.user_id || record.empID || ''),
        punchDate: record.punch_date,
        punchTime: record.punch_time,
        scanType: normalizeScanType(record.direction),
        rawScanType: record.direction,
        source: 'biometric'
      };
      
    default:
      // Generic normalization
      return {
        employeeId: String(record.employee_ID || record.employeeId || record.emp_id || ''),
        punchDate: record.date_ || record.date || record.punchDate || '',
        punchTime: record.time_ || record.time || record.punchTime || '',
        scanType: normalizeScanType(record.scan_type || record.type || record.direction || ''),
        rawScanType: record.scan_type || record.type || record.direction || '',
        source: source || 'unknown'
      };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  SCAN_TYPE_MAPPINGS,
  normalizeScanType,
  isScanTypeIn,
  isScanTypeOut,
  categorizeIncompleteIssue,
  normalizeAttendanceRecord
};
```

**Usage Example in auditModel.js:**

```javascript
const { 
  normalizeScanType, 
  isScanTypeIn, 
  categorizeIncompleteIssue,
  normalizeAttendanceRecord 
} = require('../utils/attendanceNormalizer');

// ... in your audit report function

rows.forEach(record => {
  // Normalize the scan type
  const normalizedType = normalizeScanType(record.scan_type);
  
  // Check if it's a check-in only record
  if (isScanTypeIn(normalizedType)) {
    // Get issue details
    const issueDetails = categorizeIncompleteIssue(normalizedType);
    
    // Use in your grouping logic
    console.log(issueDetails.displayLabel); // ❌ CHECK IN ONLY (Missing Check Out)
  }
});
```

---

## 2️⃣ Enhanced Punch Grouping Logic

**File to Modify:** `backend/models/auditModel.js`

Replace the punch grouping section with this improved version:

```javascript
// ============================================================================
// ENHANCED PUNCH GROUPING WITH EXPLICIT ISSUE IDENTIFICATION
// ============================================================================

if (grouping === 'punch') {
  console.log(`\n🔍 Building PUNCH-WISE audit report...`);
  
  const { 
    normalizeScanType, 
    isScanTypeIn, 
    categorizeIncompleteIssue 
  } = require('../utils/attendanceNormalizer');

  // Improved query with explicit scan_type in order
  const sql = `
    SELECT
      a.employee_ID AS employeeId,
      e.employee_name AS employeeName,
      e.designation AS designation,
      a.date_ AS eventDate,
      a.time_ AS eventTime,
      a.scan_type AS scanType,
      e.division AS divisionName,
      e.section AS sectionName,
      CONCAT(a.date_, ' ', COALESCE(a.time_, '00:00:00')) AS eventTimestamp
    FROM attendance a
    LEFT JOIN employees e ON a.employee_ID = e.employee_ID
    WHERE a.date_ BETWEEN ? AND ?
    ${whereExtra}
    ORDER BY a.scan_type ASC, a.date_ ASC, a.time_ ASC, e.employee_name ASC
    LIMIT 50000
  `;
  
  const [rows] = await conn.execute(sql, params);
  
  // Group by scan type with explicit categorization
  const groupMap = new Map();
  const incompleteIssues = [];
  
  rows.forEach((record, index) => {
    // Normalize scan type
    const normalizedType = normalizeScanType(record.scanType);
    
    // Get issue category
    const issueCategory = categorizeIncompleteIssue(normalizedType);
    
    // Use issue type as group key
    const groupKey = issueCategory.issueType;
    
    // Initialize group if not exists
    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, {
        groupName: issueCategory.displayLabel,
        issueType: groupKey,
        severity: issueCategory.severity,
        description: issueCategory.description,
        punchType: normalizedType,
        employees: [],
        count: 0,
        statistics: {
          byDesignation: {},
          byDivision: {}
        }
      });
    }
    
    // Create employee record
    const employeeRecord = {
      employeeId: record.employeeId,
      employeeName: record.employeeName,
      designation: record.designation || 'Unassigned',
      eventDate: record.eventDate,
      eventTime: record.eventTime,
      divisionName: record.divisionName || 'N/A',
      sectionName: record.sectionName || 'N/A',
      scanType: normalizedType,
      rawScanType: record.scanType,
      severity: issueCategory.severity
    };
    
    const group = groupMap.get(groupKey);
    group.employees.push(employeeRecord);
    group.count = group.employees.length;
    
    // Update statistics
    const designationKey = employeeRecord.designation;
    const divisionKey = employeeRecord.divisionName;
    
    if (!group.statistics.byDesignation[designationKey]) {
      group.statistics.byDesignation[designationKey] = 0;
    }
    if (!group.statistics.byDivision[divisionKey]) {
      group.statistics.byDivision[divisionKey] = 0;
    }
    
    group.statistics.byDesignation[designationKey]++;
    group.statistics.byDivision[divisionKey]++;
    
    // Track for summary
    if (index < 5) {
      incompleteIssues.push({
        employee: employeeRecord.employeeName,
        date: employeeRecord.eventDate,
        issue: issueCategory.displayLabel
      });
    }
  });
  
  // Convert to array and sort by severity, then count
  const groups = Array.from(groupMap.values())
    .sort((a, b) => {
      const severityOrder = { 'HIGH': 0, 'MEDIUM': 1, 'LOW': 2 };
      const sevDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (sevDiff !== 0) return sevDiff;
      return b.count - a.count; // Then by count, descending
    });
  
  const totalEmployees = new Set(rows.map(r => r.employeeId)).size;
  const totalRecords = rows.length;
  
  const summary = {
    totalEmployees,
    totalGroups: groups.length,
    totalRecords,
    divisionFilter: division_id || 'All',
    sectionFilter: section_id || 'All',
    subSectionFilter: sub_section_id || 'All',
    issueBreakdown: {
      checkInOnly: groupMap.get('CHECK_IN_ONLY')?.count || 0,
      checkOutOnly: groupMap.get('CHECK_OUT_ONLY')?.count || 0,
      unknown: groupMap.get('UNKNOWN_PUNCH')?.count || 0
    }
  };
  
  if (incompleteIssues.length > 0) {
    console.log(`\n⚠️ Sample Incomplete Punch Issues:`);
    incompleteIssues.forEach(issue => {
      console.log(`   ${issue.employee} on ${issue.date}: ${issue.issue}`);
    });
  }
  
  console.log(`✅ Punch-Wise Report: ${totalRecords} records, ${totalEmployees} employees, ${groups.length} punch types`);
  
  return { 
    data: groups, 
    summary, 
    dateRange: { from: from_date, to: to_date }, 
    grouping: 'punch' 
  };
}
```

---

## 3️⃣ Filter Validation Utility

**File to Create:** `backend/utils/filterValidator.js`

Handle division/section filters consistently:

```javascript
/**
 * Filter Validation and Normalization
 * 
 * Provides consistent filter handling across all audit reports
 */

// ============================================================================
// FILTER NORMALIZATION
// ============================================================================

/**
 * Normalize a filter ID value
 * Converts null, undefined, empty string, or 'all' to null
 * 
 * @param {string|null} id - Filter ID value
 * @returns {string|null} - Normalized ID or null if empty
 */
function normalizeId(id) {
  if (!id) return null;
  
  const trimmed = String(id).trim().toLowerCase();
  
  // Convert common "empty" values to null
  if (trimmed === '' || trimmed === 'all' || trimmed === 'none' || trimmed === 'undefined') {
    return null;
  }
  
  return String(id).trim();
}

/**
 * Validate filter structure
 * 
 * @param {object} filters - Filter object
 * @returns {object} - Validated and normalized filters
 * 
 * @example
 * validateFilters({
 *   division_id: 'DIV001',
 *   section_id: 'all',
 *   sub_section_id: ''
 * });
 * // Returns: { division_id: 'DIV001', section_id: null, sub_section_id: null }
 */
function validateFilters(filters) {
  return {
    division_id: normalizeId(filters.division_id),
    section_id: normalizeId(filters.section_id),
    sub_section_id: normalizeId(filters.sub_section_id),
    from_date: filters.from_date,
    to_date: filters.to_date
  };
}

/**
 * Build WHERE clause fragment for filters
 * 
 * @param {object} filters - Normalized filters
 * @param {object} options - Configuration
 * @returns {object} - { whereClause: string, params: array }
 * 
 * @example
 * buildWhereClauseForFilters(
 *   { division_id: 'DIV001', section_id: null },
 *   { tableAlias: 'e', fieldMappings: {...} }
 * );
 * // Returns: {
 * //   whereClause: 'AND e.division_id = ?',
 * //   params: ['DIV001']
 * // }
 */
function buildWhereClauseForFilters(filters, options = {}) {
  const {
    tableAlias = 'e',
    fieldMappings = {
      division: 'division_id',
      section: 'section_id',
      subSection: 'sub_section_id'
    }
  } = options;
  
  const clauses = [];
  const params = [];
  
  // Add division filter if provided
  if (filters.division_id) {
    clauses.push(`${tableAlias}.${fieldMappings.division} = ?`);
    params.push(filters.division_id);
  }
  
  // Add section filter if provided (only if division not specified, or if we want both)
  if (filters.section_id) {
    clauses.push(`${tableAlias}.${fieldMappings.section} = ?`);
    params.push(filters.section_id);
  }
  
  // Add sub-section filter if provided
  if (filters.sub_section_id) {
    clauses.push(`${tableAlias}.${fieldMappings.subSection} = ?`);
    params.push(filters.sub_section_id);
  }
  
  return {
    whereClause: clauses.length > 0 ? `AND ${clauses.join(' AND ')}` : '',
    params
  };
}

/**
 * Check if any filters are applied
 * 
 * @param {object} filters - Filter object
 * @returns {boolean} - True if any meaningful filter is applied
 */
function hasFilters(filters) {
  return !!(
    filters.division_id || 
    filters.section_id || 
    filters.sub_section_id
  );
}

/**
 * Get a human-readable filter description
 * 
 * @param {object} filters - Filter object
 * @returns {string} - Description of applied filters
 * 
 * @example
 * getFilterDescription({ division_id: 'IT', section_id: null });
 * // Returns: "Division: IT"
 */
function getFilterDescription(filters) {
  const parts = [];
  
  if (filters.division_id) {
    parts.push(`Division: ${filters.division_id}`);
  }
  if (filters.section_id) {
    parts.push(`Section: ${filters.section_id}`);
  }
  if (filters.sub_section_id) {
    parts.push(`Sub-Section: ${filters.sub_section_id}`);
  }
  
  return parts.length > 0 ? parts.join(' | ') : 'No filters applied';
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  normalizeId,
  validateFilters,
  buildWhereClauseForFilters,
  hasFilters,
  getFilterDescription
};
```

**Usage Example:**

```javascript
const { validateFilters, buildWhereClauseForFilters } = require('../utils/filterValidator');

// In your audit report function:
const filters = validateFilters(req.body);

const { whereClause, params: filterParams } = buildWhereClauseForFilters(filters, {
  tableAlias: 'e',
  fieldMappings: {
    division: 'division_id',
    section: 'section_id',
    subSection: 'sub_section_id'
  }
});

// Then use in your SQL:
const sql = `
  SELECT ... FROM attendance a
  LEFT JOIN employees e ON a.employee_ID = e.employee_ID
  WHERE a.date_ BETWEEN ? AND ?
  ${whereClause}
`;

const combinedParams = [from_date, to_date, ...filterParams];
const [rows] = await conn.execute(sql, combinedParams);
```

---

## 4️⃣ Enhanced API Response Generator

**File Location:** In your audit controller/model

```javascript
/**
 * Build enhanced audit report response with detailed metadata
 * 
 * @param {array} groups - Array of grouped results
 * @param {object} params - Report parameters
 * @returns {object} - Formatted response ready for frontend
 */
function buildAuditReportResponse(groups, params) {
  const {
    from_date,
    to_date,
    grouping,
    division_id,
    section_id,
    sub_section_id,
    totalRecords,
    rawData
  } = params;

  // Calculate statistics
  const allEmployees = new Set();
  groups.forEach(group => {
    (group.employees || []).forEach(emp => {
      allEmployees.add(emp.employeeId);
    });
  });

  // Build summary with additional context
  const summary = {
    totalEmployees: allEmployees.size,
    totalGroups: groups.length,
    totalRecords: totalRecords || 0,
    
    // Filter information
    filters: {
      applied: {
        division: division_id || null,
        section: section_id || null,
        subSection: sub_section_id || null,
        dateRange: { from: from_date, to: to_date }
      },
      filterCount: [division_id, section_id, sub_section_id].filter(Boolean).length
    },
    
    // Grouping information
    reportStructure: {
      groupingMode: grouping,
      groupsCount: groups.length,
      displayFormat: getGroupingFormatInfo(grouping)
    },
    
    // Generation metadata
    metadata: {
      generatedAt: new Date().toISOString(),
      generatedBy: 'audit-system',
      dataSource: 'MySQL attendance + employees_sync',
      version: '1.0'
    }
  };

  // Add issue breakdown for punch grouping
  if (grouping === 'punch') {
    summary.incompleteIssues = {
      checkInOnly: groups.find(g => g.issueType === 'CHECK_IN_ONLY')?.count || 0,
      checkOutOnly: groups.find(g => g.issueType === 'CHECK_OUT_ONLY')?.count || 0,
      unknown: groups.find(g => g.issueType === 'UNKNOWN_PUNCH')?.count || 0
    };
  }

  // Add department breakdown for designation grouping
  if (grouping === 'designation') {
    summary.departmentBreakdown = groups.map(g => ({
      designation: g.groupName,
      employeeCount: g.count,
      percentage: ((g.count / allEmployees.size) * 100).toFixed(1)
    }));
  }

  return {
    success: true,
    reportType: 'audit',
    data: groups,
    summary,
    dateRange: { from: from_date, to: to_date },
    grouping: grouping,
    apiVersion: '1.0'
  };
}

function getGroupingFormatInfo(grouping) {
  const formats = {
    'punch': {
      label: 'Punch Type Report',
      columns: ['Employee ID', 'Name', 'Designation', 'Date', 'Time'],
      purpose: 'Identify incomplete punches (check-in only or check-out only)'
    },
    'designation': {
      label: 'Designation Wise Report',
      columns: ['Employee ID', 'Name', 'Designation', 'Division'],
      purpose: 'Group employees by job title to analyze role-specific patterns'
    },
    'none': {
      label: 'Summary Report',
      columns: ['Employee ID', 'Name', 'Designation', 'Issue Count', 'Division'],
      purpose: 'Quick overview of affected employees with issue frequency'
    }
  };
  
  return formats[grouping] || formats['none'];
}
```

---

## 5️⃣ Complete Testing Script

**File to Create:** `backend/tests/audit-system.test.js`

```javascript
/**
 * Comprehensive Audit System Tests
 * 
 * Run with: npm test -- --testNamePattern="Audit System"
 */

const request = require('supertest');
const app = require('../server');

describe('Audit System', () => {
  let authToken = null;
  
  // Setup: Get auth token before tests
  beforeAll(async () => {
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@example.com',
        password: 'password'
      });
    
    authToken = loginResponse.body.token;
  });

  // ============================================================================
  // TEST SUITE 1: Punch Grouping Mode
  // ============================================================================
  
  describe('Punch Grouping (grouping: punch)', () => {
    it('should return incomplete punch records grouped by type', async () => {
      const response = await request(app)
        .post('/api/reports/audit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          from_date: '2025-01-01',
          to_date: '2025-01-31',
          grouping: 'punch'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.grouping).toBe('punch');
      expect(Array.isArray(response.body.data)).toBe(true);
      
      // Verify structure
      response.body.data.forEach(group => {
        expect(group.groupName).toBeDefined();
        expect(Array.isArray(group.employees)).toBe(true);
        expect(group.count).toBeGreaterThan(0);
      });
    });
    
    it('should properly categorize check-in only vs check-out only', async () => {
      const response = await request(app)
        .post('/api/reports/audit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          from_date: '2025-01-01',
          to_date: '2025-01-31',
          grouping: 'punch'
        });
      
      expect(response.status).toBe(200);
      
      const groups = response.body.data;
      const hasCheckInOnly = groups.some(g => 
        g.issueType === 'CHECK_IN_ONLY' || g.groupName.includes('CHECK IN ONLY')
      );
      const hasCheckOutOnly = groups.some(g => 
        g.issueType === 'CHECK_OUT_ONLY' || g.groupName.includes('CHECK OUT ONLY')
      );
      
      // At least one type should exist (depending on data)
      expect(hasCheckInOnly || hasCheckOutOnly).toBe(true);
    });
    
    it('should include date and time for each punch', async () => {
      const response = await request(app)
        .post('/api/reports/audit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          from_date: '2025-01-01',
          to_date: '2025-01-31',
          grouping: 'punch'
        });
      
      expect(response.status).toBe(200);
      
      const allEmployees = response.body.data.flatMap(g => g.employees);
      allEmployees.forEach(emp => {
        expect(emp.eventDate).toBeDefined();
        expect(emp.eventTime).toBeDefined();
        expect(emp.scanType).toMatch(/^(IN|OUT|UNKNOWN)$/);
      });
    });
  });

  // ============================================================================
  // TEST SUITE 2: Designation Grouping Mode
  // ============================================================================
  
  describe('Designation Grouping (grouping: designation)', () => {
    it('should return employees grouped by designation', async () => {
      const response = await request(app)
        .post('/api/reports/audit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          from_date: '2025-01-01',
          to_date: '2025-01-31',
          grouping: 'designation'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.grouping).toBe('designation');
      
      // Each group should be a designation
      response.body.data.forEach(group => {
        expect(typeof group.groupName).toBe('string');
        expect(Array.isArray(group.employees)).toBe(true);
        
        // All employees in a group should have same or compatible designation
        group.employees.forEach(emp => {
          expect(emp.designation).toBeDefined();
        });
      });
    });
    
    it('should aggregate employee counts per designation', async () => {
      const response = await request(app)
        .post('/api/reports/audit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          from_date: '2025-01-01',
          to_date: '2025-01-31',
          grouping: 'designation'
        });
      
      expect(response.status).toBe(200);
      
      response.body.data.forEach(group => {
        expect(group.count).toBe(group.employees.length);
      });
    });
  });

  // ============================================================================
  // TEST SUITE 3: Summary Grouping Mode
  // ============================================================================
  
  describe('Summary Grouping (grouping: none)', () => {
    it('should return all employees with issue counts', async () => {
      const response = await request(app)
        .post('/api/reports/audit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          from_date: '2025-01-01',
          to_date: '2025-01-31',
          grouping: 'none'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.grouping).toBe('none');
      expect(Array.isArray(response.body.data)).toBe(true);
    });
    
    it('should be sorted by issue count (descending)', async () => {
      const response = await request(app)
        .post('/api/reports/audit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          from_date: '2025-01-01',
          to_date: '2025-01-31',
          grouping: 'none'
        });
      
      expect(response.status).toBe(200);
      
      const employees = response.body.data[0]?.employees || [];
      
      for (let i = 1; i < employees.length; i++) {
        expect(employees[i - 1].issueCount).toBeGreaterThanOrEqual(
          employees[i].issueCount
        );
      }
    });
  });

  // ============================================================================
  // TEST SUITE 4: Filters
  // ============================================================================
  
  describe('Filtering', () => {
    it('should filter by division', async () => {
      const response = await request(app)
        .post('/api/reports/audit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          from_date: '2025-01-01',
          to_date: '2025-01-31',
          grouping: 'none',
          division_id: 'IT'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.summary.divisionFilter).toBe('IT');
    });
    
    it('should filter by section', async () => {
      const response = await request(app)
        .post('/api/reports/audit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          from_date: '2025-01-01',
          to_date: '2025-01-31',
          grouping: 'none',
          section_id: 'DEV001'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.summary.sectionFilter).toBe('DEV001');
    });
  });

  // ============================================================================
  // TEST SUITE 5: Error Handling
  // ============================================================================
  
  describe('Error Handling', () => {
    it('should reject request without from_date', async () => {
      const response = await request(app)
        .post('/api/reports/audit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          to_date: '2025-01-31',
          grouping: 'punch'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
    
    it('should reject request without to_date', async () => {
      const response = await request(app)
        .post('/api/reports/audit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          from_date: '2025-01-01',
          grouping: 'punch'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
    
    it('should reject invalid date format', async () => {
      const response = await request(app)
        .post('/api/reports/audit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          from_date: '01/01/2025',  // Wrong format
          to_date: '2025-01-31',
          grouping: 'punch'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
    
    it('should reject when from_date is after to_date', async () => {
      const response = await request(app)
        .post('/api/reports/audit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          from_date: '2025-01-31',
          to_date: '2025-01-01',
          grouping: 'punch'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
});
```

---

## 🎯 Implementation Checklist

- [ ] Copy scan type normalizer to `backend/utils/attendanceNormalizer.js`
- [ ] Copy filter validator to `backend/utils/filterValidator.js`
- [ ] Update `backend/models/auditModel.js` with enhanced punch grouping
- [ ] Update audit controller to use new response builder
- [ ] Add test file `backend/tests/audit-system.test.js`
- [ ] Run tests: `npm test -- --testNamePattern="Audit System"`
- [ ] Test manually with different grouping modes
- [ ] Deploy to staging
- [ ] Get user feedback
- [ ] Deploy to production

---

**Ready to implement?** Start with the normalizer utility and test it with sample data!

