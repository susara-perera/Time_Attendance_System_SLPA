const http = require('http');

function testRecentActivitiesAPI() {
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
    console.log(`Status: ${res.statusCode}`);
    console.log(`Headers:`, res.headers);

    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      try {
        const jsonData = JSON.parse(data);
        console.log('✅ API Response:');
        console.log('Success:', jsonData.success);
        console.log('Message:', jsonData.message);
        console.log('Activities count:', jsonData.data ? jsonData.data.length : 0);

        if (jsonData.data && jsonData.data.length > 0) {
          console.log('\n📋 Recent activities:');
          jsonData.data.slice(0, 3).forEach(activity => {
            console.log(`- ${activity.title}: ${activity.description} (${activity.activity_type})`);
          });
        }
      } catch (e) {
        console.log('Raw response:', data);
      }
    });
  });

  req.on('error', (e) => {
    console.error(`❌ API Error: ${e.message}`);
  });

  req.end();
}

testRecentActivitiesAPI();