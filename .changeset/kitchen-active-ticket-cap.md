---
"@be-in-digital/convex-functions": patch
---

Hold the KDS cap with a test that fails when the cap is removed

`getByStore` is bounded on two axes — the three active statuses, and
`ACTIVE_TICKET_LIMIT` rows of each, read oldest-first. Only the first was held
by a test. The 5,000-ticket case seeds `completed` rows, so it answers with an
empty list on the status filter alone: replacing `.take(ACTIVE_TICKET_LIMIT)`
with `.collect()` left it green.

That gap is not academic. `purgeExpiredTickets` deliberately never deletes a
ticket still on the pass — an establishment that left one open overnight has a
problem, and silently deleting it is not the answer — so for tickets that are
never completed the cap is the only thing standing between a busy service and
the unbounded subscription every open tablet re-reads on every write. It is the
failure #137 exists to prevent, and it would have regressed silently.

"A pass nobody ever cleared" seeds 250 live tickets and holds both halves: the
row count, and the choice of which end to keep. The ordering is the half worth
asserting — keeping the newest would drop the longest-waiting orders off the
screen, and nobody would ever cook them. Both go red when the corresponding
line is removed. `ACTIVE_TICKET_LIMIT` is exported so the test names the bound
rather than restating the number, matching `MAX_PRINT_ATTEMPTS` and
`RETENTION_BATCH_SIZE` beside it.
