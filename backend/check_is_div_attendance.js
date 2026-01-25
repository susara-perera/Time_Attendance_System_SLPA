require('dotenv').config();
const { sequelize } = require('./config/mysql');

(async () => {
  try {
    await sequelize.authenticate();
    const [r] = await sequelize.query(`
      SELECT 
        is_division_attendance
      FROM total_count_dashboard 
      WHERE id = 1
    `);
    
    if (!r[0]?.is_division_attendance) {
      console.log('❌ is_division_attendance is NULL or empty');
      process.exit(1);
    }

    const data = JSON.parse(r[0].is_division_attendance);
    console.log('✅ is_division_attendance data:');
    console.log(`Total Employees: ${data.totalEmployees}`);
    console.log(`Present Count: ${data.presentCount}`);
    console.log(`Absent Count: ${data.absentCount}`);
    console.log(`Employees Array Length: ${data.employees?.length || 0}`);
    
    if (data.employees && data.employees.length > 0) {
      console.log('\n📋 First 2 employees:');
      console.log(JSON.stringify(data.employees.slice(0, 2), null, 2));
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
