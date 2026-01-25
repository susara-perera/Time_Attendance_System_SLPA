const path = require('path');

// Load env
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize } = require('../config/mysql');

async function run() {
  try {
    console.log('[addDivisionColumns] Ensuring columns exist...');
    const queries = [
      "ALTER TABLE divisions ADD COLUMN IF NOT EXISTS description TEXT NULL",
      "ALTER TABLE divisions ADD COLUMN IF NOT EXISTS workingHours JSON NULL",
      "ALTER TABLE divisions ADD COLUMN IF NOT EXISTS isActive TINYINT(1) NOT NULL DEFAULT 1",
      "ALTER TABLE divisions ADD COLUMN IF NOT EXISTS managerId INT NULL",
      "ALTER TABLE divisions ADD COLUMN IF NOT EXISTS createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP",
      "ALTER TABLE divisions ADD COLUMN IF NOT EXISTS updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
      "ALTER TABLE sections ADD COLUMN IF NOT EXISTS description TEXT NULL",
      "ALTER TABLE sections ADD COLUMN IF NOT EXISTS isActive TINYINT(1) NOT NULL DEFAULT 1",
      "ALTER TABLE sections ADD COLUMN IF NOT EXISTS managerId INT NULL",
      "ALTER TABLE sections ADD COLUMN IF NOT EXISTS createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP",
      "ALTER TABLE sections ADD COLUMN IF NOT EXISTS updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
    ];

    for (const sql of queries) {
      console.log('Executing:', sql);
      await sequelize.query(sql);
    }

    console.log('[addDivisionColumns] Done');
    process.exit(0);
  } catch (err) {
    console.error('[addDivisionColumns] Error:', err);
    process.exit(1);
  }
}

run();
