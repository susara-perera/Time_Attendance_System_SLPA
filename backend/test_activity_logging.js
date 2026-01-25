const http = require('http');

// First, let's try to login to get a token
function loginAndTestActivity() {
  const loginData = JSON.stringify({
    employeeId: 'SP001',
    password: 'susara_perera'
  });

  const loginOptions = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(loginData)
    }
  };

  const loginReq = http.request(loginOptions, (res) => {
    console.log('Login Status:', res.statusCode);

    let loginResponse = '';
    res.on('data', (chunk) => {
      loginResponse += chunk;
    });

    res.on('end', () => {
      try {
        const loginJson = JSON.parse(loginResponse);
        if (loginJson.success && loginJson.token) {
          console.log('✅ Login successful, got token');

          // Now test creating a meal to trigger activity logging
          createTestMeal(loginJson.token);
        } else {
          console.log('❌ Login failed:', loginJson.message);
        }
      } catch (e) {
        console.log('Login response:', loginResponse);
      }
    });
  });

  loginReq.on('error', (e) => {
    console.error('Login error:', e.message);
  });

  loginReq.write(loginData);
  loginReq.end();
}

function createTestMeal(token) {
  const mealData = JSON.stringify({
    name: 'Test Activity Meal',
    description: 'Testing activity logging',
    mealType: 'lunch',
    date: new Date().toISOString().split('T')[0],
    price: 150,
    maxBookings: 50,
    status: 'available'
  });

  const mealOptions = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/meals',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Content-Length': Buffer.byteLength(mealData)
    }
  };

  const mealReq = http.request(mealOptions, (res) => {
    console.log('Create Meal Status:', res.statusCode);

    let mealResponse = '';
    res.on('data', (chunk) => {
      mealResponse += chunk;
    });

    res.on('end', () => {
      try {
        const mealJson = JSON.parse(mealResponse);
        console.log('✅ Meal creation response:', mealJson.message);

        // Now check if activity was logged
        setTimeout(() => checkActivitiesAfterCreation(), 1000);
      } catch (e) {
        console.log('Meal response:', mealResponse);
      }
    });
  });

  mealReq.on('error', (e) => {
    console.error('Meal creation error:', e.message);
  });

  mealReq.write(mealData);
  mealReq.end();
}

function checkActivitiesAfterCreation() {
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/dashboard/activities/recent',
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  const req = http.request(options, (res) => {
    console.log('\n📊 Checking activities after meal creation...');
    console.log(`Status: ${res.statusCode}`);

    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      try {
        const jsonData = JSON.parse(data);
        console.log('Activities count:', jsonData.data ? jsonData.data.length : 0);

        if (jsonData.data && jsonData.data.length > 0) {
          console.log('\n📋 Latest activities:');
          jsonData.data.forEach(activity => {
            console.log(`- ${activity.title}: ${activity.description} (${activity.activity_type})`);
          });
        }
      } catch (e) {
        console.log('Response:', data);
      }
    });
  });

  req.on('error', (e) => {
    console.error(`Error: ${e.message}`);
  });

  req.end();
}

loginAndTestActivity();