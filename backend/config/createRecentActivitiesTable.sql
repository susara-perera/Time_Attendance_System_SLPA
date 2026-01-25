-- =====================================================
-- Recent Activities Table
-- Stores recent system activities for dashboard display
-- =====================================================
DROP TABLE IF EXISTS `recent_activities`;

CREATE TABLE `recent_activities` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(255) NOT NULL COMMENT 'Activity title (e.g., "New Sub-Section", "Employee Transferred")',
  `description` TEXT NOT NULL COMMENT 'Activity description/details',
  `activity_type` VARCHAR(50) NOT NULL COMMENT 'Type of activity (subsection_created, employee_transferred, etc.)',
  `icon` VARCHAR(100) DEFAULT 'bi bi-activity' COMMENT 'Bootstrap icon class',
  `entity_id` VARCHAR(100) NULL COMMENT 'ID of the related entity (subsection_id, employee_id, etc.)',
  `entity_name` VARCHAR(255) NULL COMMENT 'Name of the related entity',
  `user_id` VARCHAR(100) NULL COMMENT 'ID of user who performed the action',
  `user_name` VARCHAR(255) NULL COMMENT 'Name of user who performed the action',
  `metadata` JSON NULL COMMENT 'Additional activity metadata',

  -- Timestamps
  `activity_date` DATE NOT NULL COMMENT 'Date of activity (YYYY-MM-DD)',
  `activity_time` TIME NOT NULL COMMENT 'Time of activity (HH:mm:ss)',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'Record creation timestamp',
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Record update timestamp',

  -- Indexes
  INDEX `idx_activity_type` (`activity_type`),
  INDEX `idx_activity_date` (`activity_date`),
  INDEX `idx_created_at` (`created_at`),
  INDEX `idx_entity_id` (`entity_id`),
  INDEX `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Recent System Activities';