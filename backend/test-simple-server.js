const express = require('express');
const axios = require('axios');
const app = express();

app.get('/test', (req, res) => {
  console.log('Received request!');
  res.json({ message: 'Test server works!' });
});

const server = app.listen(5001, '127.0.0.1', async () => {
  console.log('Test server listening on port 5001');
  const address = server.address();
  console.log('Server address:', address);
  
  // Test from same process
  setTimeout(async () => {
    console.log('\n=== Testing from same Node.js process ===');
    try {
      const response = await axios.get('http://127.0.0.1:5001/test', { timeout: 3000 });
      console.log('✅ SUCCESS:', response.data);
    } catch (err) {
      console.log('❌ ERROR:', err.code, err.message);
    }
  }, 2000);
});

server.on('error', (err) => {
  console.error('Server error:', err);
});

setTimeout(() => {
  console.log('Server still running after 5 seconds...');
}, 5000);
