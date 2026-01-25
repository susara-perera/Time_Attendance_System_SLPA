const mysql = require('mysql2/promise');

async function optimizeDashboard() {
  let connection;
  try {
    console.log('🚀 Optimizing Dashboard Performance...\n');

    connection = await mysql.createConnection({
      host: '127.0.0.1',
      port: 3306,
      user: 'root',
      password: 'gads71',
      database: 'slpa_db'
    });

    console.log('✅ Connected to MySQL\n');

    // 1. Check current indexes on total_count_dashboard
    console.log('📋 Current indexes on total_count_dashboard:');
    const [indexes] = await connection.execute(`
      SHOW INDEX FROM total_count_dashboard
    `);
    indexes.forEach(idx => {
      console.log(`   ${idx.Key_name}: ${idx.Column_name} (${idx.Non_unique === 0 ? 'UNIQUE' : 'INDEX'})`);
    });

    // 2. Add composite index for faster queries
    console.log('\n🔧 Adding optimized indexes...');
    
    try {
      await connection.execute(`
        ALTER TABLE total_count_dashboard
        ADD INDEX idx_id_updated (id, last_updated)
      `);
      console.log('✅ Added composite index on (id, last_updated)');
    } catch (err) {
      if (err.code === 'ER_DUP_KEYNAME') {
        console.log('✓ Index idx_id_updated already exists');
      } else {
        throw err;
      }
    }

    // 3. Add indexes on employees_sync for faster IS division queries
    console.log('\n🔧 Optimizing employees_sync indexes...');
    
    try {
      await connection.execute(`
        CREATE INDEX idx_emp_div_active_optimized 
        ON employees_sync(DIV_CODE, IS_ACTIVE, EMP_NO)
      `);
      console.log('✅ Added optimized composite index on employees_sync');
    } catch (err) {
      if (err.code === 'ER_DUP_KEYNAME') {
        console.log('✓ Index already exists on employees_sync');
      } else {
        console.log('⚠️ Index creation skipped:', err.message);
      }
    }

    // 4. Add covering index on attendance table for IS queries
    console.log('\n🔧 Optimizing attendance indexes...');
    
    try {
      await connection.execute(`
        CREATE INDEX idx_att_date_emp_optimized 
        ON attendance(date_, employee_id, time_)
      `);
      console.log('✅ Added covering index on attendance');
    } catch (err) {
      if (err.code === 'ER_DUP_KEYNAME') {
        console.log('✓ Index already exists on attendance');
      } else {
        console.log('⚠️ Index creation skipped:', err.message);
      }
    }

    // 5. Analyze tables for query optimization
    console.log('\n📊 Analyzing tables for optimization...');
    await connection.execute('ANALYZE TABLE total_count_dashboard');
    console.log('✅ Analyzed total_count_dashboard');
    await connection.execute('ANALYZE TABLE employees_sync');
    console.log('✅ Analyzed employees_sync');
    await connection.execute('ANALYZE TABLE attendance');
    console.log('✅ Analyzed attendance');

    // 6. Test query performance
    console.log('\n🔍 Testing dashboard query performance...');
    
    const start = Date.now();
    const [result] = await connection.execute(`
      SELECT 
        totalDivisions,
        totalSections,
        totalSubsections,
        totalActiveEmployees,
        IS_attendance_trend,
        present_IS,
        absent_IS,
        last_updated
      FROM total_count_dashboard
      WHERE id = 1
      LIMIT 1
    `);
    const queryTime = Date.now() - start;

    console.log(`✅ Dashboard query executed in ${queryTime}ms`);

    if (result.length > 0) {
      console.log('\n📊 Dashboard data retrieved:');
      console.log(`   Divisions: ${result[0].totalDivisions}`);
      console.log(`   Sections: ${result[0].totalSections}`);
      console.log(`   Employees: ${result[0].totalActiveEmployees}`);
      console.log(`   Last Updated: ${result[0].last_updated}`);
    }

    console.log('\n✅ Dashboard optimization completed!');
    console.log('\n💡 Performance Tips:');
    console.log('   - Query time should be < 5ms (currently: ' + queryTime + 'ms)');
    console.log('   - Dashboard loads instantly with cached data');
    console.log('   - Auto-sync runs every 4 hours to keep data fresh');

    await connection.end();
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (connection) await connection.end();
    process.exit(1);
  }
}

optimizeDashboard();
