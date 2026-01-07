const { sequelize } = require('../config/mysql');

(async () => {
  try {
    const [rows] = await sequelize.query('SELECT HIE_CODE, HIE_NAME FROM divisions_sync ORDER BY HIE_NAME LIMIT 50');
    console.log('Divisions sample:');
    rows.forEach(r => console.log(` - ${r.HIE_CODE} : ${r.HIE_NAME}`));
    process.exit(0);
  } catch (err) {
    console.error('Error listing divisions:', err.message, err.stack);
    process.exit(1);
  }
})();