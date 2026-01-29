// Direct test of warmupCache controller
const cacheController = require('./controllers/cacheController');

(async () => {
  try {
    console.log('🧪 Testing warmupCache controller directly...');

    // Mock request/response objects
    const mockReq = {
      query: {
        startDate: '2025-12-30',
        endDate: '2026-01-29'
      },
      user: { id: 'test-user' }
    };

    const mockRes = {
      status: (code) => ({
        json: (data) => {
          console.log(`Response Status: ${code}`);
          console.log('Response Data:', JSON.stringify(data, null, 2));
          return mockRes;
        }
      })
    };

    // Call the controller directly
    await cacheController.warmupCache(mockReq, mockRes);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
})();