/**
 * Check actual table structures and create attendance indexes
 */

require('dotenv').config();
const { getConnection, closePool } = require('./config/mysqlPool');

async function createAttendanceIndexes() {
  console.log('\n🔍 Checking attendance table structure...\n');
  
  let connection;
  
  try {
    connection = await getConnection();
    
    // Check attendance table columns
    const [columns] = await connection.query('DESCRIBE attendance');
    console.log('📋 attendance table columns:');
    columns.forEach(col => {
      console.log(`   - ${col.Field} (${col.Type})`);
    });
    
    // Create indexes on attendance table
    console.log('\n⚡ Creating critical indexes on attendance table...\n');
    
    const indexes = [
      {
        name: 'idx_attendance_date',
        sql: 'CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date_)'
      },
      {
        name: 'idx_attendance_date_emp',
        sql: 'CREATE INDEX IF NOT EXISTS idx_attendance_date_emp ON attendance(date_, employee_ID)'
      },
      {
        name: 'idx_attendance_emp_date',
        sql: 'CREATE INDEX IF NOT EXISTS idx_attendance_emp_date ON attendance(employee_ID, date_)'
      },
      {
        name: 'idx_attendance_full_sort',
        sql: 'CREATE INDEX IF NOT EXISTS idx_attendance_full_sort ON attendance(employee_ID, date_, time_)'
      }
    ];
    
    for (const index of indexes) {
      try {
        console.log(`   Creating ${index.name}...`);
        await connection.query(index.sql);
        console.log(`   ✅ ${index.name} created`);
      } catch (error) {
        if (error.code === 'ER_DUP_KEYNAME') {
          console.log(`   ⏭️  ${index.name} already exists`);
        } else {
          console.error(`   ❌ ${index.name} failed: ${error.message}`);
        }
      }
    }
    
    // Verify all indexes
    console.log('\n📊 Verifying all attendance indexes:\n');
    const [allIndexes] = await connection.query('SHOW INDEX FROM attendance');
    const uniqueIndexNames = [...new Set(allIndexes.map(idx => idx.Key_name))];
    uniqueIndexNames.forEach(name => {
      const cols = allIndexes.filter(i => i.Key_name === name).map(i => i.Column_name);
      console.log(`   ✅ ${name} (${cols.join(', ')})`);
    });
    
    // Run ANALYZE
    console.log('\n🔧 Updating statistics...');
    await connection.query('ANALYZE TABLE attendance');
    console.log('✅ Done!\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) connection.release();
    await closePool();
  }
}

createAttendanceIndexes();
