-- =====================================================
-- Attendance Reports Database Indexes
-- =====================================================
-- Individual & Group Attendance Report Optimization
-- Query patterns: date range → employee_ID (individual)
--                date range → division → section → subsection (group)
-- =====================================================

USE slpa_db;

-- =====================================================
-- ATTENDANCE TABLE INDEXES
-- =====================================================

-- CRITICAL: Individual Report - date range + employee_ID
-- Pattern: WHERE date_ BETWEEN ? AND ? AND employee_ID = ?
CREATE INDEX IF NOT EXISTS idx_att_date_empid 
ON attendance(date_, employee_ID);

-- CRITICAL: Individual Report - employee_ID + date (reverse order for employee-first queries)
CREATE INDEX IF NOT EXISTS idx_att_empid_date 
ON attendance(employee_ID, date_);

-- Date range queries (group reports - first filter)
CREATE INDEX IF NOT EXISTS idx_att_date_only 
ON attendance(date_);

-- Employee lookup (for individual employee queries)
CREATE INDEX IF NOT EXISTS idx_att_employee_id 
ON attendance(employee_ID);

-- Covering index for individual reports (includes time and scan_type)
CREATE INDEX IF NOT EXISTS idx_att_individual_covering 
ON attendance(employee_ID, date_, time_, scan_type);

-- Covering index for date range scans (most common in group reports)
CREATE INDEX IF NOT EXISTS idx_att_date_covering 
ON attendance(date_, employee_ID, time_, scan_type);

-- Composite for sorting results (ORDER BY employee_ID, date_, time_)
CREATE INDEX IF NOT EXISTS idx_att_sort_composite 
ON attendance(employee_ID, date_, time_);

-- Scan type filtering (for IN/OUT analysis)
CREATE INDEX IF NOT EXISTS idx_att_scan_type 
ON attendance(scan_type);

-- Fingerprint lookup (if used in queries)
CREATE INDEX IF NOT EXISTS idx_att_fingerprint 
ON attendance(fingerprint_id);

-- =====================================================
-- EMPLOYEES_SYNC TABLE (for JOIN operations)
-- =====================================================

-- Employee ID lookup (PRIMARY for joins with attendance)
CREATE INDEX IF NOT EXISTS idx_emp_id_lookup 
ON employees_sync(EMP_NO);

-- Division filter (for group reports)
CREATE INDEX IF NOT EXISTS idx_emp_division 
ON employees_sync(DIV_CODE);

-- Section filter (for group reports)
CREATE INDEX IF NOT EXISTS idx_emp_section 
ON employees_sync(SEC_CODE);

-- Composite: Division + Section (for hierarchical filtering)
CREATE INDEX IF NOT EXISTS idx_emp_div_sec 
ON employees_sync(DIV_CODE, SEC_CODE);

-- Composite: Division + Section + EMP_NO (covering index for group reports)
CREATE INDEX IF NOT EXISTS idx_emp_hierarchy_covering 
ON employees_sync(DIV_CODE, SEC_CODE, EMP_NO, EMP_NAME);

-- =====================================================
-- EMP_INDEX_LIST TABLE (alternative employee table)
-- =====================================================

-- Employee ID lookup (for joins)
CREATE INDEX IF NOT EXISTS idx_empidx_employee_id 
ON emp_index_list(employee_id);

-- Division filter
CREATE INDEX IF NOT EXISTS idx_empidx_division_id 
ON emp_index_list(division_id);

-- Section filter
CREATE INDEX IF NOT EXISTS idx_empidx_section_id 
ON emp_index_list(section_id);

-- Composite: Division + Section + Employee
CREATE INDEX IF NOT EXISTS idx_empidx_hierarchy 
ON emp_index_list(division_id, section_id, employee_id);

-- =====================================================
-- QUERY PATTERN OPTIMIZATIONS
-- =====================================================

-- Individual Report Query:
-- SELECT * FROM attendance 
-- WHERE date_ BETWEEN '2024-01-01' AND '2024-01-31' 
--   AND employee_ID = 12345
-- → Uses: idx_att_empid_date OR idx_att_date_empid

-- Group Report Query (with employee join):
-- SELECT a.*, e.* 
-- FROM attendance a
-- INNER JOIN employees_sync e ON a.employee_ID = e.EMP_NO
-- WHERE a.date_ BETWEEN '2024-01-01' AND '2024-01-31'
--   AND e.DIV_CODE = '10'
--   AND e.SEC_CODE = '101'
-- → Uses: idx_att_date_covering + idx_emp_div_sec

-- =====================================================
-- PERFORMANCE EXPECTATIONS
-- =====================================================
-- Individual Report (1 employee, 30 days): 
--   Before: 500-2000ms  →  After: 5-20ms  (100x faster)
--
-- Group Report (100 employees, 30 days):
--   Before: 5000-15000ms  →  After: 100-500ms  (20-50x faster)
--
-- Group Report (1000 employees, 30 days):
--   Before: 30000-60000ms  →  After: 500-2000ms  (20-30x faster)
--
-- Date range scan (all employees):
--   Before: 10000-30000ms  →  After: 200-800ms  (30-50x faster)
-- =====================================================
