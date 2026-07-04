# @be-in-digital/cms

## 2.0.2

### Patch Changes

- 7f0122b: Republication depuis main. Deux problèmes des tarballs 2.0.1 corrigés côté consommateurs :
  - `@be-in-digital/core` : le subpath `./auth/rbac` pointait vers `src/auth/rbac.ts` alors que le tarball ne shippe que `dist/` → import cassé chez les consommateurs (`convex-functions/auth` inclus). `files` inclut désormais `src`.
  - Les correctifs de types présents sur main mais jamais publiés (promotion-form/email-config dans admin, signatures Uber Eats dans integrations/convex-functions) partent avec ce patch — ils avaient été commités sans changeset.

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
