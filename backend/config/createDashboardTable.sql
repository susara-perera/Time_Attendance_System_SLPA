-- Dashboard totals cache table for fast dashboard loading
CREATE TABLE IF NOT EXISTS total_count_dashboard (
  id INT PRIMARY KEY AUTO_INCREMENT,
  totalDivisions INT DEFAULT 0,
  totalSections INT DEFAULT 0,
  totalSubsections INT DEFAULT 0,
  totalActiveEmployees INT DEFAULT 0,
  totalInactiveEmployees INT DEFAULT 0,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_last_updated (last_updated)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
