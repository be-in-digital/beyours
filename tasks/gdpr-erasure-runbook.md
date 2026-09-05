# Runbook — Retention and erasure of personal data (apps/site)

> How the published retention schedule is enforced, and what an operator does
> when somebody exercises their right to erasure. It contains **no credential**
> and **no personal data**.

## What the site publishes

`/confidentialite` §6 commits to three periods, and `/cgv` §12 to a withdrawal
waiver evidenced by a tick at checkout. Those sentences are legal artefacts:
they are not to be reworded to match the code. The code is what moves.

| Published | Enforced by |
| --- | --- |
| « Prospects : jusqu'à trois (3) ans à compter du dernier contact » | `convex/retention.ts` → `sweepExpiredProspects`, cron **delete expired prospects**, 04:15 UTC daily |
| « Clients : pendant la durée de la relation contractuelle » | on request — `retention.eraseDataSubject` |
| « Documents comptables et factures : dix (10) ans » | nothing deletes them; both paths above keep paid orders and invoices and say so in their report |
| « droit … d'effacement » (§7) | `retention.eraseDataSubject`, logged in `saActivity` |

## The daily sweep

Runs by itself. It deletes, three years after the last contact:

- `whitelist` rows — the waitlist. Counted from `lastContactAt`. **Nothing
  public advances that field**: a repeat form submission is accepted and
  dropped, because the endpoint is unauthenticated and the address unverified,
  so anyone who guessed an address could otherwise postpone its deletion for
  ever. Rows written before the field existed fall back to `createdAt`.
- `contactLeads` rows — every status, `converted` included. A converted lead's
  contact details are a copy; the client relationship lives in `orders`.
- `orders` that took no money **and that nothing references**. Not
  `status !== "paid"`: a refunded charge or a chargeback leaves the order
  `cancelled` while its payment and invoice stay on the books, and three of the
  tables pointing at an order declare `orderId` non-optional, so deleting one
  would strand rows whose schema promises a document.

It never touches an order that was invoiced, an invoice, a subscription, a
signed contract or an affiliate profile. It leaves one `saActivity` row per run that deleted
something (`action: "retention.prospects"`), and nothing on a quiet day — so
**a month with no rows is normal, a month with no rows AND expired prospects
still in the table is a bug**.

Caps: 1 000 rows scanned and 200 deleted per table per run. A backlog drains
over successive days rather than in one transaction, and the activity row says
so — « Reliquat à traiter demain : … ». **Seeing that line on consecutive days
means the backlog is not draining**; raise `DELETIONS_PER_RUN` in
`convex/retention.ts` or run the sweep by hand until it clears.

### Checking it ran

Convex dashboard → **Logs**, filter on `retention`, or the ops console activity
feed. `saActivity` rows carry `actorName: "cron"`.

## An erasure request arrives

Requests reach `contact@` (the address printed on `/confidentialite`). Answer
within **one month** (RGPD art. 12(3)).

### 1. Verify who is asking

Reply from the address on file and ask for confirmation, or ask for an element
only the person holds (their order reference). Do not erase on the strength of
an inbound address alone — an erasure request is itself a way to delete
somebody else's record.

### 2. Preview

With an admin session on the ops console, or from the Convex dashboard:

```
retention:previewErasure   { "email": "<address>" }
```

It reads and writes nothing. Check the counts match what you expect before
going further — an erasure is irreversible and an address is easy to mistype.

### 3. Erase

From the Convex dashboard (the path an operator has today; a dashboard run
carries no session, so `requireAdmin` cannot be used there):

```
retention:eraseDataSubjectFromDashboard
{ "email": "<address>", "operatorName": "<your name>" }
```

From the ops console, once it is wired to it, `retention:eraseDataSubject` does
the same thing and takes the operator's name from the admin session.

Both write an `saActivity` row with `action: "privacy.erasure"`, the operator's
name, the address and the counts. **That row is the company's proof the request
was honoured** — it is why the address is kept in it, and it is what to quote if
the CNIL asks.

### 4. Answer the person

State what was deleted and, plainly, what was not:

> Vos données de prospection ont été supprimées. Les factures et les commandes
> payées sont conservées dix (10) ans au titre de nos obligations comptables
> (art. L. 123-22 du Code de commerce), conformément à notre politique de
> confidentialité.

That refusal is lawful (RGPD art. 17(3)(b)) and it is already published, so it
should not be a surprise.

## What erasure deliberately does not do

**The report counts every one of these.** A report that named only what it
deleted would tell you the request was honoured in full when it was not, and you
would then tell the data subject the same thing. Work the list before you reply.

| Reported as | What it is | What to do |
| --- | --- | --- |
| `ordersRetained` | Orders that took money, or that a payment, invoice, subscription, commission or deployment still points at — a refunded order is one of these, and its invoice number is still on the books | Nothing. Ten years. |
| `invoicesRetained` | Invoices | Nothing. Ten years. |
| `usersRetained` | The login account itself | Closing it is an account deletion: it takes the Convex Auth rows with it and can orphan a signed mandate. Decide deliberately, then do it in the Convex dashboard. |
| `affiliateProfilesRetained` | An *apporteur d'affaires* profile | A counterparty to a signed mandate, not a prospect. Terminate the mandate first; what is left then falls under the accounting period. |
| `subscriptionsRetained` | Live maintenance subscriptions | Cancel the contract first — in Stripe as well. |
| `referralsRetained` | Commissions naming this address as the referred customer | The affiliate's own invoice evidence. Ten years. |
| `deploymentsRetained` | Client deployments | The contractual relationship. Follow `client-offboarding-runbook.md`. |
| `activityRowsRetained` | Ops activity rows carrying the address, including this erasure's own | Internal accountability record. Leave. |

An erasure **refuses outright** rather than half-erasing when any table it reads
has grown past `ERASURE_SCAN_CAP`. If you see that error, the fix is to move
those lookups onto indexes and fold the stored addresses — not to raise the
number and hope.

- **Stripe is not touched.** Customer, invoice and Connect account data live in
  Stripe, under Stripe's own retention. A full erasure has to be repeated there
  by hand — see below.

## Not yours to close — the console steps

These are account-owner actions and no code here can do them:

1. **Stripe.** Deleting or anonymising a Customer, and detaching payment
   methods, happens in the Stripe dashboard. Stripe keeps what its own legal
   obligations require.
2. **AWS SES.** Suppression-list entries and delivery logs for the address.
3. **Convex backups.** A row deleted here still exists in whatever snapshot
   predates the deletion, for as long as that snapshot is kept.

Record each of the three in the reply to the person, or in the internal note,
so the file shows what was done outside the product.

## One-off — repair the signature orphans left by the old ordering

`signAffiliateContract` used to write the signature row before generating the
PDF, so a signatory whose name left Windows-1252 produced one signed-looking row
per attempt and never a document. Those rows say a contract was signed that does
not exist. Once per deployment, from the Convex dashboard:

```
migrations:markOrphanSignaturesFailed  {}
```

It marks them `failed` rather than deleting them — an audit trail is repaired by
making it say what happened — and never touches a signed row that has its
document. Safe to run twice; the second run reports `marked: 0`.

## If the sweep needs to be run early

```
retention:sweepExpiredProspects  {}
```

Idempotent and capped. It reports what it deleted.
