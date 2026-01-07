-- Create transferred_employees table for tracking employee transfers to sub-sections
-- This table tracks the current transfer status of employees

CREATE TABLE IF NOT EXISTS transferred_employees (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id VARCHAR(50) NOT NULL COMMENT 'Employee ID from HRIS',
  employee_name VARCHAR(255) COMMENT 'Employee full name',
  division_code VARCHAR(50) COMMENT 'Division code',
  division_name VARCHAR(255) COMMENT 'Division name',
  section_code VARCHAR(50) COMMENT 'Section code',
  section_name VARCHAR(255) COMMENT 'Section name',
  sub_section_id INT NOT NULL COMMENT 'FK to sub_sections.id',
  sub_hie_code VARCHAR(50) COMMENT 'Sub-section code',
  sub_hie_name VARCHAR(255) COMMENT 'Sub-section name',
  transferred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'When employee was transferred',
  transferred_by VARCHAR(100) COMMENT 'User ID who performed transfer',
  recalled_at DATETIME NULL COMMENT 'When transfer was recalled (if applicable)',
  recalled_by VARCHAR(100) COMMENT 'User ID who recalled transfer',
  transferred_status BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'TRUE=currently transferred, FALSE=recalled',
  employee_data JSON COMMENT 'Full employee object from HRIS',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Indexes for performance
  INDEX idx_employee_id (employee_id),
  INDEX idx_sub_section_id (sub_section_id),
  INDEX idx_transferred_status (transferred_status),
  INDEX idx_employee_sub (employee_id, sub_section_id),
  
  -- Unique constraint: one active transfer per employee per sub-section
  UNIQUE KEY uk_employee_subsection (employee_id, sub_section_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Employee transfers to sub-sections with status tracking';
