---
"@be-in-digital/convex-functions": major
"@be-in-digital/convex-schema": minor
"@be-in-digital/admin": minor
---

Stop six bare deletes leaving rows pointing at nothing

Six handlers were written as `ctx.db.delete(args.id)` against tables other rows
reference, and `v.id("table")` validates how an id is ENCODED, not that it still
resolves — so no validator, no type and no test ever complained. Each one cost
something different, and every one of them shipped to every client site.

**A diner's won prize could be deleted out from under them (#326.1).**
`prizeRedemptions.prizeId` is REQUIRED. Tidying the prize list left the
redemption standing at `pending`, holding an id that resolves to nothing, and
`redeemByCode` dereferences that column — so the person at the till with a valid
code was told their prize did not exist. `games.remove` was the same shape over
`gamePlays.gameId`, and worse in one respect: a play carries the diner's consent
under art. 7.1, which is the establishment's evidence that it was allowed to
record a fingerprint at all. Both now refuse and name the way out, which already
existed and is already on the screen — `isActive: false` takes the prize out of
the draw and the game off the QR codes immediately, without touching a record. A
prize nothing has won still deletes, and the wheel section that named it keeps
its label and colour and loses only the dead link.

**Deleting an email template halted a send; deleting a segment widened one
(#326.2).** `emailCampaigns.templateId` is required, so `sendBatch` read the
template, found nothing, logged one line and returned: the campaign sat at
`sending` for ever while the owner's screen read « En cours ». `segmentId` is
optional, and that was worse — the code said "if the segment is there, filter by
it", so a deleted segment meant no filter at all and the campaign went to the
WHOLE list. Copy written for one slice reached every subscriber, in batches, and
marketing mail cannot be recalled. Both deletes now refuse while a campaign that
can still send, or any automation step, names them; a campaign that has finished
does not block, which is the trade written down in `emailAssetReferences.ts`.

**And the send no longer holds.** A batch that cannot read its template, its
configuration or its segment marks the campaign `failed` with a sentence naming
what to fix, shown under the campaign's name. That is a new status and a new
`failureReason` column — relaunchable, so the owner fixes the cause and presses
« Relancer », which keeps the cursor and resumes rather than mailing the first
batch twice. The two defences are not redundant: the refusal covers deletes from
now on, the failure covers every template or segment already gone, and every
other way one can go missing.

**A cancelled couponed order burned the diner's one use (#326.3).** The
cancellation branch restored tracked stock and left the promotion exactly as
checkout had spent it — `promotions.usageCount` still counted it, and the
`promotionUsages` row still stood against the customer's email. A one-per-
customer code was gone for good on an order the restaurant itself cancelled, and
no screen anywhere edits either number. Both are released now, from a shared
helper called by BOTH cancellation paths, because `updateFromWebhook` is a
separate handler and a rule that lives in one caller is a rule the other skips —
which this file has already paid for once, with a kitchen ticket left live on
the pass after Uber cancelled the order.

**`orders.remove` would have taken the invoice (#312).** One line, against a row
that `payments.orderId`, `kitchenTickets.orderId` and `invoices.orderId` all
reference REQUIRED. No screen calls it, which is the reason to guard it now
rather than later: it is live under `orders:delete`, and whoever wires the first
button to it will not be reading this file. It refuses on an invoice — a
numbered fiscal document in an unbroken series, art. 242 nonies A CGI — and on a
payment that moved money or is still in flight; it carries away the kitchen
tickets, the dead payment attempts and the spent delivery quote, and releases
the promotion. `orderCascade.ts` records which table is on which side and why.

**The dead Uber Eats importer is gone (#313).** `uberEatsOrders.saveFromPlatform`
inserted `paymentStatus: "paid"` with no `releaseToKitchen` — an order paid for
and never reaching the pass — and its docblock claimed the webhook action called
it. `grep` found zero callers; the live path is `orders.createFromWebhook`.
Deleted rather than wired, because keeping it means keeping a second, wrong way
to create a marketplace order. It was also the only writer of
`orders.scheduledFor`, so `FEATURES.md` now says that field has none at all.

**Four indexes were added for these guards, and one for the release:**
`gamePlays.by_gameId`, `gamePlays.by_prizeId`, `prizeRedemptions.by_prizeId` and
`promotionUsages.by_orderId`. Each answers its question in one row rather than
by reading an establishment's whole history, so a delete does not get more
expensive the longer a restaurant has been trading.

**BREAKING:** `@be-in-digital/convex-functions` no longer exports
`uberEatsOrders`, and the `./uberEatsOrders` subpath is removed. Both apps'
wrappers and generated `api.d.ts` are updated here.

32 new cases. `destructivePaths.test.ts` seeds the referencing row, runs the real
handler and asserts BOTH halves — the refusal carries the code a screen switches
on, AND neither side of the reference was deleted; 16 of its 21 fail against the
code they fix, and the 5 that pass are the controls proving a delete that should
still work does. The double is index-faithful, so the four new indexes are proved
declared rather than merely spelled correctly. Both apps gain four cases on the
campaign state machine.

Closes #326. Closes #312. Closes #313.
