require('dotenv').config();
const mysql = require('mysql2/promise');

async function createTable() {
  try {
    const conn = await mysql.createConnection({
      host: process.env.MYSQL_HOST,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE
    });

    await conn.execute(`CREATE TABLE IF NOT EXISTS cache_sync_log (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sync_type VARCHAR(50) NOT NULL,
      entity_types TEXT,
      records_synced INT DEFAULT 0,
      indexes_built INT DEFAULT 0,
      duration_ms INT DEFAULT 0,
      status VARCHAR(20) DEFAULT 'completed',
      error_message TEXT,
      triggered_by VARCHAR(100),
      started_at DATETIME NOT NULL,
      completed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_sync_type (sync_type),
      INDEX idx_status (status),
      INDEX idx_started_at (started_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    console.log('cache_sync_log table created successfully');
    conn.end();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

createTable();