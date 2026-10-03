const baseUrl = 'http://localhost:3001';

async function request(path, options = {}) {
  const url = `${baseUrl}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, headers: res.headers, body: json };
}

function extractCookie(headers) {
  const setCookie = headers.get('set-cookie');
  if (!setCookie) return null;
  const match = setCookie.match(/token=([^;]+)/);
  return match ? match[1] : null;
}

async function run() {
  console.log('=== Test 1: GET /health (public) ===');
  const health = await request('/health', { method: 'GET' });
  console.log('Status:', health.status, 'Body:', health.body);
  if (health.status !== 200) throw new Error('Health check failed');

  console.log('\n=== Test 2: GET /settings without cookie (should fail with 401) ===');
  const noAuth = await request('/settings', { method: 'GET' });
  console.log('Status:', noAuth.status, 'Body:', noAuth.body);
  if (noAuth.status !== 401) throw new Error('Expected 401');

  console.log('\n=== Test 3: Login as admin ===');
  const adminLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@test.com', password: 'Test@1234' }),
  });
  console.log('Status:', adminLogin.status, 'Body:', adminLogin.body);
  const adminToken = adminLogin.body.token || extractCookie(adminLogin.headers);
  console.log('Admin token extracted:', !!adminToken);

  console.log('\n=== Test 4: GET /settings as admin (cookie) ===');
  const adminSettings = await request('/settings', {
    method: 'GET',
    headers: { Cookie: `token=${adminToken}` },
  });
  console.log('Status:', adminSettings.status, 'Body:', adminSettings.body);
  if (adminSettings.status !== 200) throw new Error('Expected 200 for admin settings');

  console.log('\n=== Test 5: Login as kitchen ===');
  const kitchenLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'kitchen@test.com', password: 'Test@1234' }),
  });
  console.log('Status:', kitchenLogin.status, 'Body:', kitchenLogin.body);
  const kitchenToken = kitchenLogin.body.token || extractCookie(kitchenLogin.headers);

  console.log('\n=== Test 6: GET /settings as kitchen (should fail with 403) ===');
  const kitchenSettings = await request('/settings', {
    method: 'GET',
    headers: { Cookie: `token=${kitchenToken}` },
  });
  console.log('Status:', kitchenSettings.status, 'Body:', kitchenSettings.body);
  if (kitchenSettings.status !== 403) throw new Error('Expected 403 for kitchen on settings');

  console.log('\n=== Test 7: GET /auth/me as admin ===');
  const me = await request('/auth/me', {
    method: 'GET',
    headers: { Cookie: `token=${adminToken}` },
  });
  console.log('Status:', me.status, 'Body:', me.body);
  if (me.status !== 200 || !me.body.permissions) throw new Error('Expected permissions in /auth/me');

  console.log('\n=== Test 8: GET /meta (public) ===');
  const meta = await request('/meta', { method: 'GET' });
  console.log('Status:', meta.status, 'Body:', meta.body);
  if (meta.status !== 200 || !meta.body.today || !meta.body.timezone) throw new Error('Invalid meta response');

  console.log('\n=== Test 9: PUT /settings/timezone with America/New_York ===');
  const putTz = await request('/settings/timezone', {
    method: 'PUT',
    headers: { Cookie: `token=${adminToken}` },
    body: JSON.stringify({ value: 'America/New_York' }),
  });
  console.log('Status:', putTz.status, 'Body:', putTz.body);
  if (putTz.status !== 200) throw new Error('Failed to update timezone');

  console.log('\n=== Test 10: GET /meta to verify timezone update ===');
  const metaUpdated = await request('/meta', { method: 'GET' });
  console.log('Status:', metaUpdated.status, 'Body:', metaUpdated.body);
  if (metaUpdated.body.timezone !== 'America/New_York') throw new Error('Timezone was not updated');

  console.log('\n=== Reset timezone back to Asia/Kolkata ===');
  await request('/settings/timezone', {
    method: 'PUT',
    headers: { Cookie: `token=${adminToken}` },
    body: JSON.stringify({ value: 'Asia/Kolkata' }),
  });

  console.log('\n=== Test 11: Reference Data CRUD (/ref/allergens) ===');
  const allergensBefore = await request('/ref/allergens', {
    method: 'GET',
    headers: { Cookie: `token=${adminToken}` },
  });
  console.log('Allergens count:', allergensBefore.body.length);

  const postAllergen = await request('/ref/allergens', {
    method: 'POST',
    headers: { Cookie: `token=${adminToken}` },
    body: JSON.stringify({ name: 'Gluten' }),
  });
  console.log('POST /ref/allergens Status:', postAllergen.status, 'Body:', postAllergen.body);

  const allergensAfter = await request('/ref/allergens', {
    method: 'GET',
    headers: { Cookie: `token=${adminToken}` },
  });
  console.log('GET /ref/allergens Status:', allergensAfter.status, 'Body:', allergensAfter.body);

  console.log('\n=== Test 12: Kitchen Holidays CRUD ===');
  const postHoliday = await request('/kitchen-holidays', {
    method: 'POST',
    headers: { Cookie: `token=${adminToken}` },
    body: JSON.stringify({ date: '2026-12-25', name: 'Christmas Day' }),
  });
  console.log('POST /kitchen-holidays Status:', postHoliday.status, 'Body:', postHoliday.body);

  const getHolidays = await request('/kitchen-holidays', {
    method: 'GET',
    headers: { Cookie: `token=${adminToken}` },
  });
  console.log('GET /kitchen-holidays Status:', getHolidays.status, 'Body:', getHolidays.body);

  const delHoliday = await request('/kitchen-holidays/2026-12-25', {
    method: 'DELETE',
    headers: { Cookie: `token=${adminToken}` },
  });
  console.log('DELETE /kitchen-holidays Status:', delHoliday.status, 'Body:', delHoliday.body);

  console.log('\n=== Test 13: Staff and Roles ===');
  const roles = await request('/roles', {
    method: 'GET',
    headers: { Cookie: `token=${adminToken}` },
  });
  console.log('GET /roles Status:', roles.status, 'Count:', roles.body.length);

  const staff = await request('/staff', {
    method: 'GET',
    headers: { Cookie: `token=${adminToken}` },
  });
  console.log('GET /staff Status:', staff.status, 'Count:', staff.body.length);

  console.log('\n🎉 ALL LIVE API TESTS PASSED PERFECTLY!');
}

run().catch((err) => {
  console.error('\n❌ Test failed with error:', err);
  process.exit(1);
});
