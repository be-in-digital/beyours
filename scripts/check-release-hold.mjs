#!/usr/bin/env node
/**
 * Refuse to publish while the hold is in place.
 *
 * Usage:
 *   node scripts/check-release-hold.mjs            # exit 1 when held (local `pnpm release`)
 *   node scripts/check-release-hold.mjs --report   # exit 0 always, write held=… to $GITHUB_OUTPUT
 *
 * Two modes because the two callers want opposite things from the same fact.
 * A person running `pnpm release` on their machine wants to be STOPPED, loudly,
 * with the reason — a non-zero exit is the only thing a shell reliably notices.
 * A workflow wants the fact as a job output so the steps downstream can stand
 * down cleanly: a red `Release` is indistinguishable from a publish that broke,
 * and the mirror's `workflow_run` path fires only on a green one, so failing
 * the run to report a deliberate hold would stop the sync as collateral — the
 * same trap `publish-plan.mjs` documents for `bump_owed`.
 */

import { appendFileSync } from 'node:fs'

import { formatHold, HOLD_FILE, releaseHold } from './lib/release-hold.mjs'

const report = process.argv.includes('--report')
const hold = releaseHold()

if (report) {
  const output = process.env.GITHUB_OUTPUT
  if (output) appendFileSync(output, `held=${hold !== null}\n`)

  if (hold) {
    console.log(formatHold(hold))
    console.log(`::warning::Publication is held by ${HOLD_FILE} — ${hold.reason}`)

    const summary = process.env.GITHUB_STEP_SUMMARY
    if (summary) {
      appendFileSync(
        summary,
        [
          '### Publication is held',
          '',
          hold.reason,
          '',
          `Delete \`${hold.file}\` and merge to publish. Until then this workflow`,
          'verifies everything and publishes nothing.',
          '',
        ].join('\n'),
      )
    }
  } else {
    console.log(`No \`${HOLD_FILE}\` — publication may proceed.`)
  }

  process.exit(0)
}

if (hold) {
  console.error(formatHold(hold))
  process.exit(1)
}

console.log(`No \`${HOLD_FILE}\` — publication may proceed.`)
