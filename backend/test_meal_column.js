const { createMySQLConnection } = require('./config/mysql');

(async () => {
  const conn = await createMySQLConnection();
  
  try {
    console.log('Testing MEAL-PKT-MNY column...\n');
    
    const sql = `SELECT 
                  employee_ID,
                  date_,
                  \`MEAL-PKT-MNY\` as meal_indicator
                 FROM attendance 
                 WHERE \`MEAL-PKT-MNY\` IS NOT NULL 
                 AND \`MEAL-PKT-MNY\` != ''
                 LIMIT 10`;
    
    const [result] = await conn.execute(sql);
    
    console.log('✅ SUCCESS! Column exists and query works!');
    console.log(`Found ${result.length} records with meal data\n`);
    
    if (result.length > 0) {
      console.log('Sample records:');
      result.forEach((row, i) => {
        console.log(`${i + 1}. Employee: ${row.employee_ID}, Date: ${row.date_}, Meal Indicator: "${row.meal_indicator}"`);
      });
      
      // Show unique meal indicators
      const uniqueIndicators = [...new Set(result.map(r => r.meal_indicator))];
      console.log('\nUnique meal indicators found:', uniqueIndicators);
    }
    
  } catch (e) {
    console.log('❌ Error:', e.message);
    console.log('\nTrying to find the column...');
    
    const [cols] = await conn.execute('SHOW COLUMNS FROM attendance');
    console.log('\nAll columns in attendance table:');
    cols.forEach(c => console.log('  ' + c.Field));
  }
  
  await conn.end();
})();
