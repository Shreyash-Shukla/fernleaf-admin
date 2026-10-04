# Fernleaf Kitchen — Operations Admin Panel

> **Heizen Engineering Assignment: Kitchen Operations Admin Panel**  
> An enterprise-grade, multi-role internal operations platform for corporate meal programs. Built with **Next.js 15 (App Router)**, **NestJS**, **Prisma 6**, and **PostgreSQL (Neon)**.

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=flat-square&logo=nestjs&logoColor=white)](https://nestjs.com/)
[![Next.js](https://img.shields.io/badge/Next.js%2015-black?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org/)
[![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=flat-square&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

---

## 1. Live Deployment & Reviewer Credentials

- **Live Frontend URL:** *(or custom Vercel domain)*
- **Live API Backend URL:** 
- **Database:** Hosted PostgreSQL on Neon (Serverless Postgres with Connection Pooling)

### Test Accounts (Mandatory Credentials)

The system automatically seeds four distinct accounts on boot with exact permissions:

| Role | Email | Password | Landing Page | Operational Scope |
|------|-------|----------|--------------|-------------------|
| **Admin** | `admin@test.com` | `Test@1234` | `/dashboard` | Unrestricted (`*`): catalogue, pricing, companies, orders, overrides, billing, settings |
| **Kitchen** | `kitchen@test.com` | `Test@1234` | `/kitchen` | Prep line units, station routing, start/done units, late/at-risk indicators |
| **Dispatch** | `dispatch@test.com` | `Test@1234` | `/dispatch` | Consolidated drops, dispatch staging, driver assignment, delivery tracking |
| **Driver** | `driver@test.com` | `Test@1234` | `/driver` | Mobile-first personal daily route, proof of delivery notes, photo upload |

---

## 2. Quick Local Setup

### Prerequisites
- **Node.js** >= 18.18.0 (Node 20+ recommended)
- **pnpm** >= 9.0.0
- **PostgreSQL Database** (e.g. Neon, local Postgres, or Docker)

### Installation & Environment

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Shreyash-Shukla/fernleaf-admin.git
   cd fernleaf-admin
   ```

2. **Install monorepo dependencies:**
   ```bash
   pnpm install
   ```

3. **Configure Environment Variables:**
   Copy `.env.example` to `.env` in the root:
   ```env
   DATABASE_URL="postgresql://user:password@ep-pooler.region.neon.tech/neondb?sslmode=require"
   DIRECT_URL="postgresql://user:password@ep-direct.region.neon.tech/neondb?sslmode=require"
   JWT_SECRET="REDACTED_JWT_SECRET"
   PORT=3001
   API_ORIGIN="http://localhost:3001"
   ```

4. **Run Database Migrations & Build Shared Package:**
   ```bash
   cd apps/api
   npx prisma migrate dev
   cd ../..
   pnpm --filter shared build
   ```

5. **Start Development Servers:**
   ```bash
   pnpm dev
   ```
   - **Frontend App:** `http://localhost:3000`
   - **NestJS API:** `http://localhost:3001`
   - **API Health Check:** `http://localhost:3001/health`

6. **Run Verification Suites:**
   ```bash
   pnpm test         # Runs 196 unit & integration tests (shared + api)
   pnpm typecheck    # Strict TypeScript check across all packages
   pnpm lint         # Monorepo linting
   pnpm build        # Optimized production build (NestJS + Next.js static & dynamic routes)
   ```

---

## 3. Architecture Overview

The system is structured as a clean monorepo with strict layer boundaries:

```
fernleaf-admin/
├── apps/
│   ├── api/             # NestJS Backend Application
│   │   ├── prisma/      # Schema, migrations, client generator
│   │   └── src/         # Auth, Orders, Kitchen, Dispatch, Billing, Settings, Seeds
│   └── web/             # Next.js 15 (App Router) Frontend
│       ├── app/         # Gated route pages (/dashboard, /kitchen, /dispatch, /driver, ...)
│       ├── components/  # Atomic UI (shadcn/ui), AppShell, Dialogs, CalculationInfo
│       └── lib/         # API client, Auth Context, TanStack Query hooks, formatters
├── packages/
│   └── shared/          # Pure Domain Library (zero framework dependencies)
│       └── src/         # Money, Dates, Cut-off, Pricing Derivation, Combinations, Enums
└── docs/                # ASSIGNMENT.md, MASTERPLAN.md
```

### Key Architectural Tenets
1. **Zero Client-Side Business Logic Bypassing API:** All business validations (9-step order pipeline, cutoff locks, price calculation, status transitions) are executed server-side in NestJS. Next.js does not run server actions that bypass the API.
2. **Pure Domain Core (`packages/shared`):** Pure TypeScript functions for financial math, combination signatures, cutoff back-counting, and tier price resolution. This ensures the exact same logic can be unit-tested in isolation without database mocks.
3. **HTTP Cookie Authentication with Reverse Proxy:** Next.js proxies `/api/:path*` to the NestJS API via `next.config.mjs`. Authentication uses secure `httpOnly`, `sameSite: 'lax'` JWT cookies.
4. **Fine-Grained Permission Guards:** `@RequirePermissions('order:write')` decorator enforced via `PermissionsGuard`. Roles are pure groupings of permissions (`['*']` for admin, specific actions for staff). Adding future roles requires zero code modifications.

---

## 4. Data Model Diagram

```mermaid
erDiagram
    Role ||--o{ User : "assigned to"
    User ||--o{ Order : "creates / processes"
    User ||--o{ Drop : "drives / delivers"
    User ||--o{ Invoice : "issues"

    Company ||--o{ CompanyDomain : "owns (unique)"
    Company ||--o{ CompanyAddress : "has delivery locations"
    Company ||--o{ CompanyHoliday : "observes"
    Company ||--o{ Employee : "employs"
    Company }o--|| PriceTier : "assigned tier"
    Company ||--o{ Order : "billed for"
    Company ||--o{ Drop : "receives"
    Company ||--o{ Invoice : "billed on"
    Company ||--o{ Adjustment : "incurred"

    PriceTier ||--o{ DishTierPrice : "overrides dish"
    PriceTier ||--o{ OptionTierPrice : "overrides option"
    PriceTier }o--o| PriceTier : "derives from base"

    MenuCategory ||--o{ MenuItem : "contains"
    MenuItem }o--|| Dish : "links"
    Company ||--o{ CompanyHiddenCategory : "hides category"
    Company ||--o{ CompanyHiddenItem : "hides dish"

    Dish ||--o{ OptionGroup : "has choices"
    OptionGroup ||--o{ OptionGroupOption : "offers options"
    OptionGroup ||--o{ OptionGroupPortion : "offers sizes"
    Dish }o--o| KitchenStation : "routed to"
    Dish ||--o{ DishAllergen : "contains"
    Dish ||--o{ DishDietaryTag : "tagged with"

    Order ||--o{ OrderLine : "contains dishes"
    OrderLine ||--o{ OrderLineCombination : "prep units"
    OrderLineCombination ||--o{ CombinationOption : "selected options"

    Order }o--o| Drop : "consolidated into"
    Order }o--o| Invoice : "billed on (single)"
    Invoice ||--o{ InvoiceItem : "line items"
    Order ||--o{ Adjustment : "credit/debit on change"
```

---

## 5. Key Decisions & Technical Trade-offs

### 1. Integer Cents Everywhere (No Floats)
- **Decision:** Money is stored and calculated strictly as integer cents (`Int` in Prisma/Postgres, `number` in TypeScript). Max boundary: 100,000,000 cents ($1,000,000).
- **Rationale:** Floating-point IEEE-754 arithmetic introduces micro-cents discrepancies (e.g. `0.1 + 0.2 = 0.30000000000000004`). Invoicing, order lines, and combination sums reconcile down to the exact single cent.
- **Derived Price Rounding:** The spec requires derived tier prices to round **up** to the next 5 cents. We implemented this using pure integer math: `ceil(baseCents * factorBps / 50000) * 5`.

### 2. Timezone Isolation & "Today"
- **Decision:** The platform operates in one authoritative kitchen timezone: `Asia/Kolkata` (stored in platform `Setting` and configurable at runtime).
- **Rationale:** A delivery date is a logical `'YYYY-MM-DD'` date, not a UTC timestamp that shifts across midnight based on browser geolocation. The API exposes `GET /meta` (`{ today, nowIso, timezone }`). The frontend never computes "today" locally. Cut-off deadlines and delivery dates are rock solid regardless of where reviewers or drivers are located.

### 3. Concurrency Protection & Neon Connection Pooling
- **Cut-off Processing:** Cut-off confirms orders and cancels drafts. To ensure idempotency and prevent duplicate confirmations, cut-off runs inside a database transaction acquiring `SELECT pg_try_advisory_xact_lock($1)`. Session-level locks break with connection poolers like Neon; transaction-level locks automatically release upon commit or rollback.
- **Kitchen Unit State:** When cooks click "Start" or "Done", the transaction first executes `SELECT id FROM "Order" WHERE id = $1 FOR UPDATE`. This row-level lock serializes concurrent line operations on the same order, guaranteeing `kitchenReadyAt` is triggered only when the very last unit completes.

### 4. Consolidated Drops Entity
- **Decision:** Orders sharing `(deliveryDate, companyId, addressId, deliveryTimeMin)` are automatically grouped into a single `Drop`.
- **Rationale:** A kitchen does not send 10 separate couriers for 10 employees at the same office who want lunch at 12:00 PM. Drop progression is all-or-nothing: dispatch-ready requires all orders in the drop to be cooked; out-for-delivery requires an assigned driver; marking delivered completes all orders simultaneously.

### 5. Post-Confirmation Invoicing & Adjustments
- **Decision:** An order belongs to at most one `Invoice` (`Order.invoiceId`). Once an order is invoiced, it cannot be modified or re-billed.
- **Handling Post-Invoice Cancellations/Rejections:** If an admin cancels or rejects an invoiced order, an `Adjustment` record is created with negative `amountCents` linked to the company. The next invoice automatically credits the adjustment against the company's bill.

---

## 6. Ambiguity Register

How ambiguous requirements from `docs/ASSIGNMENT.md` were interpreted and resolved:

| ID | Ambiguity in Spec | Resolution & Business Justification |
|----|-------------------|--------------------------------------|
| **A1** | Timezone of kitchen operations | Fixed to `Asia/Kolkata` as platform default; stored in dynamic `Setting` so staff can change it without code redeployment. |
| **A2** | Secret menu categories | Hidden from standard category listings; accessible directly via unique slug (`/menu?slug=secret-vip`). Dishes inside remain orderable by authorized staff. |
| **A3** | Delivery on kitchen non-working days | Strictly rejected during order validation. Meals cannot be delivered when the kitchen is closed, even if the corporate client is open. |
| **A4** | Dish option with missing tier price | If an option has no price on the client's tier, that option is omitted. If a required option group has zero priced options, the whole dish is hidden from that client. |
| **A5** | $0 dish pricing | A dish resolved to $0 is treated as unpriced and omitted from the menu. However, a $0 option surcharge (e.g. brown rice with $0 extra fee) is valid. |
| **A6** | Chained tier derivations | Chained derivation (Tier B derives from Tier A which derives from Cost) applies 5-cent ceil rounding at each tier step. Cycles are detected and rejected (depth cap 5). |
| **A7** | Employee company transfer | Blocked if the employee has active `DRAFT` or `PLACED` orders. Past delivered orders permanently retain their original `companyId` for accurate billing history. |
| **A8** | Option selection per group | Single selection per group (e.g. choose 1 protein, choose 1 rice). Multiple options can be offered across multiple groups. |
| **A9** | Portion size pricing | Portions apply flat surcharges per group-size (`OptionGroupPortion.extraCents`), remaining tier-independent. |
| **A10** | Editing Placed orders | Allowed before cut-off. Re-runs the full 9-step validator and re-prices lines at current active catalogue prices. |
| **A11** | Post-confirmation line edits | Dish quantities cannot be edited after cut-off. Staff must cancel the order and create an override order. |
| **A12** | Catalogue deactivation vs Placed orders | Deactivating a dish soft-deletes it (`active: false`). Existing placed orders still confirm and cook because prices and dish details were snapshotted at placement time. |
| **A13** | "Rejected" status | Admin-only terminal status (e.g. inability to source ingredients, client non-payment). Non-billable; if invoiced, generates a negative adjustment. |

---

## 7. Dashboards Specification (Section 4.11)

Every role lands on its dedicated dashboard upon login. In addition, the **Admin Operations Hub** features an interactive **Role View Switcher** (`Admin | Kitchen | Dispatch | Driver`), enabling reviewers to inspect every role's live dashboard cards without relogging. Every card features an **(i) Calculation Info** dialog detailing exact inclusion rules, formulas, and edge cases.

### 1. Admin Executive Dashboard (`/dashboard`)
*Designed for operations directors managing capacity, cut-offs, revenue, and cashflow.*

| Card / Figure | Why Needed | Exact Formula & Inclusion Criteria | Date Basis | Exclusions & Missing Data |
|---|---|---|---|---|
| **Today's Orders by Status** | Instant overview of total daily volume across confirmation stages. | `COUNT(*) GROUP BY status WHERE deliveryDate = todayInKitchenTz`. | `deliveryDate = today` in kitchen timezone. | Cancelled & Rejected orders are counted in total attempts and badged distinctly, but omitted from active cooking. |
| **Next Cut-off Window** | Critical deadline tracker. When it hits, drafts cancel and placed orders confirm. | `cutoffAt(deliveryDate, settings)`. Earliest deadline `> now`. Countdown: `cutoffInstant - now`. | Next target delivery date, skipping kitchen weekends & holidays. | Dates in `cutoffHoldDates` setting are paused from automated sweep for reviewer manual demonstration. |
| **7-Day Order Pipeline Value** | Measures committed commercial pipeline to forecast kitchen inventory and revenue. | `SUM(totalCents) WHERE status IN ('PLACED', 'CONFIRMED', 'DELIVERED') AND deliveryDate BETWEEN today AND today + 7d`. | `today <= deliveryDate <= today + 7d`. | `DRAFT`, `CANCELLED`, and `REJECTED` are excluded ($0). Pre-tax integer cents. |
| **Kitchen Prep Today** | Live progress of today's meal production and schedule adherence. | `doneUnits / totalUnits` where `totalUnits = COUNT(OrderLineCombination)` on CONFIRMED orders. Late = `now > plannedKitchenReadyAt`. | `deliveryDate = today`. | Drafts and cancelled orders have no prep units. If order has no dishes, 0 units. |
| **Unbilled Receivables** | Monitors cashflow exposure awaiting batch corporate invoice issuance. | `SUM(Order.totalCents) + SUM(Adjustment.amountCents) WHERE status IN ('CONFIRMED', 'DELIVERED') AND invoiceId IS NULL`. | All fulfilled orders across past and present dates. | Unconfirmed orders are not billable. Invoiced orders have `invoiceId` set and are omitted. |

**What we chose NOT to show:**
- Complex multi-year trend charts (irrelevant for daily operations decisions).
- Profit margin percentages (dish cost data is private to procurement; operational staff need throughput, not margin).

---

### 2. Kitchen Lead Dashboard (`/kitchen`)
*Designed for the kitchen lead at 6:00 AM planning prep lines and monitoring line cooks.*

| Card / Figure | Why Needed | Exact Formula & Inclusion Criteria | Date Basis | Exclusions & Missing Data |
|---|---|---|---|---|
| **Meals to Cook** | Total meal volume required today broken down by state. | `Total = SUM(combination.quantity)` for CONFIRMED orders. `Done = doneAt != null`. `In Progress = startedAt != null AND doneAt == null`. `Not Started = startedAt == null`. | `deliveryDate = today`. | Drafts, cancelled, and rejected orders are completely excluded. |
| **By Station (Remaining)** | Identifies immediate backlogs at Hot, Cold, Bakery, or Grill stations to reallocate staff. | `SUM(unit.quantity) WHERE Dish.stationId = station.id AND unit.doneAt IS NULL`. | `deliveryDate = today`. | Dishes without a station are assigned to "Unassigned Station" so no meal is lost. |
| **Late & At-Risk Orders** | Flags orders that need immediate cooking priority to prevent delivery delays. | `Late = now > plannedKitchenReadyAt AND kitchenReadyAt IS NULL`. `At-Risk = deadline within 60m AND has unstarted units`. | `deliveryDate = today`. | Fully cooked orders (`kitchenReadyAt != null`) are never marked late or at-risk. |
| **Next Cooking Deadline** | Tells cooks the very next deadline they are working against right now. | `MIN(plannedKitchenReadyAt) WHERE kitchenReadyAt IS NULL`. | `deliveryDate = today`. | Orders already marked ready are excluded. If all done, shows "All Done!". |

**What we chose NOT to show:**
- Prices and billing info (kitchen cooks care about recipes, dietary tags, allergens, and quantities).

---

### 3. Dispatch Logistics Dashboard (`/dispatch`)
*Designed for dispatch coordinators staging boxes, assigning couriers, and tracking departure.*

| Card / Figure | Why Needed | Exact Formula & Inclusion Criteria | Date Basis | Exclusions & Missing Data |
|---|---|---|---|---|
| **Drops Today by Stage** | Total consolidated stops today across the 5 dispatch stages. | `COUNT(Drop) GROUP BY stage WHERE deliveryDate = today`. Drop stage = minimum stage among active orders. | `deliveryDate = today`. | Drop is unique per `(date, company, address, time)`. |
| **Needs a Driver** | Unassigned delivery routes that cannot depart until assigned. | `COUNT(Drop) WHERE driverId IS NULL AND stage != 'DELIVERED'`. | `deliveryDate = today`. | Delivered drops are excluded. Company default drivers pre-fill where set. |
| **Behind Schedule** | Drops that missed their planned departure window from kitchen. | `COUNT(Drop) WHERE now > plannedDispatchReadyAt AND stage IN ('PREPARING', 'KITCHEN_READY')`. | `deliveryDate = today`. | Once out for delivery, drop adheres to delivery time, not dispatch departure time. |
| **Next 3 Drops** | Sequence of upcoming drop destinations and departure deadlines. | `SELECT TOP 3 Drop ORDER BY deliveryTimeMin ASC WHERE stage != 'DELIVERED'`. | `deliveryDate = today`. | Delivered drops are omitted. |

**What we chose NOT to show:**
- Ingredient-level recipe details (dispatch needs drop address, packaging type, driver notes, and box counts).

---

### 4. Driver Mobile Dashboard (`/driver`)
*Designed mobile-first for the courier in the field delivering meals to office receptions.*

| Card / Figure | Why Needed | Exact Formula & Inclusion Criteria | Date Basis | Exclusions & Missing Data |
|---|---|---|---|---|
| **My Drops Today** | Clear progress counter on the driver's daily delivery run. | `Total = COUNT(Drop) WHERE driverId = me`. `Delivered = stage == 'DELIVERED'`. `Remaining = Total - Delivered`. | `deliveryDate = today`. | Scoped strictly to logged-in driver's user ID. Other drivers' drops are invisible. |
| **Next Destination Details** | Prominent stop details (company name, delivery time, address, driver notes, packaging). | `FIRST(Drop) WHERE driverId = me AND stage != 'DELIVERED' ORDER BY deliveryTimeMin ASC`. | `deliveryDate = today`. | Already delivered stops disappear into completed list. |

**What we chose NOT to show:**
- Back-office operational stats, other drivers' drops, financial invoices, or kitchen station details.

---

## 8. Prioritisation Notes (Section 6)

### What We Built (100% of [Must] Requirements)
- **Catalogue & Option Combinations:** Dishes with SKUs, temperature, cost, allergens, dietary tags, stations, minimum order qty, options, and required/optional groups. Distinct combinations cooked as prep units with snapshot history.
- **Portion Sizes [Should]:** Supported on option groups with per-size extra fee calculation.
- **Dynamic Pricing Engine:** Multi-tier pricing (Standard default, Partner cost-factor, Enterprise tier-factor). 5-cent upward ceiling rounding, explicit overrides, cycle detection, and fallback to default tier.
- **Companies & Employees:** Unique domain enforcement, public domain blocklist, working calendars, delivery defaults, employee dietary prefs, address/time permission flags, and transfer blocks on active orders.
- **Orders & Cut-off System:** 9-step server validation pipeline, draft/placed editing, manual and cron-based cut-off sweep using PostgreSQL transaction advisory locks, and drop creation.
- **Kitchen Board:** Real-time prep unit boards grouped by station, concurrent `FOR UPDATE` locking, force-complete override, and late/at-risk indicators.
- **Dispatch & Driver Views:** Consolidated drops, dispatch-ready prerequisite enforcement, driver assignment, mobile driver view with delivery notes, photo upload simulation, and on-time recording (+10m grace period).
- **Company Billing:** Unbilled order aggregation, batch invoice creation, idempotent invoice attachment, mark as paid, and automatic negative adjustments on post-invoice cancellations.
- **Dynamic Seed Data:** Date-relative generator populating realistic past, today, and future orders, drops in all stages for `driver@test.com`, and a held cutoff date for reviewer testing.
- **Frontend & Dashboards:** Complete modern dark UI with role landing pages, mobile-friendly driver view, and formula-transparent dashboard cards for all 4 roles.

### What We Skipped & Why
- **Bulk Employee CSV Import [Should]:** Prioritized rock-solid order validation, concurrency locking, financial reconciliation, and live smoke testing. Standard CRUD for employees was built instead.
- **Out of Scope Items (Section 5):** Employee credit card payments, multi-order catering trays, complex external accounting software sync, sales tax, and coupon discount codes were explicitly omitted in accordance with the assignment guidelines.

### What We Would Build Next with More Time
1. **Push Notifications & Live WebSocket Feeds:** Implement NestJS WebSockets / SSE for instant dispatch and kitchen updates without 15s interval polling.
2. **Barcode / QR Code Staging:** Generate packing labels with QR codes that drivers scan to mark drops dispatch-ready and out-for-delivery.
3. **Automated PDF Invoice Generation:** Render branded PDF invoice summaries with detailed line breakdowns for corporate client accounting departments.

---

## 9. Verification & Testing Instructions

To test the complete end-to-end lifecycle as an evaluator:

### 1. Test Suite & Code Quality
```bash
pnpm test         # Verify all 196 domain and controller tests pass
pnpm typecheck    # Strict TypeScript checks pass with 0 errors
pnpm lint         # Lint checks pass with 0 errors
pnpm build        # Next.js and NestJS production builds succeed
```

### 2. Live Functional Walkthrough

1. **Sign in as Admin (`admin@test.com` / `Test@1234`):**
   - Lands on `/dashboard`. Observe the 5 Admin metric cards with live countdown.
   - Click the **(i)** icon on any card to view the exact calculation formula.
   - Click the **Role View Switcher** tabs (`Kitchen Lead`, `Dispatch Coordinator`, `Driver Field Run`) to preview the exact dashboard cards for each persona.
   - Visit `/orders/new`: select an employee, pick a valid working date, configure dish combinations, and place the order.
   - Visit `/settings`: observe the held cutoff date. Click **Run Cut-off** to watch placed orders confirm and drafts cancel in real time.
   - Visit `/billing`: view unbilled orders, select a company, and generate an invoice.

2. **Sign in as Kitchen (`kitchen@test.com` / `Test@1234`):**
   - Lands on `/kitchen`. Observe the 4 Kitchen dashboard cards (Meals to Cook, By Station, Late/At-Risk, Next Deadline).
   - Filter by station tabs (Hot Station, Cold Prep, etc.).
   - Click **Start** on a unit (observe state change to In Progress). Click **Done** to complete it.
   - Try navigating to `/billing` or `/settings` — verify access is blocked (403 Forbidden).

3. **Sign in as Dispatch (`dispatch@test.com` / `Test@1234`):**
   - Lands on `/dispatch`. Observe the 4 Dispatch cards (Drops by Stage, Needs a Driver, Behind Schedule, Next 3 Drops).
   - Locate an unassigned drop and assign a driver (`driver@test.com`).
   - If kitchen ready, advance drop to **Dispatch Ready** and then **Out for Delivery**.

4. **Sign in as Driver (`driver@test.com` / `Test@1234`):**
   - Lands on `/driver`. Mobile-friendly layout.
   - Observe **My Drops Today** progress bar and **Next Destination** card.
   - Click **Deliver Drop** on the next drop, enter an optional note (e.g. *"Left at reception"*), and confirm.
   - Notice the on-time indicator and remaining drop count update dynamically.

---

## 10. Submission Checklist

- [x] Mandated Stack: Next.js + NestJS + Prisma + Neon PostgreSQL
- [x] Live deployed frontend and backend URLs
- [x] Four seeded test accounts with exact credentials (`admin`, `kitchen`, `dispatch`, `driver` @test.com / `Test@1234`)
- [x] Date-relative realistic seed data for review day
- [x] Clean Git commit history organized by logical phases
- [x] README with architecture, Mermaid data model, key decisions, ambiguity register, dashboard definitions, and prioritisation notes
- [x] All 196 tests passing, zero TypeScript errors, clean production build
