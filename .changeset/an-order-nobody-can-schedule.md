---
"@be-in-digital/convex-schema": major
"@be-in-digital/convex-functions": minor
"@be-in-digital/core": major
"@be-in-digital/admin": patch
"@be-in-digital/restaurant": patch
---

Stop the confirmation email rendering from a field no order has ever carried

`orders.scheduledFor` had no writer. Its only one was `uberEatsOrders.saveFromPlatform`,
an importer with zero callers deleted with #313, and #363 had already removed the
sibling `orders.scheduledAt` on an explicit finding — that customer-facing
scheduled ordering is a capability this product does not have, and
`orders.create` takes no time argument at all. It took `scheduledAt` and missed
`scheduledFor`.

**What made it worth removing rather than recording is that something read it.**
`timingLine` in the confirmation email opened with `if (input.scheduledFor)` and
rendered « Prévue pour le 12 mars 2026 à 19:30 ». That branch was written in
#367, *after* #363 had ruled the feature unbacked, against a field that was
already unwritten — so it has never run for any order and never could. The
field, its Zod line, its three type declarations, the payload mapping and the
email branch are gone together.

**A second, live defect was found underneath it, and is deliberately NOT fixed
here.** `timingLine`'s remaining branch reads `order.estimatedPrepTime`, and
`orders.create` writes the prep time it computes onto the **kitchen ticket**
instead — `estimatedPrepTime: summary.estimatedPrepTime`, inside the ticket
insert. Nothing writes the field the email reads. So the confirmation email
prints no timing row for any real order and never has: both branches were dead,
not one. That is a defect in what a customer-facing email says rather than dead
code, and wiring it is a change with its own review, so it is reported under
#413 and recorded in `timingLine`'s own docblock instead of being smuggled in
under a deletion.

**The tests that covered this were green throughout, and proved nothing.**
`packages/core`'s `timingLine` cases call it with a `scheduledFor` and an
`estimatedPrepTime` they supply themselves, so they exercise the rendering and
say nothing about whether an order can reach it. The one asserting « Prévue pour
le » is gone with its branch; the two that remain now carry a note saying what
they do and do not establish.

`packages/convex-functions/src/__tests__/confirmation-reads-what-orders-write.test.ts`
asks the question those tests could not: every field the confirmation payload
reads off an order must be written by some `insert("orders", …)` or order
`patch`, or be named in an allowlist with its reason. `estimatedPrepTime` is the
one entry, carrying the defect above. Writing that test surfaced two ways a
scan like it can lie, both now closed in it: a loose key scan sees `orders.ts`'s
*kitchen ticket* literal and reports `estimatedPrepTime` as written — which is
the very confusion that caused the bug — and a colon-only key regex misses the
shorthand properties (`orderNumber,`, `viewToken,`) that a third of the orders
insert uses.

Two `packages/restaurant` cases ranking a scheduled order's kitchen priority
went with the field; what they were really pinning — that being a delivery is
what makes an order urgent — is the pair of cases they sat between. The
Deliveroo `it.todo` that asked for this field to be written is rewritten rather
than deleted: the need behind it is real, but it is a **KDS lateness** concern
(an order an hour overdue looks identical to one placed this second), not a
diner-facing booking feature, and the todo had gone stale — it still cited
`scheduledAt`, deleted three PRs earlier, and two line numbers that had moved.

**Why `@be-in-digital/core` is a major.** `./aws/ses/order-confirmation` is a
first-class entry in that package's `exports` map — `convex-functions` and both
apps import it across the package boundary — and this removes `scheduledFor`
from the exported `OrderConfirmationInput` interface and drops `timingLine`'s
second parameter. Either is a compile break for a consumer pinning a version.
An earlier draft called it a minor, which would have been the same field being
`major` in `convex-schema` and `minor` in `core` in one changeset.

**No migration.** The field never had a live writer, so no document should carry
it; #363 removed `scheduledAt` on the same reasoning with no migration and the
registry in `convex/migrations/index.ts` is still empty. If some deployment does
hold a document with the field, Convex refuses the schema push — a loud failure
at deploy time, not silent data loss.
