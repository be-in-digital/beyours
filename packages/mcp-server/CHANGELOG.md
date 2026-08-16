# @be-in-digital/mcp-server

## 1.0.1

### Patch Changes

- 7f0122b: Republished from main. Fixes two problems with the 2.0.1 tarballs that broke consumers:
  - `@be-in-digital/core`: the `./auth/rbac` subpath pointed at `src/auth/rbac.ts` while the tarball only ships `dist/` → broken import for consumers (`convex-functions/auth` included). `files` now includes `src`.
  - The type fixes that were on main but never published (promotion-form/email-config in admin, Uber Eats signatures in integrations/convex-functions) go out with this patch — they had been committed without a changeset.
