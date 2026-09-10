# Testing

Two runners, one naming rule, five checks that block a merge, and no coverage
threshold. This file says what runs, how to run it, what the genres of test in this
repository are for, and what is deliberately not enforced.

**Checked against the tree at `158019f` (5 September 2026).** Counts carry the
command that produced them. Companion files: [`ARCHITECTURE.md`](ARCHITECTURE.md),
[`FEATURES.md`](FEATURES.md), [`DEPLOYMENT.md`](DEPLOYMENT.md).

---

## 1. The naming rule

**Vitest owns `*.test.ts` / `*.test.tsx`. Playwright owns `*.spec.ts`.** The rule is
absolute, and it is what keeps a file from being invisible to both runners.

The subtle case is `e2e/`. The Deliveroo scenario suites are Vitest files that live
under `e2e/`, so the app configs exclude **only the Playwright files** there rather
than the whole directory:

```ts
// apps/reference/vitest.config.ts:24-33 (apps/themes/vitest.config.ts:23-33 is the twin)
exclude: [
  '**/node_modules/**',
  '**/dist/**',
  // Playwright owns the *.spec.ts files under e2e/. The *.test.ts files
  // there are Vitest suites (Deliveroo scenarios) and must stay visible:
  // excluding all of e2e/ hid them from both runners.
  '**/e2e/**/*.spec.ts',
  '**/e2e/**/*.setup.ts',
  '**/.{idea,git,cache,output,temp}/**',
]
```

Playwright's side of the rule is `testMatch` in `apps/*/playwright.config.ts`, whose
patterns all end in `\.spec\.ts` (plus `auth\.setup\.ts` for the setup project). A
`.test.ts` file under `e2e/` therefore runs under Vitest and never under Playwright,
which is the intent.

> `README.md` still carries a "Things to watch" entry saying eleven Deliveroo tests
> fall into a blind spot and run under neither runner. **That is no longer true.**
> `cd apps/reference && npx vitest list --filesOnly | grep e2e/` lists all twelve.

---

## 2. Commands

From the repository root, all through Turbo:

| Command | Effect |
| --- | --- |
| `pnpm test` | Vitest across every workspace |
| `pnpm test:coverage` | Vitest with V8 coverage; writes `coverage/` per workspace |
| `pnpm test:e2e` | Playwright, every app that declares the task |
| `pnpm test:ui` · `pnpm test:e2e:ui` · `pnpm test:e2e:debug` | Interactive runners, filtered to `@beyours/reference` |
| `pnpm lint` · `pnpm type-check` | Quality, across the 13 workspaces |
| `pnpm check:divergence` | The twin-app guard (§8) |
| `pnpm check:accents` · `pnpm check:claude-md` · `pnpm check:mirror-css` | Three more guards folded into `Lint` |
| `pnpm check:pending-release` · `pnpm check:source-drift` | The two release guards folded into `Lint` (§4) |

Turbo caches `test`; a second run with no changes re-executes nothing. `test:e2e` is
declared `"cache": false`.

Per-workspace, when you want one suite and its own output:

```bash
pnpm --filter @be-in-digital/core test
cd packages/core && npx vitest run gpt-translation      # one file, by name substring
cd apps/reference && npx vitest list --filesOnly        # what would be collected
```

**Run a suspect package alone before filing anything.** Vitest under parallel load on
a saturated machine looks exactly like a regression: a run has been measured at 433 s
of collection where an idle one takes 16 s. `pnpm turbo run test --concurrency=1` is
the tie-breaker.

Every workspace's `test` script is `vitest run --passWithNoTests`, except
`apps/site`, which is plain `vitest run`.

---

## 3. What actually runs

Reproduce the file counts with:

```bash
for w in packages/* apps/reference apps/site apps/themes; do
  [ -f "$w/vitest.config.ts" ] || continue
  echo -n "$w: "; (cd "$w" && npx vitest list --filesOnly 2>/dev/null | grep -c '\.test\.')
done
```

Measured at `158019f` — **361 Vitest files**:

| Workspace | Files | | Workspace | Files |
| --- | ---: | --- | --- | ---: |
| `apps/themes` | 93 | | `packages/ui` | 8 |
| `apps/reference` | 91 | | `packages/cms` | 7 |
| `packages/convex-functions` | 51 | | `packages/marketing` | 7 |
| `apps/site` | 41 | | `packages/convex-schema` | 6 |
| `packages/admin` | 17 | | `packages/mcp-server` | **0** |
| `packages/integrations` | 17 | | | |
| `packages/core` | 14 | | **Total** | **361** |
| `packages/restaurant` | 9 | | of which in `packages/` | 136 |

`packages/mcp-server` has no tests at all, and is the only workspace with no
`test:coverage` script. It is 3 files and 1,700 lines, and it is what editors and
agents read to learn the package surface — see
[`ARCHITECTURE.md`](ARCHITECTURE.md#9-structural-issues-that-are-open) for why that
matters.

**Playwright**, listed rather than run (`--list` does not start the web server):

```bash
cd apps/reference && NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud npx playwright test --list | tail -1
# Total: 557 tests in 58 files
cd apps/site && npx playwright test --list | tail -1
# Total: 9 tests in 1 file
```

`apps/themes` reports the same 557 in 58 — the suites are twins by design.

**The backend gate is load-bearing.** `apps/*/playwright.config.ts` builds the
`setup` and `admin` projects out of a spread:

```ts
...(hasRealBackend ? [{ name: "admin", … }] : [])
```

With no real `NEXT_PUBLIC_CONVEX_URL`, those projects are not *skipped* — they are
never declared, 44 of the 58 files vanish from the run **and from the report**, and
the same command reports `Total: 80 tests in 14 files` and exits 0. The config prints
a warning when that happens (`apps/reference/playwright.config.ts:33-38`; `apps/themes` at `:37-42`); CI additionally fails on
it (§4).

> `README.md`'s Commands table still says "Vitest — 56 files" and "Playwright — 43
> specs". Both figures are several months stale.

---

## 4. CI

Five workflows: `ci.yml`, `e2e.yml`, `release.yml`, `publish-mirror.yml`,
`security.yml`.

**`ci.yml` does not run on every push.** Its triggers are
`push: branches: [main]`, `pull_request: branches: [main]`, `merge_group`, and
`workflow_call` (`ci.yml:3-19`). A push to a feature branch runs nothing until a pull
request against `main` exists. Any statement that "GitHub Actions runs tests on every
push/PR" is wrong about this repository.

It defines four jobs, and the job names are the check names branch protection
requires: **`Lint`**, **`Type Check`**, **`Test`**, **`Build`**.

`Lint` is more than ESLint. Six repository guards are folded into it on purpose —
`Lint` is already a required context, so they become blocking without anyone touching
repository settings:

| Step | Script | What it protects |
| --- | --- | --- |
| Check French accents | `pnpm check:accents` | Customer-facing French copy |
| Check app divergence | `pnpm check:divergence` | The twin-app contract (§8) |
| Check `CLAUDE.md`'s commands and documents | `pnpm check:claude-md` | The first file every contributor and every agent reads. It resolves every `pnpm <script>` in a fenced block against the right `package.json`, and asserts that every document named under *Additional Documentation* exists on disk. It checks **existence**, not truth — but existence is what broke, twice. |
| Check the client stylesheet | `pnpm check:mirror-css` | The **published** tree — `apps/themes` becomes the repository root in the mirror, and a stylesheet whose `@source` globs point at the monorepo silently loses every rule the engine packages contribute. The only required check that builds that tree; it symlinks `packages/<name>`, so the TypeScript half — which needs the registry — is gated by the mirror sync instead. |
| Report unreleased engine fixes | `pnpm check:pending-release` | The changesets sitting on `main` that no release has carried yet. **Reports, never gates** — batching fixes into one release is the intended workflow, so it escalates to a `::warning::` only past `--max-age-days` (7). |
| Check engine source has a release to travel in | `pnpm check:source-drift` | The other half, and the half that cannot resolve itself: a package whose `src/` moved since its last version bump with **no** changeset naming it. `changeset publish` answers `already published` and skips it, so that source reaches no client — not later, at all. **This one gates.** |

The last two are a pair and the difference between them is the whole point. A
changeset that exists is released by the next release; a changeset that does not
exist is released by nothing, ever. #209 records `integrations`, `marketing` and `ui`
serving a July build for two months in exactly that state, with the whole Uber Direct
module (~950 lines) never reaching a client site — invisible because `apps/themes`
links the engine with `workspace:^` and compiles against the current source, so every
check here was green by construction.

`check:source-drift` needs full history (`fetch-depth: 0`, which `Lint` already
fetches) to find the commit that last moved each version. Without it the check reports
`unknown` rather than guessing — a check that cannot answer must not read as a check
that answered "fine". If a refactor genuinely owes nobody a release note,
`pnpm changeset --empty` is the honest answer: it records that the source moved and
that nothing was owed, which is a different statement from silence.

### The fifth check: `E2E Status`, never `E2E Tests`

`e2e.yml` runs a Playwright suite in **four shards**, each with its own
`convex-local-backend` downloaded and started on the runner — no Convex account, no
`E2E_*` secrets. It then merges that app's four blob reports and asserts the run was
real. Four jobs:

| Job | Name | Role |
| --- | --- | --- |
| `suites` | `Pick the suites to run` | Emits the app list the matrix expands over. |
| `e2e` | `E2E Tests (<app> n/4)` | The shards. `fail-fast: false`, `timeout-minutes: 40`. |
| `e2e-report` | `E2E Report (<app>)` | Merges that app's blobs, then runs `scripts/assert-e2e-ran.mjs`. |
| `e2e-status` | `E2E Status` | The aggregate. **This is the required check.** |

**Which apps.** `apps/reference` on every trigger; `apps/themes` additionally on
pushes to `main`, and on a pull request that edits `e2e.yml` itself. `workflow_dispatch`
runs either or both on demand — from `main` only, as GitHub requires. The twin-app
contract (§8) holds both `e2e/` trees identical, so on a pull request the bench is a
faithful reading of the *specs* and running both would buy a second opinion on the
same tests. What it cannot speak for is the template's own **configuration** — it has
no `app/(test)/layout.tsx`, so it serves harness routes the template 404s in
production. That asymmetry shipped three broken specs to every client and went unseen
for as long as the template's suite ran nowhere (#329), which is why the template now
runs where a regression costs a job rather than a rebase.

Artifacts carry the app in their name (`blob-report-<app>-<shard>`), and
`e2e-report` collects `blob-report-<app>-*`. Without that, one merge would hold both
suites and each app's floors would be cleared on the strength of the other's tests.

**The required check is `E2E Status`.** Requiring a *shard* would be the old trap: a
job that does not run reports `skipped`, and GitHub counts a skip as satisfied.
`E2E Status` fails on anything that is not a real pass — `failure`, `cancelled` and
`skipped` alike (`e2e.yml:649-676`) — and it also fails when the shards pass but the
report job does not, so it cannot go green over an empty suite.

`scripts/assert-e2e-ran.mjs` is why that last clause is not theoretical. Playwright
exits 0 with nothing to run, so the job asserts **floors per project**, not one global
number:

```yaml
node scripts/assert-e2e-ran.mjs apps/<app>/merged-report.json $floors
```

Both floor sets are measured, never estimated:

| App | Measured run | Floors |
| --- | --- | --- |
| `reference` | setup 4, public 75, admin 463 — 542 | `--min 400 --projects setup:1,public:60,admin:380` |
| `themes` | setup 1, public 80, admin 469 — 550 | `--min 412 --projects setup:1,public:64,admin:375` |

A single `--min 100` against the 542-test suite was measured accepting 442 missing
tests. Each set sits below its measured run — with room for the tests that can
legitimately self-skip on thin fixtures, 9 and 8 respectively — and above what any
three shards can produce, so losing one blob fails. The template carries the same
floors in its own `ci.yml`, where the suite is unsharded.

Raise them when a suite grows; a floor that never moves stops meaning anything.

### What blocks a merge

`main` is protected by a **ruleset** (id `22177735`), not classic branch protection,
since 3 September 2026. Required contexts: `Lint`, `Type Check`, `Test`, `Build`,
`E2E Status`. Zero approving reviews required; admins may bypass;
`strict_required_status_checks_policy` is **false** because the merge queue builds the
prospective merged state and runs the same checks against it.

> `GET /branches/main/protection` answers `404 Branch not protected` and that is
> correct — the endpoint only knows the classic model. Read
> `/rules/branches/main` instead. Full reasoning, including why `Gitleaks` and
> `pnpm audit` are deliberately **not** required, is
> [`tasks/ci-required-checks-runbook.md`](tasks/ci-required-checks-runbook.md) §5–§6.

**The release chain gates on all five, and pays for the fifth only when it matters.**
`release.yml` calls `ci.yml` through `workflow_call`, which covers `Lint`,
`Type Check`, `Test` and `Build`, and calls `e2e.yml` the same way for `E2E Status`
(#307, #308). Until 07/09/2026 it could not: `e2e.yml` carried no `workflow_call:`
trigger, so a red or still-running suite did not stop a publish — measured on
`aa026e6`, where *Release* finished 6m45s and the mirror sync 11m02s before the suite
reported.

The E2E call is conditional, and the condition is *will this push publish anything*.
A `Plan` job asks the registry the same question `changeset publish` asks — is this
version already published? — and the suite is called only when the answer is no. That
is measured rather than assumed: of the 293 commits on `main` between 01/07/2026 and
07/09/2026, **12 moved a `packages/*` version**, so an unconditional gate would bill
eight sharded runners on 96% of pushes for a run that ends in "No unpublished projects
to publish". A registry lookup that fails reports "would publish", so a broken token
gates rather than waves through.

`publish-mirror.yml` gates the same way on its `push` and `workflow_dispatch` paths,
calling the `themes` suite alone — it ships `apps/themes` and nothing else. It skips
the call on `--check` dispatches, which push nothing, and on the `workflow_run` path,
where *Release* has already run it on the commit being synced.

**The suites also run once more, outside the workspace.** `Verify the delivered tree`
runs `pnpm check:mirror-build`, which packs the engine as tarballs, installs them into
a materialised copy of `apps/themes` and runs the template's own suite there. It gates
the sync on every path that pushes — including `workflow_run`, unlike the two above,
because the Release chain never runs it.

That distinction is the whole reason it exists. Everything else runs `apps/themes`
*inside* this monorepo, with `packages/*` symlinked and `apps/` above it, so a test
that reads a path only the monorepo has passes here and fails for a client. Four
shipped test files did exactly that — `packages/`, `apps/docs/`, a hard-coded sibling
app — and `beyours-boilerplate` was red from 7 September while every required check
here was green. `tests/lib/repo-layout.ts` is where a suite now asks whether it is
looking at the engine checkout or at a delivered site, and it answers from the shape
of the checkout rather than from whether a file happens to be readable: a missing file
is what a real regression looks like, so a suite that shrugs at one guards nothing.

**A job that fails in ~3 seconds having run zero steps is a billing block, not a
defect.** The Actions minutes have run out twice; every workflow on every branch dies
at once and `gh api …/actions/jobs/<id>` shows `steps: []`. Check that signature
before debugging code that is fine.

---

## 5. Coverage

**No coverage threshold is enforced anywhere, and CI has no coverage step.** That is
the honest state, and it is stated here so nobody quotes a number that nothing
measures.

- `grep -rn "coverage" --include='vitest.config.*' .` → **no match**. Not one config
  sets `test.coverage`, a provider, an include/exclude list or a threshold.
- `@vitest/coverage-v8` is a devDependency in 12 of the 13 workspaces
  (`packages/mcp-server` excepted), so the provider resolves.
- `test:coverage` exists as a script in those same 12 workspaces and at the root; the
  Turbo task declares `"outputs": ["coverage/**"]`.
- No workflow runs it.

`CLAUDE.md` used to claim "Vitest unit tests (80%+ coverage)". Nothing produced that
figure and nothing enforced it.

### Measuring it

```bash
pnpm test:coverage                                    # every workspace
pnpm --filter @be-in-digital/core test:coverage       # one
open packages/core/coverage/index.html
```

Two things to know before you run it:

**The output is git-ignored, per workspace.** The root `.gitignore` matches
`coverage/` at any depth, so the directory Vitest writes into each workspace stays
out of `git status`. It was `/coverage` — root-anchored — until the coverage scripts
landed, and a full run then left eight untracked directories.

**`apps/site` is on a different Vitest major.** It runs `vitest@^4.1.1` with
`@vitest/coverage-v8@4.1.9`; every other workspace runs `vitest@^3.2.7` with
`@vitest/coverage-v8@^3.2.4`. Coverage output shapes and config keys differ between
the two majors, so do not assume a flag that works in one works in the other.

### Before adding a threshold

A threshold set above what the suite currently reaches turns every unrelated pull
request red, and the predictable response is to lower it or bypass it — which is
worse than not having one. If you want one: measure first, set the floor at what the
suite already clears, and raise it deliberately. Prefer a threshold on the packages
that carry money-correctness logic (`convex-functions`, `core`, `restaurant`) over one
global number across 361 files of very uneven risk.

---

## 6. Timeouts

Several configs raise `testTimeout` above the 5 s default, and each says why in the
file. The rule they encode is stated at `packages/cms/vitest.config.ts:7-14`:

> **If the slowest test leaves less than ~30x headroom, give it a 15 s ceiling.**

The reasoning: a timeout exists to catch a hung test, not to police speed. A full
`turbo run lint type-check test` on a contended runner was measured slowing one test
from 302 ms to past 5000 ms — a ~16x factor — and `packages/cms` failed exactly that
way. The failure it produces is the worst kind: a timeout reported as a broken
assertion about the thing under test.

Current ceilings: `cms`, `core`, `marketing`, `restaurant` → 15 s;
`apps/reference`, `apps/themes` → 60 s (the `convex-test` cold start compiles the
whole `convex/` module graph on the first call in each file); `apps/site` → 30 s, for
the same reason.

---

## 7. The genres of test here, and what each is for

### Convex suites through the real HTTP route — the model to copy

`apps/reference/tests/convex/deliveroo-webhook.test.ts` (567 lines) is the reference
implementation. Read its docblock before writing a backend test; it explains the
choice better than a rule could:

> These drive the signed HTTP endpoint rather than the internals, because the bug in
> each case was at a seam: between the processor and its caller, or between our
> vocabulary and Deliveroo's.

The three defects it holds down were each invisible to the unit tests around them: an
order written to the database that never produced a kitchen ticket; a status map that
matched `cancelled` where Deliveroo sends `canceled`; and a handler that acknowledged
every outcome with 200, so a failed order was lost in silence because Deliveroo
retries only on a non-2xx.

The mechanics worth copying:

```ts
// @vitest-environment edge-runtime
const modules = import.meta.glob("../../convex/**/*.ts")
const t = convexTest(schema, modules)
// …sign a real request and t.fetch() the route, rather than calling the handler
```

Two details that are easy to get wrong. **Set every env var the handler's schema
requires**, not just the one under test — `OPENAI_API_KEY` is required by the same
schema as the Deliveroo secret, and without it the handler fails for the wrong
reason and a response-policy assertion passes on a lie (`beforeAll`, lines 41-52).
And **cancel whatever the test left on the scheduler** in `afterEach`, or a later
suite inherits it.

`apps/reference/tests/convex/` holds 53 files, 50 of which drive a `convexTest`
harness (`grep -l convexTest apps/reference/tests/convex/*.ts | wc -l`).

### Source-level reachability tests

`packages/admin` receives the Convex API as `api: any`
(`src/stores/admin-api-store.ts`), so `useMutation(api?.payments?.refund)` type-checks
perfectly for as long as `payments.refund` does not exist. `tsc` cannot catch this
class of bug and the package has no jsdom. So two suites read the *source* and resolve
what it references:

- `packages/admin/src/__tests__/refund-surface.test.ts` sweeps every `api.module.fn`
  in the package — in both the optional-chained and plain spellings — against the
  Convex modules the apps actually export. The refund button in the order-detail
  dialog was dead exactly this way, and the sweep found a second one the same day.
- `packages/admin/src/__tests__/design-surface.test.ts` goes one level further:
  a function existing is not the same as the *object* handed to it being one the
  server would accept, so it measures the field names the Design page sends against
  `BRANDING_FIELDS`, the validator the mutation enforces. It also asserts
  **reachability** — `DesignPage` was exported by the package and mounted by neither
  app, so its three save buttons were dead twice over and only one death had been
  fixed.

The genre exists because this codebase's characteristic defect is a screen that is
correct and unreachable, or a call that is well-typed and points at nothing. If you
add an admin screen, add its route assertion here; `pnpm check:divergence` will not
help you, because its parity rule covers `e2e/` and `convex/` only
(§8).

### End-to-end

`apps/*/e2e/` — three Playwright projects (`setup`, `public`, `admin`), shared
helpers under `e2e/helpers/`, and an `e2e/README.md` in each app documenting that
app's CI. Read `apps/reference/e2e/README.md` before running them locally; it
targets a deployment you are willing to see wiped.

Two helpers exist because their absence produced silently-green suites, and both are
worth knowing by name:

- **`countAfterLoad`** (`e2e/helpers/list.helpers.ts`) — every list in this admin
  arrives from a Convex query a moment after the page does, so a bare `.count()`
  counts an empty page. Tests that then wrote `if (rowCount > 0) { …assert… }`
  **passed having verified nothing**.
- **`chooseOption`** (`e2e/helpers/filter.helpers.ts`) — Radix renders every option
  twice, so an unscoped `getByRole("option")` matches both and strict mode refuses.

The same lesson generalises: **a silent `if` is not a skip.** Use `test.skip(...)` so
a test that cannot run says so, instead of finishing green.

---

## 8. The twin-app guard

`apps/reference` and `apps/themes` are twins, and a fault is routinely byte-identical
in both. `scripts/check-app-divergence.mjs` runs inside `Lint`:

```bash
pnpm check:divergence
# App divergence check passed: 10 documented divergences, no new ones,
# e2e and convex at parity.
```

Adding a divergence deliberately takes three acts: a row in `ALLOWED` in the script,
an entry in [`tasks/reference-themes-divergence.md`](tasks/reference-themes-divergence.md),
and a comment in the file itself.

Its limit, stated so you do not rely on it for more than it does: `PARITY_DIRS` is
`["e2e", "convex"]`. **A route added to one app and forgotten in the other passes
this check in silence.** Where route parity matters, assert it by hand — as
`design-surface.test.ts` does.

The note the guard replaced caught nothing for ten pull requests: #256 added
`getByIdInternal` to the bench only, and `sendBatch` on a client deployment called a
Convex function that did not exist. `tsc` did not catch it, the tests did not, review
did not.

---

## 9. The antipattern: a test that asserts its own fixtures

The worst class of defect in this repository is **a green suite that is green because
it checked nothing** — worse than no coverage, because it reads as coverage.

The mechanical shape is a block that builds a fixture and then asserts a property of
the fixture it just built:

```ts
// The antipattern. Product code is never called.
const order = createNewOrderWebhook({ fulfillment_type: "restaurant" })
expect(order.fulfillment_type).toBe("restaurant")
```

That assertion cannot fail for any reason connected to the product. Rename a handler,
invert a status map, delete the module — it stays green. A family of Deliveroo
"scenario" suites was written this way, and it is why eleven real defects in the
delivery-platform integration survived five green CI runs.

**The rule: assert on effects, not on inputs.** A test earns its place when it can
fail because the product changed. Concretely, for a suite like that one:

- Drive the **real entry point** — the signed HTTP route, the exported mutation, the
  rendered component — not a fixture builder.
- Assert on what the product *produced*: a row written, a ticket created, a status
  code returned, a scheduled job enqueued. `deliveroo-webhook.test.ts` (§7) is the
  worked example.
- If a test's docblock claims it validates a lifecycle, check that it touches the
  lifecycle. Several here claimed exactly that and touched neither end.

A quick way to spot candidates: a suite whose imports include a fixture builder and
**no module from `convex/`, `packages/` or the app under test** is almost certainly
asserting itself.

The related trap is a passing test sitting on top of a defect and **blessing the
broken behaviour**. When a probe you expect to fail passes on the first run, you have
not understood the defect. Read the existing test before trusting it; if it asserts
the bug, rewrite it and say so.

---

## 10. Writing a new test — the short version

1. **Reproduce before you fix.** Write a throwaway probe (`zz-probe-*.test.ts`;
   `convex-test` for backend work) that replays the exact failure. Watch it fail.
2. **Fix, then prove.** The same probe goes green. Then delete every probe:
   `find . -name 'zz-probe-*' -not -path './node_modules/*' -delete`
3. **Land a permanent test**, in the package that owns the behaviour. The probe
   proves the fix today; the permanent test stops the regression tomorrow.
4. **Fix both twins**, or lift the code into a package and render it from both.
5. **Rebuild before concluding a fix did not work.** Packages are consumed from
   `dist/`; editing `packages/*/src` changes nothing in a running app until `tsup`
   has run. The three packages that ship as raw TypeScript (`admin`,
   `convex-functions`, `convex-schema`) are the exception — they have no build.
6. Run `pnpm test` before committing.

Method and traps in full: [`tasks/fix-prompts.md`](tasks/fix-prompts.md), "Shared
brief".
