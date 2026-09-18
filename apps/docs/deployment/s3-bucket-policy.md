# S3 Bucket Policy

> **Decision: the bucket is private.** No object in it is readable without
> credentials. Uploaded media reaches the browser through the app's own
> `/api/files` proxy, or through a CDN that fronts the bucket.

## Why this had to be settled

The product used to hold both answers at once. Sixteen Convex files built
`https://<bucket>.s3.<region>.amazonaws.com/<key>` under the comment *"bucket
policy allows public reads"*, while the Next.js upload route returned
`/api/files/<key>` under the comment *"the S3 bucket is not publicly
accessible"*. Whichever policy an operator applied, half the product broke:

- **Private bucket** → every CMS, blog and product image answered `403`, with
  no error surfaced anywhere. The image simply did not appear.
- **Public bucket** → every uploaded file was readable by URL, by anyone, with
  no authentication and no way to revoke it.

Private wins because the second failure is not recoverable. A public bucket
turns any upload — including one from a hostile account — into a permanently
hosted, world-readable file.

## What that means in practice

A stored S3 key becomes a URL in exactly one place: `buildMediaUrl()` in
[`@be-yours/core/aws/media-url`](../../../packages/core/src/aws/media-url.ts).

| `AWS_S3_PUBLIC_BASE_URL` | URL handed to the browser | Who reads S3 |
|---|---|---|
| unset (default) | `/api/files/<key>` | the app, with the deployment's credentials |
| set to a CDN origin | `<base>/<key>` | CloudFront, via an origin access control |

Both forms work on a fresh deployment with no bucket policy at all. The direct
S3 endpoint form is gone, and nothing should reintroduce it.

## Configuring the bucket

**Block all public access** — the AWS default — and attach no bucket policy
granting `s3:GetObject` to `*`. The deployment's IAM user needs
`s3:GetObject`, `s3:PutObject` and `s3:DeleteObject` on `arn:aws:s3:::<bucket>/*`,
plus the three version permissions the next section explains.

`scripts/setup-aws.sh` does this for you, and since #198 it also **removes** a
public-read policy left by an earlier run of itself. It only deletes a policy
that grants to `*` with `Effect: Allow` — a CloudFront origin access control, or
a `Deny` on insecure transport, is recognised and left alone.

CORS is only needed for the presigned-`PUT` upload path (the CMS media
library), and only for `PUT`:

```json
[
  {
    "AllowedOrigins": ["https://your-site.example"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["content-type"],
    "MaxAgeSeconds": 3000
  }
]
```


## Versioning, and what it does to a delete

`setup-aws.sh` turns bucket **versioning** on. That is worth having — a client
who overwrites the wrong photograph can be given the old one back — and it
changes what a delete means, in a way that is easy to get wrong and was:

> On a versioned bucket, `DeleteObject` **without a `VersionId` deletes
> nothing.** It writes a *delete marker* over the key. Every prior version stays
> in the bucket: still billed, still readable by anyone who can name a version
> id, and invisible to an ordinary listing.

So the media library said « définitivement supprimé », the offboarding runbook
ticked an erasure box, and every byte was still there. Issue
[#331](https://github.com/be-yours/beyours/issues/331).

Three things close that, and all three are applied by `setup-aws.sh`:

1. **The app purges by version id.** `convex/cmsMediaDelete.ts` lists a key's
   versions and deletes each one, delete markers included — a marker *is* a
   version, so removing only the object versions leaves the key hidden with its
   marker still billed, and removing only the marker un-deletes the file. That
   file talks to the AWS SDK directly, and it is the only media-deletion path
   the delivered app runs.

   `S3Service.delete` in `@be-yours/core` carries the same logic for a
   **consumer of the package** — nothing in `apps/*` calls it. And it purges
   only when the `S3Operations` adapter you injected implements
   `listObjectVersions` and `deleteObjectVersion`, which are optional on the
   interface: without them it writes the delete marker and returns
   `{ outcome: 'delete-marker', reason: 'unsupported-adapter' }`. The adapter in
   `packages/core/src/aws/README.md` implements both — copy that one.
2. **Three IAM actions**, without which the app can only write markers:
   `s3:ListBucketVersions` (on the bucket), `s3:GetObjectVersion` and
   `s3:DeleteObjectVersion` (on `/*`). A deployment provisioned before these
   were added falls back to a delete marker and says so — `purgeS3Objects`
   returns `deleteMarkersOnly > 0` and logs the permission names. Re-run the
   script for that client.
3. **Two lifecycle rules**, as the floor under both:

   | Rule | What it collects |
   |---|---|
   | `NoncurrentVersionExpiration` — 30 days, keep the newest 3 | versions of a file that was overwritten rather than deleted, and anything a purge could not reach |
   | `ExpiredObjectDeleteMarker` | the marker left over a key whose versions have all expired |

   Neither substitutes for the other. Expiring the versions alone leaves the
   marker; expiring the marker alone makes the newest remaining version current
   again — i.e. un-deletes the file.

   30 days rather than 1 because versioning is also an accident-recovery
   control. An erasure *request* is not served by waiting: the app purges by
   version id for that, and `NewerNoncurrentVersions: 3` keeps the window from
   meaning "hold 400 revisions of a logo for a month".

**The rules only count from the day they are applied.** Anything deleted on a
bucket that predates them is still there, as a noncurrent version behind a
marker. `tasks/client-offboarding-runbook.md` carries the by-hand check.

## Adding a CDN (optional)

Serving media through the app is correct but not free — every image is a
Node request. Sites with real traffic should put CloudFront in front of the
bucket:

1. Create a CloudFront distribution with the bucket as origin.
2. Attach an **origin access control**, and let CloudFront update the bucket
   policy to allow only that distribution. The bucket stays closed to the
   public internet.
3. Set `AWS_S3_PUBLIC_BASE_URL` to the distribution origin, e.g.
   `https://cdn.your-site.example` — no trailing slash, no path unless the
   distribution serves the bucket under one.

The host is picked up automatically by `next.config.ts` for `next/image`; it
does **not** go in `remoteHosts` in `apps/themes/site.config.ts`, which is for
third-party image hosts only.

Existing rows keep working either way: `mediaKeyFromUrl()` recognises the proxy
path, the CDN form, and the direct S3 endpoint written before this decision, so
turning a CDN on or off does not require a data migration.

## Things that follow from a private bucket

Worth knowing before writing code that touches media:

- **Never hand a stored URL to a third party that fetches it itself.** OpenAI's
  vision API fetches `image_url` from its own servers, so
  `convex/imageToProduct.ts` and `convex/cmsAltText.ts` read the bytes with the
  AWS SDK and inline them as a `data:` URL instead.
- **Email needs absolute URLs.** With no CDN, media is stored as a
  root-relative path that no mail client can resolve. `renderTemplateToEmailHtml`
  takes a `siteUrl` and rewrites those paths — see `absolutiseUrls`.
- **`/api/files` only serves the folders the product uploads to.** That list is
  defined once, in
  [`@be-yours/core/aws/folders`](../../../packages/core/src/aws/folders.ts),
  and every upload path derives its allowlist from it. Anything else in the
  bucket is not reachable through the app.

  Keep it that way. The proxy is the only read path, so a folder that an upload
  accepts but this list omits yields a URL that 404s — the object is written and
  then unreachable. That is what happened to `categories`, `blogs`, `blog-auto`,
  `storefront` and `avatars`, which `convex/storageUpload.ts` accepted while the
  proxy refused them.
- **Two of those folders need a session to read.** `users/` and `avatars/` hold
  what an account holder uploaded about themselves; the other nine hold the
  restaurant's own published media, which a storefront visitor with no session
  has to be able to render. The split is declared as `PRIVATE_S3_FOLDERS` beside
  the folder list, and `GET /api/files` refuses a private key to an anonymous
  caller with a 404 — the same answer as a key that does not exist, so the
  refusal leaks nothing.

  Their responses carry `Cache-Control: private, no-store` rather than the
  year-long `public, immutable` the storefront's media gets. That is not a
  detail: a `public` response invites any shared cache — a CDN, a corporate
  proxy — to keep the bytes and hand them to the next caller, who has no
  session, which would undo the gate entirely.

  The gate is *signed in*, not *signed in as the owner*. Keys are a flat
  `users/<uuid>.<ext>` with no account in them, so ownership cannot be decided
  from the request; it would need a new key shape and a migration of the objects
  already stored. What it buys is that a leaked URL stops being a credential.

  **A CDN in front of the bucket bypasses this.** Deployments that set
  `AWS_S3_PUBLIC_BASE_URL` never reach the proxy, so the gate does not apply —
  configure the CDN to refuse those two prefixes, or leave the variable unset.

## Related

- Issues [#158](https://github.com/be-yours/beyours/issues/158) (P0-34) and
  [#176](https://github.com/be-yours/beyours/issues/176) (LANCEMENT-05).
- The `users/` and `avatars/` gate is
  [#188](https://github.com/be-yours/beyours/issues/188), decided as
  option 2 (prefix split) of the three that issue offered.
- [Environment variables](./environment-variables.md)
- Hardening of the proxy's `Content-Type` handling and of the upload role check
  is tracked separately in
  [#151](https://github.com/be-yours/beyours/issues/151) (P0-27).
