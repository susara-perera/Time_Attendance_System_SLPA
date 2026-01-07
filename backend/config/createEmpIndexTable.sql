-- =====================================================
-- Employee Index Table for fast hierarchical lookups
-- =====================================================

CREATE TABLE IF NOT EXISTS emp_index_list (
  id INT AUTO_INCREMENT PRIMARY KEY,
  division_id VARCHAR(50) NOT NULL,
  division_name VARCHAR(255) DEFAULT NULL,
  section_id VARCHAR(50) DEFAULT NULL,
  section_name VARCHAR(255) DEFAULT NULL,
  sub_section_id VARCHAR(50) DEFAULT NULL,
  employee_id VARCHAR(100) NOT NULL,
  employee_name VARCHAR(255) DEFAULT NULL,
  synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_emp_index (division_id, section_id, sub_section_id, employee_id),
  INDEX idx_division (division_id),
  INDEX idx_section (section_id),
  INDEX idx_sub_section (sub_section_id),
  INDEX idx_employee (employee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;