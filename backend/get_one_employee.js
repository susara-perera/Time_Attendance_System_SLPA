const { login, readData } = require('./services/hrisApiService');

async function getOneEmployee() {
  try {
    console.log('🔐 Logging into HRIS API...');
    await login();

    console.log('📊 Fetching one employee record...');
    const employees = await readData('employee', {});

    if (employees && employees.length > 0) {
      console.log('✅ Successfully fetched employee data');
      console.log('📋 First employee record:');
      console.log(JSON.stringify(employees[0], null, 2));
    } else {
      console.log('❌ No employee data received');
    }

  } catch (error) {
    console.error('❌ Error fetching employee data:', error.message);
  }
}

getOneEmployee();