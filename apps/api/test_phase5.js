/**
 * Phase 5 Test Script — Orders + Cut-off
 * 
 * Run: node test_phase5.js
 */

const BASE = process.env.API_URL || 'http://localhost:3001';

async function api(method, path, body, cookie) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, cookie: res.headers.get('set-cookie') };
}

function assert(cond, msg) {
  if (!cond) {
    console.error(`❌ FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ ${msg}`);
}

function getFutureDeliveryDate() {
  const d = new Date();
  d.setDate(d.getDate() + 5);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

async function main() {
  console.log('\n🚀 Phase 5 Test: Orders + Cut-off\n');
  const deliveryDate = getFutureDeliveryDate();
  console.log(`📅 Using delivery date: ${deliveryDate}\n`);

  // ─── Login as admin ──────────────────────────────────────────
  const login = await api('POST', '/auth/login', {
    email: 'admin@test.com',
    password: 'Test@1234',
  });
  assert(login.status === 200 || login.status === 201, 'Admin login');
  const cookie = login.cookie;
  assert(cookie, 'Got auth cookie');

  // ─── Setup: Reference data ──────────────────────────────────
  console.log('\n--- Setup Reference Data ---');
  
  let allergenId, tagId, stationId;
  const allergens = await api('GET', '/ref/allergens', null, cookie);
  if (allergens.data?.length > 0) {
    allergenId = allergens.data[0].id;
  } else {
    const a = await api('POST', '/ref/allergens', { name: 'Gluten-P5' }, cookie);
    allergenId = a.data?.id;
  }
  
  const tags = await api('GET', '/ref/dietary-tags', null, cookie);
  if (tags.data?.length > 0) {
    tagId = tags.data[0].id;
  } else {
    const t = await api('POST', '/ref/dietary-tags', { name: 'Vegan-P5' }, cookie);
    tagId = t.data?.id;
  }
  
  const stations = await api('GET', '/ref/stations', null, cookie);
  if (stations.data?.length > 0) {
    stationId = stations.data[0].id;
  } else {
    const s = await api('POST', '/ref/stations', { name: 'Grill-P5', sortOrder: 1 }, cookie);
    stationId = s.data?.id;
  }
  console.log('✅ Reference data ready');

  // ─── Setup: Dish ────────────────────────────────────────────
  console.log('\n--- Setup Catalogue ---');
  const sku = 'P5-BOWL-' + Date.now().toString().slice(-6);
  const dishRes = await api('POST', '/dishes', {
    name: 'Phase5 Test Bowl',
    sku,
    description: 'A test bowl for orders',
    temperature: 'HOT',
    costCents: 200,
    stationId,
    minOrderQty: 1,
    allergenIds: allergenId ? [allergenId] : [],
    dietaryTagIds: tagId ? [tagId] : [],
  }, cookie);
  assert(dishRes.status === 201 || dishRes.status === 200, `Dish created (${dishRes.status})`);
  const dishId = dishRes.data?.id;
  assert(dishId, `Dish ID: ${dishId}`);

  // Create an option
  const optRes = await api('POST', '/options', {
    name: 'Paneer-P5-' + Date.now().toString().slice(-6),
    costCents: 50,
  }, cookie);
  assert(optRes.status === 201 || optRes.status === 200, 'Option created');
  const optionId = optRes.data?.id;

  // Create option group with option (using correct DTO format)
  const groupRes = await api('POST', `/dishes/${dishId}/groups`, {
    name: 'Protein',
    required: true,
    sortOrder: 0,
    usesPortions: false,
    options: [{ optionId, sortOrder: 0 }],
  }, cookie);
  assert(groupRes.status === 201 || groupRes.status === 200, `Option group created (${groupRes.status})`);
  const groupId = groupRes.data?.id;
  assert(groupId, `Group ID: ${groupId}`);

  // ─── Setup: Price Tier + Prices ─────────────────────────────
  console.log('\n--- Setup Pricing ---');
  let tierId;
  const tiersRes = await api('GET', '/pricing/tiers', null, cookie);
  const defaultTier = tiersRes.data?.find(t => t.isDefault);
  if (defaultTier) {
    tierId = defaultTier.id;
    console.log(`  Using existing default tier: ${tierId}`);
  } else {
    const tierRes = await api('POST', '/pricing/tiers', {
      name: 'Standard-P5',
      isDefault: true,
      derivation: 'NONE',
    }, cookie);
    tierId = tierRes.data?.id;
  }
  assert(tierId, 'Have tier ID');

  // Set dish price
  const dpRes = await api('PUT', `/pricing/tiers/${tierId}/grid`, [
    { id: dishId, priceCents: 500 },
  ], cookie);
  console.log(`  Dish price set: ${dpRes.status}`);

  // Set option price
  const opRes = await api('PUT', `/pricing/tiers/${tierId}/grid?kind=option`, [
    { id: optionId, priceCents: 100 },
  ], cookie);
  console.log(`  Option price set: ${opRes.status}`);

  // ─── Setup: Menu Category + Item ────────────────────────────
  console.log('\n--- Setup Menu ---');
  const catSlug = 'bowls-p5-' + Date.now().toString().slice(-6);
  const catRes = await api('POST', '/menu-categories', {
    name: 'Bowls P5',
    slug: catSlug,
    sortOrder: 0,
  }, cookie);
  assert(catRes.status === 201 || catRes.status === 200, `Category created (${catRes.status})`);
  const categoryId = catRes.data?.id;
  assert(categoryId, `Category ID: ${categoryId}`);

  // Add dish to category
  const miRes = await api('POST', `/menu-categories/${categoryId}/items`, {
    dishId,
    sortOrder: 0,
  }, cookie);
  assert(miRes.status === 201 || miRes.status === 200, `Menu item added (${miRes.status})`);

  // ─── Setup: Company + Employee ──────────────────────────────
  console.log('\n--- Setup Company + Employee ---');
  const compName = 'OrderTestCorp-' + Date.now().toString().slice(-6);
  const compRes = await api('POST', '/companies', {
    name: compName,
    billingName: 'OTC Billing',
    billingEmail: 'billing@otc.com',
    billingAddress: '123 Test St',
    workingDays: [1, 2, 3, 4, 5],
    defaultDeliveryTimeMin: 720,
    dispatchLeadMinutes: 60,
    tierId,
  }, cookie);
  assert(compRes.status === 201 || compRes.status === 200, `Company created (${compRes.status})`);
  const companyId = compRes.data?.id;
  assert(companyId, `Company ID: ${companyId}`);

  // Add address
  const addrRes = await api('POST', `/companies/${companyId}/addresses`, {
    label: 'HQ',
    line1: '123 Main St',
    city: 'Mumbai',
    postcode: '400001',
    isDefault: true,
  }, cookie);
  assert(addrRes.status === 201 || addrRes.status === 200, 'Address created');
  const addressId = addrRes.data?.id;
  assert(addressId, `Address ID: ${addressId}`);

  // Create employee
  const empEmail = `p5emp${Date.now()}@otc.com`;
  const empRes = await api('POST', '/employees', {
    companyId,
    name: 'Test Employee P5',
    email: empEmail,
    canChooseAddress: true,
    canChangeTime: true,
    canChangePackaging: true,
  }, cookie);
  assert(empRes.status === 201 || empRes.status === 200, 'Employee created');
  const employeeId = empRes.data?.id;
  assert(employeeId, `Employee ID: ${employeeId}`);

  // ─── Verify: Menu Preview ──────────────────────────────────
  console.log('\n--- Menu Preview ---');
  const preview = await api('GET', `/menu/preview?employeeId=${employeeId}`, null, cookie);
  assert(preview.status === 200, 'Menu preview returns 200');
  console.log(`  Categories: ${preview.data.categories?.length}`);
  
  const menuDish = preview.data.categories?.flatMap(c => c.items)?.find(i => i.dish.id === dishId);
  assert(menuDish, 'Test dish visible in menu preview');
  console.log(`  Dish price: ${menuDish?.dish?.priceCents} cents`);

  const menuGroups = menuDish?.optionGroups || [];
  const firstGroup = menuGroups[0];
  const firstOption = firstGroup?.options?.[0];
  assert(firstGroup, `Group found: ${firstGroup?.name}`);
  assert(firstOption, `Option found: ${firstOption?.name}, price=${firstOption?.priceCents}`);

  // ─── Test 1: Order Preview ──────────────────────────────────
  console.log('\n--- Test 1: Order Preview ---');
  const orderBody = {
    employeeId,
    deliveryDate,
    deliveryTimeMin: 720,
    addressId,
    packaging: 'STANDARD',
    notes: 'Test order',
    lines: [
      {
        dishId,
        quantity: 2,
        combinations: [
          {
            quantity: 2,
            selections: [
              {
                groupId: firstGroup.id,
                optionId: firstOption.id,
              },
            ],
          },
        ],
      },
    ],
  };
  
  const prevRes = await api('POST', '/orders/preview', orderBody, cookie);
  assert(prevRes.status === 200 || prevRes.status === 201, `Preview: status ${prevRes.status}`);
  console.log(`  Valid: ${prevRes.data?.valid}`);
  console.log(`  Total: ${prevRes.data?.totalCents} cents`);
  console.log(`  Lines: ${prevRes.data?.lines?.length}`);
  console.log(`  Errors: ${JSON.stringify(prevRes.data?.errors || [])}`);
  // Price should be (500 dish + 100 option) * 2 = 1200
  assert(prevRes.data?.totalCents === 1200, `Total is 1200 cents (got ${prevRes.data?.totalCents})`);

  // ─── Test 2: Create Draft ───────────────────────────────────
  console.log('\n--- Test 2: Create Draft ---');
  const draftRes = await api('POST', '/orders', orderBody, cookie);
  assert(draftRes.status === 200 || draftRes.status === 201, `Draft created: ${draftRes.status}`);
  const orderId = draftRes.data?.id;
  assert(orderId, `Draft order ID: ${orderId}`);
  console.log(`  Number: #${draftRes.data?.number}`);
  console.log(`  Status: ${draftRes.data?.status}`);
  assert(draftRes.data?.status === 'DRAFT', 'Status is DRAFT');

  // ─── Test 3: Place Order ────────────────────────────────────
  console.log('\n--- Test 3: Place Order ---');
  const placeRes = await api('POST', `/orders/${orderId}/place`, orderBody, cookie);
  assert(placeRes.status === 200 || placeRes.status === 201, `Placed: ${placeRes.status}`);
  assert(placeRes.data?.status === 'PLACED', `Status is PLACED (got ${placeRes.data?.status})`);
  console.log(`  Total: ${placeRes.data?.totalCents} cents`);
  console.log(`  Lines: ${placeRes.data?.lines?.length}`);
  if (placeRes.data?.lines?.[0]) {
    const line = placeRes.data.lines[0];
    console.log(`  Line: ${line.dishName}, qty=${line.quantity}, total=${line.lineTotalCents}`);
    if (line.combinations?.[0]) {
      const c = line.combinations[0];
      console.log(`  Combo: "${c.label}", qty=${c.quantity}, unit=${c.unitCents}, total=${c.totalCents}`);
      console.log(`  Options: ${c.options?.map(o => `${o.groupName}:${o.optionName}@${o.optionCents}`).join(', ')}`);
    }
  }

  // ─── Test 4: Order Detail ───────────────────────────────────
  console.log('\n--- Test 4: Order Detail ---');
  const detailRes = await api('GET', `/orders/${orderId}`, null, cookie);
  assert(detailRes.status === 200, 'Detail returns 200');
  console.log(`  Status: ${detailRes.data?.status}`);
  console.log(`  Locked: ${detailRes.data?.locked}`);
  console.log(`  Actions: ${detailRes.data?.actions?.join(', ')}`);
  console.log(`  Delivery: ${detailRes.data?.deliveryDate}`);

  // ─── Test 5: Order List ─────────────────────────────────────
  console.log('\n--- Test 5: Order List ---');
  const listRes = await api('GET', `/orders?status=PLACED&page=1&pageSize=10`, null, cookie);
  assert(listRes.status === 200, 'List returns 200');
  console.log(`  Total: ${listRes.data?.pagination?.total}`);
  console.log(`  Page: ${listRes.data?.pagination?.page}/${listRes.data?.pagination?.totalPages}`);
  assert(listRes.data?.pagination?.total >= 1, 'At least 1 placed order');

  // ─── Test 6: Cancel Order ───────────────────────────────────
  console.log('\n--- Test 6: Cancel ---');
  // Create another order to cancel
  const d2 = await api('POST', '/orders', orderBody, cookie);
  const o2 = d2.data?.id;
  await api('POST', `/orders/${o2}/place`, orderBody, cookie);
  const cancelRes = await api('POST', `/orders/${o2}/cancel`, { reason: 'Testing' }, cookie);
  assert(cancelRes.status === 200 || cancelRes.status === 201, `Cancelled: ${cancelRes.status}`);
  assert(cancelRes.data?.status === 'CANCELLED', `Status is CANCELLED`);
  console.log(`  Reason: ${cancelRes.data?.cancelReason}`);

  // ─── Test 7: Reject Order ──────────────────────────────────
  console.log('\n--- Test 7: Reject ---');
  const d3 = await api('POST', '/orders', orderBody, cookie);
  const o3 = d3.data?.id;
  await api('POST', `/orders/${o3}/place`, orderBody, cookie);
  const rejectRes = await api('POST', `/orders/${o3}/reject`, { reason: 'Quality issue' }, cookie);
  assert(rejectRes.status === 200 || rejectRes.status === 201, `Rejected: ${rejectRes.status}`);
  assert(rejectRes.data?.status === 'REJECTED', `Status is REJECTED`);
  console.log(`  Reason: ${rejectRes.data?.rejectReason}`);

  // ─── Test 8: Manual Cut-off ─────────────────────────────────
  console.log('\n--- Test 8: Manual Cut-off ---');
  // Create a draft for cut-off test
  const d4 = await api('POST', '/orders', orderBody, cookie);
  console.log(`  Draft for cutoff: ${d4.data?.id}`);
  
  // Also create a placed one
  const d5 = await api('POST', '/orders', orderBody, cookie);
  await api('POST', `/orders/${d5.data?.id}/place`, orderBody, cookie);
  console.log(`  Placed for cutoff: ${d5.data?.id}`);

  const cutoffRes = await api('POST', '/cutoff/run', {
    date: deliveryDate,
    force: true,
  }, cookie);
  assert(cutoffRes.status === 200 || cutoffRes.status === 201, `Cutoff ran: ${cutoffRes.status}`);
  console.log(`  Skipped: ${cutoffRes.data?.skipped}`);
  console.log(`  Drafts cancelled: ${cutoffRes.data?.draftsCancelled}`);
  console.log(`  Orders confirmed: ${cutoffRes.data?.ordersConfirmed}`);
  console.log(`  Drops: ${cutoffRes.data?.dropsCreated}`);

  // ─── Test 9: Idempotent Cut-off ─────────────────────────────
  console.log('\n--- Test 9: Idempotent Cut-off ---');
  const cutoff2 = await api('POST', '/cutoff/run', {
    date: deliveryDate,
    force: true,
  }, cookie);
  assert(cutoff2.status === 200 || cutoff2.status === 201, 'Second cutoff OK');
  assert(cutoff2.data?.draftsCancelled === 0, `0 drafts cancelled (got ${cutoff2.data?.draftsCancelled})`);
  assert(cutoff2.data?.ordersConfirmed === 0, `0 orders confirmed (got ${cutoff2.data?.ordersConfirmed})`);

  // ─── Test 10: Admin Override ────────────────────────────────
  console.log('\n--- Test 10: Admin Override ---');
  const confList = await api('GET', '/orders?status=CONFIRMED&page=1&pageSize=1', null, cookie);
  const confOrder = confList.data?.data?.[0];
  if (confOrder) {
    const ovRes = await api('PUT', `/orders/${confOrder.id}/override`, {
      deliveryTimeMin: 780,
    }, cookie);
    assert(ovRes.status === 200 || ovRes.status === 201, 'Override succeeded');
    console.log(`  New delivery time: ${ovRes.data?.deliveryTimeMin}`);
  } else {
    console.log('  ⚠️ No confirmed order for override test');
  }

  // ─── Test 11: Permission Check ─────────────────────────────
  console.log('\n--- Test 11: Permission Check ---');
  const kitLogin = await api('POST', '/auth/login', {
    email: 'kitchen@test.com',
    password: 'Test@1234',
  });
  const kitCookie = kitLogin.cookie;
  if (kitCookie) {
    const cutoffForbid = await api('POST', '/cutoff/run', { date: deliveryDate }, kitCookie);
    assert(cutoffForbid.status === 403, `Kitchen blocked from cutoff (${cutoffForbid.status})`);

    // Kitchen can read orders
    const kitOrders = await api('GET', '/orders?page=1&pageSize=5', null, kitCookie);
    assert(kitOrders.status === 200, 'Kitchen can read orders');
  }

  console.log('\n🎉 All Phase 5 tests passed!\n');
}

main().catch(err => {
  console.error('\n💥 Test failed:', err.message || err);
  process.exit(1);
});
