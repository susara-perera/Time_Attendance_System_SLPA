-- =====================================================
-- ATTENDANCE REPORT PERFORMANCE OPTIMIZATION INDEXES
-- =====================================================
-- This script adds indexes to speed up attendance report generation
-- NO TABLE COLUMNS ARE MODIFIED - ONLY INDEXES ADDED
-- Safe to run multiple times (uses IF NOT EXISTS)
-- =====================================================

USE slpa_db;

-- =====================================================
-- ATTENDANCE TABLE INDEXES
-- =====================================================

-- Critical: Date range queries (MOST IMPORTANT)
-- Speeds up: WHERE date_ BETWEEN ? AND ?
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date_);

-- Critical: Date + Employee queries  
-- Speeds up: WHERE date_ BETWEEN ? AND ? AND employee_ID IN (...)
CREATE INDEX IF NOT EXISTS idx_attendance_date_emp ON attendance(date_, employee_ID);

-- Critical: Employee-first queries (for individual reports)
-- Speeds up: WHERE employee_ID = ? AND date_ BETWEEN ?
CREATE INDEX IF NOT EXISTS idx_attendance_emp_date ON attendance(employee_ID, date_);

-- Performance: Composite index for sorting
-- Speeds up: ORDER BY employee_ID, date_, time_
CREATE INDEX IF NOT EXISTS idx_attendance_full_sort ON attendance(employee_ID, date_, time_);

-- =====================================================
-- EMP_INDEX_LIST TABLE INDEXES (Already exist, verifying)
-- =====================================================

-- These should already exist from createEmpIndexTable.sql
-- Adding IF NOT EXISTS for safety

CREATE INDEX IF NOT EXISTS idx_division ON emp_index_list(division_id);
CREATE INDEX IF NOT EXISTS idx_section ON emp_index_list(section_id);
CREATE INDEX IF NOT EXISTS idx_sub_section ON emp_index_list(sub_section_id);
CREATE INDEX IF NOT EXISTS idx_employee ON emp_index_list(employee_id);

-- NEW: Composite index for hierarchical filtering
-- Speeds up: WHERE division_id = ? AND section_id = ? AND sub_section_id = ?
CREATE INDEX IF NOT EXISTS idx_emp_hierarchy ON emp_index_list(division_id, section_id, sub_section_id);

-- NEW: Composite with employee_id for JOIN optimization
-- Speeds up: JOIN emp_index_list ON employee_ID = employee_id WHERE division_id = ?
CREATE INDEX IF NOT EXISTS idx_emp_org_lookup ON emp_index_list(division_id, section_id, sub_section_id, employee_id);

-- =====================================================
-- EMPLOYEES_SYNC TABLE INDEXES (for employee details)
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_employees_sync_emp_no ON employees_sync(EMP_NO);
CREATE INDEX IF NOT EXISTS idx_employees_sync_div ON employees_sync(DIV_CODE);

-- =====================================================
-- DIVISIONS_SYNC TABLE INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_divisions_sync_id ON divisions_sync(division_id);
CREATE INDEX IF NOT EXISTS idx_divisions_sync_code ON divisions_sync(division_code);

-- =====================================================
-- SECTIONS_SYNC TABLE INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_sections_sync_id ON sections_sync(section_id);
CREATE INDEX IF NOT EXISTS idx_sections_sync_code ON sections_sync(section_code);
CREATE INDEX IF NOT EXISTS idx_sections_sync_div ON sections_sync(division_code);

-- =====================================================
-- SUB_SECTIONS TABLE INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_sub_sections_id ON sub_sections(id);
CREATE INDEX IF NOT EXISTS idx_sub_sections_section ON sub_sections(section_id);

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check attendance table indexes
SELECT 
    TABLE_NAME,
    INDEX_NAME,
    GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS COLUMNS,
    INDEX_TYPE,
    NON_UNIQUE
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = 'slpa_db' 
  AND TABLE_NAME = 'attendance'
GROUP BY TABLE_NAME, INDEX_NAME, INDEX_TYPE, NON_UNIQUE
ORDER BY TABLE_NAME, INDEX_NAME;

-- Check emp_index_list table indexes
SELECT 
    TABLE_NAME,
    INDEX_NAME,
    GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS COLUMNS,
    INDEX_TYPE,
    NON_UNIQUE
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = 'slpa_db' 
  AND TABLE_NAME = 'emp_index_list'
GROUP BY TABLE_NAME, INDEX_NAME, INDEX_TYPE, NON_UNIQUE
ORDER BY TABLE_NAME, INDEX_NAME;

-- =====================================================
-- INDEX SIZE ANALYSIS
-- =====================================================

SELECT 
    TABLE_NAME,
    INDEX_NAME,
    ROUND(STAT_VALUE * @@innodb_page_size / 1024 / 1024, 2) AS size_mb
FROM mysql.innodb_index_stats
WHERE DATABASE_NAME = 'slpa_db'
  AND TABLE_NAME IN ('attendance', 'emp_index_list', 'employees_sync', 'divisions_sync', 'sections_sync', 'sub_sections')
  AND STAT_NAME = 'size'
ORDER BY size_mb DESC;

-- =====================================================
-- PERFORMANCE TIPS
-- =====================================================

-- After running this script:
-- 1. Run ANALYZE TABLE to update statistics:
--    ANALYZE TABLE attendance, emp_index_list, employees_sync;
-- 
-- 2. Monitor slow queries:
--    SET GLOBAL slow_query_log = 'ON';
--    SET GLOBAL long_query_time = 2;
--
-- 3. Use EXPLAIN to verify index usage:
--    EXPLAIN SELECT ... FROM attendance WHERE date_ BETWEEN ...
-- =====================================================

SELECT '✅ Index optimization script completed!' AS Status;
