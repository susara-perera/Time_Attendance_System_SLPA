/**
 * Run index optimization script
 * Creates performance indexes for attendance report optimization
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Import MySQL pool
const { getConnection, closePool } = require('./config/mysqlPool');

async function runIndexOptimization() {
  console.log('╔' + '═'.repeat(78) + '╗');
  console.log('║       ATTENDANCE REPORT INDEX OPTIMIZATION                               ║');
  console.log('╚' + '═'.repeat(78) + '╝\n');
  
  let connection;
  
  try {
    // Read SQL file
    const sqlFile = path.join(__dirname, 'config', 'optimize_indexes.sql');
    console.log(`📄 Reading SQL file: ${sqlFile}`);
    
    const sqlContent = fs.readFileSync(sqlFile, 'utf8');
    
    // Split into individual statements (removing comments and verification queries)
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .filter(s => !s.startsWith('--'))
      .filter(s => !s.toLowerCase().startsWith('select'))
      .filter(s => !s.toLowerCase().includes('information_schema'))
      .filter(s => s.toLowerCase().startsWith('create index') || s.toLowerCase().startsWith('use'));
    
    console.log(`📝 Found ${statements.length} index creation statements\n`);
    
    // Get connection
    console.log('🔌 Connecting to database...');
    connection = await getConnection();
    console.log('✅ Connected successfully\n');
    
    // Execute each statement
    let successCount = 0;
    let skipCount = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i].trim();
      
      if (stmt.toLowerCase().startsWith('use')) {
        console.log(`📂 ${stmt}`);
        await connection.query(stmt);
        continue;
      }
      
      // Extract index name for logging
      const indexMatch = stmt.match(/INDEX\s+IF\s+NOT\s+EXISTS\s+(\w+)/i);
      const indexName = indexMatch ? indexMatch[1] : `statement ${i + 1}`;
      
      try {
        console.log(`   Creating index: ${indexName}...`);
        await connection.query(stmt);
        console.log(`   ✅ ${indexName} created/verified`);
        successCount++;
      } catch (error) {
        if (error.code === 'ER_DUP_KEYNAME') {
          console.log(`   ⏭️  ${indexName} already exists (skipped)`);
          skipCount++;
        } else {
          console.error(`   ❌ Failed to create ${indexName}:`, error.message);
        }
      }
    }
    
    console.log('\n' + '─'.repeat(80));
    console.log(`📊 Results: ${successCount} created, ${skipCount} already existed`);
    console.log('─'.repeat(80));
    
    // Verify indexes on key tables
    console.log('\n🔍 Verifying indexes...\n');
    
    const [attendanceIndexes] = await connection.query(`
      SHOW INDEX FROM attendance
      WHERE Key_name LIKE 'idx_attendance%'
    `);
    
    console.log(`✅ attendance table: ${attendanceIndexes.length} optimization indexes`);
    attendanceIndexes.forEach(idx => {
      console.log(`   - ${idx.Key_name} (${idx.Column_name})`);
    });
    
    const [empIndexes] = await connection.query(`
      SHOW INDEX FROM emp_index_list
      WHERE Key_name LIKE 'idx_%'
    `);
    
    console.log(`\n✅ emp_index_list table: ${empIndexes.length} optimization indexes`);
    const uniqueIndexNames = [...new Set(empIndexes.map(idx => idx.Key_name))];
    uniqueIndexNames.forEach(name => {
      const cols = empIndexes.filter(i => i.Key_name === name).map(i => i.Column_name);
      console.log(`   - ${name} (${cols.join(', ')})`);
    });
    
    // Run ANALYZE TABLE to update statistics
    console.log('\n🔧 Updating table statistics...');
    await connection.query('ANALYZE TABLE attendance');
    await connection.query('ANALYZE TABLE emp_index_list');
    console.log('✅ Statistics updated\n');
    
    console.log('═'.repeat(80));
    console.log('✅ INDEX OPTIMIZATION COMPLETE!');
    console.log('═'.repeat(80));
    console.log('\n📌 Next steps:');
    console.log('   1. Restart your backend server');
    console.log('   2. Run: node test_optimized_reports.js');
    console.log('   3. Check report performance in frontend\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (connection) {
      connection.release();
    }
    await closePool();
  }
}

// Run
runIndexOptimization();
