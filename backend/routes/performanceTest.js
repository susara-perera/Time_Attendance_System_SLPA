const express = require('express');
const router = express.Router();
const axios = require('axios');

// Internal performance testing endpoint (runs from same process as server)
router.get('/internal-test', async (req, res) => {
  const results = {
    timestamp: new Date().toISOString(),
    tests: []
  };
  
  try {
    // Test 1: Health endpoint
    console.log('Testing health endpoint...');
    const healthStart = Date.now();
    const healthResponse = await axios.get('http://localhost:5000/health');
    const healthTime = Date.now() - healthStart;
    results.tests.push({
      name: 'Health Check',
      status: 'SUCCESS',
      time: healthTime,
      data: healthResponse.data
    });
    
    // Test 2: Login
    console.log('Testing login...');
    const loginStart = Date.now();
    const loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'admin@slpa.lk',
      password: 'admin123'
    });
    const loginTime = Date.now() - loginStart;
    const token = loginResponse.data.token;
    
    results.tests.push({
      name: 'Login',
      status: 'SUCCESS',
      time: loginTime,
      user: loginResponse.data.user?.name
    });
    
    // Test 3: Dashboard (cache miss)
    console.log('Testing dashboard...');
    const dashStart = Date.now();
    const dashResponse = await axios.get('http://localhost:5000/api/dashboard/stats', {
      headers: { 'x-auth-token': token }
    });
    const dashTime = Date.now() - dashStart;
    
    results.tests.push({
      name: 'Dashboard (first load)',
      status: 'SUCCESS',
      time: dashTime,
      employeeCount: dashResponse.data?.totalEmployees
    });
    
    // Test 4: Dashboard (cache hit)
    const dashStart2 = Date.now();
    await axios.get('http://localhost:5000/api/dashboard/stats', {
      headers: { 'x-auth-token': token }
    });
    const dashTime2 = Date.now() - dashStart2;
    
    results.tests.push({
      name: 'Dashboard (cached)',
      status: 'SUCCESS',
      time: dashTime2,
      improvement: `${((1 - dashTime2/dashTime) * 100).toFixed(1)}% faster`
    });
    
    // Test 5: Employees list
    console.log('Testing employees...');
    const empStart = Date.now();
    const empResponse = await axios.get('http://localhost:5000/api/employees', {
      headers: { 'x-auth-token': token }
    });
    const empTime = Date.now() - empStart;
    
    results.tests.push({
      name: 'Employees List',
      status: 'SUCCESS',
      time: empTime,
      count: empResponse.data?.length || empResponse.data?.employees?.length
    });
    
    // Test 6: Divisions
    console.log('Testing divisions...');
    const divStart = Date.now();
    await axios.get('http://localhost:5000/api/divisions', {
      headers: { 'x-auth-token': token }
    });
    const divTime = Date.now() - divStart;
    
    results.tests.push({
      name: 'Divisions List',
      status: 'SUCCESS',
      time: divTime
    });
    
    // Test 7: Sections
    console.log('Testing sections...');
    const secStart = Date.now();
    await axios.get('http://localhost:5000/api/sections', {
      headers: { 'x-auth-token': token }
    });
    const secTime = Date.now() - secStart;
    
    results.tests.push({
      name: 'Sections List',
      status: 'SUCCESS',
      time: secTime
    });
    
    console.log('All tests completed successfully!');
    res.json({
      success: true,
      results,
      summary: {
        totalTests: results.tests.length,
        allPassed: true,
        averageTime: (results.tests.reduce((sum, t) => sum + t.time, 0) / results.tests.length).toFixed(2)
      }
    });
    
  } catch (error) {
    console.error('Test failed:', error.message);
    results.tests.push({
      name: 'Error',
      status: 'FAILED',
      error: error.message
    });
    
    res.json({
      success: false,
      results,
      error: error.message
    });
  }
});

module.exports = router;
