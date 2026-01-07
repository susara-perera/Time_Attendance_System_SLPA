const { sequelize } = require('../config/mysql');

(async () => {
  try {
    const [rows] = await sequelize.query('SELECT HIE_CODE, HIE_NAME, HIE_RELATIONSHIP FROM sections_sync ORDER BY HIE_NAME LIMIT 200');
    console.log('Sections sample:');
    rows.slice(0,50).forEach(r => console.log(` - ${r.HIE_CODE} : ${r.HIE_NAME} (division: ${r.HIE_RELATIONSHIP})`));
    process.exit(0);
  } catch (err) {
    console.error('Error listing sections:', err.message, err.stack);
    process.exit(1);
  }
})();