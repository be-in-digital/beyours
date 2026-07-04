# @be-in-digital/mcp-server

## 1.0.1

### Patch Changes

- 7f0122b: Republication depuis main. Deux problèmes des tarballs 2.0.1 corrigés côté consommateurs :
  - `@be-in-digital/core` : le subpath `./auth/rbac` pointait vers `src/auth/rbac.ts` alors que le tarball ne shippe que `dist/` → import cassé chez les consommateurs (`convex-functions/auth` inclus). `files` inclut désormais `src`.
  - Les correctifs de types présents sur main mais jamais publiés (promotion-form/email-config dans admin, signatures Uber Eats dans integrations/convex-functions) partent avec ce patch — ils avaient été commités sans changeset.
