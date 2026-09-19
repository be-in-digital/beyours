import { describe, expect, test } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  formatHold,
  HOLD_FILE,
  parseReason,
  releaseHold,
} from '../../../scripts/lib/release-hold.mjs'

/**
 * The file that stops `changeset publish` from running on its own.
 *
 * `release.yml` publishes by comparing the workspace versions against the
 * registry and pushing whatever is missing, which is the right behaviour except
 * when a scope has just been renamed: the first merge would publish ten new
 * packages, and a published npm version cannot be withdrawn — GitHub Packages
 * refuses `npm unpublish` outright.
 *
 * So the hold is a FILE, and these tests hold it to the one property that
 * matters: every ambiguous state must read as "held". A hold that fails open is
 * not a hold.
 */

const REPO_ROOT = path.join(__dirname, '../../..')

/** A throwaway repository root with, or without, a hold file in it. */
function withRoot(contents: string | null, run: (root: string) => void) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'release-hold-'))
  try {
    if (contents !== null) fs.writeFileSync(path.join(root, HOLD_FILE), contents)
    run(root)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
}

describe('releaseHold', () => {
  test('no file means publication may proceed', () => {
    withRoot(null, (root) => {
      expect(releaseHold({ root })).toBeNull()
    })
  })

  test('a file holds, whatever else is true of it', () => {
    withRoot('# Publication is held\n\n> Because we say so.\n', (root) => {
      const hold = releaseHold({ root })
      expect(hold).not.toBeNull()
      expect(hold?.file).toBe(HOLD_FILE)
      expect(hold?.reason).toBe('Because we say so.')
    })
  })

  test('an empty file still holds, and says it stated no reason', () => {
    withRoot('', (root) => {
      const hold = releaseHold({ root })
      expect(hold).not.toBeNull()
      expect(hold?.reason).toContain('states no reason')
    })
  })

  // The direction that matters. A hold that cannot be read is not permission
  // to publish — the same fail-safe `lib/registry.mjs` takes on a registry
  // that will not answer.
  test('a hold file that cannot be read still holds', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'release-hold-'))
    try {
      // A directory where the file should be: readFileSync throws EISDIR.
      fs.mkdirSync(path.join(root, HOLD_FILE))
      const hold = releaseHold({ root })
      expect(hold).not.toBeNull()
      expect(hold?.readable).toBe(false)
      expect(hold?.reason).toContain('could not be read')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('parseReason', () => {
  test('reads the first blockquote, joined across its lines', () => {
    expect(parseReason('# Title\n\n> one\n> two\n\nbody\n')).toBe('one two')
  })

  test('stops at the first non-quoted line, so later quotes are not the reason', () => {
    expect(parseReason('> the reason\n\nprose\n\n> a later aside\n')).toBe('the reason')
  })

  test('no blockquote at all reads as no stated reason', () => {
    expect(parseReason('# Title\n\njust prose\n')).toBeNull()
  })
})

describe('formatHold', () => {
  test('names the file and the reason, and says how to lift it', () => {
    const text = formatHold({ file: HOLD_FILE, reason: 'mid-rename', readable: true })
    expect(text).toContain(HOLD_FILE)
    expect(text).toContain('mid-rename')
    expect(text).toContain('delete')
  })
})

/**
 * The hold is only worth anything if the things that publish actually consult
 * it. Asserted against the files rather than by running a workflow, for the
 * same reason `monitors-report.test.ts` reads `run:` steps: a gate that was
 * quietly dropped from a workflow is exactly the failure this must catch.
 */
describe('the release chain consults the hold', () => {
  test('`pnpm release` refuses before it builds', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'))
    expect(pkg.scripts.release.startsWith('node scripts/check-release-hold.mjs &&')).toBe(true)
  })

  test('release.yml gates the publish job and re-checks inside it', () => {
    const yml = fs.readFileSync(path.join(REPO_ROOT, '.github/workflows/release.yml'), 'utf8')
    expect(yml).toContain("needs.plan.outputs.held != 'true'")
    expect(yml).toContain('node scripts/check-release-hold.mjs')
  })

  test('publish-mirror.yml stands the sync down rather than pinning nothing', () => {
    const yml = fs.readFileSync(
      path.join(REPO_ROOT, '.github/workflows/publish-mirror.yml'),
      'utf8',
    )
    expect(yml).toContain('check-release-hold.mjs --report')
    expect(yml).toContain("steps.hold.outputs.held != 'true'")
  })
})
