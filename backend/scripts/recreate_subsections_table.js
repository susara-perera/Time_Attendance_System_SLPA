/**
 * Script to create sub_sections table (alternative name due to tablespace issue)
 */
const { sequelize } = require('../models/mysql');

async function createSubSectionsTable() {
  try {
    console.log('🔧 Creating sub_sections table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS sub_sections (
        id INT AUTO_INCREMENT PRIMARY KEY,
        division_id VARCHAR(50),
        division_code VARCHAR(50),
        division_name VARCHAR(255),
        section_id VARCHAR(50) NOT NULL,
        section_code VARCHAR(50),
        section_name VARCHAR(255),
        sub_name VARCHAR(255) NOT NULL,
        sub_code VARCHAR(50) NOT NULL,
        status VARCHAR(20) DEFAULT 'ACTIVE',
        is_active BOOLEAN DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_section_id (section_id),
        INDEX idx_section_code (section_code),
        INDEX idx_division_code (division_code),
        INDEX idx_sub_code (sub_code),
        INDEX idx_status (status),
        UNIQUE KEY unique_sub (section_id, sub_code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    console.log('✅ sub_sections table created successfully!');
    
    // Verify
    const [count] = await sequelize.query('SELECT COUNT(*) as count FROM sub_sections');
    console.log('📊 Row count:', count[0].count);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

createSubSectionsTable();
