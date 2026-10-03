# MASTERPLAN.md — Fernleaf Kitchen Admin Panel

**Status:** AUTHORITATIVE — this is the single source of truth for all agents.
**Do NOT reference PLAN.md or PLAN_OPUS_REVIEW.md.** All corrections are already merged here.
**Spec:** `docs/ASSIGNMENT.md` · **Deadline:** 4 Oct 2026, 23:59 IST · **Stack:** Next.js + NestJS + Prisma + Neon Postgres

---

## How agents should use this document

1. Read `docs/ASSIGNMENT.md` first (the spec).
2. Read ONLY your assigned Phase section below.
3. Write code. Do NOT modify existing working code unless the phase says to.
4. After coding, tell the user exactly how to test (commands, URLs, what to click).
5. User tests. If it works → commit. If not → fix.

**Conventions:** Money = integer cents. Dates = `'YYYY-MM-DD'` strings. Times = minutes since midnight (0-1439). All IDs = `uuid()`. Time zone = `Asia/Kolkata` (configurable setting).

---

## Current Repo State (DO NOT BREAK)

```
apps/api          NestJS, Prisma 6.x, bcryptjs, @nestjs/jwt, cookie-parser
apps/web          Next.js 15 (App Router), React 19, Tailwind v3
packages/shared   Raw TS (main: ./src/index.ts, no build step)
```

**Already working:**
- 4 accounts seeded on boot: admin/kitchen/dispatch/driver @test.com, password `Test@1234`
- Login → JWT httpOnly cookie (12h) → `/home` shows role
- Vercel rewrite proxy: `/api/:path*` → Render API
- Prisma schema: only `Role` (uuid, key, name, permissions[]) and `User` (uuid, email, name, passwordHash, roleId)
- `SeedService` runs on boot (upserts roles + users)
- `/health` endpoint, `trust proxy` enabled

**Key files:**
- Schema: `apps/api/prisma/schema.prisma`
- API entry: `apps/api/src/main.ts`
- App module: `apps/api/src/app.module.ts`
- Auth: `apps/api/src/auth/auth.{service,controller,module}.ts`
- Seed: `apps/api/src/seed.service.ts`
- Web login: `apps/web/app/login/page.tsx`
- Web home: `apps/web/app/home/page.tsx`
- Next config: `apps/web/next.config.mjs` (rewrite to API_ORIGIN)

---

## Spec Traps (reference for all phases)

| # | Trap | Rule |
|---|------|------|
| 1 | Cut-off counts back **kitchen** working days only. Company calendar does NOT move cut-off. | |
| 2 | Company calendar matters for the delivery date (non-working/holiday = invalid delivery date). Also require delivery date to be a kitchen working day. | |
| 3 | Missing price ≠ $0. No per-dish fallback to default tier. Default tier used only when company has no tier. | |
| 4 | Derived prices round **up** to next 5 cents. Integer math only: `ceil(base*bps/50000)*5`. | |
| 5 | Combination quantities must sum exactly to line quantity. Every required group satisfied per combination. No duplicate signatures. | |
| 6 | Past orders never change when catalogue/prices change. Snapshot everything on the order. | |
| 7 | Dishes, options, tiers, categories = soft delete (`active` flag). Never hard-delete. | |
| 8 | "Finish without start" records a start. `kitchenStartedAt` = first unit's start. `kitchenReadyAt` = all units done. | |
| 9 | Kitchen concurrency: `SELECT ... FOR UPDATE` on Order row before updating any unit. | |
| 10 | Planned times must update when delivery time changes. | |
| 11 | Drop = same company + same address + exact same delivery time. | |
| 12 | Cut-off processing must be idempotent. Use `pg_try_advisory_xact_lock` **inside the transaction** (NOT session-level — Neon pooled connection breaks session locks). | |
| 13 | After cut-off, only admin can edit/cancel. Server-enforced, not just hidden buttons. | |
| 14 | Driver sees only their own drops. Object-level scoping in the service. | |
| 15 | Dates = `YYYY-MM-DD` strings end-to-end. Use Luxon with configured IANA zone. Browser never computes today/cut-off. | |
| 16 | Demo data must be fresh relative to "today" (reviewer might open 2 weeks later). | |
| 17 | Order on at most one invoice. `Order.invoiceId` single column. Invoiced order changes → Adjustments. | |
| 18 | Moving employee to another company: blocked while Draft/Placed orders exist. Order keeps original `companyId`. | |
| 19 | Email domains: unique across companies, public domains forbidden, case-insensitive. | |
| 20 | "Rejected" = admin-only terminal status, non-billable. | |

---

## Money and Time Conventions (all phases must follow)

- **Money:** integer cents everywhere. DB `Int`, TS `number`. Never `Decimal`, never `parseFloat`. Max 100,000,000 cents.
- **Dates:** delivery date = `DATE` in DB, `'YYYY-MM-DD'` string in code/API. `dbDateToString(d) = d.toISOString().slice(0,10)`. `stringToDbDate(s) = new Date(s+'T00:00:00Z')`.
- **Times of day:** `deliveryTimeMin` = minutes since midnight in kitchen TZ (0-1439, 5-min steps).
- **Instants:** `timestamptz`. Computed from (date, minutes, IANA zone) using Luxon.
- **Time zone:** one kitchen zone, setting `timezone`, default `Asia/Kolkata`.
- **"Today":** server computes via `DateTime.now().setZone(tz).toISODate()`. Frontend reads `GET /meta` → `{ today, nowIso, timezone }`. Frontend **never** computes today.

---

## Pricing Engine (reference for Phase 3, 5)

```ts
// Pure function in packages/shared/pricing.ts
derive(baseCents: number, factorBps: number): number | null
  = ceil(baseCents * factorBps / 50000) * 5
  // factorBps: 10000 = ×1.00. "cost × 2.4" → 24000. "Standard +15%" → 11500.

resolveDish(dish, tierId, ctx):
  1. Check memo cache
  2. Check explicit override (DishTierPrice) → return as-is (no rounding)
  3. Match tier.derivation:
     NONE → null
     COST_FACTOR → derive(dish.costCents, tier.factorBps)
     TIER_FACTOR → derive(resolveDish(dish, tier.baseTierId, ctx), tier.factorBps)
  4. Result > 0 → return; else null (not orderable, hidden)

resolveOption: same but ≥0 is valid ($0 option surcharge is legitimate)
effectiveTierId(company) = company.tierId ?? defaultTier.id
```

- Cycle prevention: walk `baseTierId` chain; if reaches self → 422. Depth cap 5.
- No fallback to default tier per dish. Only when company has no tier.
- Bulk resolution: load all tiers + overrides in 3 queries → pure computation in memory.

---

## Permissions System (reference for Phase 2+)

```ts
// packages/shared/permissions.ts
const PERMISSIONS = {
  CATALOGUE_READ: 'catalogue:read', CATALOGUE_WRITE: 'catalogue:write',
  PRICING_READ: 'pricing:read', PRICING_WRITE: 'pricing:write',
  COMPANIES_READ: 'companies:read', COMPANIES_WRITE: 'companies:write',
  EMPLOYEES_READ: 'employees:read', EMPLOYEES_WRITE: 'employees:write',
  ORDERS_READ: 'orders:read', ORDERS_WRITE: 'orders:write', ORDERS_OVERRIDE: 'orders:override',
  CUTOFF_RUN: 'cutoff:run',
  KITCHEN_READ: 'kitchen:read', KITCHEN_WORK: 'kitchen:work', KITCHEN_FORCE: 'kitchen:force',
  DISPATCH_READ: 'dispatch:read', DISPATCH_WORK: 'dispatch:work',
  DELIVERIES_READ_OWN: 'deliveries:read_own', DELIVERIES_READ_ANY: 'deliveries:read_any',
  DELIVERIES_DELIVER: 'deliveries:deliver',
  BILLING_READ: 'billing:read', BILLING_WRITE: 'billing:write',
  SETTINGS_READ: 'settings:read', SETTINGS_WRITE: 'settings:write',
  STAFF_READ: 'staff:read', STAFF_WRITE: 'staff:write',
} as const;

// Admin has ['*']. can(userPerms, required) checks for '*' or exact match.
```

**Seed roles:**
| Role | Key | Permissions | Landing |
|------|-----|------------|---------|
| Admin | admin | `['*']` | `/dashboard` |
| Kitchen | kitchen | `kitchen:read, kitchen:work, orders:read, catalogue:read` | `/kitchen` |
| Dispatch | dispatch | `dispatch:read, dispatch:work, kitchen:read, orders:read, companies:read, deliveries:read_any` | `/dispatch` |
| Driver | driver | `deliveries:read_own, deliveries:deliver` | `/driver` |

---

## Data Model (reference — full Prisma schema built in Phase 1)

### Enums
`Temperature{HOT,COLD}` · `Packaging{STANDARD,INSULATED,ECO}` · `OrderStatus{DRAFT,PLACED,CONFIRMED,DELIVERED,CANCELLED,REJECTED}` · `OrderSource{STAFF,DEMO}` · `TierDerivation{NONE,COST_FACTOR,TIER_FACTOR}` · `InvoiceStatus{ISSUED,PAID}` · `InvoiceItemKind{ORDER,ADJUSTMENT}` · `AdjustmentStatus{OPEN,INVOICED,WAIVED}` · `AdjustmentReason{CANCELLED_AFTER_INVOICE,SHORT_DELIVERY,MANUAL}` · `CutoffTrigger{CRON,LAZY,MANUAL}`

### Models (all ids `String @id @default(uuid())`; all have `createdAt/updatedAt`)

```
ACCESS:
  Role        { key @unique, name, permissions String[], landingPath, dashboardKey, isSystem @default(false) }
  User        { email @unique (lowercase), name, passwordHash, roleId→Role, active @default(true) }
  Setting     { key @id, value Json }
  KitchenHoliday { date @db.Date @id, name }

REFERENCE DATA:
  Allergen    { name @unique, active @default(true) }
  DietaryTag  { name @unique, active @default(true) }
  KitchenStation { name @unique, sortOrder Int, active @default(true) }
  PortionSize { name @unique, sortOrder Int, active @default(true) }

CATALOGUE:
  Dish        { sku @unique, name, description, imageUrl?, temperature, costCents Int, stationId?→KitchenStation, minOrderQty Int?, active @default(true) }
  DishAllergen { dishId, allergenId } @@id([dishId, allergenId])
  DishDietaryTag { dishId, tagId } @@id([dishId, tagId])
  Option      { name, costCents Int, active @default(true) }
  OptionAllergen { optionId, allergenId } @@id([optionId, allergenId])
  OptionDietaryTag { optionId, tagId } @@id([optionId, tagId])
  OptionGroup { dishId→Dish, name, required Boolean, sortOrder Int, usesPortions Boolean @default(false) } @@index([dishId, sortOrder])
  OptionGroupOption { groupId→OptionGroup, optionId→Option, sortOrder Int } @@id([groupId, optionId])
  OptionGroupPortion { groupId→OptionGroup, portionSizeId→PortionSize, extraCents Int, sortOrder Int } @@id([groupId, portionSizeId])

PRICING:
  PriceTier   { name @unique, isDefault Boolean @default(false), derivation TierDerivation @default(NONE), baseTierId?→PriceTier, factorBps Int?, active @default(true) }
  DishTierPrice { dishId→Dish, tierId→PriceTier, priceCents Int } @@id([dishId, tierId])
  OptionTierPrice { optionId→Option, tierId→PriceTier, priceCents Int } @@id([optionId, tierId])

MENU:
  MenuCategory { name, slug @unique, sortOrder Int, active @default(true), isSecret @default(false) }
  MenuItem    { categoryId→MenuCategory, dishId→Dish, sortOrder Int, active @default(true) } @@unique([categoryId, dishId])
  CompanyHiddenCategory { companyId→Company, categoryId→MenuCategory } @@id([companyId, categoryId])
  CompanyHiddenItem { companyId→Company, menuItemId→MenuItem } @@id([companyId, menuItemId])

COMPANIES:
  Company     { name @unique, tierId?→PriceTier, ownerEmployeeId? String, workingDays Int[] @default([1,2,3,4,5]),
                defaultDeliveryTimeMin Int @default(720), dispatchLeadMinutes Int @default(60),
                defaultPackaging Packaging @default(STANDARD), driverNotes String?,
                defaultDriverId?→User, billingName, billingEmail, billingPhone?, billingAddress, active @default(true) }
  CompanyDomain { domain String @id, companyId→Company }
  CompanyAddress { companyId→Company, label, line1, line2?, city, state?, postcode, isDefault @default(false), active @default(true) }
  CompanyHoliday { companyId→Company, date @db.Date, name } @@unique([companyId, date])
  Employee    { companyId→Company, name, email @unique, phone?, canChooseAddress @default(false),
                canChangeTime @default(false), canChangePackaging @default(false), active @default(true) }
  EmployeeAllergen { employeeId, allergenId } @@id([employeeId, allergenId])
  EmployeeDietaryTag { employeeId, tagId } @@id([employeeId, tagId])

ORDERS:
  Order       { number Int @unique @default(autoincrement()), employeeId→Employee, companyId→Company,
                deliveryDate @db.Date, deliveryTimeMin Int, addressId String, addressSnapshot Json,
                packaging Packaging, status OrderStatus @default(DRAFT), source OrderSource @default(STAFF),
                version Int @default(0), draftPayload Json?,
                totalCents Int @default(0), leadMinutes Int @default(60), notes String?,
                cancelReason?, rejectReason?,
                plannedKitchenReadyAt DateTime?, plannedDispatchReadyAt DateTime?,
                placedAt?, confirmedAt?, kitchenStartedAt?, kitchenReadyAt?,
                dispatchReadyAt?, outForDeliveryAt?, deliveredAt?, cancelledAt?, rejectedAt?,
                dropId?→Drop, invoiceId?→Invoice, createdById→User }
  OrderLine   { orderId→Order, dishId String, dishName, dishSku, quantity Int, dishPriceCents Int,
                dishCostCents Int, tierName String, lineTotalCents Int, sortOrder Int }
  OrderLineCombination { orderLineId→OrderLine, signature String, label String, quantity Int,
                unitCents Int, unitCostCents Int, totalCents Int, sortOrder Int,
                startedAt DateTime?, doneAt DateTime?, startedById?→User, doneById?→User }
                @@unique([orderLineId, signature])
  CombinationOption { combinationId→OrderLineCombination, groupName String, optionName String,
                portionName String?, optionCents Int, portionExtraCents Int @default(0), optionCostCents Int }

DISPATCH:
  Drop        { deliveryDate @db.Date, companyId→Company, addressId String,
                deliveryTimeMin Int, driverId?→User,
                outForDeliveryAt?, deliveredAt?, deliveredNote?, deliveredById?→User, onTime Boolean? }
                @@unique([deliveryDate, companyId, addressId, deliveryTimeMin])

BILLING:
  Invoice     { number String @unique, companyId→Company, status InvoiceStatus @default(ISSUED),
                totalCents Int, issuedAt DateTime, paidAt?, createdById→User }
  InvoiceItem { invoiceId→Invoice, kind InvoiceItemKind, orderId? String, adjustmentId? String,
                description String, amountCents Int }
  Adjustment  { companyId→Company, orderId→Order, reason AdjustmentReason,
                amountCents Int, status AdjustmentStatus @default(OPEN), note String?, createdById→User }
```

---

## Orders Design (reference for Phase 5)

### Draft vs Placed
- **DRAFT** = header + `draftPayload` JSON. No price snapshot, no OrderLine rows.
- **PLACED+** = fully validated, snapshotted rows (OrderLine, OrderLineCombination, CombinationOption).

### Validation Pipeline (9 steps)
1. Actor/permission check
2. Employee exists, active; load company, tier, calendars, settings
3. Delivery date: well-formed, `>= today`, company working day, not company holiday, kitchen working day, not kitchen holiday, not locked (unless admin override)
4. Delivery details: address ∈ company addresses; time 0-1439 step 5; enforce employee permission flags
5. Lines (≥1 to place): one per dish (no duplicates), dish orderable for this employee, `quantity >= minOrderQty`
6. Combinations: ≥1 per line; Σ combo qty = line qty; per combo, per group: required → exactly 1 selection, option ∈ available options, portion iff `usesPortions`; no duplicate signatures
7. Pricing: `unit = dishPrice + Σ(optionPrice + portionExtra)`; `combo.total = unit × qty`; `line.total = Σ combo.total`; `order.total = Σ line.total`
8. Allergen acknowledgment (warn + checkbox)
9. Persist in one tx with snapshots

### Status Transitions
| From → To | Who | Notes |
|-----------|-----|-------|
| new → DRAFT | staff, before cut-off | JSON payload |
| DRAFT → PLACED | staff, before cut-off | full validation + snapshot |
| DRAFT/PLACED → edited | staff before cut-off; admin anytime | re-prices at current prices |
| DRAFT/PLACED → CANCELLED | staff before cut-off; admin anytime | |
| PLACED → CONFIRMED | cut-off processing only | sets confirmedAt, planned times, drop |
| PLACED/CONFIRMED → REJECTED | admin only, reason required | terminal, non-billable |
| CONFIRMED → CANCELLED | admin only | if invoiced → adjustment |
| CONFIRMED → DELIVERED | via drop or admin force | |

### Cut-off Algorithm
```ts
cutoffAt(deliveryDate, settings): Instant
  d = deliveryDate; n = 0
  while n < settings.cutoffDays:
    d = d - 1 day
    if isKitchenWorkingDay(d) && !isKitchenHoliday(d): n++
  return DateTime.fromISO(d + 'T' + settings.cutoffTime, {zone: settings.tz})

isLocked(date, now) = now >= cutoffAt(date) // equal = locked
```

### Cut-off Processing (idempotent)
```ts
$transaction(async tx => {
  // Advisory lock — MUST be xact-level for Neon pooled connection
  const got = await tx.$queryRawUnsafe(`SELECT pg_try_advisory_xact_lock($1)`, lockId);
  if (!got[0].pg_try_advisory_xact_lock) return { skipped: true };

  // Cancel drafts
  UPDATE Order SET status='CANCELLED' WHERE deliveryDate=date AND status='DRAFT';
  // Confirm placed → create/find drops, set planned times
  UPDATE Order SET status='CONFIRMED' WHERE deliveryDate=date AND status='PLACED';
});
// Second run: both WHERE clauses match 0 rows → harmless
```

---

## Kitchen Design (reference for Phase 6)

- Prep unit = `OrderLineCombination`. Only CONFIRMED orders.
- Station routing: live via `Dish.stationId` (join at read time). Null → "Unassigned".
- Unit states: NOT_STARTED → STARTED → DONE. NOT_STARTED → DONE allowed (records start=done time).
- **Concurrency:** Every unit operation takes `SELECT ... FOR UPDATE` on the Order row first.
- Force-complete (admin): sets all units started+done in one tx.
- Late = `now > plannedKitchenReadyAt`. At-risk = not late, within 60 min, has unstarted units.

---

## Dispatch Design (reference for Phase 7)

- Drop = entity. Created at confirmation. `unique(deliveryDate, companyId, addressId, deliveryTimeMin)`.
- Drop transitions (all-or-nothing for active orders in drop):
  1. dispatch-ready: all orders must have `kitchenReadyAt`
  2. assign-driver: allowed until delivered
  3. out-for-delivery: needs dispatch-ready + driver assigned
  4. deliver: needs out-for-delivery. Sets `deliveredAt`, `onTime` flag.
- On-time: `deliveredAt <= deliveryInstant + 10 min grace`
- Driver sees only `driverId = me` drops for today.

---

## Billing Design (reference for Phase 8)

- Billable = CONFIRMED/DELIVERED + `invoiceId IS NULL`
- Invoice create: tx → conditional `UPDATE Order SET invoiceId WHERE invoiceId IS NULL`, count must match
- Status: ISSUED → PAID
- Cancel/reject invoiced order → order status changes, creates Adjustment (negative `amountCents`)
- Adjustment included in next invoice

---

## Dashboard Design (reference for Phase 11)

### Admin
- Today's orders by status
- Next cut-off window (countdown + draft/placed count)
- Order value next 7 days (PLACED+CONFIRMED+DELIVERED)
- Unbilled amount + top 5 companies
- Kitchen today (meals done/total, late count)

### Kitchen
- Meals to cook (not started / in progress / done)
- By station (remaining)
- Late/at-risk orders
- Next deadline

### Dispatch
- Drops today by stage
- Needs a driver (unassigned drops)
- Behind schedule
- Next 3 drops

### Driver
- My drops today (total / delivered / remaining)
- Next drop details

---

## Ambiguity Register (document in README)

| ID | Ambiguity | Interpretation |
|----|-----------|---------------|
| A1 | Kitchen time zone | `Asia/Kolkata`, editable setting |
| A2 | Secret category | Not in listing; reachable by slug; dishes orderable |
| A3 | Delivery on kitchen non-working day | Not allowed |
| A4 | Option with no tier price | Unavailable; required group with 0 options → dish hidden |
| A5 | $0 dish price | Not orderable. $0 option surcharge is valid |
| A6 | Chained tier rounding | Each tier rounds once from its base's resolved price |
| A7 | Employee moved | Blocked while Draft/Placed exist. Orders keep original company |
| A8 | Multiple options per group | Single choice per group |
| A9 | Portion extras | Per group-size, flat, tier-independent |
| A10 | Editing Placed order | Re-prices at current prices |
| A11 | Line edits after confirmation | Not supported. Cancel and re-create |
| A12 | Dish deactivated with Placed orders | Orders still confirm (snapshot) |
| A13 | Rejected status | Admin-only terminal refusal, non-billable |

---

# PHASES

---

## Phase 1: Schema + Pure Domain + Tests (Opus)

### What to build
1. **Extend Prisma schema** (`apps/api/prisma/schema.prisma`) with ALL models listed in the Data Model section above. Keep existing `Role` and `User` models but add the missing fields (`landingPath`, `dashboardKey`, `isSystem` on Role; `active` on User). Use `uuid()` for all IDs (matching existing models). Add all enums.
2. **Create migration:** `npx prisma migrate dev --name full_schema`
3. **Update seed** (`apps/api/src/seed.service.ts`): update role permissions to match the Permissions table above (admin gets `['*']`, kitchen gets `['kitchen:read', 'kitchen:work', 'orders:read', 'catalogue:read']`, etc.). Add `landingPath` and `dashboardKey` to role upserts.
4. **packages/shared/src/**: Create these pure modules (zero external deps except luxon for dates):
   - `enums.ts` — all enums as TS union types
   - `permissions.ts` — permission constants + `can(userPerms, required)` helper
   - `errors.ts` — error codes as string constants
   - `money.ts` — `parseMoneyToCents`, `formatCents`, `mulBps`, `roundUp5`, `derive(baseCents, factorBps)`
   - `dates.ts` — `dbDateToString`, `stringToDbDate`, `isKitchenWorkingDay`, `isKitchenHoliday`
   - `cutoff.ts` — `cutoffAt(deliveryDate, settings)`, `isLocked(date, now, settings)`
   - `pricing.ts` — `derive`, `resolveDish`, `resolveOption`, `effectiveTierId`
   - `combinations.ts` — `validateCombinations(line, resolvedGroups)`, `computeSignature`, `priceCombo`, `priceLine`, `priceOrder`
   - `planTimes.ts` — `planTimes(date, timeMin, leadMin, bufferMin, tz)`
   - `index.ts` — re-export everything
5. **Install vitest** in the workspace root or packages/shared. Write unit tests:
   - money: `derive(211,10000)→215`, `derive(100,24000)→240`, `derive(1000,11500)→1150`, `derive(1,10000)→5`, `derive(0,x)→null`, result%5===0
   - cutoff: 16 test cases (see Cut-off Algorithm section)
   - pricing: explicit override wins, COST_FACTOR, TIER_FACTOR chain, null propagation, cycle detection, $0 option valid
   - combinations: sum mismatch, duplicate signature, required missing, optional skipped
   - orderPricing: line total = Σ combos, order total = Σ lines
6. **Install luxon** (`pnpm add luxon --filter shared && pnpm add -D @types/luxon --filter shared` or in api)

### Files to create/modify
- `apps/api/prisma/schema.prisma` (modify)
- `apps/api/src/seed.service.ts` (modify role permissions)
- `packages/shared/src/*.ts` (create all modules)
- `packages/shared/src/index.ts` (modify to re-export)
- `packages/shared/package.json` (add luxon dep)
- Test files (create)

### Test instructions
```bash
cd packages/shared && pnpm test          # all unit tests pass
cd apps/api && npx prisma migrate dev    # migration applies cleanly
cd apps/api && pnpm dev                  # server starts, seed runs
# Visit /api/auth/login with admin@test.com — still works
# Visit /api/health — still works
pnpm typecheck                           # no errors
```

### Commit gate
`pnpm test` passes, `pnpm typecheck` passes, API boots, login works.

---

## Phase 2: API Infrastructure (Sonnet)

### What to build
1. **Global JwtAuthGuard**: extracts JWT from cookie, verifies, loads user+role from DB, attaches to request. Applied globally. `@Public()` decorator skips it for `/auth/login`, `/auth/logout`, `/health`, `/meta`.
2. **PermissionsGuard** + `@RequirePermissions('x:y')` decorator: checks `can(user.permissions, required)`. Returns 403 with `FORBIDDEN` error code.
3. **Update `/auth/me`**: return `{ user: { id, email, name }, role: roleKey, permissions: string[], landingPath, dashboardKey }`.
4. **`GET /meta`** endpoint: returns `{ today: 'YYYY-MM-DD', nowIso, timezone }` using the `timezone` setting.
5. **Global ExceptionFilter**: catches all errors, returns `{ error: { code, message, fieldErrors?, details? } }`. Map NestJS exceptions, Prisma errors (P2002→409, P2025→404), and custom `DomainError(code, status)`.
6. **Settings module**: `GET /settings` (all), `PUT /settings/:key` (value validated by a zod registry per key). Keys: timezone, kitchenWorkingDays, cutoffTime, cutoffDays, kitchenBufferMinutes, atRiskWindowMinutes, onTimeGraceMinutes, cutoffHoldDates. Cache in memory for 10s, write invalidates.
7. **Kitchen holidays**: `GET/POST/DELETE /kitchen-holidays`.
8. **Reference data CRUD**: `/ref/allergens`, `/ref/dietary-tags`, `/ref/stations`, `/ref/portion-sizes`. All: list (with `?active=true` filter), create, update (toggle active). No delete.
9. **Staff module**: `GET /staff`, `POST /staff`, `PUT /staff/:id`. Requires `staff:write`. Role list via `GET /roles`.

### Files to create
- `apps/api/src/common/guards/jwt-auth.guard.ts`
- `apps/api/src/common/guards/permissions.guard.ts`
- `apps/api/src/common/decorators/public.decorator.ts`
- `apps/api/src/common/decorators/permissions.decorator.ts`
- `apps/api/src/common/filters/global-exception.filter.ts`
- `apps/api/src/common/domain-error.ts`
- `apps/api/src/settings/settings.{module,controller,service}.ts`
- `apps/api/src/kitchen-holidays/...`
- `apps/api/src/reference-data/...`
- `apps/api/src/staff/...`
- `apps/api/src/meta/meta.controller.ts`

### Test instructions
```bash
pnpm dev
# Test guards: GET /api/health → 200 (public)
# GET /api/settings without cookie → 401
# Login as admin → GET /api/settings → 200
# Login as kitchen → GET /api/settings → 403 (no settings:read)
# GET /api/auth/me → returns permissions array, landingPath, dashboardKey
# GET /api/meta → { today, nowIso, timezone }
# PUT /api/settings/timezone with { value: "America/New_York" } → 200
# GET /api/ref/allergens → []
# POST /api/ref/allergens { name: "Gluten" } → 201
# GET /api/ref/allergens → [{ id, name: "Gluten", active: true }]
```

### Commit gate
Guards enforce permissions, settings CRUD works, reference data works, login still works.

---

## Phase 3: Catalogue + Pricing + Menu (Sonnet)

### What to build
1. **Dishes CRUD**: list (paginated, filterable by active/station/q), create, update, toggle active. With allergens and dietary tags (set on create/update). Image field accepts a URL string.
2. **Options CRUD**: same pattern. With allergens and dietary tags.
3. **Option Groups**: nested under dishes. `GET /dishes/:id/groups`, `POST/PUT/DELETE`. Manage group options (which options are in the group, with sort order). Manage group portions (which portion sizes, with extra cents).
4. **Menu Categories**: CRUD with slug, sort order, active, isSecret.
5. **Menu Items**: add/remove dishes to/from categories, with sort order.
6. **Company hiding**: `POST/DELETE /companies/:id/hidden-categories`, `/companies/:id/hidden-items`.
7. **Price Tiers**: CRUD. Derivation (NONE, COST_FACTOR, TIER_FACTOR). Cycle check on save.
8. **Tier Grid**: `GET /pricing/tiers/:id/grid?kind=dish|option&missing=true&q=&page=` → rows with `{ id, name, sku?, costCents, overrideCents, derivedCents, effectiveCents, source }`. `PUT /pricing/tiers/:id/grid` → batch `[{id, priceCents|null}]`.
9. **MenuService.resolveForEmployee(employeeId)**: returns the full menu with prices, applying all visibility rules (active, company hiding, tier pricing, required group availability). Used by preview AND order validator.
10. **Menu preview**: `GET /menu/preview?employeeId=&slug=` → resolved menu.

### Test instructions
```bash
pnpm dev
# Create allergens, tags, stations via /ref endpoints
# POST /api/dishes — create a dish with allergens/tags/station
# POST /api/dishes/:id/groups — create a required option group
# Add options to the group
# Create a price tier (Standard, default, NONE)
# Set a price on the tier: PUT /api/pricing/tiers/:id/grid [{dishId, priceCents: 500}]
# GET /api/pricing/tiers/:id/grid?kind=dish — should show the dish with effectiveCents
# Create a company (even minimal), an employee
# GET /api/menu/preview?employeeId=xxx — should show the dish with price
# Create a COST_FACTOR tier, verify derived prices compute correctly
```

### Commit gate
Can create full catalogue, set prices, preview resolves correctly.

---

## Phase 4: Companies + Employees (Sonnet)

### What to build
1. **Companies CRUD**: name (unique), billing info, delivery defaults, working days, tier assignment, default driver. Toggle active.
2. **Company Domains**: add/remove. Unique globally. Public domain blocklist (gmail.com, yahoo.com, hotmail.com, outlook.com). Case-insensitive (store lowercase).
3. **Company Addresses**: CRUD. One default per company.
4. **Company Calendar**: holidays (add/remove). Working days on the company model.
5. **Employees CRUD**: name, email (unique), phone, permission flags (canChooseAddress, canChangeTime, canChangePackaging), allergies, dietary prefs. Must belong to a company.
6. **Company owner**: set owner (must be an employee of that company). Nullable at creation.
7. **Employee move**: blocked while Draft/Placed orders exist for that employee.

### Test instructions
```bash
pnpm dev
# POST /api/companies — create company with billing info
# POST /api/companies/:id/domains — add "acme.com"
# Try adding "gmail.com" → 422
# POST /api/companies/:id/addresses — create address
# POST /api/employees — create employee for the company
# PUT /api/companies/:id — set ownerEmployeeId
# GET /api/companies/:id — shows full company with domains, addresses, employees
```

### Commit gate
Full company + employee management works. Domain uniqueness enforced. Owner validation works.

---

## Phase 5: Orders + Cut-off (Opus for validator/cutoff, Sonnet for CRUD/list)

### What to build
1. **OrderValidator** service: implements all 9 validation steps from the Orders Design section. Returns structured field errors (`lines.0.combinations.1.selections.protein`).
2. **`POST /orders/preview`**: runs validation + pricing without persisting. Returns breakdown + all errors.
3. **`POST /orders`**: create draft (saves draftPayload JSON).
4. **`POST /orders/:id/place`**: validates fully, creates OrderLine + OrderLineCombination + CombinationOption rows with snapshots.
5. **`PUT /orders/:id`**: edit draft (updates payload) or placed order (re-validates, re-prices, replaces rows, bumps version). Conditional on version.
6. **`POST /orders/:id/cancel`**: cancel draft/placed (before cut-off, or admin anytime). If invoiced → create Adjustment.
7. **`POST /orders/:id/reject`**: admin only, reason required.
8. **CutoffService**: `processDate(date, trigger, force?)` with `pg_try_advisory_xact_lock` inside tx. Cancel drafts, confirm placed (create drops, set planned times).
9. **Cut-off sweep**: cron every minute — find unprocessed dates where cut-off has passed and process them.
10. **Manual trigger**: `POST /cutoff/run { date, force? }` — admin only.
11. **Order list**: `GET /orders?from&to&status[]&companyId&invoiced&q&page&pageSize&sort`. Paginated.
12. **Order detail**: `GET /orders/:id` — lines, combinations, options, money, delivery snapshot, locked flag, available actions.
13. **Admin overrides**: `PUT /orders/:id/override { deliveryTimeMin?, addressId?, packaging? }` — only while not out for delivery.

### Test instructions
```bash
pnpm dev
# Prerequisites: company, employee, dishes with prices, menu items (from Phase 3-4)
# POST /api/orders { employeeId, deliveryDate: future date, draftPayload: {...} } → draft created
# POST /api/orders/:id/place → validates and creates snapshot rows
# GET /api/orders/:id → see full breakdown
# POST /api/cutoff/run { date: that delivery date, force: true } → drafts cancelled, placed confirmed
# POST /api/cutoff/run { date: same date } → second run, 0 confirmed, 0 cancelled (idempotent)
# GET /api/orders?status=CONFIRMED → see the confirmed order
# POST /api/orders/:id/cancel (as admin) → cancelled
```

### Commit gate
Order create → place → cut-off → confirm flow works. Cut-off is idempotent. Second run is harmless. Admin override works.

---

## Phase 6: Kitchen (Sonnet, Opus reviews concurrency)

### What to build
1. **Board query**: `GET /kitchen/board?date&stationId` → orders with their prep units, grouped by station. Efficient single query. Only CONFIRMED orders.
2. **Start unit**: `POST /kitchen/units/:id/start` — tx with `SELECT ... FOR UPDATE` on order row. Sets `startedAt`. Updates `order.kitchenStartedAt` if first. 409 if already started.
3. **Done unit**: `POST /kitchen/units/:id/done` — same lock. Sets `startedAt` (COALESCE), `doneAt`. Checks if all units done → sets `order.kitchenReadyAt`. 409 if already done.
4. **Force-complete**: `POST /kitchen/orders/:id/force-complete` — admin. Sets all unstarted/unfinished units and order timestamps in one tx.
5. **Late/at-risk**: computed in the board query. Late = `now > plannedKitchenReadyAt`. At-risk = within 60 min and has unstarted units.

### Test instructions
```bash
pnpm dev
# Need confirmed orders (from Phase 5 or seed)
# GET /api/kitchen/board?date=2026-10-04 → should show prep units
# POST /api/kitchen/units/:unitId/start → unit started
# POST /api/kitchen/units/:unitId/done → unit done
# Check order: kitchenReadyAt set when all units done
# POST /api/kitchen/units/:unitId/start again → 409 ALREADY_STARTED
# Force-complete: POST /api/kitchen/orders/:orderId/force-complete → all units done
```

### Commit gate
Kitchen board loads. Start/done work with proper locking. Force-complete works. Concurrent operations don't corrupt.

---

## Phase 7: Dispatch + Driver (Sonnet)

### What to build
1. **Dispatch board**: `GET /dispatch/board?date` → drops grouped by stage, with order counts.
2. **dispatch-ready**: `POST /drops/:id/dispatch-ready` — all orders must have `kitchenReadyAt`. Sets `dispatchReadyAt` on orders.
3. **assign-driver**: `POST /drops/:id/assign-driver { driverId }` — sets `driverId` on drop.
4. **out-for-delivery**: `POST /drops/:id/out-for-delivery` — needs dispatch-ready + driver. Sets `outForDeliveryAt`.
5. **deliver**: `POST /drops/:id/deliver { note? }` — needs out-for-delivery. Sets `deliveredAt` on orders + drop. Computes `onTime`. Sets order status to DELIVERED.
6. **Driver endpoint**: `GET /driver/drops` → drops where `driverId = me` and `deliveryDate = today`. Sorted by time. Minimal DTO.
7. **Admin override re-keying**: when time/address changes on a confirmed order, find-or-create the target drop, move the order.

### Test instructions
```bash
pnpm dev
# Need confirmed orders with kitchenReadyAt (run kitchen force-complete)
# GET /api/dispatch/board?date=today → shows drops
# POST /api/drops/:id/dispatch-ready → sets dispatch ready
# POST /api/drops/:id/assign-driver { driverId: driver-user-id } → driver assigned
# POST /api/drops/:id/out-for-delivery → out for delivery
# POST /api/drops/:id/deliver { note: "Left at reception" } → delivered
# Login as driver → GET /api/driver/drops → sees only own drops
# Login as kitchen → GET /api/driver/drops → 403
```

### Commit gate
Full dispatch flow works. Driver sees only own drops. Prerequisites enforced.

---

## Phase 8: Billing (Sonnet)

### What to build
1. **Unbilled orders**: `GET /billing/companies/:id/unbilled` → confirmed/delivered orders where `invoiceId IS NULL`, grouped by delivery date with totals.
2. **Create invoice**: `POST /invoices { companyId, orderIds[] }` — tx: conditional update `invoiceId`, create InvoiceItems, compute total. 409 if any order already invoiced or not billable.
3. **Invoice list**: `GET /invoices?companyId&status&page` — paginated.
4. **Invoice detail**: `GET /invoices/:id` — items, orders, total.
5. **Mark paid**: `POST /invoices/:id/pay` — sets `paidAt`, status=PAID.
6. **Adjustments**: auto-created when cancelling/rejecting an invoiced order. `GET /adjustments?companyId`.

### Test instructions
```bash
pnpm dev
# Need confirmed/delivered orders (from earlier phases)
# GET /api/billing/companies/:companyId/unbilled → shows unbilled orders
# POST /api/invoices { companyId, orderIds: [...] } → invoice created
# GET /api/invoices/:id → shows items and total
# Total must equal sum of order totals
# POST /api/invoices/:id/pay → marked paid
# Cancel an invoiced order → adjustment created
# GET /api/adjustments?companyId → shows the adjustment
```

### Commit gate
Invoice create/pay works. Cancel-after-invoice creates adjustment. Totals reconcile.

---

## Phase 9: Seed Data (Sonnet)

### What to build
1. **Seed generator** (`apps/api/src/seed.ts` or `seed.service.ts`): deterministic, date-relative.
   - Reference data: allergens, dietary tags, stations, portion sizes
   - Catalogue: ~20-30 dishes across 5 categories (including one secret), options, groups
   - Tiers: Standard (default, explicit), Enterprise (TIER_FACTOR 90%), Partner (COST_FACTOR ×2.4)
   - 5 companies with domains, addresses, employees, holidays, different tiers
   - Orders across `[today-10, today+7]`: past (DELIVERED, CANCELLED), today (CONFIRMED with partial kitchen progress, drops for driver@test.com in all stages), future (PLACED, DRAFT)
   - One invoice (PAID), one invoice (ISSUED), some unbilled orders, one adjustment
   - `cutoffHoldDates` with one future locked date left unprocessed (with Draft+Placed orders)
   - driver@test.com assigned to ≥4 drops today
2. **Tag all seed data** `source=DEMO`. Never touch `source=STAFF` data.
3. **Trigger**: boot (if `SEED_ON_BOOT=true`), `POST /admin/reseed` (admin only), daily cron at 00:05 kitchen TZ.
4. **Idempotent**: upsert by natural keys. Safe to re-run.

### Test instructions
```bash
pnpm dev  # seed runs on boot
# Login as admin → dashboard should show today's orders
# Login as kitchen → board should show prep units for today
# Login as dispatch → drops for today visible
# Login as driver → ≥4 drops today in varied stages
# Go to Settings → cutoffHoldDates shows one date
# Trigger manual cut-off for that date → drafts cancelled, placed confirmed
```

### Commit gate
All 4 roles see meaningful data. Manual cut-off demo works. Data is relative to today.

---

## Phase 10: Frontend (Sonnet/Gemini)

### What to build
1. **App shell**: sidebar with navigation items (gated by permissions). Use the `permissions` array from `/auth/me`. Redirect to `landingPath` after login.
2. **Auth state**: `useCan(permission)` hook. Route protection (redirect to login or show 403).
3. **Install shadcn/ui** (`npx shadcn@latest init`), install needed components: button, input, select, dialog, table, toast, tabs, card, badge, dropdown-menu.
4. **Pages** (use TanStack Query for data fetching + polling, react-hook-form + zod for forms):
   - `/dashboard` — admin dashboard (4-5 cards from Dashboard Design)
   - `/orders` — paginated list with filters
   - `/orders/new` — order builder (stepper: employee+date → menu → combinations → delivery → review)
   - `/orders/[id]` — detail with timeline and actions
   - `/kitchen` — kitchen board (station tabs, unit Start/Done buttons, late/at-risk banding)
   - `/dispatch` — dispatch board (drops by stage, driver assign, action buttons)
   - `/driver` — driver view (mobile-first cards, deliver button with note)
   - `/billing` — company billing (unbilled orders, create invoice, invoice list)
   - `/companies` — list + detail (tabs: general, calendar, addresses, employees, menu/pricing)
   - `/employees` — list
   - `/catalogue/dishes` — list + detail (groups editor)
   - `/catalogue/options` — list
   - `/catalogue/reference` — allergens, tags, stations, portions
   - `/menu` — categories, items, preview as employee
   - `/pricing` — tier list + grid editor
   - `/settings` — all settings, kitchen holidays, cut-off trigger
   - `/staff` — user management

### Design principles
- Dark theme, modern. Use Tailwind + shadcn/ui.
- Kitchen board: station tabs, risk banding (red=late, amber=at-risk), unit buttons.
- Driver view: single column, big tap targets, phone-friendly.
- Forms show server field errors inline.
- Lists use server-side pagination.
- "Waking server…" spinner on first slow API response.

### Test instructions
```bash
pnpm dev
# Login as each role → lands on correct page
# Admin: can see all sidebar items, create order, manage companies, etc.
# Kitchen: sees kitchen board, can start/done units
# Dispatch: sees dispatch board, can assign drivers
# Driver: sees only driver page, can mark delivered
# Order builder: select employee → pick date → see menu → add combinations → review → place
```

### Commit gate
All 4 roles can do their core job through the UI.

---

## Phase 11: Dashboards + README + Polish (Sonnet/Gemini)

### What to build
1. **Dashboard cards** for each role (see Dashboard Design section). Each card shows "how calculated" info.
2. **README.md**: local setup, architecture overview, data model diagram (mermaid), key decisions, ambiguity register, dashboard definitions (what, why, formula per figure), prioritisation notes (built/skipped/why), what you'd do next.
3. **Lint/typecheck clean**: `pnpm lint && pnpm typecheck` must pass.
4. **Live smoke test**: deploy to Render + Vercel. Test all 4 accounts. Verify:
   - Admin can create/manage everything
   - Kitchen board shows prep units, start/done works
   - Dispatch board shows drops, can assign driver and complete delivery
   - Driver sees drops, can mark delivered
   - Billing works
   - Manual cut-off demo works
   - Data looks realistic

### Test instructions
```bash
pnpm lint && pnpm typecheck && pnpm test  # all green
pnpm build                                 # builds successfully
# Deploy and test all 4 accounts on live URL
```

### Commit gate
Everything works live. README is complete. Clean commit history.

---

# PHASE PROMPTS

Copy-paste these when starting each phase conversation with an agent.

---

### Prompt for Phase 1
```
Read docs/ASSIGNMENT.md (the spec) and docs/MASTERPLAN.md (Phase 1 section + all reference sections above it).

Execute Phase 1: Schema + Pure Domain + Tests.

Build everything listed in Phase 1. Follow the data model, pricing engine, and conventions exactly as specified.

After coding, tell me exactly how to test (commands to run, what to verify). I will test, and if it works, we commit.

Do not modify any existing working code unless Phase 1 explicitly says to. Do not start any other phase.
```

### Prompt for Phase 2
```
Read docs/ASSIGNMENT.md and docs/MASTERPLAN.md (Phase 2 section + reference sections).

Execute Phase 2: API Infrastructure.

Build the auth guards, permissions system, settings, kitchen holidays, reference data CRUD, staff module, meta endpoint, and global exception filter as described.

After coding, tell me how to test. I test, then we commit. Do not touch other phases.
```

### Prompt for Phase 3
```
Read docs/ASSIGNMENT.md and docs/MASTERPLAN.md (Phase 3 section + reference sections).

Execute Phase 3: Catalogue + Pricing + Menu.

Build dishes, options, groups, menu categories/items, price tiers, tier grid, and menu resolution service as described.

After coding, tell me how to test. I test, then we commit.
```

### Prompt for Phase 4
```
Read docs/ASSIGNMENT.md and docs/MASTERPLAN.md (Phase 4 section + reference sections).

Execute Phase 4: Companies + Employees.

Build company CRUD (domains, addresses, calendar, defaults), employee CRUD, owner validation, and move rules as described.

After coding, tell me how to test. I test, then we commit.
```

### Prompt for Phase 5
```
Read docs/ASSIGNMENT.md and docs/MASTERPLAN.md (Phase 5 section + all order/cutoff reference sections).

Execute Phase 5: Orders + Cut-off.

This is the most complex phase. Build the order validator (all 9 steps), order preview, draft/place/edit/cancel/reject, cut-off service with pg_try_advisory_xact_lock, sweep cron, manual trigger, order list/detail, and admin overrides.

CRITICAL: Use pg_try_advisory_xact_lock (transaction-level), NOT pg_try_advisory_lock (session-level). Neon pooled connections break session locks.

After coding, tell me how to test. I test, then we commit.
```

### Prompt for Phase 6
```
Read docs/ASSIGNMENT.md and docs/MASTERPLAN.md (Phase 6 section + kitchen design reference).

Execute Phase 6: Kitchen.

Build board query, start/done with FOR UPDATE concurrency, force-complete, and late/at-risk computation.

CRITICAL: Every unit operation must SELECT ... FOR UPDATE on the Order row first, inside a transaction. This prevents the READ COMMITTED race condition.

After coding, tell me how to test. I test, then we commit.
```

### Prompt for Phase 7
```
Read docs/ASSIGNMENT.md and docs/MASTERPLAN.md (Phase 7 section + dispatch design reference).

Execute Phase 7: Dispatch + Driver.

Build drops, stage transitions (dispatch-ready, assign-driver, out-for-delivery, deliver), driver-scoped endpoint, on-time calculation, and admin override re-keying.

After coding, tell me how to test. I test, then we commit.
```

### Prompt for Phase 8
```
Read docs/ASSIGNMENT.md and docs/MASTERPLAN.md (Phase 8 section + billing design reference).

Execute Phase 8: Billing.

Build unbilled orders, invoice create/pay, adjustments on cancel-after-invoice.

After coding, tell me how to test. I test, then we commit.
```

### Prompt for Phase 9
```
Read docs/ASSIGNMENT.md and docs/MASTERPLAN.md (Phase 9 section).

Execute Phase 9: Seed Data.

Build the date-relative seed generator. Must create realistic data for all roles. driver@test.com must have ≥4 drops today. One future date with unprocessed cut-off for demo. All seed data tagged source=DEMO.

After coding, tell me how to test. I test, then we commit.
```

### Prompt for Phase 10
```
Read docs/ASSIGNMENT.md and docs/MASTERPLAN.md (Phase 10 section + dashboard design reference).

Execute Phase 10: Frontend.

Build the full admin panel UI. Install shadcn/ui. Use TanStack Query for data, react-hook-form + zod for forms. Dark theme, modern design. Each role must be able to do their core job. Driver view must be phone-friendly.

After coding, tell me how to test. I test, then we commit.
```

### Prompt for Phase 11
```
Read docs/ASSIGNMENT.md and docs/MASTERPLAN.md (Phase 11 section + dashboard design reference).

Execute Phase 11: Dashboards + README + Polish.

Build dashboard cards for each role. Write the README with all required sections. Make lint/typecheck clean. Prepare for deployment.

After coding, tell me how to test. I test, then we commit and deploy.
```
