/**
 * Create attendance table with correct structure
 */

const { createMySQLConnection } = require('../config/mysql');

const createAttendanceTable = async () => {
  const conn = await createMySQLConnection();

  try {
    console.log('📋 Creating attendance table...');

    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS attendance (
        attendance_id int(11) NOT NULL,
        employee_ID int(11) DEFAULT NULL,
        fingerprint_id varchar(50) DEFAULT NULL,
        date_ date NOT NULL,
        time_ time DEFAULT NULL,
        scan_type enum('IN','OUT') DEFAULT NULL,
        PRIMARY KEY (attendance_id),
        KEY idx_employee_date (employee_ID, date_),
        KEY idx_date (date_)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `;

    await conn.execute(createTableSQL);
    console.log('✅ attendance table created successfully');

    // Verify table exists
    const [tables] = await conn.execute("SHOW TABLES LIKE 'attendance'");
    if (tables.length > 0) {
      console.log('✅ Table verified in database');

      // Show table structure
      const [columns] = await conn.execute('DESCRIBE attendance');
      console.log('\n📊 Table structure:');
      columns.forEach(col => {
        console.log(`   ${col.Field} (${col.Type})`);
      });
    }

  } catch (error) {
    console.error('❌ Error creating table:', error.message);
    throw error;
  } finally {
    await conn.end();
  }
};

createAttendanceTable()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Failed:', err.message);
    process.exit(1);
  });
