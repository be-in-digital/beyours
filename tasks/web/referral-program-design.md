# Design V1 — Be in Digital Business Referrer Program

> Document approved on 2026-03-26. Ready for implementation.

---

## 1. Goal

Ship a business referrer program that lets:

- a referrer sign up,
- get a code/link,
- share that code,
- generate a discount for the referred customer,
- and receive a commission once the order is validated.

---

## 2. Decision Log

### 1. Referrer signup model

**Decision:** two-step signup.

- step 1: quick account creation
- step 2: profile completion + Stripe Connect before the first payout

**Why:** cut entry friction while keeping payment onboarding clean.

### 2. Program type

**Decision:** single-tier program.

- one referrer per customer/order
- no sub-referrals
- no MLM

**Why:** business and technical simplicity for V1.

### 3. Referrer reward

**Decision:** default commission of 500 €, editable by the admin per referrer.

- stored in `commissionOverrideCents` when overridden
- snapshotted into `referrals.commissionCents` at payment time

**Why:** allow special cases without breaking history.

### 4. Referred customer discount

**Decision:** default discount of 10 % on the initial payment only.

- never on maintenance
- editable per referrer
- snapshotted into `referrals.discountPercent` and `discountAmountCents`

**Why:** keep the offer simple and protect recurring revenue.

### 5. Referral validation

**Decision:** a referral becomes validated after a business delay of 14 days.

- this is not a universal legal truth
- it is a buffer against refunds / disputes / cancellations

**Why:** de-risk payouts without waiting several months.

### 6. When the referral is created

**Decision:** the referral is created only on confirmed initial payment.

- never on simply entering the code
- never on Stripe session creation alone

**Why:** avoid false positives and keep the financial model clean.

### 7. Referral attribution

**Decision:** manual field in the checkout, with `?ref=CODE` support for prefill/auto-validation.

- a single active code applied per checkout
- server-side calculation only

**Why:** stay simple without ruling out a more tracked V2 later.

### 8. Where the business truth is stored

**Decision:** all validation, discounting and referral creation happens server-side.

- the frontend is for UX only
- Stripe receives the amount recomputed by the backend

**Why:** security, consistency, anti-fraud.

### 9. Authentication

**Decision:** Convex Auth.

- no `passwordHash` in the `users` business table
- `users.authUserId` is the link to the auth identity

**Why:** avoid rebuilding the auth layer.

### 10. Payouts

**Decision:** Stripe Connect Express.

- onboarding hosted by Stripe
- real status based on `account.updated` + re-reading the Account
- `active` only if the account is genuinely payable (`payouts_enabled`, `capabilities.transfers`, no block)

**Why:** simple onboarding, Stripe compliance, low implementation cost.

### 11. Payout model V1

**Decision:** no `payouts` table in V1.

- payouts are derived from referrals
- `stripeTransferId` stored directly on referrals

**Why:** limit initial complexity.

### 12. Admin dashboard

**Decision:** integrated into the existing dashboard under `/dashboard/affiliation/*`

**Why:** product consistency, no second admin universe.

### 13. Referrer dashboard

**Decision:** dedicated area under `/parrainage/dashboard/*`

**Why:** a clear experience focused on sharing, earnings and payment onboarding.

### 14. Referral states

**Decision:** state machine: `pending` → `validated` → `payable` → `paid` | `cancelled` | `blocked`

**Why:** cover the automatic cycle and the manual exceptions.

### 15. Main guardrails

**Decision:**

- self-referral forbidden
- disabled code = unusable
- suspended referrer = no new referrals
- 1 `orderId` = 1 referral max
- `programEnabled = false` = global pause

**Why:** the minimum business reliability we cannot ship without.

---

## 3. Data model

### `users` table

| Field | Type | Notes |
|-------|------|-------|
| `authUserId` | string | Convex Auth link |
| `email` | string, unique | |
| `role` | `"affiliate"` \| `"admin"` | |
| `firstName` | string, optional | Required before payout |
| `lastName` | string, optional | Required before payout |
| `phone` | string, optional | |
| `status` | `"pending"` \| `"active"` \| `"suspended"` \| `"rejected"` | |
| `stripeConnectAccountId` | string, nullable | |
| `stripeConnectStatus` | `"not_started"` \| `"pending"` \| `"active"` \| `"disabled"` | |
| `commissionOverrideCents` | number, nullable | Admin override |
| `discountOverridePercent` | number, nullable | Admin override |
| `createdAt` | number | |
| `updatedAt` | number | |

**Indexes:** `by_email`, `by_authUserId`, `by_status`, `by_role`

### `referralCodes` table

| Field | Type | Notes |
|-------|------|-------|
| `userId` | ref `users` | |
| `code` | string, unique | Customizable |
| `isCustom` | boolean | |
| `status` | `"active"` \| `"disabled"` | |
| `createdAt` | number | |
| `updatedAt` | number | |

**Indexes:** `by_code`, `by_userId`
**V1 rule:** 1 main active code per referrer.

### `referrals` table

| Field | Type | Notes |
|-------|------|-------|
| `referrerId` | ref `users` | The referrer |
| `referralCodeId` | ref `referralCodes` | |
| `orderId` | ref `orders`, unique | 1 order = 1 referral max |
| `customerEmail` | string | Snapshot |
| `customerName` | string, nullable | Snapshot |
| `status` | `"pending"` \| `"validated"` \| `"payable"` \| `"paid"` \| `"cancelled"` \| `"blocked"` | |
| `statusReason` | string, nullable | `"refund"`, `"chargeback"`, `"fraud_suspected"`, `"self_referral"`, `"manual_admin_block"`, `"duplicate"` (extensible) |
| `commissionCents` | number | Snapshot (50000 by default) |
| `discountPercent` | number | Snapshot (10 by default) |
| `discountAmountCents` | number | Actual amount applied |
| `stripeTransferId` | string, nullable | |
| `adminNote` | string, nullable | |
| `createdAt` | number | |
| `updatedAt` | number | |
| `validatedAt` | number, nullable | |
| `payableAt` | number, nullable | |
| `paidAt` | number, nullable | |
| `blockedAt` | number, nullable | |
| `cancelledAt` | number, nullable | |

**Indexes:** `by_referrerId`, `by_orderId`, `by_status`, `by_referralCodeId`

### `affiliateSettings` table (1 document)

| Field | Type | Notes |
|-------|------|-------|
| `defaultCommissionCents` | number | 50000 (500 €) |
| `defaultDiscountPercent` | number | 10 |
| `validationDelayDays` | number | 14 |
| `programEnabled` | boolean | Circuit breaker |
| `updatedAt` | number | |

---

## 4. Route architecture

### Public

```
/parrainage                → Program landing page + signup CTA
/parrainage/inscription    → Signup form
/parrainage/connexion      → Login form
/parrainage/conditions     → Rules, eligibility, amounts, blocking cases
```

### Referrer (auth required)

```
/parrainage/dashboard              → Stats, charts, cumulative earnings
/parrainage/dashboard/filleuls     → Referred customers list + statuses
/parrainage/dashboard/versements   → Payout history
/parrainage/dashboard/profil       → Profile + Stripe Connect onboarding
/parrainage/dashboard/partage      → Code, link, social sharing
```

### Admin (auth + admin role)

```
/dashboard/affiliation              → KPIs + priority actions
/dashboard/affiliation/apporteurs   → Referrer list, actions
/dashboard/affiliation/parrainages  → Referrals, filters, manual actions
/dashboard/affiliation/versements   → Payout / transfer tracking
/dashboard/affiliation/parametres   → Global config, circuit breaker
```

### Existing, modified

```
/checkout   → + optional "Code parrainage" field
Footer      → + "Devenir apporteur d'affaires" link → /parrainage
```

### Route protection — Defense in depth

1. `proxy.ts` → upstream filtering, redirect for unauthenticated users
2. Protected server layout → access control with `redirect()`
3. Role check in the Convex queries/mutations

---

## 5. Stripe Connect flow + payouts

### Stripe Connect Express onboarding

1. Click "Configurer mon compte de paiement"
2. Convex action: create/fetch the Express Connected Account
3. Create an Account Link (`return_url` + `refresh_url`)
4. Redirect to the Stripe hosted onboarding
5. `refresh_url` = recreates an Account Link server-side
6. `return_url` = UI return (indicative only)
7. Business truth: `account.updated` webhook + re-read of the Account API
8. `stripeConnectStatus = "active"` ONLY if `payouts_enabled = true` + `capabilities.transfers = active` + no block

### Referral creation (idempotent)

1. Listen to `checkout.session.completed`
2. (V2+) Also listen to `checkout.session.async_payment_succeeded`
3. Check `payment_status`
4. Create the referral as `"pending"` — idempotent on `orderId`
5. Stripe metadata: `referralId`, `referrerId`, `orderId`

### Validation (daily cron)

1. `"pending"` referrals where `createdAt + 14j < now`
2. Check there is no refund / cancellation / dispute
3. If OK → `"validated"`
4. If there is a problem → `"cancelled"` + `statusReason`

### Transition to payable

1. Cron: referrals `"validated"` + `stripeConnectStatus "active"` → `"payable"`
2. Also on the `account.updated` webhook → promote `"validated"` referrals if the account just turned `"active"`

### Payout

1. For each non-blocked `"payable"` referral
2. Stripe Transfer to the Connected Account (metadata + `transfer_group`)
3. Success → `"paid"`, store `stripeTransferId`, set `paidAt`
4. Failure → keep `"payable"`, store the error, retry via job, notify the admin
5. Stripe does NOT retry a failed transfer automatically

---

## 6. Checkout changes

### Zustand store

```
referralInput: string
referralStatus: "idle" | "checking" | "applied" | "error"
appliedReferral: { code, referralCodeId, referrerFirstName, percent, amountCents } | null
referralError: string | null
```

### UX

- Optional field at the "info" step
- `?ref=CODE` → auto-injection + auto-validation on load
- If valid: "Code de parrainage appliqué"
- If invalid: error message
- "Retirer le code" button available
- Summary: discount line visible, total adjusted

### Server — `createCheckoutSession()`

1. Full server-side price recomputation
2. Code validation (active code, active referrer, program enabled)
3. Anti self-referral: `email client ≠ email apporteur` (best effort V1)
4. Discount computed on the setup fee only
5. Stripe session: `client_reference_id` + metadata
6. No referral created at this stage

### Webhook

1. `checkout.session.completed`
2. Read `client_reference_id` + metadata
3. If `referralCodeId` → create the referral, idempotent on `orderId`

---

## 7. Referrer dashboard

### Overview

- KPIs: total earnings, pending, number of referred customers
- 1 chart: earnings per month
- last 5 referred customers

### Referred customers

- Table: Date, Customer, Plan (if available), Status, Commission
- Filters by status, colored dots

### Payouts

- Table: Date, Amount, Status (Paid / Payable / Pending)
- Available balance + total paid out

### Profile

- Personal info (first name, last name, email readonly, phone)
- Stripe Connect: status + action depending on state
- Priority banner if commissions are validated but Stripe is not active

### Sharing

- Code shown large (copyable)
- Full link copyable
- Code customization (once in V1)
- Share buttons: WhatsApp, Email, X, LinkedIn, Copy

---

## 8. Admin dashboard

### Overview

- KPIs: active referrers, referrals this month, commissions paid/pending
- `programEnabled` displayed (no direct toggle, link to settings)
- Priority actions block: payable awaiting payout, recently blocked, incomplete Stripe, transfers in error

### Referrers

- Table: First name Last name, Email, Status, Code, Stripe Connect (badge), Overrides, Referred customers, Earnings
- Actions: activate/suspend/reject, edit commission/discount, disable code
- Future route: `/apporteurs/[userId]` (modal in V1)

### Referrals

- Table: Date, Referrer, Customer, Plan (if available), Order amount, Commission, Discount, Status
- Actions: block (statusReason + adminNote required), unblock (smart return), force validation
- Smart unblock: return to a consistent status (payable/validated/pending depending on conditions)

### Payouts and transfers

- View derived from the referrals
- Table: Date, Referrer, Referral/orderId, Amount, Status, stripeTransferId, Error
- Filters: payable, paid, failed/retry
- Action: retry a failed transfer

### Settings

- Default commission, default discount, validation delay, programEnabled
- Strict validation (commission > 0, discount 0-100, delay >= 0)
- Strong warning if programEnabled = false
- Visual confirmation after save

---

## 9. Final business rules

### Eligibility

- Public signup
- 1 account per person
- Account can be suspended/rejected
- 1 main active code in V1

### Checkout

- Code optional
- Discount on the setup fee only
- Server-side calculation only
- No referral before confirmed payment

### Validation / Payout

- Validation after the business delay (14 days)
- Payout if Stripe Connect is active
- Admin block possible at any time
- Retry if the transfer failed

### Uniqueness

- 1 orderId = 1 referral max
- 1 checkout = 1 applied code max
- Disabled code = no new referrals

### Audit V1

- Every manual action updates: `updatedAt` + `adminNote` + `statusReason`

---

## 10. Non-goals V1

- Multi-level referral
- Advanced click tracking
- Payouts table
- Referred-customer detail page
- Deep marketing analytics
- Editing the referrer email from the dashboard
- Self-service financial management

---

## 11. Planned for V2+

- Click → conversion tracking
- Referral detail page
- Settings change history
- Payouts table
- Detailed admin referrer view
- Referral campaigns
- Advanced attribution
- Enriched public link with tracking

---

## 12. Acceptance criteria

The system is correct if:

- [ ] A referrer can sign up and log in
- [ ] An active referral code is available in their area
- [ ] A customer can apply that code in the checkout
- [ ] The discount is computed on the setup fee only
- [ ] The Stripe payment reflects the recomputed amount
- [ ] A referral is created after confirmed payment
- [ ] The referral moves correctly through the expected statuses
- [ ] Stripe Connect unlocks the payouts
- [ ] A successful transfer marks the referral as `paid`
- [ ] The admin can supervise, block, unblock and configure

---

## 13. Recommended implementation order

### Phase 1 — Foundations

- Convex tables (users, referralCodes, referrals, affiliateSettings)
- Convex Auth

### Phase 2 — Signup + basic dashboard

- Public pages: /parrainage, inscription, connexion
- Minimal referrer dashboard
- Main code generation

### Phase 3 — Checkout + tracking

- Checkout integration: code field, server-side validation
- Stripe metadata
- Webhook: referral creation

### Phase 4 — Validation + payments

- Validation cron (14 days)
- Stripe Connect onboarding
- Transition payable → paid

### Phase 5 — Admin

- Full admin dashboard
- Manual actions
- Global settings

### Phase 6 — Polish

- UX polish
- Tests
- Observability
- Payout retries / Stripe errors
