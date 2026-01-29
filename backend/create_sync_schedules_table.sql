CREATE TABLE IF NOT EXISTS `sync_schedules` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `task_id` VARCHAR(50) NOT NULL UNIQUE,
  `task_name` VARCHAR(100) NOT NULL,
  `description` TEXT,
  `mode` ENUM('manual', 'auto') DEFAULT 'manual',
  `schedule_date` DATE,
  `schedule_time` TIME,
  `last_run` DATETIME,
  `status` VARCHAR(20) DEFAULT 'idle',
  `last_message` TEXT,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default schedules
INSERT INTO `sync_schedules` (`task_id`, `task_name`, `description`, `mode`) VALUES
  ('divisions_sync', 'Divisions Sync', 'Sync company divisions from HRIS', 'manual'),
  ('sections_sync', 'Sections Sync', 'Sync organizational sections from HRIS', 'manual'),
  ('subsections_sync', 'Sub-Sections Sync', 'Sync organizational sub-sections from HRIS', 'manual'),
  ('employees_sync', 'Employees Sync', 'Sync employee records from HRIS', 'manual'),
  ('dashboard_sync', 'Dashboard Totals Sync', 'Sync total_count_dashboard with divisions, sections, sub-sections and attendance', 'manual'),
  ('attendance_cache', 'Attendance Table Cache', 'Cache attendance data', 'manual'),
  ('employees_cache', 'Employees Cache', 'Preload employees_sync cache', 'manual'),
  ('divisions_cache', 'Divisions Cache', 'Preload divisions_sync cache', 'manual'),
  ('sections_cache', 'Sections Cache', 'Preload sections_sync cache', 'manual'),
  ('subsections_cache', 'Sub-Sections Cache', 'Preload sub_sections cache', 'manual')
ON DUPLICATE KEY UPDATE 
  `task_name` = VALUES(`task_name`),
  `description` = VALUES(`description`);
