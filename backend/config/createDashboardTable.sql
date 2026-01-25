-- Dashboard totals cache table for fast dashboard loading
CREATE TABLE IF NOT EXISTS total_count_dashboard (
  id INT PRIMARY KEY AUTO_INCREMENT,
  totalDivisions INT DEFAULT 0,
  totalSections INT DEFAULT 0,
  totalSubsections INT DEFAULT 0,
  totalActiveEmployees INT DEFAULT 0,
  totalInactiveEmployees INT DEFAULT 0,
  attendance_trend_data JSON COMMENT 'Last 7 days attendance trend [{date, employees}]',
  monthly_trend_data JSON COMMENT 'Last 4 weeks attendance trend [week1, week2, week3, week4]',
  annual_trend_data JSON COMMENT 'Last 12 months attendance trend [jan, feb, ..., dec]',
  is_division_attendance JSON COMMENT 'IS division attendance data {presentToday, absentToday, totalEmployees}',
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_last_updated (last_updated)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
