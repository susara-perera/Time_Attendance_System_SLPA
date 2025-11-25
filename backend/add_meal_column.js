const { createMySQLConnection } = require('./config/mysql');

(async () => {
  const conn = await createMySQLConnection();
  
  try {
    console.log('Adding MEAL-PKT-MNY column to attendance table...\n');
    
    // Add the column if it doesn't exist
    const alterSql = `ALTER TABLE attendance 
                      ADD COLUMN \`MEAL-PKT-MNY\` VARCHAR(10) NULL DEFAULT NULL
                      AFTER scan_type`;
    
    await conn.execute(alterSql);
    
    console.log('✅ Successfully added MEAL-PKT-MNY column to attendance table!');
    console.log('\nColumn details:');
    console.log('  Name: MEAL-PKT-MNY');
    console.log('  Type: VARCHAR(10)');
    console.log('  Values: "I" or "1" for meal packet, "mny" for meal money');
    
    // Verify the column was added
    const [cols] = await conn.execute('SHOW COLUMNS FROM attendance');
    console.log('\nUpdated attendance table columns:');
    cols.forEach(c => console.log('  ' + c.Field));
    
  } catch (e) {
    if (e.message.includes('Duplicate column name')) {
      console.log('✅ Column already exists!');
    } else {
      console.log('❌ Error:', e.message);
    }
  }
  
  await conn.end();
})();
