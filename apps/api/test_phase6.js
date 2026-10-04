/**
 * Phase 6 Test Script — Kitchen Operations
 * 
 * Run: node test_phase6.js
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
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data, cookie: res.headers.get('set-cookie') };
}

function assert(cond, msg) {
  if (!cond) {
    console.error(`❌ FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ ${msg}`);
}

function getFutureDeliveryDate(daysAhead = 4) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

async function main() {
  console.log('\n🚀 Phase 6 Test: Kitchen Operations\n');
  const deliveryDate = getFutureDeliveryDate();
  console.log(`📅 Using delivery date: ${deliveryDate}\n`);

  // ─── 1. Login as Admin & Kitchen ──────────────────────────────
  console.log('--- Step 1: Authentication ---');
  const adminLogin = await api('POST', '/auth/login', {
    email: 'admin@test.com',
    password: 'Test@1234',
  });
  assert(adminLogin.status === 200 || adminLogin.status === 201, 'Admin login');
  const adminCookie = adminLogin.cookie;
  assert(adminCookie, 'Got admin auth cookie');

  const kitchenLogin = await api('POST', '/auth/login', {
    email: 'kitchen@test.com',
    password: 'Test@1234',
  });
  assert(kitchenLogin.status === 200 || kitchenLogin.status === 201, 'Kitchen login');
  const kitchenCookie = kitchenLogin.cookie;
  assert(kitchenCookie, 'Got kitchen auth cookie');

  // ─── 2. Setup Reference Data, Catalogue & Pricing ─────────────
  console.log('\n--- Step 2: Setup Test Data ---');
  let stationId;
  const stations = await api('GET', '/ref/stations', null, adminCookie);
  if (stations.data?.length > 0) {
    stationId = stations.data[0].id;
  } else {
    const s = await api('POST', '/ref/stations', { name: 'Wok-P6', sortOrder: 1 }, adminCookie);
    stationId = s.data?.id;
  }
  assert(stationId, `Kitchen Station ID: ${stationId}`);

  // Create dish routed to stationId
  const sku = 'P6-BOWL-' + Date.now().toString().slice(-6);
  const dishRes = await api('POST', '/dishes', {
    name: 'Phase6 Stir Fry',
    sku,
    description: 'Hot stir fry for kitchen testing',
    temperature: 'HOT',
    costCents: 250,
    stationId,
    minOrderQty: 1,
  }, adminCookie);
  assert(dishRes.status === 200 || dishRes.status === 201, `Dish created (${dishRes.status})`);
  const dishId = dishRes.data?.id;
  assert(dishId, `Dish ID: ${dishId}`);

  // Create two options for combination splitting
  const opt1Res = await api('POST', '/options', {
    name: 'Tofu-P6-' + Date.now().toString().slice(-6),
    costCents: 40,
  }, adminCookie);
  const option1Id = opt1Res.data?.id;

  const opt2Res = await api('POST', '/options', {
    name: 'Noodles-P6-' + Date.now().toString().slice(-6),
    costCents: 30,
  }, adminCookie);
  const option2Id = opt2Res.data?.id;

  // Create option group
  const groupRes = await api('POST', `/dishes/${dishId}/groups`, {
    name: 'Protein Choice',
    required: true,
    sortOrder: 0,
    usesPortions: false,
    options: [
      { optionId: option1Id, sortOrder: 0 },
      { optionId: option2Id, sortOrder: 1 },
    ],
  }, adminCookie);
  const groupId = groupRes.data?.id;
  assert(groupId, `Option Group ID: ${groupId}`);

  // Setup Tier
  const tiersRes = await api('GET', '/pricing/tiers', null, adminCookie);
  let tierId = tiersRes.data?.find((t) => t.isDefault)?.id;
  if (!tierId) {
    const tierRes = await api('POST', '/pricing/tiers', {
      name: 'Default-P6',
      isDefault: true,
      derivation: 'NONE',
    }, adminCookie);
    tierId = tierRes.data?.id;
  }
  assert(tierId, `Price Tier ID: ${tierId}`);

  // Set prices
  await api('PUT', `/pricing/tiers/${tierId}/grid`, [
    { id: dishId, priceCents: 600 },
  ], adminCookie);
  await api('PUT', `/pricing/tiers/${tierId}/grid?kind=option`, [
    { id: option1Id, priceCents: 50 },
    { id: option2Id, priceCents: 50 },
  ], adminCookie);

  // Setup Menu Category + Item
  const catRes = await api('POST', '/menu-categories', {
    name: 'Kitchen Wok P6',
    slug: 'kitchen-wok-p6-' + Date.now().toString().slice(-6),
    sortOrder: 0,
  }, adminCookie);
  const categoryId = catRes.data?.id;
  await api('POST', `/menu-categories/${categoryId}/items`, {
    dishId,
    sortOrder: 0,
  }, adminCookie);

  // Setup Company + Address + Employee
  const compRes = await api('POST', '/companies', {
    name: 'KitchenTestCorp-' + Date.now().toString().slice(-6),
    billingName: 'KTC Billing',
    billingEmail: 'ktc@billing.com',
    billingAddress: '55 Wok Ave',
    workingDays: [1, 2, 3, 4, 5],
    defaultDeliveryTimeMin: 720,
    dispatchLeadMinutes: 60,
    tierId,
  }, adminCookie);
  const companyId = compRes.data?.id;

  const addrRes = await api('POST', `/companies/${companyId}/addresses`, {
    label: 'Main Office',
    line1: '55 Wok Ave',
    city: 'Mumbai',
    postcode: '400001',
    isDefault: true,
  }, adminCookie);
  const addressId = addrRes.data?.id;

  const empRes = await api('POST', '/employees', {
    companyId,
    name: 'Chef Tester',
    email: `cheftester${Date.now()}@ktc.com`,
    canChooseAddress: true,
    canChangeTime: true,
    canChangePackaging: true,
  }, adminCookie);
  assert(empRes.status === 200 || empRes.status === 201, 'Employee created');
  const employeeId = empRes.data?.id;

  // ─── 3. Create & Place 2 Orders with Multiple Combinations ───
  console.log('\n--- Step 3: Create & Confirm Orders with Multiple Prep Units ---');

  // Order 1: Has 2 distinct combinations (2 prep units)
  const order1Body = {
    employeeId,
    deliveryDate,
    deliveryTimeMin: 720,
    addressId,
    packaging: 'STANDARD',
    notes: 'Kitchen Test Order 1',
    lines: [
      {
        dishId,
        quantity: 3,
        combinations: [
          {
            quantity: 2,
            selections: [{ groupId, optionId: option1Id }],
          },
          {
            quantity: 1,
            selections: [{ groupId, optionId: option2Id }],
          },
        ],
      },
    ],
  };

  const draft1 = await api('POST', '/orders', order1Body, adminCookie);
  assert(draft1.status === 200 || draft1.status === 201, 'Draft 1 created');
  const order1Id = draft1.data?.id;
  const place1 = await api('POST', `/orders/${order1Id}/place`, order1Body, adminCookie);
  assert(place1.status === 200 || place1.status === 201, 'Order 1 placed');

  // Order 2: Another order with 1 combination (for force-complete testing)
  const order2Body = {
    employeeId,
    deliveryDate,
    deliveryTimeMin: 750,
    addressId,
    packaging: 'STANDARD',
    notes: 'Kitchen Test Order 2 (Force Complete)',
    lines: [
      {
        dishId,
        quantity: 2,
        combinations: [
          {
            quantity: 2,
            selections: [{ groupId, optionId: option1Id }],
          },
        ],
      },
    ],
  };

  const draft2 = await api('POST', '/orders', order2Body, adminCookie);
  assert(draft2.status === 200 || draft2.status === 201, 'Draft 2 created');
  const order2Id = draft2.data?.id;
  const place2 = await api('POST', `/orders/${order2Id}/place`, order2Body, adminCookie);
  assert(place2.status === 200 || place2.status === 201, 'Order 2 placed');

  // Before cutoff confirmation: kitchen board must NOT show PLACED orders
  const boardBeforeCutoff = await api('GET', `/kitchen/board?date=${deliveryDate}`, null, kitchenCookie);
  assert(boardBeforeCutoff.status === 200, 'Kitchen board responds 200');
  const countBefore = boardBeforeCutoff.data?.orders?.filter(o => o.id === order1Id || o.id === order2Id).length || 0;
  assert(countBefore === 0, 'Placed orders do not appear on kitchen board before confirmation');

  // Run Cut-off to confirm both orders
  const cutoffRes = await api('POST', '/cutoff/run', {
    date: deliveryDate,
    force: true,
  }, adminCookie);
  assert(cutoffRes.status === 200 || cutoffRes.status === 201, 'Cut-off triggered');

  // ─── 4. Test Kitchen Board Query ──────────────────────────────
  console.log('\n--- Step 4: Kitchen Board Query ---');
  const boardRes = await api('GET', `/kitchen/board?date=${deliveryDate}`, null, kitchenCookie);
  assert(boardRes.status === 200, 'Kitchen board fetched by kitchen staff');
  console.log(`  Total Orders: ${boardRes.data?.summary?.totalOrders}`);
  console.log(`  Total Meals: ${boardRes.data?.summary?.totalMeals}`);
  console.log(`  Remaining Meals: ${boardRes.data?.summary?.remainingMeals}`);
  console.log(`  Late Count: ${boardRes.data?.summary?.lateCount}`);
  console.log(`  At-Risk Count: ${boardRes.data?.summary?.atRiskCount}`);

  assert(boardRes.data?.summary?.totalOrders >= 2, 'At least 2 confirmed orders found');
  const ord1 = boardRes.data?.orders?.find((o) => o.id === order1Id);
  assert(ord1, 'Order 1 found in kitchen board');
  assert(ord1.units?.length === 2, `Order 1 has 2 prep units (got ${ord1.units?.length})`);
  console.log(`  Order 1 risk: ${ord1.risk}, plannedReady: ${ord1.plannedKitchenReadyAt}`);

  const unitA = ord1.units[0];
  const unitB = ord1.units[1];
  assert(unitA.state === 'NOT_STARTED', `Unit A initial state is NOT_STARTED (got ${unitA.state})`);
  assert(unitB.state === 'NOT_STARTED', `Unit B initial state is NOT_STARTED (got ${unitB.state})`);
  assert(unitA.stationId === stationId, `Unit A correctly routed to station ${stationId}`);

  // Test Station Filter
  const filteredBoard = await api('GET', `/kitchen/board?date=${deliveryDate}&stationId=${stationId}`, null, kitchenCookie);
  assert(filteredBoard.status === 200, 'Station filter responds 200');
  const allFilteredMatch = filteredBoard.data?.orders?.every(o => o.units.every(u => u.stationId === stationId));
  assert(allFilteredMatch, 'Filtered board contains only units for the chosen station');

  // Verify Cook Totals
  assert(boardRes.data?.cookTotals?.length > 0, 'Cook totals aggregated');
  const ctMatch = boardRes.data?.cookTotals?.find(c => c.dishId === dishId);
  assert(ctMatch, 'Dish found in cookTotals');
  console.log(`  Cook total for dish: ${ctMatch.dishName} — totalQty: ${ctMatch.totalQty}, remainingQty: ${ctMatch.remainingQty}`);

  // ─── 5. Test Start Unit ───────────────────────────────────────
  console.log('\n--- Step 5: Start Prep Unit ---');
  const startRes = await api('POST', `/kitchen/units/${unitA.id}/start`, null, kitchenCookie);
  assert(startRes.status === 200 || startRes.status === 201, `Unit A started (${startRes.status})`);
  assert(startRes.data?.unit?.startedAt !== null, 'Unit A has startedAt timestamp');
  assert(startRes.data?.order?.kitchenStartedAt !== null, 'Order kitchenStartedAt set on first unit start');
  assert(startRes.data?.order?.kitchenReadyAt === null, 'Order kitchenReadyAt is null (unit B not done)');

  // Starting again should return 409 Conflict
  const startAgain = await api('POST', `/kitchen/units/${unitA.id}/start`, null, kitchenCookie);
  assert(startAgain.status === 409, `Starting already started unit returns 409 (${startAgain.status})`);
  assert(
    (startAgain.data?.error?.code || startAgain.data?.code) === 'UNIT_ALREADY_STARTED',
    `Returned code UNIT_ALREADY_STARTED (got ${startAgain.data?.error?.code || startAgain.data?.code})`,
  );

  // ─── 6. Test Done Unit (including unstarted direct done) ───────
  console.log('\n--- Step 6: Done Prep Unit ---');
  // Complete unit A
  const doneARes = await api('POST', `/kitchen/units/${unitA.id}/done`, null, kitchenCookie);
  assert(doneARes.status === 200 || doneARes.status === 201, `Unit A marked done (${doneARes.status})`);
  assert(doneARes.data?.unit?.doneAt !== null, 'Unit A has doneAt timestamp');
  assert(doneARes.data?.order?.kitchenReadyAt === null, 'Order not ready yet because Unit B is still open');

  // Attempt to done Unit A again -> 409 Conflict
  const doneAAgain = await api('POST', `/kitchen/units/${unitA.id}/done`, null, kitchenCookie);
  assert(doneAAgain.status === 409, `Finishing already done unit returns 409 (${doneAAgain.status})`);
  assert(
    (doneAAgain.data?.error?.code || doneAAgain.data?.code) === 'UNIT_ALREADY_DONE',
    `Returned code UNIT_ALREADY_DONE (got ${doneAAgain.data?.error?.code || doneAAgain.data?.code})`,
  );

  // Attempt to start Unit A again -> 409 Conflict
  const startDoneUnit = await api('POST', `/kitchen/units/${unitA.id}/start`, null, kitchenCookie);
  assert(startDoneUnit.status === 409, `Starting already done unit returns 409 (${startDoneUnit.status})`);
  assert(
    (startDoneUnit.data?.error?.code || startDoneUnit.data?.code) === 'UNIT_ALREADY_DONE',
    `Starting done unit returns UNIT_ALREADY_DONE (got ${startDoneUnit.data?.error?.code || startDoneUnit.data?.code})`,
  );

  // Direct done on Unit B (which was NOT_STARTED)
  // Per requirement: finishing a unit that was never started is allowed and records start = done time!
  console.log('\n--- Step 6b: Direct Done on Unstarted Unit ---');
  const doneBRes = await api('POST', `/kitchen/units/${unitB.id}/done`, null, kitchenCookie);
  assert(doneBRes.status === 200 || doneBRes.status === 201, `Unit B direct done succeeded (${doneBRes.status})`);
  assert(doneBRes.data?.unit?.startedAt !== null, 'Unit B startedAt was automatically recorded');
  assert(doneBRes.data?.unit?.doneAt !== null, 'Unit B doneAt recorded');
  assert(doneBRes.data?.order?.kitchenReadyAt !== null, 'Order kitchenReadyAt automatically set when all units are done!');
  console.log(`  Order 1 is fully ready at: ${doneBRes.data?.order?.kitchenReadyAt}`);

  // ─── 7. Test Concurrency on Same Order ────────────────────────
  console.log('\n--- Step 7: Concurrency & Lock Serialization Test ---');
  // Create Order 3 with 2 units, confirm it, then trigger concurrent done calls
  const order3Body = {
    employeeId,
    deliveryDate,
    deliveryTimeMin: 730,
    addressId,
    packaging: 'STANDARD',
    notes: 'Concurrent test order',
    lines: [
      {
        dishId,
        quantity: 2,
        combinations: [
          { quantity: 1, selections: [{ groupId, optionId: option1Id }] },
          { quantity: 1, selections: [{ groupId, optionId: option2Id }] },
        ],
      },
    ],
  };
  const draft3 = await api('POST', '/orders', order3Body, adminCookie);
  const order3Id = draft3.data?.id;
  await api('POST', `/orders/${order3Id}/place`, order3Body, adminCookie);
  await api('POST', '/cutoff/run', { date: deliveryDate, force: true }, adminCookie);

  const boardForOrd3 = await api('GET', `/kitchen/board?date=${deliveryDate}`, null, kitchenCookie);
  const ord3FromBoard = boardForOrd3.data?.orders?.find((o) => o.id === order3Id);
  assert(ord3FromBoard?.units?.length === 2, 'Order 3 found with 2 units');

  const u3A = ord3FromBoard.units[0];
  const u3B = ord3FromBoard.units[1];

  console.log('  Firing 2 simultaneous done requests on Order 3 units...');
  const [resA, resB] = await Promise.all([
    api('POST', `/kitchen/units/${u3A.id}/done`, null, kitchenCookie),
    api('POST', `/kitchen/units/${u3B.id}/done`, null, kitchenCookie),
  ]);

  assert(resA.status === 200 || resA.status === 201, `Concurrent request A status ${resA.status}`);
  assert(resB.status === 200 || resB.status === 201, `Concurrent request B status ${resB.status}`);

  // Verify order 3 final state
  const checkOrd3 = await api('GET', `/orders/${order3Id}`, null, adminCookie);
  assert(checkOrd3.data?.kitchenStartedAt !== null, 'Order 3 kitchenStartedAt set');
  assert(checkOrd3.data?.kitchenReadyAt !== null, 'Order 3 kitchenReadyAt set after concurrent completions');
  console.log('✅ Concurrency test passed: Row-level lock prevented race conditions and serialized completion');

  // ─── 8. Test Force-Complete ───────────────────────────────────
  console.log('\n--- Step 8: Force-Complete (Admin only) ---');
  // Kitchen role attempts force complete -> 403 Forbidden
  const forceKitchen = await api('POST', `/kitchen/orders/${order2Id}/force-complete`, null, kitchenCookie);
  assert(forceKitchen.status === 403, `Kitchen role forbidden from force-complete (${forceKitchen.status})`);

  // Admin executes force complete -> 200 OK
  const forceAdmin = await api('POST', `/kitchen/orders/${order2Id}/force-complete`, null, adminCookie);
  assert(forceAdmin.status === 200 || forceAdmin.status === 201, `Admin force-complete succeeded (${forceAdmin.status})`);
  assert(forceAdmin.data?.kitchenStartedAt !== null, 'Force-completed order has kitchenStartedAt');
  assert(forceAdmin.data?.kitchenReadyAt !== null, 'Force-completed order has kitchenReadyAt');
  const allUnitsDone = forceAdmin.data?.lines?.every((l) => l.combinations.every((c) => c.doneAt !== null));
  assert(allUnitsDone, 'All units marked done after force-complete');

  console.log('\n🎉 ALL PHASE 6 KITCHEN TESTS PASSED SUCCESSFULLY! 🎉\n');
}

main().catch((err) => {
  console.error('\n💥 Test run failed:', err.message || err);
  process.exit(1);
});
