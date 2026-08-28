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
[`@be-in-digital/core/aws/media-url`](../../../packages/core/src/aws/media-url.ts).

| `AWS_S3_PUBLIC_BASE_URL` | URL handed to the browser | Who reads S3 |
|---|---|---|
| unset (default) | `/api/files/<key>` | the app, with the deployment's credentials |
| set to a CDN origin | `<base>/<key>` | CloudFront, via an origin access control |

Both forms work on a fresh deployment with no bucket policy at all. The direct
S3 endpoint form is gone, and nothing should reintroduce it.

## Configuring the bucket

**Block all public access** — the AWS default — and attach no bucket policy
granting `s3:GetObject` to `*`. The deployment's IAM user needs
`s3:GetObject`, `s3:PutObject` and `s3:DeleteObject` on `arn:aws:s3:::<bucket>/*`.

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
  [`@be-in-digital/core/aws/folders`](../../../packages/core/src/aws/folders.ts),
  and every upload path derives its allowlist from it. Anything else in the
  bucket is not reachable through the app.

  Keep it that way. The proxy is the only read path, so a folder that an upload
  accepts but this list omits yields a URL that 404s — the object is written and
  then unreachable. That is what happened to `categories`, `blogs`, `blog-auto`,
  `storefront` and `avatars`, which `convex/storageUpload.ts` accepted while the
  proxy refused them.

## Related

- Issues [#158](https://github.com/be-in-digital/beyours/issues/158) (P0-34) and
  [#176](https://github.com/be-in-digital/beyours/issues/176) (LANCEMENT-05).
- [Environment variables](./environment-variables.md)
- Hardening of the proxy's `Content-Type` handling and of the upload role check
  is tracked separately in
  [#151](https://github.com/be-in-digital/beyours/issues/151) (P0-27).
