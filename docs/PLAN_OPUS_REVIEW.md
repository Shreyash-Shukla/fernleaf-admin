# PLAN_OPUS_REVIEW.md

Status: **REVIEW v1** · Reviewer: Opus · Date: 3 Oct 2026 23:30 IST
Time remaining: **~28 h** (deadline 4 Oct 23:59 IST).

---

## 1. Verdict Table

| §  | Section | Verdict | Reason |
|----|---------|---------|--------|
| 0  | Spec traps | **KEEP** | Thorough; minor fix needed (trap 12 advisory lock). |
| 1  | Architecture | **CHANGE** | `shared` package uses raw TS (`main: ./src/index.ts`) — plan says `tsc` to `dist` but repo doesn't do this; keep simpler current approach. Remove CORS note — rewrite proxy handles it. |
| 2  | Prisma data model | **CHANGE** | Schema currently uses `uuid()` not `cuid()`. `User` lacks `active`. `Role` lacks `landingPath`, `dashboardKey`, `isSystem`. Align plan to repo. |
| 3  | Money/time | **KEEP** | Sound. Luxon not yet installed — add when needed. |
| 4  | Pricing engine | **KEEP** | Correct rounding formula. |
| 5  | Menu resolution | **KEEP** | Well-specified. |
| 6  | Orders | **CHANGE** | §6.5 uses `pg_try_advisory_lock` (session lock) — **unsafe on Neon pooled connection**. Fix: `pg_try_advisory_xact_lock` inside the transaction. |
| 7  | Kitchen | **KEEP** | Concurrency design is correct. |
| 8  | Dispatch/driver | **KEEP** | Drop-as-entity is right. |
| 9  | Billing | **KEEP** | Adjustment model is sensible. |
| 10 | Auth/RBAC | **CHANGE** | Auth exists but is simpler: no global guard, no permissions returned by `/me`. Extend, don't rewrite. Seed role permissions don't match plan — upsert will fix. |
| 11 | API conventions | **KEEP** | Standard. |
| 12 | Frontend | **CHANGE** | Tailwind v3 installed. shadcn/ui not yet. Install incrementally — not upfront. |
| 13 | Dashboards | **KEEP** | Cut to 3-4 cards per role to save time. |
| 14 | Settings | **KEEP** | KV + zod registry is pragmatic. |
| 15 | Seed/demo data | **CHANGE** | `ensureDemoFresh` is over-complex. Simplify to: boot seed + daily cron + manual endpoint. Drop login-triggered refresh. |
| 16 | Testing | **CHANGE** | Reduce scope: pure domain unit tests + 2 integration tests (kitchen concurrency, cutoff idempotency). |
| 17 | Build plan | **CHANGE** | 36 h estimate wrong — we have ~28 h. Re-order and trim. |
| 17b | Ambiguity register | **KEEP** | Good. |
| 18 | Self-challenge | **KEEP** | Honest. |

---

## 2. Changes (paste-ready edits)

### 2a. §6.5 advisory lock fix

Replace `pg_try_advisory_lock(hash('cutoff'))` with `pg_try_advisory_xact_lock` **inside** the transaction:
```ts
$transaction(async tx => {
  const got = await tx.$queryRawUnsafe<{pg_try_advisory_xact_lock:boolean}[]>(
    `SELECT pg_try_advisory_xact_lock($1)`, cutoffLockId
  );
  if (!got[0].pg_try_advisory_xact_lock) return { skipped: true };
  // ... rest of cut-off logic ...
});
```
Lock auto-releases at COMMIT/ROLLBACK. No session affinity needed. Safe on Neon pooled connections.

### 2b. §1 Architecture — align to repo

Replace: `shared builds with tsc to dist (CJS), web uses transpilePackages`
With: `shared exposes raw TS (main: ./src/index.ts). web consumes via transpilePackages. No separate build step.`

### 2c. §2 Data model — ID strategy

Replace: `all ids String @id @default(cuid())`
With: `all ids String @id @default(uuid()) — matching existing Role/User models`

Add to User: `active Boolean @default(true)`.
Add to Role: `landingPath String`, `dashboardKey String`, `isSystem Boolean @default(false)`.

### 2d. §12 Frontend — defer shadcn

Replace: `Tailwind + shadcn/ui`
With: `Tailwind v3 (installed). Add shadcn/ui components incrementally via npx shadcn@latest when first needed.`

### 2e. §15 Seed — simplify

Replace `ensureDemoFresh` with:
```
Deterministic date-relative seed. Runs: (1) boot if SEED_ON_BOOT=true,
(2) POST /admin/reseed (admin), (3) daily cron 00:05 kitchen TZ.
All seed data tagged source=DEMO. No login-triggered refresh.
```

### 2f. §16 Testing — reduce scope

```
Unit tests (Vitest): money (8), cutoff (16), pricing (10), combinations (8), orderPricing (4) = ~46 cases.
Integration (DB): kitchen concurrency (1), cutoff idempotency (1).
Skip: menu visibility matrix, full state machine, permission matrix, invoice parallel.
```

---

## 3. Missing or Wrong

| # | Issue | Detail | Fix |
|---|-------|--------|-----|
| 1 | **Advisory lock bug** | Session lock unreliable on Neon pooled connection | Use `pg_try_advisory_xact_lock` inside tx (§2a) |
| 2 | Derived price < 5 cents | `derive(1, 10000) = 5` (rounds 1 cent to 5). Correct per spec but surprising | Document in README |
| 3 | Combination option validation | Must use resolved menu (filtered for active + priced + portioned) not raw DB | Plan implies this but should state explicitly |
| 4 | Address override re-keying | Admin changing address must find-or-create target drop, same as time override | Plan covers generically but worth explicit mention |
| 5 | All orders cancelled on invoice | Invoice stays ISSUED with offsetting adjustments on next invoice | UI should suggest "Void invoice" — plan mentions this |
| 6 | Dashboard SQL timezone | `CURRENT_DATE` uses server TZ (UTC on Render), not kitchen TZ | Pass Luxon-computed date boundaries as params, never use `CURRENT_DATE` |
| 7 | Employee move domain match | Plan requires email domain match on move — spec doesn't mandate this | Drop domain-match requirement. Just block while Draft/Placed orders exist. |
| 8 | `>= today` vs `> today` | Same-day delivery valid if cutoffDays=0 and before cut-off | Plan says `>= today` — correct |
| 9 | Delivery date must be kitchen working day | Plan adds this (A3) — reasonable interpretation, not explicit in spec | Keep, document in README |
| 10 | `Order.number` autoincrement + uuid PK | Works in Prisma 6.x with Postgres SEQUENCE | Confirmed working |

---

## 4. Time Realism

**Actual remaining:** ~24.5 h wall clock, ~18-20 h coding. Plan estimated 34 h. **Not achievable.**

### Revised phased plan

| # | Phase | Hours | Cumulative | Model |
|---|-------|-------|------------|-------|
| P1 | Schema + pure domain + tests | 3.5 | 3.5 | **Opus** |
| P2 | API infra (guards, settings, ref data, error filter) | 2.0 | 5.5 | Sonnet |
| P3 | Catalogue + pricing + menu | 2.5 | 8.0 | Sonnet |
| P4 | Companies + employees | 2.0 | 10.0 | Sonnet |
| P5 | Orders + cut-off (vertical slice) | 3.0 | 13.0 | **Opus** (validator/cutoff) |
| P6 | Kitchen board + concurrency | 2.0 | 15.0 | Sonnet |
| P7 | Dispatch + driver | 2.0 | 17.0 | Sonnet |
| P8 | Billing | 1.5 | 18.5 | Sonnet |
| P9 | Seed data | 2.0 | 20.5 | Sonnet |
| P10 | Frontend (all screens) | 5.0 | 25.5 | Sonnet/Gemini |
| P11 | Dashboards + README + polish | 2.5 | 28.0 | Sonnet/Gemini |

### Cut line (drop in order if behind)
1. CSV import [Should]
2. Portions UI in order builder [Should]
3. Dashboard extras beyond 4 cards/role
4. Delivery photo (keep note-only)
5. Admin late-create
6. Integration tests beyond kitchen concurrency
7. Menu debug preview UI (keep API)
8. Invoice VOID flow (keep ISSUED→PAID only)
9. Adjustment management UI (keep API)

### Never cut
Any [Must] API behavior, server enforcement, 4 accounts, realistic demo data, cut-off correctness, money reconciliation, README.

---

## 5. Over-Engineering to Simplify

| What | Simplification | Saves |
|------|---------------|-------|
| `ensureDemoFresh` with login hook + lazy + advisory | Boot seed + daily cron + manual endpoint | 1.5 h |
| `OrderEvent` timeline table | Use timestamp fields on Order for timeline display | 0.5 h |
| Allergen 2-step 422→retry flow | Checkbox + `acknowledgeAllergens: true` in payload | 0.5 h |
| `CutoffRun` audit table | Console log. Skip table. | 0.3 h |
| `OptionPortionSupport` junction | Validate in service at save time | 0.3 h |
| Invoice VOID with adjustment re-opening | V1: ISSUED→PAID only. Cancel-after-invoice still creates adjustments. | 0.5 h |
| `Clock` DI interface | Simple `getNow(tz)` reading `OVERRIDE_NOW` env in tests | 0.2 h |
| **Total saved** | | **~3.8 h** |

---

## 6. Model Assignment

| Model | Phases | Rationale |
|-------|--------|-----------|
| **Opus** | P1 (domain + tests), P5 (order validator + cutoff service) | Complex business logic, edge cases, concurrency |
| **Sonnet** | P2-P4, P6-P9 | CRUD, API wiring, straightforward NestJS/Prisma |
| **Gemini** | P10-P11 | UI components, README, polish |

Opus budget: **~2-3 sessions**. Everything else is cheaper models.

---

## 7. Top 5 Demo Risks

| # | Risk | Impact | Mitigation |
|---|------|--------|------------|
| 1 | **Render cold start (30-50s)** | Reviewer sees timeout/blank | "Server waking…" spinner on first slow request. UptimeRobot every 5 min. Verify pinger before submit. |
| 2 | **Stale demo data** | Empty "today" screens | Daily cron + boot seed + manual reseed endpoint. Document in README. |
| 3 | **Can't test manual cut-off** | Cut-off already passed for all dates | `cutoffHoldDates` keeps one date unprocessed. Seed ensures Draft + Placed orders exist for it. README instructions. |
| 4 | **Kitchen board empty** | kitchen@test.com sees nothing | Seed creates CONFIRMED orders for today with partial kitchen progress. Smoke test before submit. |
| 5 | **Driver has no drops** | driver@test.com sees empty | Seed creates ≥4 drops for driver@test.com today in varied stages. Smoke test before submit. |

---

## 8. Phased Build Plan (commit gates)

### Phase 1: Schema + Pure Domain (3.5 h) — Opus
- Full Prisma schema, extend existing Role/User with new fields
- `packages/shared/`: money, dates, cutoff, pricing, combinations, orderPricing, permissions, errors, enums
- Vitest unit tests (~46 cases)
- **Gate:** `pnpm test` + `pnpm typecheck` pass → commit

### Phase 2: API Infrastructure (2 h) — Sonnet
- Global JwtAuthGuard + PermissionsGuard + `@Public()`
- `/auth/me` returns permissions, landingPath, dashboardKey
- `/meta` endpoint
- Global exception filter
- Settings + kitchen holidays + reference data CRUD
- **Gate:** guards enforce, settings editable → commit + deploy

### Phase 3: Catalogue + Pricing (2.5 h) — Sonnet
- Dish/option/group CRUD, menu categories/items, company hiding
- Price tiers + grid + menu resolution + preview
- **Gate:** create dish, set price, preview menu → commit

### Phase 4: Companies + Employees (2 h) — Sonnet
- Company CRUD (domains, addresses, calendar, defaults)
- Employee CRUD (flags, allergies)
- **Gate:** full company setup works → commit

### Phase 5: Orders + Cut-off (3 h) — Opus + Sonnet
- Order validator (all 9 steps), preview, create/place/edit/cancel
- Cut-off service (`pg_try_advisory_xact_lock`), sweep, manual trigger
- Order list + detail, admin overrides
- **Gate:** create order → place → cut-off → confirmed → commit + deploy

### Phase 6: Kitchen (2 h) — Sonnet
- Board query, start/done with FOR UPDATE, force-complete, late/at-risk
- **Gate:** kitchen board works, concurrent done safe → commit

### Phase 7: Dispatch + Driver (2 h) — Sonnet
- Drops, stage transitions, driver assign, deliver
- Driver-scoped endpoint, on-time calc
- **Gate:** full dispatch flow, driver sees own drops → commit

### Phase 8: Billing (1.5 h) — Sonnet
- Unbilled, invoice create/pay, adjustment on cancel-after-invoice
- **Gate:** invoice flow works → commit + deploy

### Phase 9: Seed Data (2 h) — Sonnet
- Date-relative generator, all statuses, driver drops, cutoffHoldDates
- Boot trigger + daily cron + manual endpoint
- **Gate:** fresh deploy shows realistic data → commit + deploy

### Phase 10: Frontend (5 h) — Sonnet/Gemini
- App shell, routing, dashboard stubs
- All CRUD forms + boards + driver view
- **Gate:** all 4 roles can do their job → commit + deploy

### Phase 11: Polish + README (2.5 h) — Sonnet/Gemini
- Dashboard cards, lint clean, README, live smoke test
- **Gate:** submission checklist complete → final commit + deploy + submit

---

*End of review. This document is authoritative. Do not edit docs/PLAN.md.*
