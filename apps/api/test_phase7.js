/**
 * Phase 7 Test Script — Dispatch + Driver Operations
 * 
 * Run: node test_phase7.js
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

function getFutureDeliveryDate(daysAhead = 6) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

async function main() {
  console.log('\n🚀 Phase 7 Test: Dispatch + Driver Operations\n');
  const deliveryDate = getFutureDeliveryDate();
  console.log(`📅 Using delivery date: ${deliveryDate}\n`);

  // ─── Step 1: Authentication ──────────────────────────────────
  console.log('--- Step 1: Authentication ---');
  const adminLogin = await api('POST', '/auth/login', {
    email: 'admin@test.com',
    password: 'Test@1234',
  });
  assert(adminLogin.status === 200 || adminLogin.status === 201, 'Admin login');
  const adminCookie = adminLogin.cookie;
  assert(adminCookie, 'Got admin auth cookie');

  const dispatchLogin = await api('POST', '/auth/login', {
    email: 'dispatch@test.com',
    password: 'Test@1234',
  });
  assert(dispatchLogin.status === 200 || dispatchLogin.status === 201, 'Dispatch login');
  const dispatchCookie = dispatchLogin.cookie;
  assert(dispatchCookie, 'Got dispatch auth cookie');

  const driverLogin = await api('POST', '/auth/login', {
    email: 'driver@test.com',
    password: 'Test@1234',
  });
  assert(driverLogin.status === 200 || driverLogin.status === 201, 'Driver login');
  const driverCookie = driverLogin.cookie;
  assert(driverCookie, 'Got driver auth cookie');
  const driverUserId = driverLogin.data.user.id;
  assert(driverUserId, `Got driver user ID: ${driverUserId}`);

  const kitchenLogin = await api('POST', '/auth/login', {
    email: 'kitchen@test.com',
    password: 'Test@1234',
  });
  assert(kitchenLogin.status === 200 || kitchenLogin.status === 201, 'Kitchen login');
  const kitchenCookie = kitchenLogin.cookie;
  assert(kitchenCookie, 'Got kitchen auth cookie');

  // ─── Step 2: Role-based Guard Scoping ─────────────────────────
  console.log('\n--- Step 2: Role Permission & Guard Scoping ---');
  // Kitchen attempting driver endpoint must receive 403 Forbidden
  const kitchenDriverAttempt = await api('GET', '/driver/drops', null, kitchenCookie);
  assert(kitchenDriverAttempt.status === 403, `Kitchen accessing /driver/drops returns 403 (${kitchenDriverAttempt.status})`);

  // Kitchen attempting dispatch board must receive 403 Forbidden
  const kitchenDispatchAttempt = await api('GET', '/dispatch/board', null, kitchenCookie);
  assert(kitchenDispatchAttempt.status === 403, `Kitchen accessing /dispatch/board returns 403 (${kitchenDispatchAttempt.status})`);

  // Driver attempting dispatch-ready must receive 403 Forbidden
  const driverDispatchReadyAttempt = await api('POST', '/drops/some-drop-id/dispatch-ready', null, driverCookie);
  assert(driverDispatchReadyAttempt.status === 403, `Driver attempting /dispatch-ready returns 403 (${driverDispatchReadyAttempt.status})`);

  // ─── Step 3: Setup Test Company, Dishes & Orders ──────────────
  console.log('\n--- Step 3: Setup Test Orders & Cut-off Confirmation ---');
  const suffix = Date.now().toString().slice(-6);

  // 1. Create dish
  const dishRes = await api('POST', '/dishes', {
    sku: `P7-DISH-${suffix}`,
    name: `Phase 7 Gourmet Box ${suffix}`,
    description: 'Crispy tofu and jasmine rice',
    temperature: 'HOT',
    costCents: 450,
  }, adminCookie);
  assert(dishRes.status === 201, `Dish created (${dishRes.status})`);
  const dishId = dishRes.data.id;

  // 2. Create option
  const optRes = await api('POST', '/options', {
    name: `Steamed Rice ${suffix}`,
    costCents: 50,
  }, adminCookie);
  assert(optRes.status === 201, 'Option created');
  const optionId = optRes.data.id;

  // 3. Create option group with option attached
  const groupRes = await api('POST', `/dishes/${dishId}/groups`, {
    name: 'Rice Choice',
    required: true,
    sortOrder: 0,
    usesPortions: false,
    options: [
      { optionId, sortOrder: 0 },
    ],
  }, adminCookie);
  assert(groupRes.status === 201 || groupRes.status === 200, 'Option group created');
  const groupId = groupRes.data.id;

  // Set price tier
  const tiersRes = await api('GET', '/pricing/tiers', null, adminCookie);
  const tiersList = tiersRes.data?.tiers || tiersRes.data;
  let standardTier = tiersList.find(t => t.name === 'Standard') || tiersList.find(t => t.isDefault) || tiersList[0];
  const tierId = standardTier.id;

  await api('PUT', `/pricing/tiers/${tierId}/grid`, [
    { id: dishId, priceCents: 1200 },
  ], adminCookie);
  await api('PUT', `/pricing/tiers/${tierId}/grid?kind=option`, [
    { id: optionId, priceCents: 100 },
  ], adminCookie);

  // Activate dish on menu
  const catRes = await api('POST', '/menu-categories', {
    name: `Mains ${suffix}`,
    slug: `mains-${suffix}`,
    sortOrder: 0,
  }, adminCookie);
  const categoryId = catRes.data?.id;
  await api('POST', `/menu-categories/${categoryId}/items`, {
    dishId,
    sortOrder: 0,
  }, adminCookie);

  // Create Company with default address & employee
  const compRes = await api('POST', '/companies', {
    name: `Acme Dispatch Corp ${suffix}`,
    billingName: 'Acme Billing',
    billingEmail: `billing-${suffix}@acme.com`,
    billingAddress: '100 Innovation Way',
    defaultDeliveryTimeMin: 720, // 12:00
    dispatchLeadMinutes: 60,
    driverNotes: 'Security gate code: 1234. Ring bell at reception.',
    defaultDriverId: driverUserId,
    domains: [`acme-${suffix}.com`],
    address: {
      label: 'HQ',
      line1: '100 Innovation Way',
      city: 'Metropolis',
      postcode: '12345',
    },
  }, adminCookie);
  assert(compRes.status === 201, 'Company created with driverNotes & defaultDriver');
  const companyId = compRes.data.id;
  const addrRes = await api('GET', `/companies/${companyId}/addresses`, null, adminCookie);
  const addressId = addrRes.data[0].id;

  // Create Employees
  const empRes = await api('POST', `/companies/${companyId}/employees`, {
    name: `Alice Walker ${suffix}`,
    email: `alice.${suffix}@testcorp.com`,
    canChooseAddress: true,
    canChangeTime: true,
    canChangePackaging: true,
  }, adminCookie);
  assert(empRes.status === 201, 'Employee 1 created');
  const emp1Id = empRes.data.id;

  const emp2Res = await api('POST', `/companies/${companyId}/employees`, {
    name: `Bob Builder ${suffix}`,
    email: `bob.${suffix}@testcorp.com`,
    canChooseAddress: true,
    canChangeTime: true,
    canChangePackaging: true,
  }, adminCookie);
  assert(emp2Res.status === 201, 'Employee 2 created');
  const emp2Id = emp2Res.data.id;

  // Create Order 1 for Alice (12:00)
  const order1Body = {
    employeeId: emp1Id,
    deliveryDate,
    deliveryTimeMin: 720,
    addressId,
    packaging: 'STANDARD',
    lines: [
      {
        dishId,
        quantity: 1,
        combinations: [
          {
            quantity: 1,
            selections: [{ groupId, optionId }],
          },
        ],
      },
    ],
  };
  const draft1 = await api('POST', '/orders', order1Body, adminCookie);
  assert(draft1.status === 201 || draft1.status === 200, 'Order 1 draft created');
  const order1Id = draft1.data.id;
  const place1 = await api('POST', `/orders/${order1Id}/place`, order1Body, adminCookie);
  assert(place1.status === 200 || place1.status === 201, 'Order 1 placed');

  // Create Order 2 for Bob (12:00 -> same drop as Order 1)
  const order2Body = {
    employeeId: emp2Id,
    deliveryDate,
    deliveryTimeMin: 720,
    addressId,
    packaging: 'STANDARD',
    lines: [
      {
        dishId,
        quantity: 2,
        combinations: [
          {
            quantity: 2,
            selections: [{ groupId, optionId }],
          },
        ],
      },
    ],
  };
  const draft2 = await api('POST', '/orders', order2Body, adminCookie);
  assert(draft2.status === 201 || draft2.status === 200, 'Order 2 draft created');
  const order2Id = draft2.data.id;
  const place2 = await api('POST', `/orders/${order2Id}/place`, order2Body, adminCookie);
  assert(place2.status === 200 || place2.status === 201, 'Order 2 placed');

  // Create Order 3 for Bob at 13:00 (780 min) -> Separate Drop
  const order3Body = {
    employeeId: emp2Id,
    deliveryDate,
    deliveryTimeMin: 780,
    addressId,
    packaging: 'STANDARD',
    lines: [
      {
        dishId,
        quantity: 1,
        combinations: [
          {
            quantity: 1,
            selections: [{ groupId, optionId }],
          },
        ],
      },
    ],
  };
  const draft3 = await api('POST', '/orders', order3Body, adminCookie);
  assert(draft3.status === 201 || draft3.status === 200, 'Order 3 draft created');
  const order3Id = draft3.data.id;
  const place3 = await api('POST', `/orders/${order3Id}/place`, order3Body, adminCookie);
  assert(place3.status === 200 || place3.status === 201, 'Order 3 placed');

  // Run Cut-off to confirm all orders and create drops
  const cutoffRes = await api('POST', '/cutoff/run', { date: deliveryDate }, adminCookie);
  assert(cutoffRes.status === 200 || cutoffRes.status === 201, 'Cut-off triggered');

  // ─── Step 4: Dispatch Board Query ─────────────────────────────
  console.log('\n--- Step 4: Dispatch Board Query ---');
  const boardRes = await api('GET', `/dispatch/board?date=${deliveryDate}`, null, dispatchCookie);
  assert(boardRes.status === 200, `Dispatch board responds 200 (${boardRes.status})`);
  assert(boardRes.data.drops.length >= 2, `Found at least 2 drops for date (got ${boardRes.data.drops.length})`);
  console.log(`  Total drops on board: ${boardRes.data.summary.totalDrops}`);
  console.log(`  Total meals: ${boardRes.data.summary.totalMeals}`);

  // Find Drop 1 (containing Order 1 and Order 2)
  const drop1 = boardRes.data.drops.find(d => d.orders.some(o => o.id === order1Id));
  assert(drop1, 'Found Drop 1 containing Order 1');
  assert(drop1.orders.some(o => o.id === order2Id), 'Drop 1 also contains Order 2 (grouped by company+address+time)');
  assert(drop1.orderCount === 2, `Drop 1 has 2 orders (got ${drop1.orderCount})`);
  assert(drop1.totalMeals === 3, `Drop 1 has 3 meals (1 + 2 = 3, got ${drop1.totalMeals})`);
  assert(drop1.stage === 'PREPARING', `Drop 1 initial stage is PREPARING (got ${drop1.stage})`);
  assert(drop1.canDispatchReady === false, 'Drop 1 cannot be dispatch-ready yet (units cooking)');
  assert(drop1.stillCookingCount === 2, `Drop 1 has 2 orders cooking (got ${drop1.stillCookingCount})`);

  // Find Drop 2 (containing Order 3 at 13:00)
  const drop2 = boardRes.data.drops.find(d => d.orders.some(o => o.id === order3Id));
  assert(drop2, 'Found Drop 2 for Order 3');
  assert(drop2.id !== drop1.id, 'Drop 2 has a distinct ID from Drop 1');

  // ─── Step 5: Prerequisite Enforcement on dispatch-ready ───────
  console.log('\n--- Step 5: Prerequisite Enforcement on dispatch-ready ---');
  const prematureDispatchReady = await api('POST', `/drops/${drop1.id}/dispatch-ready`, null, dispatchCookie);
  assert(prematureDispatchReady.status === 409, `Calling dispatch-ready while units cooking returns 409 (${prematureDispatchReady.status})`);
  const prematureCode = prematureDispatchReady.data?.error?.code || prematureDispatchReady.data?.code;
  assert(prematureCode === 'PREREQUISITE_NOT_MET', `Returned code PREREQUISITE_NOT_MET (got ${prematureCode})`);
  console.log(`  409 message: "${prematureDispatchReady.data?.error?.message || prematureDispatchReady.data?.message}"`);

  // ─── Step 6: Kitchen Cook & Stage Update to KITCHEN_READY ──────
  console.log('\n--- Step 6: Kitchen Completes Cooking for Drop 1 ---');
  // Kitchen completes Order 1 only
  const force1 = await api('POST', `/kitchen/orders/${order1Id}/force-complete`, null, adminCookie);
  assert(force1.status === 201, 'Order 1 force-completed in kitchen');

  // Check drop stage: Order 1 is KITCHEN_READY, Order 2 is PREPARING -> Drop stage MUST still be PREPARING (least advanced rule!)
  const boardMidKitchen = await api('GET', `/dispatch/board?date=${deliveryDate}`, null, dispatchCookie);
  const drop1Mid = boardMidKitchen.data.drops.find(d => d.id === drop1.id);
  assert(drop1Mid.stage === 'PREPARING', `Drop 1 stage is PREPARING when only 1 order is done (least advanced rule verified, got ${drop1Mid.stage})`);
  assert(drop1Mid.canDispatchReady === false, 'Drop 1 cannot dispatch-ready when 1 order still cooking');

  // Now kitchen completes Order 2
  const force2 = await api('POST', `/kitchen/orders/${order2Id}/force-complete`, null, adminCookie);
  assert(force2.status === 201, 'Order 2 force-completed in kitchen');

  // Re-check board: now both orders are kitchen ready -> Drop stage is KITCHEN_READY
  const boardAfterKitchen = await api('GET', `/dispatch/board?date=${deliveryDate}`, null, dispatchCookie);
  const drop1Ready = boardAfterKitchen.data.drops.find(d => d.id === drop1.id);
  assert(drop1Ready.stage === 'KITCHEN_READY', `Drop 1 stage is now KITCHEN_READY (got ${drop1Ready.stage})`);
  assert(drop1Ready.canDispatchReady === true, 'Drop 1 canDispatchReady is now true');

  // ─── Step 7: Transition to DISPATCH_READY ─────────────────────
  console.log('\n--- Step 7: Transition to DISPATCH_READY ---');
  const dispatchReadyRes = await api('POST', `/drops/${drop1.id}/dispatch-ready`, null, dispatchCookie);
  assert(dispatchReadyRes.status === 200 || dispatchReadyRes.status === 201, `Mark dispatch-ready succeeded (${dispatchReadyRes.status})`);
  assert(dispatchReadyRes.data.stage === 'DISPATCH_READY', `Drop 1 returned stage DISPATCH_READY (got ${dispatchReadyRes.data.stage})`);

  // Verify orders in Drop 1 now have dispatchReadyAt
  const order1Check = await api('GET', `/orders/${order1Id}`, null, adminCookie);
  assert(order1Check.data.dispatchReadyAt !== null, 'Order 1 has dispatchReadyAt timestamp set');
  const order2Check = await api('GET', `/orders/${order2Id}`, null, adminCookie);
  assert(order2Check.data.dispatchReadyAt !== null, 'Order 2 has dispatchReadyAt timestamp set');

  // ─── Step 8: Driver Assignment & Out for Delivery Prerequisites ──
  console.log('\n--- Step 8: Driver Assignment & Out for Delivery Prerequisites ---');
  // First clear driver on Drop 1 to test driver requirement
  await api('POST', `/drops/${drop1.id}/assign-driver`, { driverId: null }, dispatchCookie);

  // Attempt out-for-delivery without driver -> must return 409 DROP_NO_DRIVER
  const noDriverOutAttempt = await api('POST', `/drops/${drop1.id}/out-for-delivery`, null, dispatchCookie);
  assert(noDriverOutAttempt.status === 409, `out-for-delivery without driver returns 409 (${noDriverOutAttempt.status})`);
  const noDriverCode = noDriverOutAttempt.data?.error?.code || noDriverOutAttempt.data?.code;
  assert(noDriverCode === 'DROP_NO_DRIVER', `Returned code DROP_NO_DRIVER (got ${noDriverCode})`);

  // Assign driver@test.com to Drop 1
  const assignRes = await api('POST', `/drops/${drop1.id}/assign-driver`, { driverId: driverUserId }, dispatchCookie);
  assert(assignRes.status === 200 || assignRes.status === 201, `Driver assigned successfully (${assignRes.status})`);
  assert(assignRes.data.driverId === driverUserId, 'Driver ID correctly set on drop');

  // ─── Step 9: Transition to OUT_FOR_DELIVERY ───────────────────
  console.log('\n--- Step 9: Transition to OUT_FOR_DELIVERY ---');
  const outRes = await api('POST', `/drops/${drop1.id}/out-for-delivery`, null, dispatchCookie);
  assert(outRes.status === 200 || outRes.status === 201, `Mark out-for-delivery succeeded (${outRes.status})`);
  assert(outRes.data.stage === 'OUT_FOR_DELIVERY', `Drop 1 returned stage OUT_FOR_DELIVERY (got ${outRes.data.stage})`);

  // Verify drop and orders have outForDeliveryAt set
  const drop1Detail = await api('GET', `/drops/${drop1.id}`, null, dispatchCookie);
  assert(drop1Detail.data.outForDeliveryAt !== null, 'Drop 1 has outForDeliveryAt timestamp');
  const order1Out = await api('GET', `/orders/${order1Id}`, null, adminCookie);
  assert(order1Out.data.outForDeliveryAt !== null, 'Order 1 has outForDeliveryAt timestamp');

  // ─── Step 10: Admin Override Re-keying Tests ──────────────────
  console.log('\n--- Step 10: Admin Override Re-keying Tests ---');
  // 1. Cannot override order that is already OUT_FOR_DELIVERY -> returns 409
  const overrideBlocked = await api('PUT', `/orders/${order1Id}/override`, {
    deliveryTimeMin: 750,
  }, adminCookie);
  assert(overrideBlocked.status === 409, `Admin override on OUT_FOR_DELIVERY order returns 409 (${overrideBlocked.status})`);
  const overrideCode = overrideBlocked.data?.error?.code || overrideBlocked.data?.code;
  assert(overrideCode === 'ORDER_NOT_EDITABLE', `Returned code ORDER_NOT_EDITABLE (got ${overrideCode})`);

  // 2. Override on Order 3 (in Drop 2, not out for delivery): change time from 13:00 (780) to 14:00 (840)
  const overrideRes = await api('PUT', `/orders/${order3Id}/override`, {
    deliveryTimeMin: 840,
  }, adminCookie);
  assert(overrideRes.status === 200, `Admin override on Order 3 succeeded (${overrideRes.status})`);
  assert(overrideRes.data.deliveryTimeMin === 840, 'Order 3 delivery time updated to 840');
  assert(overrideRes.data.dropId !== drop2.id, `Order 3 moved to new drop (old: ${drop2.id}, new: ${overrideRes.data.dropId})`);

  // Verify old Drop 2 was cleaned up since it had no other active orders and wasn't out
  const oldDropCheck = await api('GET', `/drops/${drop2.id}`, null, dispatchCookie);
  assert(oldDropCheck.status === 404, `Orphaned source Drop 2 automatically deleted on re-keying (${oldDropCheck.status})`);

  // ─── Step 11: Driver View & Scoping ───────────────────────────
  console.log('\n--- Step 11: Driver View & Scoping ---');
  // Unassign the new drop to verify unassigned drops do not appear for driver
  await api('POST', `/drops/${overrideRes.data.dropId}/assign-driver`, { driverId: null }, dispatchCookie);

  const driverDropsRes = await api('GET', `/driver/drops?date=${deliveryDate}`, null, driverCookie);
  assert(driverDropsRes.status === 200, `Driver drops endpoint responds 200 (${driverDropsRes.status})`);
  console.log(`  Driver drops total: ${driverDropsRes.data.summary.totalDrops}`);
  assert(driverDropsRes.data.drops.some(d => d.id === drop1.id), 'Driver sees assigned Drop 1');

  // Verify driver does NOT see drops assigned to other drivers or unassigned
  assert(!driverDropsRes.data.drops.some(d => d.id === overrideRes.data.dropId), 'Driver does not see unassigned new drop');

  // Verify minimal DTO structure
  const driverDrop = driverDropsRes.data.drops.find(d => d.id === drop1.id);
  assert(driverDrop.company.name.includes('Acme Dispatch Corp'), 'Driver DTO includes company name');
  assert(driverDrop.company.driverNotes.includes('Security gate code'), 'Driver DTO includes company standing notes');
  assert(driverDrop.recipientNames.length >= 2, `Driver DTO has recipient names (got ${driverDrop.recipientNames.join(', ')})`);
  assert(driverDrop.mealsCount === 3, `Driver DTO shows 3 meals`);
  assert(driverDrop.priceCents === undefined, 'Driver DTO does not leak pricing data');

  // ─── Step 12: Delivery Execution with Note & Photo Proof ──────
  console.log('\n--- Step 12: Delivery Execution with Note & Photo Proof ---');
  // Dispatch attempts to deliver without driver credentials -> 403 Forbidden
  // (Unless dispatch has deliver permission or deliver_any, but normal dispatch only has deliveries:read_any)
  // Let's test Driver delivery
  const fakePhotoData = 'data:image/jpeg;base64,' + Buffer.from('FAKE_JPEG_IMAGE_CONTENT').toString('base64');
  const deliverRes = await api('POST', `/drops/${drop1.id}/deliver`, {
    note: 'Delivered to reception desk. Signed by guard.',
    photo: fakePhotoData,
  }, driverCookie);

  assert(deliverRes.status === 200 || deliverRes.status === 201, `Driver delivered drop successfully (${deliverRes.status})`);
  assert(deliverRes.data.stage === 'DELIVERED', `Returned stage DELIVERED (got ${deliverRes.data.stage})`);
  assert(deliverRes.data.onTime === true, `onTime flag computed as true (delivered before future date, got ${deliverRes.data.onTime})`);
  assert(deliverRes.data.deliveredNote.includes('Delivered to reception desk'), 'Delivered note saved');

  // Verify Order 1 and Order 2 statuses are now DELIVERED
  const order1Delivered = await api('GET', `/orders/${order1Id}`, null, adminCookie);
  assert(order1Delivered.data.status === 'DELIVERED', `Order 1 status is DELIVERED (got ${order1Delivered.data.status})`);
  assert(order1Delivered.data.deliveredAt !== null, 'Order 1 deliveredAt timestamp set');

  const order2Delivered = await api('GET', `/orders/${order2Id}`, null, adminCookie);
  assert(order2Delivered.data.status === 'DELIVERED', `Order 2 status is DELIVERED (got ${order2Delivered.data.status})`);

  // Verify photo proof can be retrieved
  const photoRes = await fetch(`${BASE}/drops/${drop1.id}/photo`, {
    headers: { Cookie: driverCookie },
  });
  assert(photoRes.status === 200, `Photo endpoint returns 200 (${photoRes.status})`);
  assert(photoRes.headers.get('content-type')?.includes('image/'), 'Photo returns image content-type');

  // Verify delivering an already delivered drop returns 409
  const reDeliverAttempt = await api('POST', `/drops/${drop1.id}/deliver`, { note: 'Again' }, driverCookie);
  assert(reDeliverAttempt.status === 409, `Delivering already delivered drop returns 409 (${reDeliverAttempt.status})`);
  const reDeliverCode = reDeliverAttempt.data?.error?.code || reDeliverAttempt.data?.code;
  assert(reDeliverCode === 'DROP_ALREADY_DELIVERED', `Returned code DROP_ALREADY_DELIVERED (got ${reDeliverCode})`);

  // ─── Step 13: Final Driver Summary Verification ───────────────
  console.log('\n--- Step 13: Final Driver Summary Verification ---');
  const finalDriverView = await api('GET', `/driver/drops?date=${deliveryDate}`, null, driverCookie);
  assert(finalDriverView.data.summary.deliveredDrops >= 1, `Driver summary has at least 1 delivered drop (got ${finalDriverView.data.summary.deliveredDrops})`);
  const finalDrop1 = finalDriverView.data.drops.find(d => d.id === drop1.id);
  assert(finalDrop1.stage === 'DELIVERED', 'Drop 1 in driver view is DELIVERED');
  assert(finalDrop1.hasPhoto === true, 'Drop 1 hasPhoto is true');

  console.log('\n🎉 ALL PHASE 7 DISPATCH + DRIVER TESTS PASSED SUCCESSFULLY! 🎉\n');
}

main().catch((err) => {
  console.error('Unhandled error in test:', err);
  process.exit(1);
});
