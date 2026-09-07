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

Issue [#366](https://github.com/be-in-digital/beyours/issues/366) asked for the
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
   jq '{createdAt, deployedAppVersion, backupFormatVersion, tableRowCounts}' backup.json
   jq '.manifest.archivedNotRestored, .manifest.excludedTables' backup.json
   ```

   `tableRowCounts` is the number to argue with. A store with a year of trade
   and `orders: 0` means the backup ran before the coverage fix, or the export
   failed halfway — either way, stop here and find out which.

2. **Import as a dry run.** Système → Sauvegarde → *Importer un backup*. The
   preview reports a row count per table and modifies nothing.

3. **Import for real**, and read the message it returns. It names the profiles
   re-pointed, the store accesses dropped because the file did not contain that
   establishment, and the fiscal archive it deliberately did not write back.

4. **Check the five things a restore has silently got wrong before.** Each is a
   real defect that shipped:

   | Check | The defect it catches |
   |---|---|
   | A product opens from its establishment's catalogue | `stores` came back under new ids and the catalogue kept the old `storeId` (#224) |
   | The operator can still open a store-scoped screen | `userProfiles.storeIds` named stores that no longer existed — the owner was locked out of everything |
   | Kitchen → Stations shows the mapping the client configured | `stores.stationMapping[].categoryId` pointed at deleted categories; every ticket fell back to one station, silently |
   | An order from before the backup opens, with its lines and its total | `orders` were not in the export at all — a restore reached zero of them |
   | A CMS page renders on the storefront | the sixteen `cms*` singletons were not in the export, so a "backup" of the website carried none of its pages |

5. **Check what a restore is not supposed to fix**, so nobody reports it as a
   bug: the invoices and their numbering are carried in the file and never
   re-inserted (art. 242 nonies A CGI), the media is referenced by URL rather
   than duplicated, and the payment provider connections have to be
   re-authorised. `manifest.excludedTables` names every one, with a reason.

6. **Write down the date and the version.** Add a line to the deployment's
   `systemAuditLog` note, or to the fleet console's activity feed, saying which
   backup was restored and against which `deployedAppVersion`. A rehearsal
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
  it.

## Related

- [`aws-ownership.md`](./aws-ownership.md) — whose bucket the backup lands in,
  and why that is the honest limit of it
- [`s3-bucket-policy.md`](./s3-bucket-policy.md) — the lifecycle rule that
  expires `backups/` at 30 days
- `packages/convex-functions/src/backupTables.ts` — what is carried, what is
  archived, what is excluded, and why
