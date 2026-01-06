-- =====================================================
-- Attendance Sync Table for Fast Report Generation
-- =====================================================
-- This table stores pre-aggregated attendance data optimized for reports
-- Updated daily by sync system to eliminate slow queries and HRIS API calls

CREATE TABLE IF NOT EXISTS attendance_sync (
  id INT AUTO_INCREMENT PRIMARY KEY,
  
  -- Employee Information (from HRIS/MySQL)
  employee_id VARCHAR(100) NOT NULL,
  employee_name VARCHAR(255),
  employee_number VARCHAR(100),
  designation VARCHAR(255),
  designation_code VARCHAR(50),
  
  -- Organization Structure
  division_code VARCHAR(50),
  division_name VARCHAR(255),
  section_code VARCHAR(50),
  section_name VARCHAR(255),
  sub_section_id VARCHAR(50),
  sub_section_name VARCHAR(255),
  
  -- Attendance Date Information
  attendance_date DATE NOT NULL,
  day_of_week VARCHAR(20),
  is_weekend BOOLEAN DEFAULT 0,
  is_holiday BOOLEAN DEFAULT 0,
  
  -- Punch Times (from MySQL attendance table)
  first_punch_time DATETIME,
  last_punch_time DATETIME,
  total_punch_count INT DEFAULT 0,
  
  -- Check In/Out (from MongoDB Attendance)
  check_in_time DATETIME,
  check_out_time DATETIME,
  
  -- Calculated Fields
  status VARCHAR(50) DEFAULT 'absent', -- present, absent, late, half_day, leave
  working_hours DECIMAL(5,2) DEFAULT 0,
  overtime_hours DECIMAL(5,2) DEFAULT 0,
  late_minutes INT DEFAULT 0,
  early_leave_minutes INT DEFAULT 0,
  
  -- Shift Information
  shift_start_time TIME,
  shift_end_time TIME,
  shift_name VARCHAR(100),
  
  -- Leave Information
  leave_type VARCHAR(50),
  leave_status VARCHAR(50),
  
  -- Meal Information
  meal_taken BOOLEAN DEFAULT 0,
  meal_type VARCHAR(50),
  meal_location VARCHAR(100),
  
  -- Active Status
  is_active BOOLEAN DEFAULT 1, -- Only active employees
  
  -- Sync Metadata
  synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  data_source VARCHAR(50) DEFAULT 'MySQL', -- HRIS, MySQL, MongoDB
  sync_version INT DEFAULT 1,
  
  -- Indexes for fast report queries
  INDEX idx_employee_id (employee_id),
  INDEX idx_attendance_date (attendance_date),
  INDEX idx_employee_date (employee_id, attendance_date),
  INDEX idx_division_date (division_code, attendance_date),
  INDEX idx_section_date (section_code, attendance_date),
  INDEX idx_designation_date (designation, attendance_date),
  INDEX idx_sub_section_date (sub_section_id, attendance_date),
  INDEX idx_status (status),
  INDEX idx_is_active (is_active),
  INDEX idx_synced_at (synced_at),
  INDEX idx_date_range (attendance_date, employee_id, division_code, section_code),
  
  -- Unique constraint to prevent duplicates
  UNIQUE KEY unique_attendance (employee_id, attendance_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Attendance Punch Details Table (for audit reports)
-- =====================================================
-- Stores individual punch events for detailed audit trails

CREATE TABLE IF NOT EXISTS attendance_punches_sync (
  id INT AUTO_INCREMENT PRIMARY KEY,
  
  -- Reference to main attendance sync
  attendance_sync_id INT,
  
  -- Employee Information
  employee_id VARCHAR(100) NOT NULL,
  employee_name VARCHAR(255),
  
  -- Punch Details
  punch_time DATETIME NOT NULL,
  punch_type VARCHAR(50), -- IN, OUT, BREAK_START, BREAK_END
  punch_location VARCHAR(255),
  device_id VARCHAR(100),
  
  -- Organization Structure
  division_code VARCHAR(50),
  division_name VARCHAR(255),
  section_code VARCHAR(50),
  section_name VARCHAR(255),
  
  -- Metadata
  event_date DATE NOT NULL,
  event_time TIME NOT NULL,
  synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes for audit reports
  INDEX idx_employee_id (employee_id),
  INDEX idx_event_date (event_date),
  INDEX idx_punch_time (punch_time),
  INDEX idx_employee_event (employee_id, event_date),
  INDEX idx_division_event (division_code, event_date),
  INDEX idx_section_event (section_code, event_date),
  
  FOREIGN KEY (attendance_sync_id) REFERENCES attendance_sync(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Report Cache Table (for frequently accessed reports)
-- =====================================================
-- Stores pre-generated report results for instant access

CREATE TABLE IF NOT EXISTS report_cache (
  id INT AUTO_INCREMENT PRIMARY KEY,
  
  -- Cache Key
  report_type VARCHAR(50) NOT NULL, -- attendance, audit, group, individual
  cache_key VARCHAR(255) NOT NULL, -- MD5 hash of parameters
  
  -- Report Parameters
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  division_code VARCHAR(50),
  section_code VARCHAR(50),
  sub_section_id VARCHAR(50),
  employee_id VARCHAR(100),
  grouping VARCHAR(50), -- division, section, designation, date, employee
  filters JSON,
  
  -- Cached Data
  report_data LONGTEXT, -- JSON string of report results
  record_count INT DEFAULT 0,
  
  -- Cache Metadata
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NULL DEFAULT NULL,
  hit_count INT DEFAULT 0,
  last_accessed_at TIMESTAMP NULL DEFAULT NULL,
  
  -- Cache Management
  is_valid BOOLEAN DEFAULT 1,
  invalidated_at TIMESTAMP NULL DEFAULT NULL,
  
  -- Indexes
  INDEX idx_report_type (report_type),
  INDEX idx_cache_key (cache_key),
  INDEX idx_date_range (start_date, end_date),
  INDEX idx_division (division_code),
  INDEX idx_section (section_code),
  INDEX idx_expires_at (expires_at),
  INDEX idx_is_valid (is_valid),
  UNIQUE KEY unique_cache (cache_key, report_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Summary Statistics Table (for dashboard)
-- =====================================================
-- Stores daily aggregated statistics for quick dashboard loading

CREATE TABLE IF NOT EXISTS attendance_daily_stats (
  id INT AUTO_INCREMENT PRIMARY KEY,
  
  -- Date
  stat_date DATE NOT NULL,
  
  -- Division/Section
  division_code VARCHAR(50),
  division_name VARCHAR(255),
  section_code VARCHAR(50),
  section_name VARCHAR(255),
  
  -- Counts
  total_employees INT DEFAULT 0,
  present_count INT DEFAULT 0,
  absent_count INT DEFAULT 0,
  late_count INT DEFAULT 0,
  leave_count INT DEFAULT 0,
  half_day_count INT DEFAULT 0,
  
  -- Percentages
  attendance_rate DECIMAL(5,2) DEFAULT 0,
  late_rate DECIMAL(5,2) DEFAULT 0,
  
  -- Working Hours
  total_working_hours DECIMAL(10,2) DEFAULT 0,
  total_overtime_hours DECIMAL(10,2) DEFAULT 0,
  avg_working_hours DECIMAL(5,2) DEFAULT 0,
  
  -- Meal Statistics
  meals_taken INT DEFAULT 0,
  meal_rate DECIMAL(5,2) DEFAULT 0,
  
  -- Sync Metadata
  calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes
  INDEX idx_stat_date (stat_date),
  INDEX idx_division_date (division_code, stat_date),
  INDEX idx_section_date (section_code, stat_date),
  INDEX idx_date_range (stat_date, division_code, section_code),
  UNIQUE KEY unique_daily_stat (stat_date, division_code, section_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Views for Common Queries
-- =====================================================

-- Active employees with latest attendance
CREATE OR REPLACE VIEW v_active_employee_attendance AS
SELECT 
  a.*,
  DATEDIFF(CURDATE(), a.attendance_date) as days_since_attendance,
  CASE 
    WHEN a.attendance_date = CURDATE() THEN 'Today'
    WHEN a.attendance_date = DATE_SUB(CURDATE(), INTERVAL 1 DAY) THEN 'Yesterday'
    ELSE DATE_FORMAT(a.attendance_date, '%Y-%m-%d')
  END as attendance_label
FROM attendance_sync a
WHERE a.is_active = 1
ORDER BY a.attendance_date DESC, a.employee_name;

-- Monthly attendance summary by employee
CREATE OR REPLACE VIEW v_monthly_attendance_summary AS
SELECT 
  employee_id,
  employee_name,
  division_name,
  section_name,
  DATE_FORMAT(attendance_date, '%Y-%m') as month,
  COUNT(*) as total_days,
  SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_days,
  SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_days,
  SUM(CASE WHEN late_minutes > 0 THEN 1 ELSE 0 END) as late_days,
  SUM(working_hours) as total_hours,
  SUM(overtime_hours) as total_overtime,
  AVG(late_minutes) as avg_late_minutes,
  ROUND((SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) / COUNT(*)) * 100, 2) as attendance_rate
FROM attendance_sync
WHERE is_active = 1
GROUP BY employee_id, employee_name, division_name, section_name, DATE_FORMAT(attendance_date, '%Y-%m');

-- Division-wise daily statistics
CREATE OR REPLACE VIEW v_division_daily_stats AS
SELECT 
  attendance_date,
  division_code,
  division_name,
  COUNT(DISTINCT employee_id) as total_employees,
  SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_count,
  SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_count,
  SUM(CASE WHEN late_minutes > 0 THEN 1 ELSE 0 END) as late_count,
  SUM(working_hours) as total_working_hours,
  ROUND(AVG(working_hours), 2) as avg_working_hours,
  ROUND((SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) / COUNT(*)) * 100, 2) as attendance_rate
FROM attendance_sync
WHERE is_active = 1
GROUP BY attendance_date, division_code, division_name;
