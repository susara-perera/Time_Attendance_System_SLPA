const { createMySQLConnection } = require('./config/mysql');

async function checkDatabase() {
  try {
    const connection = await createMySQLConnection();
    
    console.log('=== CHECKING DATABASE TABLES ===');
    
    // Show all tables
    const [tables] = await connection.execute('SHOW TABLES');
    console.log('Available tables:', tables);
    
    // Check if divisions table exists
    const divisionTables = tables.filter(table => 
      Object.values(table)[0].toLowerCase().includes('division') || 
      Object.values(table)[0].toLowerCase().includes('dept') ||
      Object.values(table)[0].toLowerCase().includes('department')
    );
    
    if (divisionTables.length > 0) {
      console.log('\n=== DIVISION TABLES FOUND ===');
      for (const table of divisionTables) {
        const tableName = Object.values(table)[0];
        console.log(`\nTable: ${tableName}`);
        
        // Describe table structure
        const [structure] = await connection.execute(`DESCRIBE ${tableName}`);
        console.log('Structure:', structure);
        
        // Show sample data
        const [data] = await connection.execute(`SELECT * FROM ${tableName} LIMIT 5`);
        console.log('Sample data:', data);
      }
    }
    
    // Check if there's employee table with division info
    const empTables = tables.filter(table => 
      Object.values(table)[0].toLowerCase().includes('employee') ||
      Object.values(table)[0].toLowerCase().includes('emp')
    );
    
    if (empTables.length > 0) {
      console.log('\n=== EMPLOYEE TABLES FOUND ===');
      for (const table of empTables) {
        const tableName = Object.values(table)[0];
        console.log(`\nTable: ${tableName}`);
        
        // Describe table structure
        const [structure] = await connection.execute(`DESCRIBE ${tableName}`);
        console.log('Structure:', structure);
        
        // Show sample data
        const [data] = await connection.execute(`SELECT * FROM ${tableName} LIMIT 3`);
        console.log('Sample data:', data);
      }
    }
    
    await connection.end();
  } catch (error) {
    console.error('Database check error:', error);
  }
}

checkDatabase();
