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

  console.log('\n=== Step 1: Reference Data (station, allergen, tag, portion size) ===');
  // Station
  let station = await request('/ref/stations', {
    method: 'POST',
    headers: authHeader,
    body: JSON.stringify({ name: 'Curry Station', sortOrder: 1 }),
  });
  if (station.status === 409) {
    const list = await request('/ref/stations', { headers: authHeader });
    station = { body: list.body.find((s) => s.name === 'Curry Station') };
  }
  console.log('Station:', station.body.id, station.body.name);

  // Allergen
  let allergen = await request('/ref/allergens', {
    method: 'POST',
    headers: authHeader,
    body: JSON.stringify({ name: 'Dairy' }),
  });
  if (allergen.status === 409) {
    const list = await request('/ref/allergens', { headers: authHeader });
    allergen = { body: list.body.find((a) => a.name === 'Dairy') };
  }
  console.log('Allergen:', allergen.body.id, allergen.body.name);

  // Dietary Tag
  let tag = await request('/ref/dietary-tags', {
    method: 'POST',
    headers: authHeader,
    body: JSON.stringify({ name: 'Vegetarian' }),
  });
  if (tag.status === 409) {
    const list = await request('/ref/dietary-tags', { headers: authHeader });
    tag = { body: list.body.find((t) => t.name === 'Vegetarian') };
  }
  console.log('Dietary Tag:', tag.body.id, tag.body.name);

  // Portion Size
  let portionSize = await request('/ref/portion-sizes', {
    method: 'POST',
    headers: authHeader,
    body: JSON.stringify({ name: 'Large', sortOrder: 1 }),
  });
  if (portionSize.status === 409) {
    const list = await request('/ref/portion-sizes', { headers: authHeader });
    portionSize = { body: list.body.find((p) => p.name === 'Large') };
  }
  console.log('Portion Size:', portionSize.body.id, portionSize.body.name);

  console.log('\n=== Step 2: Create Options ===');
  const optPaneer = await request('/options', {
    method: 'POST',
    headers: authHeader,
    body: JSON.stringify({
      name: 'Paneer Cubes',
      costCents: 150,
      allergenIds: [allergen.body.id],
      dietaryTagIds: [tag.body.id],
    }),
  });
  console.log('Created Option Paneer:', optPaneer.status, optPaneer.body.id, optPaneer.body.name);

  const optTofu = await request('/options', {
    method: 'POST',
    headers: authHeader,
    body: JSON.stringify({
      name: 'Organic Tofu',
      costCents: 120,
      dietaryTagIds: [tag.body.id],
    }),
  });
  console.log('Created Option Tofu:', optTofu.status, optTofu.body.id, optTofu.body.name);

  console.log('\n=== Step 3: Create Dish ===');
  const sku = `BOWL-${Date.now().toString().slice(-4)}`;
  const dish = await request('/dishes', {
    method: 'POST',
    headers: authHeader,
    body: JSON.stringify({
      sku,
      name: 'Signature Curry Bowl',
      description: 'Slow simmered rich curry with aromatic spices',
      temperature: 'HOT',
      costCents: 350,
      stationId: station.body.id,
      allergenIds: [allergen.body.id],
      dietaryTagIds: [tag.body.id],
      minOrderQty: 1,
    }),
  });
  console.log('Created Dish:', dish.status, dish.body.id, dish.body.sku, dish.body.name);
  if (dish.status !== 201) throw new Error(`Dish creation failed: ${JSON.stringify(dish.body)}`);

  console.log('\n=== Step 4: Create Option Group for Dish ===');
  const group = await request(`/dishes/${dish.body.id}/groups`, {
    method: 'POST',
    headers: authHeader,
    body: JSON.stringify({
      name: 'Choose Your Protein',
      required: true,
      sortOrder: 1,
      usesPortions: true,
      options: [
        { optionId: optPaneer.body.id, sortOrder: 0 },
        { optionId: optTofu.body.id, sortOrder: 1 },
      ],
      portions: [
        { portionSizeId: portionSize.body.id, extraCents: 75, sortOrder: 0 },
      ],
    }),
  });
  console.log('Created Group:', group.status, group.body.id, group.body.name, 'options count:', group.body.options?.length);
  if (group.status !== 201) throw new Error(`Group creation failed: ${JSON.stringify(group.body)}`);

  console.log('\n=== Step 5: Price Tiers (Standard, default, NONE) ===');
  const tierName = `Standard-${Date.now().toString().slice(-4)}`;
  const tier = await request('/pricing/tiers', {
    method: 'POST',
    headers: authHeader,
    body: JSON.stringify({
      name: tierName,
      isDefault: true,
      derivation: 'NONE',
    }),
  });
  console.log('Created Default Tier:', tier.status, tier.body.id, tier.body.name, 'isDefault:', tier.body.isDefault);
  if (tier.status !== 201) throw new Error(`Tier creation failed: ${JSON.stringify(tier.body)}`);

  console.log('\n=== Step 6: Set Prices via Tier Grid ===');
  const setGrid = await request(`/pricing/tiers/${tier.body.id}/grid`, {
    method: 'PUT',
    headers: authHeader,
    body: JSON.stringify([
      { id: dish.body.id, priceCents: 850 },
      { id: optPaneer.body.id, priceCents: 0 }, // $0 option surcharge
      { id: optTofu.body.id, priceCents: 50 },  // $0.50 option surcharge
    ]),
  });
  console.log('Set Grid Overrides Status:', setGrid.status, setGrid.body);

  const getGrid = await request(`/pricing/tiers/${tier.body.id}/grid?kind=dish`, {
    method: 'GET',
    headers: authHeader,
  });
  console.log('Grid Dishes Count:', getGrid.body.total);
  const dishGridRow = getGrid.body.items.find((i) => i.id === dish.body.id);
  console.log('Dish Grid Row:', dishGridRow);
  if (dishGridRow?.effectiveCents !== 850) {
    throw new Error(`Expected effective price 850, got ${dishGridRow?.effectiveCents}`);
  }

  console.log('\n=== Step 7: Create Derived Tier (COST_FACTOR × 2.0) ===');
  const derivedTierName = `CostPlus-${Date.now().toString().slice(-4)}`;
  const costTier = await request('/pricing/tiers', {
    method: 'POST',
    headers: authHeader,
    body: JSON.stringify({
      name: derivedTierName,
      isDefault: false,
      derivation: 'COST_FACTOR',
      factorBps: 20000, // 2.0x
    }),
  });
  console.log('Created Cost Tier:', costTier.status, costTier.body.id, costTier.body.name);

  const costGrid = await request(`/pricing/tiers/${costTier.body.id}/grid?kind=dish`, {
    method: 'GET',
    headers: authHeader,
  });
  const costDishRow = costGrid.body.items.find((i) => i.id === dish.body.id);
  console.log('Dish in Cost Tier (cost 350 × 2.0 = 700):', costDishRow);
  if (costDishRow?.effectiveCents !== 700) {
    throw new Error(`Expected effective price 700, got ${costDishRow?.effectiveCents}`);
  }

  console.log('\n=== Step 8: Menu Categories & Menu Items ===');
  const categorySlug = `bowls-${Date.now().toString().slice(-4)}`;
  const category = await request('/menu-categories', {
    method: 'POST',
    headers: authHeader,
    body: JSON.stringify({
      name: 'Hot Bowls',
      slug: categorySlug,
      sortOrder: 1,
      isSecret: false,
    }),
  });
  console.log('Created Menu Category:', category.status, category.body.id, category.body.slug);

  const menuItem = await request(`/menu-categories/${category.body.id}/items`, {
    method: 'POST',
    headers: authHeader,
    body: JSON.stringify({
      dishId: dish.body.id,
      sortOrder: 1,
    }),
  });
  console.log('Added Menu Item to Category:', menuItem.status, menuItem.body.id);

  console.log('\n=== Step 9: Setup Minimal Company & Employee for Menu Resolution ===');
  // Check if we can seed a test company & employee directly via DB or if endpoints exist
  // We can query menu preview directly using default tier first:
  const defaultPreview = await request('/menu/preview', {
    method: 'GET',
    headers: authHeader,
  });
  console.log('Default Preview Categories Count:', defaultPreview.body.categories?.length);
  const previewCat = defaultPreview.body.categories.find((c) => c.slug === categorySlug);
  console.log('Found category in preview:', !!previewCat, 'Items count:', previewCat?.items?.length);
  if (previewCat && previewCat.items.length > 0) {
    console.log('Preview item dish:', previewCat.items[0].dish.name, 'Price cents:', previewCat.items[0].dish.priceCents);
    console.log('Preview item option groups count:', previewCat.items[0].optionGroups.length);
    console.log('Group options:', previewCat.items[0].optionGroups[0]?.options?.map((o) => ({ name: o.name, price: o.priceCents })));
  }

  console.log('\n=== Step 10: Cycle Detection Check ===');
  const cycleAttempt = await request(`/pricing/tiers/${costTier.body.id}`, {
    method: 'PUT',
    headers: authHeader,
    body: JSON.stringify({
      derivation: 'TIER_FACTOR',
      baseTierId: costTier.body.id, // self-derivation
      factorBps: 10000,
    }),
  });
  console.log('Cycle attempt status (should be 400 Bad Request):', cycleAttempt.status, cycleAttempt.body);
  if (cycleAttempt.status !== 400) {
    throw new Error('Expected 400 for cycle attempt');
  }

  console.log('\n=== Step 11: Company Hiding Test ===');
  // Test with dummy company ID
  const testCompanyId = '00000000-0000-0000-0000-000000000001';
  const hideNonExistent = await request(`/companies/${testCompanyId}/hidden-categories`, {
    method: 'POST',
    headers: authHeader,
    body: JSON.stringify({ categoryId: category.body.id }),
  });
  console.log('Hide on non-existent company status (should be 404):', hideNonExistent.status);

  console.log('\n=== Step 12: Soft Delete Test ===');
  const deleteDishRes = await request(`/dishes/${dish.body.id}`, {
    method: 'DELETE',
    headers: authHeader,
  });
  console.log('Delete dish status:', deleteDishRes.status, 'active:', deleteDishRes.body.active);
  if (deleteDishRes.body.active !== false) {
    throw new Error('Dish was not deactivated');
  }

  console.log('\n🎉 ALL LIVE PHASE 3 TESTS PASSED PERFECTLY!');
}

run().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
