require('dotenv').config();
const {
  getDivisionsFromMySQL,
  getSectionsFromMySQL,
  getEmployeesFromMySQL,
  getTotalCounts
} = require('./services/mysqlDataService');

(async () => {
  try {
    console.log('🧪 Testing MySQL Data Service...\n');

    // Get total counts
    console.log('📊 Getting total counts...');
    const totals = await getTotalCounts();
    console.log(`   ✅ Divisions: ${totals.divisions}`);
    console.log(`   ✅ Sections: ${totals.sections}`);
    console.log(`   ✅ Employees: ${totals.employees}\n`);

    // Get divisions
    console.log('📁 Getting divisions...');
    const divisions = await getDivisionsFromMySQL({ });
    console.log(`   ✅ Found ${divisions.length} divisions`);
    if (divisions.length > 0) {
      console.log(`   📝 Sample: ${divisions[0].HIE_NAME} (${divisions[0].HIE_CODE})\n`);
    }

    // Get sections
    console.log('📂 Getting sections...');
    const sections = await getSectionsFromMySQL({ });
    console.log(`   ✅ Found ${sections.length} sections`);
    if (sections.length > 0) {
      console.log(`   📝 Sample: ${sections[0].HIE_NAME} (${sections[0].HIE_CODE})\n`);
    }

    // Get employees
    console.log('👥 Getting employees (first 10)...');
    const employees = await getEmployeesFromMySQL({ search: '' });
    console.log(`   ✅ Found ${employees.length} employees`);
    if (employees.length > 0) {
      console.log(`   📝 Sample: ${employees[0].EMP_NAME} (${employees[0].EMP_NO})\n`);
    }

    // Test search
    console.log('🔍 Testing search...');
    const searchResults = await getEmployeesFromMySQL({ search: 'a' });
    console.log(`   ✅ Found ${searchResults.length} employees matching 'a'\n`);

    console.log('✅ All tests passed!\n');
    console.log('📊 Summary:');
    console.log(`   • ${totals.divisions} divisions`);
    console.log(`   • ${totals.sections} sections`);
    console.log(`   • ${totals.employees} active employees`);
    console.log('\n💡 You can now use /api/mysql-data endpoints instead of HRIS API');

    process.exit(0);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
})();
