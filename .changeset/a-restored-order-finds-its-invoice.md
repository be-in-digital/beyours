---
"@be-in-digital/convex-functions": patch
---

Repair the orders ↔ invoices link a restore breaks, and stop the comment that said it did not

`backupTables.ts`'s header claimed that leaving the invoices out of the import
"keeps `orders.invoiceId` correct across a restore: the invoice rows are never
re-inserted, so their ids never change, so the reference still resolves". That
is true of the invoice's own id and says nothing about the ids inside it, or
about the other end of the link. `backup-coverage.test.ts` skipped the
`orders → invoices` edge on the strength of the sentence
(`if (exportOnly.has(target)) continue`), and never walked `invoices`' own
references at all — so neither half was ever examined.

**`invoices.orderId` breaks on EVERY restore, the same deployment included.**
`orders` is deleted and re-inserted under new ids; the invoices sit untouched
naming the ids the orders had before. That is the authoritative half of
`assertOrderHasNoInvoice` — the half that exists for an order invoiced before
`orders.invoiceId` was populated — so after a restore such an order could be
deleted with its invoice standing. `invoices.storeId` moves with it and takes
the establishment's invoice list (`by_storeId_issuedAt`) with it. Measured:
`invoice.orderId = 10001;orders`, restored order `10004;orders`,
`invoices.by_orderId(restored order) = null`.

**`orders.invoiceId` breaks on a REBUILT deployment**, where the invoices are in
the file and not in the database. `invoiceRefusal` reads that field for
truthiness rather than resolution — `if (order.invoiceId) return "already_issued"`
— so the sale could never be invoiced again, by the automatic path or the manual
one, and the admin showed no number and the reason "already issued". Measured:
`ctx.db.get(invoiceId) = null`, `invoiceRefusal = already_issued`.

Neither is answerable by the import ORDER: an export-only table has no position
in it. Both are now repaired after the last insert.
`systemInternal.relinkArchiveReferences` rewrites the archive's ids through the
full map — not editing the document, whose number, dates, parties and figures
are untouched, but re-pointing this deployment's pointers at the rows the sale
and the establishment came back as. `systemInternal.reconcileOrderInvoiceLinks`
then re-points a dangling `orders.invoiceId` at the invoice that stands for that
order, or clears it when none does, so the order is invoiceable again from the
new deployment's own series. Nothing fiscal is deleted: the documents are in the
backup file, which on a rebuilt deployment is then the ONLY copy of that series
and has to be kept as such (art. L102 B LPF) — `numberSequences` is export-only
too, so the rebuilt deployment starts a fresh series. The counts reach the
import's return message and the `backup_import` audit entry, and the rehearsal
runbook now tells an operator what `clearedInvoiceLinks` obliges them to do.

Every edge that crosses the archive boundary is declared in the new
`ARCHIVE_EDGES`, in both directions, with what answers it — including
`systemAuditLog → stores`, which is left unrepaired **deliberately** and says so:
rewriting an audit row is the one thing that table is export-only to prevent, so
after a restore its entries fall out of a non-super-admin's view. Known, named,
not fixed. `backup-coverage.test.ts` derives the set from the schema and fails
on an undeclared one, so the next `v.id("invoices")` is a decision rather than a
dangling reference found during someone's restore.

Also in this file: the header said "Two edges the order deliberately breaks are
declared in `DEFERRED_REMAP_TABLES` below" over a one-element array, and had
since `58f890f` introduced the sentence, the single bullet and the array in one
diff. No second edge was ever removed — the plural was never true. It now states
`DEFERRED_REMAP_TABLES.length === 1`, and two guards hold it: the count in the
prose against the array's length, and one bullet per entry.
