---
"@be-in-digital/convex-functions": minor
"@be-in-digital/admin": patch
---

Put the restaurant's website and its orders in the backup

The export order and the import allow-list were written out twice — once in
`system.exportBackup`, once in `systemInternal.ts` — and kept in step by hand.
Between them they named **22 of the schema's 77 tables**. Omitted: `orders`,
`payments`, `kitchenTickets`, `translations`, `teamMembers`, and **all sixteen
`cms*` singletons** — so a "backup" of a restaurant's website did not contain
that website's pages, and a restore reached zero orders (#169, #366).

**One list now**, `@be-in-digital/convex-functions/backupTables`, read by both
sides: 53 tables exported and restored, 3 exported and never re-inserted, 21
excluded with the reason written down next to the name.

The fiscal archive is the interesting case. `tables/invoices.ts` states the rule
in the schema itself — an invoice is never edited and never deleted, so a
restore must not delete-and-re-insert the series (art. 242 nonies A CGI). But a
backup that loses an establishment's invoices is not a backup of that
establishment. Both are answered by carrying them in the file and refusing them
at the import, which is also what keeps `orders.invoiceId` resolving across a
restore: those rows never move.

**Two defects found on the way in.**

`stores.stationMapping[].categoryId` points at `categories`, and `categories`
points back at `stores`. No order satisfies both, so the kitchen routing came
back naming categories that no longer existed — silently, because `v.id()`
validates an id's encoding rather than that it resolves, so every ticket fell
through to single-station behaviour. `remapDeferredReferences` is a second pass
with the full id map, and `DEFERRED_REMAP_TABLES` is where an edge the order
breaks on purpose has to be declared.

And the export carried two live single-use credentials into a JSON file an
administrator downloads to a laptop: `teamMembers.invitationToken`, which grants
a role to whoever opens the link, and `emailSubscribers.doubleOptInToken`. Both
fields are optional, so a restore comes back without them and the invitation is
re-sent.

A restore now also schedules the retention sweep: a backup carries personal data
and can be older than the window it is restored into, and re-running the purge
is what stops a restore resurrecting what the establishment was obliged to
remove (art. 5.1.e).

The manifest states, in the file itself, what a restore will not put back and
what the backup does not carry at all — table by table with a reason each. The
admin's Sauvegarde card says the short version before anyone clicks. "Absent
because it is not the establishment's" and "absent because someone forgot" used
to look identical from the outside.

Tests check the lists against the schema rather than against memory: the import
order is verified to be a topological sort of the foreign-key graph derived from
Convex's own validators, and every table in the schema must be classified
exactly once — which is how sixteen CMS singletons went missing without anyone
noticing.

Refs #169, #366.
