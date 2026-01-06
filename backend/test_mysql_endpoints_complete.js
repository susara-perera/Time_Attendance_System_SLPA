/**
 * Comprehensive MySQL Endpoints Test
 * Tests all MySQL sync table endpoints and filtering capabilities
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';
let authToken = '';

// Color output for better readability
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(80));
  log(title, 'cyan');
  console.log('='.repeat(80));
}

function logTest(testName) {
  log(`\n▶ Testing: ${testName}`, 'yellow');
}

function logSuccess(message) {
  log(`  ✓ ${message}`, 'green');
}

function logError(message) {
  log(`  ✗ ${message}`, 'red');
}

function logInfo(message) {
  log(`  ℹ ${message}`, 'blue');
}

// Login and get token
async function login() {
  try {
    logSection('AUTHENTICATION');
    logTest('Logging in to get auth token');
    
    // Try different credentials
    const credentials = [
      { email: 'test@slpa.lk', password: 'test123' },
      { email: 'admin@slpa.lk', password: 'admin123' },
      { email: 'susaraperera33@gmail.com', password: 'susara_perera' }
    ];
    
    for (const cred of credentials) {
      try {
        const response = await axios.post(`${BASE_URL}/auth/login`, cred);
        
        if (response.data.success && response.data.token) {
          authToken = response.data.token;
          logSuccess(`Logged in successfully with ${cred.email}`);
          logInfo(`Token: ${authToken.substring(0, 20)}...`);
          return true;
        }
      } catch (err) {
        // Try next credential
        continue;
      }
    }
    
    logError('Login failed with all credentials');
    logInfo('Proceeding with endpoint structure tests (without auth)');
    return false;
  } catch (error) {
    logError(`Login error: ${error.message}`);
    logInfo('Proceeding with endpoint structure tests (without auth)');
    return false;
  }
}

// Test MySQL Data endpoints (divisions_sync, sections_sync, employees_sync)
async function testMySQLDataEndpoints() {
  logSection('MYSQL DATA ENDPOINTS (/api/mysql-data)');
  
  const headers = { Authorization: `Bearer ${authToken}` };
  
  // Test 1: Get all divisions from divisions_sync
  try {
    logTest('GET /api/mysql-data/divisions');
    const response = await axios.get(`${BASE_URL}/mysql-data/divisions`, { headers });
    
    if (response.data.success) {
      logSuccess(`Fetched ${response.data.count} divisions`);
      logInfo(`Source: ${response.data.source}`);
      
      if (response.data.data && response.data.data.length > 0) {
        const sample = response.data.data[0];
        logInfo(`Sample: ${sample.HIE_CODE} - ${sample.HIE_NAME}`);
        
        // Store first division code for later tests
        global.testDivisionCode = sample.HIE_CODE;
      }
    }
  } catch (error) {
    logError(`Divisions fetch failed: ${error.response?.data?.message || error.message}`);
  }
  
  // Test 2: Get single division by code
  if (global.testDivisionCode) {
    try {
      logTest(`GET /api/mysql-data/divisions/${global.testDivisionCode}`);
      const response = await axios.get(`${BASE_URL}/mysql-data/divisions/${global.testDivisionCode}`, { headers });
      
      if (response.data.success) {
        logSuccess(`Fetched division: ${response.data.data.HIE_NAME}`);
      }
    } catch (error) {
      logError(`Single division fetch failed: ${error.response?.data?.message || error.message}`);
    }
  }
  
  // Test 3: Get all sections from sections_sync
  try {
    logTest('GET /api/mysql-data/sections');
    const response = await axios.get(`${BASE_URL}/mysql-data/sections`, { headers });
    
    if (response.data.success) {
      logSuccess(`Fetched ${response.data.count} sections`);
      
      if (response.data.data && response.data.data.length > 0) {
        const sample = response.data.data[0];
        logInfo(`Sample: ${sample.HIE_CODE} - ${sample.HIE_NAME}`);
        
        // Store first section code for later tests
        global.testSectionCode = sample.HIE_CODE;
      }
    }
  } catch (error) {
    logError(`Sections fetch failed: ${error.response?.data?.message || error.message}`);
  }
  
  // Test 4: Get sections filtered by division
  if (global.testDivisionCode) {
    try {
      logTest(`GET /api/mysql-data/sections?divisionCode=${global.testDivisionCode}`);
      const response = await axios.get(`${BASE_URL}/mysql-data/sections?divisionCode=${global.testDivisionCode}`, { headers });
      
      if (response.data.success) {
        logSuccess(`Fetched ${response.data.count} sections for division ${global.testDivisionCode}`);
        
        if (response.data.data && response.data.data.length > 0) {
          response.data.data.slice(0, 3).forEach(sec => {
            logInfo(`  - ${sec.HIE_CODE}: ${sec.HIE_NAME}`);
          });
        }
      }
    } catch (error) {
      logError(`Sections by division failed: ${error.response?.data?.message || error.message}`);
    }
  }
  
  // Test 5: Get all employees from employees_sync
  try {
    logTest('GET /api/mysql-data/employees');
    const response = await axios.get(`${BASE_URL}/mysql-data/employees`, { headers });
    
    if (response.data.success) {
      logSuccess(`Fetched ${response.data.count} employees`);
      
      if (response.data.data && response.data.data.length > 0) {
        const sample = response.data.data[0];
        logInfo(`Sample: ${sample.EMP_NO} - ${sample.EMP_NAME}`);
        
        global.testEmpNo = sample.EMP_NO;
      }
    }
  } catch (error) {
    logError(`Employees fetch failed: ${error.response?.data?.message || error.message}`);
  }
  
  // Test 6: Get employees filtered by division
  if (global.testDivisionCode) {
    try {
      logTest(`GET /api/mysql-data/employees?divisionCode=${global.testDivisionCode}`);
      const response = await axios.get(`${BASE_URL}/mysql-data/employees?divisionCode=${global.testDivisionCode}`, { headers });
      
      if (response.data.success) {
        logSuccess(`Fetched ${response.data.count} employees for division ${global.testDivisionCode}`);
        
        if (response.data.data && response.data.data.length > 0) {
          response.data.data.slice(0, 3).forEach(emp => {
            logInfo(`  - ${emp.EMP_NO}: ${emp.EMP_NAME} (${emp.DIV_NAME})`);
          });
        }
      }
    } catch (error) {
      logError(`Employees by division failed: ${error.response?.data?.message || error.message}`);
    }
  }
  
  // Test 7: Get employees filtered by section
  if (global.testSectionCode) {
    try {
      logTest(`GET /api/mysql-data/employees?sectionCode=${global.testSectionCode}`);
      const response = await axios.get(`${BASE_URL}/mysql-data/employees?sectionCode=${global.testSectionCode}`, { headers });
      
      if (response.data.success) {
        logSuccess(`Fetched ${response.data.count} employees for section ${global.testSectionCode}`);
        
        if (response.data.data && response.data.data.length > 0) {
          response.data.data.slice(0, 3).forEach(emp => {
            logInfo(`  - ${emp.EMP_NO}: ${emp.EMP_NAME} (${emp.SEC_NAME})`);
          });
        }
      }
    } catch (error) {
      logError(`Employees by section failed: ${error.response?.data?.message || error.message}`);
    }
  }
  
  // Test 8: Get single employee by number
  if (global.testEmpNo) {
    try {
      logTest(`GET /api/mysql-data/employees/${global.testEmpNo}`);
      const response = await axios.get(`${BASE_URL}/mysql-data/employees/${global.testEmpNo}`, { headers });
      
      if (response.data.success) {
        logSuccess(`Fetched employee: ${response.data.data.EMP_NAME}`);
        logInfo(`Division: ${response.data.data.DIV_NAME}`);
        logInfo(`Section: ${response.data.data.SEC_NAME}`);
      }
    } catch (error) {
      logError(`Single employee fetch failed: ${error.response?.data?.message || error.message}`);
    }
  }
}

// Test MySQL endpoints (legacy divisions/sections tables)
async function testMySQLEndpoints() {
  logSection('MYSQL ENDPOINTS (/api/mysql) - Legacy Tables');
  
  const headers = { Authorization: `Bearer ${authToken}` };
  
  // Test 1: Get all divisions from divisions table
  try {
    logTest('GET /api/mysql/divisions');
    const response = await axios.get(`${BASE_URL}/mysql/divisions`, { headers });
    
    if (response.data.success) {
      logSuccess(`Fetched ${response.data.divisions.length} divisions from legacy table`);
      
      if (response.data.divisions && response.data.divisions.length > 0) {
        const sample = response.data.divisions[0];
        logInfo(`Sample: ${sample.division_id} - ${sample.division_name}`);
      }
    }
  } catch (error) {
    logError(`Legacy divisions fetch failed: ${error.response?.data?.message || error.message}`);
  }
  
  // Test 2: Get all sections from sections table
  try {
    logTest('GET /api/mysql/sections');
    const response = await axios.get(`${BASE_URL}/mysql/sections`, { headers });
    
    if (response.data.success) {
      logSuccess(`Fetched ${response.data.sections.length} sections from legacy table`);
    }
  } catch (error) {
    logError(`Legacy sections fetch failed: ${error.response?.data?.message || error.message}`);
  }
  
  // Test 3: Get sections filtered by division
  try {
    logTest('GET /api/mysql/sections?division_id=1');
    const response = await axios.get(`${BASE_URL}/mysql/sections?division_id=1`, { headers });
    
    if (response.data.success) {
      logSuccess(`Fetched ${response.data.sections.length} sections for division_id=1`);
    }
  } catch (error) {
    logError(`Legacy sections by division failed: ${error.response?.data?.message || error.message}`);
  }
}

// Test MySQL Sub-sections endpoints
async function testSubSectionEndpoints() {
  logSection('MYSQL SUB-SECTIONS ENDPOINTS (/api/mysql-subsections)');
  
  const headers = { Authorization: `Bearer ${authToken}` };
  
  // Test 1: Get all sub-sections
  try {
    logTest('GET /api/mysql-subsections');
    const response = await axios.get(`${BASE_URL}/mysql-subsections`, { headers });
    
    if (response.data.success) {
      logSuccess(`Fetched ${response.data.data.length} sub-sections`);
      
      if (response.data.data && response.data.data.length > 0) {
        const sample = response.data.data[0];
        logInfo(`Sample: ${sample.subSection.sub_hie_code} - ${sample.subSection.sub_hie_name}`);
        logInfo(`  Parent Section: ${sample.parentSection.hie_name}`);
        
        // Store section ID for filtered test
        global.testSectionId = sample.parentSection.id;
      }
    }
  } catch (error) {
    logError(`Sub-sections fetch failed: ${error.response?.data?.message || error.message}`);
  }
  
  // Test 2: Get sub-sections filtered by section
  if (global.testSectionId) {
    try {
      logTest(`GET /api/mysql-subsections?sectionId=${global.testSectionId}`);
      const response = await axios.get(`${BASE_URL}/mysql-subsections?sectionId=${global.testSectionId}`, { headers });
      
      if (response.data.success) {
        logSuccess(`Fetched ${response.data.data.length} sub-sections for section ${global.testSectionId}`);
        
        if (response.data.data && response.data.data.length > 0) {
          response.data.data.forEach(sub => {
            logInfo(`  - ${sub.subSection.sub_hie_code}: ${sub.subSection.sub_hie_name}`);
          });
        }
      }
    } catch (error) {
      logError(`Sub-sections by section failed: ${error.response?.data?.message || error.message}`);
    }
  }
}

// Test employee filtering by sub-section
async function testEmployeesBySubSection() {
  logSection('EMPLOYEES BY SUB-SECTION');
  
  const headers = { Authorization: `Bearer ${authToken}` };
  
  logInfo('Note: Sub-section filtering for employees requires custom implementation');
  logInfo('Current implementation filters by: divisionCode, sectionCode');
  logInfo('Sub-section filtering would require adding sub_section_code to employees_sync table');
  
  // This is a conceptual test - would need implementation
  logTest('GET /api/mysql-data/employees?subSectionCode=XXX (Not implemented yet)');
  logInfo('This endpoint needs to be implemented with sub_section filtering');
}

// Summary of API endpoints
function printEndpointSummary() {
  logSection('API ENDPOINTS SUMMARY');
  
  console.log('\n📋 Available Endpoints:\n');
  
  log('1. MySQL Data Endpoints (from sync tables):', 'cyan');
  console.log('   GET  /api/mysql-data/divisions');
  console.log('   GET  /api/mysql-data/divisions/:code');
  console.log('   GET  /api/mysql-data/sections?divisionCode=XXX');
  console.log('   GET  /api/mysql-data/sections/:code');
  console.log('   GET  /api/mysql-data/employees?divisionCode=XXX');
  console.log('   GET  /api/mysql-data/employees?sectionCode=XXX');
  console.log('   GET  /api/mysql-data/employees/:empNo');
  
  log('\n2. MySQL Endpoints (legacy tables):', 'cyan');
  console.log('   GET  /api/mysql/divisions');
  console.log('   GET  /api/mysql/sections?division_id=N');
  
  log('\n3. Sub-sections Endpoints:', 'cyan');
  console.log('   GET  /api/mysql-subsections');
  console.log('   GET  /api/mysql-subsections?sectionId=N');
  console.log('   POST /api/mysql-subsections');
  console.log('   PUT  /api/mysql-subsections/:id');
  console.log('   DELETE /api/mysql-subsections/:id');
  
  log('\n4. Filtering Capabilities:', 'yellow');
  console.log('   ✓ Sections by Division (divisionCode)');
  console.log('   ✓ Employees by Division (divisionCode)');
  console.log('   ✓ Employees by Section (sectionCode)');
  console.log('   ✓ Sub-sections by Section (sectionId)');
  console.log('   ✗ Employees by Sub-section (needs implementation)');
}

// Main test runner
async function runAllTests() {
  try {
    console.log('\n');
    log('╔═══════════════════════════════════════════════════════════════════════════════╗', 'cyan');
    log('║           MySQL Endpoints Comprehensive Test Suite                           ║', 'cyan');
    log('╚═══════════════════════════════════════════════════════════════════════════════╝', 'cyan');
    
    // Login first
    const loginSuccess = await login();
    if (!loginSuccess) {
      logInfo('Continuing with tests anyway to check endpoint structure...');
    }
    
    // Run all tests
    await testMySQLDataEndpoints();
    await testMySQLEndpoints();
    await testSubSectionEndpoints();
    await testEmployeesBySubSection();
    
    // Print summary
    printEndpointSummary();
    
    logSection('TEST COMPLETE');
    logSuccess('All tests completed!');
    
  } catch (error) {
    logError(`Test suite error: ${error.message}`);
    console.error(error);
  }
}

// Run the tests
runAllTests();
