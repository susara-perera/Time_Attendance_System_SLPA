-- =====================================================
-- Sub-Sections MySQL Table
-- =====================================================
-- Stores sub-sections data with full CRUD support
-- Replaces MongoDB SubSection collection

CREATE TABLE IF NOT EXISTS sub_sections (
  id INT AUTO_INCREMENT PRIMARY KEY,
  
  -- Sub-section information
  sub_section_code VARCHAR(50) NOT NULL,
  sub_section_name VARCHAR(255) NOT NULL,
  sub_section_name_sinhala VARCHAR(255),
  sub_section_name_tamil VARCHAR(255),
  
  -- Parent section reference
  section_code VARCHAR(50) NOT NULL,
  section_name VARCHAR(255),
  
  -- Parent division reference
  division_code VARCHAR(50),
  division_name VARCHAR(255),
  
  -- Status
  status VARCHAR(20) DEFAULT 'ACTIVE',
  is_active BOOLEAN DEFAULT 1,
  
  -- Description
  description TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(100),
  updated_by VARCHAR(100),
  
  -- Indexes
  INDEX idx_sub_section_code (sub_section_code),
  INDEX idx_section_code (section_code),
  INDEX idx_division_code (division_code),
  INDEX idx_status (status),
  INDEX idx_is_active (is_active),
  INDEX idx_created_at (created_at),
  
  -- Unique constraint
  UNIQUE KEY unique_sub_section (sub_section_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
