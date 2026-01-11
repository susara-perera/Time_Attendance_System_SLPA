/**
 * Cache Index Tables Schema
 * 
 * Creates tables for managing cache metadata and indexes
 * These tables enable O(1) lookups and efficient cache management
 */

-- =====================================================
-- Table: cache_metadata
-- Purpose: Track cache status and metadata
-- =====================================================
CREATE TABLE IF NOT EXISTS cache_metadata (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cache_key VARCHAR(255) UNIQUE NOT NULL COMMENT 'Unique identifier for cache entry',
  entity_type VARCHAR(50) NOT NULL COMMENT 'Type of cached entity (division, section, employee)',
  record_count INT DEFAULT 0 COMMENT 'Number of records in this cache',
  data_size_bytes BIGINT DEFAULT 0 COMMENT 'Approximate size in bytes',
  last_sync_at DATETIME COMMENT 'Last time this cache was synced',
  expires_at DATETIME COMMENT 'When this cache expires',
  version INT DEFAULT 1 COMMENT 'Cache version for invalidation',
  is_valid TINYINT(1) DEFAULT 1 COMMENT 'Whether cache is valid',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_cache_key (cache_key),
  INDEX idx_entity_type (entity_type),
  INDEX idx_expires_at (expires_at),
  INDEX idx_is_valid (is_valid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Table: cache_index
-- Purpose: Enable fast indexed lookups in cache
-- =====================================================
CREATE TABLE IF NOT EXISTS cache_index (
  id INT AUTO_INCREMENT PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL COMMENT 'Type of entity (division, section, employee)',
  entity_id VARCHAR(255) NOT NULL COMMENT 'Unique identifier of the entity',
  index_key VARCHAR(255) NOT NULL COMMENT 'Index field name (code, name, email, etc)',
  index_value VARCHAR(500) COMMENT 'Indexed value for fast lookup',
  cache_key VARCHAR(255) NOT NULL COMMENT 'Redis cache key where data is stored',
  metadata JSON COMMENT 'Additional metadata for the index',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY unique_entity_index (entity_type, entity_id, index_key),
  INDEX idx_entity_type (entity_type),
  INDEX idx_entity_id (entity_id),
  INDEX idx_index_lookup (index_key, index_value),
  INDEX idx_cache_key (cache_key),
  INDEX idx_entity_type_value (entity_type, index_value)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Table: cache_relationships
-- Purpose: Store parent-child relationships for O(1) traversal
-- =====================================================
CREATE TABLE IF NOT EXISTS cache_relationships (
  id INT AUTO_INCREMENT PRIMARY KEY,
  parent_type VARCHAR(50) NOT NULL COMMENT 'Parent entity type',
  parent_id VARCHAR(255) NOT NULL COMMENT 'Parent entity ID',
  child_type VARCHAR(50) NOT NULL COMMENT 'Child entity type',
  child_id VARCHAR(255) NOT NULL COMMENT 'Child entity ID',
  relationship_type VARCHAR(50) NOT NULL COMMENT 'Type of relationship',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE KEY unique_relationship (parent_type, parent_id, child_type, child_id),
  INDEX idx_parent (parent_type, parent_id),
  INDEX idx_child (child_type, child_id),
  INDEX idx_relationship_type (relationship_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Table: cache_sync_log
-- Purpose: Track cache sync operations
-- =====================================================
CREATE TABLE IF NOT EXISTS cache_sync_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sync_type VARCHAR(50) NOT NULL COMMENT 'Type of sync (full, partial, index)',
  entity_types TEXT COMMENT 'Comma-separated list of synced entities',
  records_synced INT DEFAULT 0,
  indexes_built INT DEFAULT 0,
  duration_ms INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'completed' COMMENT 'completed, failed, partial',
  error_message TEXT COMMENT 'Error details if failed',
  triggered_by VARCHAR(100) COMMENT 'User or system that triggered sync',
  started_at DATETIME NOT NULL,
  completed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_sync_type (sync_type),
  INDEX idx_status (status),
  INDEX idx_started_at (started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Initial Data
-- =====================================================

-- Insert default cache metadata entries
INSERT INTO cache_metadata (cache_key, entity_type, record_count, is_valid) VALUES
  ('cache:divisions:all', 'division', 0, 0),
  ('cache:sections:all', 'section', 0, 0),
  ('cache:employees:all', 'employee', 0, 0)
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

-- =====================================================
-- Stored Procedures
-- =====================================================

DELIMITER //

-- Procedure to invalidate cache
CREATE PROCEDURE IF NOT EXISTS sp_invalidate_cache(
  IN p_entity_type VARCHAR(50)
)
BEGIN
  UPDATE cache_metadata 
  SET is_valid = 0, 
      version = version + 1,
      updated_at = CURRENT_TIMESTAMP
  WHERE entity_type = p_entity_type;
  
  DELETE FROM cache_index 
  WHERE entity_type = p_entity_type;
END //

-- Procedure to get cache stats
CREATE PROCEDURE IF NOT EXISTS sp_get_cache_stats()
BEGIN
  SELECT 
    entity_type,
    COUNT(*) as cache_entries,
    SUM(record_count) as total_records,
    SUM(data_size_bytes) as total_size_bytes,
    SUM(CASE WHEN is_valid = 1 THEN 1 ELSE 0 END) as valid_caches,
    MAX(last_sync_at) as last_sync,
    MIN(expires_at) as next_expiry
  FROM cache_metadata
  GROUP BY entity_type;
END //

DELIMITER ;

-- =====================================================
-- Views for Monitoring
-- =====================================================

-- View: Active cache entries
CREATE OR REPLACE VIEW v_active_cache AS
SELECT 
  cm.cache_key,
  cm.entity_type,
  cm.record_count,
  cm.data_size_bytes,
  cm.last_sync_at,
  cm.expires_at,
  cm.version,
  TIMESTAMPDIFF(SECOND, cm.last_sync_at, NOW()) as age_seconds,
  TIMESTAMPDIFF(SECOND, NOW(), cm.expires_at) as ttl_seconds
FROM cache_metadata cm
WHERE cm.is_valid = 1
  AND cm.expires_at > NOW();

-- View: Cache index statistics
CREATE OR REPLACE VIEW v_cache_index_stats AS
SELECT 
  entity_type,
  index_key,
  COUNT(*) as index_count,
  COUNT(DISTINCT entity_id) as unique_entities,
  COUNT(DISTINCT index_value) as unique_values
FROM cache_index
GROUP BY entity_type, index_key;

-- =====================================================
-- Indexes for Performance
-- =====================================================

-- Additional composite indexes for common queries
CREATE INDEX idx_metadata_entity_valid ON cache_metadata(entity_type, is_valid);
CREATE INDEX idx_index_entity_key_value ON cache_index(entity_type, index_key, index_value);
CREATE INDEX idx_relationships_parent_child ON cache_relationships(parent_type, parent_id, child_type);
