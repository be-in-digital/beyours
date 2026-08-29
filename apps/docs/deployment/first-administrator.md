# The first administrator, and the Google Maps key

> Two things a fresh deployment cannot do for itself. Both are set once, per
> client, by whoever deploys the backend — and until they are, the back office
> is unreachable and the maps key is a billing-drain vector.

## Part 1 — `ADMIN_BOOTSTRAP_TOKEN` and `/setup`

### Why the seat cannot appoint itself

Provisioning a `userProfiles` record requires a super admin, and a fresh
deployment has none. So the first seat has to come from somewhere outside the
permission system, and `claimFirstAdmin` is that door.

It shipped without one: the mutation existed, nothing called it, and nothing
provisioned a profile on sign-up either. `getAuthUser` therefore threw
"User profile not found" on every admin screen of a deployment nobody had
hand-seeded — which is every deployment.

The door had to stay narrow. Sign-up is open on the storefront, and Convex
function names are readable in the client bundle, so "nothing in the UI calls
it" protects nobody: on a fresh deployment the first authenticated visitor
would have taken the whole thing. Hence the token.

### It fails closed, on purpose

With `ADMIN_BOOTSTRAP_TOKEN` unset, `claimFirstAdmin` refuses **everyone**. An
unset variable that waved people through would open the hole on precisely the
deployments nobody has configured yet — the ones most likely to be sitting on a
public URL, unattended.

The claim is also self-closing: it only succeeds while no super admin exists, so
the token cannot be replayed once the seat is taken. `/setup` reflects that and
shuts itself off.

### Provision it

Set it on the **Convex deployment**, not only in `.env.local` — a Convex
function does not read the Next.js environment.

```bash
cd apps/themes   # or apps/reference
npx convex env set ADMIN_BOOTSTRAP_TOKEN "$(openssl rand -base64 32)"
npx convex env get ADMIN_BOOTSTRAP_TOKEN   # hand this value over, once
```

Then, in a browser:

1. `/sign-up` — create the restaurateur's account, confirm the address from the
   verification email (see [`environment-variables.md`](./environment-variables.md)
   for the SES variables that mail needs).
2. `/setup` — paste the token. The seat is attributed to the **signed-in
   account**, not to the token.
3. `/dashboard` — the back office is now reachable.

### Then drop it

```bash
npx convex env remove ADMIN_BOOTSTRAP_TOKEN
```

Nothing else reads it. Keeping it is keeping a spare key to a door that is
already locked from the inside — the claim will refuse it anyway, but the value
is one more secret to rotate when someone leaves.

### What `/setup` tells you

| Screen | Meaning | What to do |
|---|---|---|
| "Amorçage non configuré" | `ADMIN_BOOTSTRAP_TOKEN` is unset on the Convex deployment | Run the `convex env set` above |
| "Connectez-vous d'abord" | Configured, nobody signed in | Sign up or sign in, then return |
| Token field | Configured, signed in, seat free | Paste the token |
| "Déploiement déjà configuré" | Somebody already holds the seat | Ask them for an invitation from the Équipe screen |

---

## Part 2 — Restrict `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`

### The key is public and that is fine; unrestricted is not

`NEXT_PUBLIC_` means the key ships in the browser bundle. That is how the Maps
JavaScript API is designed to work, and no amount of care hides it. What stops
somebody lifting it out of the bundle and putting it on their own site is not
secrecy — it is the **HTTP referrer restriction**, which Google enforces on its
side.

Without one, an unrestricted key found by a scraper bills the restaurant's
Google Cloud account for traffic it never served. Google's own quota alerts
arrive after the money.

### This is an account action, not a code change

Nothing in this repository can enforce it, and no test can prove it holds: the
restriction lives in the client's Google Cloud project. It is a step in the
deployment checklist, and the only evidence is the console itself. Treat it the
way the AWS per-client account is treated — see
[`aws-ownership.md`](./aws-ownership.md).

### Procedure

In the **client's own** Google Cloud project:

1. **APIs & Services → Credentials →** the key used by this deployment.
2. **Application restrictions → Websites.** Add, and add nothing else:
   - `https://<client-domain>/*`
   - `https://www.<client-domain>/*`
   - the Vercel preview domain, only while the site is being built —
     `https://<project>-*.vercel.app/*` — and remove it at go-live.
3. **API restrictions → Restrict key.** Enable only what the app calls:
   - Maps JavaScript API
   - Places API
   - Geocoding API
4. **Save**, then confirm from a browser on the client domain that the map still
   renders, and from any other origin that it does not.

### One key per client

The same rule as the AWS account and the Sentry project: a shared fleet key
means one client's abuse spends another's quota, and an offboarded client keeps
a working key. A per-client key in a per-client project makes that structural
rather than a matter of discipline.

### Budget alert

Referrer restrictions stop the common case, not a compromised client machine.
Set a budget alert on the client's billing account as the backstop:
**Billing → Budgets & alerts →** a monthly budget with email at 50 / 90 / 100 %.

---

## Checklist

- [ ] `ADMIN_BOOTSTRAP_TOKEN` set on the Convex deployment
- [ ] First account created, address verified, `/setup` completed
- [ ] `ADMIN_BOOTSTRAP_TOKEN` removed afterwards
- [ ] Maps key restricted to the client domain, APIs narrowed to three
- [ ] Vercel preview domain removed from the referrer list at go-live
- [ ] Budget alert set on the client's billing account
