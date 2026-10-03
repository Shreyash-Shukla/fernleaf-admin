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
  console.log('=== Login as admin ===');
  const adminLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@test.com', password: 'Test@1234' }),
  });
  const adminToken = adminLogin.body.token || extractCookie(adminLogin.headers);
  const authHeader = { Cookie: `token=${adminToken}` };
  console.log('Admin login status:', adminLogin.status, 'token present:', !!adminToken);

  const suffix = Date.now().toString().slice(-4);

  // Reference data for allergens and dietary tags
  console.log('\n=== Setup Reference Data ===');
  let allergen = await request('/ref/allergens', {
    method: 'POST',
    headers: authHeader,
    body: JSON.stringify({ name: `Peanuts-${suffix}` }),
  });
  if (allergen.status !== 201) {
    const list = await request('/ref/allergens', { headers: authHeader });
    allergen = { body: list.body[0] };
  }
  console.log('Allergen:', allergen.body.id, allergen.body.name);

  let tag = await request('/ref/dietary-tags', {
    method: 'POST',
    headers: authHeader,
    body: JSON.stringify({ name: `Keto-${suffix}` }),
  });
  if (tag.status !== 201) {
    const list = await request('/ref/dietary-tags', { headers: authHeader });
    tag = { body: list.body[0] };
  }
  console.log('Dietary Tag:', tag.body.id, tag.body.name);

  // Optional price tier
  const tier = await request('/pricing/tiers', {
    method: 'POST',
    headers: authHeader,
    body: JSON.stringify({
      name: `Corporate-${suffix}`,
      isDefault: false,
    }),
  });
  console.log('Created Price Tier for company:', tier.status, tier.body.id);

  console.log('\n=== Step 1: Create Company ===');
  const companyName = `Acme Technologies-${suffix}`;
  const company = await request('/companies', {
    method: 'POST',
    headers: authHeader,
    body: JSON.stringify({
      name: companyName,
      tierId: tier.body.id,
      workingDays: [1, 2, 3, 4, 5],
      defaultDeliveryTimeMin: 720,
      dispatchLeadMinutes: 60,
      defaultPackaging: 'STANDARD',
      driverNotes: 'Ring bell at reception',
      billingName: 'Acme Technologies Ltd',
      billingEmail: `billing.${suffix}@acmetech.com`,
      billingPhone: '+1-555-0199',
      billingAddress: '500 Innovation Way, Suite 400, San Francisco, CA',
    }),
  });
  console.log('Created Company:', company.status, company.body.id, company.body.name);
  if (company.status !== 201) {
    throw new Error(`Failed to create company: ${JSON.stringify(company.body)}`);
  }

  console.log('\n=== Step 2: Company Domains ===');
  const domainName = `acmetech-${suffix}.com`;
  const domain = await request(`/companies/${company.body.id}/domains`, {
    method: 'POST',
    headers: authHeader,
    body: JSON.stringify({ domain: domainName }),
  });
  console.log('Added Domain:', domain.status, domain.body.domain);
  if (domain.status !== 201) {
    throw new Error(`Failed to add domain: ${JSON.stringify(domain.body)}`);
  }

  console.log('\n=== Step 3: Domain Blocklist and Uniqueness Checks ===');
  // 1. Block public domain (gmail.com) -> must be 422
  const publicDomain = await request(`/companies/${company.body.id}/domains`, {
    method: 'POST',
    headers: authHeader,
    body: JSON.stringify({ domain: 'gmail.com' }),
  });
  console.log('Public domain rejection status (should be 422):', publicDomain.status, publicDomain.body?.error?.code);
  if (publicDomain.status !== 422) {
    throw new Error(`Expected status 422 for public domain, got ${publicDomain.status}`);
  }

  // 2. Block taken domain
  const comp2 = await request('/companies', {
    method: 'POST',
    headers: authHeader,
    body: JSON.stringify({
      name: `Other Corp-${suffix}`,
      billingName: 'Other Corp',
      billingEmail: `other.${suffix}@other.com`,
      billingAddress: '100 Other St',
    }),
  });

  const duplicateDomain = await request(`/companies/${comp2.body.id}/domains`, {
    method: 'POST',
    headers: authHeader,
    body: JSON.stringify({ domain: domainName }),
  });
  console.log('Duplicate domain rejection status (should be 409):', duplicateDomain.status, duplicateDomain.body?.error?.code);
  if (duplicateDomain.status !== 409) {
    throw new Error(`Expected status 409 for duplicate domain, got ${duplicateDomain.status}`);
  }

  console.log('\n=== Step 4: Company Addresses (Default handling) ===');
  const hqAddr = await request(`/companies/${company.body.id}/addresses`, {
    method: 'POST',
    headers: authHeader,
    body: JSON.stringify({
      label: 'Headquarters',
      line1: '500 Innovation Way',
      line2: 'Suite 400',
      city: 'San Francisco',
      state: 'CA',
      postcode: '94105',
      isDefault: false, // first address should become default automatically
    }),
  });
  console.log('Added HQ Address:', hqAddr.status, hqAddr.body.id, 'isDefault:', hqAddr.body.isDefault);
  if (!hqAddr.body.isDefault) {
    throw new Error('First address must automatically be default');
  }

  const branchAddr = await request(`/companies/${company.body.id}/addresses`, {
    method: 'POST',
    headers: authHeader,
    body: JSON.stringify({
      label: 'East Bay Annex',
      line1: '200 Broadway',
      city: 'Oakland',
      state: 'CA',
      postcode: '94607',
      isDefault: true, // Should unset HQ default
    }),
  });
  console.log('Added Branch Address (default=true):', branchAddr.status, branchAddr.body.id);

  const getAddrs = await request(`/companies/${company.body.id}/addresses`, {
    method: 'GET',
    headers: authHeader,
  });
  const updatedHq = getAddrs.body.find((a) => a.id === hqAddr.body.id);
  const updatedBranch = getAddrs.body.find((a) => a.id === branchAddr.body.id);
  console.log('HQ isDefault after branch became default:', updatedHq.isDefault);
  console.log('Branch isDefault:', updatedBranch.isDefault);
  if (updatedHq.isDefault !== false || updatedBranch.isDefault !== true) {
    throw new Error('Default address swap failed');
  }

  console.log('\n=== Step 5: Company Calendar & Holidays ===');
  const holiday = await request(`/companies/${company.body.id}/holidays`, {
    method: 'POST',
    headers: authHeader,
    body: JSON.stringify({
      date: '2026-12-25',
      name: 'Winter Holiday',
    }),
  });
  console.log('Added Company Holiday:', holiday.status, holiday.body.date, holiday.body.name);

  const calendar = await request(`/companies/${company.body.id}/calendar`, {
    method: 'GET',
    headers: authHeader,
  });
  console.log('Company Calendar working days:', calendar.body.workingDays, 'holidays count:', calendar.body.holidays.length);

  console.log('\n=== Step 6: Create Employees ===');
  const emp1 = await request('/employees', {
    method: 'POST',
    headers: authHeader,
    body: JSON.stringify({
      companyId: company.body.id,
      name: 'Alice Smith',
      email: `alice.${suffix}@acmetech.com`,
      phone: '+1-555-0101',
      canChooseAddress: true,
      canChangeTime: false,
      canChangePackaging: true,
      allergenIds: [allergen.body.id],
      dietaryTagIds: [tag.body.id],
    }),
  });
  console.log('Created Employee 1 (Alice):', emp1.status, emp1.body.id, emp1.body.name, 'allergens:', emp1.body.allergens?.length);
  if (emp1.status !== 201) {
    throw new Error(`Failed to create employee Alice: ${JSON.stringify(emp1.body)}`);
  }

  const emp2 = await request(`/companies/${company.body.id}/employees`, {
    method: 'POST',
    headers: authHeader,
    body: JSON.stringify({
      name: 'Bob Jones',
      email: `bob.${suffix}@acmetech.com`,
      phone: '+1-555-0102',
      canChooseAddress: false,
      canChangeTime: true,
      canChangePackaging: false,
    }),
  });
  console.log('Created Employee 2 (Bob via nested route):', emp2.status, emp2.body.id, emp2.body.name);

  console.log('\n=== Step 7: Company Owner Validation ===');
  // Try setting owner to an employee of another company
  const otherEmp = await request('/employees', {
    method: 'POST',
    headers: authHeader,
    body: JSON.stringify({
      companyId: comp2.body.id,
      name: 'Other Person',
      email: `other.person.${suffix}@other.com`,
    }),
  });

  const invalidOwner = await request(`/companies/${company.body.id}/owner`, {
    method: 'PUT',
    headers: authHeader,
    body: JSON.stringify({ ownerEmployeeId: otherEmp.body.id }),
  });
  console.log('Invalid owner assignment status (should be 400):', invalidOwner.status, invalidOwner.body?.error?.code);
  if (invalidOwner.status !== 400) {
    throw new Error(`Expected status 400 for invalid owner, got ${invalidOwner.status}`);
  }

  // Set Alice as company owner
  const validOwner = await request(`/companies/${company.body.id}/owner`, {
    method: 'PUT',
    headers: authHeader,
    body: JSON.stringify({ ownerEmployeeId: emp1.body.id }),
  });
  console.log('Valid owner assignment status:', validOwner.status, 'ownerId:', validOwner.body.ownerEmployeeId);
  if (validOwner.status !== 200 || validOwner.body.ownerEmployeeId !== emp1.body.id) {
    throw new Error('Failed to set company owner');
  }

  console.log('\n=== Step 8: Get Full Company Detail ===');
  const fullCompany = await request(`/companies/${company.body.id}`, {
    method: 'GET',
    headers: authHeader,
  });
  console.log('Full Company Details:');
  console.log('- Name:', fullCompany.body.name);
  console.log('- Tier:', fullCompany.body.tier?.name);
  console.log('- Domains:', fullCompany.body.domains?.map((d) => d.domain));
  console.log('- Addresses Count:', fullCompany.body.addresses?.length);
  console.log('- Holidays Count:', fullCompany.body.holidays?.length);
  console.log('- Owner:', fullCompany.body.owner?.name, fullCompany.body.owner?.email);
  console.log('- Employee Count:', fullCompany.body.employeeCount);

  if (!fullCompany.body.owner || fullCompany.body.owner.id !== emp1.body.id) {
    throw new Error('Company owner is missing or mismatch in GET /companies/:id');
  }

  console.log('\n=== Step 9: Employee Move Rules ===');
  // Moving Bob from company to comp2 when Bob has 0 open orders -> allowed
  const moveBob = await request(`/employees/${emp2.body.id}`, {
    method: 'PUT',
    headers: authHeader,
    body: JSON.stringify({ companyId: comp2.body.id }),
  });
  console.log('Move Bob to Comp2 status:', moveBob.status, 'new companyId:', moveBob.body.companyId);
  if (moveBob.status !== 200 || moveBob.body.companyId !== comp2.body.id) {
    throw new Error('Failed to move employee with 0 open orders');
  }

  console.log('\n=== Step 10: CSV Bulk Import ===');
  const csvContent = `name,email,phone,canChooseAddress,canChangeTime,canChangePackaging,allergens,dietaryTags
David Miller,david.${suffix}@acmetech.com,+1-555-0103,true,false,true,${allergen.body.name},${tag.body.name}
Eva Green,eva.${suffix}@acmetech.com,+1-555-0104,false,false,false,,
Bad Row,not-a-valid-email,,,,,,`;

  const importRes = await request(`/companies/${company.body.id}/employees/import`, {
    method: 'POST',
    headers: authHeader,
    body: JSON.stringify({ csvText: csvContent }),
  });
  console.log('CSV Import result:', {
    total: importRes.body.total,
    imported: importRes.body.imported,
    errorCount: importRes.body.errorCount,
    errors: importRes.body.errors,
  });
  if (importRes.body.total !== 3 || importRes.body.imported !== 2 || importRes.body.errorCount !== 1) {
    throw new Error(`CSV bulk import did not process expected rows: ${JSON.stringify(importRes.body)}`);
  }

  console.log('\n=== Step 11: Soft Delete Validation ===');
  const deleteEmp = await request(`/employees/${emp1.body.id}`, {
    method: 'DELETE',
    headers: authHeader,
  });
  console.log('Deleted employee status:', deleteEmp.status, 'active:', deleteEmp.body.active);

  const deleteComp = await request(`/companies/${company.body.id}`, {
    method: 'DELETE',
    headers: authHeader,
  });
  console.log('Deleted company status:', deleteComp.status, 'active:', deleteComp.body.active);

  console.log('\n🎉 ALL LIVE PHASE 4 TESTS PASSED PERFECTLY!');
}

run().catch((err) => {
  console.error('\n❌ Test execution failed:', err);
  process.exit(1);
});
