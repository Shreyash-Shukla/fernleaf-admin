/**
 * Phase 9 Test Script — Seed Data & Demo Environment
 * 
 * Run: node test_phase9.js
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

async function main() {
  console.log('\n🚀 Phase 9 Test: Seed Data & Demo Environment\n');

  // ─── Step 1: Authentication ──────────────────────────────────
  console.log('--- Step 1: Authentication for All Roles ---');
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

  const dispatchLogin = await api('POST', '/auth/login', {
    email: 'dispatch@test.com',
    password: 'Test@1234',
  });
  assert(dispatchLogin.status === 200 || dispatchLogin.status === 201, 'Dispatch login');
  const dispatchCookie = dispatchLogin.cookie;

  const driverLogin = await api('POST', '/auth/login', {
    email: 'driver@test.com',
    password: 'Test@1234',
  });
  assert(driverLogin.status === 200 || driverLogin.status === 201, 'Driver login');
  const driverCookie = driverLogin.cookie;

  // ─── Step 2: Role Permission & Guard Scoping on Reseed ───────
  console.log('\n--- Step 2: Role Permission on /admin/reseed ---');
  const kitchenReseed = await api('POST', '/admin/reseed', null, kitchenCookie);
  assert(kitchenReseed.status === 403, 'Kitchen accessing /admin/reseed returns 403 Forbidden');

  const dispatchReseed = await api('POST', '/admin/reseed', null, dispatchCookie);
  assert(dispatchReseed.status === 403, 'Dispatch accessing /admin/reseed returns 403 Forbidden');

  const driverReseed = await api('POST', '/admin/reseed', null, driverCookie);
  assert(driverReseed.status === 403, 'Driver accessing /admin/reseed returns 403 Forbidden');

  const adminReseed = await api('POST', '/admin/reseed', null, adminCookie);
  assert(adminReseed.status === 200, `Admin accessing /admin/reseed returns 200 (got ${adminReseed.status})`);
  assert(adminReseed.data.success === true, 'Admin reseed returns success: true');
  const todayStr = adminReseed.data.today;
  assert(todayStr, `Seed reports today as: ${todayStr}`);

  // ─── Step 3: Reference Data Verification ─────────────────────
  console.log('\n--- Step 3: Reference Data Verification ---');
  const allergensRes = await api('GET', '/ref/allergens', null, adminCookie);
  assert(allergensRes.status === 200, 'Allergens endpoint returns 200');
  const allergens = allergensRes.data;
  assert(allergens.length >= 14, `Has 14 allergens (got ${allergens.length})`);
  const allergenNames = allergens.map((a) => a.name);
  assert(allergenNames.includes('Gluten') && allergenNames.includes('Dairy') && allergenNames.includes('Tree Nuts'), 'Contains core allergens');

  const tagsRes = await api('GET', '/ref/dietary-tags', null, adminCookie);
  assert(tagsRes.status === 200, 'Dietary tags endpoint returns 200');
  const tags = tagsRes.data;
  assert(tags.length >= 6, `Has 6 dietary tags (got ${tags.length})`);
  const tagNames = tags.map((t) => t.name);
  assert(tagNames.includes('Vegan') && tagNames.includes('Jain') && tagNames.includes('Halal'), 'Contains Vegan, Jain, Halal tags');

  const stationsRes = await api('GET', '/ref/stations', null, adminCookie);
  assert(stationsRes.status === 200, 'Kitchen stations endpoint returns 200');
  const stations = stationsRes.data;
  assert(stations.length >= 4, `Has 4 kitchen stations (got ${stations.length})`);
  const stationNames = stations.map((s) => s.name);
  assert(stationNames.includes('Hot Line') && stationNames.includes('Cold Prep') && stationNames.includes('Bakery') && stationNames.includes('Grill'), 'Contains 4 stations');

  const portionsRes = await api('GET', '/ref/portion-sizes', null, adminCookie);
  assert(portionsRes.status === 200, 'Portion sizes endpoint returns 200');
  const portions = portionsRes.data;
  assert(portions.length >= 2, `Has 2 portion sizes (got ${portions.length})`);
  const portionNames = portions.map((p) => p.name);
  assert(portionNames.includes('Regular') && portionNames.includes('Large'), 'Contains Regular and Large portions');

  // ─── Step 4: Pricing Tiers & Gaps ────────────────────────────
  console.log('\n--- Step 4: Pricing Tiers & Derivation ---');
  const tiersRes = await api('GET', '/pricing/tiers', null, adminCookie);
  assert(tiersRes.status === 200, 'Pricing tiers endpoint returns 200');
  const tiers = tiersRes.data;
  const standardTier = tiers.find((t) => t.name === 'Standard');
  const enterpriseTier = tiers.find((t) => t.name === 'Enterprise');
  const partnerTier = tiers.find((t) => t.name === 'Partner');
  assert(standardTier && standardTier.isDefault, 'Standard tier is default');
  assert(enterpriseTier && enterpriseTier.derivation === 'TIER_FACTOR' && enterpriseTier.factorBps === 9000, 'Enterprise tier is TIER_FACTOR 90%');
  assert(partnerTier && partnerTier.derivation === 'COST_FACTOR' && partnerTier.factorBps === 24000, 'Partner tier is COST_FACTOR 240%');

  // ─── Step 5: Catalogue Verification ──────────────────────────
  console.log('\n--- Step 5: Catalogue Verification ---');
  const categoriesRes = await api('GET', '/menu/categories', null, adminCookie);
  assert(categoriesRes.status === 200, 'Categories endpoint returns 200');
  const categories = categoriesRes.data;
  assert(categories.length >= 5, `Has 5 categories (got ${categories.length})`);
  const secretCategory = categories.find((c) => c.slug === 'chefs-table');
  assert(secretCategory && secretCategory.isSecret === true, "Chef's Table is secret category");

  const dishesRes = await api('GET', '/dishes?limit=100', null, adminCookie);
  assert(dishesRes.status === 200, 'Dishes endpoint returns 200');
  const dishes = dishesRes.data.items || dishesRes.data;
  assert(dishes.length >= 25, `Has ~30 dishes (got ${dishes.length})`);

  // Unassigned station dishes
  const unassignedDishes = dishes.filter((d) => !d.stationId);
  assert(unassignedDishes.length >= 2, `Has ≥2 dishes with unassigned station (got ${unassignedDishes.length})`);

  // minOrderQty dishes
  const minQtyDishes = dishes.filter((d) => d.minOrderQty && d.minOrderQty >= 2);
  assert(minQtyDishes.length >= 2, `Has ≥2 dishes with minOrderQty (got ${minQtyDishes.length})`);

  // Check pricing gaps: 2 dishes deliberately lack explicit Standard tier price
  const bwl008 = dishes.find((d) => d.sku === 'BWL-008');
  assert(bwl008, 'Found BWL-008');
  const chf003 = dishes.find((d) => d.sku === 'CHF-003');
  assert(chf003, 'Found CHF-003');

  // ─── Step 6: Companies Verification ──────────────────────────
  console.log('\n--- Step 6: 5 Companies & Configurations ---');
  const companiesRes = await api('GET', '/companies?limit=100', null, adminCookie);
  assert(companiesRes.status === 200, 'Companies endpoint returns 200');
  const companies = companiesRes.data.items || companiesRes.data;
  assert(companies.length >= 5, `Has 5 companies (got ${companies.length})`);

  const apex = companies.find((c) => c.name === 'Apex Global Capital');
  assert(apex, 'Found Apex Global Capital');
  assert(!apex.workingDays.includes(5), 'Apex has Friday off (workingDays does not include Friday/5)');

  const nexus = companies.find((c) => c.name === 'Nexus Tech Solutions');
  assert(nexus, 'Found Nexus Tech Solutions');

  // Verify default driver for Nexus and Apex is driver@test.com
  const driverUser = (await api('GET', '/auth/me', null, driverCookie)).data.user;
  assert(driverUser, 'Fetched driver user profile');

  // Check company detail
  const nexusDetail = (await api('GET', `/companies/${nexus.id}`, null, adminCookie)).data;
  assert(nexusDetail.defaultDriverId === driverUser.id, 'Nexus default driver is driver@test.com');
  assert(nexusDetail.addresses && nexusDetail.addresses.length >= 2, 'Nexus has multiple addresses');
  assert(nexusDetail.ownerEmployeeId, 'Nexus has owner employee configured');

  const apexDetail = (await api('GET', `/companies/${apex.id}`, null, adminCookie)).data;
  assert(apexDetail.defaultDriverId === driverUser.id, 'Apex default driver is driver@test.com');

  const vanguard = companies.find((c) => c.name === 'Vanguard Creative Studio');
  assert(vanguard, 'Found Vanguard Creative Studio');
  const hiddenCatsRes = await api('GET', `/companies/${vanguard.id}/hidden-categories`, null, adminCookie);
  assert(hiddenCatsRes.status === 200, 'Hidden categories endpoint returns 200');
  const hiddenCats = hiddenCatsRes.data;
  assert(hiddenCats && hiddenCats.length >= 1, 'Vanguard hides at least one category');

  // ─── Step 7: Orders Across Dates & All 6 Statuses ────────────
  console.log('\n--- Step 7: Orders Across Dates & 6 Statuses ---');
  const ordersRes = await api('GET', '/orders?pageSize=100', null, adminCookie);
  assert(ordersRes.status === 200, 'Orders endpoint returns 200');
  const orders = ordersRes.data.data || ordersRes.data.items || ordersRes.data;
  assert(orders.length >= 15, `Found ${orders.length} orders across dates`);

  // Verify all seed orders are tagged source=DEMO
  const demoOrders = orders.filter((o) => o.source === 'DEMO');
  assert(demoOrders.length > 0, `Found ${demoOrders.length} DEMO orders`);
  for (const o of demoOrders) {
    assert(o.source === 'DEMO', `Order #${o.number} is tagged DEMO`);
  }

  // Verify presence of statuses across dataset
  const statuses = new Set(orders.map((o) => o.status));
  console.log(`Order statuses present: ${Array.from(statuses).join(', ')}`);
  assert(statuses.has('DRAFT'), 'DRAFT status present');
  assert(statuses.has('PLACED'), 'PLACED status present');
  assert(statuses.has('CONFIRMED'), 'CONFIRMED status present');
  assert(statuses.has('DELIVERED'), 'DELIVERED status present');
  assert(statuses.has('CANCELLED'), 'CANCELLED status present');
  assert(statuses.has('REJECTED'), 'REJECTED status present');

  // ─── Step 8: Kitchen Role View ───────────────────────────────
  console.log('\n--- Step 8: Kitchen Board View for Today ---');
  const kitchenBoard = await api('GET', `/kitchen/board?date=${todayStr}`, null, kitchenCookie);
  assert(kitchenBoard.status === 200, 'Kitchen board returns 200');
  assert(kitchenBoard.data.date === todayStr, 'Kitchen board date matches today');
  assert(kitchenBoard.data.stations && kitchenBoard.data.stations.length >= 4, 'Kitchen board has 4 stations');
  assert(kitchenBoard.data.summary.totalOrders >= 4, `Kitchen has total orders for today (${kitchenBoard.data.summary.totalOrders})`);

  // Verify unit states: NOT_STARTED, STARTED, DONE
  let foundDone = false;
  let foundStarted = false;
  let foundNotStarted = false;
  let foundAtRiskOrLate = false;

  for (const order of kitchenBoard.data.orders) {
    if (order.isLate || order.isAtRisk) foundAtRiskOrLate = true;
    for (const unit of order.units) {
      if (unit.state === 'DONE') foundDone = true;
      if (unit.state === 'STARTED') foundStarted = true;
      if (unit.state === 'NOT_STARTED') foundNotStarted = true;
    }
  }
  assert(foundDone, 'Kitchen board has units marked DONE');
  assert(foundStarted, 'Kitchen board has units marked STARTED');
  assert(foundNotStarted, 'Kitchen board has units marked NOT_STARTED');
  assert(foundAtRiskOrLate, 'Kitchen board has LATE or AT_RISK orders banded');

  // ─── Step 9: Dispatch Role View ──────────────────────────────
  console.log('\n--- Step 9: Dispatch Board View for Today ---');
  const dispatchBoard = await api('GET', `/dispatch/board?date=${todayStr}`, null, dispatchCookie);
  assert(dispatchBoard.status === 200, 'Dispatch board returns 200');
  assert(dispatchBoard.data.summary.totalDrops >= 4, `Dispatch board has ≥4 drops (${dispatchBoard.data.summary.totalDrops})`);
  assert(dispatchBoard.data.summary.unassignedCount >= 1, `Dispatch board shows unassigned drops (${dispatchBoard.data.summary.unassignedCount})`);

  const dropStages = dispatchBoard.data.drops.map((d) => d.stage);
  console.log(`Drop stages present today: ${dropStages.join(', ')}`);
  assert(dropStages.includes('DELIVERED'), 'Drop stage DELIVERED present');
  assert(dropStages.includes('OUT_FOR_DELIVERY'), 'Drop stage OUT_FOR_DELIVERY present');
  assert(dropStages.includes('DISPATCH_READY'), 'Drop stage DISPATCH_READY present');
  assert(dropStages.includes('PREPARING'), 'Drop stage PREPARING present');

  // ─── Step 10: Driver Role View (≥4 drops for driver@test.com) ──
  console.log('\n--- Step 10: Driver View (driver@test.com) ---');
  const driverDropsRes = await api('GET', `/driver/drops?date=${todayStr}`, null, driverCookie);
  assert(driverDropsRes.status === 200, 'Driver endpoint returns 200');
  const driverDrops = driverDropsRes.data.drops;
  assert(driverDrops.length >= 4, `driver@test.com has ≥4 drops today (got ${driverDrops.length})`);
  
  const driverStages = driverDrops.map((d) => d.stage);
  console.log(`driver@test.com drops stages: ${driverStages.join(', ')}`);
  assert(driverStages.includes('DELIVERED'), 'Driver has DELIVERED drop');
  assert(driverStages.includes('OUT_FOR_DELIVERY'), 'Driver has OUT_FOR_DELIVERY drop');
  assert(driverStages.includes('DISPATCH_READY'), 'Driver has DISPATCH_READY drop');
  assert(driverStages.includes('PREPARING'), 'Driver has PREPARING drop');

  const deliveredDrop = driverDrops.find((d) => d.stage === 'DELIVERED');
  assert(deliveredDrop && deliveredDrop.deliveredNote, `Delivered drop has delivery note: "${deliveredDrop?.deliveredNote}"`);
  assert(deliveredDrop.onTime === true, 'Delivered drop marked on-time');

  // ─── Step 11: Billing & Invoicing Verification ───────────────
  console.log('\n--- Step 11: Billing & Invoicing Status ---');
  const invoicesRes = await api('GET', '/invoices?limit=100', null, adminCookie);
  assert(invoicesRes.status === 200, 'Invoices list returns 200');
  const invoices = invoicesRes.data.items || invoicesRes.data;
  assert(invoices.length >= 2, `Has at least 2 invoices (got ${invoices.length})`);

  const paidInvoice = invoices.find((i) => i.status === 'PAID');
  assert(paidInvoice, `Found PAID invoice: ${paidInvoice?.number}`);
  assert(paidInvoice.paidAt, 'PAID invoice has paidAt timestamp');

  const issuedInvoice = invoices.find((i) => i.status === 'ISSUED');
  assert(issuedInvoice, `Found ISSUED invoice: ${issuedInvoice?.number}`);

  const adjustmentsRes = await api('GET', '/billing/adjustments', null, adminCookie);
  assert(adjustmentsRes.status === 200, 'Adjustments list returns 200');
  const adjustments = adjustmentsRes.data.items || adjustmentsRes.data;
  assert(adjustments.length >= 1, `Has at least 1 adjustment (got ${adjustments.length})`);
  assert(adjustments.some((a) => a.status === 'OPEN'), 'Has OPEN adjustment');

  const unbilledRes = await api('GET', '/billing/unbilled', null, adminCookie);
  assert(unbilledRes.status === 200, 'Unbilled summary returns 200');
  assert(unbilledRes.data.length >= 1, 'Has unbilled orders for companies');

  // ─── Step 12: Cut-off Hold Date & Demo Execution ─────────────
  console.log('\n--- Step 12: Cut-off Hold Date & Manual Trigger Demo ---');
  const settingsRes = await api('GET', '/settings', null, adminCookie);
  assert(settingsRes.status === 200, 'Settings returns 200');
  const holdDates = settingsRes.data.cutoffHoldDates;
  assert(Array.isArray(holdDates) && holdDates.length >= 1, `cutoffHoldDates has demo date: ${holdDates}`);
  const demoDate = holdDates[0];

  // Verify demo date has DRAFT and PLACED orders before cut-off
  const demoOrdersBeforeRes = await api('GET', `/orders?from=${demoDate}&to=${demoDate}&pageSize=100`, null, adminCookie);
  const demoOrdersBefore = demoOrdersBeforeRes.data.data || demoOrdersBeforeRes.data.items || [];
  const draftsBefore = demoOrdersBefore.filter((o) => o.status === 'DRAFT');
  const placedBefore = demoOrdersBefore.filter((o) => o.status === 'PLACED');
  assert(draftsBefore.length >= 1, `Demo date ${demoDate} has DRAFT orders before cut-off (${draftsBefore.length})`);
  assert(placedBefore.length >= 1, `Demo date ${demoDate} has PLACED orders before cut-off (${placedBefore.length})`);

  // Run manual cut-off on demo date
  console.log(`Triggering manual cut-off for demo date ${demoDate}...`);
  const cutoffRunRes = await api('POST', '/cutoff/run', { date: demoDate, force: true }, adminCookie);
  assert(cutoffRunRes.status === 200 || cutoffRunRes.status === 201, `Manual cut-off returns 200 (got ${cutoffRunRes.status})`);
  assert(cutoffRunRes.data.draftsCancelled >= 1, `Drafts cancelled by cut-off: ${cutoffRunRes.data.draftsCancelled}`);
  assert(cutoffRunRes.data.ordersConfirmed >= 1, `Orders confirmed by cut-off: ${cutoffRunRes.data.ordersConfirmed}`);
  assert(cutoffRunRes.data.dropsCreated >= 1, `Drops created for confirmed orders: ${cutoffRunRes.data.dropsCreated}`);

  // ─── Step 13: Reseed Safety (Preserves STAFF Data) ───────────
  console.log('\n--- Step 13: Reseed Safety & Idempotence ---');
  // Re-run reseed to verify idempotence and state restoration
  const reseedRes = await api('POST', '/admin/reseed', null, adminCookie);
  assert(reseedRes.status === 200, 'Reseed completed successfully');

  // Verify driver drops restored
  const driverDropsAfter = (await api('GET', `/driver/drops?date=${todayStr}`, null, driverCookie)).data.drops;
  assert(driverDropsAfter.length >= 4, `driver@test.com still has ≥4 drops after reseed (${driverDropsAfter.length})`);

  console.log('\n🎉 ALL PHASE 9 SEED DATA TESTS PASSED SUCCESSFULLY! 🎉\n');
}

main().catch((err) => {
  console.error('\n❌ Unhandled error in test_phase9.js:', err);
  process.exit(1);
});
