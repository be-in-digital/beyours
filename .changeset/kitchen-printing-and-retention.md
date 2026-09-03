---
"@be-in-digital/convex-functions": major
"@be-in-digital/convex-schema": major
"@be-in-digital/admin": minor
---

Let a paid order print itself, and stop the kitchen screen going dark

Four defects met in the same place, and three of them had been closed once by
deleting the thing that revealed them.

**The kitchen cooked orders nobody had paid for.** `createWithTicket` inserted
the order and its ticket in one transaction, before any provider redirect: a
customer who reached Stripe and closed the tab left a slip on the pass, and
nothing retracted it. The rule is now "a *paid* order feeds the kitchen", and
it lives in `releaseToKitchen` rather than in any one caller — every payment
path reaches it through `orders.recordPaymentStatus` (Stripe webhook, Stripe
success-page verify, PayPal capture, SumUp verify) or `markCashPaid`. It is
idempotent, so a webhook racing its own success page still produces one ticket.

**`orderConfirmation` is a promise the product can keep now.** It was withdrawn
for offering a workflow nothing implemented. `releaseToKitchen` reads it:
`"auto"` — and unset, which is every existing establishment — releases on
payment; `"manual"` holds the order until staff accept it, which is what
`orders.updateStatus` to `confirmed` now does.

**Automatic printing was dead product-wide.** `stores.updatePrintConfig` had no
caller in `packages/admin` or either app, so every establishment ran with
`printConfig === undefined`, `kitchenTickets.create` stamped every slip
`printStatus: "not_required"`, and `getPrintQueue` was permanently empty. The
editor is back, in `packages/admin` this time, on the store-detail screen both
apps already render. Beside it: the print reliability work — `claimForPrint`
takes a ticket in one transaction so two tablets on the same pass cannot both
print it; `getPrintQueue` returns failed slips again once their retry delay has
passed, so `printAttempts` is finally read by something; and the trigger commits
its render with `flushSync` and refuses to print a slip whose content is not
there, because a blank page filed as "printed" leaves the queue and is never
seen again.

**The KDS query was unbounded and nothing was ever deleted.** `getByStore`
subscribed to every ticket a store had ever had; `getByStatus` behind the
"Terminées" tab did the same for the class that only grows. Both are bounded
now — the live read to the three active statuses, the completed tab to a page at
a time — and `purgeExpiredTickets` runs nightly, because bounding a read while
the table grows for ever only moves the failure.

**A customer's allergy reached the validator and stopped there.** The Uber Eats
mapper extracts `special_instructions` and `customer_request.allergy` into
`notes`; `createFromWebhook`'s item validator had no field for it and the
webhook passed `notes: undefined` one line before the insert. Both carry it now,
through one shared `toKitchenTicketItemsFromPlatform` rather than the same
mapping hand-written in two byte-identical files.

Two things the ticket never carried and the product depended on: `allergens`,
gathered from the products ordered, which the printed slip has always had a
block for and only demo data ever filled; and `estimatedPrepTime`, without which
`estimatedReadyAt` was never set and the overdue alarm could not fire for a real
order. Stations are routed as well — `stationMapping` sends a category to a
pass, and an order is split into one ticket per station it touches, so the cold
station is not handed a slip for a pizza.

Breaking: `kitchenTickets.getByStatus` now takes `paginationOpts` and returns
Convex's `PaginationResult` — `{ page, isDone, continueCursor }` — rather than
an array, so a caller reads `result.page` and drives it with
`usePaginatedQuery`. `printStatus` gains a `"printing"` literal, and
`markPrintSent` / `markPrintFailed` take an optional `claimId`.
