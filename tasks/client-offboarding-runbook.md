# Runbook — Offboarding a client

> What to revoke when a restaurant leaves, and in what order. The console's
> **Sorti** status records the decision; it revokes nothing. This file is the
> other half. It contains **no credential**.

## Why there is a runbook at all

`saFleet.updateStatus` patches `status: "offboarded"` and writes an activity
row. That is the whole of it — no key rotation, no teardown, no access
revocation. A departed client's deployment keeps every credential it was
provisioned with, including, today, the fleet-wide AWS keys that
`apps/themes/scripts/env.mjs` pushes into every client's Convex deployment.

So the console now distinguishes two dates: `offboardedAt` (we marked them
gone) and `accessRevokedAt` (they can no longer reach anything). Until the
second is set, the deployment page shows **Accès non révoqués**. Work this list,
then tick it.

## Order matters

**Hand over before you revoke.** Every step below removes an access that is also
the access you need to perform the handover. Revoke your own Convex admin before
transferring the project and nobody can transfer it; rotate the AWS key before
copying the client's media out and you cannot read it to copy.

So: **export and transfer first, revoke second, tick last.**

## 1. Hand over what is theirs

- [ ] **Data export** — Système → Sauvegarde in their admin produces
      `backup-YYYY-MM-DD.json`. Note that it carries **references and URLs, not
      the S3 objects** (`backup-section.tsx:154`), so the media is a separate
      step.
- [ ] **Media** — copy their objects out of the bucket. Under the shared-bucket
      model their files sit in fleet-wide prefixes (`products/`, `branding/`,
      `stores/`, `cms/`, `blog/`) mixed with other clients', so this is a
      selective copy, not a bucket handover. Per-client buckets
      ([`aws-ownership.md`](../apps/docs/deployment/aws-ownership.md)) are what
      make this a one-liner instead.
- [ ] **Repository** — a snapshot at the version their contract entitles them to.
- [ ] **Convex** — transfer the project to their team rather than exporting and
      rebuilding. The transfer preserves deployments, URLs, environment
      variables, data and deploy keys; a rebuild re-wires everything.

## 2. Revoke

- [ ] **AWS.** Under the current shared model the deployment holds the
      fleet-wide `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`.

      > ⚠️ Rotating that key logs out **every** client at once. `setup-aws.sh`
      > offers to delete the existing access keys and create new ones — saying
      > yes there invalidates the credentials of every deployed site, and each
      > one needs the new value pushed to its Convex deployment before it works
      > again. Do not do it casually, and never mid-service.

      Once each client has its own AWS account (#200), this step becomes
      "delete that client's IAM user", which affects nobody else. Until then,
      decide deliberately between rotating the fleet key and accepting that the
      departed deployment retains it.
- [ ] **GitHub** — remove their access to the repository and to the private
      registry. `apps/themes/scripts/lib/maintenance.mjs` is candid that this,
      not the licence check, is the real freeze: that check **fails open**.
- [ ] **Licence key** — deregister it from `saDeployments`, so maintenance
      status stops answering for them. Note `http.ts` answers
      `entitled: true, reason: "unregistered"` for unknown keys, so removing a
      key does not block anything by itself (see #181).
- [ ] **Vercel** — the project lives in the BeYours account, which stays
      mutualised by design. It has to be transferred or deleted; it will not
      follow them on its own. This is usually the last thing anyone remembers.
- [ ] **Convex** — remove BeYours members from their team, *after* the transfer
      in step 1.
- [ ] **Third-party accounts they own** — Stripe, Sentry, Google Maps. Nothing
      to revoke; confirm the keys in their deployment are theirs and not yours.

## 2 bis. Erase what they asked you to erase

A departure and an erasure request are different jobs. This section is the
second one, and it is the one where "the row is gone" has, until now, not meant
"the file is gone".

- [x] **A media deleted from the library takes its S3 objects with it.**
      `cmsMedia.deleteMedia` schedules `cmsMediaDelete.purgeS3Objects`, which
      removes the source and every generated variant (`thumb`, `card`, `og`).
      Before this, `DeleteObjectCommand` appeared nowhere in the repository: the
      admin reported "définitivement supprimé" and deleted a database row. If
      you have ever told a client a deleted photograph was gone, it was not —
      files deleted before this landed are still in the bucket and have to be
      removed by hand.
- [ ] **Deleting the *établissement* does not.** `storeCascade` drops the
      `cmsMedia` rows for a store in bulk and never touches S3, so a store
      deletion still orphans every object it owned. Under the shared-bucket
      model those objects sit under `cms/<mediaId>/…`, and once the rows are
      gone there is nothing left to enumerate them from. **If an erasure request
      covers a whole establishment, export the media keys before deleting the
      store**, or delete the media from the library first and the store second.
- [ ] **Objects written by the other upload route** (`/api/upload` →
      `products/`, `branding/`, `stores/`, `users/`) are referenced by URL from
      product and profile rows, not by a media record. Deleting the row that
      points at one leaves the object. These are per-file, by hand, from the
      URLs in the export.

## 3. Close it out

- [ ] Set the deployment to **Sorti** in the fleet console, if not already.
- [ ] Click **J'ai révoqué les accès** on the deployment page. This is an
      attestation, not a measurement — the backend cannot verify that an IAM key
      is gone. Its only job is that an unticked departure stays visibly
      unfinished.

## What is still not automated

Stated plainly, so nobody reads the tick as a guarantee:

| | Enforced by code? |
|---|---|
| The deployment is marked gone | yes |
| Revocation is recorded as outstanding until ticked | yes |
| Deleting one media deletes its S3 objects | yes |
| Deleting an establishment deletes its S3 objects | **no — rows only, see 2 bis** |
| The credentials are actually revoked | **no — this list, by hand** |
| The tick is verified against reality | **no — it is an attestation** |

---

*Related: [`client-aws-onboarding-runbook.md`](./client-aws-onboarding-runbook.md)
(the other end of the lifecycle), [`aws-ownership.md`](../apps/docs/deployment/aws-ownership.md) (one AWS
account per client), issue #199 (this gap), #200 (per-client AWS), #181 (licence
keys).*
