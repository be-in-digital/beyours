# Hardening plan — `apps/reference`

Written on 2026-08-20, from the audit of 2026-08-19 (branch
`claude/referent-site-full-test-d4eea0`). Goal: bring the reference app to a
state that is usable, verified and maintainable — not merely fixed once.

> **A point of vocabulary, because it changes the plan.** "100% secure" is not a
> state you reach and tick off. What can be reached, and what this plan aims at:
> **zero known open defect**, a **foundation covered by tests that go red when
> something breaks**, and **automatic guardrails** that stop the same class of
> defect coming back. Without the third, the same audit repeats in three months —
> which is why the guardrails are tickets in their own right and not a "if we
> have time".

---

## 0. Progress journal

Updated as each ticket closes. A ticket only appears here once the five criteria
of section 11 are met.

| Ticket | State | Evidence |
| --- | --- | --- |
| **S1-1** Discount recomputed server-side | ✅ **closed** | `promotionDiscount.ts` + 25 tests; `discountAmount` removed from the public args and from the client call |
| **S1-2** Promotion validation (store, active, window, caps, minimum) | ✅ **closed** | 10 integration tests on `create.handler`; the per-customer cap bypass closed (see review below) |
| **S1-4** SumUp: reference and amount verified | ✅ **closed** | `paymentSettlement.ts` + 22 tests; wired into `verifyCheckout` |
| **S1-5** PayPal: reference and amount verified, sandbox made explicit | ✅ **closed** | `readPayPalCapture` finally reads `purchase_units[0]`; the sandbox heuristic replaced by `PAYPAL_SANDBOX_MODE` |
| **S1-6** A real refund instead of a `db.patch` | ✅ **closed** | `refundPolicy.ts` + 22 tests; `internalRefund` actions for Stripe/SumUp/PayPal; recorded **after** the provider confirms |
| **S1-7** The 4 missing post-payment routes | ✅ **closed** | `/checkout/success`, `/checkout/cancel`, `/checkout/pay`, `/track/[token]` — verified over real HTTP: 404 → 200 |
| **S1-8** `viewToken` returned to the client after an order | ✅ **closed** | The success page shows "Suivre ma commande" with the token the verification returned |
| **S1-9** Displayed total aligned with the charged total | ✅ **closed** | `orderTotals.ts` + 13 tests — one arithmetic for the server and the storefront; VAT line visible |
| **S1-10** Delivery fee in percentage mode | ✅ **closed** | `deliveryQuotes` table: the server reads the quote it issued. `uberDirectFee` removed from the client arguments |
| **S2-1** Authorization seam moved into the package | ✅ **closed** | `createStoreFunctions` factory; `apps/themes` finally has a seam |
| **S2-2** `authed*` migrated to the store-scoped seam | ✅ **closed** (reference) | 69 → 11, the remaining 11 justified. `themes`: a separate pass to schedule |
| **S2-4** A permission declared on every store-scoped function | ✅ **closed** (reference) | **178/178**; 2 missing RBAC resources added |
| **S2-8** `teamMembers` wired into the auth chain | ✅ **closed** | Accepting an invitation finally provisions the profile |
| **S2-10** Authorization test suite | ✅ **closed** | 17 `convex-test` tests against the real Convex functions, in memory |
| **S2-11** Anti-regression ESLint rule | ✅ **closed** | 2 rules; bite verified. See S2-12 below |
| **S2-12** Sort the 20 never-audited modules | ✅ **closed** | 58 exports sorted; **5 new holes** found; ESLint rule with no exemption |
| **S2-9** Team mutations secured | ✅ **closed** | `teamAccess.ts` + 23 tests; the 2 invitation actions guarded |
| **S2-3** Unguarded Convex exports classified | ✅ **closed** (2 apps) | reference 43 → 29, `themes` 37 → 24; the public ones annotated `@public-by-design` |
| **S2-5** `userProfiles.upsert` locked down | ✅ **closed** | `profileProvisioning.ts` + 20 tests — a complete policy of who provisions what |
| **S2-6** `userProfiles.getByUserId` removed | ✅ **closed** | `AdminAuthSync` routed to `getMyProfile` in both apps |
| **S2-7** Bootstrapping the first super-admin | ✅ **closed** | `claimFirstAdmin`, self-closing as soon as a super-admin exists |
| **S4-1** Phantom roles blocking the settings | ✅ **closed** | Guard based on `settings:write`; 2 regression tests in `rbac.test.ts` |
| **S0-1** Test Convex deployment + CI secrets | ⛔ **blocked** | Needs the repository owner's credentials — out of the agent's reach |
| **S0-9** *(new)* Stabilise the time-sensitive tests in `packages/core` | 🔜 to do | See below |

**Scope widened on S1-4/S1-5 — `apps/themes` was affected too.** The `sumup.ts`
and `paypal.ts` files in the client deliverable were **byte-for-byte identical**
(`diff` empty) to the reference ones, and therefore carried the same hole.
Fixing the test bench while leaving payment fraud in what gets cloned to every
client would have been the opposite of the goal: the fix went into both. Since
the `orders.create` contract changed, the `themes` checkout had to be aligned as
well — exactly the risk anticipated in the register (section 12), and caught by
the type-check.

**S0-9 — a flaky test spotted in passing.** During a full `pnpm test`,
`@be-in-digital/core` reported `1 failed | 170 passed`, then **190/190 over the
next three runs**. The suspects are the time-sensitive tests in that same
package: `ses.test.ts` ("splits into batches of 50 emails", 9.4 s) and
`i18n.test.ts` (retry/backoff, 3.1 s). A flaky test is a defect in its own right
here: it teaches the team to re-run a red CI instead of reading it, which
cancels out the benefit of this whole plan. To be handled in Sprint 0 (inject
the clock rather than sleeping, or raise the time budget explicitly).

**Bite proof obtained on S1-1** (the S0-8 ticket's method): the original
vulnerable line (`const discount = args.discountAmount ?? 0`) was temporarily
reintroduced, **7 tests went red** — including "IGNORES a forged discountAmount
smuggled by the client" — then the fix was restored. The tests really do bite.

**Bite proof on S1-4/S1-5**: the reference and currency guards were temporarily
neutralised, **5 tests went red** — including "refuses a payment made for a
different order" — then restored.

**State of the gates after those five tickets**: `pnpm test` → **1,257 tests,
18/18 tasks**; `turbo run type-check` → clean on `apps/reference`, `apps/themes`
and the 10 packages; `pnpm lint` → 0 errors (71 warnings on `reference`, 75 on
`themes`, unchanged).

> Tooling trap hit here: `pnpm --filter <app> type-check` short-circuits turbo's
> `dependsOn: ["^build"]` and reports ~120 false errors against the stale `dist/`
> of `packages/restaurant`. Always go through
> `npx turbo run type-check --filter=…` for a verdict you can trust.
### Control review of 20 August

A full re-read of the 19 touched files before going further. One defect
introduced by my own fixes was found and corrected:

- **`maxUsagePerCustomer` cap was bypassable.** My first version counted a
  customer with no email as "having never used the promotion". But
  `customerInfo.email` is optional: **omitting a single field was enough to
  ignore the cap**. `resolvePromotionDiscount` now refuses a per-customer capped
  promotion on an anonymous order (`customer_unidentified`), with 3 dedicated
  tests. Ticket S1-2 was not really closed without this.

Points checked and judged correct:

| Check | Result |
| --- | --- |
| Every caller of `orders.create` | 2 storefronts (reference, themes) — both aligned. Webhooks go through `createFromWebhook`, a separate path and unaffected |
| Remaining `discountAmount` | All legitimate: a display type, the partner webhook path (Uber signs its own amounts), a schema field, a server-computed value |
| `apps/site` | No engine dependency, separate Convex backend, `discountAmount` absent from its `orders.ts` — out of reach |
| `by_promotionId_customerEmail` index | Present (`tables/promotions.ts:91`) |
| `hasPermission` on an unknown role | Returns `false` — fails closed, so the `as Role` cast is safe |
| Free-delivery double counting | Fixed during implementation: the discount equals the fee, the fee stays on the order, subtracted once |
| Leftover debug markers | None (`console.log`, `TODO`, `debugger`, bite-proof residue) |
| Temporary files | No residue |

**Gates replayed without cache after the review**: `turbo run test --force` →
**18/18 tasks, 1,260 tests** · `turbo run type-check --force` on `reference`,
`themes` and the 10 packages → **17/17** · `next build` on `reference` →
**compiled, 90 pages** · lint → **0 errors** everywhere (71 warnings reference,
75 themes, 2 convex-functions, 4 core — all in untouched files).

**Bite proofs replayed**: server-side discount → 8 tests red without the fix;
payment settlement → 5 tests red. Restoration verified at 356/356.

> Unrelated pre-existing failure, seen at build time: `[sitemap] Failed to
> generate sitemap` — the error is caught and the build continues; the sitemap
> needs a Convex backend.

### S1-6 — a real refund (20 August)

The refund was a `ctx.db.patch` and nothing else: `refundedAmount` updated,
payment and order moved to "refunded", **no provider call** anywhere. It also
accepted any status, `failed` included, and was exposed as an `authedMutation` —
any authenticated account could "refund" any establishment's payment.

The new chain, from purest to most concrete:

1. `packages/convex-functions/src/refundPolicy.ts` — pure decisions, 22 tests.
   `planRefund` validates the status, a positive whole amount and the remaining
   balance; `routeRefund` decides *how* the refund can be executed.
2. `defs.refund` → `defs.recordRefund`: only writes **afterwards**, with
   `externalRefundId`, `refundedAt` and `refundMethod` as evidence, and
   revalidates against the freshly re-read document (concurrent race).
3. `stripe.ts`, `sumup.ts`, `paypal.ts`: one `internalRefund` each, which talks
   to the provider and reports what it answered.
4. `payments.refundPayment`: the public action that authorizes
   (`payments:refund` + access to the establishment), plans, calls the provider,
   **and only then** records.

Three decisions worth knowing:

- **Cash**: no provider to call. The refund is recorded as
  `refundMethod: "manual"` — a declaration by the staff, never presented as
  confirmed by an API. The toast says so explicitly.
- **Square, and payments with no transaction id**: `routeRefund` returns
  `unsupported` and the action **refuses**, with a message pointing at the
  provider's own dashboard. Refusing is the fix: an empty promise is precisely
  what is being removed.
- **PayPal was refunding against the wrong id.** `capturePayPalOrder` stored the
  *order* id in `externalId`, but a PayPal refund is issued against a *capture*.
  `readPayPalCapture` now extracts the `captureId` and that is what gets stored —
  without which every PayPal refund would have failed at the provider.

Schema: three optional fields added to `payments` (`externalRefundId`,
`refundedAt`, `refundMethod`) — no migration needed.

**Scope widened to `apps/themes`**, same reasoning as S1-4/S1-5: the client
deliverable carried the same fictitious refund. The three provider files were
resynchronised (verified identical to the reference `HEAD` before copying) and
its `payments.ts` and `RefundDialog.tsx` aligned.

**Bite proof**: status and routing guards neutralised → **7 tests red**,
including "refuses a refund on a failed payment" and "refuses a card payment
with no stored transaction id". Restoration verified at 378/378.

### S1-7 / S1-8 — the four post-payment routes (20 August)

The four URLs were emitted by the checkout and did not exist. Probed over HTTP
against a local production server: **404 before, 200 after**.

| Route | Role |
| --- | --- |
| `/checkout/success` | Has the provider confirm the payment (Stripe via `session_id`, PayPal via `token`, SumUp via `checkoutId`), empties the cart, hands back a tracking link |
| `/checkout/cancel` | Cart left intact — the customer cancelled a payment, not their order. Offers to try again |
| `/checkout/pay` | Host for the SumUp card widget, with an explicit degradation if the SDK does not load |
| `/track/[token]` | Public tracking by opaque token, backed by `getByTrackingToken`, which returns no customer data |

**Two defects found while writing these pages:**

- **The cart was never emptied after a card payment.** `clearCart()` was only
  called in the cash branch (`checkout/page.tsx:316`): after a Stripe or PayPal
  payment the customer came back with their cart intact and could order the same
  thing again. Emptying now happens on the success page, **and only when the
  payment is confirmed** — an abandoned payment must keep the cart.
- **A dead tracking link for guests.** My first version offered "Suivre ma
  commande" pointing at `/order/[orderId]` even without a `viewToken`, when that
  page resolves nothing for a visitor with no account. The button is only shown
  when a token is available.

**Acknowledged limit on `/checkout/pay`**: SumUp is not configured on this
deployment. The page follows the published widget contract but has not been
exercised against a real account — hence the dedicated provider-integration
review planned on a separate branch.

**Scope widened to `apps/themes`**: it emitted exactly the same four URLs and
had none of the routes. The four pages were added there identically.

### S1-9 / S1-10 — the displayed price and the delivery fee (20 August)

**S1-9.** The storefront displayed `subtotal + delivery − discount` under the
words "Taxes incluses", while the server charged `subtotal + VAT + delivery −
discount`, with VAT **added**. On a €20 basket at 10%: €20 on screen, €22
charged.

The cause is not an arithmetic error but the existence of **two arithmetics**.
`packages/convex-functions/src/orderTotals.ts` (13 tests) now carries the single
one, called both by the handler that charges *and* by the summary that displays.
The summary shows a "TVA (x %)" line and the total's label tells the truth
(`TVA incluse` / `Hors taxes`). `resolveTaxRatePercent` respects a store rate
**explicitly set to 0** — an untaxed restaurant is a real configuration, which a
`??` would have overwritten.

**S1-10.** The ticket said "send `uberDirectFee` from the checkout, or remove
percentage mode". Neither was right: sending the amount from the browser would
have **recreated the S1-1 hole**, since the server charged a percentage of the
number it received — `uberDirectFee: 0` bought free delivery.

The fix chosen: a new **`deliveryQuotes`** table. `getDeliveryQuote` records the
Uber quote it has just obtained; `orders.create` receives only the
`uberDirectEstimateId`, re-reads the stored quote, **checks that it belongs to
the right restaurant and has not expired**, then applies the percentage.
`uberDirectFee` has disappeared from the public arguments, like `discountAmount`
before it.

On the storefront, the checkout requests a quote when — and only when — the mode
requires it, shows the real fee, and surfaces a readable error for an
unserviceable area.

**Known limit**: saved addresses carry no coordinates (`checkout-form.tsx` does
not copy them into `deliveryAddress`). In percentage mode, only an address
entered through autocomplete can produce a quote. To be handled with the address
model, outside this ticket.

> ⚠️ **Tooling debt to settle once S0-1 is unblocked.** Adding a Convex table and
> module requires a `convex codegen`, which refuses to run without a deployment
> (`No CONVEX_DEPLOYMENT set`) — the S0-1 blocker itself. The `deliveryQuotes`
> entries in `apps/*/convex/_generated/api.d.ts` were therefore **written by
> hand**, at their exact alphabetical place. `pnpm convex:codegen` must be re-run
> as soon as a deployment exists, and its output compared: this is generated
> code, not meant to be maintained by hand.

**Bite proof**: VAT neutralised in `orderTotals.ts` → **7 tests red**, including
"reproduces the mismatch the storefront used to display". Restoration verified at
391/391.

---

## Sprint 2 — multi-tenant isolation (in progress)
### S2-5 / S2-6 / S2-7 — identity and roles (20 August)

The audit's two blocking privilege escalations, plus the lock they made
necessary.

**S2-5.** `userProfiles.upsert` rejected exactly two string literals,
`"super_admin"` and `"client_admin"`. Everything else went through — including
`manager`, which carries `products:write`, `orders:read/write` and
`customers:read` — on any `storeId` the caller chose. `stores.list` being public,
the attack was three calls: sign up on the storefront, list the establishments,
grant yourself `manager` on a competitor's. The symmetric variant was worse:
rewrite the real owner's profile as `customer` with no establishment and lock
them out of their own restaurant.

The whole policy now lives in
`packages/convex-functions/src/profileProvisioning.ts` (20 tests):

| Actor | May provision |
| --- | --- |
| `super_admin` | Anything — except removing their own super-admin role |
| `client_admin` | Non-administrative roles, **only on their own establishments**, with no bespoke permissions |
| Everyone else | Nothing |

Two guardrails are worth naming. Refusing self-demotion stops a deployment ending
up with no administrator at all. And forbidding bespoke permission lists for a
`client_admin` closes the side door: a permission granted by name bypasses the
role table entirely.

**S2-6.** `getByUserId` was exported as `query(defs.getByUserId)` — its core does
no identity check, so anyone could read the role, permissions and establishment
list of any user by guessing an id. Its only caller, `AdminAuthSync`, was in fact
reading **its own** profile: it is routed to `getMyProfile`, and the public
export is gone from both apps.

**S2-7.** Locking `upsert` created a chicken-and-egg problem: provisioning
requires a super-admin, and a fresh deployment has none. `claimFirstAdmin`
promotes the authenticated caller **if and only if** no super-admin exists —
self-closing, and therefore not replayable once the deployment is configured.

> Noted in passing: `upsert` had **no working caller**. The only one,
> `scripts/seed-users.mts`, calls Convex without `setAuth` and was already
> failing silently (errors swallowed). Hence `internalUpsert`, reserved for the
> server path.

**Bite proof**: the `not_permitted` and `store_not_owned` guards neutralised →
**4 tests red**, including "refuses a customer promoting themselves to manager".
Restoration verified at 411/411.

### S2-3 — the 43 unguarded Convex exports (21 August)

**43 before, 29 after** — and the remaining 29 are now *justified in writing*,
not merely left as they were.

**Closed (14 reads + 11 writes in the same files):**

| Function | What leaked |
| --- | --- |
| `games.list` | The `winRatio` configured by the owner |
| `gameQRCodes.list` | **Every QR code** of an establishment — enough to play remotely on all its tables |
| `prizes.list` | Prize catalogue and remaining stock |
| `requiredActions.list` | Game configuration |
| `promotions.list` / `getById` | Every promotion, inactive and expired included, with their counters |
| `promotions.getCustomerUsageCount` | A membership oracle: "has this address used this promotion?" → moved to `internalQuery` |
| `paymentConnections.getByProvider` / `getAll` | `merchantId`, provider and connection state → `authedQuery` + `payments:read` |
| `orphanProducts.*` (2) | Integration plumbing |
| `externalProductMappings.*` (3) | Product ↔ platform mappings |
| Writes in `prizes`, `gameQRCodes`, `orphanProducts`, `translations`, `externalProductMappings` | Any authenticated account could write into **any** establishment |

**The trap in this ticket.** Three of these functions are called server-side by
`deliverooWebhook.processOrderWebhook`, an `internalAction` triggered by the
webhook — **with no user identity**. Moving them to `storeQuery` would have
rejected Uber Eats and Deliveroo themselves and broken order reception.
`externalProductMappings` therefore exposes two surfaces: the store-scoped
functions for the admin, and `internal*` variants the three server callers were
repointed to.

**The 29 that remain, annotated `@public-by-design` with their reason** (8
files): storefront catalogue (`products`, `categories`, `menus`), language picker
(`languages`), anonymous game flow (`gamePlay`), token access
(`orders.getByViewToken`, `kitchenTickets.getByTrackingToken`,
`teamMembers.getByInvitationToken`), a coupon code entered before signing in
(`promotions.getByCouponCode`, `listActiveAuto`), and translations of already
public content (`translations` — public reads, **writes closed**).

The `@public-by-design` marker is the hook the S2-11 ESLint rule will read.

### S2-1 — the authorization seam joins the engine (21 August)

`convex/lib/storeFunctions.ts` existed only in `apps/reference`. The deliverable
cloned to every client had **no** seam: it rewrote inline guards, file by file.
The engine's authorization policy therefore lived in its test bench, and not in
what is sold.

The blocker was real: the seam imports `../_generated/server` and
`../_generated/dataModel`, both app-specific. It could not be moved as it stood.
It became a **factory** — `createStoreFunctions<QCtx, MCtx>({ query, mutation })`
— which each app instantiates with its own generated builders. The context types
are fixed by the factory; the returned constructors stay generic over their
arguments and their output.

| | Before | After |
| --- | --- | --- |
| Implementation | 164 lines in `apps/reference` | 194 lines in `packages/convex-functions` |
| `apps/reference` | the implementation | a 21-line instantiation |
| `apps/themes` | **nothing** | a 21-line instantiation |

Immediate benefit: **the 23 files importing `./lib/storeFunctions` did not change
by a single line** — the instantiation re-exports the same names. And `themes`
could take S2-3 right after: **37 bare exports → 24**, with the same closures
(prizes, QR codes, promotions, payment connections, product mappings, orphans,
translations).

One detail not to miss along the way: `themes/deliverooWebhook.ts` was still
calling `api.externalProductMappings.getByExternal`, removed from the public
surface. The type-check caught it; the webhook was repointed to the internal
variant, without which Deliveroo order reception would have broken for every
client.

### S2-2 — the "auth only" guards become store-scoped (21 August)

**69 uses of `authedQuery`/`authedMutation` → 11**, and the remaining 11 are
justified, not forgotten.

Migrated to `storeQuery` / `storeMutation`: the 5 email modules (31 functions),
`kitchenTickets` (10), `storeIntegrations` (5), `cms` (3), `payments` (3), `blog`
(2). Uniform pattern: `create` carries a `storeId` and takes the default
resolver; everything else references a document and goes through
`storeIdFromDocument`.

**The seam was missing a tool.** Several functions reach their establishment
through a field that is not `id` — `orderId`, `articleId` — and that is precisely
why they had stayed auth-only: the seam had nothing to offer them.
`storeIdFromField(field, message)` fills that gap and unblocks
`payments.getByOrder`, `kitchenTickets.getByOrder`, `blog.getAdminArticle`.

**Three discoveries along the way:**

1. **A phantom permission.** `emailCampaignActions` requires `marketing:write`,
   but neither the `marketing` resource nor the permission existed in the RBAC.
   Since `hasPermission` fails closed, **only a super-admin could send a
   campaign** — never the restaurant owner. Same class of bug as the phantom
   roles in S4-1. Resource added, permissions granted to SUPER_ADMIN and
   CLIENT_ADMIN, 2 regression tests.

2. **An IDOR on customer history.** `orders.getByCustomer` accepted an arbitrary
   `customerId` and returned every order of that person — name, phone, delivery
   address, items — behind a simple "are you signed in". **No callers**:
   `getMyOrders`, which derives identity from the session, is what the account
   page uses. Export removed.

3. **Three cross-establishment lookups.**
   `storeIntegrations.listByPlatformEnabled`, `getBySiteId` and `getByBrandId`
   search across *every* establishment — that is their purpose: resolving which
   restaurant an incoming Uber Eats or Deliveroo event belongs to. They cannot be
   store-scoped, and the webhooks calling them have no identity. Moved to
   internal, with the three callers repointed. Their public exports allowed
   enumerating every connected restaurant.

**The 11 that remain, and why:**

| Function(s) | Reason |
| --- | --- |
| `paymentConnections.getByProvider` / `getAll` | Deployment-level data, not establishment-level. Guarded by `payments:read` since S2-3 |
| `stores.create` | No establishment exists yet to attach the guard to. Now protected by `stores:write` — it was auth-only, so any signed-up customer could create restaurants |
| `teamMembers` (8) | Scope of S2-8 / S2-9, handled together with the authentication chain wiring |

> ⚠️ **`apps/themes` did not receive this migration.** Its 12 equivalent files all
> diverge from the reference — they use inline guards, and its `orders.ts` is a
> genuine fork that reimplements the kitchen ticket. Copying blindly would risk
> breaking the client template in a way the type-check would not see. The seam is
> now available there (S2-1): migrating `themes` is a pass of its own, file by
> file.

### S2-4 — a permission on every store-scoped function (21 August)

After S2-2, the application had **178 store-scoped functions and 14 declared
permissions**. `storeQuery`/`storeMutation` without a `permission:` only checks
*membership* of the establishment: a `kitchen` account attached to the
restaurant could delete the establishment, publish a page or erase an article.

**178 / 178** now. The mapping chosen:

| Domain | Permission |
| --- | --- |
| `products`, `categories`, `orphanProducts`, `externalProductMappings` | `products:read/write/delete` |
| `orders` | `orders:read/write/delete` |
| `kitchenTickets` | `kitchen:read/write` |
| `stores` | `stores:read/write/delete` |
| `menus` | `menus:read/write` |
| `payments` | `payments:read` / `payments:refund` |
| `promotions`, the 6 `email*` modules | `marketing:read/write` |
| `cms`, `blog`, `cmsMedia` | `content:read/write/delete` |
| `games`, `prizes`, `gameQRCodes`, `requiredActions`, `prizeRedemptions` | `games:read/write` |
| `languages`, `translations` | `translations:read/write` |
| `storeIntegrations` | `settings:read/write` |
| `contactMessages` | `customers:read/write` |
| `teamMembers` | `team:read` |

**Two RBAC resources were missing.** `marketing` (found in S2-2: the permission
was required without existing) and `content` — the CMS and the blog had no
resource of their own, which partly explains why nobody had put a permission on
them. Both are added to the `Resource` enumeration and granted:
read/write/delete for SUPER_ADMIN and CLIENT_ADMIN, read/write only for MANAGER —
a manager writes and publishes, the owner deletes.

**Matrix verification obtained**: 16 cases run against `hasPermission`, all
conforming. The point that mattered most — the `kitchen` role keeps
`kitchen:read/write` and `orders:read`, so the KDS stays operable — and it still
has neither `content:write`, nor `marketing:write`, nor `stores:delete`.
5 regression tests added.

> Same caveat as S2-2: applied to the reference app only. `apps/themes` has had
> the seam since S2-1 but its wrappers diverge and need a dedicated pass.

### S2-8 / S2-9 — the team (21 August)

**S2-8 — why the team screen was decorative.** `acceptInvitation` stamped
`teamMembers.userId` and stopped there, while `getAuthUser` resolves rights
exclusively from `userProfiles` and **never** reads that table. A manager invited
with a full set of permissions accepted… and received nothing.

The fix keeps **a single source of authority**, `userProfiles`: `teamMembers`
stays the registry and the invitation trail, and accepting provisions the profile
the authorization chain already consults. `invitationGrant` is the bridge — the
function that was missing.

One explicit choice: an `allStores` membership produces **no** establishment
list. Enumerating every store would silently widen access to each newly created
restaurant; those memberships remain a super-administrator's business, and they
are also the only ones who can create them.

**S2-9 — three separate holes.**

1. **`acceptInvitation` had no authentication at all** and took the `userId` to
   link as a plain argument. A captured invitation token therefore allowed
   attaching **any account** to the post. The caller is now derived from the
   session.
2. **Every team mutation was an `authedMutation`** — "are you signed in" and
   nothing else. `assertCanManageMember` (23 tests) carries the rule: only
   SUPER_ADMIN and CLIENT_ADMIN manage a registry, a CLIENT_ADMIN only on their
   own establishments, and an `allStores` membership requires a
   super-administrator. `update` checks the member **as they are and as they
   would become**, otherwise an owner could promote a local member to chain-wide
   access.
3. **The real entry point was not guarded.** The team screen does not call
   `invite` but the `teamMembersEmail.sendInvitationEmail` action, which reaches
   the registry through `inviteInternal` and therefore **bypassed the guard
   entirely**. It only checked "signed in": any account could invite itself as
   `manager` on any establishment, or chain-wide. Both invitation actions now go
   through an internal query applying the same policy.

**Two IDORs closed in passing.** `getByUser` accepted an arbitrary `userId` and
`getByEmail` an arbitrary email, both auth-only — enough to read anyone's role,
permissions and establishments, or probe whether an address belongs to a team.
The first becomes `getMyMemberships` (derived from the session), the second moves
to `storeQuery` with `team:read`.

> Observation: **no invitation-acceptance interface exists**. No caller of
> `acceptInvitation` anywhere in the repository, no route containing "invit". The
> mail goes out with its link and nothing consumes it. The chain is now correct
> end to end on the server; the page is missing.

**Bite proof**: the `not_permitted` and `chain_wide` guards neutralised → **6
tests red**. Restoration verified at 434/434.

**Final state of `authed*` in the reference app: 3**, all justified —
`stores.create` (no establishment to attach to, guarded by `stores:write`) and
the two `paymentConnections` (deployment level, guarded by `payments:read`).

### S2-10 / S2-11 — the guardrails (21 August)

**S2-10 — 17 authorization tests** (`apps/reference/tests/convex/`) running the
**real** Convex functions against the **real** schema, in memory, through
`convex-test` (already used by `apps/site`). They assert what must be
**refused**:

- with no session: store-scoped reads and writes rejected;
- cross-establishment: an owner of A neither reads, writes nor deletes in B;
- insufficient role: the kitchen does not delete the establishment, does not read
  email campaigns, a waiter does not see win ratios;
- escalation: a customer does not promote themselves to `manager`, an owner does
  not grant access to a third-party establishment nor create another admin;
- identity never as an argument: `orders.getByCustomer` and
  `userProfiles.getByUserId` must no longer **exist**, which two tests check
  explicitly.

Three mirror tests check the opposite — the owner passes, the super-admin goes
through, **and the kitchen still reads its own screen**. That was the real risk
in S2-4: locking the kitchen out of the tool it uses.

**S2-11 — two ESLint rules**
(`@be-in-digital/convex-functions/eslint/convex-auth`, moved on 21 August from
`apps/reference/eslint-rules/`), applied to `convex/*.ts`:

| Rule | Forbids |
| --- | --- |
| `no-unguarded-convex-function` | `query(…)`, `mutation(…)`, `authedQuery(…)`, `authedMutation(…)` with no annotation |
| `require-convex-permission` | `storeQuery`/`storeMutation` with no `permission:` |

Two escape hatches, **deliberately distinct**: `@public-by-design` (reachable by
everyone — storefront catalogue, token access) and `@guarded-inline` (authorized,
but by a policy the seam cannot express). Conflating them would let a guarded
mutation read as "public", which is exactly the confusion that produced this
sprint.

> **A mistake made and corrected.** My first annotation script stamped
> `@public-by-design` on 7 `teamMembers` mutations, on `categories.reorder` and on
> two `orders` queries — all internally guarded, none public. That is the
> whitewashing this ticket is meant to prevent, produced by the very tool meant
> to prevent it. Hence the second annotation, and a manual pass.

**Bite verified**: reintroducing `export const list = query(defs.list)` in a
migrated file produces an immediate ESLint error.

### S2-12 — closed: 58 exports sorted, 5 more holes (21 August)

Every module was **read** before being classified. Five real defects came out of
that sorting, three of which the initial audit had never seen:

| Defect | What it allowed |
| --- | --- |
| `cmsMedia.*` (4 functions) | Auth only with a client-supplied `storeId`: browsing **and deleting** another restaurant's media library |
| `emailEvents.listByCampaign` / `listBySubscriber` | Reading a competitor's open and click history |
| `blogAutoConfig.upsert` | Checked the caller's *plan*, never their access to the `storeId`: a subscriber could enable auto-publishing on someone else's, and `targetStoreIds` aimed at several establishments |
| `seedKitchenOrders` / `cleanKitchenSeed` | Demo fixtures deployed to production: injecting fake orders into **any** kitchen |
| `ownerEntitlements.upsert` | **Billing bypass** — see below |
| `ownerEntitlements.getByOwnerId`, `paymentConnections.disconnect`, `uberEatsConnections.disconnect` | IDOR on subscription state; cutting off the payment provider or the Uber Eats integration from any account |

**The most instructive: `ownerEntitlements.upsert`.** Its guard said "users may
only modify **their own** entitlements" — wording that sounds protective and does
exactly the opposite. Entitlements unlock paid features (autoBlog and its caps):
letting everyone write their own allowed granting yourself a plan you had not
bought. The schema said as much: "source of truth: Stripe webhooks; for now
manually editable by an admin". Reserved to the super-admin, with an internal
path for Stripe.

**Final classification: 50 `@public-by-design`, 43 `@guarded-inline`**, each with
its written reason. The exemption list in `eslint.config.mjs` was **deleted**:
both rules are now `error` on `convex/*.ts` with no file-level escape hatch. Bite
re-verified after the deletion.

### History — what the rule had revealed

Turning the rules on surfaced **~58 unguarded exports in 20 modules the initial
audit had never enumerated**: `maintenance`, `system`, `cmsMedia`,
`blogAutoConfig`, `ownerEntitlements`, `favorites`, `globalSettings`,
`uberEatsConnections`, `seedKitchenOrders`, `emailEvents`, `blogAutoUsage`,
`auth`, `prizeRedemptions`, `emailSubscribers`, `contactMessages`,
`userProfiles`, `stores`, `paymentConnections`, `blog`, `cms`.

They are **listed in `eslint.config.mjs` as `warn`, not annotated**. Putting
`@public-by-design` on code nobody has read would make an unreviewed surface look
reviewed — worse than visible debt. Each file must get the S2-3 treatment; that
list reaching zero is what closes S2-12.

> Tooling note: `tests/` is excluded from the reference app's `tsconfig`, as in
> `apps/site` — the `convex-test` suites rely on Vite's `import.meta.glob` and on
> the harness generics. They stay checked at runtime by vitest.

### Rest of Sprint 2

`S2-1` (move the seam into the package), `S2-2` (68 `authed*` to migrate),
`S2-3` (44 bare exports to classify), `S2-4` (83 missing permissions),
`S2-8`/`S2-9` (`teamMembers`), `S2-10` (`convex-test` suite), `S2-11`
(anti-regression ESLint rule).

Implementation note for S2-1: `convex/lib/storeFunctions.ts` imports
`../_generated/server` and `../_generated/dataModel`, both app-specific. It
therefore cannot be moved as it stands — it has to become a **factory**
(`createStoreFunctions({ query, mutation })`) that each app instantiates with its
own generated builders.

> Note: `@beyours/site` fails the type-check on `@calcom/embed-react`, declared in
> its `package.json` but absent from this worktree's `node_modules`. A
> pre-existing defect, unrelated to these tickets.

---

## 1. The constraint that orders everything else

Today, **CI is incapable of failing** on a functional regression:
- Latest Playwright report: **510 tests, 0 passed, 510 *skipped***, report `ok: true`.
- Three locks in series: `vars.CONVEX_E2E_ENABLED` missing → job not triggered;
  `secrets.E2E_NEXT_PUBLIC_CONVEX_URL` missing → step skipped; `setup`/`admin`
  projects not registered without a real backend → 33 specs out of 43 disabled.
- The status job goes green when the job is *skipped*.

**Direct consequence for the order of work**: until this is settled, every fix in
the following sprints ships **unverified**, and nothing stops it being broken
again the week after. Sprint 0 is therefore not a comfort phase: it is a hard
dependency. No ticket from sprints 1 to 6 should be declared "done" before the
Sprint 0 gate is passed.

Second structural lever: **the packages have 50 test files, the app has 2** (one
of which covers code that is never called). The implementation rule that follows
is constant throughout this plan — **fix in the package, wire in the app**. A fix
written in `apps/reference/convex/` is an untested fix.

---

## 2. The real shape of the work

The scope does not fit in one sprint. An honest estimate, in developer-days:

| Sprint | Theme | Effort | Blocking for production |
| --- | --- | --- | --- |
| **S0** | Restore the ability to fail | 3–4 d | Absolute prerequisite |
| **S1** | The money | 4–5 d | Yes |
| **S2** | Multi-tenant isolation | 6–8 d | Yes |
| **S3** | Exposed surface | 4–5 d | Yes |
| **S4** | Silent failures | 4–5 d | Yes |
| **S5** | Storefront and cart | 3–4 d | Yes |
| **S6** | Architecture and cleanliness | 5–6 d | No |
| | **Total** | **29–37 d** | |

That is **3 two-week sprints with two developers**, or 6 to 7 weeks with one.
S0 → S5 make up the "ready for a first real client" batch; S6 is technical debt
to handle right after, not before.

**Recommended split into three iterations:**

- **Iteration 1** — S0 + S1: CI bites, and no more money leaks.
- **Iteration 2** — S2 + S3: no data crosses a client's boundary any more.
- **Iteration 3** — S4 + S5, then S6: no feature lies any more, then we clean up.

**Exit gate between each iteration** (go / no-go): CI is green *and* the Sprint 0
bite proof has been replayed (see S0-8).

---

## 3. Sprint 0 — Restore the ability to fail

**Goal**: by the end of the sprint, deliberately breaking an assertion turns CI
red. Nothing else counts.

| ID | Ticket | Where | Done when |
| --- | --- | --- | --- |
| **S0-1** | Provision a Convex deployment dedicated to tests, set `CONVEX_E2E_ENABLED=true` and the `E2E_*` secrets | GitHub repo settings, `.github/workflows/e2e.yml:14,17-28` | The `e2e` job triggers on a PR and actually runs Playwright |
| **S0-2** | Remove the silent green: the job fails if the suite is skipped or if `expected === 0` | `e2e.yml:64-72,100`, `e2e-status` job `:126-143` | A PR with 0 tests executed is **red** |
| **S0-3** | Repair the specs written against a stale interface | `e2e/auth/sign-in.spec.ts:10,19,29`, `sign-up.spec.ts:80`, `storefront/public-pages.spec.ts:60,68,91,99,122,130`, `storefront-layout.spec.ts:18,28,52` | Those specs pass against the real (French) UI, without adapting the UI to the test |
| **S0-4** | Eliminate the `if (hasX) { …assertions… }` pattern with no `else` — **80 occurrences across 15 specs**; replace with seeded fixtures or real, visible `test.skip` | `admin/store-detail.spec.ts` (17), `order-detail.spec.ts` (10), `inventory.spec.ts` (10), `kitchen.spec.ts` (7), `email-campaigns.spec.ts` (7), + 10 others | Zero assertions locked inside a condition with no `else`; skipped tests show as *skipped*, not *passed* |
| **S0-5** | Tighten the console-error filter: drop `/convex/i`, `/401/`, `/403/`, `/500 …/`, `/Internal Server Error/i`, `/Failed to fetch/i`, `/Module not found/i`, `/@be-in-digital/i` | `e2e/helpers/console.helpers.ts:7-32` | The 13 "no console error" tests detect a simulated backend failure |
| **S0-6** | Deterministic e2e seed: establishment, catalogue, orders, tickets — enough to make the 80 conditions of S0-4 unnecessary | `apps/reference/scripts/seed-users.mts` (fix the missing `setAuth`, which makes profile creation fail silently) + a new data seed | A fresh database produces a stable data set; the script fails loudly if it could not write |
| **S0-7** | Install `convex-test` in `packages/convex-functions` (already used at `^0.0.44` in `apps/site`) and set coverage thresholds | `packages/convex-functions/package.json`, the app's and the package's `vitest.config.ts` | `pnpm test` fails below the threshold; a first authorization test runs |
| **S0-8** | **Bite proof**: deliberately break an assertion, an auth guard and a total computation; verify CI goes red each time; document the procedure | `tasks/` (appendix to this document) | Three reds obtained and documented. **This is the sprint gate.** |

> Without S0-8, there is no evidence CI protects anything. This ticket is not a
> formality: it is the only one that validates the other seven.

---

## 4. Sprint 1 — The money

**Goal**: no path allows paying less than owed, validating a payment that never
happened, or losing the customer after payment.

| ID | Ticket | Audit defect | Where |
| --- | --- | --- | --- |
| **S1-1** | Remove `discountAmount` from the public arguments; recompute the discount server-side from `promotionId` | **B-02** — `discountAmount: 99999999` → total €0, kitchen ticket issued | `packages/convex-functions/src/orders.ts:202,291-292`; exposure at `apps/reference/convex/orders.ts:71` |
| **S1-2** | Validate the promotion at computation time: existence, active state, date window, cap, per-customer usage | Same path: `usageCount` is incremented with no rule checked at all | `packages/convex-functions/src/orders.ts:325-334` |
| **S1-3** | Derive `customerId` from `identity.subject` instead of accepting it as a `v.string()` | An order can be attributed to another customer | `packages/convex-functions/src/orders.ts:163` |
| **S1-4** | SumUp: compare `checkout_reference` to `orderId` **and** `checkout.amount` to `order.total`; make the `checkoutId` non-replayable | **B-03** — a €1 payment validates a €200 order | `apps/reference/convex/sumup.ts:108-183` (reference read at l.141, never compared) |
| **S1-5** | PayPal: re-read `reference_id` at capture, verify the amount; fix the sandbox detection (`clientId.startsWith("A") === false` switches live keys to sandbox) | **B-03** (variant) + payments never captured | `apps/reference/convex/paypal.ts:30-31,141-208` |
| **S1-6** | Wire a real refund call to the provider — or remove the button from the UI | **B-04** — the mutation only does a `db.patch`, no PSP call anywhere | `packages/convex-functions/src/payments.ts:109-137` |
| **S1-7** | Write the four missing routes: `/checkout/success`, `/checkout/cancel`, `/checkout/pay`, `/track/[token]` | **B-01** — probed over HTTP: 404 on all four | `app/(storefront)/checkout/page.tsx:323,325,330,331,344,345`; `order/[orderId]/page.tsx:138` |
| **S1-8** | Return the `viewToken` to the client after an order and show it on the confirmation screen | A guest today has no way of finding their order again | `packages/convex-functions/src/orders.ts:297,321,344` |
| **S1-9** | Align the displayed total with the charged total (VAT) | Subtotal €20 at 10%: the page says "€20 taxes included", Stripe charges €22 | `components/storefront/order-summary.tsx:52,242` |
| **S1-10** | Send `uberDirectFee` / `uberDirectEstimateId` from the checkout, or remove `percentage` mode | Every delivery order fails in percentage mode | `checkout/page.tsx:275-306` vs `orders.ts:279-281` |

**Tests required to close the sprint** (in
`packages/convex-functions/src/__tests__/`, next to the existing
`orders.test.ts`): forged discount rejected · expired promotion rejected · usage
cap respected · mismatched SumUp/PayPal reference rejected · mismatched amount
rejected · the four routes answer 200 in e2e.

---

## 5. Sprint 2 — Multi-tenant isolation

**Goal**: no restaurant's data is readable or modifiable by an account attached
to another. This is the heaviest sprint, and the most mechanical.

**Measured volume**: 68 uses of `authedQuery`/`authedMutation` across 13 files,
44 functions exported as bare `query(defs.X)` / `mutation(defs.X)`, and **83 of
the 102 `storeQuery`/`storeMutation` functions declare no `permission:`** (only
19 do).

| ID | Ticket | Where | Done when |
| --- | --- | --- | --- |
| **S2-1** | Move the authorization seam to `packages/convex-functions` so `apps/themes` inherits it | `apps/reference/convex/lib/storeFunctions.ts` (the only copy in the whole repository; `apps/themes/convex/lib/` does not have it) | The client deliverable applies the same policy as the test bench |
| **S2-2** | Migrate the 68 `authedQuery`/`authedMutation` to `storeQuery`/`storeMutation` with `storeIdFrom` | `blog.ts`, `cms.ts`, `emailSubscribers.ts`, `emailCampaigns.ts`, `emailSegments.ts`, `emailTemplates.ts`, `emailAutomations.ts`, `kitchenTickets.ts`, `orders.ts`, `payments.ts`, `storeIntegrations.ts`, `stores.ts`, `teamMembers.ts` | Zero `authedMutation` left on a resource attached to an establishment. The `storeIdFromDocument` helper already exists (`storeFunctions.ts:115-125`) |
| **S2-3** | Classify the 44 bare exports: explicitly mark those that are **public by intent** (storefront catalogue), migrate the rest | `prizes.ts:4`, `gameQRCodes.ts:4`, `games.ts:5`, `requiredActions.ts:5`, `paymentConnections.ts:9,24`, `orphanProducts.ts:4-5`, `externalProductMappings.ts:4-6`, `translations.ts`, `cmsMedia.ts` | Every public export carries a comment justifying its exposure; the others are guarded |
| **S2-4** | Declare `permission:` on the 83 functions that have none | `stores`, `orders`, `promotions`, `languages`, `menus`, `cms`, `blog`, `teamMembers`, `kitchenTickets` | A `kitchen` account can no longer delete the establishment nor publish a page. Model to replicate: `convex/products.ts` (11/11) |
| **S2-5** | Lock `userProfiles.upsert`: force `userId = identity.subject`, take `role`, `storeIds` and `permissions` out of the client arguments | **B-05** — `manager` passes the guard; `userId` and `storeIds` come from the client | `apps/reference/convex/userProfiles.ts:26-48`; `packages/convex-functions/src/userProfiles.ts:37-47` |
| **S2-6** | Remove `userProfiles.getByUserId` in favour of `getMyProfile` (a single caller to route) | **B-06** — anyone's role and scope, with no authentication | `convex/userProfiles.ts:6`; caller `components/admin/AdminAuthSync.tsx:20` |
| **S2-7** | Create a bootstrap path for the first `super_admin` (today: chicken and egg, only a `super_admin` can appoint one) | `convex/userProfiles.ts:34-43` | A fresh deployment can appoint its first administrator without direct database access |
| **S2-8** | Wire `teamMembers` into the authentication chain — or remove the screen | Auth reads `userProfiles` and never consults `teamMembers`: a manager invited with 8 permissions obtains no rights | `packages/convex-functions/src/auth.ts:35-53`, `teamMembers.ts:224-229` |
| **S2-9** | Secure `teamMembers.create/update/acceptInvitation` (today `authedMutation`, or no auth at all for `acceptInvitation`) | Any account can insert itself as `allStores: true, role: "manager"` | `convex/teamMembers.ts:53-58,73-88` |
| **S2-10** | **Authorization test suite** with `convex-test`: for each guarded function, a "user of store A rejected on store B" case and an "insufficient role rejected" case | New `packages/convex-functions/src/__tests__/authorization.test.ts` | Every guarded function has its negative test. This is what makes S2-2 to S2-4 verifiable |
| **S2-11** | **Guardrail**: an ESLint rule forbidding bare `query(defs.` / `mutation(defs.` and `authedMutation` in `apps/*/convex/`, unless annotated `// @public-by-design: <reason>` | `eslint.config.mjs` | A PR reintroducing an unguarded function is red |

> **Why S2-11 is a ticket and not a good intention.** The 112 sites to fix are not
> 112 independent mistakes: they are one habit, repeated. Fixing the sites without
> fixing the habit guarantees the reappearance.

---

## 6. Sprint 3 — Exposed surface

| ID | Ticket | Defect | Where |
| --- | --- | --- | --- |
| **S3-1** | Authenticate `api/files`, enforce a prefix allowlist, resolve the key through a record attached to the requester's establishment | **B-07** — unauthenticated S3 proxy over the whole bucket; the only protection is `key.includes("..")`, ineffective on S3 | `app/api/files/[...key]/route.ts:19-57` |
| **S3-2** | Prefix upload keys with `storeId` | Every tenant writes into the same prefix | `app/api/upload/route.ts:104` |
| **S3-3** | Really verify the SNS signature (certificate download, canonical string) and pin the `TopicArn` | **B-08** — only the *shape* of the caller-supplied URL is validated | `convex/emailHttpHandlers.ts:178-207` |
| **S3-4** | Sanitise SVGs server-side in `api/upload`; replace the regex-based sanitiser with DOMPurify in SVG mode | Stored XSS on the shop's origin. `<svg/onload=…>` passes the current filter, which requires a space before `on` | `app/api/upload/route.ts:76-82`, `packages/cms/src/sanitize/svgSanitizer.ts:31-34` |
| **S3-5** | Sanitise rich HTML **on write**, not only on display | The only barrier is a client-side `DOMPurify`, downstream | `packages/convex-functions/src/blog.ts:421-463`; reuse `sanitizeContent` from `blogAutoGenerate.ts:307-321` |
| **S3-6** | Add a `Content-Security-Policy` | Absent; the other headers are correctly set | `next.config.ts:12-25` |
| **S3-7** | Introduce rate limiting — **there is none anywhere in the application** — on `api/contact`, `contactMessages.create`, `gamePlay.play`, `recordScan`, `translateUIStrings`, `api/upload`, and sign-in attempts | Flood relay, OpenAI key drain, unlimited plays | cross-cutting |
| **S3-8** | Scope and cap `getPresignedUploadUrl` (no `requireStoreAccess`, no size constraint on the presigned URL) | An object of arbitrary size written by any account | `convex/storageUpload.ts:68-117` |
| **S3-9** | A dedicated secret for `api/email/send` instead of reusing `BETTER_AUTH_SECRET`; validate that `resetLink` belongs to the domain | The session signing key doubles as an API token; an arbitrary `resetLink` means phishing from a verified domain | `app/api/email/send/route.ts:4`, `packages/core/src/aws/ses/route-handler.ts:21` |
| **S3-10** | Validate the 6 API routes with Zod, as `CLAUDE.md` requires | Zero Zod today; only a manual regex in `contact-service` | `app/api/**/route.ts` |
| **S3-11** | Settle the model inconsistency: `storageUpload.ts:112` states the bucket is publicly readable, `api/upload/route.ts:120` states the opposite | One of the two assumptions is false — so one of the two protections is illusory | — |
| **S3-12** | Webhook idempotency: store `sequence_guid` / `event_id` to reject replays | A captured signed payload is replayable indefinitely | `deliverooWebhookHandler.ts`, `uberEatsWebhook.ts` |
| **S3-13** | Fix the Uber Eats webhook's multi-tenant attribution: when `fetchOrder` fails, the integration chosen is `allIntegrations[0]` | One restaurant's order lands in another's | `convex/uberEatsWebhook.ts:110-112` |

---

## 7. Sprint 4 — Silent failures

**Goal**: no feature displays a success it did not produce. This is the most
commercially dangerous category — the restaurateur finds out from their customer,
never from an error message.

| ID | Ticket | Symptom | Where |
| --- | --- | --- | --- |
| **S4-1** | Fix the phantom roles `["owner", "admin", "super_admin"]` — two of those do not exist in the schema | **B-09** — the owner (`client_admin`) cannot save anything in the settings | `convex/globalSettings.ts:42,63` vs `packages/convex-schema/src/tables/userProfiles.ts:10-18` |
| **S4-2** | Re-register `executeTranslation` and `batchChunk` as `internalAction` | `fetch` does not exist in the mutation runtime; the error is swallowed and the job marked `completed` | `convex/autoTranslate.ts:19,21`; the correct pattern sits right next door in `cmsAutoTranslate.ts:10` |
| **S4-3** | Make `getForDisplay` reachable without a session (public query or opaque screen token) | The in-room TV screen has no session: it stays stuck on "Chargement". The payload is already anonymous | `convex/kitchenTickets.ts:86-89`; pattern available: `getByTrackingToken` `:275-307` |
| **S4-4** | Create `convex/crons.ts` — **there is none** | Scheduled campaigns, weekly/monthly autoBlog and `resetDailyQuota` never fire | new file; `emailCampaigns.ts:157-171`, `blogAutoConfig.ts:61` |
| **S4-5** | Split campaign sending into scheduled batches (today: a sequential loop with a 100 ms pause inside a single action) | 5,000 subscribers ≈ 8 min of pure waiting → timeout, campaign stuck in `sending`, no resume, duplicates on retry | `convex/emailCampaignActions.ts:122-183` |
| **S4-6** | Actually send the double opt-in email | The token and the `pending` status are created, the email is never built or sent; the subscriber stays `pending` forever while the UI says "Vérifiez votre boîte mail". **A GDPR obligation not met** | `packages/convex-functions/src/emailSubscribers.ts:140-161`; the safe code exists and is tested in `packages/marketing/src/double-opt-in.ts` but is called nowhere |
| **S4-7** | Add the `List-Unsubscribe` and `List-Unsubscribe-Post` headers | A Gmail/Yahoo requirement since 2024; with a plain GET, anti-spam scanners unsubscribe recipients by prefetching the link | `convex/emailCampaignActions.ts:135-159` |
| **S4-8** | Base the game cooldown on a server identity (IP or signed httpOnly cookie) rather than a client UUID | The 24 h cooldown falls to `localStorage.clear()` → unlimited plays, prize stock drained in seconds. The `ipAddress` field exists in the schema and is never written | `lib/game/fingerprint.ts:11-21`, `packages/convex-functions/src/gamePlay.ts:382,399-408` |
| **S4-9** | Fix the `"anonymous"` fallback: every device in private browsing shares a single cooldown row | The first player blocks all the others for 24 h | `lib/game/fingerprint.ts:24` |
| **S4-10** | Require server-side that the required actions are covered before `play` | `completedActions` is accepted as given: a direct call skips the whole actions screen | `packages/convex-functions/src/gamePlay.ts:364,432` |
| **S4-11** | Prize codes: move to a cryptographic draw and fail explicitly on collision (today `Math.random()` and insertion despite the collision after 5 attempts) | A duplicate permanently hides a prize; `findRedemptionByCode` uses `.first()` | `packages/convex-functions/src/gamePlay.ts:27-33,537-541` |
| **S4-12** | Kitchen printing: implement the three cloud providers **or** remove them from the list | `if (printConfig.provider !== "browser") return` — a restaurateur who picks Star/Epson/Sunmi sees their tickets stay `pending` indefinitely, with no error | `components/admin/kitchen/KitchenPrintTrigger.tsx:11,45` |
| **S4-13** | Stop marking a ticket printed on `onafterprint` (which also fires on cancel); add a server lock against double printing | False print positive; two kitchen screens open = double printing | `KitchenPrintTrigger.tsx:38,50,135` |
| **S4-14** | Expose a UI for `stores.updatePrintConfig` | The mutation exists, no interface calls it: printing cannot be enabled | `convex/stores.ts:91` |
| **S4-15** | Disable the KDS buttons during the mutation | Double-clicking "Accepter" = double acceptance on the partner's side | `components/admin/kitchen/TicketCard.tsx:83-139` |
| **S4-16** | Bound `getByStore` and the dashboard queries (unbounded `.collect()`) | Every ticket ever loaded into the kitchen's browser; the dashboard exceeds the Convex read limit on a busy restaurant | `packages/convex-functions/src/kitchenTickets.ts:21-30`, `orders.ts:21-30` |
| **S4-17** | Add error boundaries (`error.tsx`) — **there are none** | A Convex query that throws surfaces as a Next error screen instead of a readable 403 | `apps/reference/app/` |
| **S4-18** | Handle the Stripe Checkout return on the subscription side: `replaceState(…, "/admin/subscription")` points at a route that does not exist | After paying, the URL becomes a 404 | `components/admin/subscription/SubscriptionPage.tsx:24` |

---

## 8. Sprint 5 — Storefront and cart

| ID | Ticket | Symptom | Where |
| --- | --- | --- | --- |
| **S5-1** | Index `removeItem` / `updateQuantity` on a line (`lineId`) rather than on `productId` | Two sizes of the same pizza: editing one edits both, removing one removes both | `packages/restaurant/src/stores/cart.ts:79-96`; surfaces `cart/page.tsx:234,301,316,339`, `cart-sheet.tsx:238,305,319,343` |
| **S5-2** | **Add the missing test**: `cart.test.ts:49` does create two lines of the same product with different options, but never removes one — exactly the case that breaks | Defect S5-1 slipped under an existing test | `packages/restaurant/src/__tests__/cart.test.ts` |
| **S5-3** | Block adding to the cart without mandatory options from the favourites | A dish with a mandatory option goes to the kitchen with no size | `components/storefront/favorites-grid.tsx:62-74` |
| **S5-4** | Remove the fallback `productId` fabricated by `MealCard` | `"__fallback_…"` is rejected by `v.id("products")` at checkout → **the whole order fails**, cart stuck until emptied | `components/website/meal-card.tsx:49`, `HomepageContent.tsx:44-47` |
| **S5-5** | Scope the product page by establishment | A shared link adds a product from another restaurant to the cart; the order fails at checkout | `app/(storefront)/product/[productId]/page.tsx:42-44`, `client.tsx:41` |
| **S5-6** | Unify favourites on Convex (two disconnected systems: localStorage on the homepage, Convex in the account); fix the zustand selector that never re-renders | A favourite set on the homepage never appears in "Mes favoris" | `lib/stores/favorites-store.ts`, `lib/hooks/use-favorites.ts:15`, `components/website/favorite-button.tsx:26` |
| **S5-7** | Attach saved addresses to the user | Global localStorage persistence: on a shared machine, B sees and selects A's home address | `lib/stores/addresses-store.ts:41-99` |
| **S5-8** | Harden checkout validation: phone and email required for delivery, explicit address failure (today a bare `return`, the button does nothing) | Courier with no way to reach the customer; delivery order sent with no address | `components/storefront/checkout-form.tsx:34-38,175-188` |
| **S5-9** | Warn before emptying the cart on an establishment change | Cart lost with no confirmation and no message | `packages/restaurant/src/stores/cart.ts:106-114` |
| **S5-10** | **Product decision** — Blog: wire `listPublishedArticles` and create `/blog/[slug]`, **or** remove the section | 6 hard-coded articles, no article route (every link 404s), the whole editorial pipeline (TipTap, publishing, autoBlog, translation) leading nowhere | `app/(storefront)/blog/_components/BlogContent.tsx:18-73` |
| **S5-11** | **Product decision** — storefront i18n: wire `createTranslator`, **or** remove the language picker | The translator and 3 locales exist; no storefront page calls them. The picker reloads the page and everything stays in French | `lib/i18n/index.ts`, `components/storefront/language-selector-dropdown.tsx` |
| **S5-12** | Remove the decorative newsletter from the footer (it shows "Vous êtes inscrit" with no network call) or wire it | A false promise to the user | `storefront-footer.tsx:29-34` |
| **S5-13** | Fix the offset under the fixed header on pages that do not compensate | Headings hidden on `/product/[productId]` and `/store-selector` | `storefront-shell.tsx:32` — handle at the `<main>` level rather than page by page |

> **S5-10 and S5-11 are product decisions, not technical ones.** The current state —
> a visible feature that does nothing — is the worst of the three options. Removing
> is legitimate and quick; wiring is legitimate and costs more. Deciding nothing is
> not.

---

## 9. Sprint 6 — Architecture and cleanliness

Not blocking for production, to be handled immediately after.

| ID | Ticket | Size | Note |
| --- | --- | --- | --- |
| **S6-1** | Delete `lib/i18n.ts` — **first** | 91 lines | It shadows the `lib/i18n/` directory (resolution prefers the file), which has already forced a workaround import as `@/lib/i18n/index`. A trap that will go off at the next naive import |
| **S6-2** | Delete the proven dead code (zero imports, barrels included in the search) | ~2,000 lines | `components/admin/categories/` (451), `components/ui/` breadcrumb+chart+input-group+popover+scroll-area (783), `components/examples/` (185), `lib/json-ld.tsx` (137), `lib/seo.ts` (90), `lib/stores/marketing-store.ts` (89), `LanguageSwitcher.tsx` (61), `lib/store-url.ts` + `resolve-default-store.ts` (85), `app/api/translate/route.ts` (6) |
| **S6-3** | Make `packages/ui` the single source of components | 21 divergent, 0 identical | Two design systems drifting apart, inside the app that is supposed to validate the design system. The app consumes both: 109 local imports, 77 from the package |
| **S6-4** | Remove the `useAdminStoreId` fork | 36 uses | **Two sources of truth for the current establishment**, synchronised only by a side effect in `store-guard.tsx:48`. A desynchronisation gives wrong multi-tenant filtering in half the admin |
| **S6-5** | Delete `lib/admin/formatters.ts` (a literal copy, only the comments differ) and `lib/admin/types.ts` (318 lines redeclaring types derived from Zod in `packages/convex-schema`) | 400+ lines | The package already exports them |
| **S6-6** | Move the business logic back into the packages | ~3,700 lines | `imageToProduct.ts` (774, no twin), `blogAutoGenerate.ts` (622, a twin exists but is not imported), Deliveroo/Uber Eats/Uber Direct webhooks and actions (~1,900, while `packages/integrations` exists with its tests). 56% of `convex/` delegates nothing |
| **S6-7** | Migrate the 19 hard-coded `goTo()` calls in the onboarding tour to `adminRoutes`, then replace the 37 redirect stubs with `redirects()` in `next.config.ts` | 190 lines → one config entry | The stubs only survive to catch those 19 paths; they violate the rule written in `admin-routes.ts` itself |
| **S6-8** | Create `dashboard/games/settings` (it exists in `apps/themes`) or delete `adminRoutes.gamesSettings` + the stub + the spec line; harden the `status < 500` assertion that lets a 404 through | — | `e2e/admin/coming-soon.spec.ts:11,28` |
| **S6-9** | Gate `address-test` out of production | 1 line | A fixture built into production, outside `AuthGuard`, instantiating Google Maps with the public key. Used by a spec: gate it, do not delete it |
| **S6-10** | Complete or delete the 6 dead barrels | — | `components/ui/index.ts` exports only `button` out of 36 components; the `CLAUDE.md` "barrel files" rule is respected in appearance only |
| **S6-11** | Reduce loose typing: 78 `: any`, 23 `as any`, 79 `eslint-disable no-explicit-any` | — | Prioritise `systemInternal.ts:84-111` (insertion into a dynamically named table, in a function that empties the table before writing). Leave the `storeFunctions.ts` cast, justified and confined. Worth noting: **zero `@ts-ignore`** — the basic discipline is there |
| **S6-12** | Arbitrate the documentation | — | Delete `DASHBOARD_IMPLEMENTATION.md` (it describes a directory that is gone and a cookie-based read that is done in Zustand) and `SETUP_SUMMARY.md` (it promotes a dead component and a deleted package). **Settle** the contradiction between `MISE_EN_PROD.md` and `README.md:6,125`: test bench, or deployable application? |
| **S6-13** | Align `CLAUDE.md` with reality | — | It announces "Vitest 80%+ coverage" and an `apps/reference/__tests__/` directory that does not exist |
| **S6-14** | Merge `hooks/` and `lib/hooks/`, both alive | — | Inconsistent convention |
| **S6-15** | Decouple startup from infrastructure keys | — | The app refuses to boot without `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` and `OPENAI_API_KEY`, even to render the public homepage. Require those keys at use, not at boot |

---

## 10. Permanent guardrails

What makes this a plan rather than a catch-up session. Each is a real ticket,
attached to the sprint shown.

| Guardrail | Prevents | Sprint |
| --- | --- | --- |
| CI fails if the e2e suite is skipped or if `expected === 0` | The return of the silent green | S0-2 |
| Console filter restricted to genuinely harmless noise | A 500 or an `Access denied` going unnoticed | S0-5 |
| Coverage thresholds on `pnpm test` | Silent test erosion | S0-7 |
| ESLint rule: no bare `query(defs.` / `authedMutation` in `apps/*/convex/` without a justified annotation | Unguarded functions reappearing | S2-11 |
| Registry test: every `store*` mutation declares a `permission:` | The return of absent RBAC | S2-4 |
| `convex-test` suite: one negative test per guarded function | Isolation regressions | S2-10 |
| A test resolving every `redirect()` target and internal `href` | The return of phantom routes (the 4 payment routes 404ing) | S1-7 |
| Ban on a second design system: lint on `@/components/ui/*` imports once S6-3 is done | Components diverging again | S6-3 |

---

## 11. Definition of "done"

A ticket is only done if all five points are true:

1. The fix is written **in the package** when the logic belongs there, wired in
   the app.
2. A test **fails without the fix** and passes with it. For security tickets, that
   means a **negative** test (access is refused), not merely a positive one.
3. `pnpm lint && pnpm type-check && pnpm test && pnpm test:e2e` pass — with the
   e2e suite **actually executed**, not skipped.
4. No new `any`, no new `eslint-disable`, no new unguarded route.
5. If the ticket removes a promise from the interface, the interface is updated in
   the same commit — no visible feature that does nothing.

**Production gate**: S0 to S5 closed, plus a re-pass of the audit over the 9
blocking defects, plus the bite proof (S0-8) replayed on the final branch.

---

## 12. Risk register

| Risk | Likelihood | Impact | Countermeasure |
| --- | --- | --- | --- |
| S2 overruns: 112 sites to migrate, cross-dependencies | High | Delays the whole of iteration 2 | Migrate file by file with its negative test; ship in mergeable batches rather than one giant PR |
| Repairing the specs (S0-3, S0-4) reveals still-unknown defects | **High** | Scope grows mid-flight | This is expected, not suffered: budget 20% slack on iteration 1. A suite that has never run necessarily hides things |
| The test Convex deployment costs money or is delayed | Medium | Blocks the whole plan | Start it **before** the sprint begins — it is the only infrastructure prerequisite |
| The S1 fixes change the `orders.create` contract | Medium | Breaks `apps/themes` | Check `apps/themes` on every signature change; it consumes the same packages |
| Removing blog/i18n (S5-10, S5-11) is read as a regression | Medium | An argument at the end of the sprint | Settle it **before** iteration 3, not during |
| S6-3 (single design system) breaks screens silently | Medium | Visual regressions | Do it after S0: the repaired e2e suite becomes the net |

---

## 13. Out of scope

Named explicitly to avoid drift:

- Any new functional work.
- Reworking the data model or the Convex schema.
- `apps/site` and `apps/themes`, except point S2-1 (inheriting the authorization
  seam) and non-regression checks.
- Performance, apart from the two unbounded `.collect()` calls in S4-16, which are
  failures in the making rather than optimisations.
- Accessibility: the `auth-a11y` / `admin-a11y` specs are referenced in
  `playwright.config.ts:64,80` but **do not exist on disk**. To be handled in a
  dedicated batch, after this one.
---

## Control review of 21 August — three escalations closed

Three independent reviewers went through the full diff (130 files). They found
defects **in the fixes themselves**. The three privilege escalations are closed
below; the rest is listed under "Still to handle".

### E1 — Global promotion cap bypassable

`usageCount` was only incremented when an email was supplied. A promotion with
`maxTotalUsage: 1` therefore stayed usable indefinitely through anonymous orders:
the discount applied, the counter never moved. The *per-customer* cap had been
closed, the *global* one had not.

The counter now advances as soon as a promotion is applied; only the
`promotionUsages` registry, which is indexed by email, stays conditional. Emails
are lowercased **on both sides** — without which `A@b.com` and `a@b.com` were two
different customers.

### E2 — An owner could lock out the super-administrator

`assertCanAssignProfile` reasoned only about the **requested** role. But `upsert`
overwrites. A `client_admin` could therefore write
`{ userId: <the super-admin>, role: "customer", storeIds: [] }`: a
non-administrative role, no foreign establishment, every check passing — and the
deployment left with no administrator.

The policy now receives the target's **existing profile** and refuses two more
things: touching someone who already holds an administrative role, and
reassigning a member attached to an establishment you do not administer
(otherwise you poach a competitor's staff).

### E3 — Accepting an invitation overwrote the profile

Three real consequences: inviting the super-administrator as `kitchen` demoted
them the moment they clicked; a manager invited to a second restaurant lost the
first; and an "all establishments" membership produced an empty list, so the
member received **nothing** while losing what they had — the decorative-screen
bug, recreated.

`invitationGrant` now merges instead of replacing: never a demotion, never a lost
establishment. An invitation **adds** a place of work, it does not redefine the
person.

### E3bis — Revocation, the bridge's missing half

I had built the grant without the take-back. Removing a member deleted the
`teamMembers` row and left `userProfiles` intact: a dismissed employee vanished
from the team screen while keeping `manager` on the restaurant.
`revocationEffect` removes the establishment concerned and returns the role to
`customer` when none is left — without ever demoting an administrator, whose
authority does not come from the registry.

### Also fixed

`globalSettings.get` stripped only 2 of the 4 Uber Direct credentials:
`customerId` and `apiKey` were served to any anonymous visitor, while my
`@public-by-design` annotation claimed the opposite. That is exactly the
whitewashing the double annotation was meant to prevent.

**Bite proofs**: E2 guard neutralised → 3 tests red; E3 merge disabled → 3 tests
red. Restoration verified at **448/448**.

### Still to handle (21 August review)

| Subject | Origin |
| --- | --- |
| The ESLint rule ignores `action(…)` — ~56 public actions uncovered, including `kitchenTickets.acceptTicket/completeTicket/cancelTicket`, drivable from any account | mine |
| `orders.updateStatus` under `orders:write`: the `delivery` role can no longer advance an order | mine |
| `payments.create` / `updateStatus` under `payments:refund` — wrong verb | mine |
| `MANAGER` denied `marketing:*` while the team UI promises it to them | a call to make |
| `client_admin` blocked on `orders.remove` and `contactMessages.updateStatus` | mine |
| Success page: the branch with no provider reference declares the payment received and empties the cart without checking anything (SumUp 3-D Secure return) | mine |
| `/track/[token]` unreachable: the button points at `/order/…`, which breaks for a guest | mine |
| Reloading the PayPal success page → `ORDER_ALREADY_CAPTURED` → a failure screen on a paid order | mine |
| `percentage` mode: a saved address with no coordinates is a silent dead end | mine |
| Delivery quote not tied to the ordered address nor single-use | mine |
| Refund: no lock before the provider call, scalar `externalRefundId` overwritten by a second partial refund | mine |
| `claimFirstAdmin`: an open race on a fresh deployment | mine |
| Deliveroo/Uber Eats menu sync dead (store-scoped `getByStorePlatform` called by a scheduler) | **pre-existing** |
| `duplicateCatalog` keeps the source instead of the target | **pre-existing** |
| `uberEatsActions` (10 actions) and `getDeliveryQuote` unguarded | **pre-existing** |

---
## `apps/themes` pass — step 1: the seam and the rule (21 August)

The seam was **already** in place: `apps/themes/convex/lib/storeFunctions.ts` is
identical to the reference one and instantiates the same package factory. Nothing
to port on that side.

The ESLint rule, on the other hand, existed only in `apps/reference`. It now
lives in `packages/convex-functions/eslint/convex-auth.mjs`, next to the seam it
protects, and both applications import it. A rule that existed only in the test
bench would have let the client template — the one cloned to the restaurateur —
drift back into exactly the habit it exists to stop.

**What the rule found on arriving in `apps/themes`:**

| | reference | themes |
| --- | --- | --- |
| `no-unguarded-convex-function` | 0 | **230** |
| `require-convex-permission` | 0 | **29** |
| | | **259 errors across 38 files** |

Reference stays at 0 errors / 70 warnings after the move.

### What the measurement revealed about the themes ↔ reference drift

`apps/themes/convex` carries **no** `PATCH BOILERPLATE` marker: it is a pure
mirror of `apps/reference/convex`, not a variant. Of 92 files:

- **47 identical**
- **45 divergent** — the divergence is the hardening from sprints 1 and 2
- **6 absent from themes**: `prizeRedemptions.ts`, `gamePlay.ts`,
  `requiredActions.ts`, `gameEmail.ts`, `maintenance.ts`, `maintenanceEmail.ts`

Those six explain the crash reported in review: `GamesPage` calls
`api.prizeRedemptions.*`, a module that is not there. **The whole QR game flow is
dead in the client template** — not just the prizes page.

Comparing the exported surfaces file by file: they coincide everywhere except six
exports, and those six are precisely the leaks reference has closed.

| File | themes only | reference only |
| --- | --- | --- |
| `orders.ts` | `getByCustomer` | — |
| `teamMembers.ts` | `getByUser` | `getMyMemberships`, `internalAssertCanManage`, `internalAssertCanManageMember` |
| `ownerEntitlements.ts` | `getByOwnerId` | `internalGetByOwnerId`, `internalUpsert` |
| `storeIntegrations.ts` | `getByBrandId`, `getBySiteId`, `listByPlatformEnabled` | `internalGetByBrandId`, `internalGetBySiteId` |
| `bidSubscription.ts` | — | `createMaintenanceCheckoutSession` |

Operational conclusion: what follows is not 38 hand-written fixes but a **mirror
alignment**, reference → themes, callers included. Reference has already updated
its own callers (`deliverooWebhook`, `deliverooMenuSync`, `uberEatsMenuSync` point
at the internal versions), so the operation is coherent as one block. To check
before starting it: the callers outside `convex/` (`app/`, `components/`, `lib/`)
that still reference the removed public names.

### Step 1b — checking the callers outside `convex/` (21 August)

Before aligning the mirror, we had to be sure the six exports reference removed
or made internal are called nowhere else in themes. They are not:

| Area swept | Callers of `getByCustomer`, `getByUser`, `getByOwnerId`, `getByBrandId`, `getBySiteId`, `listByPlatformEnabled` |
| --- | --- |
| `apps/themes/{app,components,lib,hooks}` | 0 |
| `packages/*` | 0 |

Exhaustive confrontation: every `api.<module>.<fn>` in themes' application code,
checked against the surface `convex/` will expose after alignment. **No call would
break.** Aligning the `convex/` mirror is safe.

#### What the check found on top

The first sweep only covered `apps/themes` and saw nothing. That was the wrong
scope: themes' admin pages mount components coming from **`packages/admin`**, and
that is where the calls live. Widened to the package:

| Module called | By | State in themes |
| --- | --- | --- |
| `prizeRedemptions.getStats`, `.listPlays`, `.listRedemptions`, `.redeemByCode` | `games-page.tsx`, `winners-page.tsx` | **module absent** |
| `requiredActions.list`, `.create`, `.update`, `.remove` | `actions-page.tsx` | **module absent** |

themes does route to those pages (`dashboard/games`, `games/winners`,
`games/actions`). They crash on render.

**Why `tsc` does not see it**: `app/(admin)/layout.tsx` injects the api through
`setApi(api as unknown as Record<string, unknown>)`, and the store holds it as
`any`. The typing is lost at the boundary — the only sanction is a `TypeError` at
render. A class of failure neither the typecheck nor the lint can catch, and that
only the alignment closes.

#### What aligning `convex/` will NOT repair

- **The storefront QR game flow is a placeholder**, not a bug. themes ships a
  28-line `GameContent.tsx` displaying "Gamification flow will be implemented
  here". Also missing: the 10 game components, the 8 `lib/game/` files (wheel,
  confetti, fingerprint, sounds) and the whole `/game/prize/[code]` route. The
  client template sells a feature it does not carry.

#### False leads ruled out (checked, not defective)

- `maintenance.ts` / `maintenanceEmail.ts` absent: **correct**. That is the engine
  update lock, and themes calls it nowhere.
- `lib/services/contact-service.ts` absent: unused in themes.
- The Next routes `api/webhooks/{stripe,deliveroo/*}` specific to themes are not a
  second unguarded path: they are tombstones returning `410` towards the Convex
  endpoint. Verified by reading all three files.

#### A reservation about scope

Wholesale alignment is justified for `convex/` — the exported surfaces coincide
and themes carries no `PATCH BOILERPLATE`. It is **not** justified as-is for
`app/` and `components/`: themes has 47 components and 5 routes there that
reference does not. Those areas are handled by hand, not in bulk.

### Step 2 — aligning the `convex/` mirror (21 August)

50 files aligned on `apps/reference/convex`, including the **6 absent modules**
(`prizeRedemptions`, `requiredActions`, `gamePlay`, `gameEmail`, `maintenance`,
`maintenanceEmail`), plus `_generated/api.d.ts` — the Convex codegen requires a
configured deployment, but `_generated/` contains nothing deployment-specific and
the five files differed only by the 12 lines of the missing modules. Verified file
by file before transposition.
| | before | after |
| --- | --- | --- |
| lint errors | 259 | **0** |
| store-scoped functions | 29 | 189 |
| of which without `permission:` | 23 | **0** |
| annotations | 4 | 94 |
| `packages/admin` calls into the void | 8 | **0** |
| public leaks (`getByUser`, `getByCustomer`, …) | 6 | **0** |

`pnpm build` passes, `tsc --noEmit` passes. Reference stays at 0 errors, 122
tests green; the package at 448/448.

**Bite proof in themes**: permission removed from `prizes.ts` →
`require-convex-permission` red; `storeQuery` downgraded to `query` →
`no-unguarded-convex-function` red. File restored identically.

#### Two deliberate divergences, kept

Sweeping the 45 diffs beforehand avoided two kinds of damage a bulk copy-paste
would have caused:

- **`auth.ts`** — reference trusts `localhost:3000-3003` because its workspaces
  compete for ports. A client site runs on its own domain and has no reason to
  accept a development origin. themes keeps its strict list; only the annotation
  was ported. The reason is written into the file so a future sync does not
  "correct" it.
- **`http.ts`** — reference's comment claims the Next `/api/webhooks/*` routes
  have been deleted. True there, false in themes, which keeps them as `410`
  tombstones. Comment rewritten to say what is actually true where it sits.

Two files therefore still diverge, and that is intended. Everything else is
identical.

#### What remains open on themes

- The **storefront** QR game flow is still a 28-line placeholder: the backend is
  there now, the interface is not (10 components, 8 `lib/game/` files, the
  `/game/prize/[code]` route). The game admin, for its part, works.
- `app/` and `components/` are not aligned and must not be aligned wholesale:
  themes has 47 components and 5 routes there that reference does not.

---

## Review, point 1 — the ESLint rule was blind to `action(…)` (21 August)

`BARE_BUILDERS` covered `query` and `mutation`, the two builders the audit had
caught red-handed, and stopped there. An action is just as publicly callable.
**56 actions** were therefore slipping past the guardrail in each application.

The rule now covers them, with a distinct message: advising `storeQuery` to an
action would be absurd — it has no `ctx.db`. The message points at
`ctx.runQuery(internal.…)` and `@guarded-inline`.

### Triaging the 56 (reference)

Classifying by function name was not enough: `internalLoadForRefund` calls
`requireStorePermission` in its body, and my first sweep had filed it under "no
guard"; conversely `internalAssertCanManage` really was a guard I was looking for
in lowercase. Every internal target had to be **resolved** and its body
inspected.

| Verdict | Count | Treatment |
| --- | --- | --- |
| already correctly guarded | 14 | `@guarded-inline` annotation |
| public by nature (guest payment, delivery quote) | 7 | motivated `@public-by-design` |
| "signed in" only | 25 | a real guard added |
| nothing at all | 10 | a real guard added |

### The real holes that were closed

- **Kitchen** (`acceptTicket`, `readyTicket`, `completeTicket`, `cancelTicket`):
  any signed-in account could accept, advance, complete or cancel a ticket in any
  restaurant. Now `kitchen:write` on the ticket's store — with a test verifying
  the kitchen keeps access to its own.
- **`uberEatsActions`** (10 actions): enabling an integration, rewriting a menu
  item, creating a promotion, marking an order ready. The local `requireAuth`
  helper only checked the session; it now requires `settings:write` by role.
  These actions manipulate Uber Eats UUIDs, not Convex ids: there is no tenant to
  fall back on.
- **Menu sync** (Deliveroo ×2, Uber Eats ×1): no guard at all.
  → `products:write` on the synchronised store.
- **Provider OAuth** (`oauthConnect.generateOAuthUrl`, `uberEatsOAuth.*`):
  connecting a payment processor took nothing but an account. → `settings:write`.
- **S3** (`getPresignedUploadUrl`, `getPresignedUrlForMedia`): any account
  obtained an upload URL. → `content:write`, and on media the guard hangs off the
  owning store.
- **Catalogue import** (Deliveroo, Uber Eats) and **translation**:
  → `products:write` / `translations:write` on the received `storeId`.

### A defect repaired along the way

`deliverooOrders.acceptOrder/rejectOrder/updatePrepStage` read the order through
`api.orders.getById`, which only answers the owning customer or the bearer of the
tracking token — **never staff**. Those three actions therefore always fell on
"Order not found". Verified on `main`: pre-existing, not a regression from the
sprint. They now read through the internal path and check
`orders:update_status` on the order's store.

### A new guard: `authHelpers.checkPermission`

`checkStorePermission` can say nothing about an operation with no store —
connecting Stripe, starting an Uber Eats OAuth, requesting an S3 URL. And "is
signed in" is not an answer: that includes every customer who has ordered a pizza
once. The new guard checks the permission **by role**. `hasPermission` fails
closed on an unknown string, so a typo refuses instead of granting — a test
freezes that.

### What the rule does NOT prove

Bite proof in two steps:

1. Annotation removed from `acceptTicket` → rule red. ✅
2. `requireAuth` reduced to "signed in" while **keeping** the annotations →
   **no error**. The rule reads the claim, it does not verify it.

That is an inherent limit of a lint rule, and naming it beats ignoring it. It is
filled by **7 tests** on the two helpers every guarded action passes through:
refusing a customer, refusing a manager from another establishment, refusing the
kitchen on a global setting, accepting the owner, and refusing on an unknown
permission. Guard neutralised → 3 tests red; restored → 129 green.

**Gates**: reference lint 0 errors, type-check OK, 129 tests (up from 122).
themes lint 0 errors, typecheck OK, `pnpm build` OK. 29 files carried over to
themes; `auth.ts` and `http.ts` deliberately left aside.

## Review, point 2 — permissions that named the wrong verb (21 August)

Four call sites refused someone the product puts at its centre.

| Function | Before | After | Who was refused |
| --- | --- | --- | --- |
| `orders.updateStatus` | `orders:write` | `orders:update_status` | the **kitchen** and the **delivery** role, whose entire job it is |
| `payments.create` | `payments:refund` | `payments:write` | wrong verb: taking money is not refunding it |
| `payments.updateStatus` | `payments:refund` | `payments:write` | same |
| `orders.remove` | `orders:delete` | unchanged | the **owner**, to whom the table did not grant `orders:delete` |
| `contactMessages.updateStatus` | `customers:write` | unchanged | the **owner**, to whom the table did not grant `customers:write` |

Two of the five are therefore not fixed at the call site but in the table of
roles: the verb was right there, it was the role that did not have it.
`client_admin` gains `orders:delete`, `payments:write` and `customers:write` — an
owner who can delete a product, a team member and a page, but not an order in
their own restaurant, was an oversight, not a policy.

`payments:write` is added to the two roles that already held `payments:refund`,
and to them alone: the verb is repaired without effective access moving.
Widening it to the manager or the waiter would be a separate product decision,
not taken here.

### The test that proved nothing

The first version of these tests queried `checkStorePermission` with permission
**strings**. Bite proof: putting `orders:write` back on `orders.updateStatus`
left them **all green**. They validated the role table and nothing about the call
site — coverage that reads like a guarantee without being one.

Rewritten to call the real mutations with a real document. New bite proof:

| Simulated regression | Effect |
| --- | --- |
| `orders:write` restored on `updateStatus` | **2 tests red** |
| `orders:delete` removed from `client_admin` | **1 test red** |
| restoration | 135 green |

One intermediate test did fail for a good reason:
`confirmed → out_for_delivery` is not a legal transition. It was the test that
was wrong, not the code; the courier collects an order that is **ready**.

**Gates**: reference 135 tests (up from 129), 0 lint errors, type-check OK.
themes 0 errors, typecheck OK. `packages/core` 195, `convex-functions` 448.

### Still pending: the manager and marketing

`DEFAULT_ROLE_PERMISSIONS` in `packages/admin/src/pages/team/team-page.tsx` ticks
**every** module for a manager, "Jeux / Marketing" included. The RBAC table gives
them neither `marketing:read` nor `marketing:write` nor `games:write`. The screen
promises, the server refuses.

Two opposite ways out — widen the role, or stop promising it — and the choice is a
product decision, not a fix.

**Settled on 21 August: widen the manager.** `MANAGER` receives `marketing:read`,
`marketing:write` and `games:write`. The screen was telling the truth; it was the
table that was wrong. A manager now runs the campaigns and games of the
restaurant they run — and nothing more: four tests freeze that they do not cross
the establishment boundary, and that the server was not widened in passing.

| Simulated regression | Effect |
| --- | --- |
| `marketing:write` and `games:write` removed from the manager | **2 tests red** |
| restoration | 139 green |

One of those tests first failed on a missing argument (`ruleOperator`) — my test
was incomplete, not the code.

---

## Payment and order-tracking block (21 August) — 3 defects out of 5

### 1. The success page declared a payment received without checking anything

The final branch of `checkout/success/page.tsx` set `state: "paid"` and emptied
the cart. Its comment said "a cash order, or a manual visit". **False**: cash
confirms on `checkout/page.tsx` and never lands here. What lands here is a return
that has lost its reference — the **SumUp 3-D Secure** one above all:
`redirectUrl` is `…/checkout/success?orderId=…` with no `checkoutId`, and that is
the link the bank uses, bypassing the widget which would have added the
reference.

A declined card therefore got a confirmation screen.

The branch now asks the server — a new `orders.getPaymentState` query returning
the status, the state and the order number, **and nothing else**: no customer, no
address, no amount. Paid → confirmation and cart emptied. Otherwise → a "payment
pending" screen. With no `orderId` → an incomplete link, announced as such.

### 2. Reloading the PayPal confirmation page broke a paid order

`capturePayPalOrder` called PayPal **before** reading anything. A capture happens
only once: on reload, PayPal returns `ORDER_ALREADY_CAPTURED`, the action throws,
and the customer sees "Confirmation impossible" on an order that is very much
paid. The `hasRun` guard on the React side only protected against re-rendering,
never against a reload.

The order is read first; if it is already paid, the action returns the result
without touching the provider. Idempotency belongs to the server.

Stripe and SumUp only re-read a status — replayable without harm. Verified.

### 3. The refund: no lock, and evidence overwritten

`recordRefund` revalidated against a fresh document, so the database could not
exceed the balance. What it could not do is run **before** the provider: two
simultaneous requests both read `refundedAmount: 0`, both passed `planRefund`,
and both sent the money. The database stayed consistent, the till did not.

Replaced by a two-phase refund — a Convex mutation being a transaction, the
reservation is the serialisation point:

| Step | Role |
| --- | --- |
| `reserveRefund` | commits the amount **before** the provider call |
| `confirmRefund` | attaches the provider reference **to that particular refund** |
| `releaseRefund` | gives the amount back if the provider refuses |

And `externalRefundId`, a scalar field, was overwritten by every partial refund:
the first lost its evidence and became irreconcilable. A `refunds` array now
keeps every operation; the scalar still points at the last one, for the screens
that read it.

**A bug my own tests caught**: my first version of `releaseRefund` set the status
back to `completed` — which `REFUNDABLE_STATUSES` rejects. Releasing a failed
refund would have made the money permanently unrefundable, the exact opposite of
the goal. Fixed to `succeeded`, and frozen by a dedicated test.

**Bite proof**: release status set back to `completed` → 2 tests red;
restoration → 457 green.

**Gates**: `convex-functions` 457 (up from 448), `core` 195, reference 139 tests
/ 0 errors, themes 0 errors, typechecks OK.

### Rest of the block

- `/track/[token]` unreachable for a guest: the order page obtains the tracking
  token through `kitchenTickets.getByOrder`, now store-scoped under
  `kitchen:read` — a guest is refused, so the link never shows.
- Delivery quote tied neither to the address nor to a single use; `percentage`
  mode with a saved address is a silent dead end.

---

## Payment-method audit (21 August) — findings, no fixes

Requested mid-block: are all the payment methods configurable, coded and tested?
Checked in the code, with no account access.

### What the settings screen offers

Card (`stripe` | `sumup`, with OAuth Connect/Disconnect), PayPal (toggle +
email), Cash (toggle, restricted to pickup/dine-in and to a signed-in customer).
**Square is absent from the screen.**

### Provider × lifecycle matrix

| | Stripe | SumUp | PayPal | Square | Cash |
| --- | --- | --- | --- | --- | --- |
| Config screen | yes | yes | yes | **no** | yes |
| Charge creation | yes | yes | yes | **no** | yes |
| Verification on return | yes | yes | yes | **no** | n/a |
| Refund | yes | yes | yes | explicit refusal | manual |
| Webhook | yes, signed | **no** | **no** | **no** | n/a |
| OAuth connection | stored but **ignored** | stored and **used** | **none** | **no** | n/a |

### The five debts

1. **The Stripe connection is stored and then ignored.**
   `/connect/stripe/callback` writes a `paymentConnections` row and the screen
   shows "connected", but `stripe.ts` references no connected account — no
   `stripeAccount`, no `on_behalf_of`, no `transfer_data`. Charging always goes
   through `STRIPE_SECRET_KEY`, the platform's key. The restaurateur believes
   they are being paid into their own account. SumUp, by contrast, really does
   read and decrypt the merchant's token.

2. **`paypalEmail` is never read.** The field exists in the settings and in the
   schema; `paypal.ts` contains neither `payee` nor `email_address`. The
   `paymentConnections` schema accepts `paypal` with a comment saying "merchant_id
   from onboarding webhook" — that webhook does not exist.

3. **Neither SumUp nor PayPal has a webhook.** Only the return page confirms the
   payment. A customer who pays and then closes their tab leaves the order
   `pending` indefinitely. Stripe is the only one covered, signature verified.

4. **Square is a ghost.** Present in the `payments` schema, in the
   `PaymentProvider` type, in a filter on the payments screen, in `CLAUDE.md` and
   in two documentation pages (`SQUARE_ACCESS_TOKEN=`). Zero lines of
   implementation, no environment variable declared. Only `routeRefund` treats it
   honestly, as `unsupported`.

5. **The "card" button is never gated.** PayPal and cash are hidden when
   disabled; the card always shows, even with no provider configured. The
   customer fills everything in, submits, and receives
   `STRIPE_SECRET_KEY is not configured`.

### Test coverage

44 tests cover the **logic** (settlement, cross-order replay prevention, amounts,
currencies, two-phase refund). Solid.

**No test covers the provider actions** — `createCheckoutSession`,
`createPayPalOrder`, `createCheckout`, `verify*`, `internalRefund`. No simulated
HTTP call. The pure logic holds, the seam with the APIs does not.

### Decision

**No fixes now** (settled 21 August). Points 1 and 2 change a money flow and
belong to the provider branch announced at the start of the sprint, with a
sandbox in hand. Points 3, 4 and 5 are more contained and remain to be scheduled.

## Payment and tracking block — the last two (21 August)

### 4. `/track/[token]` was unreachable — a regression from my own hardening

The confirmation page read the tracking token through
`kitchenTickets.getByOrder`. Sprint 2 put it under `kitchen:read`: correct, and it
broke the feature for exactly the people who need it. A guest is refused, the
token comes back `undefined`, the "Suivre ma commande" button never shows. The
`/track/[token]` route existed with nothing able to reach it. **Nothing failed
loudly** — which is what makes this kind of regression expensive.

The fix is not to reopen the kitchen query but to serve the token from the
order's read path, under the rule that already governs it: the view token issued
with the order, or the customer who placed it (`orders.getTrackingToken`).

Same defect on the "pending" and "failure" screens of the success page:
`settle()` received the view token and threw it away, then `Actions` offered
`/order/…` with no token — an empty page for a guest. The token is carried
through, and the button only shows when it is usable.

**Bite proof**: ownership check neutralised → 1 test red.

### 5. The delivery quote was tied neither to the address nor to a single use

`orders.create` checked existence, restaurant and expiry. Two holes remained.

The `deliveryQuotes` table stores `dropoffLatitude` / `dropoffLongitude` with the
comment "to detect a changed address" — **nobody read them**. A quote taken for
the building next door paid for a delivery thirty kilometres away. And the quote
was reusable indefinitely: one cheap quote paid for every future delivery.

The rule is extracted into a pure `deliveryQuote` module — like
`promotionDiscount` and `refundPolicy`, because each refusal decides what the
customer pays:

| Refusal | Cause |
| --- | --- |
| `missing` / `wrong_store` / `expired` | already covered, now tested |
| `already_used` | **new** — `consumedByOrderId` marks the quote at creation |
| `address_mismatch` | **new** — a tolerance of ~110 m, the gap of a geocoder, not of a street |
| `address_not_located` | **new** — and the message says what to do |

That last refusal is the dead end reported in review: a saved address with no
coordinates produced "a delivery quote is required", which says nothing to a
customer who has just entered one. The message now points at the address
suggestions.

**Bite proof**: coordinate tolerance made enormous → 2 tests red; single use
neutralised → 1 test red.

**Gates**: `convex-functions` 473 (up from 457), `core` 195, reference 143 tests
/ 0 errors, themes 0 errors, `pnpm build` OK, typechecks OK.

**The payment and order-tracking block is closed: 5 defects out of 5.**

---

## The last three review points (21 August)

### 1. Dead menu sync — and I had made it worse

The reported defect was real: `syncStore` read the integration through
`api.storeIntegrations.getByStorePlatform`, store-scoped, and therefore requiring
an
session — which the scheduled sweep does not have.

**And I had piled onto it.** In the previous block I put `checkStorePermission`
on `syncStore` without reading the comment three lines below, which said exactly
this:

> `Note: No auth check here — syncStore is also scheduled by syncAllStores (no user context).`

The sweep called `api.*.syncStore`: my guard would have killed it outright.

Split in two: `syncStore` stays the guarded public action and is now only a
shell; `internalSyncStore` carries the work and is reachable neither from a
browser nor without an identity. The sweep calls it directly, and reads the
integration through `internal.storeIntegrations.internalGetByStorePlatform`.

**A structural test freezes the invariant**: no `internalAction` may call a
**guarded** function. It cannot be behavioural — the scheduler is not something
`convex-test` runs — so it is asserted against the source.

Its first version forbade any `api.*` and immediately flagged four cases. Three
were false positives — `products.list`, `categories.list` and `stores.getById`
are public by design, a sync is allowed to read the catalogue — and the fourth
was the URL `https://api.sumup.com`. **The rule was too strict, not the code.**
Tightened onto the real criterion: is the target wrapped in `storeQuery` /
`storeMutation` / `authed*`. A second test checks that the detector does
recognise a guarded function, without which the assertion would pass while
proving nothing.

**Bite proof**: sweep pointed back at the guarded action → 1 test red.

### 2. `duplicateCatalog` guarded the source, not the target

`storeIdFrom` pointed at `sourceStoreId` — the half being **read**. The products
and categories landed in `targetStoreId`. A manager proved their rights on the
restaurant being read, then wrote into a restaurant they do not administer.

The seam now guards the **target** (`products:write`), and the handler checks the
source with `products:read` — copying a competitor's catalogue into your own is
the symmetric abuse, and it was not covered either.

**Bite proof**: seam pointed back at the source → 1 test red.

### 3. `claimFirstAdmin`: whoever arrived first took the deployment

The real risk was not a data race but this: **sign-up is open on the storefront**,
and the mutation required nothing but an authenticated account. On a fresh
deployment, the first stranger to call it became super-administrator. "No caller
in the interface" protects nobody: Convex function names are readable in the
client bundle.

This is a hole I introduced in sprint 2 by creating that function.

It now requires a secret only the deployer holds (`ADMIN_BOOTSTRAP_TOKEN`),
compared in constant time. And it **fails closed**: variable undefined → nobody
gets through. A missing variable that let people in would recreate the hole on
exactly the deployments nobody has configured yet.

**Bite proof**: fail-closed turned into fail-open → 2 tests red.

**Gates**: reference 153 tests (up from 143), 0 errors, type-check OK;
`convex-functions` 473; `core` 195; themes 0 errors, typecheck OK.

**The review list is closed.**

---

## S0-1 — preparing the e2e tests (21 August)

Convex deployment linked by the user, `ADMIN_BOOTSTRAP_TOKEN` set on it. The
local lock is lifted: `hasRealBackend = true`, so the `setup` and `admin` projects
finally register.

### Correcting my own statement

I had announced `CONVEX_E2E_ENABLED` as the lock. **Wrong**: that is a **GitHub
Actions** variable. Locally the lock is elsewhere, in `playwright.config.ts`:

```ts
const hasRealBackend = !process.env.NEXT_PUBLIC_CONVEX_URL?.includes("placeholder")
```

With no real URL, the `setup` and `admin` projects are **not declared at all**.
Playwright then announces success over the handful of public tests it ran: there
is no "skipped" line for a project that does not exist. Three ways of being green
while testing nothing — the third being CI's `::warning::` when a secret is
missing.

### A defect found while preparing

`e2e/auth.setup.ts` hard-coded the password (`"julien"`), while
`scripts/seed-users.mts` reads `SEED_PASSWORD`. The two did not coincide:
sign-in would only have worked on a machine where the seeded value happened to be
`julien`. The seeding script says so itself: "never hardcode passwords".

Fixed: both read `SEED_PASSWORD`, and the setup fails immediately with the reason
if the variable is absent, rather than thirty seconds later on a form that
refused an empty password.

### A `.gitignore` trap

`.env.e2e.example` was **ignored**: the `.env*` rule only had exceptions for
`.env.example` and `.env.production.example`. The template would have been
invisible to anyone cloning. The exception now covers every `*.example`, and it is
verified that `.env.local` is still ignored.

### Delivered

| File | Content |
| --- | --- |
| `apps/{reference,themes}/e2e/README.md` | why the suite was inert, the local procedure in 5 steps, the list of CI secrets |
| `apps/{reference,themes}/.env.e2e.example` | the variables, **separated** between those of the Convex deployment and those of the runner |
| `e2e/auth.setup.ts` | password read from the environment, explicit failure |
| `.gitignore` | `*.example` templates stop being ignored |

The most useful distinction in those two documents: a variable read by a **Convex
function** must be set on the deployment (`npx convex env set`) — a `.env.local`
is never visible to it. That is what made the first attempt at setting the
bootstrap token fail.

### What remains, and belongs to you

1. `npx convex env set BETTER_AUTH_SECRET …` and `ENCRYPTION_KEY` (64 hex) on the
   deployment — only `ADMIN_BOOTSTRAP_TOKEN` is defined there today.
2. `export SEED_PASSWORD=…` then `npx tsx scripts/seed-users.mts`.
3. `pnpm test:e2e`, checking that the header names **three** projects.

**And before believing a green**: neutralise a guard and check the suite goes
red. A suite that has never failed has never demonstrated that it works — which is
precisely how those 510 tests stayed inert for months while announcing success.

## A real run of the e2e suite (21 August) — four defects in the bootstrap chain

An end-to-end sequence requested: set the deployment secrets, seed
the accounts, run the suite. Every step revealed a defect, all of them invisible
while nobody attempted the operation.

### 1. `api.d.ts` transposed by hand: confirmed exact

`npx convex dev --once` regenerated the codegen. **No difference** with the file
transposed from reference. The reservation raised during the mirror alignment is
lifted.

### 2. The seeding script called a public mutation with no session

`seed-users.mts` created the profiles through `ConvexHttpClient` →
`userProfiles.upsert`, which since sprint 2 requires an authorized actor. Result:
`Not authenticated` on all six accounts.

And it printed **"Seeding complete!"** regardless. The accounts existed, none of
them had a role, and the e2e suite would have failed on an admin screen for a
reason pointing nowhere near here.

Fixed: profiles go through `userProfiles:internalUpsert`, run by `npx convex run`
— the CLI authenticates as the deployment, the correct authority for
provisioning, and unreachable from a browser. The script now exits non-zero if a
profile is missing.

### 3. Seeding was not replayable

After a partial run, the script stopped on "No users were created. They may
already exist. Exiting." — while the profile step is independent. No number of
re-runs could repair the state.

Fixed: an existing account is reopened by signing in to recover its id, and step
2 is reached in every case.

### 4. `requireEmailVerification: true` made the seeded accounts unusable

A third reason the suite could never run: `auth.setup.ts` signs in with an
account `seed-users.mts` creates with no mailbox in which to click a link.
Sign-in returned `EMAIL_NOT_VERIFIED`.

Verification becomes optional, **failing closed by default**:

```ts
requireEmailVerification: process.env.AUTH_ALLOW_UNVERIFIED_EMAIL !== "true"
```

A variable that is absent or misspelled leaves verification on. To be set on a
test deployment only, never on a restaurant's.

### A mistake of mine in the diagnosis

My first failure message blamed the seeded password. The real cause was
`EMAIL_NOT_VERIFIED`. The message now reports what the server said — a guess
inside an error message sends its reader down a false trail, which is worse than
no message at all.

### State

`Running 510 tests` with all three projects `setup`, `public` and `admin`
declared: the local lock is lifted for the first time. The Chromium binary was
also missing and has been installed.

### The e2e `setup`: diagnosis by network capture (22 August)

183 `admin` failures on the first full run, all derived from a single cause:
`auth.setup.ts` was not obtaining a session.

**Sign-in was not to blame.** Network capture of an isolated replay:

| Request | Response |
| --- | --- |
| `POST /api/auth/sign-in/email` | **200**, token issued |
| `GET /api/auth/get-session` | **200**, valid session |
| `GET /api/auth/convex/token` | **200**, Convex JWT issued |
| `GET /menu?_rsc=…` | `net::ERR_ABORTED` — cancelled prefetch, of no consequence |

And after fifteen seconds, the URL was indeed `http://localhost:3000/menu`.

**The real cause is arithmetic.** The test has **60 s** in total
(`timeout` in `playwright.config.ts`), while its steps ask for
60 + 30 + 30 + 30 + 60 = **210 s** of waiting. None of those limits is
reachable: the test can only die at 60 s. On a cold Turbopack server, compiling
`/sign-in` alone takes some twenty seconds, and `/menu` then compiles on demand.

Fixed: `setup.setTimeout(180_000)` gives the step its own budget, and the
`networkidle` wait placed after the click is removed — Convex keeps a WebSocket
open, so the network is never idle on this application; that wait could only
consume the budget before handing it to the check that matters. The redirect
**is** the signal.

**Verified**: `setup` passes in 11.2 s, the session state is written.

### The next blocker: seeding creates no restaurant

`navigation` sample re-run with a valid session: **17 failures, 7 passes**, every
failure identical — `waiting for locator('[data-slot="sidebar"]')`.

Checked on the deployment: the `stores` table is **empty**, and every profile
carries `storeIds: []`. `seed-users.mts` creates accounts and nothing else. The
admin screens have no establishment to administer, so the sidebar does not mount.

An establishment seed is missing — and probably categories and products for the
catalogue screens. That is the next obstacle, and it is distinct from everything
before it.

### The establishment seed — and what it brought to light (22 August)

`convex/seedFixture.ts`, an **internal** mutation (unreachable from a browser,
called by `npx convex run`) and idempotent throughout: a "Chez Luigi (test)"
establishment, three categories, five products, and the attachment of the
establishment to every profile whose role works in a restaurant. Customers keep
an empty list — that is what a customer is.

Wired in as step 3 of `seed-users.mts`, which exits non-zero if it fails:
accounts with no restaurant are not a usable seed.

**The seed alone fixed nothing** — the `navigation` sample went from 17 to **20
failures**. A direct capture of `/dashboard` gave the real cause:

```
PAGEERROR Could not find Convex client!
`useQuery` must be used in the React component tree under `ConvexProvider`.
```

The provider is very much there, in `app/providers.tsx`.

#### Two copies of Convex in the repository

| Package | Declares | Resolved to |
| --- | --- | --- |
| `apps/{reference,themes}`, `convex-schema`, `convex-functions` | `1.31.7` | 1.31.7 |
| `apps/site` | `^1.34.0` | 1.44.0 |
| **`packages/admin`** | **peer `>=1.0.0`** | **1.44.0** |

`packages/admin` declared Convex as an unconstrained peer dependency, and pnpm
gave it the highest version present in the repository — the one pulled in by
`apps/site`. Its `useQuery` therefore came from 1.44.0 while the application
provided the context from 1.31.7. Two instances, two React contexts,
no link between the two: **the entire admin interface crashed on render**, for
everyone, not only in tests.

Fixed by pinning `convex@1.31.7` as a devDependency of `packages/admin`. Both now
resolve to the same instance. `apps/site` is untouched.

**Measured effect** on the `navigation` sample: 20 failures / 4 passes →
**11 failures / 13 passes**, and the `Could not find Convex client` error is gone.

#### What remains open

The 11 remaining failures are not diagnosed. They still fail on
`[data-slot="sidebar"]`, but the cause is no longer the same since half the tests
in the same file now pass — on-demand compilation too slow, or screens genuinely
incomplete. To be picked up again.

What the real run will have demonstrated: a typecheck, a lint and 821 green unit
tests did not stop the admin interface being entirely broken by a dependency
resolution. No static analysis could have seen it.

### The 11 remaining failures: diagnosis (22 August)

Three distinct causes, of which **only one** is an application defect.

#### 1. `StoreSelector` wrote to a store during its own render

```
Cannot update a component (`StoreSelector`) while rendering a different
component (`StoreSelector`).
```

`setCurrentStore` was called in the render body, lines 22-26. That is the variety
that can loop: the write modifies the store this very component subscribes to,
which schedules a render, which writes again. Only the id comparison stopped the
second pass.

`StoreGuard`, right next door, performs the same selection correctly in a
`useEffect`. Fixed the same way — and kept here, because `StoreGuard`
short-circuits itself on the stores, settings and team routes, where the selector
is nonetheless still on screen.

This is the same class of error I made myself on `checkout/pay/page.tsx` earlier
in this sprint.

#### 2. The guided tour's mask swallowed clicks

`<div class="reactour__mask">` intercepted clicks on the sidebar:
`sidebar.spec.ts` timed out waiting for a link the mask covered. On a fresh
account, the tour opens by itself.

`auth.setup.ts` now writes `bid-tour-<userId> = "done"` into `localStorage` before
saving the session — exactly what a human does by closing the tour once. The tour
deserves its own test; it must not silently break all the others.

#### 3. A test written against an interface that no longer exists

`routing.spec.ts` expected a "Connexion" heading. That page's `h1` says "Bon
retour parmi nous", and `auth.setup.ts` — written by someone who had looked at
the page — already accepted either.

#### 4. Everything else: on-demand compilation

The rest were not defects. An unambiguous measurement on `routing.spec.ts`:

| Test | Cold server | Next pass |
| --- | --- | --- |
| `/dashboard` redirect | **failed at 18.2 s** | **passed in 4.6 s** |
| `/dashboard/products` redirect | **failed at 18.2 s** | **passed in 4.7 s** |
| `/orders`, `/stores` redirects | passed in 7.3 s | passed in 4.1 s |

Turbopack compiles each route on first request, and in development that costs ten
to twenty seconds — more than the lifetime granted to most of these tests. A
`/dashboard` that "refuses to redirect an anonymous visitor" turned out to
redirect in 4.6 s on the next run. No hole: the protection works.

**Structural fix**: CI already builds the application with `pnpm build`, but
`playwright.config.ts` was starting `pnpm dev` — so it recompiled page by page
what it had just built. The test server now serves the build under CI
(`E2E_USE_BUILD=true` to get the same locally).

#### Result on the `navigation` sample

| Step | Failures / Passes |
| --- | --- |
| before the Convex alignment | 20 / 4 |
| after the Convex alignment | 11 / 13 |
| after the tour and the heading were fixed | 1 / 23 |
| after `StoreSelector` | **0 on a warm server** |

What remained was entirely down to the development server.

## The full suite, on the production build (22 August)

**The first real number ever obtained on those 510 tests.**

| | |
| --- | --- |
| passed | **344** |
| failed | **107** |
| skipped | 7 |
| never run | 52 |
| duration | 29.5 min |

### The production server refused to start

`instrumentation.ts` validates four variables at boot and `next start` dies
before serving a single request: `AWS_REGION`, `AWS_ACCESS_KEY_ID`,
`AWS_SECRET_ACCESS_KEY`, `OPENAI_API_KEY`. The development server tolerated their
absence, so nothing revealed it while nobody targeted a build.

**I had documented them as "optional"** in the template and the runbook written
the day before. That was wrong. Both are corrected, with the reason and
placeholder values — no test actually reaches S3, SES or OpenAI.

### Breakdown of the 107 failures

| Signature | Occurrences |
| --- | --- |
| `expect(locator).toBeVisible()` / element absent | 65 + 47 |
| `toHaveURL` | 17 |
| click timed out | 8 |
| **`strict mode violation: locator('main') resolved to 2 elements`** | **7** |
| `option 'Actif'` resolved to 2 elements | 3 |

### A real defect: two nested `<main>` elements

`SidebarInset` (`packages/admin/src/ui/sidebar.tsx:307`) renders a `<main>`, and
`app/(admin)/layout.tsx` rendered a second one inside it. A page has exactly one
`main` landmark: assistive technology was announcing two. Fixed to a `<div>` —
`SidebarInset` is what carries the landmark.

Without the e2e suite, this defect would have stayed invisible: neither the
typecheck, nor the lint, nor a unit test looks at the structure of the rendered
document.

### Tests written against an interface that no longer exists

Conclusive evidence — **English** labels expected in a French application:

| Expected | Occurrences |
| --- | --- |
| `heading "Shopping Cart"` | 4 |
| `heading "Select Store"` | 4 |
| `heading "Checkout"` | 4 |
| `heading "Connexion"` | 5 |

Those specifications predate the interface translation. They have
never been able to pass, and nobody knew because the suite never ran.

### What that number is worth, and what it is not

344 passing tests is a real foundation: the storefront, authentication, admin
navigation and a large part of the management screens respond.

The 107 failures are **not** 107 defects. At a glance, most look like stale
selectors. But I have not established that test by test, and I will not present
an estimate as a triage. What is established: at least one real application
defect (the double `main`), and three others fixed upstream (`StoreSelector`, the
duplicate Convex instance, the guided tour's mask).

The 52 never-run remain unexplained — no worker crash in the log.

## Triaging the 107 failures and the 52 never run (22 August)

### The 52 never run: solved, and it is a lever

No mystery and no crash. Four files declare
`describe.configure({ mode: "serial" })`; in serial mode, the first failure
abandons the rest of the block.

| File | Run | Abandoned |
| --- | --- | --- |
| `team.spec.ts` | 1 | **17** |
| `product-form.spec.ts` | 2 | **16** |
| `games.spec.ts` | 3 | **11** |
| `stores.spec.ts` | 10 | **8** |
| | | **52** — the exact count |

**Four failures were stopping 52 tests from running.** That is the best
effort-to-effect ratio in the whole suite.

### Breakdown of the 107

| Cause | Count | Nature |
| --- | --- | --- |
| ambiguous selector (sidebar + page) | 13 | test |
| two nested `<main>` | 8 | **application defect** |
| sidebar absent | 7 | to dig into |
| "Connexion" heading gone | 6 | stale test |
| **English** label expected | 6 | stale test |
| missing accents in the interface | 1 (+17 cascading) | **application defect** |
| Google autocomplete (key absent) | 2 | environment |
| unexpected URL | 17 | to dig into |
| miscellaneous (renamed labels, dialogs) | 47 | mixed |

### Two application defects confirmed and fixed

**1. Two nested `<main>`** — `SidebarInset` renders one, the admin layout
rendered a second inside it. A page has exactly one `main` landmark.

**2. Unaccented French in the interface.** The `team.spec.ts` test looked for
"Gestion de l'équipe"; the interface displayed "Gestion de l'equipe". **The test
was right.** The sweep found 53 segments across 12 files in `packages/admin`:
"Gerez les membres de votre equipe, leurs roles et permissions", "Veuillez
selectionner un etablissement", "Echec de l'apercu", "Base de donnees",
"Parametres", "Categorie"…

That is a quality defect visible to the restaurateur, in a product sold in
France. No typecheck or lint sees it.

### My correction script broke two things

This needed saying. The automatic replacement touched what it should not have:

| Damage | Detection |
| --- | --- |
| CSS class `recharts-reference-line` → `recharts-référence-line` | diff review |
| identifier `categories.length` → `catégories.length` | **typecheck** |

Both are repaired, and the three typechecks are at zero. The lesson fits in one
line: a regex replacement over source code must be re-read line by line, not
merely counted. The first pass was also incomplete — it only saw JSX text fitting
on a single line, and the offending subtitle spanned two.

### Tests written against an interface that no longer exists

| Expected by the test | Reality |
| --- | --- |
| `heading "Shopping Cart"` | interface in French |
| `heading "Select Store"` | same |
| `heading "Checkout"` | same |
| `heading "Connexion"` | "Bon retour parmi nous" |
| `button "Créer un compte"` | "Créer mon compte" |

Those specifications could **never** have passed. Nobody knew because the suite
never ran.

### What remains

The 17 "unexpected URL", the 7 "sidebar absent" and part of the 47
"miscellaneous" are not triaged. Some are surely more stale tests, others perhaps
real defects. I count them in neither pile until I have opened them.

### Measured effect on the four `serial` files

| | Passed | Failed | Never run |
| --- | --- | --- | --- |
| before | 17 | 4 | 48 |
| after | **22** | 4 | 43 |

Each fix moves the blocker further down the chain: `games` went from line 47 to
78, `product-form` from 23 to 58, `team` from 30 to 114. Serial mode makes this
unblocking necessarily iterative — you only see the next failure once the
previous one is lifted.

That is also what makes those four files expensive: 43 tests stay unreachable
behind 4 failures. A question to settle separately — is serial mode really
necessary here, or is it an inheritance? If it falls, the 43 tests run and fail
(or pass) each for their own reason, which is far more informative.

## Serial mode was not necessary (22 August)

Checked before touching anything, across the four files concerned:

| Sign of a real dependency | Finding |
| --- | --- |
| `beforeAll` | **none** in the four |
| variables shared at `describe` level | **none** |
| a submit button clicked (Enregistrer, Créer, Confirmer, Supprimer…) | **none** |
| navigation specific to each test | `beforeEach` everywhere |

No test writes to the database. Even the ones called "delete" merely open the
confirmation and then cancel. There is therefore **nothing** a test hands to the
next.

And the origin: `git log -S` traces `mode: "serial"` back to
`1228afac chore: câbler le monorepo BeYours` — a global wiring commit, with not a
word about test isolation. The mode was not chosen, it was carried along.

### Effect of removing it

| | Passed | Failed | Never run |
| --- | --- | --- | --- |
| with `serial` | 22 | 4 | **43** |
| without `serial` | **57** | 12 | **0** |

**+35 tests green**, and the 43 that were hidden finally run — each failing or
passing for its own reason. Twelve real failures appear, which until then were
invisible behind four.

That is exactly the trade to make: twelve readable diagnoses beat four diagnoses
and fifty-two silences.

### The 12 remaining

| File | Failures |
| --- | --- |
| `product-form.spec.ts` | 5 (form fields, tabs, stock management) |
| `team.spec.ts` | 3 (status filter, invitation dialog) |
| `games.spec.ts` | 2 (catalogue) |
| `stores.spec.ts` | 2 (heading, dialog fields) |

Not triaged. They join the 17 "unexpected URL", the 7 "sidebar absent" and part
of the 47 "miscellaneous" from the previous tally.

## Triaging the failures in the four admin files (22 August)

Starting point: 22 passed, 4 failed, 43 never run. **Arrival: 64 passed, 5
failed, 0 never run.**

### Application defects found and fixed

| Defect | Effect |
| --- | --- |
| single-word labels with no accent (`"Equipe"`, `"Parametres"`, `"Integrations"`, `>Role<`, `>Details<`) | 3 tests |
| `Switch` announced as a checkbox | accessibility |

The first accent pass had missed those labels: my expression required a space in
the string so as to target prose only, which excluded every single-word label.
Fixed.

`packages/ui`'s `Switch` is a hidden `<input type="checkbox">`. It therefore
carried the implicit `checkbox` role while it *looks* and *behaves* like a
switch. `role="switch"` is a valid role for that input and describes what the
user sees.

**But that fix did not make the test pass**, and this needs saying: the input is
`sr-only`, so Playwright will never consider it visible, whatever its role. The
test had to target what the user sees and clicks — the label — as its neighbour
at line 168 already did.

### Test defects fixed

| Test | Cause |
| --- | --- |
| `selectFilter` (shared helper) | Radix renders every option twice — the styled one and a hidden native one. Scoped to the open `listbox`. |
| `Prix (EUR)` | the form displays `Prix (€)`; that spelling never existed |
| `Disponible à partir de` / `jusqu'à` | `.or()` of `getByText` and `getByLabel` on the **same** label: two matches |
| stock switch state | `getAttribute("aria-checked")` on a label always returns `null` — the branch was decorative, it clicked every time and happened to be right |

### Two mistakes of mine, worth noting

1. I fixed "Disponible à partir de" and **left the next line**, which repeated the
   same pattern with "Disponible jusqu'à". Seen on the following run.
2. I presented `role="switch"` as the fix for the test when it is not. It is a
   real accessibility gain, nothing more.

### The 5 that remain — undiagnosed

| Test | What it expects | Finding |
| --- | --- | --- |
| `games:88` | `getByText('Jeux', exact)` | the `h2` "Jeux" exists |
| `games:96` | a `%` in the dialog | not checked |
| `product-form:109` | a validation message | not checked |
| `product-form:312` | "Seuil de stock faible" | **the string exists** (line 725), so enabling tracking did not take |
| `stores:168` | an `/Adresse/` label in the dialog | **the string exists** (line 337); the page has two `DialogContent`, the test may open one and search the other |

Those five do not fail on a stale label: the expected text is in the code. They
fail on access to the content. I leave them untriaged rather than advance a
hypothesis as a result.

## The 17 "unexpected URL" (22 August)

**One file, one cause.** All 17 came from `store-detail.spec.ts`, all with the
same discrepancy: expected `/dashboard/stores/<id>`, received
`/dashboard/stores`.

### The cause: the table row is not clickable

The `navigateToFirstStore` helper clicks `tbody tr` and waits for a navigation.
But `TableRow` carries **no `onClick`**: the navigation lives in a `<Link>` inside
the name cell. Clicking the centre of the row lands on whichever cell is there and
goes nowhere.

The interface never offered a row click. It was the test that was wrong. Fixed: it
targets the anchor.

**Effect: 17 failures → 7.**

### A test that could not fail

`stores.spec.ts:274` — "should navigate to store detail on row click" —
**passed**. It counts the rows at the moment of `domcontentloaded`, before Convex
has answered, finds zero, skips the `if (rowCount > 0)` and declares success
without having checked anything. It nonetheless contained the same defect as the
other 17.

Rewritten to wait for the anchor and then require the navigation: it can now
fail, which is the least one asks of a test.

### An accessibility defect found in passing

`getByLabel(/Adresse/)` fails although the text exists. `AddressAutocomplete`
renders five `<label>` elements **with no `htmlFor`** and five `<input>` elements
**with no `id`**: nothing associates them. A screen reader announces five
anonymous fields, and clicking a label does not move focus.

Wired with `React.useId()`, typecheck green.

**But I could not verify that this fix changes the test result**: after rebuilding,
the count stays at 28 passed / 8 failed, and I cannot find the label "Adresse de
l'établissement" in the build output I inspected. The fix is right on the merits —
a label must point at its field — but I do not present it as the resolution of
those tests.

### Remaining on these two files: 8 failures

Seven in `store-detail` (contents of the Horaires, Paramètres and Intégrations
tabs, plus "Adresse" on Général) and one in `stores` (creation dialog fields).
Undiagnosed.

## The 7 "sidebar absent" (22 August)

All in `admin-responsive.spec.ts`, all in the **mobile (375×667)** blocks.

### The cause: a helper written for desktop only

On a narrow screen, the sidebar lives in a `Sheet` — a modal drawer **closed by
default**. `[data-slot="sidebar"]` is therefore not in the DOM until the user has
opened the drawer. That is the intended behaviour.

`waitForAdminPage` waited for that sidebar unconditionally: on mobile, the wait
could not succeed. The helper now picks its landmark according to the viewport —
the drawer trigger below 768 px, the sidebar above.

**Effect on the file: 12 failures → 3.**

### What that revealed: two real display defects

The mobile tests finally run, and two fail on **their real assertion** — not on a
locator:

```
expect(hasOverflow).toBe(false)   →   received: true
```

| Page | At 375 px |
| --- | --- |
| `/dashboard` | **overflows horizontally** |
| `/dashboard/orders` | **overflows horizontally** |

A horizontal overflow on a phone is a page that slides sideways under the
finger. The test existed to catch exactly that and never could: it died earlier,
on the sidebar.

I did not look for the offending element — that is a CSS investigation distinct
from the triage.

### The third remaining

`admin-responsive.spec.ts:156` (desktop) expects `[data-slot="card"]` on
`/dashboard` and does not find it. Undiagnosed; the simplest hypothesis is an
empty dashboard for want of orders, but I have not verified it.

## The two mobile overflows — fixed (22 August)

### The culprit, found by measurement

A diagnostic test listing every element whose right edge passed the viewport gave
the same answer on both pages:

| Page | `scrollWidth` | Offending element |
| --- | --- | --- |
| `/dashboard` | 382 (vp 375) | the header's right-hand group, width 219 |
| `/dashboard/orders` | 388 (vp 375) | the same |

The admin header is a `justify-between` between two groups, and **neither could
shrink**: the right group carried `shrink-0`, the left had no `min-w-0` — a flex
child refuses to go below the width of its content until you explicitly allow it.

### The fix

- left group: `min-w-0`, breadcrumb with `truncate` and `flex-nowrap`;
- right group: `shrink-0` kept (those controls must stay usable), but the
  establishment name capped at `7.5rem` below `sm`.

**Verified**: `scrollWidth` drops to 375 = viewport on both pages. The
`/dashboard/orders` tab strip, 790 px wide, stays wide — but it is clipped by its
container and no longer slides the page, which is the expected behaviour of a
scrolling tab bar.

**File `admin-responsive.spec.ts`: 2 passed / 12 failed → 13 / 1.**

### A design-system inconsistency fixed in passing

`packages/ui`'s `Card` rendered a bare `<div>`, with no `data-slot="card"`, while
every other primitive in the system carries one (`button`, `breadcrumb`,
`sidebar`, `dialog`…). Aligned.

**That fix did not make the test looking for it pass**, and this needs saying: the
attribute is in the build (verified), but `/dashboard` shows no card at all — it
renders "Veuillez sélectionner un restaurant". The `storeId` is not resolved at
the time of the test. That is a separate, unresolved problem.

### Remaining on this file

`admin-responsive.spec.ts:156` — the dashboard with no establishment selected. To
be picked up with the other store-resolution cases.


## Store resolution, as a whole (23 August)

### The state of things

"Which establishment is active" was stored in five places and computed by six
components.

| Location | Scope |
| --- | --- |
| `currentStore` (whole document, localStorage `beindigital-store`) | admin **and** storefront |
| `adminApiStore.storeId` | memory, `packages/admin` |
| `cartStore.storeId` | cart |
| `storeSlug` cookie | themes |
| server-resolved URL slug | themes |

Resolvers: `StoreGuard` (first in the list), `StoreSelector` (the only one when
there is one), `useStoreId` (nearest by geolocation), plus three divergent copies
in `apps/themes`.

### The one-commit lag, demonstrated by reading

`StoreGuard` copied `currentStore._id` into `adminApiStore.storeId` from an
effect. But the page it releases is rendered **in the very commit** where it lets
it through — that is, before the effect writes.

```
commit 3: currentStore set → children rendered → mirror null → "Veuillez sélectionner un restaurant"
commit 4: effect → mirror set → skeleton, the query finally goes out
```

That is what `admin-responsive.spec.ts:156` was seeing. It was not a hypothesis:
it is the semantics of React's passive effects.

### What was done

**Derive instead of copy.** The mirror is gone from `admin-api-store`; the pages
read the selection itself. The guard renders its children only when the id is
present in the list the server returns for this account — a persisted id pointing
at a deleted establishment, or inherited from this browser's previous user, is
replaced rather than handed on.

**A single `useAdminStoreId`.** There were two of the same name reading two
sources: 36 files in `packages/admin`, 18 in `apps/reference`, indistinguishable
at the call site. The app's one now re-exports the package's.

**Persist the id and nothing else.** The whole document was frozen in localStorage
and nothing refreshed it: a renamed establishment kept its old name, changed
opening hours stayed wrong on the visitor's side. The document comes from Convex.
A welcome side effect: the hydration-mismatch risk disappears, since everything
derived from it now waits on the same query on the server and on the client.

**Two keys instead of one.** `beyours-admin-store` and
`beyours-storefront-store`. A visitor letting geolocation pick the nearest
restaurant moved the dashboard its manager was working in. Existing selections
carry over from the old key.

**Geolocation on demand.** `useNearestStore` asked for it on mount, on every
storefront page, including for a single-location restaurant where the answer
changes nothing. It is now requested when it decides something: several
establishments, none chosen. The "Nos restaurants" panel turns it on explicitly —
that is what the visitor came there for.

**Selection cleared on sign-out.** `clearCurrentStore` existed and was called
nowhere.

**Thirteen dead empty screens** — "Veuillez sélectionner un établissement" beneath
a guard that makes the case unreachable — replaced by a neutral `ResolvingStore`.
The three deliberately bypassed routes (stores, settings, team) keep a real
message.

**Three orphans deleted in `apps/themes`**: `StoreGuard`, `StoreSelector` and
`StoreProvider`, reachable only through barrels nobody imports —
themes' admin layout already uses the package's components. themes' guard still
carried the render-time `setState` fixed on the package side: it goes with the
file.

**Dead slice removed**: `stores`, `setStores`, `useStores`, `clearCurrentStore`,
`useStoreHours`, `useIsStoreOpen` — zero callers, and a `useStores()` that would
have silently returned `[]` to the first person who used it.

### What was ruled out

No duplication of `zustand` nor of `@be-in-digital/restaurant`: a single resolved
copy, unlike last week's Convex case. Verified with `readlink` on all three
locations.

### Proof by bite

Five tests in `packages/restaurant/src/__tests__/store-selection.test.ts`. Two
bites verified, file restored identically afterwards:

| Neutralisation | Result |
| --- | --- |
| admin and storefront keys merged | 1 test red |
| migration from the old key removed | 1 test red |

### Gates

Typecheck 0 errors on `restaurant`, `admin`, `mcp-server`, `ui`, `reference`,
`themes`. Reference lint: 0 errors / 71 warnings (unchanged). Unit tests: 153 +
89. `next build` of `apps/reference`: success.

### What is not verified

`admin-responsive.spec.ts:156` was not replayed — the e2e stack was not
restarted. The one-commit lag is demonstrably removed, but the claim "this test
passes now" requires a run.

An accepted trade-off: `useStoreId` no longer returns the persisted id
immediately, it waits for `stores.list` to confirm it exists. That is one more
Convex round trip before the menu's first query, against the guarantee of never
querying a deleted establishment.

## E2E verification of the consolidation (23 August)

### Two obstacles before the first number

`next start` refused to boot: `instrumentation.ts` validates four variables at
startup (`AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`,
`OPENAI_API_KEY`) and `.env.local` does not have them. `.env.e2e.example` has said
since it was written to copy the file to `.env.e2e` — but `playwright.config.ts`
only read `.env.local`, so following the instruction changed nothing. The config
now reads both, `.env.e2e` first, with a shell export beating everything.

`SEED_PASSWORD` is stored nowhere: not in a file, not in the Convex deployment's
variables. The `setup` project therefore fails on its assertion, and the 446
admin tests do not run. **The admin half of this verification remains to be done**
and needs the value used at seeding time.

### Comparison against the previous commit

`public` project, production build, `4437435` then `HEAD`.

| | passed | failed |
| --- | --- | --- |
| before (`4437435`) | 30 | 33 |
| after consolidation | 29 | 34 |
| after the geolocation fix | **35** | **28** |

The first measurement showed **a regression**, and it was mine:
`/store-selector` logged "Permissions policy violation: Geolocation access has
been blocked".

### The cause, in two places

Making geolocation optional had not been enough: two callers were still asking
for it on mount. The resolver, as soon as it saw several establishments with no
selection — that is, on the visitor's arrival. And the "Nos restaurants" panel,
which lives in the header of **every** page: mounting it anywhere asks
everywhere.

Both now use `useGrantedLocation`: the position is used if the visitor granted it
earlier, and the API is not touched otherwise — no prompt, and nothing for a
permissions policy to reject. The panel's "Localiser" button remains for anyone
wanting to grant it on the spot; with no position, the nearest is simply the
first.

**No regression, five tests repaired** — the console-error checks on menu, cart,
checkout, tracking and the storefront layout. "Geolocation blocked" messages
across the run: 20 → 0.

### The 28 remaining failures in the public project

Predating this work, identical to the reference commit. Two examples give the
flavour: one test expects a "Se connecter" link when the header shows
"Connexion", another expects "Powered by BeYours Engine", which exists in no
file. The renaming in `3d6b93e` on 15 August moved the copy without the tests
following. To be handled as a separate batch.

## The 28 public-project failures — handled (24 August)

`public` project, production build: **30 passed / 33 failed → 60 / 0**, plus
three explicit skips.

### Twenty-two: assertions left behind

The renaming of 15 August (`3d6b93e`) moved the copy, the tests did not follow. A
French storefront asked about "Shopping Cart", "Checkout" and "Select Store"; a
sign-in page whose heading is "Bon retour parmi nous" searched for under
"Connexion"; a footer combed for "Powered by BeYours Engine", which exists in no
file. The assertions now name what the pages say, without changing what each test
verifies.

Two details of the same kind: the sign-up password requires eight characters, not
six, and the field's placeholder is a row of dots, not a sentence.

### Three real defects, found by those tests

**`/imagery/hero-burger-v2.png` does not exist** — nor does `public/imagery/`. It
was the fallback for a homepage with no hero image and for **every product
without a photo**: those pages asked the image optimizer for a missing file and
took a 400. That is exactly what the homepage console-error test had been
reporting all along. Both call sites now render the frame empty rather than
requesting a file that was never committed.

**`useGooglePlacesAutocomplete` returns on an empty key** before it even requests
the Maps script. But the autocomplete spec intercepts that request to answer with
a mock: it was simulating a call the component had already decided not to make.
The fixture page supplies its own key.

**The sign-up "Nom" field had no `type`.**

### Three tests that could not tell the truth

`sign-in.spec.ts` signed in with the literal "julien" — the mistake
`auth.setup.ts` had already been corrected for. They read `SEED_PASSWORD` and
skip cleanly when it is missing, instead of failing on an absent variable and
looking like a broken form. New helper `e2e/helpers/credentials.helpers.ts`. One
of them also waited for `networkidle`, which the Convex WebSocket makes
unreachable.

### Three badly written tests

Two locator chains ended in `.or(locator("body"))`, which cannot resolve to a
single element — `body` always matches, and so does the rest of the page.

And `/checkout` with an empty Box shows its empty state, not the order form: that
is the page working. Reaching "Finaliser Commande" assumes a full cart, which
belongs to a flow test rather than a
does-this-render check. The test now asserts what the page actually shows, and
says so in a comment.

### Gates

Typecheck 0 errors across the five packages, lint 0 errors / 71 warnings,
153 + 89 unit tests, `next build` green.

### Still waiting

The 446 admin tests, for want of `SEED_PASSWORD`.

## The whole suite, finally run (24 August)

446 admin tests blocked from the start, for want of `SEED_PASSWORD`. The owner
account's address became configurable (`SEED_ADMIN_EMAIL`), a fresh account was
seeded, and the suite ran in full.

| | last known number | after seeding | after rebuilding packages/ui |
| --- | --- | --- | --- |
| passed | 344 | 437 | **454** |
| failed | 107 | 65 | **49** |
| skipped | 7 | 7 | 7 |
| never run | **52** | 0 | **0** |

### Two obstacles, both introduced by me

**The env loader was breaking the seed.** `npx convex dev` writes its deployment
followed by a comment:

```
CONVEX_DEPLOYMENT=dev:youthful-goose-352 # team: …, project: beyours-reference
```

Taking everything after the `=` handed the Convex CLI a deployment name with the
comment glued on, hence "InvalidDeploymentName: Couldn't parse deployment name
 beyours-reference" — an error that does not name the offending file. The auth
accounts were created, none of the profiles were: the half-seeded state this
script had already been hardened against once. A single `loadEnvFiles`
(`e2e/load-env.ts`) now serves both the Playwright config and the seed script, and
an inline comment requires a space before the `#`.

**`data-slot="card"` had never reached the application.** I had claimed to have
verified it in the build; that was false — my check covered other components.
`packages/ui` is consumed from `dist` and I had not rebuilt the package. A
`pnpm --filter @be-in-digital/ui build` was enough, and **17 more tests went
green**.

### The test that started all this work is green

`admin-responsive.spec.ts:156` — the dashboard tiles — passes, and the whole file
with it (14/14). A probe confirms store resolution works: the page renders "Chez
Luigi (test)", the manager's name and the four tiles. What was missing at the end
was no longer the `storeId` but the design-system attribute.

### The 49 remaining

Concentrated in the admin project. Most affected files: `blog-articles` (7),
`store-detail` (6), `inventory` (5), `blog-auto-config` (5), `products` (4),
`email-campaigns` (4).

| Family | Occurrences |
| --- | --- |
| element not found | 18 |
| strict-mode violation (locator resolving to several elements) | 15 |
| click timed out | 6 |

The profile looks a lot like the public batch handled the day before: assertions
written against copy that has moved, mixed with a few real defects. To be handled
in batches, file by file.

## The 49 admin failures — handled, suite green (24 August)

**Whole suite, production build, one worker: 489 passed, 0 failed, 20 skipped.**
Exit 0.

| | before this sprint | after |
| --- | --- | --- |
| passed | 344 | **489** |
| failed | 107 | **0** |
| never run | 52 | **0** |
| skipped | 7 | 20 |

### Five real application defects

**The promotion dialog was unusable at 1280×720.** 1549 px tall in a 720 px
window: header clipped above the screen, buttons 341 px below it. Neither submit
nor cancel.

The page did ask for `max-h-[85vh]`. **The rule did not exist**: Tailwind scans
the application's files and stops there, so every class used only in
`packages/ui` or `packages/admin` appeared in the markup with no CSS behind it —
that cap, the scrolling form's `max-h-[60vh]`, the guards' `min-h-[400px]`. Both
applications now declare the two packages as sources, and `DialogContent` carries
its own cap with scrolling so no dialog can put its actions out of reach.

Measured: 1549 px → 544 px, `max-height: 612px`, `overflow-y: auto`, submit button
at y=559.

The other four: "temps reel" and "Aucun produit trouve" unaccented on the
inventory page; the article creation and generation dialogs with bare `<label>`
elements, so fields with no accessible name at all; the sign-in button reduced to
an icon while loading; `adminRoutes.gamesSettings` pointing at a route with no
page.

### Fifteen locators that tested nothing

`.or()` chains ending in `body`, a status word that is also the badge on every
row, a Radix list whose every option is rendered twice. A locator matching several
real elements verifies nothing. `chooseOption` centralises the scoping of the open
list.

### Seven tests that checked an entitlement, not a feature

Auto Blog is gated by the subscription and answers "Auto Blog non disponible".
"Nouvelle campagne" is disabled until a sender address exists — the page says so
in a banner. The article creation dialog demands a category before showing its
form. Each now recognises the state and skips with its reason, instead of waiting
thirty seconds on a control that is right to refuse.

### One worker, not two

Two workers shared a single Next server and a single Convex deployment. The
contention surfaced as tests failing on "`[data-slot="sidebar"]` not visible in
15 s" — the admin shell simply had not finished rendering. Which tests lost
changed from run to run, so the suite reported different defects each time and
none of them were defects. Proof: the same five files give 76/76 with one worker.
22 minutes instead of 13, and reproducible.

### A methodological mistake, for the record

I concluded three times that the Tailwind fix was not working, relying on `grep`
over the compiled CSS with patterns that treated `\[` as a character class. It was
the in-browser measurement that settled it. On a question of "does this apply",
measure first.

### The 20 skipped

11 in `email-campaigns` (no sender address configured), 4 in `blog-auto-config`
and 4 in `blog-articles` (Auto Blog outside the subscription), 1 in `inventory`
(no product tracks its stock). All carry an explicit reason. Configuring email and
enabling Auto Blog on the test account would return them to coverage.

### Gates

Typecheck 0 errors (reference, themes, ui, admin, restaurant), lint 0 errors /
71 warnings, 153 + 89 unit tests, `next build` green.

## The test account, configured (24 August)

Twenty tests were skipping on the account's state, not on the product. The
fixture (`internalSeedFixture`, already an `internalMutation` and therefore
unreachable from a browser) now puts the account in the state those tests
describe:

| Addition | What it unblocks |
| --- | --- |
| sender address | "Nouvelle campagne" stops being disabled |
| Auto Blog on the owner accounts | the generator and its config page render their forms |
| a blog category | the creation dialog shows its form instead of "create a category first" |
| one product tracking its stock | the quantity column stops being a row of dashes |

**Thirteen tests came back to coverage**: 20 skipped → 7.

The address is `no-reply@chez-luigi.test`. The `.test` domain is reserved by RFC
2606 and can never be delivered to: a run that started sending would fail loudly
instead of reaching a real inbox.

### The 7 that remain

The campaign dropdown actions require a campaign in the table — which requires an
email template and a dozen mandatory fields. That is test data, not
configuration.

### `subscription.spec.ts`, repaired in passing

Three of its tests read `isVisible()`, a snapshot that **does not retry**, and
therefore raced the rendering of the pricing cards: lost roughly one run in
three, in two seconds. One combined `Promise.any` over three of those reads —
that shape resolves as soon as the first answers, **including when it answers
false**, since a fulfilled `false` is still a fulfilled promise.

Two others asserted `expect(typeof x).toBe("boolean")`: a boolean is always a
boolean, those tests could not fail. They now check what the pricing view shows.
25/25 over three repeats.

### A transient state cannot be waited for

`sign-in:150` checks "Connexion en cours…". Against a local Convex the request
completes in tens of milliseconds: the button had already returned to its normal
label when the assertion looked, and waiting cannot help — you do not wait for a
state that has already passed. The test was measuring backend latency. It now
holds the response for two seconds. 42/42 over three repeats.

### A misleading run, for the record

One full run announced 5 failures on the storefront's most elementary elements —
menu heading, brand link — and took **49.6 minutes instead of 20**. Replayed
cleanly: 67/68 in 1.2 minutes. It was the machine. Reporting those five as they
stood would have sent someone chasing ghosts. **A slow run is a run to replay
before believing.**

### Final state

Whole suite, production build, one worker: **501 passed, 7 skipped**, 20.8
minutes. The single failure of the last run (`subscription.spec.ts:6`, admin
shell not rendered within 30 s) did not reproduce: 33/33 over four immediate
repeats.

One retry is now allowed locally (two in CI). This kind of hiccup appears roughly
once per full run; Playwright then reports it as *flaky*, which keeps it visible
instead of absorbing it silently.

## Whole suite green, nothing skipped (24 August)

**509 passed, 0 failed, 0 skipped.** Exit 0, 20.4 minutes, production build, one
worker.

The last seven skips came down to a campaign row's dropdown: with no campaign in
the table, they excused themselves. The fixture now creates an email template and
a **draft** campaign — a draft has never been sent and will not be by sitting in a
table, so nothing in this fixture can put mail on the wire. The same reasoning as
the `.test` address.

The run confirmed idempotency in passing: `templateCreated: false`, a template
already existed and was reused rather than duplicated.

### The full journey

| | start | finish |
| --- | --- | --- |
| passed | 344 | **509** |
| failed | 107 | **0** |
| never run | 52 | **0** |
| skipped | 7 | **0** |

## The guards that decided too early (24 August)

**508 passed, 1 flaky, 0 skipped.** Exit 0, 22.7 minutes, machine load 2.21 at
the start and 5.00 at the finish.

The suite total moved between 504 and 509 from run to run without a line of code
changing. The cause: seven campaign-dropdown tests opened with

```
const hasTable = await table.isVisible({ timeout: 5_000 }).catch(() => false)
test.skip(!hasTable, "No campaigns in table to test")
```

Two defects stacked. `isVisible()` is a **one-shot read that does not retry**,
unlike `expect().toBeVisible()`, which polls until its deadline. And five seconds
is less than the Convex query needs on a busy machine. The check therefore landed
on a page that was still empty, concluded there was no campaign, and the test
excused itself — three in one run, three others in the next.

Both guards now wait for the page to settle on one of its two real shapes — a
table or "Aucune campagne", the amber banner or an enabled button — before
deciding. **A skipped test now means what it says.**

The `skipIfEmailUnconfigured` helper, written the day before, carried the same
weakness: page not yet rendered, guard concluding "configured", test going on to
click a disabled button. Fixed the same way.

Sweep done: no guard of that shape left in the suite. The other 62 `isVisible()`
calls are conditional branches **inside** tests — they steer an optional path
rather than deciding whether a test runs. A different shape, left alone.

### The remaining flaky

`inventory:26`, on `[data-slot="sidebar"]` not found within 30 s — the admin
shell that did not render, unrelated to the test's subject. Roughly once in five
hundred; the retry covers it and Playwright reports it as *flaky*, so it stays
visible.

### Sprint summary

| | start | finish |
| --- | --- | --- |
| passed | 344 | **508** |
| failed | 107 | **0** |
| never run | 52 | **0** |
| skipped | 7 | **0** |
| exit | 1 | **0** |
