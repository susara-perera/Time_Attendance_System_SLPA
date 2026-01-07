const { createMySQLConnection } = require('../config/mysql');

async function fixSectionsDivisionCodes() {
  let connection;
  try {
    console.log('🔌 Connecting to MySQL...');
    connection = await createMySQLConnection();

    console.log('🔍 Analyzing sections with missing division codes...');
    const [missingCount] = await connection.execute(
      'SELECT COUNT(*) as count FROM sections_sync WHERE HIE_CODE_3 IS NULL OR HIE_CODE_3 = ""'
    );
    console.log(`⚠️  Found ${missingCount[0].count} sections missing division codes.`);

    console.log('🔄 Backfilling HIE_CODE_3 (Division Code) from employees_sync...');
    
    // We update sections_sync based on the division most commonly associated with the section's employees
    const updateQuery = `
      UPDATE sections_sync s
      SET s.HIE_CODE_3 = (
        SELECT DIV_CODE 
        FROM employees_sync e 
        WHERE e.SEC_CODE = s.HIE_CODE 
        AND e.DIV_CODE IS NOT NULL 
        AND e.DIV_CODE != ''
        GROUP BY DIV_CODE 
        ORDER BY COUNT(*) DESC 
        LIMIT 1
      )
      WHERE s.HIE_CODE_3 IS NULL OR s.HIE_CODE_3 = ''
    `;

    const [result] = await connection.execute(updateQuery);
    console.log(`✅ Updated ${result.affectedRows} sections with division codes.`);
    
    // Verify results
    const [remaining] = await connection.execute(
      'SELECT COUNT(*) as count FROM sections_sync WHERE HIE_CODE_3 IS NULL OR HIE_CODE_3 = ""'
    );
    console.log(`ℹ️  Remaining sections without division code: ${remaining[0].count} (likely have no employees assigned)`);

  } catch (error) {
    console.error('❌ Error fixing sections:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('👋 Connection closed.');
    }
  }
}

fixSectionsDivisionCodes();
