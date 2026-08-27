# GitHub Packages

> How packages are published and consumed via GitHub Packages.

## Table of Contents

- [Overview](#overview)
- [Publishing (Maintainers)](#publishing-maintainers)
- [Installing (Consumers)](#installing-consumers)
- [CI/CD Pipeline](#cicd-pipeline)
- [Troubleshooting](#troubleshooting)

## Overview

All `@be-in-digital` packages are published as **private packages** on [GitHub Packages](https://github.com/features/packages). This provides:

- Free private package hosting (for private repos)
- Integrated with GitHub authentication
- Automated publishing via GitHub Actions

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
@be-in-digital:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

### 3. Set Environment Variable

```bash
export GITHUB_TOKEN=ghp_your_token_here
```

### 4. Install

```bash
pnpm add @be-in-digital/ui @be-in-digital/core
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
          scope: "@be-in-digital"

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
npm ERR! 403 Forbidden - PUT https://npm.pkg.github.com/@be-in-digital/ui
```

**Fix**: Your token doesn't have `write:packages` scope (for publishing) or you're not a member of the `be-in-digital` org.

### 404 Not Found

```
npm ERR! 404 Not Found - GET https://npm.pkg.github.com/@be-in-digital/ui
```

**Fix**: The package hasn't been published yet, or your token doesn't have `read:packages` scope.

### .npmrc Not Being Read

Ensure `.npmrc` is in the correct location (project root or `~/.npmrc`) and the environment variable is set:

```bash
echo $GITHUB_TOKEN  # Should print your token
```
