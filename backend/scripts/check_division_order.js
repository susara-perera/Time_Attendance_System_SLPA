require('dotenv').config();
const { sequelize } = require('../models/mysql');

async function checkDivisionOrder() {
  try {
    await sequelize.authenticate();
    const [rows] = await sequelize.query('SELECT id, HIE_CODE, HIE_NAME FROM divisions_sync ORDER BY id LIMIT 20');

    console.log('Current order (alphabetical sort):');
    rows.forEach(r => console.log(`${r.id}. HIE_CODE=${r.HIE_CODE} (${r.HIE_NAME})`));

    console.log('\nSorted numerically:');
    const sorted = [...rows].sort((a,b) => parseInt(a.HIE_CODE) - parseInt(b.HIE_CODE));
    sorted.forEach(r => console.log(`${r.id}. HIE_CODE=${r.HIE_CODE} (${r.HIE_NAME})`));

    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

checkDivisionOrder();