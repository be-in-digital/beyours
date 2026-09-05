---
"@be-in-digital/core": patch
---

Stop the upload schema refusing five folders the type says are valid

`S3_FOLDERS` declares eleven folders and is documented as "the single source of
truth". `s3FolderSchema` restated six of them by hand, and `upload()` and
`getPresignedUploadUrl()` both parse their options through it. So this compiled
and threw:

```ts
createS3Service(config, client).upload(file, { folder: "categories" })
```

Measured across the declared set: `categories`, `storefront`, `blogs`,
`blog-auto` and `avatars` were refused by both methods — the five the earlier
proxy fix was about. Their MIME and size tables had been extended to eleven, the
`/api/files` allowlist derives from those tables, and `convex/storageUpload.ts`
allows all eleven; only the Zod enum was left behind.

Nothing shipped calls those methods today — the two live upload paths are the
HTTP route and the Convex presigned flow, and neither goes through `S3Service`
— so this was a trap rather than an outage. But `CLAUDE.md` and the MCP registry
both present `createS3Service(...).upload()` as the way to upload, so a
developer following the documented API for a category image got a runtime throw
with a type that said it was fine.

The enum now derives from `S3_FOLDERS`, which makes the drift unrepresentable,
and a test asserts the two agree — it fails against the hand-written list.

The HTTP route's five-folder allowlist is untouched: that one is a deliberate
security boundary (the rest are written by the presigned flow under its own
authorisation), documented as such at the narrowing site.
