(async () => {
  try {
    const base = 'http://localhost:5000/api';
    const loginResp = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@slpa.lk', password: 'test123' })
    });

    const loginJson = await loginResp.json().catch(() => ({}));
    console.log('LOGIN STATUS:', loginResp.status);

    const token = loginJson?.token;
    if (!token) {
      console.error('No token received');
      return;
    }
    console.log('Got token:', token.substring(0, 20) + '...');

    // Test the warmup endpoint
    const warmupResp = await fetch(`${base}/cache/warmup?startDate=2025-12-30&endDate=2026-01-29`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const warmupJson = await warmupResp.json().catch(() => ({}));
    console.log('WARMUP STATUS:', warmupResp.status);
    console.log('WARMUP RESPONSE:', JSON.stringify(warmupJson, null, 2));

  } catch (err) {
    console.error('ERROR:', err.message);
  }
})();