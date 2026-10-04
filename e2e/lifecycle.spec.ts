import { expect, test } from '@playwright/test';
import { json, loginViaApi, mutationsEnabled, reseedEnabled } from './support';

test.describe.serial('Destructive end-to-end lifecycle', () => {
  test.skip(!mutationsEnabled, 'Set E2E_ALLOW_MUTATIONS=1 to run state-changing live tests.');

  test('@regression cut-off → kitchen → dispatch → driver → billing lifecycle', async ({ request, playwright }) => {
    test.setTimeout(300_000);
    await loginViaApi(request, 'admin');

    if (reseedEnabled) {
      const reseed = await request.post('/api/admin/reseed', { timeout: 240_000 });
      expect(reseed.ok(), await reseed.text()).toBeTruthy();
    }

    const settings = await json<any>(await request.get('/api/settings'), 'load settings');
    const heldDate = settings.cutoffHoldDates?.[0];
    expect(heldDate, 'Seed data must provide a future held cut-off date').toBeTruthy();

    const before = await json<any>(
      await request.get(`/api/orders?from=${heldDate}&to=${heldDate}&pageSize=100`),
      'load held-date orders',
    );
    const draftCount = before.data.filter((order: any) => order.status === 'DRAFT').length;
    const placedCount = before.data.filter((order: any) => order.status === 'PLACED').length;
    expect(draftCount).toBeGreaterThan(0);
    expect(placedCount).toBeGreaterThan(0);

    const firstCutoff = await json<any>(
      await request.post('/api/cutoff/run', { data: { date: heldDate, force: true } }),
      'run cut-off',
    );
    expect(firstCutoff.draftsCancelled).toBe(draftCount);
    expect(firstCutoff.ordersConfirmed).toBe(placedCount);

    const secondCutoff = await json<any>(
      await request.post('/api/cutoff/run', { data: { date: heldDate, force: true } }),
      'repeat cut-off',
    );
    expect(secondCutoff.draftsCancelled).toBe(0);
    expect(secondCutoff.ordersConfirmed).toBe(0);

    const after = await json<any>(
      await request.get(`/api/orders?from=${heldDate}&to=${heldDate}&pageSize=100`),
      'reload held-date orders',
    );
    expect(after.data.filter((order: any) => order.status === 'CANCELLED')).toHaveLength(draftCount);
    expect(after.data.filter((order: any) => order.status === 'CONFIRMED')).toHaveLength(placedCount);

    const board = await json<any>(await request.get(`/api/kitchen/board?date=${heldDate}`), 'load kitchen board');
    expect(board.orders.length).toBeGreaterThan(0);
    const targetOrder = board.orders[0];

    const kitchen = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL as string });
    await loginViaApi(kitchen, 'kitchen');
    const units = targetOrder.units as any[];
    expect(units.length).toBeGreaterThan(0);

    const firstUnit = units[0];
    const simultaneous = await Promise.all([
      kitchen.post(`/api/kitchen/units/${firstUnit.id}/done`),
      kitchen.post(`/api/kitchen/units/${firstUnit.id}/done`),
    ]);
    expect(simultaneous.filter((response) => response.ok())).toHaveLength(1);

    for (const unit of units.slice(1)) {
      const done = await kitchen.post(`/api/kitchen/units/${unit.id}/done`);
      expect(done.ok(), await done.text()).toBeTruthy();
    }

    const finishedOrder = await json<any>(await request.get(`/api/orders/${targetOrder.id}`), 'load kitchen-complete order');
    expect(finishedOrder.kitchenStartedAt).toBeTruthy();
    expect(finishedOrder.kitchenReadyAt).toBeTruthy();

    const dispatch = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL as string });
    await loginViaApi(dispatch, 'dispatch');
    let dispatchBoard = await json<any>(await dispatch.get(`/api/dispatch/board?date=${heldDate}`), 'load dispatch board');
    const targetDrop = dispatchBoard.drops.find((drop: any) => drop.orders.some((order: any) => order.id === targetOrder.id));
    expect(targetDrop).toBeTruthy();

    for (const order of targetDrop.orders) {
      if (!order.kitchenReadyAt) {
        const force = await request.post(`/api/kitchen/orders/${order.id}/force-complete`);
        expect(force.ok(), await force.text()).toBeTruthy();
      }
    }

    const staff = await json<any[]>(await request.get('/api/staff'), 'load staff');
    const driver = staff.find((user) => user.email === 'driver@test.com');
    expect(driver).toBeTruthy();

    expect((await dispatch.post(`/api/drops/${targetDrop.id}/assign-driver`, { data: { driverId: driver.id } })).ok()).toBeTruthy();
    expect((await dispatch.post(`/api/drops/${targetDrop.id}/dispatch-ready`)).ok()).toBeTruthy();
    expect((await dispatch.post(`/api/drops/${targetDrop.id}/out-for-delivery`)).ok()).toBeTruthy();
    expect((await dispatch.post(`/api/drops/${targetDrop.id}/out-for-delivery`)).ok()).toBeFalsy();

    const driverApi = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL as string });
    await loginViaApi(driverApi, 'driver');
    const delivered = await json<any>(
      await driverApi.post(`/api/drops/${targetDrop.id}/deliver`, {
        data: { note: 'Automated E2E delivery', photo: 'data:image/png;base64,iVBORw0KGgo=' },
      }),
      'deliver drop',
    );
    expect(delivered.deliveredAt).toBeTruthy();
    expect((await driverApi.post(`/api/drops/${targetDrop.id}/deliver`, { data: {} })).ok()).toBeFalsy();

    const deliveredOrder = await json<any>(await request.get(`/api/orders/${targetOrder.id}`), 'load delivered order');
    expect(deliveredOrder.status).toBe('DELIVERED');

    const unbilled = await json<any>(
      await request.get(`/api/billing/companies/${deliveredOrder.companyId}/unbilled`),
      'load unbilled orders',
    );
    const eligible = (unbilled.byDeliveryDate ?? []).flatMap((group: any) => group.orders ?? []);
    expect(eligible.some((order: any) => order.id === deliveredOrder.id)).toBeTruthy();

    const invoice = await json<any>(
      await request.post('/api/billing/invoices', {
        data: {
          companyId: deliveredOrder.companyId,
          orderIds: [deliveredOrder.id],
          adjustmentIds: [],
        },
      }),
      'create invoice',
    );
    expect(invoice.totalCents).toBe(deliveredOrder.totalCents);

    const duplicateInvoice = await request.post('/api/billing/invoices', {
      data: { companyId: deliveredOrder.companyId, orderIds: [deliveredOrder.id], adjustmentIds: [] },
    });
    expect(duplicateInvoice.status()).toBe(409);

    const paid = await json<any>(await request.post(`/api/billing/invoices/${invoice.id}/pay`), 'pay invoice');
    expect(paid.status).toBe('PAID');

    await Promise.all([kitchen.dispose(), dispatch.dispose(), driverApi.dispose()]);
  });
});
