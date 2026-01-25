require('dotenv').config();
const { sequelize } = require('./config/mysql');

(async () => {
  try {
    console.log('Testing IS division employee query...');
    await sequelize.authenticate();
    
    const isDivCode = process.env.IS_DIV_CODE || '66';
    console.log(`Using DIV_CODE: ${isDivCode}`);
    
    const [allISEmployees] = await sequelize.query(`
      SELECT COUNT(*) as count
      FROM employees_sync e
      WHERE e.DIV_CODE = ? AND e.IS_ACTIVE = 1
    `, { replacements: [isDivCode] });
    
    console.log(`Total IS employees (simple count): ${allISEmployees[0].count}`);
    
    const [withJoins] = await sequelize.query(`
      SELECT
        e.EMP_NO,
        e.EMP_NAME,
        e.DIV_CODE,
        COALESCE(NULLIF(e.DIV_NAME, ''), NULLIF(d.HIE_NAME, ''), NULL) AS DIV_NAME,
        e.SEC_CODE,
        COALESCE(NULLIF(e.SEC_NAME, ''), NULLIF(s.HIE_NAME_4, ''), NULLIF(s.HIE_NAME, ''), NULL) AS SEC_NAME
      FROM employees_sync e
      LEFT JOIN divisions_sync d
        ON d.HIE_CODE = e.DIV_CODE
      LEFT JOIN sections_sync s
        ON (s.SECTION_ID = e.SEC_CODE OR s.HIE_CODE = e.SEC_CODE)
      WHERE e.DIV_CODE = ? AND e.IS_ACTIVE = 1
      LIMIT 5
    `, { replacements: [isDivCode] });
    
    console.log(`With joins (limited to 5): ${withJoins.length} rows`);
    console.log('Sample:', JSON.stringify(withJoins[0], null, 2));
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
