/**
 * Import attendance data from SQL file
 * This script reads the attendance.sql file and executes the INSERT statements
 */

const { createMySQLConnection } = require('../config/mysql');
const fs = require('fs');
const path = require('path');

const importAttendanceData = async () => {
  const conn = await createMySQLConnection();

  try {
    console.log('🚀 Starting attendance data import...');

    // Read the SQL file
    const sqlFilePath = 's:\\C_Drive_Link\\Desktop\\attendance.sql';
    console.log(`📖 Reading SQL file: ${sqlFilePath}`);

    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    console.log(`📊 File size: ${(sqlContent.length / 1024 / 1024).toFixed(2)} MB`);

    // Extract INSERT statements (skip the CREATE TABLE and other statements)
    const insertStatements = sqlContent
      .split('\n')
      .filter(line => line.trim().startsWith('INSERT INTO `attendance`'))
      .join('\n')
      .split('INSERT INTO `attendance` (`attendance_id`, `employee_ID`, `fingerprint_id`, `date_`, `time_`, `scan_type`) VALUES')
      .filter(stmt => stmt.trim().length > 0)
      .map(stmt => `INSERT INTO attendance (attendance_id, employee_ID, fingerprint_id, date_, time_, scan_type) VALUES${stmt.trim()}`)
      .filter(stmt => stmt.includes('VALUES'));

    console.log(`📝 Found ${insertStatements.length} INSERT statements to execute`);

    // Execute INSERT statements in batches
    const batchSize = 100;
    let totalInserted = 0;
    let batchCount = 0;

    for (let i = 0; i < insertStatements.length; i += batchSize) {
      const batch = insertStatements.slice(i, i + batchSize);
      batchCount++;

      console.log(`🔄 Processing batch ${batchCount}/${Math.ceil(insertStatements.length / batchSize)} (${batch.length} statements)...`);

      for (const statement of batch) {
        try {
          // Clean up the statement
          let cleanStatement = statement
            .replace(/,\s*$/, '') // Remove trailing comma
            .replace(/;\s*$/, '') // Remove trailing semicolon
            .trim();

          if (cleanStatement) {
            await conn.execute(cleanStatement);
            totalInserted++;
          }
        } catch (err) {
          console.error(`❌ Error executing statement:`, err.message);
          console.error(`Statement:`, statement.substring(0, 200) + '...');
          // Continue with next statement
        }
      }

      console.log(`✅ Batch ${batchCount} completed. Total inserted so far: ${totalInserted}`);
    }

    console.log(`\n🎉 Import completed successfully!`);
    console.log(`📊 Total records inserted: ${totalInserted}`);

    // Verify the import
    const [countResult] = await conn.execute('SELECT COUNT(*) as total FROM attendance');
    console.log(`🔍 Verification: ${countResult[0].total} records in attendance table`);

  } catch (error) {
    console.error('❌ Import failed:', error.message);
    throw error;
  } finally {
    await conn.end();
  }
};

importAttendanceData()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Failed:', err.message);
    process.exit(1);
  });
