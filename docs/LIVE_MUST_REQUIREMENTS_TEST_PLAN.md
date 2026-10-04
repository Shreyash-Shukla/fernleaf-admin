# Live [Must] Requirements Test Plan

This checklist verifies every `[Must]` requirement in `docs/ASSIGNMENT.md` against the deployed application. It is written for manual browser testing, with a few API checks where the requirement is specifically about server-side enforcement.

## Test environment and evidence

- Frontend: Provided deployed application URL (e.g. `$env:E2E_BASE_URL` or reviewer deployment URL).
- API health: `<frontend-url>/api/health` or backend health endpoint.
- Kitchen timezone: `Asia/Kolkata` unless changed in Settings.
- Run the suite in a private/incognito window. Use a separate private window for simultaneous-role and concurrency tests.
- Prefix anything created during testing with `QA-<date>-` so it is easy to identify.
- For every failure, capture: test ID, account, URL, exact inputs, expected result, actual result, screenshot/video, browser console error, and the failed network request/response.
- A visual success is not enough for permission or validation tests. Confirm the corresponding API response in browser DevTools > Network.

## Accounts

| Role | Email | Password | Expected landing page |
|---|---|---|---|
| Admin | `admin@test.com` | `Test@1234` | `/dashboard` |
| Kitchen | `kitchen@test.com` | `Test@1234` | `/kitchen` |
| Dispatch | `dispatch@test.com` | `Test@1234` | `/dispatch` |
| Driver | `driver@test.com` | `Test@1234` | `/driver` |

## Recommended execution order

1. Deployment, seed data, authentication, and permissions.
2. Admin master data: catalogue, menu, pricing, companies, employees, settings.
3. Create two orders for the same drop: one draft and one placed.
4. Run cut-off and verify cancellation/confirmation.
5. Complete kitchen, dispatch, driver, and billing workflows using the confirmed order.
6. Run negative, idempotency, snapshot, and concurrency cases.

Do not use **Reseed Demo Data** in the middle of the run: it invalidates IDs and removes workflow state. If reseeding is needed, do it once at the beginning, then repeat all dependent tests.

## Automated Playwright suite

Install the browser runtime once after `pnpm install`:

```bash
pnpm exec playwright install chromium
```

Run against local services (Playwright starts `pnpm dev` when no external URL is supplied):

```bash
pnpm test:e2e:smoke
pnpm test:e2e:regression
```

Run the non-destructive suite against the deployed frontend:

```powershell
$env:E2E_BASE_URL='https://your-frontend.example.com'
pnpm test:e2e:live
```

Alternatively, the same URL override can be used with a specific suite:

```powershell
$env:E2E_BASE_URL='https://your-frontend.example.com'
pnpm test:e2e:regression
```

The critical lifecycle changes data and is skipped by default. Run it only against an approved QA/demo database:

```powershell
$env:E2E_ALLOW_MUTATIONS='1'
$env:E2E_RESEED='1' # optional; admin reseed before the lifecycle
pnpm exec playwright test e2e/lifecycle.spec.ts
```

- `E2E_ALLOW_MUTATIONS=1` enables cut-off, kitchen completion, dispatch, delivery, invoicing, and payment.
- `E2E_RESEED=1` additionally resets date-relative DEMO orders before that lifecycle.
- HTML results are written to `playwright-report/`.
- Failure screenshots, videos, traces, and error context are written to `test-results/`.
- Open a trace with `pnpm exec playwright show-trace <trace.zip>`.

---

## A. Deployment, realistic data, authentication, and access control

### LIVE-001 — Services are reachable

**How to test:** Open the frontend in a clean browser session. Open the API health URL separately. Refresh both once after any cold-start delay.

**Expected result:** The login page renders without an unhandled error. The health endpoint returns a successful response. No mixed-content, CORS, infinite-loading, or failed asset errors appear.

### LIVE-002 — Exact reviewer credentials work

**How to test:** Sign in and sign out with each of the four accounts in the table above. Deliberately try one wrong password as well.

**Expected result:** Every exact credential succeeds and lands on the role-specific page. The wrong password is rejected with an actionable message and does not create a session.

### LIVE-003 — Role-specific navigation

**How to test:** For each role, inspect the sidebar and directly enter sensitive URLs such as `/settings`, `/staff`, `/pricing`, `/billing`, `/orders/new`, `/kitchen`, and `/dispatch`.

**Expected result:** Admin sees all areas. Kitchen sees only catalogue read access, orders read access, and kitchen work. Dispatch sees order/company/kitchen read access and dispatch work. Driver sees only their driver area. Unauthorized direct URLs show **Access Restricted** or otherwise deny access.

### LIVE-004 — Permissions are enforced by the API

**How to test:** While signed in as Kitchen, Dispatch, and Driver, use DevTools Console to send a same-origin write request that the role must not have, for example:

```js
fetch('/api/settings/cutoffTime', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ value: '15:30' })
}).then(async r => ({ status: r.status, body: await r.text() }))
```

Also try `POST /api/invoices` or another admin-only endpoint. Do not use an admin cookie for this test.

**Expected result:** The server returns `403 Forbidden`; data is unchanged. Hiding navigation is not counted as a pass unless the API also denies the request.

### LIVE-005 — Realistic, date-relative seed data

**How to test:** As Admin, inspect Companies, Employees, Menu, Orders, Kitchen, Dispatch, Billing, and Driver data. Filter Orders across a past date, today, and the coming week. Sign in as Driver and view today.

**Expected result:** There are several companies with employees, a realistic menu, orders in every required status across past/today/future dates, and multiple drops assigned to `driver@test.com` today. Screens are meaningful rather than empty regardless of the calendar day on which the app is reviewed.

### LIVE-006 — Admin-managed staff and one role per account

**How to test:** As Admin, open Staff, create a temporary `QA-<date>-staff` account with one non-admin role, sign in as it, then change its assigned role and sign in again. Try submitting no role or multiple roles through a crafted request.

**Expected result:** Admin can create and edit staff. Each account has exactly one valid role; its landing page and server permissions change with that role. Missing, multiple, or unknown roles are rejected. Non-admin roles cannot manage staff.

---

## B. Catalogue — section 4.1 [Must]

### CAT-001 — Dish fields and soft deactivation

**How to test:** As Admin, open Catalogue > Dishes and create `QA-<date>-Dish` with a unique SKU, description, image value, hot/cold temperature, cost, allergen, dietary tag, station, and minimum quantity. Save it, reopen it, then deactivate it.

**Expected result:** Every field persists and displays correctly. The SKU must be unique. Deactivation succeeds without deleting the record; historical orders that reference the dish remain readable.

### CAT-002 — Reusable options

**How to test:** Create `QA-<date>-Paneer` and `QA-<date>-Tofu` under Catalogue > Options, including cost, allergens, and dietary tags. Attach the same options to two different dishes.

**Expected result:** Each option retains its metadata and can be reused across option groups/dishes without duplication or loss of data.

### CAT-003 — Required/optional option groups and ordering

**How to test:** Open the QA dish and add a required group `Choose Protein` and an optional group `Add Side`. Add multiple options in a known order. Inspect the dish and then its menu/order-builder presentation.

**Expected result:** Required/optional state is preserved; groups and options appear in their configured display order; only configured options are offered.

### CAT-004 — Combination quantities must reconcile

**How to test:** In Create Order, add a dish quantity of 10. Make combinations totaling 9 and try Preview/Place; then total 11; finally make 6 Paneer + 4 Tofu.

**Expected result:** Totals of 9 and 11 are rejected by the server with a useful message. Exactly 10 is accepted and shown as two distinct combinations.

### CAT-005 — Every required group is satisfied

**How to test:** Add a dish that has a required group, leave that group unselected in one combination, and submit. Then select exactly one valid option and retry.

**Expected result:** Missing required selection is rejected by the server. A complete valid selection succeeds. An option not belonging to that group must also be rejected if a crafted request is sent.

### CAT-006 — Combination price calculation

**How to test:** Note the resolved dish and option prices. Build two combinations with different options and quantities. Independently calculate `(dish price + selected option prices + portion extras) × quantity` for each.

**Expected result:** Each combination and line subtotal exactly matches manual integer-cent arithmetic; the order total equals the sum of all line totals.

### CAT-007 — Order snapshots survive catalogue edits

**How to test:** Place an order containing the QA dish. Record its dish name, SKU, selected options, unit prices, and total. Change the catalogue names/prices or deactivate the dish/option, then reopen the existing order.

**Expected result:** The old order still shows what was originally ordered at the original prices. A new order uses the updated active catalogue and current pricing.

### CAT-008 — Admin-managed reference data

**How to test:** In Catalogue > Reference Data, create/edit a QA allergen, dietary tag, kitchen station, and portion size. Assign each to a dish/option/group and refresh. Try the same write as Kitchen via the API.

**Expected result:** All four reference lists are manageable without code/database edits and persist in catalogue forms. In-use relationships remain valid after edits. Kitchen can read catalogue data but receives `403` for reference-data writes.

---

## C. Menu — section 4.2 [Must]

### MENU-001 — Ordered active categories and items

**How to test:** Create two QA categories and add multiple dishes. Change their display order. Deactivate one item and one category, then preview the menu.

**Expected result:** Active categories/items appear in configured order. Inactive categories/items do not appear in the employee preview, but existing order history remains intact.

### MENU-002 — Company-specific hiding

**How to test:** In a company detail page, hide one category and one individual item. Preview as an employee of that company and as an employee of another company.

**Expected result:** The hidden category/item is absent only for the targeted company. It remains visible for an otherwise eligible employee at another company.

### MENU-003 — Secret categories

**How to test:** Create or identify a secret category. Preview normally, then enter its exact secret slug in Menu > Preview.

**Expected result:** It is absent from normal listings but is reachable through the correct slug. An incorrect slug does not expose it.

### MENU-004 — Exact employee preview

**How to test:** Select employees from companies with different tiers and hidden-menu rules in Menu > Preview as Employee.

**Expected result:** Each preview applies active state, company hiding, secret-category behavior, the employee's company tier/default fallback, and missing-price suppression. The shown prices match Pricing.

---

## D. Pricing — section 4.3 [Must]

### PRICE-001 — Named tiers and one default

**How to test:** Open Pricing. Verify several named tiers. Attempt to change the default tier or create/edit a tier as supported, then inspect all tiers.

**Expected result:** Exactly one tier is the default at any time; names and derivation settings persist.

### PRICE-002 — Company tier and default fallback

**How to test:** Assign a non-default tier to Company A and leave Company B without a tier. Preview the same employee-eligible dish for one employee from each company.

**Expected result:** Company A receives its assigned tier price. Company B receives the default tier price.

### PRICE-003 — Missing tier price hides a dish

**How to test:** In the tier grid, clear a dish's effective price on a non-default tier so no value can be resolved. Preview as an employee whose company uses that tier.

**Expected result:** The dish is omitted entirely; it never appears as `$0.00`, blank, `NaN`, or an orderable item. If a required option group has no priced options, the entire dish is hidden.

### PRICE-004 — Derived prices and five-cent ceiling

**How to test:** Configure a tier derived from cost or another tier. Choose a base/factor that yields a non-five-cent result such as 211 cents. Inspect the effective price in the grid and employee preview.

**Expected result:** The price rounds upward to 215 cents, not down or to the nearest cent. Chained tiers apply the documented rounding at each step.

### PRICE-005 — Individual override wins

**How to test:** On a derived tier, set an explicit override for one dish and one option. Compare the effective grid and employee preview, then clear the override.

**Expected result:** The explicit value wins only for that item. Clearing it immediately restores the correctly derived value.

### PRICE-006 — Whole-tier editing and missing-price visibility

**How to test:** Switch the pricing grid between dishes/options and edit several rows. Search or filter for missing prices.

**Expected result:** Staff can efficiently inspect and edit a full tier, and unpriced entries are visually obvious without opening each item.

### PRICE-007 — Price changes affect only new orders

**How to test:** Place Order A, change a dish/option tier price, then place identical Order B.

**Expected result:** Order A retains the old snapshot. Order B uses the new price. Both totals reconcile exactly.

---

## E. Companies — section 4.4 [Must]

### CO-001 — Company essentials and employee owner

**How to test:** Create a QA company, add its first employee, set that employee as owner, and enter billing contact data. Try assigning an employee of a different company as owner through the API if the UI does not offer that choice.

**Expected result:** The company persists with billing details and an owner who belongs to it. A foreign employee cannot be assigned as owner.

### CO-002 — Domain validation

**How to test:** Add `qa-<date>.example` to one company. Try adding the same normalized domain to another company. Also try `gmail.com` and another public email domain.

**Expected result:** A private domain can be saved once. Duplicate ownership and public domains are rejected server-side with actionable messages.

### CO-003 — Multiple delivery addresses

**How to test:** Add two addresses, make one default, edit the other, and attempt to remove the default/in-use address as applicable.

**Expected result:** Both addresses persist; exactly one default is clear; edits flow into new orders. Unsafe deletion is blocked or safely handled, and historical orders keep their address snapshot/reference.

### CO-004 — Company working days and holidays

**How to test:** Configure working days and add a company holiday. Try creating an order for a weekend/non-working day and for the holiday; then use a valid working day.

**Expected result:** Invalid delivery dates are rejected by the server. A valid company and kitchen working date is accepted. The company holiday does not itself shift the platform cut-off calculation.

### CO-005 — Delivery defaults

**How to test:** Set default delivery time, dispatch lead minutes, packaging, driver instructions, and default driver. Start a new order/drop for that company.

**Expected result:** Defaults prefill the order/drop. Planned dispatch-ready time equals delivery time minus the configured lead. Instructions and default driver appear in dispatch/driver views.

### CO-006 — Company menu and price controls

**How to test:** Assign a tier and hide a category/item on the company page. Preview an employee from that company.

**Expected result:** Both tier pricing and hidden-menu rules apply together; no excluded or unpriced item leaks into the menu.

---

## F. Employees — section 4.5 [Must]

### EMP-001 — Exactly one company and company transfer

**How to test:** Create an employee under Company A. Move them to Company B when they have no active draft/placed order. Repeat with an employee who does have an active order.

**Expected result:** The employee always belongs to exactly one company. A valid transfer changes their menu/calendar/tier/address rules. A transfer that would invalidate an active draft/placed order is blocked as documented; historical orders retain their original company.

### EMP-002 — Permission flags constrain ordering

**How to test:** Create employees with each flag disabled/enabled: choose own address, change delivery time, change packaging. Build orders for each.

**Expected result:** Disabled choices are fixed to company defaults and crafted alternative values are rejected server-side. Enabled choices are editable and valid values persist.

### EMP-003 — Allergies and dietary preferences

**How to test:** Add allergens and dietary preferences to an employee. Open that employee and create an order for them.

**Expected result:** Preferences persist and are visible to staff during ordering/fulfilment where relevant. They do not silently disappear when the employee is edited or transferred.

---

## G. Orders and cut-off — section 4.6 [Must]

### ORD-001 — Complete order flow

**How to test:** As Admin, choose company, employee, a valid delivery date, menu dishes, valid combinations, address, time, and packaging. Review the breakdown and click **Place Order**.

**Expected result:** Only that employee's resolved menu is shown. The placed order contains correct delivery details, line/option snapshots, line subtotals, and total.

### ORD-002 — Draft flow

**How to test:** Repeat the order builder but click **Save as Draft**. Open the resulting detail page and order list.

**Expected result:** Status is `DRAFT`; data is retained; the draft is not yet billable or available for kitchen work.

### ORD-003 — Server validates every business rule

**How to test:** Submit invalid requests through normal controls and, where controls prevent it, by editing/replaying a request in DevTools: invalid employee/company pairing, closed delivery date, hidden/unpriced/inactive dish, invalid option, missing required group, mismatched combination quantity, unauthorized address/time/packaging, below minimum quantity, and incorrect client-supplied price.

**Expected result:** Every invalid case is rejected by the API with a clear 4xx message. The server calculates authoritative prices and never trusts a client total.

### ORD-004 — Search, filters, and server pagination

**How to test:** On Orders, search by visible identifying data and independently apply date range, status, company, and invoiced filters. Move between pages.

**Expected result:** Results match all active filters, totals/page counts are coherent, query state does not mix records, and pagination comes from the API rather than merely slicing one client-loaded list.

### ORD-005 — Order detail and timeline

**How to test:** Open orders in several statuses.

**Expected result:** Detail shows dishes, combinations/options, money breakdown, delivery data, invoice state, and a chronological progression timeline with only genuine timestamps completed.

### ORD-006 — Before-cut-off edit and cancellation

**How to test:** Create a draft and placed order whose cut-off has not passed. Edit allowed content and cancel each.

**Expected result:** Both are editable/cancellable before cut-off; edits are revalidated and repriced; cancelled orders no longer count as active, cookable, or billable.

### ORD-007 — Cut-off calculation skips kitchen closures

**How to test:** In Settings, use a known cut-off day count/time and add a kitchen holiday between delivery and deadline. Choose a delivery date that crosses a weekend/holiday. Compare the displayed deadline with a manual backward count of kitchen working days.

**Expected result:** The deadline uses the configured time and count and skips kitchen non-working days and kitchen holidays. It is calculated in the configured kitchen timezone. Company holidays do not shift it.

### ORD-008 — Manual cut-off processing

**How to test:** For one eligible/held date, ensure at least one `DRAFT` and one `PLACED` order exist. In Settings > Manual Cut-off, run processing for that date (use Force only for the deliberate reviewer demo).

**Expected result:** Drafts become `CANCELLED`; placed orders become `CONFIRMED`; confirmed orders become billable and receive the downstream kitchen/drop state needed for fulfilment. The result summarizes processed counts.

### ORD-009 — Cut-off is idempotent

**How to test:** Run the same date's cut-off a second time and refresh Orders, Kitchen, Dispatch, and Billing.

**Expected result:** No order is processed twice; no duplicate drop, prep unit, or invoice eligibility is created; the second run safely reports nothing new/already processed.

### ORD-010 — Post-cut-off locks and admin override

**How to test:** Try editing/cancelling a confirmed order through ordinary pre-cut-off actions. Then use **Admin Override** to change time, address, or packaging.

**Expected result:** Normal mutation is rejected after cut-off. Admin override permits only supported override fields, records the new values, recalculates planned times/drop grouping as needed, and remains inaccessible to non-admin roles.

### ORD-011 — Status model

**How to test:** Exercise representative orders through Draft, Placed, Confirmed, Delivered, Cancelled, and Rejected. Attempt invalid transitions such as Draft directly to Delivered or Delivered back to Placed.

**Expected result:** Only valid transitions succeed. Terminal/invalid transitions fail without partial changes.

---

## H. Kitchen board — section 4.7 [Must]

### KIT-001 — Date board, prep units, and station routing

**How to test:** Sign in as Kitchen and choose a date with confirmed orders. Compare each order-line combination to units on the board. Filter each station, including Unassigned.

**Expected result:** Every distinct combination is one board unit carrying its quantity. It appears at the dish's station, or Unassigned when no station exists. Draft/placed/cancelled/rejected orders are absent.

### KIT-002 — Start and finish rules

**How to test:** Start a not-started unit and then mark it done. For another unit, click Done without Start. Attempt to start or finish an already processed unit again (including by replaying the request).

**Expected result:** Start records once. Done-after-start records once. Done-without-start records both start and done. Repeats are rejected/no-op and never rewrite timestamps.

### KIT-003 — Order-level kitchen timestamps

**How to test:** Use an order with at least two units. Start the first, complete all but the last, then finish the last.

**Expected result:** `kitchenStartedAt` is set at the first unit start. `kitchenReadyAt` remains empty until every unit is done, then is set exactly once.

### KIT-004 — Planned ready times and risk display

**How to test:** Check an order's delivery time and company lead. Calculate `dispatch-ready = delivery − lead` and `kitchen-ready = dispatch-ready − 30 minutes`. Change delivery time via Admin Override and refresh the board.

**Expected result:** Both planned times match the formulas and update after the override. Late work is clearly red/late; work within the documented risk window with incomplete units is clearly at-risk.

### KIT-005 — Admin force-complete

**How to test:** As Admin, force-complete a confirmed order with unfinished units. Try the same as Kitchen through a direct API call.

**Expected result:** Admin atomically starts/completes every remaining unit and sets order timestamps. Kitchen receives `403` because `kitchen:force` is not part of that role.

### KIT-006 — Concurrent unit completion

**How to test:** Open the same unfinished unit in two sessions and trigger Done at nearly the same instant. Refresh both and inspect the order.

**Expected result:** One logical completion exists, timestamps are not corrupted, and the order becomes kitchen-ready only when all distinct units are actually done.

### KIT-007 — Busy-day responsiveness

**How to test:** On a seeded/high-volume date, switch station filters, scroll, start/done a unit, and allow the 15-second refresh to run. Record response/render time in DevTools.

**Expected result:** The board remains usable at the 400-order design target; actions do not freeze the page or multiply units after refresh.

---

## I. Dispatch board and driver view — section 4.8 [Must]

### DSP-001 — Drop grouping

**How to test:** Confirm at least two orders with the same company, address, exact delivery time, and date; create another differing in one key. Inspect Dispatch.

**Expected result:** The first two form one drop. The differing order forms a separate drop. Counts/meals on each drop reconcile to its member orders.

### DSP-002 — Default and manual driver assignment

**How to test:** Inspect a new drop for a company with a default driver. On an unassigned drop, assign `driver@test.com`.

**Expected result:** The default is prefilled when configured; manual assignment persists and the drop appears in that driver's view for the matching date.

### DSP-003 — Enforced progression and non-repeatability

**How to test:** Try **Dispatch Ready** before every order in the drop is kitchen-ready; then finish the kitchen work and retry. Try **Out for Delivery** without a driver, then assign one and retry. Replay each successful action.

**Expected result:** Premature actions fail. Valid sequence is Kitchen Ready → Dispatch Ready → Out for Delivery → Delivered. Every step requires its predecessor and succeeds only once.

### DSP-004 — Driver sees only their own drops for today

**How to test:** Sign in as Driver. Compare the list with Dispatch assignments. Change the date selector away from today and attempt to fetch another driver's drop directly by manipulating requests.

**Expected result:** Today is derived from kitchen timezone; only drops assigned to the signed-in driver are returned in time order. Other drivers' and unassigned drops are not disclosed by the API.

### DSP-005 — Mobile usability

**How to test:** Use browser responsive mode around 360 × 800 and, if available, a real phone. Navigate, read addresses/instructions, start a route, and open delivery confirmation.

**Expected result:** No horizontal overflow hides content or actions; text is readable and primary controls have comfortable touch targets.

### DSP-006 — Delivery note, optional photo, and on-time result

**How to test:** On an out-for-delivery drop, complete delivery with note `QA handed to reception` and a small image. Complete another without either optional field if data permits.

**Expected result:** Both variants succeed. Note/photo presence persists for the first. All orders in the drop become Delivered together. Delivered time and On Time/Late are recorded from the delivery deadline/grace rule and displayed consistently.

### DSP-007 — Dashboard status at a glance

**How to test:** Compare Dispatch cards and stage columns with individual drops before and after each transition.

**Expected result:** Drop counts by stage, Needs a Driver, Behind Schedule, and Next 3 Drops update correctly and do not count delivered/irrelevant drops contrary to their displayed formulas.

---

## J. Company billing — section 4.9 [Must]

### BILL-001 — Only confirmed/delivered orders are owed

**How to test:** Compare one draft, placed, confirmed, cancelled/rejected, and delivered order for the same company against Billing > Unbilled.

**Expected result:** Confirmed and delivered uninvoiced orders are eligible at full snapshotted order total. Draft, placed, cancelled, and rejected orders are excluded unless represented by the documented adjustment behavior.

### BILL-002 — Company unbilled breakdown and invoice creation

**How to test:** Open a company's unbilled orders, select the intended eligible orders, manually sum their totals, and create an invoice.

**Expected result:** Every eligible order is listed once. The invoice belongs to the company, contains the selected orders, and its integer-cent total exactly equals the sum of order values plus eligible adjustments.

### BILL-003 — An order can be invoiced only once

**How to test:** After invoice creation, try to include one of its orders in another invoice or replay the original create request.

**Expected result:** The order disappears from unbilled results and the server rejects/prevents duplicate attachment. No duplicate receivable is created.

### BILL-004 — Mark invoice paid

**How to test:** Open an issued invoice and click **Mark Paid**; repeat the action/replay the request.

**Expected result:** Status becomes Paid with a stable paid timestamp. Repetition does not double-post or corrupt the invoice.

### BILL-005 — Post-invoice cancellation adjustment

**How to test:** As Admin, cancel or reject an already invoiced order in accordance with the documented policy. Open Billing > Adjustments and then create the company's next invoice.

**Expected result:** The original invoice remains historically unchanged. A negative adjustment/credit equal to the affected amount is created once and applied to the next invoice according to the README policy.

---

## K. Settings — section 4.10 [Must]

### SET-001 — Editable platform settings

**How to test:** As Admin, change kitchen working days, cut-off time, cut-off day count, and timezone/other exposed platform values. Refresh and sign in again.

**Expected result:** Values persist without code/database edits and immediately govern new calculations. Invalid values are rejected with actionable errors.

### SET-002 — Kitchen holiday management

**How to test:** Add a future kitchen holiday, confirm it appears after refresh, use it in a cut-off calculation/order-date validation, then remove it.

**Expected result:** Add/remove persists, duplicate dates are safely rejected/handled, and delivery/cut-off rules reflect the holiday.

### SET-003 — Manual run and sweep controls

**How to test:** Use manual cut-off for a chosen date and the sweep control for all due dates. Review the operation result and refresh affected areas.

**Expected result:** Controls call the live API, return comprehensible counts/results, respect Force semantics, and remain idempotent.

---

## L. Dashboards — section 4.11 [Must]

### DASH-001 — Correct landing dashboard per role

**How to test:** Sign in fresh as each role.

**Expected result:** Admin lands on `/dashboard`, Kitchen on `/kitchen`, Dispatch on `/dispatch`, and Driver on `/driver`, with information relevant to that person's immediate decisions.

### DASH-002 — Admin calculations

**How to test:** For Today's Orders by Status, Next Cut-off, 7-Day Pipeline Value, Kitchen Prep Today, and Unbilled Receivables, open each information icon and reconcile a small sample against Orders/Kitchen/Billing.

**Expected result:** Figures follow the displayed README/UI formulas, use kitchen-timezone dates, and consistently treat cancelled/rejected/missing data as documented.

### DASH-003 — Kitchen calculations

**How to test:** Reconcile Meals to Cook, By Station Remaining, Late/At-Risk, and Next Cooking Deadline against visible units and timestamps. Complete a unit and refresh.

**Expected result:** Counts and next deadline agree with the board and update after state changes. Cancelled/rejected and fully ready orders are excluded as documented.

### DASH-004 — Dispatch calculations

**How to test:** Reconcile Drops by Stage, Needs a Driver, Behind Schedule, and Next 3 Drops against the visible sorted drops. Assign/advance one and refresh.

**Expected result:** Metrics and ordering update and use the inclusion/exclusion rules in each info dialog.

### DASH-005 — Driver calculations

**How to test:** Reconcile total/delivered/remaining and Next Destination against the driver's own sorted list. Deliver the next drop.

**Expected result:** Progress, percentage, remaining count, and next destination update; drops belonging to others never affect the figures.

### DASH-006 — Calculation transparency

**How to test:** Open the information control on every dashboard card.

**Expected result:** Each explains what is shown, why it matters, exact formula, date basis, included records, exclusions, and missing-data behavior. This matches the README dashboard definitions.

---

## M. Cross-cutting correctness and release checks

These items are not separately tagged `[Must]`, but the assignment explicitly evaluates them and several are necessary to trust the live Must workflows.

### X-001 — Money integrity

**How to test:** Use awkward cent values, derived prices, multiple combinations, several order lines, and a multi-order invoice. Recalculate independently in cents.

**Expected result:** No floating-point artifacts appear. Combination → line → order → invoice totals reconcile exactly.

### X-002 — Timezone boundary

**How to test:** Change the browser/OS timezone or emulate a remote timezone, then compare `/api/meta`, displayed today, cut-off countdown, Driver today, and delivery dates.

**Expected result:** All operational dates remain anchored to the configured kitchen timezone, independent of browser/server timezone.

### X-003 — Actionable validation and recovery

**How to test:** Trigger representative invalid forms and API failures, then correct the input without reloading.

**Expected result:** Messages identify the field/business rule; entered data is retained where safe; the user can recover without a blank page or silent failure.

### X-004 — Cold start and polling

**How to test:** Open the app after an idle period and allow Kitchen/Dispatch/Driver polling for at least one minute.

**Expected result:** A clear waking/loading state appears during cold start. Polling neither signs the user out nor duplicates/flickers records, and eventual data is current.

### X-005 — Browser refresh and session lifecycle

**How to test:** Refresh on a deep link, open it in a new tab, sign out, then revisit protected history/direct URLs.

**Expected result:** Valid sessions survive refresh; protected pages do not flash sensitive data; logout invalidates access and redirects to login.

### X-006 — Automated release gate

**How to test:** From a clean checkout configured for the test database, run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

**Expected result:** Every command exits `0`; no failing business-rule tests, type errors, lint errors, or production build errors remain.

---

## Final pass criteria

The live app is ready only when:

- every test above is marked Pass, or a consciously accepted exception is documented in README;
- all four exact accounts work and server-side role isolation is proven;
- a complete order can move from Draft/Placed through cut-off, Kitchen, Dispatch, Driver delivery, and Billing;
- money, timezone, snapshots, idempotency, and concurrency checks pass;
- seeded data is still meaningful for the review date; and
- `lint`, `typecheck`, `test`, and `build` all pass on the submitted commit.

## Bug log template

```md
### BUG-<number> — <short title>

- Test ID:
- Severity: Blocker / High / Medium / Low
- Account/role:
- URL and date/time (IST):
- Preconditions/data IDs:
- Steps:
- Expected:
- Actual:
- API status/response:
- Screenshot/video:
- Console/network evidence:
- Reproducibility: Always / Intermittent / Once
```
