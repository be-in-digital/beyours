---
"@be-in-digital/convex-functions": minor
"@be-in-digital/admin": minor
---

Say out loud that a deployment issues no invoices, and give the owner the form that fixes it

**A seller-incomplete deployment took money indefinitely with no legal
invoice and no warning anywhere (#375).** `issueInvoiceForOrder` deliberately
answers `{ issued: false, reason }` instead of throwing — a missing SIREN
must not fail a payment, and that part is right. Its docblock then claimed
"the admin surfaces it", and nothing did: both callers awaited the result and
discarded it, the paid order's detail page had zero invoice references, and
no banner existed. The repo's signature failure class — an annotation
asserting more than the code does — this time on the fiscal path
(art. 242 nonies A CGI requires an unbroken numbered series).

Worse than the docblock: **the state was unfixable from inside the product.**
No admin screen collected `globalSettings.seller`, and `globalSettings.upsert`'s
validator did not even accept a `seller` argument — `seller_incomplete` was
permanent on every deployment ever cloned.

Three surfaces now exist, and one form:

- **The paid order says it.** New `orderInvoiceSurface` computes the invoice
  number or the refusal fresh on every read — never persisted, so completing
  the identity clears it by itself — and `orders.getById` in both apps
  spreads it onto the order. The detail page grew a « Facture » card: the
  number when issued, « Facture non émise » with the reason in French and a
  link to the fix when not — and for the backlog, a third state adversarial
  verification demanded: an order paid while the seller was incomplete stops
  refusing once the identity is complete, which used to make the card vanish
  and leave that order invoiceless for ever. It now offers « Générer la
  facture », the first UI caller `invoices.issueForOrder` has ever had,
  gated on the same `payments:write` the mutation enforces. While in the
  file: `tableNumber`, persisted since day one and displayed never, is now
  on the dine-in detail.
- **The dashboard warns.** A persistent banner while `seller` is incomplete,
  shown only to holders of `settings:write` — exactly SUPER_ADMIN and
  CLIENT_ADMIN, the people who can act — using the engine's own
  `sellerIsComplete` so the banner and the refusal cannot disagree.
- **The docblock now describes surfaces that exist.**
- **The settings screen collects the identity.** A « Facturation » tab
  (raison sociale, forme juridique, siège, SIREN/SIRET, TVA, RCS, capital,
  mentions légales), backed by a `seller` argument on `upsert` matching the
  schema exactly. Only the legal name gates issuance, as before; the rest
  stays optional — a micro-entreprise legitimately leaves most of it empty.

Deliberately NOT done: seller identity is not a boot-blocking requirement.
Whether go-live should hard-require it is an owner decision; the banner is
the honest middle until that decision is made.

Held by tests that cross the seam the green suites never did:
`order-detail-invoice.test.tsx` renders the real page and pins the refusal,
the number, the link and the table; `seller-incomplete-banner.test.tsx` pins
shown-when-incomplete, gone-when-complete, silent-to-staff;
`order-invoice-surface.test.ts` in both apps drives the whole journey —
money in, refusal on the order, identity saved through the new validator,
refusal clears, catch-up issuance names the document; and
`invoices.test.ts` pins `orderInvoiceSurface` itself, including that it
recomputes on every read.
