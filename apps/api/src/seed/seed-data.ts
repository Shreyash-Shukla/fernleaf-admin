// ─── Seed Data Definitions ───────────────────────────────────────────

export const SEED_ROLES = [
  {
    key: 'admin',
    name: 'Admin',
    permissions: ['*'],
    landingPath: '/dashboard',
    dashboardKey: 'admin',
    isSystem: true,
  },
  {
    key: 'kitchen',
    name: 'Kitchen',
    permissions: ['kitchen:read', 'kitchen:work', 'orders:read', 'catalogue:read'],
    landingPath: '/kitchen',
    dashboardKey: 'kitchen',
    isSystem: true,
  },
  {
    key: 'dispatch',
    name: 'Dispatch',
    permissions: [
      'dispatch:read',
      'dispatch:work',
      'kitchen:read',
      'orders:read',
      'companies:read',
      'deliveries:read_any',
    ],
    landingPath: '/dispatch',
    dashboardKey: 'dispatch',
    isSystem: true,
  },
  {
    key: 'driver',
    name: 'Driver',
    permissions: ['deliveries:read_own', 'deliveries:deliver'],
    landingPath: '/driver',
    dashboardKey: 'driver',
    isSystem: true,
  },
];

export const SEED_USERS = [
  { email: 'admin@test.com', name: 'Admin', roleKey: 'admin' },
  { email: 'kitchen@test.com', name: 'Kitchen', roleKey: 'kitchen' },
  { email: 'dispatch@test.com', name: 'Dispatch', roleKey: 'dispatch' },
  { email: 'driver@test.com', name: 'Driver', roleKey: 'driver' },
];

export const DEFAULT_PASSWORD = 'Test@1234';

export const ALLERGENS = [
  'Gluten',
  'Dairy',
  'Tree Nuts',
  'Soy',
  'Egg',
  'Sesame',
  'Mustard',
  'Fish',
  'Shellfish',
  'Peanuts',
  'Celery',
  'Lupin',
  'Molluscs',
  'Sulphites',
];

export const DIETARY_TAGS = [
  'Vegan',
  'Vegetarian',
  'Jain',
  'Gluten-free',
  'Dairy-free',
  'Halal',
];

export const KITCHEN_STATIONS = [
  { name: 'Hot Line', sortOrder: 1 },
  { name: 'Cold Prep', sortOrder: 2 },
  { name: 'Bakery', sortOrder: 3 },
  { name: 'Grill', sortOrder: 4 },
];

export const PORTION_SIZES = [
  { name: 'Regular', sortOrder: 1 },
  { name: 'Large', sortOrder: 2 },
];

export const MENU_CATEGORIES = [
  { name: 'Bowls', slug: 'bowls', sortOrder: 1, isSecret: false },
  { name: 'Breakfast', slug: 'breakfast', sortOrder: 2, isSecret: false },
  { name: 'Wraps', slug: 'wraps', sortOrder: 3, isSecret: false },
  { name: 'Desserts', slug: 'desserts', sortOrder: 4, isSecret: false },
  { name: "Chef's Table", slug: 'chefs-table', sortOrder: 5, isSecret: true },
];

export interface OptionDef {
  name: string;
  costCents: number;
  standardPriceCents: number;
}

export const SEED_OPTIONS: OptionDef[] = [
  // Proteins
  { name: 'Grilled Herb Chicken', costCents: 120, standardPriceCents: 0 },
  { name: 'Organic Crispy Tofu', costCents: 90, standardPriceCents: 0 },
  { name: 'Seared Atlantic Salmon', costCents: 250, standardPriceCents: 300 },
  { name: 'Marinated Flank Steak', costCents: 220, standardPriceCents: 250 },
  { name: 'Crispy Spiced Falafel', costCents: 80, standardPriceCents: 0 },
  { name: 'Garlic Butter Shrimp', costCents: 260, standardPriceCents: 350 },
  // Bases & Grains
  { name: 'Organic Brown Rice', costCents: 40, standardPriceCents: 0 },
  { name: 'Jasmine Steamed Rice', costCents: 30, standardPriceCents: 0 },
  { name: 'Tri-Color Quinoa', costCents: 60, standardPriceCents: 100 },
  { name: 'Cauliflower Rice', costCents: 80, standardPriceCents: 150 },
  { name: 'Fresh Spring Greens', costCents: 40, standardPriceCents: 0 },
  // Sauces & Dressings
  { name: 'House Teriyaki Glaze', costCents: 30, standardPriceCents: 0 },
  { name: 'Spicy Sriracha Mayo', costCents: 35, standardPriceCents: 50 },
  { name: 'Creamy Tahini Garlic', costCents: 35, standardPriceCents: 50 },
  { name: 'Fresh Chimichurri', costCents: 40, standardPriceCents: 50 },
  { name: 'Sweet Thai Chili', costCents: 30, standardPriceCents: 0 },
  { name: 'Lemon Herb Vinaigrette', costCents: 30, standardPriceCents: 0 },
  // Sides (used in Portioned group)
  { name: 'Steamed Edamame with Sea Salt', costCents: 60, standardPriceCents: 150 },
  { name: 'Sweet Potato Fries', costCents: 80, standardPriceCents: 200 },
  { name: 'Garlic Steamed Broccoli', costCents: 50, standardPriceCents: 120 },
  { name: 'Artisanal Kimchi', costCents: 60, standardPriceCents: 100 },
  { name: 'Fresh Seasonal Fruit Cup', costCents: 70, standardPriceCents: 180 },
  // Breads & Wraps
  { name: 'Artisan Sourdough', costCents: 30, standardPriceCents: 0 },
  { name: 'Brioche Roll', costCents: 40, standardPriceCents: 50 },
  { name: 'Gluten-Free Toast', costCents: 50, standardPriceCents: 100 },
  { name: 'Spinach Herb Wrap', costCents: 35, standardPriceCents: 0 },
  // Egg Styles
  { name: 'Two Poached Eggs', costCents: 60, standardPriceCents: 0 },
  { name: 'Scrambled Free-Range Eggs', costCents: 60, standardPriceCents: 0 },
  { name: 'Sunny Side Up Eggs', costCents: 50, standardPriceCents: 0 },
  // Toppings & Extras
  { name: 'Maple Cured Bacon', costCents: 80, standardPriceCents: 150 },
  { name: 'Whipped Vanilla Cream', costCents: 30, standardPriceCents: 50 },
  { name: 'Salted Caramel Drizzle', costCents: 25, standardPriceCents: 50 },
  { name: 'Extra Sharp Cheddar', costCents: 40, standardPriceCents: 50 },
  { name: 'Crumbled Greek Feta', costCents: 45, standardPriceCents: 50 },
  { name: 'Hass Avocado Slices', costCents: 80, standardPriceCents: 150 },
];

export interface DishSeedDef {
  sku: string;
  name: string;
  categorySlug: string;
  description: string;
  temperature: 'HOT' | 'COLD';
  costCents: number;
  stationName: string | null; // null for unassigned
  minOrderQty?: number;
  standardPriceCents?: number; // undefined means deliberately unpriced in Standard tier
  partnerOverrideCents?: number;
  allergens?: string[];
  dietaryTags?: string[];
  groups: {
    name: string;
    required: boolean;
    sortOrder: number;
    usesPortions?: boolean;
    options: string[];
  }[];
}

export const SEED_DISHES: DishSeedDef[] = [
  // ─── Bowls (10) ──────────────────────────────────────────────
  {
    sku: 'BWL-001',
    name: 'Teriyaki Salmon Bowl',
    categorySlug: 'bowls',
    description: 'Fresh grilled salmon over grains with stir-fried seasonal vegetables and house glaze.',
    temperature: 'HOT',
    costCents: 650,
    stationName: 'Hot Line',
    standardPriceCents: 1350,
    partnerOverrideCents: 1600,
    allergens: ['Fish', 'Soy'],
    dietaryTags: ['Halal'],
    groups: [
      {
        name: 'Choose Base',
        required: true,
        sortOrder: 1,
        options: ['Jasmine Steamed Rice', 'Organic Brown Rice', 'Tri-Color Quinoa'],
      },
      {
        name: 'Sauce Choice',
        required: false,
        sortOrder: 2,
        options: ['House Teriyaki Glaze', 'Spicy Sriracha Mayo'],
      },
      {
        name: 'Add-on Side',
        required: false,
        sortOrder: 3,
        usesPortions: true,
        options: ['Steamed Edamame with Sea Salt', 'Artisanal Kimchi'],
      },
    ],
  },
  {
    sku: 'BWL-002',
    name: 'Mediterranean Falafel Bowl',
    categorySlug: 'bowls',
    description: 'Crispy herb falafels, hummus, cucumber salad, and pickled turnip over grains.',
    temperature: 'COLD',
    costCents: 420,
    stationName: 'Cold Prep',
    standardPriceCents: 950,
    allergens: ['Sesame'],
    dietaryTags: ['Vegan', 'Vegetarian', 'Halal'],
    groups: [
      {
        name: 'Choose Base',
        required: true,
        sortOrder: 1,
        options: ['Organic Brown Rice', 'Fresh Spring Greens', 'Tri-Color Quinoa'],
      },
      {
        name: 'Sauce Choice',
        required: false,
        sortOrder: 2,
        options: ['Creamy Tahini Garlic', 'Lemon Herb Vinaigrette'],
      },
    ],
  },
  {
    sku: 'BWL-003',
    name: 'Korean Bibimbap Bowl',
    categorySlug: 'bowls',
    description: 'Warm rice bowl with sautéed vegetables, gochujang paste, seasoned protein, and fried egg.',
    temperature: 'HOT',
    costCents: 550,
    stationName: 'Hot Line',
    standardPriceCents: 1200,
    allergens: ['Soy', 'Egg', 'Sesame'],
    dietaryTags: ['Halal'],
    groups: [
      {
        name: 'Choose Protein',
        required: true,
        sortOrder: 1,
        options: ['Marinated Flank Steak', 'Organic Crispy Tofu', 'Grilled Herb Chicken'],
      },
      {
        name: 'Choose Base',
        required: true,
        sortOrder: 2,
        options: ['Jasmine Steamed Rice', 'Organic Brown Rice'],
      },
      {
        name: 'Add-on Side',
        required: false,
        sortOrder: 3,
        usesPortions: true,
        options: ['Artisanal Kimchi', 'Garlic Steamed Broccoli'],
      },
    ],
  },
  {
    sku: 'BWL-004',
    name: 'Mexican Burrito Bowl',
    categorySlug: 'bowls',
    description: 'Cilantro lime rice, black beans, charred corn salsa, avocado, and protein.',
    temperature: 'HOT',
    costCents: 480,
    stationName: 'Hot Line',
    standardPriceCents: 1100,
    allergens: ['Dairy'],
    dietaryTags: ['Gluten-free', 'Halal'],
    groups: [
      {
        name: 'Choose Protein',
        required: true,
        sortOrder: 1,
        options: ['Grilled Herb Chicken', 'Marinated Flank Steak', 'Crispy Spiced Falafel'],
      },
      {
        name: 'Choose Base',
        required: true,
        sortOrder: 2,
        options: ['Organic Brown Rice', 'Fresh Spring Greens', 'Cauliflower Rice'],
      },
      {
        name: 'Sauce Choice',
        required: false,
        sortOrder: 3,
        options: ['Fresh Chimichurri', 'Spicy Sriracha Mayo'],
      },
    ],
  },
  {
    sku: 'BWL-005',
    name: 'Thai Green Curry Chicken Bowl',
    categorySlug: 'bowls',
    description: 'Aromatic coconut lemongrass green curry with tender chicken and bamboo shoots.',
    temperature: 'HOT',
    costCents: 580,
    stationName: 'Hot Line',
    standardPriceCents: 1250,
    allergens: ['Fish'],
    dietaryTags: ['Dairy-free', 'Halal'],
    groups: [
      {
        name: 'Choose Base',
        required: true,
        sortOrder: 1,
        options: ['Jasmine Steamed Rice', 'Organic Brown Rice'],
      },
    ],
  },
  {
    sku: 'BWL-006',
    name: 'Poke Tuna Bowl',
    categorySlug: 'bowls',
    description: 'Fresh sushi-grade yellowfin tuna, edamame, cucumber, furikake, and ponzu drizzle.',
    temperature: 'COLD',
    costCents: 700,
    stationName: 'Cold Prep',
    standardPriceCents: 1450,
    allergens: ['Fish', 'Soy', 'Sesame'],
    dietaryTags: ['Dairy-free'],
    groups: [
      {
        name: 'Choose Base',
        required: true,
        sortOrder: 1,
        options: ['Jasmine Steamed Rice', 'Organic Brown Rice', 'Fresh Spring Greens'],
      },
      {
        name: 'Add-on Side',
        required: false,
        sortOrder: 2,
        usesPortions: true,
        options: ['Steamed Edamame with Sea Salt', 'Fresh Seasonal Fruit Cup'],
      },
    ],
  },
  {
    sku: 'BWL-007',
    name: 'Paneer Tikka Masala Bowl',
    categorySlug: 'bowls',
    description: 'Tandoori spiced paneer cubes in a rich tomato-cashew curry served with jeera rice.',
    temperature: 'HOT',
    costCents: 460,
    stationName: 'Hot Line',
    standardPriceCents: 1050,
    allergens: ['Dairy'],
    dietaryTags: ['Vegetarian', 'Jain'],
    groups: [
      {
        name: 'Choose Base',
        required: true,
        sortOrder: 1,
        options: ['Jasmine Steamed Rice', 'Organic Brown Rice'],
      },
    ],
  },
  {
    // Deliberately lacks Standard explicit price -> unpriced gap
    sku: 'BWL-008',
    name: 'Quinoa Superfood Crunch Bowl',
    categorySlug: 'bowls',
    description: 'Tri-color quinoa, kale, roasted sweet potato, pumpkin seeds, and tahini.',
    temperature: 'COLD',
    costCents: 400,
    stationName: 'Cold Prep',
    standardPriceCents: undefined, // Unpriced in Standard!
    allergens: ['Sesame'],
    dietaryTags: ['Vegan', 'Vegetarian', 'Gluten-free', 'Dairy-free'],
    groups: [
      {
        name: 'Choose Base',
        required: true,
        sortOrder: 1,
        options: ['Tri-Color Quinoa', 'Fresh Spring Greens'],
      },
      {
        name: 'Sauce Choice',
        required: false,
        sortOrder: 2,
        options: ['Creamy Tahini Garlic', 'Lemon Herb Vinaigrette'],
      },
    ],
  },
  {
    sku: 'BWL-009',
    name: 'BBQ Pulled Chicken Bowl',
    categorySlug: 'bowls',
    description: 'Slow-smoked shredded chicken, sweet corn, coleslaw, and tangy barbecue reduction.',
    temperature: 'HOT',
    costCents: 520,
    stationName: 'Grill',
    standardPriceCents: 1150,
    allergens: ['Mustard'],
    dietaryTags: ['Halal'],
    groups: [
      {
        name: 'Choose Base',
        required: true,
        sortOrder: 1,
        options: ['Organic Brown Rice', 'Jasmine Steamed Rice'],
      },
      {
        name: 'Add-on Side',
        required: false,
        sortOrder: 2,
        usesPortions: true,
        options: ['Sweet Potato Fries', 'Garlic Steamed Broccoli'],
      },
    ],
  },
  {
    // Unassigned station (stationId = null)
    sku: 'BWL-010',
    name: 'Miso Tofu Soba Bowl',
    categorySlug: 'bowls',
    description: 'Buckwheat soba noodles, silken tofu, braised shiitake, and white miso broth.',
    temperature: 'HOT',
    costCents: 440,
    stationName: null, // Unassigned station!
    standardPriceCents: 1000,
    allergens: ['Soy', 'Gluten'],
    dietaryTags: ['Vegan', 'Vegetarian'],
    groups: [
      {
        name: 'Choose Protein',
        required: true,
        sortOrder: 1,
        options: ['Organic Crispy Tofu', 'Steamed Edamame with Sea Salt'],
      },
    ],
  },

  // ─── Breakfast (7) ───────────────────────────────────────────
  {
    sku: 'BRK-001',
    name: 'Classic Avocado Toast',
    categorySlug: 'breakfast',
    description: 'Smashed Haas avocado, microgreens, chili flakes, and extra virgin olive oil.',
    temperature: 'COLD',
    costCents: 350,
    stationName: 'Bakery',
    standardPriceCents: 800,
    allergens: ['Gluten'],
    dietaryTags: ['Vegan', 'Vegetarian'],
    groups: [
      {
        name: 'Bread Selection',
        required: true,
        sortOrder: 1,
        options: ['Artisan Sourdough', 'Brioche Roll', 'Gluten-Free Toast'],
      },
    ],
  },
  {
    sku: 'BRK-002',
    name: 'Eggs Benedict & Smoked Salmon',
    categorySlug: 'breakfast',
    description: 'Poached free-range eggs on toasted brioche with Norwegian smoked salmon and hollandaise.',
    temperature: 'HOT',
    costCents: 550,
    stationName: 'Hot Line',
    standardPriceCents: 1250,
    allergens: ['Egg', 'Dairy', 'Fish', 'Gluten'],
    groups: [
      {
        name: 'Egg Preparation',
        required: true,
        sortOrder: 1,
        options: ['Two Poached Eggs', 'Sunny Side Up Eggs'],
      },
    ],
  },
  {
    sku: 'BRK-003',
    name: 'Chia Seed Coconut Pudding',
    categorySlug: 'breakfast',
    description: 'Overnight organic chia seeds in coconut milk with mango puree and toasted almonds.',
    temperature: 'COLD',
    costCents: 280,
    stationName: 'Cold Prep',
    standardPriceCents: 650,
    allergens: ['Tree Nuts'],
    dietaryTags: ['Vegan', 'Vegetarian', 'Gluten-free', 'Dairy-free'],
    groups: [
      {
        name: 'Add-on Side',
        required: false,
        sortOrder: 1,
        usesPortions: true,
        options: ['Fresh Seasonal Fruit Cup'],
      },
    ],
  },
  {
    sku: 'BRK-004',
    name: 'Buttermilk Pancakes & Maple',
    categorySlug: 'breakfast',
    description: 'Fluffy triple stack pancakes served with churned butter and grade-A maple syrup.',
    temperature: 'HOT',
    costCents: 320,
    stationName: 'Grill',
    standardPriceCents: 750,
    allergens: ['Gluten', 'Dairy', 'Egg'],
    dietaryTags: ['Vegetarian'],
    groups: [
      {
        name: 'Pancake Toppings',
        required: false,
        sortOrder: 1,
        options: ['Whipped Vanilla Cream', 'Salted Caramel Drizzle', 'Maple Cured Bacon'],
      },
    ],
  },
  {
    sku: 'BRK-005',
    name: 'Shakshuka with Feta',
    categorySlug: 'breakfast',
    description: 'Slow-simmered spiced tomato, bell pepper, and onion stew topped with baked eggs and feta.',
    temperature: 'HOT',
    costCents: 420,
    stationName: 'Hot Line',
    standardPriceCents: 950,
    allergens: ['Egg', 'Dairy'],
    dietaryTags: ['Vegetarian'],
    groups: [
      {
        name: 'Bread Selection',
        required: true,
        sortOrder: 1,
        options: ['Artisan Sourdough', 'Gluten-Free Toast'],
      },
    ],
  },
  {
    sku: 'BRK-006',
    name: 'Acai Antioxidant Bowl',
    categorySlug: 'breakfast',
    description: 'Wild Amazon acai blend with organic granola, banana, fresh berries, and raw honey.',
    temperature: 'COLD',
    costCents: 450,
    stationName: 'Cold Prep',
    standardPriceCents: 900,
    dietaryTags: ['Vegan', 'Vegetarian', 'Gluten-free', 'Dairy-free'],
    groups: [
      {
        name: 'Add-on Side',
        required: false,
        sortOrder: 1,
        usesPortions: true,
        options: ['Fresh Seasonal Fruit Cup'],
      },
    ],
  },
  {
    // minOrderQty: 2
    sku: 'BRK-007',
    name: 'English Breakfast Platter',
    categorySlug: 'breakfast',
    description: 'Hearty catering platter with Cumberland sausage, bacon, grilled mushrooms, beans, and eggs.',
    temperature: 'HOT',
    costCents: 600,
    stationName: 'Grill',
    minOrderQty: 2, // minOrderQty = 2!
    standardPriceCents: 1350,
    allergens: ['Gluten', 'Egg', 'Dairy'],
    groups: [
      {
        name: 'Egg Preparation',
        required: true,
        sortOrder: 1,
        options: ['Scrambled Free-Range Eggs', 'Sunny Side Up Eggs', 'Two Poached Eggs'],
      },
      {
        name: 'Bread Selection',
        required: true,
        sortOrder: 2,
        options: ['Artisan Sourdough', 'Brioche Roll'],
      },
    ],
  },

  // ─── Wraps (5) ───────────────────────────────────────────────
  {
    sku: 'WRP-001',
    name: 'Grilled Chicken Caesar Wrap',
    categorySlug: 'wraps',
    description: 'Crisp romaine, shaved parmesan, garlic croutons, and grilled chicken breast in a spinach wrap.',
    temperature: 'COLD',
    costCents: 420,
    stationName: 'Grill',
    standardPriceCents: 950,
    allergens: ['Gluten', 'Dairy', 'Egg'],
    dietaryTags: ['Halal'],
    groups: [
      {
        name: 'Extra Topping',
        required: false,
        sortOrder: 1,
        options: ['Hass Avocado Slices', 'Maple Cured Bacon'],
      },
    ],
  },
  {
    sku: 'WRP-002',
    name: 'Roasted Veggie & Hummus Wrap',
    categorySlug: 'wraps',
    description: 'Zucchini, bell peppers, eggplant, and kalamata olives wrapped with house garlic hummus.',
    temperature: 'COLD',
    costCents: 380,
    stationName: 'Cold Prep',
    standardPriceCents: 850,
    allergens: ['Gluten', 'Sesame'],
    dietaryTags: ['Vegan', 'Vegetarian', 'Dairy-free'],
    groups: [
      {
        name: 'Sauce Choice',
        required: false,
        sortOrder: 1,
        options: ['Creamy Tahini Garlic', 'Lemon Herb Vinaigrette'],
      },
    ],
  },
  {
    sku: 'WRP-003',
    name: 'Spicy Buffalo Crispy Chicken Wrap',
    categorySlug: 'wraps',
    description: 'Crispy chicken tenders tossed in buffalo sauce with celery crunch and blue cheese dressing.',
    temperature: 'HOT',
    costCents: 450,
    stationName: 'Grill',
    standardPriceCents: 1050,
    allergens: ['Gluten', 'Dairy'],
    dietaryTags: ['Halal'],
    groups: [
      {
        name: 'Add-on Side',
        required: false,
        sortOrder: 1,
        usesPortions: true,
        options: ['Sweet Potato Fries', 'Steamed Edamame with Sea Salt'],
      },
    ],
  },
  {
    sku: 'WRP-004',
    name: 'Halloumi & Zaatar Flatbread Wrap',
    categorySlug: 'wraps',
    description: 'Pan-seared Cyprus halloumi, wild zaatar herbs, fresh mint, cucumber, and ripe tomatoes.',
    temperature: 'HOT',
    costCents: 430,
    stationName: 'Grill',
    standardPriceCents: 950,
    allergens: ['Gluten', 'Dairy', 'Sesame'],
    dietaryTags: ['Vegetarian'],
    groups: [
      {
        name: 'Extra Cheese',
        required: false,
        sortOrder: 1,
        options: ['Crumbled Greek Feta', 'Extra Sharp Cheddar'],
      },
    ],
  },
  {
    sku: 'WRP-005',
    name: 'Smoked Turkey Club Wrap',
    categorySlug: 'wraps',
    description: 'Hickory smoked turkey breast, crispy bacon, cheddar, lettuce, tomato, and garlic aioli.',
    temperature: 'COLD',
    costCents: 460,
    stationName: 'Cold Prep',
    standardPriceCents: 1050,
    allergens: ['Gluten', 'Dairy'],
    dietaryTags: ['Halal'],
    groups: [
      {
        name: 'Extra Topping',
        required: false,
        sortOrder: 1,
        options: ['Hass Avocado Slices'],
      },
    ],
  },

  // ─── Desserts (5) ────────────────────────────────────────────
  {
    sku: 'DST-001',
    name: 'Dark Chocolate Lava Cake',
    categorySlug: 'desserts',
    description: 'Warm molten Valrhona dark chocolate cake with a gooey center.',
    temperature: 'HOT',
    costCents: 300,
    stationName: 'Bakery',
    standardPriceCents: 700,
    allergens: ['Gluten', 'Dairy', 'Egg'],
    dietaryTags: ['Vegetarian'],
    groups: [
      {
        name: 'Dessert Topping',
        required: false,
        sortOrder: 1,
        options: ['Whipped Vanilla Cream', 'Salted Caramel Drizzle'],
      },
    ],
  },
  {
    sku: 'DST-002',
    name: 'New York Baked Cheesecake',
    categorySlug: 'desserts',
    description: 'Velvety cream cheese filling on a graham cracker crust with berry compote.',
    temperature: 'COLD',
    costCents: 320,
    stationName: 'Bakery',
    standardPriceCents: 750,
    allergens: ['Gluten', 'Dairy', 'Egg'],
    dietaryTags: ['Vegetarian'],
    groups: [
      {
        name: 'Dessert Topping',
        required: false,
        sortOrder: 1,
        options: ['Whipped Vanilla Cream'],
      },
    ],
  },
  {
    sku: 'DST-003',
    name: 'Mango Sticky Rice',
    categorySlug: 'desserts',
    description: 'Sweet coconut infused glutinous rice paired with ripe Champagne mango slices.',
    temperature: 'COLD',
    costCents: 260,
    stationName: 'Cold Prep',
    standardPriceCents: 600,
    allergens: ['Sesame'],
    dietaryTags: ['Vegan', 'Vegetarian', 'Gluten-free', 'Dairy-free'],
    groups: [],
  },
  {
    sku: 'DST-004',
    name: 'Vegan Almond Flour Brownie',
    categorySlug: 'desserts',
    description: 'Fudgy Dutch cacao brownie baked with California almond flour and organic agave.',
    temperature: 'COLD',
    costCents: 240,
    stationName: 'Bakery',
    standardPriceCents: 550,
    allergens: ['Tree Nuts'],
    dietaryTags: ['Vegan', 'Vegetarian', 'Gluten-free', 'Dairy-free'],
    groups: [],
  },
  {
    // Unassigned station (stationId = null)
    sku: 'DST-005',
    name: 'Artisanal Fruit Tart',
    categorySlug: 'desserts',
    description: 'Buttery shortbread crust lined with vanilla custard and decorated with glazed seasonal berries.',
    temperature: 'COLD',
    costCents: 290,
    stationName: null, // Unassigned station!
    standardPriceCents: 650,
    allergens: ['Gluten', 'Dairy', 'Egg'],
    dietaryTags: ['Vegetarian'],
    groups: [],
  },

  // ─── Chef's Table (Secret - 3) ──────────────────────────────
  {
    // minOrderQty: 2
    sku: 'CHF-001',
    name: 'Wagyu Ribeye Steak Truffle Butter',
    categorySlug: 'chefs-table',
    description: 'A5 Miyazaki Wagyu ribeye seared medium-rare, finished with Périgord black truffle butter.',
    temperature: 'HOT',
    costCents: 1800,
    stationName: 'Grill',
    minOrderQty: 2, // minOrderQty = 2!
    standardPriceCents: 3800,
    partnerOverrideCents: 4200, // Partner explicit override
    allergens: ['Dairy'],
    dietaryTags: ['Halal'],
    groups: [
      {
        name: 'Choose Base',
        required: true,
        sortOrder: 1,
        options: ['Jasmine Steamed Rice', 'Organic Brown Rice'],
      },
      {
        name: 'Add-on Side',
        required: false,
        sortOrder: 2,
        usesPortions: true,
        options: ['Garlic Steamed Broccoli', 'Sweet Potato Fries'],
      },
    ],
  },
  {
    sku: 'CHF-002',
    name: 'Lobster Tail Thermidor',
    categorySlug: 'chefs-table',
    description: 'Atlantic lobster tail bathed in rich brandy Dijon velouté, gruyère gratin, and tarragon.',
    temperature: 'HOT',
    costCents: 2200,
    stationName: 'Hot Line',
    standardPriceCents: 4500,
    allergens: ['Shellfish', 'Dairy', 'Gluten'],
    groups: [
      {
        name: 'Choose Base',
        required: true,
        sortOrder: 1,
        options: ['Jasmine Steamed Rice', 'Fresh Spring Greens'],
      },
    ],
  },
  {
    // Deliberately lacks Standard explicit price -> unpriced gap
    sku: 'CHF-003',
    name: 'Saffron Chilean Sea Bass',
    categorySlug: 'chefs-table',
    description: 'Pan-roasted deep sea bass on saffron fennel broth with charred baby leeks.',
    temperature: 'HOT',
    costCents: 1900,
    stationName: 'Hot Line',
    standardPriceCents: undefined, // Unpriced in Standard!
    allergens: ['Fish'],
    groups: [
      {
        name: 'Choose Base',
        required: true,
        sortOrder: 1,
        options: ['Jasmine Steamed Rice', 'Tri-Color Quinoa'],
      },
    ],
  },
];

export interface CompanySeedDef {
  name: string;
  tierName: 'Standard' | 'Enterprise' | 'Partner';
  workingDays: number[];
  defaultDeliveryTimeMin: number;
  dispatchLeadMinutes: number;
  defaultPackaging: 'STANDARD' | 'INSULATED' | 'ECO';
  defaultDriverEmail?: string;
  driverNotes?: string;
  billingName: string;
  billingEmail: string;
  billingAddress: string;
  domains: string[];
  addresses: {
    label: string;
    line1: string;
    line2?: string;
    city: string;
    postcode: string;
    isDefault: boolean;
  }[];
  employees: {
    name: string;
    email: string;
    phone?: string;
    isOwner?: boolean;
    canChooseAddress?: boolean;
    canChangeTime?: boolean;
    canChangePackaging?: boolean;
    allergens?: string[];
    dietaryTags?: string[];
  }[];
  holidayNextWeek?: {
    dayOffset: number; // day relative to next monday
    name: string;
  };
  hiddenCategories?: string[];
  hiddenItemSkus?: string[];
}

export const SEED_COMPANIES: CompanySeedDef[] = [
  // ── Company 1: Nexus Tech Solutions ──
  {
    name: 'Nexus Tech Solutions',
    tierName: 'Enterprise',
    workingDays: [1, 2, 3, 4, 5],
    defaultDeliveryTimeMin: 720, // 12:00 PM
    dispatchLeadMinutes: 60,
    defaultPackaging: 'STANDARD',
    defaultDriverEmail: 'driver@test.com', // default driver = driver@test.com
    driverNotes: 'Check in with security in the main lobby on arrival.',
    billingName: 'Nexus Tech Accounts Payable',
    billingEmail: 'ap@nexustech.com',
    billingAddress: '100 Innovation Way, Suite 400, Tech City, 94016',
    domains: ['nexustech.com', 'nexus.io'],
    addresses: [
      {
        label: 'HQ - Main Office',
        line1: '100 Innovation Way',
        line2: 'Suite 400',
        city: 'Tech City',
        postcode: '94016',
        isDefault: true,
      },
      {
        label: 'R&D Annex',
        line1: '120 Innovation Way',
        city: 'Tech City',
        postcode: '94016',
        isDefault: false,
      },
    ],
    employees: [
      {
        name: 'Alex Mercer',
        email: 'alex.mercer@nexustech.com',
        phone: '+1 415-555-0101',
        isOwner: true,
        canChooseAddress: true,
        canChangeTime: true,
      },
      {
        name: 'Sarah Chen',
        email: 'sarah.chen@nexustech.com',
        phone: '+1 415-555-0102',
        canChangePackaging: true,
      },
      { name: 'David Kim', email: 'david.kim@nexustech.com' },
      {
        name: 'Priya Sharma',
        email: 'priya.sharma@nexustech.com',
        dietaryTags: ['Vegetarian'],
      },
      { name: 'James Wilson', email: 'james.wilson@nexustech.com' },
      {
        name: 'Elena Rostova',
        email: 'elena.rostova@nexustech.com',
        allergens: ['Dairy'],
      },
      { name: 'Marcus Vance', email: 'marcus.vance@nexustech.com' },
      { name: 'Chloe Dupont', email: 'chloe.dupont@nexustech.com' },
      { name: 'Liam O\'Connor', email: 'liam.oconnor@nexustech.com' },
      {
        name: 'Maya Patel',
        email: 'maya.patel@nexustech.com',
        dietaryTags: ['Vegan'],
      },
      { name: 'Tom Bradley', email: 'tom.bradley@nexustech.com' },
      { name: 'Zoe Adams', email: 'zoe.adams@nexustech.com' },
    ],
  },

  // ── Company 2: Apex Global Capital (Friday off!) ──
  {
    name: 'Apex Global Capital',
    tierName: 'Partner',
    workingDays: [1, 2, 3, 4], // Friday off!
    defaultDeliveryTimeMin: 750, // 12:30 PM
    dispatchLeadMinutes: 45,
    defaultPackaging: 'INSULATED',
    defaultDriverEmail: 'driver@test.com', // 2nd default driver = driver@test.com
    driverNotes: 'Use freight elevator to 15th floor.',
    billingName: 'Apex Global Capital Ltd',
    billingEmail: 'invoicing@apexcapital.com',
    billingAddress: '50 Wall Street, Floor 15, Metro City, 10005',
    domains: ['apexcapital.com'],
    addresses: [
      {
        label: 'Financial Tower',
        line1: '50 Wall Street',
        line2: 'Floor 15',
        city: 'Metro City',
        postcode: '10005',
        isDefault: true,
      },
      {
        label: 'Midtown Branch',
        line1: '350 Park Ave',
        city: 'Metro City',
        postcode: '10022',
        isDefault: false,
      },
    ],
    employees: [
      {
        name: 'Richard Sterling',
        email: 'richard.sterling@apexcapital.com',
        isOwner: true,
      },
      {
        name: 'Victoria Hayes',
        email: 'victoria.hayes@apexcapital.com',
        canChooseAddress: true,
      },
      { name: 'Julian Croft', email: 'julian.croft@apexcapital.com' },
      { name: 'Amanda Ross', email: 'amanda.ross@apexcapital.com' },
      { name: 'Benjamin Scott', email: 'benjamin.scott@apexcapital.com' },
      {
        name: 'Natalie Wong',
        email: 'natalie.wong@apexcapital.com',
        dietaryTags: ['Gluten-free'],
      },
      { name: 'Daniel Craig', email: 'daniel.craig@apexcapital.com' },
      { name: 'Rachel Green', email: 'rachel.green@apexcapital.com' },
      { name: 'Arthur Pendelton', email: 'arthur.pendelton@apexcapital.com' },
      { name: 'Sophia Loren', email: 'sophia.loren@apexcapital.com' },
      { name: 'Charles Xavier', email: 'charles.xavier@apexcapital.com' },
      { name: 'Bruce Wayne', email: 'bruce.wayne@apexcapital.com' },
    ],
  },

  // ── Company 3: Meridian BioLabs (Holiday next week!) ──
  {
    name: 'Meridian BioLabs',
    tierName: 'Standard',
    workingDays: [1, 2, 3, 4, 5],
    defaultDeliveryTimeMin: 780, // 1:00 PM
    dispatchLeadMinutes: 60,
    defaultPackaging: 'ECO',
    billingName: 'Meridian BioLabs Finance',
    billingEmail: 'finance@meridianbio.org',
    billingAddress: '750 Science Blvd, Bio Park, 02142',
    domains: ['meridianbio.org'],
    addresses: [
      {
        label: 'Research Campus',
        line1: '750 Science Blvd',
        city: 'Bio Park',
        postcode: '02142',
        isDefault: true,
      },
    ],
    employees: [
      {
        name: 'Dr. Aris Thorne',
        email: 'aris.thorne@meridianbio.org',
        isOwner: true,
      },
      { name: 'Dr. Claire Bennet', email: 'claire.bennet@meridianbio.org' },
      { name: 'Walter Bishop', email: 'walter.bishop@meridianbio.org' },
      {
        name: 'Astrid Farnsworth',
        email: 'astrid.farnsworth@meridianbio.org',
        allergens: ['Peanuts'],
      },
      { name: 'Peter Bishop', email: 'peter.bishop@meridianbio.org' },
      { name: 'Olivia Dunham', email: 'olivia.dunham@meridianbio.org' },
      { name: 'Nina Sharp', email: 'nina.sharp@meridianbio.org' },
      { name: 'William Bell', email: 'william.bell@meridianbio.org' },
      { name: 'September Jones', email: 'september.jones@meridianbio.org' },
      { name: 'Gene Smith', email: 'gene.smith@meridianbio.org' },
      { name: 'Lincoln Lee', email: 'lincoln.lee@meridianbio.org' },
      { name: 'Fauxlivia Dunham', email: 'fauxlivia.dunham@meridianbio.org' },
    ],
    holidayNextWeek: {
      dayOffset: 1, // Next Tuesday
      name: 'Meridian Innovation Day',
    },
  },

  // ── Company 4: Vanguard Creative Studio (Hides category & item) ──
  {
    name: 'Vanguard Creative Studio',
    tierName: 'Standard',
    workingDays: [1, 2, 3, 4, 5],
    defaultDeliveryTimeMin: 720, // 12:00 PM
    dispatchLeadMinutes: 60,
    defaultPackaging: 'STANDARD',
    billingName: 'Vanguard Studio Billing',
    billingEmail: 'accounts@vanguardstudio.design',
    billingAddress: '42 Art District St, Arts Quarter, 90013',
    domains: ['vanguardstudio.design'],
    addresses: [
      {
        label: 'Design Loft',
        line1: '42 Art District St',
        city: 'Arts Quarter',
        postcode: '90013',
        isDefault: true,
      },
    ],
    employees: [
      {
        name: 'Lucas Moreau',
        email: 'lucas.moreau@vanguardstudio.design',
        isOwner: true,
      },
      { name: 'Isabella Swan', email: 'isabella.swan@vanguardstudio.design' },
      { name: 'Jasper Hale', email: 'jasper.hale@vanguardstudio.design' },
      { name: 'Alice Cullen', email: 'alice.cullen@vanguardstudio.design' },
      { name: 'Edward Anthony', email: 'edward.anthony@vanguardstudio.design' },
      { name: 'Rosalie Hale', email: 'rosalie.hale@vanguardstudio.design' },
      { name: 'Emmett McCarty', email: 'emmett.mccarty@vanguardstudio.design' },
      { name: 'Carlisle Cullen', email: 'carlisle.cullen@vanguardstudio.design' },
      { name: 'Esme Platt', email: 'esme.platt@vanguardstudio.design' },
      { name: 'Jacob Black', email: 'jacob.black@vanguardstudio.design' },
    ],
    hiddenCategories: ['desserts'], // Hides Desserts category!
    hiddenItemSkus: ['BWL-009'], // Hides BBQ Pulled Chicken Bowl!
  },

  // ── Company 5: Starlight Media Group ──
  {
    name: 'Starlight Media Group',
    tierName: 'Enterprise',
    workingDays: [1, 2, 3, 4, 5],
    defaultDeliveryTimeMin: 690, // 11:30 AM
    dispatchLeadMinutes: 60,
    defaultPackaging: 'STANDARD',
    billingName: 'Starlight Media Accounting',
    billingEmail: 'billing@starlightmedia.com',
    billingAddress: '1000 Paramount Way, Studio City, 91604',
    domains: ['starlightmedia.com', 'starlight.tv'],
    addresses: [
      {
        label: 'Studio Lot A',
        line1: '1000 Paramount Way',
        city: 'Studio City',
        postcode: '91604',
        isDefault: true,
      },
      {
        label: 'Broadcast Plaza',
        line1: '200 Broadcast Plaza',
        city: 'Studio City',
        postcode: '91604',
        isDefault: false,
      },
    ],
    employees: [
      {
        name: 'Miranda Priestly',
        email: 'miranda.priestly@starlightmedia.com',
        isOwner: true,
      },
      {
        name: 'Andy Sachs',
        email: 'andy.sachs@starlightmedia.com',
        canChooseAddress: true,
        canChangeTime: true,
      },
      { name: 'Emily Charlton', email: 'emily.charlton@starlightmedia.com' },
      { name: 'Nigel Kipling', email: 'nigel.kipling@starlightmedia.com' },
      { name: 'Christian Thompson', email: 'christian.thompson@starlightmedia.com' },
      { name: 'Nate Cooper', email: 'nate.cooper@starlightmedia.com' },
      { name: 'Lily St. Regis', email: 'lily.stregis@starlightmedia.com' },
      { name: 'Doug Murphy', email: 'doug.murphy@starlightmedia.com' },
      { name: 'Jocelyn Wild', email: 'jocelyn.wild@starlightmedia.com' },
      { name: 'Serena van der Woodsen', email: 'serena.vanderwoodsen@starlightmedia.com' },
      { name: 'Blair Waldorf', email: 'blair.waldorf@starlightmedia.com' },
      { name: 'Chuck Bass', email: 'chuck.bass@starlightmedia.com' },
    ],
  },
];
