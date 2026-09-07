---
"@be-in-digital/convex-functions": major
"@be-in-digital/admin": major
---

Bound the four queries that grow with the mailing list and the order book

**Convex refuses a transaction that reads more than 16,384 documents, and each
of these was a live `useQuery`.** They do not degrade: at the row count where a
restaurant's mailing list or order book has become worth having, the screen
behind them throws on every load, permanently, and no admin action clears it.
#316 made every storefront signup, order and game play add a subscriber, so the
list grows on its own. Measured on the read-counting double:

```
                                        20,000 rows     before -> after
PROBE emailSubscribers.list             subscribers     20,000 ->     15
PROBE emailSubscribers.countByStatus    subscribers     20,000 -> 10,005
PROBE emailSegments.countMatching…      subscribers      4,000 ->  2,001
PROBE products.getTrending              orders          20,008 ->  1,008
```

(`countByStatus` reads five index ranges of 2,000 rather than one table of
20,000, and the segment preview's 4,000 is the active fifth of that seed — both
were already past the ceiling on a list two or three times this size, which is
one good year.) `dueForSending` is not in the table because the double cannot
show its defect: a Convex `.filter` reads every row it rejects, and the double
applies the predicate before counting. On the real backend the sweep read every
campaign the establishment had ever written, once a minute, to find the almost
always empty set of due ones.

**The audience page reads a page.** `emailSubscribers.list` takes
`paginationOpts` and resolves the status tab through `by_storeId_status`; the
page is clamped to `MAX_PAGE_SIZE`, so `{ numItems: 1_000_000 }` from anyone
holding `marketing:read` cannot reinstate the transaction the pagination
prevents. `source` is gone from its arguments: no index carries it, and
filtering after `.paginate()` returns two rows out of fifteen and calls it a
page. The screen narrows source and search over the rows it has loaded and says
so in the placeholder and the empty state, and « Charger plus » widens what they
can see — the shape `/dashboard/orders` already uses.

**The counts are counted, not downloaded.** Convex has no count, so a total is
however many documents you were willing to read: `countByStatus` walks one
`by_storeId_status` range per status, stopped at `SUBSCRIBER_COUNT_SCAN_LIMIT`,
and `countMatchingSubscribers` reads at most `SEGMENT_PREVIEW_SCAN_LIMIT` active
subscribers before applying rules that no index can answer. Both report whether
they were capped: the dashboard renders « 2 000+ » and the segment dialog says
which population its count describes, rather than presenting a floor as a total.
`countMatchingSubscribers` now returns `{ count, scanned, truncated }` — a bare
number could not say which of the two it was.

**The homepage carousel ranks a window.** `products.getTrending` is the public
storefront's own subscription, one per open tab, re-run on every new order, and
it collected a month of orders to return three products. It now reads the
`TRENDING_ORDER_SCAN_LIMIT` most recent orders of the window, newest first — so
what the cap drops is the far end of the month, not this week — with a separate
budget for the product lookups a reworked catalogue can otherwise stretch, and a
clamped `limit`, because a public query is handed whatever a visitor sends.

**And the cron stops scanning the archive every minute.** `dueForSending`'s
docblock described an indexed per-store walk; what shipped was
`.filter(q => q.eq(q.field("status"), "scheduled")).collect()`, and a Convex
`.filter` narrows rows the database has already read. It walks
`by_storeId_status` per establishment now, which is what the paragraph always
claimed.

**`incrementRevenue` is removed, and the dialog stops reporting a zero it cannot
stand behind.** It had zero call sites, and nothing produces the figures it
patched: no path writes a `converted` email event, and no order records the
campaign that led to it. The campaign stats dialog rendered a hard « 0,00 € »
and « 0 conversions » beside real send and open counts, for every campaign, for
ever, and an owner reading it concluded their mailing sold nothing. Both tiles
now say « Non suivi » with the reason underneath. `stats.converted` and
`stats.revenue` stay in the schema, so wiring a real producer later is a
producer, not a migration.

Probes: 15 read-count cases in `queryBounds.test.ts`, seeding 20,000 rows — more
than Convex will read in one transaction — and asserting the number of documents
the query asks for rather than the answer it returns, because an answer is right
on ten rows and right again on ten million. Two of them assert the count does
not move at all as the table grows. The index-faithful double refuses an index
the schema does not declare and an equality off the index prefix, so "narrow it
in JavaScript instead" cannot pass either. 8 companion cases in each app's
`query-bounds.test.ts` run the same paths through the real schema and the real
auth wrappers, and `dueForSending`'s own tests moved off a hand-rolled `db` that
answered `.filter().collect()` with the rows the test wanted — it could not tell
the indexed walk from the table scan it replaced, and was green for the whole
time that scan was shipping.

Closes #327.
