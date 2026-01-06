/**
 * Test Division Management Component API Integration
 * Simulates the fetchDivisions function to verify API integration
 */

const API_BASE_URL = 'http://localhost:5000/api';

async function testDivisionManagementAPI() {
  console.log('🔍 Testing Division Management API Integration...\n');

  // Simulate the fetchDivisions function logic
  const endpoints = [
    `${API_BASE_URL}/mysql-data/divisions`,  // Fast MySQL sync (no auth)
    `${API_BASE_URL}/divisions/hris`         // Legacy HRIS (may require auth)
  ];

  let data = null;
  let successfulUrl = null;

  for (const url of endpoints) {
    console.log(`📡 Testing endpoint: ${url}`);
    try {
      // MySQL endpoint doesn't require auth, HRIS might
      const headers = {
        'Content-Type': 'application/json'
      };

      // For HRIS endpoint, we could add auth if token exists
      // if (url.includes('/hris') && token) {
      //   headers['Authorization'] = `Bearer ${token}`;
      // }

      const response = await fetch(url, {
        headers: headers,
        credentials: 'include'
      });

      if (response.ok) {
        data = await response.json();
        console.log('✅ SUCCESS: Endpoint working!');
        successfulUrl = url;
        console.log(`   Source: ${data.source || (url.includes('/mysql-data') ? 'MySQL Sync' : 'HRIS')}`);
        console.log(`   Count: ${data.count || data.data?.length || 'Unknown'}`);
        break;
      } else {
        const errorText = await response.text();
        console.log(`❌ FAILED: ${response.status} ${response.statusText}`);
        console.log(`   Error: ${errorText}`);
      }
    } catch (err) {
      console.log(`❌ ERROR: ${err.message}`);
    }
    console.log('');
  }

  if (!data || !data.data) {
    console.log('❌ No division data received from any endpoint');
    return;
  }

  // Simulate data normalization (same as component)
  const rows = Array.isArray(data?.data) ? data.data : [];
  const normalized = rows.map((d) => ({
    _id: String(d?._id ?? d?.id ?? d?.DIVISION_ID ?? d?.code ?? d?.hie_code ?? d?.DIVISION_CODE ?? d?.HIE_CODE ?? ''),
    code: String(d?.code ?? d?.DIVISION_CODE ?? d?.hie_code ?? d?.HIE_CODE ?? ''),
    name: d?.name ?? d?.DIVISION_NAME ?? d?.hie_name ?? d?.HIE_NAME ?? d?.hie_relationship ?? 'Unknown Division',
    nameSinhala: d?.HIE_NAME_SINHALA ?? d?.name_sinhala ?? '',
    nameTamil: d?.HIE_NAME_TAMIL ?? d?.name_tamil ?? '',
    isActive: typeof d?.isActive === 'boolean' ? d.isActive : (typeof d?.active === 'boolean' ? d.active : (d?.STATUS === 'ACTIVE')),
    employeeCount: d?.employeeCount ?? d?.count ?? undefined,
    createdAt: d?.createdAt ?? d?.created_at ?? d?.CREATED_AT ?? d?.createdOn ?? d?.CREATED_ON ?? d?.synced_at ?? null,
    source: d?.source ?? (successfulUrl?.includes('/mysql-data') ? 'MySQL Sync' : 'HRIS')
  })).sort((a, b) => a.name.localeCompare(b.name));

  console.log('\n📊 Normalized Division Data:');
  console.log(`Total divisions: ${normalized.length}`);
  console.log('\n📋 Sample Divisions:');

  normalized.slice(0, 5).forEach((div, index) => {
    console.log(`${index + 1}. ${div.code} - ${div.name}`);
    console.log(`   Active: ${div.isActive}`);
    console.log(`   Source: ${div.source}`);
    if (div.nameSinhala) console.log(`   Sinhala: ${div.nameSinhala}`);
    console.log('');
  });

  console.log('✅ Division Management API integration test completed successfully!');
  console.log('🎉 The component should work correctly with these endpoints!');
}

// Run the test
testDivisionManagementAPI().catch(console.error);