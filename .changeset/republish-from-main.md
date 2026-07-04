---
"@be-in-digital/admin": patch
"@be-in-digital/cms": patch
"@be-in-digital/convex-functions": patch
"@be-in-digital/convex-schema": patch
"@be-in-digital/core": patch
"@be-in-digital/integrations": patch
"@be-in-digital/marketing": patch
"@be-in-digital/mcp-server": patch
"@be-in-digital/restaurant": patch
"@be-in-digital/themes": patch
"@be-in-digital/ui": patch
---

Republication depuis main. Deux problèmes des tarballs 2.0.1 corrigés côté consommateurs :

- `@be-in-digital/core` : le subpath `./auth/rbac` pointait vers `src/auth/rbac.ts` alors que le tarball ne shippe que `dist/` → import cassé chez les consommateurs (`convex-functions/auth` inclus). `files` inclut désormais `src`.
- Les correctifs de types présents sur main mais jamais publiés (promotion-form/email-config dans admin, signatures Uber Eats dans integrations/convex-functions) partent avec ce patch — ils avaient été commités sans changeset.
