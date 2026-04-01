# @beindigital-engine/admin

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
  pnpm add @beindigital-engine/core @beindigital-engine/ui @beindigital-engine/restaurant
  ```

### Patch Changes

- Updated dependencies [7c3d4da]
  - @beindigital-engine/convex-functions@2.0.0
  - @beindigital-engine/convex-schema@2.0.0
  - @beindigital-engine/restaurant@2.0.0
  - @beindigital-engine/marketing@2.0.0
  - @beindigital-engine/core@2.0.0
  - @beindigital-engine/ui@2.0.0

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
  pnpm add @beindigital-engine/core @beindigital-engine/ui @beindigital-engine/restaurant
  ```

### Patch Changes

- Updated dependencies [ad4d8d2]
  - @beindigital-engine/convex-functions@1.0.0
  - @beindigital-engine/convex-schema@1.0.0
  - @beindigital-engine/restaurant@1.0.0
  - @beindigital-engine/marketing@1.0.0
  - @beindigital-engine/core@1.0.0
  - @beindigital-engine/ui@1.0.0
