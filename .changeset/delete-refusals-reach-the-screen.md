---
"@be-in-digital/convex-functions": major
"@be-in-digital/convex-schema": minor
"@be-in-digital/admin": minor
---

Make the delete refusals reach the owner, and stop five more removes orphaning rows

#400 gave six deletes a `ConvexError` carrying a French sentence the owner is
meant to act on. Four admin screens caught it and showed a fixed line instead —
so the owner clicked delete, something went grey, and the reason never appeared.
The engine half was right and undelivered. The prize case was the worst of them:
the server says *do not retry, deactivate instead* and the screen said
« Suppression impossible — réessayez ».

**The refusal is now what the screen shows.** `games`, `prizes`, `emailTemplates`
and `emailSegments` read it out of the `ConvexError` payload through
`convexErrorMessage`, as `products-table` already did. So do the other eleven screen files,
because the defect was the class and not the four instances — seventeen call
sites across fifteen files, and a source-level case now holds every one of them,
including the second delete in the two files that make two. (The first version
of that sweep matched one binding per file, which left `catalog-page`'s prize
delete and `use-store-detail`'s Deliveroo delete uncovered; reverting either
kept the whole admin suite green.)

**And five more removes were still leaving rows pointing at nothing.**

- **A subscriber's rows go with them.** `emailSubscribers.remove` was a bare
  delete over TWO non-optional foreign keys — `emailEvents.subscriberId` and
  `emailAutomationRuns.subscriberId` — behind a live button. `privacy.ts` has
  cleared exactly those two tables, in that order, since the erasure path was
  written and says why; this delete was the one path that did not call it. It
  cascades now, a batch at a time, and the subscriber survives every pass but
  the one that finishes them — a half-drained delete never leaves the two tables
  promising a row the database no longer has.

- **A campaign that has reached somebody is refused.** The delete button is
  offered for `draft`, `cancelled` and `failed`, and two of those three are
  states a send lands in mid-list: `markFailed` only fires on a campaign that
  was `sending`. What that partial send is recorded in is `emailEvents`, one
  `sent` row per (campaign, subscriber), which is what makes « Relancer » resume
  instead of restart. The rows survived a delete; the key did not. The only
  route left to finish the send was to rebuild the campaign — and the copy, with
  a new id, asks the same question of the same table and is told nobody has been
  reached, so everyone who already had it gets it again. Marketing mail is not
  recallable. It refuses and points at « Relancer ». Not a cascade: those rows
  are also the weekly cap's answer and the establishment's record of what it
  sent.

- **A QR code that has been played is refused**, and can now be deactivated
  instead. `gamePlays.qrCodeId` has no reader anywhere, which is why nothing
  crashed and nothing was noticed — and that is the whole damage: a `gamePlays`
  row is the establishment's evidence under art. 7.1 that it was allowed to
  record a fingerprint, and `qrCodeId` is the only field saying where the
  consent was given. `isActive` has been in the schema from the start and the
  screen offered create and delete and nothing in between, so a refusal would
  have been a dead end; `gameQRCodes.setActive` and a control on the screen are
  the way out the refusal names.

- **A formule a prize gives away is refused, and its translations go with it.**
  `menus.remove` was a bare delete. `prizes.menuId` gets the same treatment
  `products.remove` already gives a dish a prize names. `translations.entityId`
  is a `v.string()`, so no validator could see it was a foreign key: a menu's own
  name and description in every language the owner added were cleared by nothing
  short of deleting the whole establishment.

- **A coupon an order was discounted by is refused.** `promotions.remove` was
  not a bare delete — it cleared the `promotionUsages` ledger in batches, which
  is what made deleting a popular coupon possible. The reference it never
  touched is the one that matters: `orders.promotionId` is optional and
  unindexed, so every order that coupon discounted was left naming a row that no
  longer resolved, with the discount still on the order and on the numbered
  invoice issued for it. `releasePromotionForOrder` read that id, found nothing,
  and quietly released nothing. A redeemed coupon is history now, and
  deactivation was already on the screen. It asks the order directly, through a
  new `orders.by_promotionId` — the cheap proxy is not equivalent, because the
  retention cron and an art. 17 erasure both clear `promotionUsages` while a
  paid order is ANONYMISED and keeps its `promotionId`, so proxying would have
  made a three-year-old coupon deletable again and re-created the very
  reference the guard exists to stop. `promotionUsages` is asked too: its
  `promotionId` is REQUIRED and its `orderId` is not. `purgeUsages` stays
  exported and the wrappers no longer schedule it: Convex resolves a scheduled
  function by name at run time, and a client deployment running the previous
  `remove` can still have a drain booked.

- `emailAutomations.remove` gets the same guard over `emailAutomationRuns`. It
  has no UI caller; it is live on the API under `marketing:write` all the same.

**BREAKING.** `emailSubscribers.remove` returns `{ deleted, complete }` and
`menus.remove` returns `{ deleted, hasMore }`, both of which the app wrappers
must drain — `emailSubscribers.purgeRemoval` and `menus.purgeTranslations` are
new internal mutations, wired in both apps. `promotions.remove` no longer
deletes usage rows; it refuses instead. `gameQRCodes.setActive` is new. One new
index, `orders.by_promotionId`; every other index these guards seek was already
declared.

**And the instrument that measures all of this was reading low.** The
read-counting double under-counted the exact unindexed scan it exists to catch.
Convex's `.filter()` is a post-scan predicate — the stream reads every document
of the scanned range and charges each one against the 16,384-document
transaction limit, and the predicate only decides what comes back — but the
double narrowed its candidate array inside `filter` and then counted the
survivors. `.filter().collect()` over 6,000 rows scored the handful it returned;
`.filter().first()` over a table where nothing matched scored **zero** for the
most expensive query Convex will run. It caught a live one immediately:
`storeIntegrations.getBySiteId` and `getByBrandId` — how both platform webhooks
resolve their store on every delivery — were exactly that shape, and now narrow
through `by_platform_enabled` first. No new index; the narrowing moved into the
one that was already there. That is `dueForSending`'s own defect
(#327), and it is what the hand-rolled double this one replaced was thrown out
for. It was masked rather than hidden: `filter` took a plain JavaScript
predicate while every real handler passes Convex's `FilterBuilder`, so the shape
threw `TypeError` instead of under-counting — and the obvious repair would have
turned that crash into a silently green full-table scan. It now speaks
`FilterBuilder` and charges every document it walks, and eight cases in the
double's own guard hold it there.

The refusal only ever names a control the screen is rendering: « Relancer » is
offered for `paused` and `failed`, so a campaign cancelled mid-list is told
instead that it stays as the record. A refusal that sends the owner after a
button that is not there is the dead end this whole change is about.

Probes. Three throwaway suites, each reverted against the unfixed code:
the games and prizes screen showed « Suppression impossible — réessayez » where
the server had said « Désactivez-le pour le retirer du jeu », and the two email
screens « Échec de la suppression » where it had named the campaign blocking
them; seven of nine backend cases
failed and the two controls — a delete that should still work — passed; and the
counting cases returned 1 and 0 where Convex charges 6,000. Two tests that were
green while blessing the defect are rewritten and named as such: the three
`promotions.remove` cases in `queryBounds.test.ts` and the app-level
"clears the offer at once and its usage record in batches".

Closes #412.
