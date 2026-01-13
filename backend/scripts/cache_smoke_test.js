const { getCache } = require('../config/reportCache');

(async () => {
  const cache = getCache();
  // Mock redis client
  cache.isEnabled = true;
  cache.isConnected = true;
  cache.client = {
    store: {},
    async get(key) {
      return this.store[key] || null;
    },
    async setEx(key, ttl, val) {
      this.store[key] = val;
      return 'OK';
    },
    async del(key) {
      delete this.store[key];
      return 1;
    }
  };

  console.log('Test 1: generateKey with undefined params');
  try {
    const k = cache.generateKey('group');
    console.log('generateKey ok ->', k);
  } catch (err) {
    console.error('generateKey failed', err.message);
  }

  console.log('Test 2: set with (key, data, ttl) overload');
  await cache.set('cache:test:key', { a: 1 }, 60);
  const v = await cache.get('cache:test:key');
  console.log('get returned (raw):', v);

  console.log('Test 3: set with (type, params, data) overload');
  await cache.set('group', { from_date: '2025-01-01', to_date: '2025-01-02' }, { items: [1,2,3] }, 120);
  const gk = cache.generateKey('group', { from_date: '2025-01-01', to_date: '2025-01-02' });
  const gv = await cache.get(gk);
  console.log('group key:', gk);
  console.log('group get returned (raw):', gv);

  console.log('All smoke tests done. Parse returned strings as needed (JSON.parse)');
})();