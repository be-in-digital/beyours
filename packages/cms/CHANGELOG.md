# @be-in-digital/cms

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
    ship from `@be-in-digital/cms/sanitize`. DOMPurify needs a DOM, and the root
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
  - `@be-in-digital/core`: the `./auth/rbac` subpath pointed at `src/auth/rbac.ts` while the tarball only ships `dist/` → broken import for consumers (`convex-functions/auth` included). `files` now includes `src`.
  - The type fixes that were on main but never published (promotion-form/email-config in admin, Uber Eats signatures in integrations/convex-functions) go out with this patch — they had been committed without a changeset.

## 2.0.1

### Patch Changes

- 1a5ca27: Rename package scope from @beindigital-engine to @be-in-digital for GitHub Packages compatibility

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
  pnpm add @be-in-digital/core @be-in-digital/ui @be-in-digital/restaurant
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
  pnpm add @be-in-digital/core @be-in-digital/ui @be-in-digital/restaurant
  ```
