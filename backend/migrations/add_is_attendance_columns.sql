-- Migration: Add IS Division Attendance Tracking Columns
-- Run this directly in MySQL or phpMyAdmin

USE slpa_db;

-- Add IS_attendance_trend column (JSON for 7-day trend data)
ALTER TABLE total_count_dashboard 
ADD COLUMN IF NOT EXISTS IS_attendance_trend JSON 
COMMENT '7-day attendance trend for IS division (DIV_CODE=66)';

-- Add present_IS column (JSON for present employees list)
ALTER TABLE total_count_dashboard 
ADD COLUMN IF NOT EXISTS present_IS JSON 
COMMENT 'Present employees in IS division for today';

-- Add absent_IS column (JSON for absent employees list)
ALTER TABLE total_count_dashboard 
ADD COLUMN IF NOT EXISTS absent_IS JSON 
COMMENT 'Absent employees in IS division for today';

-- Verify columns were added
DESCRIBE total_count_dashboard;

SELECT 'Migration completed successfully! New columns added:' as message;
SELECT 'IS_attendance_trend, present_IS, absent_IS' as columns;
