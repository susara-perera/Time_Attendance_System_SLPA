const http = require('http');

console.log('Testing HTTP connection to 127.0.0.1:5001...');

const options = {
  hostname: '127.0.0.1',
  port: 5001,
  path: '/test',
  method: 'GET',
  timeout: 5000
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  res.setEncoding('utf8');
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log('RESPONSE:', data);
  });
});

req.on('error', (e) => {
  console.error(`ERROR: ${e.code} - ${e.message}`);
});

req.on('timeout', () => {
  console.error('REQUEST TIMED OUT');
  req.destroy();
});

req.end();
