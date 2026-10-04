/**
 * Phase 8 Test Script — Billing Operations
 * 
 * Run: node test_phase8.js
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

function getFutureDeliveryDate(daysAhead = 7) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

async function main() {
  console.log('\n🚀 Phase 8 Test: Billing Operations\n');
  const deliveryDate = getFutureDeliveryDate(7);
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

  const kitchenLogin = await api('POST', '/auth/login', {
    email: 'kitchen@test.com',
    password: 'Test@1234',
  });
  assert(kitchenLogin.status === 200 || kitchenLogin.status === 201, 'Kitchen login');
  const kitchenCookie = kitchenLogin.cookie;

  const driverLogin = await api('POST', '/auth/login', {
    email: 'driver@test.com',
    password: 'Test@1234',
  });
  assert(driverLogin.status === 200 || driverLogin.status === 201, 'Driver login');
  const driverCookie = driverLogin.cookie;

  const dispatchLogin = await api('POST', '/auth/login', {
    email: 'dispatch@test.com',
    password: 'Test@1234',
  });
  assert(dispatchLogin.status === 200 || dispatchLogin.status === 201, 'Dispatch login');
  const dispatchCookie = dispatchLogin.cookie;

  // ─── Step 2: Role Permission & Guard Scoping ─────────────────
  console.log('\n--- Step 2: Role Permission & Guard Scoping ---');
  const kitchenBilling = await api('GET', '/billing/companies/any/unbilled', null, kitchenCookie);
  assert(kitchenBilling.status === 403, 'Kitchen accessing /billing/... returns 403');

  const driverInvoices = await api('GET', '/invoices', null, driverCookie);
  assert(driverInvoices.status === 403, 'Driver accessing /invoices returns 403');

  const dispatchCreateInvoice = await api('POST', '/invoices', { companyId: 'dummy', orderIds: [] }, dispatchCookie);
  assert(dispatchCreateInvoice.status === 403, 'Dispatch attempting to create invoice returns 403');

  // ─── Step 3: Setup Test Orders & Cut-off Confirmation ────────
  console.log('\n--- Step 3: Setup Test Orders & Cut-off Confirmation ---');
  const rand = Math.floor(Math.random() * 1000000);
  const dishSku = `DISH-BIL-${rand}`;

  const dishRes = await api('POST', '/dishes', {
    sku: dishSku,
    name: `Billing Deluxe Plate ${rand}`,
    description: 'A great dish for billing tests',
    temperature: 'HOT',
    costCents: 800,
    priceCents: 1500,
  }, adminCookie);
  assert(dishRes.status === 201, `Dish created (${dishRes.status})`);
  const dishId = dishRes.data.id;

  const optRes = await api('POST', '/options', {
    name: `Extra Sauce ${rand}`,
    costCents: 50,
    priceCents: 200,
  }, adminCookie);
  assert(optRes.status === 201, 'Option created');
  const optionId = optRes.data.id;

  const grpRes = await api('POST', `/dishes/${dishId}/groups`, {
    name: 'Sauce Selection',
    required: true,
    sortOrder: 1,
    usesPortions: false,
    options: [{ optionId, sortOrder: 0 }],
  }, adminCookie);
  assert(grpRes.status === 201 || grpRes.status === 200, 'Option group created');

  // Set price tier
  const tiersRes = await api('GET', '/pricing/tiers', null, adminCookie);
  const tiersList = tiersRes.data?.tiers || tiersRes.data;
  let standardTier = tiersList.find(t => t.name === 'Standard') || tiersList.find(t => t.isDefault) || tiersList[0];
  const tierId = standardTier.id;

  await api('PUT', `/pricing/tiers/${tierId}/grid`, [
    { id: dishId, priceCents: 1500 },
  ], adminCookie);
  await api('PUT', `/pricing/tiers/${tierId}/grid?kind=option`, [
    { id: optionId, priceCents: 200 },
  ], adminCookie);

  // Activate dish on menu
  const catRes = await api('POST', '/menu-categories', {
    name: `Mains ${rand}`,
    slug: `mains-${rand}`,
    sortOrder: 0,
  }, adminCookie);
  const categoryId = catRes.data?.id;
  await api('POST', `/menu-categories/${categoryId}/items`, {
    dishId,
    sortOrder: 0,
  }, adminCookie);

  const compRes = await api('POST', '/companies', {
    name: `Billing Test Co ${rand}`,
    billingName: `Billing Co ${rand} Inc`,
    billingEmail: `billing-${rand}@testco.com`,
    billingAddress: '456 Corporate Ave, Floor 10',
    domains: [`billing-${rand}.com`],
    address: {
      label: 'HQ Main Lobby',
      line1: '456 Corporate Ave',
      city: 'Kolkata',
      postcode: '700001',
    },
  }, adminCookie);
  assert(compRes.status === 201, 'Company created');
  const companyId = compRes.data.id;
  const addrRes = await api('GET', `/companies/${companyId}/addresses`, null, adminCookie);
  const addressId = addrRes.data[0].id;

  const groupId = grpRes.data.id;

  const emp1Res = await api('POST', `/companies/${companyId}/employees`, {
    name: `Carol Danvers ${rand}`,
    email: `carol@billing-${rand}.com`,
  }, adminCookie);
  assert(emp1Res.status === 201, 'Employee 1 created');
  const emp1Id = emp1Res.data.id;

  const emp2Res = await api('POST', `/companies/${companyId}/employees`, {
    name: `Dave Bowman ${rand}`,
    email: `dave@billing-${rand}.com`,
  }, adminCookie);
  assert(emp2Res.status === 201, 'Employee 2 created');
  const emp2Id = emp2Res.data.id;

  // Order 1: 1 meal ($17.00 = $15 + $2)
  const o1Body = {
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
  const o1Draft = await api('POST', '/orders', o1Body, adminCookie);
  assert(o1Draft.status === 201, 'Order 1 draft created');
  const o1Id = o1Draft.data.id;
  const o1Place = await api('POST', `/orders/${o1Id}/place`, o1Body, adminCookie);
  assert(o1Place.status === 200 || o1Place.status === 201, 'Order 1 placed');
  const order1Total = o1Place.data.totalCents;
  assert(order1Total > 0, `Order 1 total calculated (${order1Total} cents)`);

  // Order 2: 2 meals ($34.00 = 2 * ($15 + $2))
  const o2Body = {
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
  const o2Draft = await api('POST', '/orders', o2Body, adminCookie);
  assert(o2Draft.status === 201, 'Order 2 draft created');
  const o2Id = o2Draft.data.id;
  const o2Place = await api('POST', `/orders/${o2Id}/place`, o2Body, adminCookie);
  assert(o2Place.status === 200 || o2Place.status === 201, 'Order 2 placed');
  const order2Total = o2Place.data.totalCents;

  // Order 3: 1 meal ($17.00)
  const o3Body = {
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
  const o3Draft = await api('POST', '/orders', o3Body, adminCookie);
  assert(o3Draft.status === 201, 'Order 3 draft created');
  const o3Id = o3Draft.data.id;
  const o3Place = await api('POST', `/orders/${o3Id}/place`, o3Body, adminCookie);
  assert(o3Place.status === 200 || o3Place.status === 201, 'Order 3 placed');
  const order3Total = o3Place.data.totalCents;

  // Run cutoff to confirm placed orders
  const cutoffRes = await api('POST', '/cutoff/run', { date: deliveryDate, force: true }, adminCookie);
  assert(cutoffRes.status === 200 || cutoffRes.status === 201, 'Cut-off triggered');

  // Verify orders are CONFIRMED
  const o1Check = await api('GET', `/orders/${o1Id}`, null, adminCookie);
  assert(o1Check.data.status === 'CONFIRMED', 'Order 1 status is CONFIRMED');
  const o2Check = await api('GET', `/orders/${o2Id}`, null, adminCookie);
  assert(o2Check.data.status === 'CONFIRMED', 'Order 2 status is CONFIRMED');
  const o3Check = await api('GET', `/orders/${o3Id}`, null, adminCookie);
  assert(o3Check.data.status === 'CONFIRMED', 'Order 3 status is CONFIRMED');

  // ─── Step 4: Query Unbilled Orders ────────────────────────────
  console.log('\n--- Step 4: Query Unbilled Orders ---');
  const unbilledRes = await api('GET', `/billing/companies/${companyId}/unbilled`, null, adminCookie);
  assert(unbilledRes.status === 200, `Unbilled endpoint returns 200 (${unbilledRes.status})`);
  assert(unbilledRes.data.companyId === companyId, 'Company ID matches');
  assert(unbilledRes.data.orderCount === 3, `Has 3 unbilled orders (got ${unbilledRes.data.orderCount})`);
  assert(unbilledRes.data.mealsCount === 4, `Has 4 total meals (1 + 2 + 1 = 4, got ${unbilledRes.data.mealsCount})`);
  const expectedTotal = order1Total + order2Total + order3Total;
  assert(unbilledRes.data.totalCents === expectedTotal, `Total cents matches sum of orders (${expectedTotal})`);
  assert(unbilledRes.data.byDeliveryDate.length >= 1, 'Grouped by delivery date');
  assert(unbilledRes.data.openAdjustments.length === 0, 'No open adjustments yet');
  assert(unbilledRes.data.netUnbilledCents === expectedTotal, 'Net unbilled equals totalCents');

  // ─── Step 5: Prerequisite Enforcement on Invoice Creation ────
  console.log('\n--- Step 5: Prerequisite Enforcement on Invoice Creation ---');
  // 1. Empty orderIds
  const emptyRes = await api('POST', '/invoices', { companyId, orderIds: [] }, adminCookie);
  assert(emptyRes.status === 400, 'Empty orderIds returns 400 Bad Request');

  // 2. Draft order (not billable)
  const draftOnly = await api('POST', '/orders', {
    employeeId: emp1Id,
    deliveryDate,
    deliveryTimeMin: 720,
    addressId,
    packaging: 'STANDARD',
    lines: [{ dishId, quantity: 1, combinations: [{ quantity: 1, selections: [{ groupId, optionId }] }] }],
  }, adminCookie);
  const unbillableRes = await api('POST', '/invoices', {
    companyId,
    orderIds: [draftOnly.data.id],
  }, adminCookie);
  assert(unbillableRes.status === 409, 'Invoicing DRAFT order returns 409 Conflict');
  assert(unbillableRes.data?.error?.code === 'ORDERS_NOT_BILLABLE', 'Returned code ORDERS_NOT_BILLABLE');

  // 3. Different company order
  const otherComp = await api('POST', '/companies', {
    name: `Other Co ${rand}`,
    billingName: 'Other Co Inc',
    billingEmail: `other-${rand}@test.com`,
    billingAddress: '999 Other Rd',
    domains: [`other-${rand}.com`],
  }, adminCookie);
  const otherCompRes = await api('POST', '/invoices', {
    companyId: otherComp.data.id,
    orderIds: [o1Id],
  }, adminCookie);
  assert(otherCompRes.status === 409, 'Invoicing order belonging to another company returns 409 Conflict');

  // ─── Step 6: Create Invoice for Order 1 and Order 2 ───────────
  console.log('\n--- Step 6: Create Invoice for Order 1 and Order 2 ---');
  const createInvRes = await api('POST', '/invoices', {
    companyId,
    orderIds: [o1Id, o2Id],
  }, adminCookie);
  assert(createInvRes.status === 201, `Invoice created successfully (${createInvRes.status})`);
  const inv = createInvRes.data;
  assert(inv.id, 'Invoice has ID');
  assert(inv.number.startsWith('INV-'), `Invoice number formatted correctly (${inv.number})`);
  assert(inv.status === 'ISSUED', 'Invoice status is ISSUED');
  const expectedInv1Total = order1Total + order2Total;
  assert(inv.totalCents === expectedInv1Total, `Invoice total equals sum of order totals (${inv.totalCents} == ${expectedInv1Total})`);
  assert(inv.items.length === 2, `Invoice has 2 items (got ${inv.items.length})`);
  assert(inv.orders.length === 2, `Invoice includes 2 orders (got ${inv.orders.length})`);
  const invoice1Id = inv.id;

  // ─── Step 7: Double Invoicing Prevention ──────────────────────
  console.log('\n--- Step 7: Double Invoicing Prevention ---');
  const doubleInvRes = await api('POST', '/invoices', {
    companyId,
    orderIds: [o1Id],
  }, adminCookie);
  assert(doubleInvRes.status === 409, 'Invoicing already invoiced order returns 409 Conflict');
  assert(doubleInvRes.data?.error?.code === 'ORDER_ALREADY_INVOICED', 'Returned code ORDER_ALREADY_INVOICED');

  // ─── Step 8: Unbilled Orders Updated ──────────────────────────
  console.log('\n--- Step 8: Unbilled Orders Updated ---');
  const unbilledAfter = await api('GET', `/billing/companies/${companyId}/unbilled`, null, adminCookie);
  assert(unbilledAfter.status === 200, 'Unbilled query succeeds');
  assert(unbilledAfter.data.orderCount === 1, `Now has exactly 1 unbilled order remaining (got ${unbilledAfter.data.orderCount})`);
  assert(unbilledAfter.data.totalCents === order3Total, `Unbilled total is now Order 3 total (${unbilledAfter.data.totalCents} == ${order3Total})`);
  const unbilledOrderIds = unbilledAfter.data.byDeliveryDate.flatMap(g => g.orders.map(o => o.id));
  assert(!unbilledOrderIds.includes(o1Id), 'Order 1 is no longer in unbilled');
  assert(!unbilledOrderIds.includes(o2Id), 'Order 2 is no longer in unbilled');
  assert(unbilledOrderIds.includes(o3Id), 'Order 3 is still unbilled');

  // ─── Step 9: Invoice Detail & List Queries ────────────────────
  console.log('\n--- Step 9: Invoice Detail & List Queries ---');
  const detailRes = await api('GET', `/invoices/${invoice1Id}`, null, adminCookie);
  assert(detailRes.status === 200, 'Get invoice detail returns 200');
  assert(detailRes.data.number === inv.number, 'Invoice number matches');
  assert(detailRes.data.company.name === `Billing Test Co ${rand}`, 'Invoice company name matches');
  assert(detailRes.data.totalCents === expectedInv1Total, 'Invoice detail total matches');
  assert(detailRes.data.items.length === 2, 'Invoice items present');

  const listRes = await api('GET', `/invoices?companyId=${companyId}`, null, adminCookie);
  assert(listRes.status === 200, 'List invoices returns 200');
  assert(listRes.data.items.some(i => i.id === invoice1Id), 'Created invoice is in invoices list');

  const issuedList = await api('GET', `/invoices?companyId=${companyId}&status=ISSUED`, null, adminCookie);
  assert(issuedList.data.items.some(i => i.id === invoice1Id), 'Found in status=ISSUED list');

  const paidListBefore = await api('GET', `/invoices?companyId=${companyId}&status=PAID`, null, adminCookie);
  assert(!paidListBefore.data.items.some(i => i.id === invoice1Id), 'Not in status=PAID list before payment');

  // ─── Step 10: Mark Invoice Paid ───────────────────────────────
  console.log('\n--- Step 10: Mark Invoice Paid ---');
  const payRes = await api('POST', `/invoices/${invoice1Id}/pay`, null, adminCookie);
  assert(payRes.status === 200 || payRes.status === 201, `Invoice marked paid (${payRes.status})`);
  assert(payRes.data.status === 'PAID', 'Invoice status is now PAID');
  assert(payRes.data.paidAt, 'Invoice paidAt timestamp is set');

  const repeatPay = await api('POST', `/invoices/${invoice1Id}/pay`, null, adminCookie);
  assert(repeatPay.status === 409, 'Paying already paid invoice returns 409 Conflict');
  assert(repeatPay.data?.error?.code === 'INVOICE_ALREADY_PAID', 'Returned code INVOICE_ALREADY_PAID');

  // ─── Step 11: Cancellation After Invoice Creates Adjustment ───
  console.log('\n--- Step 11: Cancellation After Invoice Creates Adjustment ---');
  // Admin cancels Order 1 (which was invoiced on the paid invoice)
  const cancelRes = await api('POST', `/orders/${o1Id}/cancel`, {
    reason: 'Customer reported severe billing error',
  }, adminCookie);
  assert(cancelRes.status === 200 || cancelRes.status === 201, 'Order 1 cancelled');
  assert(cancelRes.data.status === 'CANCELLED', 'Order 1 status is CANCELLED');

  // Check adjustments for this company
  const adjListRes = await api('GET', `/adjustments?companyId=${companyId}`, null, adminCookie);
  assert(adjListRes.status === 200, 'Adjustments list returns 200');
  assert(adjListRes.data.length >= 1, `Found adjustment records (got ${adjListRes.data.length})`);
  const cancelAdj = adjListRes.data.find(a => a.orderId === o1Id);
  assert(cancelAdj, 'Found adjustment for Order 1');
  assert(cancelAdj.reason === 'CANCELLED_AFTER_INVOICE', 'Adjustment reason is CANCELLED_AFTER_INVOICE');
  assert(cancelAdj.amountCents === -order1Total, `Adjustment amount is negative order total (${cancelAdj.amountCents} == -${order1Total})`);
  assert(cancelAdj.status === 'OPEN', 'Adjustment status is OPEN');

  // ─── Step 12: Unbilled Orders Reflects Open Adjustment ─────────
  console.log('\n--- Step 12: Unbilled Orders Reflects Open Adjustment ---');
  const unbilledWithAdj = await api('GET', `/billing/companies/${companyId}/unbilled`, null, adminCookie);
  assert(unbilledWithAdj.status === 200, 'Unbilled query returns 200');
  assert(unbilledWithAdj.data.openAdjustments.length >= 1, 'Open adjustments listed in unbilled response');
  assert(unbilledWithAdj.data.adjustmentsTotalCents === -order1Total, `Adjustments total is negative order1 total (${unbilledWithAdj.data.adjustmentsTotalCents})`);
  const expectedNet = order3Total - order1Total;
  assert(unbilledWithAdj.data.netUnbilledCents === expectedNet, `Net unbilled is order3 total minus adjustment (${unbilledWithAdj.data.netUnbilledCents} == ${expectedNet})`);

  // ─── Step 13: Next Invoice Reconciles Order + Adjustment ───────
  console.log('\n--- Step 13: Next Invoice Reconciles Order + Adjustment ---');
  const createInv2Res = await api('POST', '/invoices', {
    companyId,
    orderIds: [o3Id],
    adjustmentIds: [cancelAdj.id],
  }, adminCookie);
  assert(createInv2Res.status === 201, `Second invoice created (${createInv2Res.status})`);
  const inv2 = createInv2Res.data;
  assert(inv2.items.length === 2, 'Invoice 2 has 2 items (1 order + 1 adjustment)');
  const orderItem = inv2.items.find(i => i.kind === 'ORDER');
  const adjItem = inv2.items.find(i => i.kind === 'ADJUSTMENT');
  assert(orderItem && orderItem.amountCents === order3Total, 'Order item amount matches Order 3 total');
  assert(adjItem && adjItem.amountCents === -order1Total, 'Adjustment item amount matches credit');
  const expectedInv2Total = order3Total - order1Total;
  assert(inv2.totalCents === expectedInv2Total, `Invoice 2 total reconciles order + adjustment (${inv2.totalCents} == ${expectedInv2Total})`);

  // Verify adjustment flipped to INVOICED
  const adjDetail = await api('GET', `/adjustments/${cancelAdj.id}`, null, adminCookie);
  assert(adjDetail.status === 200, 'Get adjustment detail returns 200');
  assert(adjDetail.data.status === 'INVOICED', 'Adjustment status is now INVOICED');

  // Verify unbilled now has 0 orders and 0 open adjustments
  const finalUnbilled = await api('GET', `/billing/companies/${companyId}/unbilled`, null, adminCookie);
  assert(finalUnbilled.data.orderCount === 0, '0 unbilled orders remaining');
  assert(finalUnbilled.data.openAdjustments.length === 0, '0 open adjustments remaining');
  assert(finalUnbilled.data.totalCents === 0, 'totalCents is 0');
  assert(finalUnbilled.data.netUnbilledCents === 0, 'netUnbilledCents is 0');

  // ─── Step 14: Manual Short-Delivery Adjustment ─────────────────
  console.log('\n--- Step 14: Manual Short-Delivery Adjustment ---');
  const manualAdj = await api('POST', '/adjustments', {
    companyId,
    orderId: o2Id,
    reason: 'SHORT_DELIVERY',
    amountCents: -500,
    note: 'One drink missing on delivery',
  }, adminCookie);
  assert(manualAdj.status === 201, 'Manual adjustment created');
  assert(manualAdj.data.amountCents === -500, 'Adjustment amount is -500');
  assert(manualAdj.data.reason === 'SHORT_DELIVERY', 'Reason is SHORT_DELIVERY');
  assert(manualAdj.data.status === 'OPEN', 'Status is OPEN');

  const checkManual = await api('GET', `/adjustments/${manualAdj.data.id}`, null, adminCookie);
  assert(checkManual.status === 200, 'Fetched manual adjustment');
  assert(checkManual.data.note === 'One drink missing on delivery', 'Note preserved');

  console.log('\n🎉 ALL PHASE 8 BILLING TESTS PASSED SUCCESSFULLY! 🎉\n');
}

main().catch((err) => {
  console.error('\n❌ Uncaught error during Phase 8 test:', err);
  process.exit(1);
});
