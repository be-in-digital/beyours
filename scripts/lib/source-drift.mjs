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
 * AND WHAT "COVERED" USED TO MEAN, WHICH WAS NOT WHAT IT SAID. A package whose
 * source had moved and whose changeset was waiting was printed as `covered`,
 * next to `clean`, under a closing line reading "Every package with source
 * changes since its last release carries a changeset." — and exit 0. All of
 * that is true and none of it is "released". A changeset is by construction an
 * UNCONSUMED release: `changeset version` deletes the file when it cuts one, so
 * a changeset that still exists is proof the release has not happened. The
 * registry therefore still serves the pre-change build under the same version
 * number the workspace carries — #209's "published 2.0.2 and workspace 2.0.2
 * were two different sets of code" — which is why `publish-mirror --check`
 * exits 1 on a package this check called covered. The state is now named
 * `waiting`, its detail says what the registry is serving, and the closing
 * lines state both facts rather than the reassuring half.
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
      entry.since === null
        ? "unknown"
        : changed.length === 0
          ? "clean"
          : covered.has(entry.name)
            ? "waiting"
            : "drifted"

    return { ...entry, changed, state }
  })

  const rank = { drifted: 0, unknown: 1, waiting: 2, clean: 3 }
  rows.sort((a, b) => rank[a.state] - rank[b.state] || a.name.localeCompare(b.name))

  return {
    rows,
    drifted: rows.filter((row) => row.state === "drifted"),
    waiting: rows.filter((row) => row.state === "waiting"),
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
          : row.state === "waiting"
            ? // Spelled out because `covered` used to sit here and read as
              // "shipped". The registry serves ${row.version} — the build from
              // BEFORE these files moved — until someone cuts the release.
              `${row.changed.length} file(s) changed; registry still serves the ${row.version} built before them`
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

/**
 * The `waiting` set, as one line for a CI annotation.
 *
 * Not an error and not silence. `check:source-drift` gates on `drifted` and
 * must not gate on this — batching a few fixes into one release is the
 * intended workflow, and `check-pending-release.mjs` already says at length why
 * failing the Release run would stop the mirror it is reporting on. What was
 * missing is that the run said NOTHING: exit 0, a table reading `covered`, and
 * a closing line that answered a question nobody asked.
 */
export function describeWaiting(waiting) {
  const files = waiting.reduce((total, row) => total + row.changed.length, 0)
  return (
    `${waiting.length} package(s) have source a release has not carried yet: ${files} file(s) across ` +
    `${waiting.map((row) => `${row.name}@${row.version}`).join(", ")}. ` +
    "Each has a changeset, so the next release carries it; until then the registry serves the build " +
    "made before these files moved, and a client site installs that one."
  )
}

/** The `waiting` rows as a markdown block, for $GITHUB_STEP_SUMMARY. */
export function formatWaitingSummary(waiting) {
  return [
    "### Engine source waiting on a release",
    "",
    "These packages have a changeset, so a release will carry them. Until one is",
    "cut, `changeset publish` leaves the registry serving the build made BEFORE",
    "these files moved — under the same version number the workspace carries.",
    "That is the state `publish-mirror --check` exits 1 on.",
    "",
    "| Package | Version on the registry | Files changed since |",
    "| --- | --- | --- |",
    ...waiting.map((row) => `| \`${row.name}\` | ${row.version} | ${row.changed.length} |`),
    "",
    "Run `pnpm version-packages`, commit, and merge to release them.",
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
