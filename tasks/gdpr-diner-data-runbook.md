# Runbook — A diner's personal data: access, erasure, portability, retention

> How a restaurant running the BeYours engine answers a customer who exercises
> their RGPD rights, and what the deployment deletes on its own. It contains
> **no credential** and **no personal data**.
>
> Scope: `apps/reference` and `apps/themes` — the engine, i.e. what a client
> runs. The commercial site `apps/site` has its own, separate runbook at
> `tasks/gdpr-erasure-runbook.md`. Do not conflate them: different deployments,
> different tables, different published commitments.

## Who is the controller

**The restaurant is.** Each client runs its own Convex deployment holding its
own diners' data; BeInDigital is the processor. So every decision in the
"Decisions the client owes" section below is the client's to make and to stand
behind — this document proposes defaults and says plainly which ones are still
unconfirmed.

## What the engine does, and what it is answering

| Right | Where | Function |
| --- | --- | --- |
| Access (art. 15) | Dashboard → Organisation → **Données personnelles** | `privacy.exportDataSubject` |
| Portability (art. 20) | same screen, the same button — a JSON file of the raw rows | `privacy.exportDataSubject` |
| Erasure (art. 17) | same screen, behind a preview and a retyped address | `privacy.eraseDataSubject` |
| Consent for the game (art. 7.1) | the diner ticks a box before playing | `gamePlays.consent`, refused by `gamePlay.play` without it |
| Retention (art. 5.1.e) | nightly cron, window on the same screen | `privacy.sweepExpiredCustomerData` |
| Proof it was done (art. 5.2) | Dashboard → Système → Journal | `systemAuditLog`, actions `privacy_*` |

## Answering a request

**1. Verify who is asking, before you touch anything.** Art. 12.6 lets you ask
for what you need to be sure. Ask for something only they hold — an order
number, or the code on their reward ticket. An e-mail address is not proof:
anyone can type one, and an erasure carried out on the wrong address destroys a
real customer's history irreversibly. Record what you checked.

**2. Look before you act.** Dashboard → Organisation → **Données personnelles**,
enter the address, press **Voir ce que nous avons**. Read the *Ce qui est
conservé* section: it is what you must NOT promise away in your reply.

**3. For an access or portability request**, press **Exporter**. You get a JSON
file containing the rows themselves. Send it to the verified address. One month
from the request (art. 12.3), extendable by two if you say so and why.

**4. For an erasure request**, retype the address to confirm, then **Effacer
définitivement**. The screen then shows what was done and what was kept. Note
the two things that surprise people:

- **A paid order stays.** Its amounts, lines and VAT are your accounting record
  and the law requires you to keep them. What leaves is the customer: name,
  e-mail, phone, delivery address, the notes on the order and the tracking
  links. The order shows as « Client anonymisé » afterwards.
- **The invoice is kept in full.** A paid order issues a *facture*, and a fiscal
  series cannot have a hole or an edit in it. The buyer's name and coordinates
  stay on it, the diner receives a copy in the export, and the report names it.
  This is the one place where « tout a été effacé » would be untrue.
- **An order still being served is not touched yet.** Blanking the address of an
  order a courier is carrying would strand the delivery. It is reported as kept,
  and the nightly purge takes it once the service is over. If the customer wants
  it gone immediately, complete or cancel the order first, then erase again.

**5. Do the manual steps the report names.** These cannot be automated and the
report says so each time:

| The report says | What you do |
| --- | --- |
| Adresses enregistrées, favoris et profil client — « cette demande ne couvre pas tous les établissements » | Your account does not administer every establishment in this deployment. Those rows belong to the person rather than to a dining room, so nobody with a partial view may delete them — one restaurant's manager must not be able to reach into another's. Have the request re-run by an administrator who holds every establishment. |
| Compte client (connexion) | The login itself lives in the authentication component, out of reach of this screen. Close the account from the team/account tooling, or ask BeInDigital. |
| Témoignages sur la page d'accueil | Check the homepage. If this person is quoted there, remove the testimonial by hand — it is editorial content, not a database record. |
| Segments d'emailing | A segment rule can name one address. Check your segments and correct any that do. |
| File d'attente Uber Eats / Deliveroo | Raw failed-delivery payloads, not searchable per person. They are wiped by the purge at 90 days. |

**6. Reply within the month**, and say what was kept and why. The *Ce qui est
conservé* text on screen is written to be quoted directly.

**7. Third parties are yours too.** Stripe, SumUp, PayPal, Uber Direct, Uber
Eats and Deliveroo each hold their own copy of what you sent them. Erasing here
does not reach them. Ask each provider through their own process.
**This step is outstanding on every request and is not something the code can
close.**

## The nightly purge

`crons.ts` runs **purge expired customer data** at 03:15 UTC. It reschedules
itself a minute later while there is a backlog, so a big catch-up drains over
several runs rather than dying in one transaction.

Per run it:

- **anonymises** orders past the window that are `completed` or `cancelled`, and
  the payments behind them;
- **deletes** game plays and their prize redemptions, contact messages,
  promotion usages, spent referral rows, saved addresses, and kitchen tickets —
  including the ones stuck on the pass that the 30-day ticket purge deliberately
  never touches;
- **deletes** newsletter subscribers whose last contact is past the window,
  counted from the latest of: consent, last order, last e-mail event;
- **deletes** spent limiter counters and expired delivery quotes;
- **blanks** the raw body of platform webhook failures older than 90 days.

It writes one `privacy_retention_sweep` line to the audit log per run that
changed something, and nothing on a quiet night. **A month of silence is normal;
a month of silence with three-year-old orders still naming customers is not** —
check that the window is not paused.

Pausing it (the switch on the screen) is legitimate for a litigation hold or a
migration. It keeps reporting what it *would* have deleted, so the backlog is
visible. Unpause it.

## Decisions the client owes — **none of these are settled**

The mechanism is built and tested. The numbers and the legal cuts are the
restaurant's, and they need confirming with their own counsel. Until then the
code runs on the defaults below.

| # | Decision | Default in code | Why it needs confirming |
| --- | --- | --- | --- |
| 1 | **The retention window** | 1095 days (3 years) from the row's date | The CNIL's guidance for a consumer business's customer and prospect data. It is guidance, not a statute, and a restaurant may have a reason to hold less. |
| 2 | **The delivery address is dropped from the ORDER on anonymisation** | Dropped | Written when the engine issued no *facture* and the order was the only record: for a B2C restaurant sale the instrument is a *note*, whose mandatory mentions do not name the customer. Since #367 an invoice is issued and keeps the address anyway (row 9), so this now decides what the ORDER keeps, not what the business retains. |
| 3 | **Which accounting period to publish** | The code keeps orders indefinitely; nothing deletes them | Art. L123-22 C. com. says ten years for accounting documents; art. L102 B LPF says six for tax. Different obligations, different clocks. Publish one. |
| 4 | **Card `last4` and `brand` survive an erasure** | Kept | They are the handle in a chargeback, and scheme windows run to about 540 days. Kept deliberately, and it is arguable — last4 plus amount plus date is a real re-identification vector against a bank statement. |
| 5 | **An erasure resets promotion eligibility** | Accepted | The `promotionUsages` row exists to enforce "one use per customer". Deleting it is what erasure means, and it makes a once-per-customer offer usable again by that address. |
| 6 | **An erasure destroys an unclaimed prize** | Accepted, and reported | A won-but-unredeemed code stops working. The report says how many. |
| 7 | **Anonymisation is irreversible** | No mapping is kept, anywhere | A reversible mapping is pseudonymisation (art. 4.5), not erasure — and the key would be the single worst table in the deployment. The safeguard against a mistyped address is the preview, not a way back. |
| 8 | **A game play from before the consent field cannot be claimed** | Refused with `CONSENT_REQUIRED` | Claiming attaches a name, an e-mail and a phone number to the play. Doing that to a row whose legal basis was never recorded would be collecting identified data with no basis at all. A diner holding an old winning code will be turned away and has to be handled at the counter. |
| 9 | **The invoice survives an erasure, with the buyer on it** | Kept, exported and reported | #367 made a paid order issue an `invoices` row — a numbered fiscal document in an unbroken series (art. 242 nonies A CGI), never edited and never deleted, carrying the buyer's name, e-mail, phone and address. Art. 17.3.b covers keeping it, and the diner still gets a copy through the export. It means an erasure no longer removes every trace of a paying customer, and the reply you send them has to say so. Confirm the reading, and confirm how long the series is kept (row 3). |

Record the answers here when they are made, with the date and who made them.

## What was hardened after the first build, and why it is in the tests

An adversarial pass was run against the erasure with one instruction: find a copy
of a "deleted" diner still in the database. It found nine, all now closed and all
now held by a test. They are worth knowing about, because each is a shape the
next change could reintroduce:

- A **referral row** kept the diner's device and name after an erasure by
  e-mail, because that step needed a fingerprint nobody puts in an RGPD letter.
  The walk now picks the handle off her own game play.
- A **prize redemption whose game play had already been swept** was reachable
  through nothing at all.
- A **subscriber imported from a CSV with a trailing space** survived the exact
  index lookup. The import now normalises like every other path, and the erasure
  compares folded rather than seeking.
- The **audit line was forgeable**: the walk's resume state was a public
  argument, so a caller could claim a finished erasure that never ran.
- **An administrator of one establishment could delete rows belonging to
  another** through the steps that are not store-scoped.
- The **nightly sweep could starve**, handed the same skipped rows every night,
  and could **reschedule itself for ever** making no progress.
- It also **deleted the saved address of a customer who ordered last week**,
  because it read the row's edit date rather than their last contact.
- **`claim` attached a name and a phone number to a play with no recorded
  consent.**

## Verifying it works, without waiting a night

```
npx turbo run build --filter='./packages/*'
cd apps/reference && npx vitest run tests/convex/privacy-erasure.test.ts \
                                   tests/convex/privacy-retention.test.ts
pnpm --filter @be-yours/convex-functions test src/__tests__/privacy.test.ts
pnpm --filter @be-yours/admin test src/__tests__/privacy-surface.test.ts
```

The one worth reading is `privacy-erasure.test.ts` → *"the adversarial sweep"*.
It seeds a diner, proves the seed is findable across the whole schema, erases,
then reads **every table** looking for the address, phone, street, fingerprint
and name. It skips `systemAuditLog` on purpose: that row is your proof the
request was honoured, and it keeps the address for exactly that reason.

## Not yours to close

- **Provider-side erasure** (Stripe, SumUp, PayPal, Uber Direct, Uber Eats,
  Deliveroo) — each has its own process, in its own console. Outstanding on
  every request.
- **Closing the login account** — the authentication component's tables are not
  reachable from this screen.
- **The nine decisions above** — the client's, with their counsel.
