# @be-yours/cms

## 1.0.0

### Major Changes

- Renamed from `@be-in-digital/cms` to `@be-yours/cms`, and reset to 1.0.0.

  The npm scope now matches the GitHub organisation that owns this repository,
  which is what GitHub Packages requires: a package published to
  `npm.pkg.github.com` must carry the owning org as its scope, and the org is
  `be-yours`. The previous scope belonged to `be-in-digital`, the agency.

  The version is a reset, not a bump. Under the new scope this package has no
  published history, so `1.0.0` is its first release rather than a downgrade
  from `3.1.0`. The old scope keeps everything it published: those
  versions stay on the registry and already-deployed client sites continue to
  resolve them until they are migrated. See `RELEASE_HOLD.md` for the
  migration and the conditions this release is held on.

## 3.1.0

### Minor Changes

- dc26361: Refuse the uploads a CMS should refuse, delete what deletion promises, and let the preview render

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
  fixed here: deleting an _établissement_ still orphans its S3 objects
  (`storeCascade.ts` bulk-deletes `cmsMedia` rows and never touches the bucket),
  `/api/upload` objects are referenced by URL rather than by a media record, and
  three of the four `richtext` fields are read by no renderer at all.

## 3.0.0

### Major Changes

- 5837a81: Stop `sanitizeSvg` handing back active SVG, and move it off the package barrel.

  `sanitizeSvg` matched patterns against raw markup, and a string cannot be asked
  what a parser would see. `<svg/onload="…">` has no whitespace before the
  handler, `&#106;avascript:` only spells `javascript:` after entity decoding, and
  `<set attributeName="href" to="javascript:…">` never writes the URI into an
  attribute the pattern read. All three came back byte-for-byte unchanged, and
  reported nothing removed. It now sanitizes with DOMPurify.

  **Breaking, twice over:**
  - `sanitizeSvg` and `SanitizeResult` no longer ship from the package root. They
    ship from `@be-yours/cms/sanitize`. DOMPurify needs a DOM, and the root
    barrel is imported by Convex isolate modules that have none — re-exporting it
    there made the whole backend fail to push (`Failed to analyze cms.js: Cannot
read properties of undefined (reading 'bind')`). The subpath keeps the parser
    with the Node-side callers that use it.
  - `sanitizeSvg` output is no longer byte-identical to its input for a clean
    file. DOMPurify re-serializes from the parsed tree, so `<circle/>` returns as
    `<circle></circle>`. The drawing is preserved; the bytes are not.

  Adds `containsActiveContent` / `inspectSvgForActiveContent` to the root barrel:
  a DOM-free, dependency-free check that answers "does this SVG carry anything
  that could execute", for the Convex callers that cannot import a parser. It
  refuses rather than scrubs — a scrubber that misses a case hands back a file the
  caller then believes is safe, which is exactly how the old one failed.

## 2.0.2

### Patch Changes

- 7f0122b: Republished from main. Fixes two problems with the 2.0.1 tarballs that broke consumers:
  - `@be-yours/core`: the `./auth/rbac` subpath pointed at `src/auth/rbac.ts` while the tarball only ships `dist/` → broken import for consumers (`convex-functions/auth` included). `files` now includes `src`.
  - The type fixes that were on main but never published (promotion-form/email-config in admin, Uber Eats signatures in integrations/convex-functions) go out with this patch — they had been committed without a changeset.

## 2.0.1

### Patch Changes

- 1a5ca27: Rename package scope from @beindigital-engine to @be-yours for GitHub Packages compatibility

## 2.0.0

### Major Changes

- 7c3d4da: Configure private npm publishing for all @beindigital-engine packages

  ### What changed
  - Packages are now publishable to npm as private (restricted) packages under the `@beindigital-engine` scope.
  - Removed `"private": true` flag from all packages and replaced with `"publishConfig": { "access": "restricted" }`.
  - Added `"files"` field to control published contents.

  ### Why

  First official release of all packages on the npm private registry for distribution.

  ### How to install

  ```bash
  npm login --scope=@beindigital-engine
  pnpm add @be-yours/core @be-yours/ui @be-yours/restaurant
  ```

## 1.0.0

### Major Changes

- ad4d8d2: Configure private npm publishing for all @beindigital-engine packages

  ### What changed
  - Packages are now publishable to npm as private (restricted) packages under the `@beindigital-engine` scope.
  - Removed `"private": true` flag from all packages and replaced with `"publishConfig": { "access": "restricted" }`.
  - Added `"files"` field to control published contents.

  ### Why

  First official release of all packages on the npm private registry for distribution.

  ### How to install

  ```bash
  npm login --scope=@beindigital-engine
  pnpm add @be-yours/core @be-yours/ui @be-yours/restaurant
  ```
