# Moving the engine to the `be-yours` organisation

**Status: the code half is done and the rest is not.** This branch renames the
npm scope and every GitHub owner reference from `be-in-digital` to `be-yours`.
Nothing outside the repository has moved: the organisation transfer, the
registry, the caches and the deployed client sites are all still where they
were. **Do not merge this branch before step 2 has completed** — the reason is
in §1.

Measured on 2026-09-18 against this branch. Counts come from
`node scripts/migrate-scope-to-be-yours.mjs --check`, which re-runs in seconds;
re-run it rather than trusting a number here.

---

## What the code change actually is

| | |
| --- | --- |
| Occurrences rewritten | 3 041, across 1 126 tracked files |
| npm scope | `@be-in-digital/*` → `@be-yours/*`, on all ten engine packages |
| GitHub owner | `github.com/be-in-digital/*` → `github.com/be-yours/*`, incl. the SSH form |
| Registry config | `.npmrc` at the root and in `apps/themes` |
| Verified by | `pnpm type-check` 18/18 · `pnpm test` 9 909 tests, 18/18 · `pnpm lint` 0 errors |

Left alone, deliberately:

- **The twelve CHANGELOG files and the 125 `@be-in-digital/<pkg>@<version>` git
  tags.** They record which version shipped under which scope. The previous
  scope rename (`@beindigital-engine` → `@be-in-digital`, changeset `1a5ca27`)
  left its own history intact for the same reason.
- **Every glued `beindigital` identifier** — the init sentinel, the
  `localStorage` keys, the SES configuration set, the Uber Eats brand id, the
  Unsplash `utm_source`, the mobile bundle id. README.md § Naming says why each
  one is frozen. The migration script matches the hyphenated spelling only, so
  these are safe by construction rather than by a denylist.
- **Three hyphenated occurrences that name an account elsewhere**:
  `TURBO_TEAM: be-in-digital`, the Vercel `team be-in-digital`, and the
  `be-in-digital.fr` domain. Steps 6 and 7 move them.
- **Everything spelled `beyours` without the hyphen**, which is not the owner
  and never was. See below.

### The new name has the same trap as the old one

The organisation is **`be-yours`**. This migration was first written against
`beyours`, unhyphenated, and every line of it was wrong.

Unhyphenated `beyours` is a real and correct spelling in this repository — it
is simply never the owner. It is the two repository names (`beyours`,
`beyours-boilerplate`), the domain `beyours.fr`, the `beyours` CLI, the Vercel
projects `beyours-commercial-site` and `beyours-reference`, the
`beyours-admin-store` session key, the `beyours-${SITE_SLUG}` bucket pattern,
and a Sentry fixture that predates all of this. So `be-yours/beyours` is the
correct repository path, with both spellings, one word apart.

What makes it dangerous is that **nothing catches it**. `@beyours/*` names a
scope no GitHub account owns, and the first migration type-checked 18/18 and
passed 9 909 tests with it, because a pnpm workspace resolves `workspace:^`
locally and never touches the registry. The failure would have surfaced at
`changeset publish`, after the merge, on a scope that cannot exist.

The only check that would have caught it is the one that was skipped: reading
the organisation's actual slug before writing 3 041 occurrences of a guess.

---

## 1. Why the order matters

GitHub Packages binds an npm scope to the account that owns the repository. A
repository owned by `be-in-digital` cannot publish `@be-yours/core`, and a
repository owned by `be-yours` cannot publish `@be-in-digital/core`. The two
halves of this migration are therefore not independent:

- **Merge the code before the transfer** and `release.yml` fails on its next
  run — it will try to publish `@be-yours/*` from a repository the
  `be-in-digital` organisation still owns.
- **Transfer before the code** and `release.yml` fails the same way in reverse,
  but only when a release is cut. This is the safer order, and it is the one
  below.

Client sites are the reason this cannot be a single atomic step. An installed
site resolves `@be-in-digital/*` from its lockfile and will not discover the
successor on its own — §5 migrates them, and until it has run for a given site,
that site keeps installing the last `@be-in-digital/*` versions. Those stay
resolvable: nothing is unpublished, and the old organisation keeps serving them
for as long as it exists. What ends is publishing to it.

---

## 2. Transfer the repositories · **not automatable from a session**

Two repositories move. `be-in-digital/beyours-legacy-site` does not — it is
archived and no longer needed.

| Repository | Visibility | Why it moves |
| --- | --- | --- |
| `be-in-digital/beyours` | public | the engine monorepo |
| `be-in-digital/beyours-boilerplate` | public | the mirror every client site is cloned from |

*Settings → General → Danger Zone → Transfer ownership.* It needs admin on the
source repository **and** the right to create repositories in `be-yours`. A
GitHub App installation token cannot do it — the transfer endpoint is not
exposed to apps — so this is a human with a browser, or a PAT carrying `repo`
and `admin:org`.

Transfer the monorepo **first** and the mirror **last**: the mirror is what
already-deployed client sites pull from, so it is the one whose URL must stay
predictable longest.

**Do not create a new repository at either old name afterwards.** GitHub
installs a permanent redirect for git operations on transfer, and that redirect
is what keeps every deployed client site's `origin` working until §5 reaches it.
Creating a repository at the vacated name kills the redirect immediately.

What survives the transfer: issues, pull requests, stars, watchers,
repository-level secrets, rulesets and branch protection. What does not:
organisation-level secrets and variables, and any GitHub App installation —
including Claude's. Re-install the app on `be-yours` and confirm the five
required checks are still listed (§4).

---

## 3. Move the packages

Ten packages, all currently published to GitHub Packages under
`@be-in-digital`. After §2 the release workflow can publish them under
`@be-yours`:

```
admin · cms · convex-functions · convex-schema · core
integrations · marketing · mcp-server · restaurant · ui
```

Merge this branch, then cut a release. The changeset
`.changeset/scope-moves-to-be-yours.md` takes all ten to a **major** — breaking
for every consumer even where no source line changed, because the package name
itself is what changed.

Do not delete the `@be-in-digital/*` packages. They are what client sites
install until §5 reaches each one, and deleting a version that a lockfile pins
breaks that site's next install with no warning and no way back.

Every PAT in a client's `NODE_AUTH_TOKEN` needs `read:packages` on `be-yours`;
the one it holds today grants it on `be-in-digital` only. That is a new token
per client, distributed with the §5 migration and not before — a site that gets
the token early loses nothing, but a site that gets the code early cannot
install.

---

## 4. Check what the transfer did not carry

- **Secrets.** `MIRROR_PUSH_TOKEN`, `MIRROR_READ_TOKEN`, `TURBO_TOKEN`,
  `INFISICAL_CLIENT_ID`, `INFISICAL_CLIENT_SECRET`. Repository-level secrets
  move with the repository; anything inherited from the `be-in-digital`
  organisation does not, and reads as empty rather than as an error. The two
  mirror tokens are PATs scoped to `be-in-digital/beyours-boilerplate` — reissue
  both against the new owner, or `publish-mirror.yml` fails on its first run
  after the transfer.
- **Variables.** `INFISICAL_ENABLED`, `INFISICAL_ENV`, `CONVEX_E*`.
- **Ruleset on `main`.** Required checks are `Lint`, `Type Check`, `Test`,
  `Build`, `E2E Status`, with `strict_required_status_checks_policy` false.
  `tasks/ci-required-checks-runbook.md` § 6 has the full shape. Rulesets are
  repository-level and should survive; verify rather than assume, because a
  required check that silently stopped being required is invisible until
  something red merges.
- **The merge queue** and the squash-commit default (*default to pull request
  title, commit details*), which `pnpm check:pr-attribution` depends on.

---

## 5. Migrate the client sites

Each client site is its own repository and its own Convex deployment, cloned
from the mirror. Each one holds `@be-in-digital/*` in its `package.json`, its
lockfile and its `.npmrc`.

For each site:

```bash
node scripts/migrate-scope-to-be-yours.mjs     # from a checkout of this repo, run against the site
pnpm install --no-frozen-lockfile
pnpm type-check && pnpm test
```

The script is committed here precisely so it can be run there. It reports what
it held back; read that output rather than assuming it was empty.

A site's `origin` keeps working on GitHub's redirect after §2, but re-point it
anyway — the redirect is a courtesy, not a contract, and it dies the moment
anything is created at the old name:

```bash
git remote set-url origin https://github.com/be-yours/<client>.git
```

Sites still on the fleet-wide AWS credentials are a separate migration and are
not in scope here — `apps/docs/deployment/aws-ownership.md` and
[#199](https://github.com/be-yours/beyours/issues/199).

---

## 6. Turborepo remote cache

`TURBO_TEAM: be-in-digital` in `.github/workflows/ci.yml:78` and
`.github/workflows/e2e.yml:134`. The migration script leaves it, because the
value names a Turborepo team rather than this repository: renaming it in code
before renaming the team turns every cache hit into a miss, which costs CI
minutes and reports nothing. Rename the team, then the two lines, then confirm a
run still restores from cache.

---

## 7. Vercel

Project `beindigital-restaurant`, team `be-in-digital`
(`apps/site/README.md`, `DEPLOYMENT.md`). Same order as §6: the team first, the
references second. The git integration re-points itself when the repository
moves, but confirm it — a Vercel project whose git connection silently detached
keeps serving the last deployment and stops building new ones, which looks
exactly like a quiet week.

`beyours.fr` is unaffected: it is a domain, not an owner.

---

## 8. What is deliberately not part of this

- **`apps/site` and the "Be in Digital" trade name.** Affiliate contracts are
  already signed against it and clause 5.2 forbids altering it. Everything flows
  from `apps/site/lib/legal/company.ts`. The scope references inside `apps/site`
  did move — they name the engine packages, not the agency.
- **The eight glued `beindigital` identifiers.** Each is a coordinated change
  with an external system, and two of them destroy customer data if done
  carelessly: renaming `beindigital-addresses` or `beindigital-favorites` does
  not migrate a diner's saved addresses and favourites, it makes the browser
  look for a key that was never written. If these are ever to move, each needs
  its own migration with a read-old-write-new window, not a find-and-replace.
- **`be-in-digital.fr`.** A domain question, tracked in
  `tasks/web/agency-homepage-design.md`.

---

## Verifying the code half

```bash
node scripts/migrate-scope-to-be-yours.mjs --check   # exits 1 if anything is left
pnpm type-check && pnpm test && pnpm lint
```

`--check` writes nothing and is cheap enough to run in CI. It will exit 0 on
this branch and keep exiting 0 unless someone reintroduces the old spelling.

One caveat on `pnpm check:claude-md`: it fails on a shallow clone, because it
verifies that the commit CLAUDE.md pins is an ancestor of `HEAD`. CI checks out
with `fetch-depth: 0`. Run `git fetch --unshallow` before believing a local
failure.
