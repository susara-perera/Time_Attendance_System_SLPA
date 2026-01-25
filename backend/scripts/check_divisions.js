require('dotenv').config();
const { MySQLDivision } = require('../models/mysql');

async function checkDivisions() {
  try {
    console.log('Fetching divisions from database...');
    const divisions = await MySQLDivision.findAll({
      limit: 10
    });
    
    console.log(`\nFound ${divisions.length} divisions:`);
    divisions.forEach(div => {
      console.log({
        id: div.id,
        name: div.name,
        dataValues: div.dataValues
      });
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkDivisions();
