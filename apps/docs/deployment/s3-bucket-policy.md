# S3 Bucket Access Policy

> Decision record. Settles the two contradictory access models that ship in the
> product today, tracked as **P0-34** (#158) and **S3-11**.

**Status:** Accepted — 2026-08-27
**Applies to:** `apps/reference`, `apps/themes`, and every client deployment cloned from them.
**Unblocks:** #158 (P0-34). That issue implements this decision; this document only decides it.

## Table of Contents

- [The problem](#the-problem)
- [Decision](#decision)
- [Prefix allowlist](#prefix-allowlist)
- [Why not a fully private bucket](#why-not-a-fully-private-bucket)
- [Why not a fully public bucket](#why-not-a-fully-public-bucket)
- [What this decision costs](#what-this-decision-costs)
- [Bucket configuration](#bucket-configuration)
- [Environment variables](#environment-variables)
- [Bugs this decision exposes](#bugs-this-decision-exposes)
- [Verification](#verification)

## The problem

Two opposite assumptions about the same bucket are written into the same product,
each one commented as fact:

| File                                         | Comment                                                                | Implies        |
| -------------------------------------------- | ---------------------------------------------------------------------- | -------------- |
| `apps/reference/convex/storageUpload.ts:119` | `// Public URL (bucket policy allows public reads)`                    | public bucket  |
| `apps/reference/app/api/upload/route.ts:120` | `// Return a proxy URL since the S3 bucket is not publicly accessible` | private bucket |

Both are live. Whichever model an operator picks in the AWS console, half the
product breaks — and it breaks silently, because nothing validates the assumption
at startup.

The split is not even: the public model carries almost everything the customer
sees. Sixteen copies of a `buildPublicUrl` helper — eight per app — build
`https://{bucket}.s3.{region}.amazonaws.com/{key}` and persist it into Convex
documents; the storefront, admin previews, blog content, OpenGraph tags and email
templates all read those absolute URLs back. The private model is used by exactly
one feature — customer avatars, uploaded through `POST /api/upload` and read back
through `GET /api/files/{key}`.

`apps/reference/scripts/setup-aws.sh:127-147` already resolves the contradiction
in one direction without saying so: it grants `s3:GetObject` to `Principal: "*"`
on five prefixes and leaves the rest of the bucket private. The rule that script
encodes has never been written down, so nothing keeps the code in step with it.

## Decision

**The bucket is private by default. Public read is granted by bucket policy to an
explicit allowlist of asset prefixes, never by ACL. Every other prefix stays
private and is served through an authenticated proxy.**

`AWS_S3_PUBLIC_BASE_URL` becomes **required**, so public assets are always served
from a CDN origin we control rather than from the raw S3 hostname.

This is the "public / CloudFront + `AWS_S3_PUBLIC_BASE_URL` required" option from
#176, narrowed: _public_ means a fixed list of prefixes, not the bucket.

Three rules follow, and they are the contract #158 implements:

1. A prefix is public **only** if it appears in the allowlist below. Public
   objects are addressed as `${AWS_S3_PUBLIC_BASE_URL}/${key}`.
2. Anything not on the allowlist is private, is never given a direct S3 URL, and
   is read only through `GET /api/files/{key}` — which must authenticate the
   caller and reject keys outside the private prefixes (audit item **S3-1**).
3. Public read is granted by **bucket policy only**. `BlockPublicAcls` and
   `IgnorePublicAcls` stay `true`; no upload ever sets an ACL.

## Prefix allowlist

This table is the single source of truth. Three different allowlists exist in the
code today and none of them matches this one — reconciling them is part of #158.

| Prefix        | Visibility | Contents                   | Read path                     |
| ------------- | ---------- | -------------------------- | ----------------------------- |
| `products/`   | public     | dish and menu photos       | `AWS_S3_PUBLIC_BASE_URL`      |
| `categories/` | public     | category images            | `AWS_S3_PUBLIC_BASE_URL`      |
| `cms/`        | public     | media library, blog covers | `AWS_S3_PUBLIC_BASE_URL`      |
| `branding/`   | public     | logos, favicons            | `AWS_S3_PUBLIC_BASE_URL`      |
| `stores/`     | public     | storefront photos          | `AWS_S3_PUBLIC_BASE_URL`      |
| `storefront/` | public     | storefront page assets     | `AWS_S3_PUBLIC_BASE_URL`      |
| `blogs/`      | public     | blog images                | `AWS_S3_PUBLIC_BASE_URL`      |
| `blog-auto/`  | public     | generated blog images      | `AWS_S3_PUBLIC_BASE_URL`      |
| `email/`      | public     | images embedded in emails  | `AWS_S3_PUBLIC_BASE_URL`      |
| `avatars/`    | private    | customer profile pictures  | `/api/files/` (authenticated) |
| `users/`      | private    | customer uploads           | `/api/files/` (authenticated) |

Everything a restaurant publishes is public: it is marketing material, and it is
meant to be fetched by browsers, social crawlers and mail clients that will never
hold a credential. Everything a _customer_ uploads about themselves is private.

Public does not mean listable. `s3:ListBucket` is **not** granted, and every key
ends in a `crypto.randomUUID()`, so an object nobody links to cannot be
enumerated or guessed. That is unguessable-URL secrecy, not confidentiality — which
is exactly why anything needing a real guarantee belongs on a private prefix.

> **Correction to P0-34's acceptance criterion.** #158 asks that "an unreferenced
> object is not anonymously readable". For public prefixes that is not achievable
> and not desirable: a menu photo must be readable by an anonymous browser the
> moment it is uploaded. The criterion holds for private prefixes, and for public
> ones it is replaced by: the bucket cannot be listed, and no prefix outside the
> allowlist is readable.

## Why not a fully private bucket

The audit recommended private bucket + authenticated proxy everywhere. It cannot
work as stated, for four independent reasons:

1. **OpenGraph images.** `apps/reference/lib/seo.ts:57` and
   `apps/reference/lib/cms/seo.ts:38` emit asset URLs into `og:image`. Facebook,
   X, WhatsApp and Google fetch those anonymously. Behind an authenticated proxy
   every social preview breaks.
2. **Email images.** `packages/admin/src/pages/email/templates/block-config-panel.tsx`
   uploads to the `email/` prefix and embeds the result in campaign HTML. Mail
   clients cannot authenticate, and cannot resolve a relative `/api/files/...`
   path at all.
3. **The Next.js image optimizer** fetches `images.remotePatterns` hosts
   server-side and unauthenticated (`apps/reference/next.config.ts:36-39`). Every
   `next/image` render of a private object returns 400.
4. **The upload path already requires CORS.** The CMS and admin uploaders PUT
   straight from the browser to S3 using a presigned URL
   (`apps/reference/convex/storageUpload.ts:112-117`), which mandates bucket CORS —
   contradicting `apps/reference/app/api/upload/route.ts:37` ("No CORS config
   needed on the S3 bucket").

On top of that it is the expensive direction: sixteen `buildPublicUrl` copies to
remove, absolute URLs already persisted in Convex documents to migrate, and every
image byte routed through a Next.js function.

It is worth naming what the private model does _not_ buy today, because it is the
reason it looks safer than it is: `GET /api/files/{key}` has no authentication and
no prefix restriction (`apps/reference/app/api/files/[...key]/route.ts:19-33`).
Its only guard is `key.includes("..")`. As shipped, it serves **any** object in the
bucket to **anyone** — a wider hole than the bucket policy it was meant to replace.

## Why not a fully public bucket

Granting `s3:GetObject` on `arn:aws:s3:::{bucket}/*` would be simpler and is
tempting given that the public prefixes carry most of the traffic. Rejected
because:

- Customer avatars and any future customer upload would become world-readable.
- Every prefix added later would be public by default, silently. An allowlist
  fails closed; a wildcard fails open.

## What this decision costs

- Serving public assets from a CDN origin means provisioning one distribution per
  client deployment, or one shared distribution with a per-client path or
  hostname. That is real per-client setup work, and it is the price of keeping the
  raw S3 hostname out of the product.
- Until a CDN is in place, `AWS_S3_PUBLIC_BASE_URL` may point at the bucket's own
  public URL. The variable stays required so the host is always explicit and
  changing it later is a config edit rather than a data migration.

## Bucket configuration

Public access block — ACLs blocked, policy-based reads allowed:

```json
{
  "BlockPublicAcls": true,
  "IgnorePublicAcls": true,
  "BlockPublicPolicy": false,
  "RestrictPublicBuckets": false
}
```

Bucket policy — one statement, one resource per public prefix, no wildcard over
the bucket root:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadAssets",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": [
        "arn:aws:s3:::BUCKET/products/*",
        "arn:aws:s3:::BUCKET/categories/*",
        "arn:aws:s3:::BUCKET/cms/*",
        "arn:aws:s3:::BUCKET/branding/*",
        "arn:aws:s3:::BUCKET/stores/*",
        "arn:aws:s3:::BUCKET/storefront/*",
        "arn:aws:s3:::BUCKET/blogs/*",
        "arn:aws:s3:::BUCKET/blog-auto/*",
        "arn:aws:s3:::BUCKET/email/*"
      ]
    }
  ]
}
```

`s3:ListBucket` is deliberately absent. `avatars/` and `users/` are deliberately
absent.

CORS is required by the presigned-PUT upload flow. Replace the origins with the
client's real domains — the shipped default in `setup-aws.sh` allows
`https://*.beindigital.fr`, which is not a client domain:

```json
[
  {
    "AllowedHeaders": ["Content-Type"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedOrigins": ["https://CLIENT_DOMAIN"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

The shipped CORS rule allows `DELETE` and `POST` from the browser and every
header; neither is used by any upload path in the product.

## Environment variables

| Variable                 | Required | Description                                               |
| ------------------------ | -------- | --------------------------------------------------------- |
| `AWS_S3_BUCKET_NAME`     | Yes      | Restaurant's S3 bucket                                    |
| `AWS_S3_PUBLIC_BASE_URL` | **Yes**  | CDN origin serving the public prefixes, no trailing slash |

`AWS_S3_PUBLIC_BASE_URL` is read by six Convex actions per app but is absent from
`packages/core/src/env/schemas.ts`, absent from `apps/themes/.env.convex.example`,
and blank in both `.env.example` files. It must be added to the Convex env
template and to the startup validation, and — because the consumers run inside
Convex — it must be set on the **Convex deployment**, not only on Vercel.

Until it is validated, the fallback in `buildPublicUrl` silently writes raw
`https://{bucket}.s3.{region}.amazonaws.com/...` URLs into the database
permanently. That is not recoverable by setting the variable later.

## Bugs this decision exposes

These are consequences of the policy never having been written down. They belong
to #158, and this document lists them so that issue has a checklist.

1. **Three divergent folder allowlists**, none matching the bucket policy:

   | Source                                         | Folders                                                                                   |
   | ---------------------------------------------- | ----------------------------------------------------------------------------------------- |
   | `apps/reference/convex/storageUpload.ts:10-21` | products, branding, stores, cms, email, avatars, blogs, blog-auto, storefront, categories |
   | `packages/core/src/aws/types.ts:43`            | products, branding, stores, cms, email, users                                             |
   | `apps/reference/app/api/upload/route.ts:13`    | products, branding, stores, cms, users                                                    |
   | `apps/reference/scripts/setup-aws.sh:139-143`  | cms, products, branding, stores, email                                                    |

2. **Category images are broken on any bucket built by `setup-aws.sh`.**
   `packages/admin/src/pages/categories/category-form.tsx:165` uploads to
   `categories/`, receives a direct S3 URL, and persists it to `imageUrl` — but
   `categories/` is not in the bucket policy, so every category image returns 403.
   The same holds for `blogs/`, `blog-auto/` and `storefront/`.

3. **Two URL shapes in one database.** `userProfiles.avatarUrl` holds a relative
   `/api/files/...`; `cmsMedia.sourceUrl` holds an absolute `https://...`. Any
   consumer treating them uniformly — `next/image`, OG tags, email HTML — breaks
   on one of them.

4. **Two `buildPublicUrl` dialects.** Six copies per app honour
   `AWS_S3_PUBLIC_BASE_URL`; `storageUpload.ts:54` and `cmsSeed.ts:26` hardcode
   the raw S3 host, so pointing the product at a CDN would silently miss the
   entire non-CMS upload surface.

5. **`avatars/` uploads take the public path.** `storageUpload.ts` allows the
   `avatars` folder and returns a direct S3 URL for it, contradicting this
   decision's private classification. Avatars must route through `/api/upload`.

6. **`users/` and `avatars/` are two names for one thing.** Pick one; this
   document keeps both only to describe what exists.

7. **The S3 host must leave `remotePatterns`** once
   `AWS_S3_PUBLIC_BASE_URL` is required — `apps/reference/next.config.ts:38`
   whitelists `**.s3.eu-west-3.amazonaws.com`, which lets any bucket in the region
   be proxied by the image optimizer.

8. **`GET /api/files` must be authenticated and prefix-restricted** before it can
   be the read path for private objects (**S3-1**).

9. **`apps/docs/api-reference/rest-api.md:70`** documents `POST /api/upload` as
   returning a direct S3 URL; it returns `/api/files/{key}`.

## Verification

A deployment satisfies this decision when all four hold:

```bash
# 1. A public asset is readable anonymously through the CDN origin.
curl -sI "$AWS_S3_PUBLIC_BASE_URL/products/<uuid>.webp" | head -1   # 200

# 2. A private prefix is NOT readable anonymously, by either route.
curl -sI "https://$BUCKET.s3.$REGION.amazonaws.com/avatars/<uuid>.webp" | head -1   # 403
curl -sI "https://<site>/api/files/avatars/<uuid>.webp" | head -1                   # 401

# 3. The bucket cannot be listed.
curl -sI "https://$BUCKET.s3.$REGION.amazonaws.com/" | head -1      # 403

# 4. No prefix outside the allowlist is readable.
curl -sI "$AWS_S3_PUBLIC_BASE_URL/invoices/probe.txt" | head -1     # 403
```

And, in a browser on a fresh deployment: upload an image in the CMS media
library, place it on a storefront page, and confirm it renders for a logged-out
visitor.

## References

- #176 — the decision this document records
- #158 (P0-34) — the implementation that depends on it
- `tasks/sprint-durcissement-reference.md` — **S3-1**, **S3-2**, **S3-8**, **S3-11**
- `apps/reference/scripts/setup-aws.sh` — bucket provisioning
- [Environment Variables Reference](./environment-variables.md)
