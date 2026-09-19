# Publication is held

> The engine packages were renamed from `@be-in-digital/*` to `@be-yours/*` and
> reset to `1.0.0`. Nothing has been published under the new scope yet, and this
> file is what stops the release chain from doing it automatically. Delete this
> file to publish.

`release.yml` normally publishes by itself: `changeset publish` compares the
workspace versions against the registry and pushes whatever is missing, so a
merged version bump releases itself. That is the right behaviour on an ordinary
day and the wrong one today — the first merge of this rename to `main` would
publish ten brand-new packages on a scope nobody has verified yet, and **a
published version cannot be taken back**. `npm unpublish` is refused outright on
GitHub Packages; even where a registry allows it, the version number is burned.

So the chain asks one more question first, and the answer is this file. Its
presence holds the release. Removing it is the release.

## What is already done

|            |                                                                                   |
| ---------- | --------------------------------------------------------------------------------- |
| Scope      | `@be-in-digital/*` → `@be-yours/*`, 3 325 occurrences across 1 118 files          |
| Versions   | all ten packages reset to `1.0.0`                                                 |
| Registry   | `.npmrc` and every `setup-node` step point at `@be-yours` on `npm.pkg.github.com` |
| Linkage    | each `package.json` `repository.url` repointed to `be-yours/beyours`              |
| Changelogs | a `1.0.0` entry in each package, stating the rename                               |

The scope is `@be-yours`, with hyphens, and not `@beyours`. That is not a style
choice: GitHub Packages requires an npm scope to be **exactly** the login of the
organisation that owns the packages, and the organisation is `be-yours`. The
three applications keep `@beyours/*` — they are `private: true` and are never
published, so nothing forces them to match.

## What must be true before the hold comes off

Each of these is a thing to go and check, not a thing this branch could do.

1. **The `be-yours` organisation can receive packages.** The repository already
   lives at `be-yours/beyours`, so `secrets.GITHUB_TOKEN` is scoped to the right
   owner and no new PAT is needed for the publish itself.

2. **Package visibility is decided deliberately.** `be-yours/beyours` is a
   **public** repository. On GitHub Packages a package inherits the visibility of
   the repository it is linked to, so publishing from here can make all ten
   packages publicly downloadable — while every `publishConfig` in the tree still
   says `access: restricted`, which is npm's vocabulary and not GitHub's. Decide
   which you want, and if the answer is private, set it on the org's package
   settings before the first publish, not after: a package that was public for an
   hour was public.

3. **Client sites have somewhere to land.** Every deployed site installs
   `@be-in-digital/*` from GitHub Packages today. Those versions stay on the
   registry and keep resolving — nothing about this rename deletes them — but no
   site moves to `@be-yours/*` on its own. See the migration below.

4. **`NODE_AUTH_TOKEN` for consumers is re-issued.** A client site's PAT needs
   `read:packages` on the `be-yours` org. A PAT that only had access to
   `be-in-digital` will 401 against the new scope.

## Lifting the hold

One changeset is waiting, so the release is cut before it is let go:

```bash
pnpm version-packages                              # consumes the changeset
pnpm --filter @be-yours/mcp-server sync:versions   # its version index is source
git rm RELEASE_HOLD.md
git commit -am "Release the engine under @be-yours"
```

Open a pull request, merge it. The next push to `main` publishes. No workflow
edit and no hand-written version.

**Eight packages go out at `1.0.0` and two at `1.0.1`** — `@be-yours/core` and
`@be-yours/convex-functions`, which carry the regex fixes for the three
denial-of-service findings CodeQL raised. That is not an inconsistency to
tidy away: `check:source-drift` refuses a merge where a package's `src/` moved
after its version was set and nothing will carry the change, and it is right to.
If all ten at `1.0.0` matters more than that, the alternative is to fold the
fixes into the initial cut before any of this is merged — a decision about this
branch's history, not something to paper over at release time.

To publish something else entirely — a `0.1.0`, or a `1.0.0-beta.0` that npm
will not install without an explicit `@beta` tag — set the versions by hand
after `version-packages` and before removing this file.

## Migrating a deployed client site

Not automatic, and not urgent: a site that is not touched keeps installing the
old scope and keeps working. When you do move one:

```bash
# in the client repository. Both anchors are deliberate: `@be-in-digital/`
# catches package names and subpath imports, `@be-in-digital:registry` catches
# the .npmrc mapping, and neither matches an e-mail at that domain.
grep -rIl '@be-in-digital' --exclude-dir=node_modules --exclude-dir=.next . |
  xargs sed -i 's|@be-in-digital/|@be-yours/|g; s|@be-in-digital:registry|@be-yours:registry|g'
pnpm install
```

The site's `NODE_AUTH_TOKEN` has to be re-issued at the same time: a PAT granted
`read:packages` on `be-in-digital` answers 401 for the new scope.

The `beyours-boilerplate` mirror is the other half. It pins engine dependencies
to whatever the registry serves, so it cannot sync to `@be-yours/*` until those
versions exist — which is why the mirror stands down while this file is present
rather than failing on a lookup that can only return nothing.

## Who removed this file

Deleting it is a reviewable diff on a branch, like any other change. That is the
point of it being a file and not a repository setting: the decision to publish
has an author, a date and a pull request.
