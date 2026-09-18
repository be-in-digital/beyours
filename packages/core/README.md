# `@be-yours/core`

The shared services: authentication rules, i18n, AWS (S3 and SES), the email
transport, environment validation and Sentry.

`4.1.0` · 44 source files · 9,812 lines · shipped as `dist/` (tsup)

---

## Entry points

| Subpath | Holds |
| --- | --- |
| `.` | The package root — **everything below is reachable from here** |
| `./env` | The environment schemas |
| `./email` | The transport-agnostic email service |
| `./email/providers` | The SES / Resend decision. Imports no AWS SDK |
| `./auth/rbac` | Roles and permissions |
| `./aws/folders` | The S3 folder allow-list. **Import-free on purpose** |
| `./aws/media-url` | Media URL resolution. Import-free on purpose |
| `./aws/ses/order-confirmation` | The order-confirmation template |
| `./allergens` · `./dining` · `./status-labels` | Domain vocabularies |
| `./sentry` | Sentry wiring |

There is **no `./aws/s3` and no `./aws/ses` subpath.** The two `./aws/*` paths
that exist are deliberately import-free so a Convex isolate can pull them in on
their own.

---

## AWS: factories over an injected client

There is **no `uploadToS3`, no `sendEmail` and no `sendTemplatedEmail` free
function.** Those three names were documented for a long time and never existed.
Both services are factories over an AWS client you build and inject — that is
what makes them testable, and what keeps the package loadable from the Convex
runtime.

`packages/core` therefore has **no `@aws-sdk/client-s3` dependency at all**. Its
one SDK dependency is `@aws-sdk/client-sesv2`, imported only by the SES adapter.

### S3

```ts
import { createS3Service, S3_FOLDERS } from "@be-yours/core"

const s3 = createS3Service(config, client) // `client` is your S3Operations adapter
const { key, url } = await s3.upload(buffer, {
  folder: "products",
  contentType: "image/webp",
})
// also: getPresignedUploadUrl, getPresignedDownloadUrl, delete,
//       getPublicUrl, exists, getMetadata
```

Folders are a **closed set of eleven**, declared once in `src/aws/folders.ts`:
`products`, `categories`, `cms`, `branding`, `stores`, `storefront`, `blogs`,
`blog-auto`, `email`, `avatars`, `users`. Everything else derives from it — the
Zod schema `upload()` parses through, the MIME and size tables, and the
`/api/files` allowlist. **Add a folder there and nowhere else.**

> This list, and `s3FolderSchema` itself, used to name six. `S3_FOLDERS` is
> where the `S3Folder` type comes from, so all eleven type-checked — and then
> `s3.upload(file, { folder: "categories" })` threw at
> `uploadOptionsSchema.parse()`. That is exactly how category, blog and
> storefront images were lost. The schema is now `z.enum(S3_FOLDERS)`, so the
> two cannot disagree again.

The HTTP route `apps/*/app/api/upload/route.ts` deliberately accepts only
**five** of the eleven; the rest are written by the presigned Convex flow,
authorised separately. That narrowing is a security boundary, not drift — do not
widen it to match.

The bucket is private either way: reads go through the app's `/api/files` proxy,
and `getPublicUrl` returns that proxy or the CDN, never a direct S3 URL.

### SES

```ts
import { createSESService, createSESv2Operations, getSESService } from "@be-yours/core"

const ses = createSESService(config, createSESv2Operations(awsConfig))
// or, server-side, read the config from the environment:
const ses = getSESService()

await ses.sendEmail({ to, subject, html })   // the field is `html`, not `htmlBody`
await ses.sendTemplatedEmail({ to, templateName, templateData })
await ses.sendBulkEmail({ ... })             // rate-limited to the SES sandbox ceiling
```

`sendEmail` and `sendTemplatedEmail` are **methods on the service instance**
(`src/aws/ses/client.ts:38,45`), not module-level functions.

### How transactional mail actually leaves the product

Convex has no SES credentials for the password-reset path, so it POSTs to the
app's own `/api/email/send` — which is `createEmailRouteHandler({ secret,
linkOrigin })` from this package. That handler calls `getEmailService()`
(`getSESService` is a deprecated alias). The two halves share one secret,
`EMAIL_API_SECRET` (with `BETTER_AUTH_SECRET` as a transitional fallback), and
must present the same one.

Campaigns, automations, invitations, order confirmations and migration notices
are the exception: they run in Convex Node actions and send from there.

### SES is the default transport, not the only one

`EMAIL_PROVIDER=resend` points a whole deployment at Resend instead — both
halves. Every client owns its AWS account and files its own SES production-access
request, approval is not guaranteed, and one has been refused; such a client
could not send at all.

The decision lives in `src/email/providers.ts`, which imports no AWS SDK: SES is
the injected `SESOperations`, Resend is plain `fetch`, and both go through
`createSESService` — so validation, rate limiting and bulk batching are the same
either way.

An unknown provider name is **refused rather than falling back to SES**.
`resolveEmailProvider` returns a refusal the caller surfaces; **it does not
throw**, so do not go looking for one.

Set `EMAIL_PROVIDER`, `RESEND_API_KEY` and `RESEND_FROM_EMAIL` on both the
Next.js env and the Convex deployment. Resend has no configuration sets, so a
client who moves loses open/click tracking, not their mail.

---

## i18n — GPT translation

```ts
import { translateText, batchTranslate, estimateTranslationCost } from "@be-yours/core"

// One string. `context` steers the model; the rest have defaults.
await translateText(text, "en", "fr", "product name", httpClient, apiKey)

// Many strings. httpClient and apiKey are REQUIRED here.
await batchTranslate(items, "en", "es", httpClient, apiKey)
```

There is no `translateWithGPT` — the function is `translateText`. `httpClient`
is injected for the same reason the AWS services inject theirs.

Cost: roughly $0.001 per product, $0.01 per page (`estimateTranslationCost`).

The engine's own auto-translation pipeline is separate and lives in
`@be-yours/convex-functions/autoTranslate`.

---

## Environment

`src/env/schemas.ts` is the source of truth, and each app's
`instrumentation.ts` enforces it at boot. The block that decides what a
deployment refuses to start without is `siteRequiredShape`, and it holds
**ten** entries. Count the block, not a copied list — a line range is exactly
what goes stale.

`OPENAI_API_KEY` is declared **optional**: a deployment does boot without one,
it simply has no AI features.

---

## Commands

| Command | Effect |
| --- | --- |
| `pnpm build` | tsup → `dist/` |
| `pnpm dev` | tsup in watch mode |
| `pnpm lint` · `pnpm type-check` | Quality |
| `pnpm test` · `pnpm test:watch` · `pnpm test:coverage` | Vitest |
| `pnpm clean` | Remove `dist/` and `node_modules` |

> This package is consumed **from `dist/`**. Editing `src/` changes nothing in a
> running app until you rebuild.

---

[Root README](../../README.md)
