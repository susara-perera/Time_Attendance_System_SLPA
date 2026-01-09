(async () => {
  try {
    const base = 'http://localhost:5000/api';
    const loginResp = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@slpa.lk', password: 'test123' })
    });

    const loginJson = await loginResp.json().catch(() => ({}));
    console.log('LOGIN_RESP_STATUS', loginResp.status);
    console.log(JSON.stringify(loginJson, null, 2));

    const token = loginJson?.token;
    if (!token) {
      console.error('No token received. Aborting.');
      process.exit(2);
    }

    const resp = await fetch(`${base}/mysql-subsections?sectionId=333`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
    const j = await resp.json().catch(() => ({}));
    console.log('\nSUBSECTIONS_RESP_STATUS', resp.status);
    console.log(JSON.stringify(j, null, 2));
  } catch (err) {
    console.error('ERROR', err);
    process.exit(1);
  }
})();
