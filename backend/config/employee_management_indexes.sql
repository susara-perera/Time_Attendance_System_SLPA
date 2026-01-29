-- =====================================================
-- EMPLOYEE MANAGEMENT PAGE - PERFORMANCE INDEXING
-- =====================================================
-- Purpose: Optimize database queries specifically for Employee Management page
-- Target: 50-70% faster queries even with large datasets
-- Safe to run multiple times (uses IF NOT EXISTS)
-- =====================================================

USE slpa_db;

-- =====================================================
-- EMPLOYEES_SYNC TABLE - PRIMARY INDEXES
-- =====================================================

-- CRITICAL: Employee Number (Primary lookup field)
-- Already has UNIQUE index from table creation, but ensure it exists
CREATE INDEX IF NOT EXISTS idx_emp_no_lookup ON employees_sync(EMP_NO);

-- CRITICAL: Division Code Filter (Most common filter)
-- Speeds up: WHERE DIV_CODE = ?
-- Used in: Filter by division, count employees per division
CREATE INDEX IF NOT EXISTS idx_emp_div_code ON employees_sync(DIV_CODE);

-- CRITICAL: Section Code Filter
-- Speeds up: WHERE SEC_CODE = ?
-- Used in: Filter by section within division
CREATE INDEX IF NOT EXISTS idx_emp_sec_code ON employees_sync(SEC_CODE);

-- CRITICAL: Composite Division + Section Filter
-- Speeds up: WHERE DIV_CODE = ? AND SEC_CODE = ?
-- Used in: Dual filtering (common in Employee Management)
-- This is FASTER than using two separate indexes
CREATE INDEX IF NOT EXISTS idx_emp_div_sec ON employees_sync(DIV_CODE, SEC_CODE);

-- =====================================================
-- EMPLOYEES_SYNC TABLE - SEARCH OPTIMIZATION
-- =====================================================

-- HIGH PRIORITY: Full-Text Search Index for Employee Names
-- Speeds up: WHERE EMP_NAME LIKE '%search%'
-- This is CRITICAL for search functionality
CREATE FULLTEXT INDEX IF NOT EXISTS ft_emp_name ON employees_sync(EMP_NAME);

-- HIGH PRIORITY: NIC Search (Common search field)
-- Speeds up: WHERE EMP_NIC LIKE '%search%' or WHERE EMP_NIC = ?
CREATE INDEX IF NOT EXISTS idx_emp_nic_search ON employees_sync(EMP_NIC);

-- MEDIUM PRIORITY: Email Search
-- Speeds up: WHERE EMP_EMAIL LIKE '%search%'
CREATE INDEX IF NOT EXISTS idx_emp_email_search ON employees_sync(EMP_EMAIL);

-- MEDIUM PRIORITY: First Name + Last Name (for name-based searches)
CREATE INDEX IF NOT EXISTS idx_emp_full_name ON employees_sync(EMP_FIRST_NAME, EMP_LAST_NAME);

-- =====================================================
-- EMPLOYEES_SYNC TABLE - FILTERING OPTIMIZATION
-- =====================================================

-- HIGH PRIORITY: Status Filter
-- Speeds up: WHERE STATUS = 'ACTIVE' or WHERE IS_ACTIVE = TRUE
CREATE INDEX IF NOT EXISTS idx_emp_status ON employees_sync(STATUS);
CREATE INDEX IF NOT EXISTS idx_emp_is_active ON employees_sync(IS_ACTIVE);

-- MEDIUM PRIORITY: Designation Filter
-- Speeds up: WHERE EMP_DESIGNATION LIKE '%Manager%'
CREATE INDEX IF NOT EXISTS idx_emp_designation ON employees_sync(EMP_DESIGNATION);

-- MEDIUM PRIORITY: Employee Type Filter
-- Speeds up: WHERE EMP_TYPE = 'Permanent'
CREATE INDEX IF NOT EXISTS idx_emp_type ON employees_sync(EMP_TYPE);

-- =====================================================
-- EMPLOYEES_SYNC TABLE - COMPOSITE INDEXES FOR COMMON QUERIES
-- =====================================================

-- CRITICAL: Division + Status (Most common combination)
-- Speeds up: WHERE DIV_CODE = ? AND STATUS = 'ACTIVE'
CREATE INDEX IF NOT EXISTS idx_emp_div_status ON employees_sync(DIV_CODE, STATUS);

-- CRITICAL: Section + Status
-- Speeds up: WHERE SEC_CODE = ? AND STATUS = 'ACTIVE'
CREATE INDEX IF NOT EXISTS idx_emp_sec_status ON employees_sync(SEC_CODE, STATUS);

-- HIGH PRIORITY: Division + Section + Status (Triple filter)
-- Speeds up: WHERE DIV_CODE = ? AND SEC_CODE = ? AND STATUS = 'ACTIVE'
CREATE INDEX IF NOT EXISTS idx_emp_div_sec_status ON employees_sync(DIV_CODE, SEC_CODE, STATUS);

-- MEDIUM PRIORITY: Employee Number + Division (For quick org lookups)
CREATE INDEX IF NOT EXISTS idx_emp_no_div ON employees_sync(EMP_NO, DIV_CODE);

-- =====================================================
-- EMPLOYEES_SYNC TABLE - SORTING OPTIMIZATION
-- =====================================================

-- HIGH PRIORITY: Division + Employee Number (For sorted lists)
-- Speeds up: WHERE DIV_CODE = ? ORDER BY EMP_NO
-- This allows MySQL to avoid filesort
CREATE INDEX IF NOT EXISTS idx_emp_div_empno_sort ON employees_sync(DIV_CODE, EMP_NO);

-- MEDIUM PRIORITY: Section + Employee Number
-- Speeds up: WHERE SEC_CODE = ? ORDER BY EMP_NO
CREATE INDEX IF NOT EXISTS idx_emp_sec_empno_sort ON employees_sync(SEC_CODE, EMP_NO);

-- =====================================================
-- DIVISIONS_SYNC TABLE - OPTIMIZATION
-- =====================================================

-- CRITICAL: Division Code Lookup
-- Speeds up: WHERE HIE_CODE = ?
-- Already exists in createSyncTables.sql but ensure it's optimized
CREATE INDEX IF NOT EXISTS idx_div_hie_code ON divisions_sync(HIE_CODE);

-- HIGH PRIORITY: Division Name Search
-- Speeds up: WHERE HIE_NAME LIKE '%Colombo%'
CREATE INDEX IF NOT EXISTS idx_div_name ON divisions_sync(HIE_NAME);

-- MEDIUM PRIORITY: Division Status
-- Speeds up: WHERE STATUS = 'ACTIVE'
CREATE INDEX IF NOT EXISTS idx_div_status ON divisions_sync(STATUS);

-- HIGH PRIORITY: Composite for filtered lists
-- Speeds up: WHERE STATUS = 'ACTIVE' ORDER BY HIE_NAME
CREATE INDEX IF NOT EXISTS idx_div_status_name ON divisions_sync(STATUS, HIE_NAME);

-- =====================================================
-- SECTIONS_SYNC TABLE - OPTIMIZATION
-- =====================================================

-- CRITICAL: Section Code Lookup
CREATE INDEX IF NOT EXISTS idx_sec_hie_code ON sections_sync(HIE_CODE);

-- CRITICAL: Parent Division Code (Most important for filtering)
-- Speeds up: WHERE HIE_CODE_3 = ? or WHERE HIE_RELATIONSHIP = ?
CREATE INDEX IF NOT EXISTS idx_sec_parent_div ON sections_sync(HIE_CODE_3);
CREATE INDEX IF NOT EXISTS idx_sec_relationship ON sections_sync(HIE_RELATIONSHIP);

-- HIGH PRIORITY: Section Name Search
CREATE INDEX IF NOT EXISTS idx_sec_name ON sections_sync(HIE_NAME_4);

-- MEDIUM PRIORITY: Section ID
CREATE INDEX IF NOT EXISTS idx_sec_section_id ON sections_sync(SECTION_ID);

-- HIGH PRIORITY: Composite for Division-filtered sections
-- Speeds up: WHERE HIE_CODE_3 = ? AND STATUS = 'ACTIVE'
CREATE INDEX IF NOT EXISTS idx_sec_div_status ON sections_sync(HIE_CODE_3, STATUS);

-- MEDIUM PRIORITY: Section Status
CREATE INDEX IF NOT EXISTS idx_sec_status ON sections_sync(STATUS);

-- =====================================================
-- SUB_SECTIONS TABLE - OPTIMIZATION
-- =====================================================

-- CRITICAL: Section Code (Parent relationship)
-- Speeds up: WHERE section_code = ?
CREATE INDEX IF NOT EXISTS idx_subsec_section ON sub_sections(section_code);

-- HIGH PRIORITY: Division Code
-- Speeds up: WHERE division_code = ?
CREATE INDEX IF NOT EXISTS idx_subsec_division ON sub_sections(division_code);

-- MEDIUM PRIORITY: Sub-section Name
CREATE INDEX IF NOT EXISTS idx_subsec_name ON sub_sections(sub_section_name);

-- HIGH PRIORITY: Composite for hierarchical filtering
-- Speeds up: WHERE division_code = ? AND section_code = ?
CREATE INDEX IF NOT EXISTS idx_subsec_div_sec ON sub_sections(division_code, section_code);

-- =====================================================
-- TRANSFERRED_EMPLOYEES TABLE - JOIN OPTIMIZATION
-- =====================================================

-- CRITICAL: Employee ID for JOIN operations
-- Speeds up: LEFT JOIN transferred_employees ON employee_id = ?
CREATE INDEX IF NOT EXISTS idx_transfer_emp_id ON transferred_employees(employee_id);

-- CRITICAL: Transferred Status (Filter condition)
-- Speeds up: WHERE transferred_status = TRUE
CREATE INDEX IF NOT EXISTS idx_transfer_status ON transferred_employees(transferred_status);

-- CRITICAL: Composite for JOIN + Filter
-- Speeds up: LEFT JOIN ... WHERE employee_id = ? AND transferred_status = TRUE
-- This is THE MOST IMPORTANT index for the employee query with transfer check
CREATE INDEX IF NOT EXISTS idx_transfer_emp_status ON transferred_employees(employee_id, transferred_status);

-- MEDIUM PRIORITY: Sub-section ID (for transferred employee lookups)
CREATE INDEX IF NOT EXISTS idx_transfer_subsec ON transferred_employees(sub_section_id);

-- =====================================================
-- ANALYZE TABLES (Update Statistics)
-- =====================================================

-- Force MySQL to update statistics for query optimizer
ANALYZE TABLE employees_sync;
ANALYZE TABLE divisions_sync;
ANALYZE TABLE sections_sync;
ANALYZE TABLE sub_sections;
ANALYZE TABLE transferred_employees;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check employees_sync indexes
SELECT 
    TABLE_NAME,
    INDEX_NAME,
    GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS COLUMNS,
    INDEX_TYPE,
    NON_UNIQUE,
    CARDINALITY
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = 'slpa_db' 
  AND TABLE_NAME = 'employees_sync'
GROUP BY TABLE_NAME, INDEX_NAME, INDEX_TYPE, NON_UNIQUE
ORDER BY INDEX_NAME;

-- Check index usage effectiveness
SELECT 
    CONCAT(table_schema, '.', table_name) AS table_name,
    CONCAT(index_name, ' (', GROUP_CONCAT(column_name ORDER BY seq_in_index SEPARATOR ', '), ')') AS index_definition,
    ROUND(cardinality / NULLIF(table_rows, 0) * 100, 2) AS selectivity_percent
FROM information_schema.statistics s
JOIN information_schema.tables t USING (table_schema, table_name)
WHERE s.table_schema = 'slpa_db'
  AND s.table_name IN ('employees_sync', 'divisions_sync', 'sections_sync', 'transferred_employees')
  AND s.index_name != 'PRIMARY'
GROUP BY table_name, index_name
ORDER BY table_name, index_name;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

SELECT 
    'Employee Management Indexing Complete!' AS status,
    COUNT(DISTINCT index_name) AS indexes_created,
    'Run EXPLAIN on queries to verify index usage' AS next_step
FROM information_schema.statistics
WHERE table_schema = 'slpa_db' 
  AND table_name IN ('employees_sync', 'divisions_sync', 'sections_sync', 'sub_sections', 'transferred_employees')
  AND index_name != 'PRIMARY';
