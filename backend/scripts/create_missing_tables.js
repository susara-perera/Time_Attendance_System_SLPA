require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const sqlFiles = [
  'createAttendanceSyncTable.sql',
  'createEmpIndexTable.sql',
  'createSubSectionsTable.sql',
  'createTransferredEmployeesTable.sql'
];

(async () => {
  try {
    const conn = await mysql.createConnection({
      host: process.env.MYSQL_HOST || 'localhost',
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'slpa_db',
      multipleStatements: true
    });

    for (const file of sqlFiles) {
      const filePath = path.join(__dirname, '..', 'config', file);
      console.log('Executing', file);
      const sql = fs.readFileSync(filePath, 'utf8');
      await conn.query(sql);
    }

    console.log('✅ All SQL files executed successfully');
    await conn.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error executing SQL files:', err.message);
    process.exit(1);
  }
})();