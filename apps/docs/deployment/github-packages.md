# GitHub Packages

> How packages are published and consumed via GitHub Packages.

## Table of Contents

- [Overview](#overview)
- [Publication is currently held](#publication-is-currently-held)
- [Publishing (Maintainers)](#publishing-maintainers)
- [Installing (Consumers)](#installing-consumers)
- [CI/CD Pipeline](#cicd-pipeline)
- [Troubleshooting](#troubleshooting)

## Overview

All `@be-yours` packages are published to [GitHub Packages](https://github.com/features/packages),
on the `be-yours` organisation. The scope has to be the org login exactly — that
is GitHub Packages' rule, not a convention — which is why it carries hyphens
while the three applications use `@beyours/*` and are never published at all.

- Integrated with GitHub authentication: `secrets.GITHUB_TOKEN` can publish here,
  because the repository and the packages share an owner
- Automated publishing via GitHub Actions

Every `publishConfig` in the tree still says `access: restricted`. That is npm's
vocabulary, and GitHub Packages does not take its answer from there: a package
inherits the visibility of the repository it is linked to, and `be-yours/beyours`
is **public**. Check the org's package settings before the first publish rather
than after — a package that was public for an hour was public.

## Publication is currently held

`RELEASE_HOLD.md` at the repository root is a deliberate stop, added with the
rename to `@be-yours` at `1.0.0`. While that file exists:

| | |
| --- | --- |
| `release.yml` | runs lint, type-check, tests, build, E2E — and publishes nothing |
| `publish-mirror.yml` | stands the sync down instead of pinning versions that do not exist |
| `pnpm release` | refuses before it builds |
| `mirror-health.yml` | skips its two distance checks, so no daily issue about a state you chose |

`pnpm check:release-hold` answers whether it is on. To publish, delete the file,
open a pull request, merge it — the next push to `main` releases. Read
[`RELEASE_HOLD.md`](../../../RELEASE_HOLD.md) first: it lists what has to be
true of the org before the first publish, and how to migrate a client site that
still installs `@be-in-digital/*`.

## Publishing (Maintainers)

### Changesets Workflow

We use [Changesets](https://github.com/changesets/changesets) for versioning:

```bash
# 1. Make your changes

# 2. Create a changeset
pnpx changeset

# 3. Select packages that changed
# 4. Choose version bump (major/minor/patch)
# 5. Write a summary

# 6. Commit and push
git add .
git commit -m "feat: add new component"
git push
```

### Automated Publishing

When changes are merged to `main`, the release workflow publishes every package
whose version on `main` is not yet in the registry. It does not decide those
versions.

**Bumping the versions is a human step**, and deliberately so: this enterprise
forbids GitHub Actions from creating pull requests, so nothing in CI can open
the "Version Packages" PR that `changesets/action` used to.

```bash
# On a branch, once the changesets you want to release are on main
pnpm version-packages   # applies the changesets: bumps versions, writes CHANGELOGs

# Commit the result and open a normal pull request
git commit -am "chore(release): version packages"
```

Merging that pull request publishes the packages, because their versions are
then ahead of the registry.

### Manual Publishing

```bash
# Build all packages
pnpm build

# Publish (requires GITHUB_TOKEN)
pnpx changeset publish
```

## Installing (Consumers)

### 1. Create a GitHub PAT

Go to [GitHub Settings > Tokens](https://github.com/settings/tokens) and create a **classic** token with `read:packages` scope.

### 2. Configure .npmrc

Create `.npmrc` at your project root:

```ini
@be-yours:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

### 3. Set Environment Variable

```bash
export GITHUB_TOKEN=ghp_your_token_here
```

### 4. Install

```bash
pnpm add @be-yours/ui @be-yours/core
```

## CI/CD Pipeline

### Release Workflow

`.github/workflows/release.yml`:

```yaml
name: Release
on:
  push:
    branches: [main]

permissions:
  contents: write
  packages: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "pnpm"
          registry-url: "https://npm.pkg.github.com"
          scope: "@be-yours"

      - run: pnpm install --frozen-lockfile
      - run: pnpm build

      - name: Publish packages
        run: pnpm exec changeset publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Push release tags
        run: git push --tags
```

### Key Points

- `NODE_AUTH_TOKEN` is used by `setup-node` for registry authentication
- The `packages: write` permission is required for publishing
- `contents: write` is required for the tags `changeset publish` writes
- No `pull-requests` permission: the workflow opens none, and the enterprise
  would refuse it if it tried

## Troubleshooting

### 401 Unauthorized

```
npm ERR! 401 Unauthorized
```

**Fix**: Your `GITHUB_TOKEN` is missing or expired. Regenerate your PAT.

### 403 Forbidden

```
npm ERR! 403 Forbidden - PUT https://npm.pkg.github.com/@be-yours/ui
```

**Fix**: Your token doesn't have `write:packages` scope (for publishing) or you're not a member of the `be-yours` org, which is the one that owns the `@be-yours` scope.

### 404 Not Found

```
npm ERR! 404 Not Found - GET https://npm.pkg.github.com/@be-yours/ui
```

**Fix**: The package hasn't been published yet, or your token doesn't have `read:packages` scope.

### .npmrc Not Being Read

Ensure `.npmrc` is in the correct location (project root or `~/.npmrc`) and the environment variable is set:

```bash
echo $GITHUB_TOKEN  # Should print your token
```
