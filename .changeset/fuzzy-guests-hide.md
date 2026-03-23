---
'@beindigital-engine/convex-functions': major
'@beindigital-engine/convex-schema': major
'@beindigital-engine/restaurant-theme': major
'@beindigital-engine/integrations': major
'@beindigital-engine/restaurant': major
'@beindigital-engine/marketing': major
'@beindigital-engine/themes': major
'@beindigital-engine/admin': major
'@beindigital-engine/core': major
'@beindigital-engine/cms': major
'@beindigital-engine/ui': major
---

Configure private npm publishing for all @beindigital-engine packages

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
