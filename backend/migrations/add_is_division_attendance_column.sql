-- Migration: Add is_division_attendance column for unified IS employee list with presence status
-- Run this directly in MySQL or phpMyAdmin

USE slpa_db;

-- Add is_division_attendance column (JSON for all IS employees with presence flag)
ALTER TABLE total_count_dashboard 
ADD COLUMN IF NOT EXISTS is_division_attendance JSON 
COMMENT 'All IS division employees with division, section, and presence status';

-- Verify column was added
DESCRIBE total_count_dashboard;

SELECT 'Migration completed successfully! New column added:' as message;
SELECT 'is_division_attendance' as column_name;
