/**
 * Is publication deliberately held?
 *
 * WHY THIS EXISTS. `changeset publish` compares the workspace versions against
 * the registry and publishes whatever is missing, so a merged version bump
 * releases itself — that is the whole design of `release.yml`, and it is
 * normally the right one. It stops being the right one while the repository is
 * mid-rename: `packages/*` now carry the `@be-yours` scope at `1.0.0`, which
 * the registry has never seen, so the first merge to `main` would publish ten
 * brand-new packages on a scope whose org configuration has not been checked
 * yet, and a published npm version cannot be taken back — `npm unpublish` is
 * refused outright on GitHub Packages, and even where it is allowed the version
 * number is burned for good.
 *
 * So the chain asks one more question before it publishes, and the answer is a
 * FILE. Its presence is the hold; deleting it is the release. That shape is
 * deliberate:
 *
 *   - it is reviewable — lifting the hold is a diff, on a branch, like any
 *     other change, rather than a setting somebody flips in a web form;
 *   - it cannot be forgotten in the "on" position without being seen, because
 *     it sits at the repository root under a name that reads as a stop sign;
 *   - it needs no secret, no environment and no variable, so it works the same
 *     way locally (`pnpm release`) and in CI.
 *
 * The alternative — marking the ten packages `private: true` — would hold the
 * publish too, and would do it by lying about what the packages are in ten
 * files that then have to be un-lied in ten more.
 *
 * Everything here is pure except the one `readFileSync`, so the callers can be
 * tested without a fixture repository.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/** The repository root, resolved from this file rather than the working directory. */
export const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url))

/** The hold file. Its PRESENCE holds the release; removing it is the release. */
export const HOLD_FILE = 'RELEASE_HOLD.md'

/**
 * The hold's stated reason: the first blockquote in the file.
 *
 * A blockquote rather than a key/value header so the file stays a document
 * somebody reads, not a config file with prose stuck to it. `> ` lines at the
 * top are the summary either way.
 */
export function parseReason(source) {
  const quoted = []
  for (const line of source.split('\n')) {
    const match = /^>\s?(.*)$/.exec(line)
    if (match) {
      quoted.push(match[1].trim())
      continue
    }
    if (quoted.length > 0) break
  }
  const reason = quoted.join(' ').trim()
  return reason.length > 0 ? reason : null
}

/**
 * `null` when publication is free to proceed, otherwise why it is not.
 *
 * A hold file that cannot be READ still holds. The question this answers is
 * "may this run publish?", and an unreadable answer is not a yes — the same
 * fail-safe direction `lib/registry.mjs` takes on a registry that will not
 * answer.
 */
export function releaseHold({ root = REPO_ROOT } = {}) {
  let source
  try {
    source = readFileSync(`${root}/${HOLD_FILE}`, 'utf8')
  } catch (error) {
    if (error.code === 'ENOENT') return null
    return {
      file: HOLD_FILE,
      reason: `\`${HOLD_FILE}\` exists but could not be read (${error.code}). Refusing to read that as permission to publish.`,
      readable: false,
    }
  }

  return {
    file: HOLD_FILE,
    reason: parseReason(source) ?? `\`${HOLD_FILE}\` is present and states no reason.`,
    readable: true,
  }
}

/** The block a CI log or a terminal gets. */
export function formatHold(hold) {
  return [
    `Publication is HELD by \`${hold.file}\`.`,
    '',
    `  ${hold.reason}`,
    '',
    `To release: delete \`${hold.file}\`, open a pull request, and merge it.`,
    'The next push to `main` publishes. Nothing else has to change.',
  ].join('\n')
}
