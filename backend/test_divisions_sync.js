const { sequelize } = require('./config/mysql');

async function testDivisionsSync() {
  try {
    console.log('Testing divisions_sync table...\n');
    
    // Test 1: Check if table exists
    const [tables] = await sequelize.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'divisions_sync'
    `);
    
    if (tables.length === 0) {
      console.error('❌ divisions_sync table does not exist!');
      console.log('Please run the sync setup first.');
      process.exit(1);
    }
    
    console.log('✅ divisions_sync table exists\n');
    
    // Test 2: Check table structure
    console.log('Table Structure:');
    const [columns] = await sequelize.query(`
      DESCRIBE divisions_sync
    `);
    console.table(columns);
    console.log('');
    
    // Test 3: Count records
    const [[countResult]] = await sequelize.query(`
      SELECT COUNT(*) as count FROM divisions_sync
    `);
    console.log(`📊 Total divisions: ${countResult.count}\n`);
    
    if (countResult.count === 0) {
      console.warn('⚠️  No data in divisions_sync table!');
      console.log('Please run the initial sync to populate data.');
      process.exit(0);
    }
    
    // Test 4: Sample data
    console.log('Sample Data (first 5 rows):');
    const [divisions] = await sequelize.query(`
      SELECT * FROM divisions_sync LIMIT 5
    `);
    console.table(divisions);
    console.log('');
    
    // Test 5: Test the query used by the API
    console.log('Testing API Query:');
    const [apiResult] = await sequelize.query(`
      SELECT 
        d.*,
        COALESCE(e.emp_count, 0) as employee_count
      FROM divisions_sync d
      LEFT JOIN (
        SELECT DIV_CODE, COUNT(*) as emp_count 
        FROM employees_sync 
        WHERE IS_ACTIVE = 1 
        GROUP BY DIV_CODE
      ) e ON d.HIE_CODE = e.DIV_CODE
      ORDER BY d.HIE_NAME ASC
      LIMIT 5
    `);
    console.table(apiResult);
    
    console.log('\n✅ All tests passed!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

testDivisionsSync();
