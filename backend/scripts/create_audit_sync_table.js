/**
 * Create audit_sync table with optimized schema and indexes
 * This table stores pre-processed incomplete punch records for ultra-fast audit report generation
 * 
 * Strategy:
 * - Pre-calculate incomplete punch issues (CHECK_IN_ONLY, CHECK_OUT_ONLY)
 * - Store denormalized employee data to avoid JOINs
 * - Add optimized indexes for common query patterns
 * - Use same proven approach as attendance_sync table
 */

const { createMySQLConnection } = require('../config/mysql');

const createAuditSyncTable = async () => {
  let conn;
  
  try {
    conn = await createMySQLConnection();
    console.log('\n🔧 === CREATING AUDIT_SYNC TABLE ===\n');

    // Drop table if exists (for clean setup)
    console.log('🗑️  Dropping existing audit_sync table (if exists)...');
    await conn.execute('DROP TABLE IF EXISTS audit_sync');
    console.log('   ✅ Dropped\n');

    // Create optimized audit_sync table
    console.log('📋 Creating audit_sync table with optimized schema...');
    
    const createTableSQL = `
      CREATE TABLE audit_sync (
        audit_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        
        -- Employee Information (denormalized for fast access)
        employee_id VARCHAR(50) NOT NULL,
        employee_name VARCHAR(255) DEFAULT NULL,
        designation VARCHAR(255) DEFAULT NULL,
        
        -- Organizational Data
        division_id VARCHAR(50) DEFAULT NULL,
        division_name VARCHAR(255) DEFAULT NULL,
        section_id VARCHAR(50) DEFAULT NULL,
        section_name VARCHAR(255) DEFAULT NULL,
        sub_section_id VARCHAR(50) DEFAULT NULL,
        sub_section_name VARCHAR(255) DEFAULT NULL,
        
        -- Punch Event Details
        event_date DATE NOT NULL,
        event_time TIME DEFAULT NULL,
        event_timestamp DATETIME DEFAULT NULL,
        
        -- Scan Type Information
        scan_type VARCHAR(20) NOT NULL,
        raw_scan_type VARCHAR(20) DEFAULT NULL,
        
        -- Issue Classification (KEY FIELDS for audit reporting)
        issue_type ENUM('CHECK_IN_ONLY', 'CHECK_OUT_ONLY', 'UNKNOWN_PUNCH') NOT NULL,
        severity ENUM('HIGH', 'MEDIUM', 'LOW') NOT NULL,
        display_label VARCHAR(100) NOT NULL,
        description TEXT DEFAULT NULL,
        
        -- Status Tracking
        is_resolved BOOLEAN DEFAULT 0,
        resolved_at DATETIME DEFAULT NULL,
        resolved_by VARCHAR(50) DEFAULT NULL,
        resolution_note TEXT DEFAULT NULL,
        
        -- Metadata
        synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT 1,
        
        -- Indexes for ultra-fast querying
        INDEX idx_employee_date (employee_id, event_date),
        INDEX idx_event_date (event_date),
        INDEX idx_issue_type (issue_type),
        INDEX idx_severity (severity),
        INDEX idx_division (division_id, event_date),
        INDEX idx_section (section_id, event_date),
        INDEX idx_is_resolved (is_resolved, event_date),
        INDEX idx_scan_type (scan_type, event_date),
        INDEX idx_composite_filter (event_date, division_id, section_id, issue_type),
        INDEX idx_active (is_active, event_date)
        
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        COMMENT='Pre-processed incomplete punch records for ultra-fast audit reports';
    `;

    await conn.execute(createTableSQL);
    console.log('   ✅ Table created successfully\n');

    // Create indexes summary view
    console.log('📊 Creating audit statistics view...');
    
    const createViewSQL = `
      CREATE OR REPLACE VIEW v_audit_summary AS
      SELECT 
        event_date AS audit_date,
        issue_type,
        severity,
        division_name,
        section_name,
        COUNT(*) AS issue_count,
        COUNT(DISTINCT employee_id) AS affected_employees,
        SUM(CASE WHEN is_resolved = 1 THEN 1 ELSE 0 END) AS resolved_count,
        ROUND(SUM(CASE WHEN is_resolved = 1 THEN 1 ELSE 0 END) / COUNT(*) * 100, 2) AS resolution_rate
      FROM audit_sync
      WHERE is_active = 1
      GROUP BY event_date, issue_type, severity, division_name, section_name
      ORDER BY event_date DESC, severity ASC, issue_count DESC;
    `;

    await conn.execute(createViewSQL);
    console.log('   ✅ View created successfully\n');

    // Verify table structure
    console.log('🔍 Verifying table structure...');
    const [columns] = await conn.execute(`
      SELECT 
        COLUMN_NAME, 
        COLUMN_TYPE, 
        IS_NULLABLE, 
        COLUMN_KEY, 
        COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'audit_sync'
      ORDER BY ORDINAL_POSITION
    `);

    console.log(`\n   ✅ Table has ${columns.length} columns:`);
    console.log('   ' + '-'.repeat(80));
    columns.slice(0, 10).forEach(col => {
      console.log(`   ${col.COLUMN_NAME.padEnd(25)} ${col.COLUMN_TYPE.padEnd(20)} ${col.COLUMN_KEY || ''}`);
    });
    console.log(`   ... and ${columns.length - 10} more columns\n`);

    // Verify indexes
    console.log('🔍 Verifying indexes...');
    const [indexes] = await conn.execute(`
      SHOW INDEX FROM audit_sync WHERE Key_name != 'PRIMARY'
    `);

    const uniqueIndexes = [...new Set(indexes.map(idx => idx.Key_name))];
    console.log(`\n   ✅ Table has ${uniqueIndexes.length} indexes:`);
    console.log('   ' + '-'.repeat(80));
    uniqueIndexes.forEach(idx => {
      const columns = indexes
        .filter(i => i.Key_name === idx)
        .map(i => i.Column_name)
        .join(', ');
      console.log(`   ${idx.padEnd(35)} (${columns})`);
    });
    console.log('');

    // Display table info
    const [tableInfo] = await conn.execute(`
      SELECT 
        ENGINE, 
        ROW_FORMAT, 
        TABLE_COLLATION,
        CREATE_OPTIONS,
        TABLE_COMMENT
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'audit_sync'
    `);

    if (tableInfo.length > 0) {
      console.log('📊 Table Configuration:');
      console.log('   ' + '-'.repeat(80));
      console.log(`   Engine:          ${tableInfo[0].ENGINE}`);
      console.log(`   Row Format:      ${tableInfo[0].ROW_FORMAT}`);
      console.log(`   Collation:       ${tableInfo[0].TABLE_COLLATION}`);
      console.log(`   Comment:         ${tableInfo[0].TABLE_COMMENT}`);
      console.log('');
    }

    console.log('✅ === AUDIT_SYNC TABLE CREATED SUCCESSFULLY ===\n');
    console.log('📋 Table Features:');
    console.log('   ✅ Denormalized employee + organizational data (no JOINs needed)');
    console.log('   ✅ Pre-classified issue types (CHECK_IN_ONLY, CHECK_OUT_ONLY)');
    console.log('   ✅ Severity levels (HIGH, MEDIUM, LOW)');
    console.log('   ✅ Resolution tracking (is_resolved, resolved_at, resolution_note)');
    console.log('   ✅ 10 optimized indexes for common query patterns');
    console.log('   ✅ Summary view (v_audit_summary) for quick statistics');
    console.log('');
    console.log('🚀 Next Steps:');
    console.log('   1. Run: node backend/scripts/sync_audit_data.js');
    console.log('   2. Verify: SELECT COUNT(*) FROM audit_sync;');
    console.log('   3. Test: SELECT * FROM v_audit_summary LIMIT 10;');
    console.log('');

  } catch (error) {
    console.error('❌ Error creating audit_sync table:', error);
    throw error;
  } finally {
    if (conn) {
      await conn.end();
      console.log('🔌 Database connection closed\n');
    }
  }
};

// Run if called directly
if (require.main === module) {
  createAuditSyncTable()
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { createAuditSyncTable };
