# Rehearsing a restore

> A backup nobody has ever restored is not a backup. This is the drill, and it
> is on a schedule because it stops being true the moment the schema changes.

## Why this exists

The nightly backup ships (`apps/*/convex/crons.ts`, `nightly backup` at 01:30
UTC) and the restore path is covered by tests: the id-remap landed with #224, the
table lists are checked against the schema's own foreign-key graph
(`tests/convex/backup-coverage.test.ts`), and a restore probe seeded with orders
gets those orders back. None of that is a rehearsal. Tests run against
`convex-test` with a fixture of four rows; a real deployment has a year of trade,
a Stripe account holding payment intents that name orders, and an operator under
time pressure.

Issue [#366](https://github.com/be-yours/beyours/issues/366) asked for the
drill by name. Do it **quarterly**, and after any schema change that adds or
removes a table.

## What you need

- A **scratch Convex deployment**, never a client's. `npx convex dev` against a
  fresh project is enough; a preview deployment works too.
- A recent backup object from a real client's bucket:
  ```bash
  aws s3 ls "s3://$BUCKET/backups/" | tail -5
  aws s3 cp "s3://$BUCKET/backups/2026-09-07T01-30-00-000Z.json" ./backup.json
  ```
- An account on the scratch deployment holding `system:restore` — that is
  `super_admin` or `client_admin`.

> **Never restore into a client's deployment to rehearse.** `importTable`
> deletes a table before it re-inserts. The dry run does not, but the dry run is
> not the thing being rehearsed.

## The drill

1. **Read the manifest first**, without importing anything:

   ```bash
   jq '.manifest | {createdAt, deployedAppVersion, backupFormatVersion, tableRowCounts}' backup.json
   jq '.manifest.archivedNotRestored, .manifest.excludedTables' backup.json
   ```

   The object's root is `{ manifest, data }` (`systemBackupOffsite.ts` writes
   what `system.buildBackup` returns), so **every one of these fields lives under
   `.manifest`**. The first line here read `jq '{createdAt, …}'` for a while and
   returned four nulls — and `"tableRowCounts": null` is what a good backup and a
   truncated one produce identically, which is the opposite of what this step is
   for. `tests/convex/nightly-backup.test.ts` now checks these field names
   against the manifest the code actually builds, so the two cannot drift again.

   `tableRowCounts` is the number to argue with. A store with a year of trade
   and `orders: 0` means the backup ran before the coverage fix, or the export
   failed halfway — either way, stop here and find out which.

2. **Import as a dry run.** Système → Sauvegarde → *Importer un backup*. The
   preview reports a row count per table and modifies nothing.

3. **Import for real, then read what it did — and not from the toast.** The
   admin shows only `Import termine : N lignes importees`
   (`packages/admin/src/pages/system/backup-section.tsx`); the account of what
   was repaired is the action's return `message` and the `details` of the
   `backup_import` entry it writes to `systemAuditLog`. On a scratch deployment
   the direct read is the quickest:

   ```bash
   npx convex data systemAuditLog --limit 5 --order desc
   ```

   In the product it is Système → **Journal**, filtered on `backup_import`.
   Read `clearedInvoiceLinks` first — step 5 says what it obliges you to do —
   then `archiveRelinks`, `droppedProfileStores` and `remappedProfiles`.

4. **Check the six things a restore has silently got wrong before.** Each is a
   real defect that shipped:

   | Check | The defect it catches |
   |---|---|
   | A product opens from its establishment's catalogue | `stores` came back under new ids and the catalogue kept the old `storeId` (#224) |
   | The operator can still open a store-scoped screen | `userProfiles.storeIds` named stores that no longer existed — the owner was locked out of everything |
   | Kitchen → Stations shows the mapping the client configured | `stores.stationMapping[].categoryId` pointed at deleted categories; every ticket fell back to one station, silently |
   | An order from before the backup opens, with its lines and its total | `orders` were not in the export at all — a restore reached zero of them |
   | A CMS page renders on the storefront | the sixteen `cms*` singletons were not in the export, so a "backup" of the website carried none of its pages |
   | An invoiced order still shows its invoice number, and refuses to be deleted | `orders` are re-inserted under new ids while the invoices are not, so every invoice pointed at a dead order — and on a REBUILT deployment the order pointed at an invoice that was not there, which `invoiceRefusal` read as "already issued" for ever |

5. **Check what a restore is not supposed to fix**, so nobody reports it as a
   bug. Three different lists, and the manifest carries each separately:

   - `manifest.archivedNotRestored` — the invoices, their numbering and the
     audit log. Carried in the file, never re-inserted: a numbered fiscal series
     a restore can rewrite is not a series (art. 242 nonies A CGI).
   - `manifest.excludedTables` — absent from the file entirely, each with its
     reason in French. The payment provider connections are here: they have to
     be re-authorised.
   - `manifest.note` — the media is referenced by URL rather than duplicated.

   **If `clearedInvoiceLinks` was not zero, this is the step that obliges you.**
   On a deployment rebuilt from the file the invoices do not exist here, so the
   restore cleared the dead links and those orders are invoiceable again — from
   *this* deployment's series, which starts at 1 because `numberSequences` is
   export-only too. The original documents are only in the backup JSON. Keep
   that file as the fiscal archive of the old series and say so in writing to
   whoever holds the accounts: art. L102 B of the LPF wants six years of it, and
   nothing in the rebuilt deployment can reproduce it.

6. **Write down the date and the version.** Not in `systemAuditLog` — nothing
   lets an operator add a line to it, and this step used to say otherwise. The
   import writes its own `backup_import` entry there; what a human has to record
   is the rehearsal itself. Put it in the fleet console's activity feed, or in
   this file's changelog on the PR, naming which backup object was restored
   (`manifest.createdAt`) and against which `deployedAppVersion`. A rehearsal
   nobody recorded is one nobody can prove.

7. **Tear the scratch deployment down**, or reset it. A scratch deployment
   holding one client's real trading data is a copy of that data nobody is
   tracking.

## When it fails

Two failures are worth naming in advance, because both are silent:

- **A table in the file that the schema no longer has.** The import refuses it
  by name (`Table "x" non autorisée pour l'import`). That is the right
  behaviour, and the fix is a migration, not an allow-list entry.
- **A reference the map could not resolve.** The restore does not count these,
  deliberately — `backupRemap.ts` explains why a count would report zero in
  exactly the case it exists to catch. Step 4's table is the check that replaces
  it. The ONE exception is the fiscal archive, which is counted exactly because
  the map does know both ends of it: `archiveRelinks`, `repointedInvoices` and
  `clearedInvoiceLinks`.
- **An audit entry that has fallen out of a store admin's view.**
  `systemAuditLog.targetStoreId` names the establishment an entry is about, and
  it is what shows a non-super-admin the entries for the stores they have access
  to. It is not repaired — the table is export-only precisely so that nothing
  rewrites it — so after a restore those entries are visible to a `super_admin`
  and to nobody else. Declared, with the reason, in `ARCHIVE_EDGES`
  (`backupTables.ts`). Known, not fixed.

## Related

- [`aws-ownership.md`](./aws-ownership.md) — whose bucket the backup lands in,
  and why that is the honest limit of it
- [`s3-bucket-policy.md`](./s3-bucket-policy.md) — the lifecycle rule that
  expires `backups/` at 30 days
- `packages/convex-functions/src/backupTables.ts` — what is carried, what is
  archived, what is excluded, and why
