# Production go-live — reference (engine)

Checklist of everything **you** still have to do before officially going live.
Status as of 18 July 2026: the code is ready (type-check 18/18, tests green, game flow
QA'd end to end, dashboard audited and fixed). Everything below is configuration,
accounts, legal and decisions — not code.

---

## 1. Infrastructure & deployments

- [ ] **Create the PRODUCTION Convex deployment** (`npx convex deploy` from
  `apps/reference`). Right now everything runs on the dev deployment
  `dev:reliable-parrot-452` (team momoseck8, project beindigital-engine).
- [ ] **Copy the env vars over to the prod Convex deployment** (`npx convex env set` for
  every key from dev, using the LIVE values, not the test ones) — see the sections below
  for the ones that change.
- [ ] **`BID_APP_URL` and `SITE_URL`** on the prod deployment = the restaurant's real
  public URL (currently `http://localhost:3000`). These build the winning-ticket links
  in the emails.
- [ ] **Deploy the frontend** (Vercel) with `NEXT_PUBLIC_CONVEX_URL`,
  `NEXT_PUBLIC_CONVEX_SITE_URL`, `CONVEX_SITE_URL` (all 3!), `CONVEX_DEPLOYMENT`,
  `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` = public domain. Gotcha hit in dev: a missing
  `CONVEX_SITE_URL` makes the whole auth layer return 500.
- [ ] **Domain**: DNS, HTTPS, and add the domain to `trustedOrigins`
  (`convex/auth.ts` reads `SITE_URL` — check you can still sign in after deploying).
- [ ] **Convex spending cap**: check the team's spending cap — a cap set too low
  **shuts down EVERY project in the team** (already happened once). Set an alert rather
  than a tight cap.

## 2. Emails (AWS SES)

- [ ] **Move SES out of the sandbox** (AWS console eu-west-3 → SES → Request production
  access). Today only verified addresses receive email, which means account verification
  emails, password resets, **game winning tickets** and notifications never reach real
  customers.
- [ ] **Verify the sending domain** in SES (DKIM) plus SPF/DMARC in DNS, and point
  `AWS_SES_FROM_EMAIL` (currently `noreply@beindigital.fr`) at a verified domain.
- [ ] Test for real: sign-up (verification email), password reset, game win.

## 3. Payments

- [ ] **Stripe: switch to LIVE keys** (the current `STRIPE_SECRET_KEY` is `sk_test…`),
  recreate the webhooks against the prod endpoint and update `STRIPE_WEBHOOK_SECRET` +
  `STRIPE_BID_WEBHOOK_SECRET`, and recreate the live Price IDs (every current
  `STRIPE_PRICE_*` and `STRIPE_BID_PRICE_*` is a test price).
- [ ] PayPal: move the app to live (the current client ID/secret are sandbox).
- [ ] SumUp / Square if the client uses them: same thing, production credentials.
- [ ] Run one real end-to-end payment on every enabled method (small order, then a refund
  from the admin).

## 4. Delivery integrations

- [ ] **Uber Eats**: `UBER_EATS_SANDBOX_MODE=true` today → going to prod requires **Uber
  to validate the app** (application in progress, see project memory: scopes + redirect
  URI to register in the Uber portal with the prod domain).
- [ ] **Deliveroo**: `DELIVEROO_IS_SANDBOX=true` → switch the credentials to live and
  re-check the webhook secret against the prod URL.
- [ ] Redo a menu import and a test order on each platform after switching over.

## 5. Data & accounts

- [ ] **Purge test data** from the prod deployment before opening: orders `#TEST-*` /
  `#UE-*` at 0,00 €, the "Test Game"/"Carte test" games, test prizes, QA
  `gamePlays`/`prizeRedemptions`, "Delicious …" products, the "TEXT" promo code.
  (If prod starts from a clean deployment there is nothing to do — do NOT clone dev.)
- [ ] **QA account**: `qa-claude@beindigital.local` exists on DEV (client_admin role) —
  handy for your own testing, do not recreate it in prod. Its password used to sit
  here in plain text. It has been taken out, but it stays readable in this file's
  git history, so **rotate it** and keep the new one in the password manager.
- [ ] **Restaurant owner account**: create the real owner account, verify the email, and
  walk through onboarding (the guided tour works — bug fixed on 18 July).
- [ ] **Venue**: move the store from `draft` to `open`, real opening hours, geocoded
  address, payment methods enabled.

## 6. Gamification (new flow)

- [ ] Create the real games, prizes and target win ratio, and **check that at least one
  prize is in stock** (with no stock nobody can win — the admin now surfaces this).
- [ ] Configure the **required actions** with the REAL links (Google reviews page,
  Instagram…) — URL field under Gamification → Actions.
- [ ] **Print the QR codes**: Gamification → Codes QR → PNG button per table, print,
  laminate, place. The encoded link points at whichever domain you downloaded the PNG
  from: download them from PROD, not from localhost.
- [ ] Train staff on redemption: scan the QR on the customer's ticket (a "Valider ce lot"
  button appears when signed in) or type the code under Gamification → Gagnants.
- [ ] **Prize-draw law (France)**: write up the game rules (free, no purchase necessary,
  prize list, dates), make them reachable from the game page, and disclose the data being
  collected (first name/last name/email/phone) in the privacy policy. The form already
  says "Vos coordonnées servent uniquement à vous remettre votre lot" — the policy has to
  back that up.

## 7. Legal & GDPR

- [ ] Legal notice, terms of sale/terms of use, privacy policy, cookie banner if
  analytics get added.
- [ ] Record of processing activities: orders (customer data), the game (winner contact
  details, device fingerprint for the 24h anti-cheat), marketing emails (consent).
- [ ] Retention periods: expired gamePlays/redemptions, orders.

## 8. Final QA on the real environment

- [ ] **Play the game on real phones** (iPhone Safari + Android Chrome): sound (unlocked
  on first tap), vibration (Android only — expected), smooth wheel, scratch-with-finger,
  email received, ticket QR scannable by the camera app.
- [ ] Place a real end-to-end order: storefront → payment → kitchen KDS → statuses →
  notification.
- [ ] Run the e2e suite (`pnpm test:e2e`) against a staging environment with auth
  configured (the Gamification spec was realigned on the new UI on 18 July).
- [ ] Check the admin on mobile/tablet (the KDS often runs on a tablet in the kitchen).

## 9. Ops & monitoring

- [ ] Backups: enable Convex backups (scheduled snapshot export) on prod.
- [ ] Monitoring: alerts on Convex errors (dashboard → Logs), frontend uptime.
- [ ] Rotate the secrets copied from dev to prod (dev has been passed around a lot — the
  AWS/Stripe test keys must NOT be reused as-is in live).
- [ ] Clean up and commit the branch: the 16-18 July changes (complete game, Gamification
  admin rework, dashboard P0 fixes, pnpm `convex` override) are sitting in the working
  tree of `doums85/maintenance-renewal-migration` — to be committed and merged.

---

### Fixes shipped during the 18 July audit (for the record)

1. **P0** — The dashboard crashed for every new user (onboarding tour mounted outside the
   SidebarProvider): fixed (`useOptionalSidebar`).
2. **P0** — Duplicate copies of `convex` (1.34.1 in packages/admin vs 1.31.7 in the app)
   caused `useQuery` without a provider: pnpm override `"convex": "1.31.7"` added at the
   root.
3. **P0** — Nonsensical "Commandes actives : 97" metric: bounded to 24h and renamed
   "À traiter (24h)".
4. **P0** — KDS timers showing "2237h 47m": capped at "+24h".
5. **P1** — Orders page had no pagination (hundreds of rows): paginated (15/page).
6. **Gamification IA**: 3 "ComingSoon" dead ends replaced with real pages (overview,
   Games & Prizes with active/stock toggles, **printable QR Codes with real QR codes,
   a scan counter and link copying**); "Paramètres" removed from the nav.
7. Honest nav: "Clients" and "Composants" pulled from the nav until they are actually
   built.
8. Venue status "draft" translated ("Brouillon"), expired prize statuses fixed for the
   legacy `claimed` status, local auth: `localhost:3001-3003` added to the trusted
   origins.
