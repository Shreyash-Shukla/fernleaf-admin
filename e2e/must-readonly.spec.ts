import { expect, test } from '@playwright/test';
import { json, listItems, loginViaApi, loginViaUi } from './support';

test.describe('Read-only Must requirements', () => {
  test.beforeEach(async ({ request }) => {
    await loginViaApi(request, 'admin');
  });

  test('@smoke health, timezone metadata, and realistic seeded master data', async ({ request }) => {
    const health = await request.get('/api/health');
    expect(health.ok()).toBeTruthy();

    const meta = await json<any>(await request.get('/api/meta'), 'load metadata');
    expect(meta.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(meta.nowIso).toBeTruthy();
    expect(meta.timezone).toBeTruthy();

    const companiesBody = await json<any>(await request.get('/api/companies?limit=100'), 'load companies');
    const companies = listItems(companiesBody);
    expect(companies.length).toBeGreaterThanOrEqual(2);

    const employeesBody = await json<any>(await request.get('/api/employees?limit=100'), 'load employees');
    const employees = listItems(employeesBody);
    expect(employees.length).toBeGreaterThanOrEqual(companies.length);

    const dishesBody = await json<any>(await request.get('/api/dishes?limit=100&active=true'), 'load dishes');
    expect(listItems(dishesBody).length).toBeGreaterThan(0);
  });

  test('@regression catalogue records expose required dish and option-group fields', async ({ request }) => {
    const body = await json<any>(await request.get('/api/dishes?limit=100'), 'load dishes');
    const dishes = listItems<any>(body);
    expect(dishes.length).toBeGreaterThan(0);

    for (const dish of dishes) {
      expect(dish.id).toBeTruthy();
      expect(dish.name).toBeTruthy();
      expect(dish.sku).toBeTruthy();
      expect(['HOT', 'COLD']).toContain(dish.temperature);
      expect(Number.isInteger(dish.costCents)).toBeTruthy();
    }

    const detail = await json<any>(await request.get(`/api/dishes/${dishes[0].id}`), 'load dish detail');
    expect(Array.isArray(detail.optionGroups)).toBeTruthy();
    for (const group of detail.optionGroups) {
      expect(typeof group.required).toBe('boolean');
      expect(Number.isInteger(group.sortOrder)).toBeTruthy();
      expect(Array.isArray(group.options)).toBeTruthy();
    }
  });

  test('@regression pricing tiers have one default and resolvable grids', async ({ request }) => {
    const tiers = await json<any[]>(await request.get('/api/pricing/tiers'), 'load pricing tiers');
    expect(tiers.length).toBeGreaterThanOrEqual(2);
    expect(tiers.filter((tier) => tier.isDefault)).toHaveLength(1);

    for (const tier of tiers) {
      const grid = await json<any>(
        await request.get(`/api/pricing/tiers/${tier.id}/grid?kind=dish&limit=100`),
        `load ${tier.name} grid`,
      );
      const rows = listItems<any>(grid, ['items', 'rows']);
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        const effective = row.effectivePriceCents ?? row.effectiveCents ?? row.priceCents;
        if (effective != null) expect(Number.isInteger(effective)).toBeTruthy();
      }
    }
  });

  test('@regression companies have employees, addresses, billing data, and unique domains', async ({ request }) => {
    const body = await json<any>(await request.get('/api/companies?limit=100'), 'load companies');
    const companies = listItems<any>(body);
    const allDomains: string[] = [];

    let completeCompanies = 0;
    for (const summary of companies) {
      const company = await json<any>(await request.get(`/api/companies/${summary.id}`), 'load company detail');
      expect(company.name).toBeTruthy();
      expect(company.billingName).toBeTruthy();
      expect(company.billingEmail).toMatch(/@/);
      expect(company.addresses.length, `${company.name} must have at least one delivery address`).toBeGreaterThan(0);
      expect(Array.isArray(company.workingDays)).toBeTruthy();
      for (const domain of company.domains ?? []) allDomains.push(String(domain.domain).toLowerCase());
      if (company.ownerEmployeeId) expect(company.owner?.companyId ?? company.id).toBe(company.id);
      if (company.employeeCount > 0 && company.ownerEmployeeId) completeCompanies++;
    }
    expect(completeCompanies, 'at least two seeded companies must have both employees and an owner').toBeGreaterThanOrEqual(2);
    expect(new Set(allDomains).size).toBe(allDomains.length);
  });

  test('@regression order list is server-paginated and filterable', async ({ request }) => {
    const first = await json<any>(await request.get('/api/orders?page=1&pageSize=2'), 'load first order page');
    expect(first.data.length).toBeLessThanOrEqual(2);
    expect(first.pagination.page).toBe(1);
    expect(first.pagination.pageSize).toBe(2);
    expect(first.pagination.total).toBeGreaterThan(0);

    const statuses = ['DRAFT', 'PLACED', 'CONFIRMED', 'DELIVERED', 'CANCELLED', 'REJECTED'];
    for (const status of statuses) {
      const filtered = await json<any>(
        await request.get(`/api/orders?status=${status}&pageSize=100`),
        `filter orders by ${status}`,
      );
      for (const order of filtered.data) expect(order.status).toBe(status);
    }
  });

  test('@regression today boards reconcile their summaries', async ({ request }) => {
    const meta = await json<any>(await request.get('/api/meta'), 'load metadata');
    const kitchen = await json<any>(await request.get(`/api/kitchen/board?date=${meta.today}`), 'load kitchen board');
    const dispatch = await json<any>(await request.get(`/api/dispatch/board?date=${meta.today}`), 'load dispatch board');

    expect(kitchen.summary.totalOrders).toBe(kitchen.orders.length);
    const kitchenMeals = kitchen.orders.flatMap((order: any) => order.units).reduce((sum: number, unit: any) => sum + unit.quantity, 0);
    expect(kitchen.summary.totalMeals).toBe(kitchenMeals);

    expect(dispatch.summary.totalDrops).toBe(dispatch.drops.length);
    expect(dispatch.drops.map((drop: any) => drop.deliveryTimeMin)).toEqual(
      [...dispatch.drops].map((drop: any) => drop.deliveryTimeMin).sort((a: number, b: number) => a - b),
    );
    for (const drop of dispatch.drops) {
      expect(drop.orderCount).toBe(drop.orders.length);
      expect(['PREPARING', 'KITCHEN_READY', 'DISPATCH_READY', 'OUT_FOR_DELIVERY', 'DELIVERED']).toContain(drop.stage);
    }
  });

  test('@regression driver receives only own, sorted drops with coherent progress', async ({ request }) => {
    await request.post('/api/auth/logout');
    await loginViaApi(request, 'driver');
    const meta = await json<any>(await request.get('/api/meta'), 'load metadata');
    const data = await json<any>(await request.get(`/api/driver/drops?date=${meta.today}`), 'load driver drops');

    expect(data.drops.length).toBeGreaterThanOrEqual(4);
    expect(data.summary.totalDrops).toBe(data.drops.length);
    expect(data.summary.deliveredDrops + data.summary.remainingDrops).toBe(data.summary.totalDrops);
    expect(data.drops.map((drop: any) => drop.deliveryTimeMin)).toEqual(
      [...data.drops].map((drop: any) => drop.deliveryTimeMin).sort((a: number, b: number) => a - b),
    );
  });

  test('@regression billing totals reconcile for every company', async ({ request }) => {
    const overview = await json<any[]>(await request.get('/api/billing/unbilled'), 'load unbilled overview');
    let overviewTotal = 0;
    for (const company of overview) {
      const detail = await json<any>(
        await request.get(`/api/billing/companies/${company.companyId}/unbilled`),
        'load company unbilled detail',
      );
      const orders = (detail.byDeliveryDate ?? []).flatMap((group: any) => group.orders ?? []);
      const orderTotal = orders.reduce((sum: number, order: any) => sum + order.totalCents, 0);
      const adjustmentTotal = (detail.openAdjustments ?? []).reduce((sum: number, item: any) => sum + item.amountCents, 0);
      expect(detail.totalCents).toBe(orderTotal);
      expect(detail.netUnbilledCents).toBe(orderTotal + adjustmentTotal);
      expect(company.netUnbilledCents).toBe(detail.netUnbilledCents);
      overviewTotal += company.netUnbilledCents;
    }
    expect(overviewTotal).toBe(overview.reduce((sum, company) => sum + company.netUnbilledCents, 0));
  });

  test('@smoke all role dashboards render meaningful headings and no application error', async ({ browser }) => {
    const cases = [
      ['admin', '/dashboard', /Operations|Dashboard/i],
      ['kitchen', '/kitchen', /Kitchen/i],
      ['dispatch', '/dispatch', /Dispatch/i],
      ['driver', '/driver', /Driver Deliveries/i],
    ] as const;

    for (const [role, route, heading] of cases) {
      const context = await browser.newContext();
      const page = await context.newPage();
      await loginViaUi(page, role);
      await page.goto(route);
      await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible();
      await expect(page.locator('body')).not.toContainText('Application error');
      await context.close();
    }
  });

  test('@smoke seeded companies, employees, and orders render in admin workflows', async ({ page }) => {
    await loginViaUi(page, 'admin');

    await page.goto('/companies');
    await expect(page.getByText('Nexus Tech Solutions').first()).toBeVisible();

    await page.goto('/employees');
    await expect(page.locator('tbody tr').first()).toBeVisible();
    await expect(page.locator('select').first()).toContainText('Nexus Tech Solutions');

    await page.goto('/orders');
    await expect(page.locator('tbody tr').first()).toBeVisible();
    await expect(page.locator('select').filter({ hasText: 'All Companies' })).toContainText('Nexus Tech Solutions');

    await page.goto('/orders/new');
    await expect(page.locator('select').first()).toContainText('Nexus Tech Solutions');
  });

  test('@regression driver view is usable at a phone viewport', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 360, height: 800 }, isMobile: true });
    const page = await context.newPage();
    await loginViaUi(page, 'driver');
    await expect(page.getByRole('heading', { name: 'Driver Deliveries' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBeTruthy();
    await context.close();
  });
});
