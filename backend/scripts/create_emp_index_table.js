/**
 * Create emp_index_list table
 * 
 * This script creates the emp_index_list table in MySQL database.
 * This table stores a hierarchical index of employees with their divisions,
 * sections, and sub-sections for fast filtering.
 * 
 * Usage: node scripts/create_emp_index_table.js
 */

const { createMySQLConnection } = require('../config/mysql');
const fs = require('fs');
const path = require('path');

const createTable = async () => {
  const conn = await createMySQLConnection();
  
  try {
    console.log('📋 Creating emp_index_list table...');
    
    // Read SQL file
    const sqlPath = path.join(__dirname, '../config/createEmpIndexTable.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Execute SQL
    await conn.execute(sql);
    
    console.log('✅ emp_index_list table created successfully');
    
    // Verify table exists
    const [tables] = await conn.execute("SHOW TABLES LIKE 'emp_index_list'");
    if (tables.length > 0) {
      console.log('✅ Table verified in database');
      
      // Show table structure
      const [columns] = await conn.execute('DESCRIBE emp_index_list');
      console.log('\n📊 Table structure:');
      columns.forEach(col => {
        console.log(`   ${col.Field} (${col.Type})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error creating table:', error.message);
    throw error;
  } finally {
    await conn.end();
  }
};

createTable()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Failed:', err.message);
    process.exit(1);
  });
