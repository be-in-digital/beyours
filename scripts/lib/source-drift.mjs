/**
 * A package whose source has moved since its last version bump, with no
 * changeset to move it again.
 *
 * WHY THIS EXISTS. `changeset publish` answers `already published` and SKIPS a
 * package whose version has not changed. So source that lands without a
 * changeset is not "published later" — it is published never, and the registry
 * keeps serving an older build under a version number the repository has since
 * changed. #209 records `integrations`, `marketing` and `ui` sitting at 2.0.2
 * on GitHub Packages from 2026-07-04 to 2026-08-28 while their source had moved
 * on: published 2.0.2 and workspace 2.0.2 were two different sets of code, and
 * the entire Uber Direct module (~950 lines) never reached a client site.
 *
 * Nothing caught it because nothing could. `apps/themes` links the engine with
 * `workspace:^` and compiles against the current source, so every check in this
 * repository is green by construction; the only place the gap appears is a
 * client installing the published artefact.
 *
 * HOW IT DIFFERS FROM `check:pending-release`. That one reports changesets that
 * exist and are waiting — a release nobody has cut. This one reports the
 * changeset that does NOT exist, which is the failure that cannot resolve
 * itself: a pending changeset is released by the next release, and a missing
 * one is released by nothing, ever.
 *
 * WHAT COUNTS AS A CHANGE. Only `src/`, and not its tests. A published tarball
 * is built from `src`; a test file changes nothing a client installs, and
 * demanding a version bump for one would make the check noise rather than a
 * signal. Everything here is pure — `scripts/check-source-drift.mjs` supplies
 * git.
 */

/** True for a path whose change reaches a client — `src`, minus its tests. */
export function isReleasableSource(rel) {
  const segments = rel.split("/")
  if (!segments.includes("src")) return false
  if (segments.some((s) => s === "__tests__" || s === "__mocks__")) return false

  const file = segments[segments.length - 1]
  return !/\.(test|spec)\.[cm]?[jt]sx?$/.test(file)
}

/**
 * One row per package, worst first, plus the verdict.
 *
 * `entries` are `{ name, dir, version, since, changed }` — `since` the commit
 * that last moved the version and null when git could not say, `changed` the
 * paths that have moved since. `covered` is the set of package names some
 * pending changeset already names.
 *
 * A null `since` is reported as `unknown` and never as drift. That is not
 * hypothetical: `actions/checkout` clones at depth 1 by default, and a bump
 * older than the tip has no commit in that clone. Guessing "drifted" there
 * would fail every shallow run; guessing "clean" would make the check answer
 * "all well" precisely when it knows nothing. Neither is acceptable, so it says
 * so — and `ci.yml` runs this in the one job that fetches full history.
 */
export function summariseDrift(entries, covered) {
  const rows = entries.map((entry) => {
    const changed = (entry.changed ?? []).filter(isReleasableSource)
    const state =
      entry.since === null ? "unknown" : changed.length === 0 ? "clean" : covered.has(entry.name) ? "covered" : "drifted"

    return { ...entry, changed, state }
  })

  const rank = { drifted: 0, unknown: 1, covered: 2, clean: 3 }
  rows.sort((a, b) => rank[a.state] - rank[b.state] || a.name.localeCompare(b.name))

  return {
    rows,
    drifted: rows.filter((row) => row.state === "drifted"),
    unknown: rows.filter((row) => row.state === "unknown"),
  }
}

/** The plain-text block for a CI log. */
export function formatTable(rows) {
  if (rows.length === 0) return "No publishable packages under `packages/`."

  const width = Math.max(...rows.map((row) => row.name.length))
  const lines = ["Source changes since each package's last version bump:", ""]

  for (const row of rows) {
    const detail =
      row.state === "unknown"
        ? "history too shallow to tell"
        : row.changed.length === 0
          ? "no source change"
          : `${row.changed.length} source file(s) changed`
    lines.push(`  ${row.name.padEnd(width)}  ${row.version.padEnd(8)}  ${row.state.padEnd(8)}  ${detail}`)
  }

  return lines.join("\n")
}

/** The same rows as a markdown table, for $GITHUB_STEP_SUMMARY. */
export function formatSummary(drifted) {
  return [
    "### Engine source that no release will carry",
    "",
    "These packages changed under `src/` since their last version bump and no",
    "pending changeset names them. `changeset publish` skips a package whose",
    "version has not moved, so this code reaches no client site — not later, at all.",
    "",
    "| Package | Version | Files changed |",
    "| --- | --- | --- |",
    ...drifted.map((row) => `| \`${row.name}\` | ${row.version} | ${row.changed.length} |`),
    "",
    "Run `pnpm changeset` and describe the change.",
  ].join("\n")
}

/** What a reader should do about one drifted package. */
export function describeDrift(row) {
  const shown = row.changed.slice(0, 5)
  const rest = row.changed.length - shown.length

  return [
    `${row.name} has ${row.changed.length} source file(s) changed since ${row.version} `,
    `was cut, and no changeset names it. A release would skip this package, so the `,
    `change reaches no client site. Run \`pnpm changeset\`. Changed: `,
    shown.join(", "),
    rest > 0 ? ` and ${rest} more` : "",
  ].join("")
}

/**
 * Is a package's version in the working tree already ahead of the registry's?
 *
 * The third answer `check-source-drift` needs about an unpublished subpath, and
 * without it two of this repository's guards demand opposite things.
 *
 * The subpath half asks whether a CHANGESET is waiting to move the version.
 * That is right for the normal path and wrong for the one `publish-mirror.mjs`
 * prints in its own failure text — "run `pnpm version-packages`, commit the
 * bumped package.json and CHANGELOG.md, and merge". Doing that CONSUMES the
 * changesets, which is what versioning is, so `.changeset/` empties and the
 * check calls a finished release "no changeset will move its version".
 * Measured on #445: `convex-functions` at 6.2.0 against a published 6.0.0, and
 * `ui` at 4.2.0 against 4.0.0, both reported as deadlocking the mirror by the
 * very commit that unblocks it.
 *
 * A bump already in the tree is stronger evidence than a pending changeset:
 * `changeset publish` compares each version against the registry and pushes
 * whatever is missing, so the release is written rather than promised.
 *
 * Numeric per segment, so 1.10.0 beats 1.9.0 — a lexical compare gets that
 * backwards. Anything it cannot parse, and any prerelease of the same version,
 * answers `false`: the failure direction that reports rather than waves through.
 */
export function bumpedAhead(workspaceVersion, publishedVersion) {
  const parse = (v) => String(v ?? "").split("-")[0].split(".").map(Number)
  const tree = parse(workspaceVersion)
  const published = parse(publishedVersion)
  if (tree.length !== 3 || published.length !== 3) return false
  if (tree.some(Number.isNaN) || published.some(Number.isNaN)) return false
  for (let i = 0; i < 3; i++) {
    if (tree[i] !== published[i]) return tree[i] > published[i]
  }
  return false
}
