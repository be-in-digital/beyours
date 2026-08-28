---
"@be-in-digital/core": minor
---

Serve every folder the product uploads to

The bucket is private and `/api/files` is the only read path, so the proxy's
allowlist decides whether an uploaded object is reachable at all. That allowlist
derived from `ALLOWED_MIME_TYPES` (6 folders) while `convex/storageUpload.ts`
accepted 10. Uploads to `categories`, `blogs`, `blog-auto`, `storefront` and
`avatars` therefore succeeded, stored a `/api/files/<key>` URL, and that URL
returned 404 — the object was written and then unreachable. Category images in
the admin were the visible case.

- New `@be-in-digital/core/aws/folders` holds `S3_FOLDERS` and
  `isKnownS3Folder`. Like `aws/media-url`, it has no imports, so Convex actions
  can use it without pulling the package into their bundle.
- `S3Folder` now covers all eleven folders, and `ALLOWED_MIME_TYPES` and
  `MAX_FILE_SIZES` describe each one. `/api/files` picks the additions up
  automatically, since it derives `SERVABLE_FOLDERS` from that table.
- `convex/storageUpload.ts` and `/api/upload` derive their allowlists from the
  shared list instead of restating it, so the three cannot drift apart again.
  `/api/upload` previously rejected `email` and `categories` outright.
