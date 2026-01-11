/**
 * Attendance Data Normalizer
 * 
 * Handles different scan type formats from various data sources
 * Provides unified normalization functions for audit reports
 * 
 * Created: January 11, 2026
 * Purpose: Standardize attendance punch types across different systems
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
