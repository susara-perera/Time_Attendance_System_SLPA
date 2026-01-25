require('dotenv').config();
const { getDashboardCacheRow, safeJsonParse } = require('./controllers/dashboardController');

// Mock the unexported functions
const { sequelize } = require('./config/mysql');

const safeJsonParseLocal = (str, fallback) => {
  if (!str) return fallback;
  if (typeof str === 'object') return str;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
};

const getDashboardCacheRowLocal = async () => {
  const [results] = await sequelize.query(`
    SELECT 
      is_division_attendance,
      present_IS,
      absent_IS,
      last_updated
    FROM total_count_dashboard
    WHERE id = 1
    LIMIT 1
  `);
  return results[0] || null;
};

(async () => {
  try {
    console.log('🔍 Testing IS Division Attendance endpoint logic...\n');
    
    await sequelize.authenticate();
    const row = await getDashboardCacheRowLocal();

    // Try to use is_division_attendance if it has valid employees array
    const cachedObj = safeJsonParseLocal(row?.is_division_attendance, null);
    console.log('is_division_attendance parsed:', cachedObj ? 'exists' : 'null');
    console.log('  has employees array:', Array.isArray(cachedObj?.employees));
    console.log('  employees length:', cachedObj?.employees?.length || 0);
    
    if (cachedObj && typeof cachedObj === 'object' && Array.isArray(cachedObj.employees) && cachedObj.employees.length > 0) {
      console.log('\n✅ Would return is_division_attendance data');
      console.log('Sample:', JSON.stringify(cachedObj.employees[0], null, 2));
    } else {
      console.log('\n⚠️ is_division_attendance empty, using fallback...\n');
      
      // Fallback: combine present_IS and absent_IS
      const present = safeJsonParseLocal(row?.present_IS, []);
      const absent = safeJsonParseLocal(row?.absent_IS, []);
      
      console.log(`Present employees: ${present.length}`);
      console.log(`Absent employees: ${absent.length}`);
      
      const presentList = Array.isArray(present)
        ? present.map(e => ({
            employee_id: e.employee_id || e.empNo || e.EMP_NO || null,
            employee_name: e.employee_name || e.empName || e.EMP_NAME || null,
            division_code: e.division_code || e.divCode || e.DIV_CODE || null,
            division_name: e.division_name || e.divName || e.DIV_NAME || null,
            section_code: e.section_code || e.secCode || e.SEC_CODE || null,
            section_name: e.section_name || e.secName || e.SEC_NAME || null,
            is_present: true
          }))
        : [];

      const absentList = Array.isArray(absent)
        ? absent.map(e => ({
            employee_id: e.employee_id || e.empNo || e.EMP_NO || null,
            employee_name: e.employee_name || e.empName || e.EMP_NAME || null,
            division_code: e.division_code || e.divCode || e.DIV_CODE || null,
            division_name: e.division_name || e.divName || e.DIV_NAME || null,
            section_code: e.section_code || e.secCode || e.SEC_CODE || null,
            section_name: e.section_name || e.secName || e.SEC_NAME || null,
            is_present: false
          }))
        : [];

      const employees = [...presentList, ...absentList].filter(e => e.employee_id);
      
      console.log(`\n✅ Fallback combined: ${employees.length} total employees`);
      console.log('\nSample present employee:');
      console.log(JSON.stringify(presentList[0], null, 2));
      console.log('\nSample absent employee:');
      console.log(JSON.stringify(absentList[0], null, 2));
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
