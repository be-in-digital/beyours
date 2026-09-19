# @beyours/reference

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

### Patch Changes

- Updated dependencies [7c3d4da]
  - @be-yours/convex-functions@2.0.0
  - @be-yours/convex-schema@2.0.0
  - @be-yours/integrations@2.0.0
  - @be-yours/restaurant@2.0.0
  - @be-yours/marketing@2.0.0
  - @be-yours/admin@2.0.0
  - @be-yours/core@2.0.0
  - @be-yours/cms@2.0.0
  - @be-yours/ui@2.0.0

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

### Patch Changes

- Updated dependencies [ad4d8d2]
  - @be-yours/convex-functions@1.0.0
  - @be-yours/convex-schema@1.0.0
  - @be-yours/integrations@1.0.0
  - @be-yours/restaurant@1.0.0
  - @be-yours/marketing@1.0.0
  - @be-yours/admin@1.0.0
  - @be-yours/core@1.0.0
  - @be-yours/cms@1.0.0
  - @be-yours/ui@1.0.0
