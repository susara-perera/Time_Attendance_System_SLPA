/**
 * Quick Redis v5 Connection Test
 */

require('dotenv').config();
const redis = require('redis');

async function testRedis() {
  console.log('🔄 Testing Redis v5 connection...\n');
  
  try {
    const client = redis.createClient({
      socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
      },
      password: process.env.REDIS_PASSWORD || undefined
    });

    client.on('error', (err) => console.error('❌ Redis Error:', err.message));

    await client.connect();
    console.log('✅ Redis connected successfully!\n');

    // Test SET
    await client.set('test_key', 'Hello Redis v5!', { EX: 10 });
    console.log('✅ SET test_key = "Hello Redis v5!" (TTL: 10s)');

    // Test GET
    const value = await client.get('test_key');
    console.log('✅ GET test_key =', value);

    // Test DEL
    await client.del('test_key');
    console.log('✅ DEL test_key\n');

    await client.disconnect();
    console.log('✅ Redis v5 is working perfectly!\n');
    console.log('🚀 Your backend will now use:');
    console.log('   1️⃣  Database Indexes (for fast queries)');
    console.log('   2️⃣  Redis Cache (for instant responses)');
    
  } catch (error) {
    console.error('❌ Redis test failed:', error.message);
  }
}

testRedis();
