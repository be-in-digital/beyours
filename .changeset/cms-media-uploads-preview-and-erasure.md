---
"@be-in-digital/convex-functions": major
"@be-in-digital/cms": minor
---

Refuse the uploads a CMS should refuse, delete what deletion promises, and let the preview render

Four faults in the same library, each of which had a control that looked like it
was doing the work.

**The upload path accepted anything.** `createMedia` declared `mimeType`, `kind`
and `size` and validated none of them: measured, it accepted `text/html` and a
5 GB SVG. `validateMediaUpload` existed, had a full test suite, and was imported
in exactly two places — both browser components. The client was doing the
checking and the client is not the security boundary; `createMedia`,
`getPresignedUrlForMedia` and `confirmUpload` are public Convex functions and a
browser is not their only caller. An upload path that accepts HTML is stored
XSS, so this was treated as security work.

`createMedia` now refuses anything the allow-list does not name, and re-uses
`validateMediaUpload` rather than growing a second list beside it. The list
gained what it was missing: the extension must agree with the MIME type, SVG is
capped at 1 MB — the ceiling `cmsSvgUpload` already applied on its own route —
and a negative or non-finite size is refused. `kind` is checked against the MIME
type as well, because it is a separate caller-chosen argument and it is what
`confirmUpload` branches on. Both later steps re-validate, since rows written
before this guard still hold whatever they were given.

**An unsanitised SVG could reach `status: "ready"`.** `confirmUpload` routed
`image/svg+xml` around sharp straight to `setMediaReady` — measured returning
`{"status":"ready"}` for an SVG carrying `<script>alert(document.cookie)</script>`
and `onload=`. It now reads the object back and inspects it: active content
means the S3 object is deleted and the record fails with `SVG_ACTIVE_CONTENT`. A
clean SVG is rewritten with `ContentDisposition: attachment`, so its inertness
travels with the object rather than depending on the `/api/files` proxy — a
deployment with `AWS_S3_PUBLIC_BASE_URL` set bypasses that proxy entirely.

**Deleting media did not delete the file.** `deleteMedia` removed the Convex row
and nothing else; `DeleteObjectCommand` appeared nowhere in the repository, so
no GDPR erasure request could be satisfied and the admin dialog's "sera
définitivement supprimé" was false. The keys are now collected before the row
goes — variants derived from the `s3Key` prefix, exactly inverting what
`processImage` writes, and legacy URL-only rows recovered through a resolver
that refuses a URL belonging to another deployment — and a `purgeS3Objects`
action removes source and every variant. A media that is still referenced keeps
both its row and its files, as before.

**`X-Frame-Options: DENY` made the CMS preview permanently blank.** It was
applied to `/(.*)`, and `PreviewClient` renders the storefront in a same-origin
`<iframe>`; `DENY` refuses a same-origin frame as flatly as a cross-origin one.
`frame-ancestors` is now `'self'` and the header is decided in three places
rather than one: `SAMEORIGIN` on pages — kept rather than dropped, for browsers
that never implemented `frame-ancestors`, and not left at `DENY`, which would
have overridden the CSP beside it — and still `DENY` on `/api/files/:path*`,
which proxies user-uploaded bytes and whose own `default-src 'none'` is not a
fallback for `frame-ancestors`. Cross-origin framing is refused everywhere.

`cms-preview.spec.ts` could not have caught it, and for a worse reason than
"weak assertion": its "unauthenticated" test ran authenticated, because the file
matches only the `admin` Playwright project, which carries a signed-in
`storageState`; and its other test wrapped its only assertion in an `if`, so it
passed with zero assertions. It now asserts the response headers, that the child
frame reached the previewed page, and that an `h1` inside the frame is visible —
none of which a blocked frame satisfies.

**Rich-text fields rendered escaped, and were stored unsanitised.** Four
`richtext` fields store `editor.getHTML()`, and the About page rendered one as a
plain React child: the visitor read the `<strong>` tags. They are rendered as
markup now, through a `CmsRichText` component that sanitises with DOMPurify, and
`saveDraftBlockCore` sanitises on write before validation — so what is measured
and what is stored are the same string. The write guard came first: `<script>`
was reaching `cmsBlocks.values` verbatim, and rendering without it would have
turned a display bug into stored XSS.

Standing findings, recorded in `tasks/client-offboarding-runbook.md` rather than
fixed here: deleting an *établissement* still orphans its S3 objects
(`storeCascade.ts` bulk-deletes `cmsMedia` rows and never touches the bucket),
`/api/upload` objects are referenced by URL rather than by a media record, and
three of the four `richtext` fields are read by no renderer at all.
