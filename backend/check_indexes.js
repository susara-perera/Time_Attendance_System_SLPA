const mysql = require('mysql2/promise');

async function checkIndexes() {
  let connection;
  try {
    console.log('🔍 Checking Database Indexes...\n');

    connection = await mysql.createConnection({
      host: '127.0.0.1',
      port: 3306,
      user: 'root',
      password: 'gads71',
      database: 'slpa_db'
    });

    console.log('✅ Connected to MySQL\n');

    // Tables to check for indexes
    const tables = [
      'divisions_sync',
      'sections_sync',
      'employees_sync',
      'sub_sections',
      'attendance',
      'total_count_dashboard'
    ];

    for (const table of tables) {
      console.log(`📋 Table: ${table}`);
      console.log('─'.repeat(50));

      try {
        // Get indexes for this table
        const [indexes] = await connection.execute(`
          SELECT
            INDEX_NAME,
            COLUMN_NAME,
            SEQ_IN_INDEX,
            NON_UNIQUE,
            CARDINALITY
          FROM INFORMATION_SCHEMA.STATISTICS
          WHERE TABLE_SCHEMA = 'slpa_db'
            AND TABLE_NAME = ?
          ORDER BY INDEX_NAME, SEQ_IN_INDEX
        `, [table]);

        if (indexes.length === 0) {
          console.log('❌ No indexes found!');
        } else {
          console.log('✅ Indexes:');
          indexes.forEach(idx => {
            const type = idx.NON_UNIQUE === 0 ? 'UNIQUE' : 'INDEX';
            const primary = idx.INDEX_NAME === 'PRIMARY' ? ' (PRIMARY KEY)' : '';
            console.log(`   ${type}: ${idx.INDEX_NAME}${primary} on ${idx.COLUMN_NAME} (Cardinality: ${idx.CARDINALITY || 'N/A'})`);
          });
        }

        // Check table structure for key columns
        const [columns] = await connection.execute(`DESCRIBE ${table}`);
        console.log('\n📊 Key columns:');
        columns.forEach(col => {
          const keyType = col.Key === 'PRI' ? '(PRIMARY)' : col.Key === 'UNI' ? '(UNIQUE)' : col.Key === 'MUL' ? '(INDEXED)' : '';
          console.log(`   ${col.Field}: ${col.Type} ${keyType}`);
        });

      } catch (err) {
        console.log(`❌ Error checking table ${table}:`, err.message);
      }

      console.log('\n');
    }

    // Check for specific query performance issues
    console.log('🔍 Checking Query Performance (Key Queries Used in Dashboard):\n');

    const queries = [
      {
        name: 'IS Division Attendance Trend',
        sql: `EXPLAIN SELECT COUNT(DISTINCT a.employee_id) FROM attendance a INNER JOIN employees_sync e ON a.employee_id = e.EMP_NO WHERE DATE(a.date_) = CURDATE() AND e.DIV_CODE = '66' AND e.IS_ACTIVE = 1`
      },
      {
        name: 'Active Employee Count',
        sql: `EXPLAIN SELECT COUNT(*) FROM employees_sync WHERE IS_ACTIVE = 1`
      },
      {
        name: 'Division Count',
        sql: `EXPLAIN SELECT COUNT(*) FROM divisions_sync WHERE STATUS = 'ACTIVE'`
      }
    ];

    for (const query of queries) {
      console.log(`Query: ${query.name}`);
      try {
        const [explain] = await connection.execute(query.sql);
        console.log('EXPLAIN result:', JSON.stringify(explain[0], null, 2));
      } catch (err) {
        console.log('❌ Error:', err.message);
      }
      console.log('');
    }

    await connection.end();
    console.log('✅ Index check completed!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (connection) await connection.end();
    process.exit(1);
  }
}

checkIndexes();
