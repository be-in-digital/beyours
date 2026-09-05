# Sales process — Be in Digital Restauration

The procedure that was missing: how we get from an unknown restaurant owner to a
paying customer, live and under maintenance. It covers **what is already wired
into the product**, **what is still manual**, and **who does what**.

Sales model: **assisted B2B**, not pure self-serve. Stripe checkout runs on its
own, but at a 3 500-7 500 € basket the sale is won in the demo, not on a click.
Self-serve is a payment ramp, not an acquisition channel. Validated GTM frame:
door-to-door in Bordeaux, target = restaurants already on Uber Eats, hook
« 0 % de commission, récupérez vos clients », pre-filled demo. Realistic
targets: 3-5 customers at 90 days, 25-40 at 12 months.

> At this volume, **manual provisioning is the right call** — do not industrialize
> the automation until we are past ~20-30 customers. What is needed is a repeatable
> runbook (§5), not a CI/CD deployment pipeline.

---

## The 7 steps

### 1. Prospecting
**Who**: sales / founder · **Tool**: the field + a prospect list

- Strict target: a restaurant already on Uber Eats / Deliveroo (real commission pain).
- One hook only: « Combien vous prend Uber Eats sur chaque commande ? Et si
  ces clients devenaient les vôtres, sans commission ? »
- Exit criterion: a demo meeting booked (Calendly).

### 2. Qualification & demo
**Who**: sales · **Tool**: `/decouvrir` (playable demo) + Calendly (both already wired)

- Send the `/decouvrir` link BEFORE the meeting (loyalty game + KDS both playable).
- In the meeting: run the demo pre-filled with the restaurant's name, show the
  commission-free storefront, the loyalty wheel, the back office.
- Qualify: number of locations, Uber Eats volume, who decides, budget.
- Exit: the likely plan (Essentielle 3 500 € / Premium 7 500 €) + the founders
  offer if eligible (10 seats at 2 500 €, real-time counter on `/tarifs`).

### 3. Proposal
**Who**: sales · **Tool**: the `/tarifs` page + a quote

- Prices ex-VAT; 20 % VAT is added at checkout (régime réel — see
  MISE_EN_PROD.md). Restaurants recover it, so the net cost to them is the
  ex-VAT figure quoted here.
- Set the maintenance frame: 1st year included in the build, then
  1 000 €/year (Essentielle) or 2 000 €/year (Premium), payable monthly.
- Levers: founders offer (in exchange for a case study + a testimonial + the
  right to name them as a reference), build paid in 3-4 installments (Alma/Klarna,
  already at checkout), referral (−10% on the build, 500 € to the referrer).
- Exit: verbal agreement + a recap email with the order link.

### 4. Signing & payment
**Who**: customer · **Tool**: `/checkout?plan=…` → Stripe (already wired)

- The customer fills in their details (restaurant, city, SIRET) and pays by card,
  Alma or Klarna. The amount is computed server-side, never client-side.
- The Stripe webhook automatically creates: a `paid` order, the maintenance
  subscription, a referral line if a code was applied.
- **⚠️ Gap to close before prod**: no confirmation email is sent, and
  `/checkout/success` just points at Calendly. See MISE_EN_PROD.md §4.
- Contract: YouSign signing is wired for **business introducers**. For a
  **customer contract** (build + maintenance), the adapter exists but the flow
  is not wired — to be decided (§ MISE_EN_PROD.md).
- Exit: a `paid` order visible in `/admin/ventes`.

### 5. Provisioning (go-live) — MANUAL RUNBOOK
**Who**: dev / ops · **Tool**: the `/admin/parametres` console + Convex/Vercel accounts

This is the 100% manual step. The runbook is already displayed in the console
(`GO_LIVE_STEPS`), to be run in order for every new customer:

1. **Clone the boilerplate** (`apps/themes`) for this customer (separate git
   repo `beindigital-boilerplate`).
2. **Provision Convex** (dedicated prod deployment) + **Vercel** (dedicated project).
   → see the infra cost note: two-tier on a dev seat, ~50-250 €/year/customer.
   Do NOT create a separate account per customer (10× more expensive).
3. **Fill in the variables**: Stripe (key, webhook, maintenance price), AWS
   SES (verified sender, region), the enabled integrations.
4. **Register the Stripe webhook** in the dashboard, on the customer's Convex URL.
5. **Deploy the Convex schema** (`convex deploy`) — tables, indexes, functions.
6. **Smoke tests**: one purchase + one order end to end under real conditions.
7. **DNS cutover**: the final domain points at the instance, certificate active.
8. **Register the customer in the fleet**: `/admin/parametres` → « Provisionner »
   (customer email, domain, plan, region). **Pick the paid order** in
   « Commande rattachée » — the form now lists them. It is not only traceability:
   without the link, this site's maintenance is answered by whichever contract
   its owner holds is healthiest, so a customer running two restaurants is never
   refused on the one they stopped paying for.
9. **Hand the site its licence key**: on the deployment's page, panel
   **Licence**, copy the `pnpm setup -- --license-key … --license-api …` line and
   run it in the customer's repo — or add both fields to
   `.beindigital-site.json` if the site is already initialised. The key is
   stamped on the deployment automatically; it does nothing until it is in the
   site, because the update scripts only ask when the sentinel carries one.
   Verify with `pnpm update:engine --check` in the customer's repo.
   → `tasks/license-key-registration-runbook.md`

- Exit: instance online, recorded in `saDeployments`, status `live`, and its
  update scripts answering with a key we issued — without which the annual
  maintenance is uncollectable (step 7).

### 6. Kickoff & onboarding
**Who**: sales + customer · **Tool**: a meeting (Calendly) + delivery

- Launch meeting: collect the real content (menu, photos, opening hours, logo,
  the restaurant's payment methods), configure the first location.
- Train the staff: back office, kitchen display (KDS), validating game prizes.
- Hand over: admin access, the site link, loyalty QR codes to print.
- Exit: the restaurant takes its first real orders.

### 7. Maintenance & renewal
**Who**: system + ops · **Tool**: `maintenance.ts` + Stripe (already wired)

- 1st year included. At the renewal date, the maintenance subscription renews
  through Stripe (BID webhook → `maintenance._applyStripeRenewal`, already wired).
- The customer can request a site migration from their back office
  (Système → Maintenance) — a request + emails, handled by the team.
- **⚠️ Gap**: nothing chases a failed payment. To be closed (MISE_EN_PROD.md §2).

---

## Who does what (condensed RACI)

| Step | Sales | Dev/Ops | System (auto) | Customer |
|---|---|---|---|---|
| 1 Prospecting | **R** | | | |
| 2 Demo | **R** | | `/decouvrir` demo | attends |
| 3 Proposal | **R** | | | |
| 4 Payment | assists | | order+subscription+referral | **R** pays |
| 5 Provisioning | | **R** (runbook) | webhook→fleet (partial) | |
| 6 Kickoff | **R** | configures | | supplies content |
| 7 Maintenance | | chasing | Stripe renewal | |

---

## What is solid vs fragile today

**Solid (already wired, usable)**: clear prices, aligned back/front, Stripe
checkout (card/Alma/Klarna), server-side calculation, founders offer with a real
counter, referrals + commission payouts (Stripe Connect),
the `/admin` console (sales, customers, prospects, fleet), the `/decouvrir` demo,
maintenance renewal.

**Fragile (to close before opening sales)** — detail and priorities in
`MISE_EN_PROD.md`:
1. The `/contact` form does nothing (prospects write into the void).
2. No confirmation or follow-up email after payment.
3. No FR-compliant invoice (today = the raw Stripe PDF).
4. No legal page (CGV, mentions légales, privacy).
5. Provisioning 100% manual — acceptable at this volume, but the runbook above
   has to be followed to the letter.

---

**Version**: 1.0 · **Created**: 2026-07-19 · based on an audit of the real code and
the validated GTM plan. To revisit after the first 3 sales.
