-- =====================================================
-- HRIS Data Synchronization Tables
-- Created: 2026-01-05
-- Purpose: Sync tables to store HRIS API data locally
-- =====================================================

-- Drop existing sync tables if they exist (for clean setup)
DROP TABLE IF EXISTS `employees_sync`;
DROP TABLE IF EXISTS `sections_sync`;
DROP TABLE IF EXISTS `divisions_sync`;
DROP TABLE IF EXISTS `sync_logs`;

-- =====================================================
-- Divisions Sync Table
-- Stores division data from HRIS API (DEF_LEVEL = 3)
-- =====================================================
CREATE TABLE `divisions_sync` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `HIE_CODE` VARCHAR(50) NOT NULL COMMENT 'Hierarchy code from HRIS',
  `HIE_NAME` VARCHAR(255) NOT NULL COMMENT 'Division name in English',
  `HIE_NAME_SINHALA` VARCHAR(255) NULL COMMENT 'Division name in Sinhala',
  `HIE_NAME_TAMIL` VARCHAR(255) NULL COMMENT 'Division name in Tamil',
  `HIE_RELATIONSHIP` VARCHAR(255) NULL COMMENT 'Parent relationship',
  `DEF_LEVEL` INT NOT NULL DEFAULT 3 COMMENT 'Hierarchy level (3 for divisions)',
  `STATUS` VARCHAR(20) DEFAULT 'ACTIVE' COMMENT 'Status of division',
  `DESCRIPTION` TEXT NULL COMMENT 'Additional description',
  
  -- Sync metadata
  `synced_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last sync timestamp',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY `uniq_hie_code` (`HIE_CODE`),
  INDEX `idx_hie_name` (`HIE_NAME`),
  INDEX `idx_synced_at` (`synced_at`),
  INDEX `idx_status` (`STATUS`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='HRIS Divisions Sync Data';

-- =====================================================
-- Sections Sync Table
-- Stores section data from HRIS API (DEF_LEVEL = 4)
-- =====================================================
CREATE TABLE `sections_sync` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `HIE_CODE` VARCHAR(50) NOT NULL COMMENT 'Hierarchy code from HRIS',
  `HIE_CODE_3` VARCHAR(50) NULL COMMENT 'Parent division code',
  `HIE_NAME` VARCHAR(255) NULL COMMENT 'Section name (Level 3)',
  `HIE_NAME_3` VARCHAR(255) NULL COMMENT 'Parent division name',
  `HIE_NAME_4` VARCHAR(255) NOT NULL COMMENT 'Section name in English',
  `HIE_NAME_SINHALA` VARCHAR(255) NULL COMMENT 'Section name in Sinhala',
  `HIE_NAME_TAMIL` VARCHAR(255) NULL COMMENT 'Section name in Tamil',
  `HIE_RELATIONSHIP` VARCHAR(255) NULL COMMENT 'Parent relationship (division)',
  `SECTION_ID` VARCHAR(50) NULL COMMENT 'Section ID',
  `DEF_LEVEL` INT NOT NULL DEFAULT 4 COMMENT 'Hierarchy level (4 for sections)',
  `STATUS` VARCHAR(20) DEFAULT 'ACTIVE' COMMENT 'Status of section',
  `DESCRIPTION` TEXT NULL COMMENT 'Additional description',
  
  -- Sync metadata
  `synced_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last sync timestamp',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY `uniq_hie_code` (`HIE_CODE`),
  INDEX `idx_hie_code_3` (`HIE_CODE_3`),
  INDEX `idx_hie_name_4` (`HIE_NAME_4`),
  INDEX `idx_section_id` (`SECTION_ID`),
  INDEX `idx_synced_at` (`synced_at`),
  INDEX `idx_status` (`STATUS`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='HRIS Sections Sync Data';

-- =====================================================
-- Employees Sync Table
-- Stores employee data from HRIS API
-- =====================================================
CREATE TABLE `employees_sync` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `EMP_NO` VARCHAR(50) NOT NULL COMMENT 'Employee number from HRIS',
  `EMP_NAME` VARCHAR(255) NOT NULL COMMENT 'Employee full name',
  `EMP_NAME_WITH_INITIALS` VARCHAR(255) NULL COMMENT 'Employee name with initials',
  `EMP_FIRST_NAME` VARCHAR(100) NULL COMMENT 'First name',
  `EMP_LAST_NAME` VARCHAR(100) NULL COMMENT 'Last name',
  `EMP_NIC` VARCHAR(20) NULL COMMENT 'National ID number',
  `EMP_EMAIL` VARCHAR(255) NULL COMMENT 'Email address',
  `EMP_PHONE` VARCHAR(20) NULL COMMENT 'Phone number',
  `EMP_MOBILE` VARCHAR(20) NULL COMMENT 'Mobile number',
  `EMP_ADDRESS` TEXT NULL COMMENT 'Address',
  `EMP_GENDER` VARCHAR(20) NULL COMMENT 'Gender',
  
  -- Employment details
  `EMP_STATUS` VARCHAR(50) NULL COMMENT 'Employment status',
  `EMP_TYPE` VARCHAR(50) NULL COMMENT 'Employment type',
  `EMP_DESIGNATION` VARCHAR(255) NULL COMMENT 'Job designation',
  `EMP_GRADE` VARCHAR(50) NULL COMMENT 'Employee grade',
  `EMP_DATE_JOINED` DATE NULL COMMENT 'Date joined',
  `EMP_DATE_PERMANENT` DATE NULL COMMENT 'Permanent date',
  `EMP_DATE_RETIRE` DATE NULL COMMENT 'Retirement date',
  
  -- Organizational assignment
  `DIV_CODE` VARCHAR(50) NULL COMMENT 'Division code',
  `DIV_NAME` VARCHAR(255) NULL COMMENT 'Division name',
  `SEC_CODE` VARCHAR(50) NULL COMMENT 'Section code',
  `SEC_NAME` VARCHAR(255) NULL COMMENT 'Section name',
  `DEPT_CODE` VARCHAR(50) NULL COMMENT 'Department code',
  `DEPT_NAME` VARCHAR(255) NULL COMMENT 'Department name',
  
  -- Additional HRIS fields
  `HIE_CODE` VARCHAR(50) NULL COMMENT 'Hierarchy code',
  `HIE_NAME` VARCHAR(255) NULL COMMENT 'Hierarchy name',
  `LOCATION` VARCHAR(255) NULL COMMENT 'Work location',
  `COST_CENTER` VARCHAR(50) NULL COMMENT 'Cost center',
  
  -- Status and metadata
  `STATUS` VARCHAR(20) DEFAULT 'ACTIVE' COMMENT 'Active status',
  `IS_ACTIVE` BOOLEAN DEFAULT TRUE COMMENT 'Is employee active',
  
  -- Sync metadata
  `synced_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last sync timestamp',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY `uniq_emp_no` (`EMP_NO`),
  INDEX `idx_emp_name` (`EMP_NAME`),
  INDEX `idx_emp_nic` (`EMP_NIC`),
  INDEX `idx_div_code` (`DIV_CODE`),
  INDEX `idx_sec_code` (`SEC_CODE`),
  INDEX `idx_emp_status` (`EMP_STATUS`),
  INDEX `idx_synced_at` (`synced_at`),
  INDEX `idx_status` (`STATUS`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='HRIS Employees Sync Data';

-- =====================================================
-- Sync Logs Table
-- Tracks synchronization history and status
-- =====================================================
CREATE TABLE `sync_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `sync_type` VARCHAR(50) NOT NULL COMMENT 'Type: divisions, sections, employees, full',
  `sync_status` VARCHAR(20) NOT NULL COMMENT 'Status: started, completed, failed',
  `records_synced` INT DEFAULT 0 COMMENT 'Number of records synced',
  `records_added` INT DEFAULT 0 COMMENT 'Number of new records added',
  `records_updated` INT DEFAULT 0 COMMENT 'Number of records updated',
  `records_failed` INT DEFAULT 0 COMMENT 'Number of records that failed',
  `error_message` TEXT NULL COMMENT 'Error details if failed',
  `started_at` DATETIME NOT NULL COMMENT 'Sync start time',
  `completed_at` DATETIME NULL COMMENT 'Sync completion time',
  `duration_seconds` INT NULL COMMENT 'Duration in seconds',
  `triggered_by` VARCHAR(50) DEFAULT 'system' COMMENT 'Who triggered: system, manual, user_id',
  `sync_details` JSON NULL COMMENT 'Additional sync details',
  
  INDEX `idx_sync_type` (`sync_type`),
  INDEX `idx_sync_status` (`sync_status`),
  INDEX `idx_started_at` (`started_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='HRIS Sync Activity Logs';

-- =====================================================
-- Insert initial sync log entry
-- =====================================================
INSERT INTO `sync_logs` (
  `sync_type`, `sync_status`, `started_at`, `triggered_by`, `sync_details`
) VALUES (
  'initial_setup', 'completed', NOW(), 'system', 
  JSON_OBJECT('message', 'Sync tables created successfully')
);

-- =====================================================
-- Grant permissions (adjust as needed)
-- =====================================================
-- GRANT SELECT, INSERT, UPDATE, DELETE ON slpa_db.divisions_sync TO 'your_user'@'localhost';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON slpa_db.sections_sync TO 'your_user'@'localhost';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON slpa_db.employees_sync TO 'your_user'@'localhost';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON slpa_db.sync_logs TO 'your_user'@'localhost';
