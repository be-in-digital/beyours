---
"@be-in-digital/convex-functions": minor
---

Bound the backup subsystem's reads.

Every read in the backup path was a bare `.collect()` over a whole table, and
Convex refuses a transaction that reads more than 16 384 documents.
`BACKUP_TABLES` holds `orders`, `products`, `gamePlays`, `emailSubscribers` and
`kitchenTickets`, so an establishment trading two years passed the ceiling on
its orders alone: the export threw, the restore threw, and « Sauvegardes
automatiques quotidiennes » could not be used by the establishments with most to
lose.

Adds `BACKUP_PAGE_SIZE`, the page every one of those reads now takes. Exported
so a test can seed past it without seeding 16 384 rows — a paging loop is only
proved by a second page.
