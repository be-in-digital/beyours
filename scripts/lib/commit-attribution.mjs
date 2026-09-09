/**
 * Assistant attribution in a commit message: find it, and take it back out.
 *
 * `CLAUDE.md` rule 10 and the conventions in `tasks/fix-prompts.md` both forbid
 * any AI attribution in anything that reaches Git. Both are prose, and nothing
 * executed either of them. #409 measured what that cost across the 24-commit
 * window `4e625bde..3a6cb8d1`: 27 `Co-Authored-By:` lines and 21 session links,
 * on 17 of the 24 commits. `main` is protected and its history is not to be
 * rewritten, so those stay as they are — the defect is that nothing was
 * stopping the next 24 from doing the same.
 *
 * The matching is deliberately narrow. A guard that fires on a commit somebody
 * had every right to write is a guard that gets switched off within the week,
 * and this repository names `CLAUDE.md` in commit subjects routinely —
 * `113c9120` and the `Check CLAUDE.md's commands and documents` step both do.
 * So the rules below match ATTRIBUTION: a co-author trailer crediting the
 * assistant, a `Claude-*` trailer, a link to a session or to the product, a
 * "generated with" credit. Naming the file is not attribution and must stay
 * legal; `SELF_TEST_CASES` holds that as an accepted case so it cannot be
 * quietly tightened away.
 *
 * Pure on purpose, like `scripts/lib/source-drift.mjs`: it is imported by the
 * `commit-msg` hook (`.githooks/commit-msg`, which strips) and by the CI
 * assertion (`scripts/check-commit-attribution.mjs`, which refuses), and it is
 * tested without a git repository at
 * `apps/reference/__tests__/commit-attribution.test.ts`.
 */

/**
 * What counts as attribution, one rule per shape that has actually appeared.
 *
 * `why` is printed to whoever tripped the rule, so it is written for them and
 * not for us. Adding an assistant means adding a row here and a case to
 * `SELF_TEST_CASES`; nothing else in the repository knows these shapes.
 */
export const ATTRIBUTION_RULES = [
  {
    id: "co-author",
    why: "a co-author trailer crediting an AI assistant",
    // Anchored at the start of a line: a trailer is a line, and `git log`
    // output quoting one inside a body paragraph is not what we are after.
    match: /^[ \t]*(?:co-authored-by|assisted-by|generated-by|signed-off-by)[ \t]*:.*(?:claude|anthropic)/i,
  },
  {
    id: "assistant-trailer",
    why: "a Claude-* trailer (Claude-Session, Claude-Model, …)",
    match: /^[ \t]*claude-[a-z-]+[ \t]*:/i,
  },
  {
    id: "generated-with",
    why: 'a "generated with" credit',
    match: /generated\s+(?:with|by)\b[^\n]{0,40}claude/i,
  },
  {
    id: "session-link",
    why: "a link to an assistant session or to the assistant's product page",
    match: /(?:claude\.ai\/code|claude\.com\/claude-code|anthropic\.com)/i,
  },
]

/**
 * `git commit -v` appends the diff after a scissors line, and git throws that
 * half away itself. A `+Co-Authored-By: …` in a diff of THIS file is not a
 * trailer on the commit being written, and reporting it would be a lie.
 */
const SCISSORS = /^[ \t]*(?:#[ \t]*)?-{2,}[ \t]*>8[ \t]*-{2,}/

/** Split a raw message file into the part git keeps and the part it discards. */
export function splitAtScissors(message) {
  const lines = message.split("\n")
  const at = lines.findIndex((line) => SCISSORS.test(line))
  if (at === -1) return { head: message, tail: "" }
  return { head: lines.slice(0, at).join("\n"), tail: lines.slice(at).join("\n") }
}

/** Git strips its own comment lines; they are neither reported nor removed. */
const isComment = (line) => line.trimStart().startsWith("#")

/**
 * The first rule a line trips, or null. `ATTRIBUTION_RULES` is ordered
 * most-specific-first on purpose: the harness footer trips both
 * `generated-with` and `session-link`, and the reason printed to whoever wrote
 * it should be the sharpest true thing about the line.
 */
export function matchLine(line) {
  if (isComment(line)) return null
  for (const rule of ATTRIBUTION_RULES) {
    if (rule.match.test(line)) return { id: rule.id, why: rule.why }
  }
  return null
}

/**
 * Every attributing line in a message, with the 1-based line number git would
 * count. Comments and the `-v` diff are excluded, as above.
 */
export function findAttribution(message) {
  const { head } = splitAtScissors(message ?? "")
  const found = []
  head.split("\n").forEach((text, i) => {
    const hit = matchLine(text)
    if (hit) found.push({ line: i + 1, text: text.trim(), rule: hit.id, why: hit.why })
  })
  return found
}

/**
 * The message with those lines gone.
 *
 * Removing a trailer block leaves the blank line that separated it from the
 * body, and a message ending in blank lines reads as an accident. So runs of
 * blank lines collapse and the tail is trimmed — but only when something was
 * actually removed, because reformatting a clean message is not this hook's
 * business.
 *
 * `message` is empty when the message was nothing BUT attribution. The caller
 * decides what to do about that; this function does not invent a subject.
 */
export function stripAttribution(message) {
  const { head, tail } = splitAtScissors(message ?? "")
  const kept = []
  const removed = []

  head.split("\n").forEach((text, i) => {
    const hit = matchLine(text)
    if (hit) removed.push({ line: i + 1, text: text.trim(), rule: hit.id, why: hit.why })
    else kept.push(text)
  })

  if (removed.length === 0) return { message: message ?? "", removed }

  let body = kept.join("\n").replace(/\n{3,}/g, "\n\n").replace(/\s+$/, "")
  if (body) body += "\n"
  return { message: body + tail, removed }
}

/**
 * What a run must NOT examine, read from the Actions event payload rather than
 * from a `${{ }}` expression in the workflow: the expression form has to be
 * repeated per event and is silently empty on the events it was not written
 * for, which is how a range check ends up examining nothing and reporting a
 * pass.
 *
 * Exclusions rather than a single base, because the question is "what does this
 * branch ADD" and not "what is between two commits". `main` here carries 17
 * attributed commits that #409 rules out of rewriting, and merging `main` into
 * a branch — which is how this repository resolves conflicts, since rewriting
 * somebody's branch is refused — would otherwise drag every one of them into
 * the range and fail a pull request over history nobody is allowed to fix. A
 * commit reachable from the base BRANCH is already merged; whatever is wrong
 * with it, it is not this pull request's to answer for.
 *
 * Returns null when the event carries nothing usable — a branch's first push
 * has `before` all zeroes, and there is no honest range for it.
 */
export function exclusionsFromEvent(eventName, payload) {
  if (!payload) return null
  if (eventName === "pull_request" || eventName === "pull_request_target") {
    const sha = payload.pull_request?.base?.sha
    const ref = payload.pull_request?.base?.ref
    // The snapshot AND the branch as it stands now: `base.sha` is the base tip
    // when the pull request was last synchronised, so it goes stale, and the
    // remote-tracking ref alone is absent if the checkout never fetched it.
    const refs = [sha, ref ? `origin/${ref}` : null].filter(Boolean)
    return refs.length ? { refs, source: `${eventName} event: base.sha and base.ref` } : null
  }
  if (eventName === "merge_group") {
    const sha = payload.merge_group?.base_sha
    return sha ? { refs: [sha], source: "merge_group event: merge_group.base_sha" } : null
  }
  if (eventName === "push") {
    // A push has no base branch to subtract — the commits it carries ARE the
    // new ones. Excluding `origin/main` here would exclude the push itself and
    // make the run vacuous.
    const before = payload.before
    if (!before || /^0+$/.test(before)) return null
    return { refs: [before], source: "push event: before" }
  }
  return null
}

/**
 * Events where "0 commits examined" is impossible and therefore a bug in the
 * range, not a clean result. A pull request always has at least its own head
 * commit, and the merge queue always has the batch — so a green built on an
 * empty range is exactly the hollow pass `scripts/assert-e2e-ran.mjs` exists to
 * refuse, one workflow file away.
 */
export function rangeMustHaveCommits(eventName) {
  return eventName === "pull_request" || eventName === "pull_request_target" || eventName === "merge_group"
}

/**
 * The cases the guard checks itself against before it is trusted to judge
 * anything, on every single run. Two of the four accepted cases are the ones
 * that would make somebody delete the check: a commit that names `CLAUDE.md`,
 * and a human co-author.
 */
export const SELF_TEST_CASES = [
  {
    name: "a co-author trailer crediting the assistant is refused",
    message: "feat: a change\n\nCo-Authored-By: Claude Opus 5 <noreply@anthropic.com>\n",
    expect: "reject",
  },
  {
    name: "a session trailer is refused",
    message: "feat: a change\n\nClaude-Session: https://claude.ai/code/session_01Au4\n",
    expect: "reject",
  },
  {
    name: "a generated-with credit is refused",
    message: "feat: a change\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\n",
    expect: "reject",
  },
  {
    name: "a bare session link in the body is refused",
    message: "feat: a change\n\nSee https://claude.ai/code/session_01Au4 for the transcript.\n",
    expect: "reject",
  },
  {
    name: "naming CLAUDE.md is not attribution",
    message: "docs: pin CLAUDE.md's feature count to the commit it was measured at\n",
    expect: "accept",
  },
  {
    name: "a human co-author is not attribution",
    message: "fix: close the refund path\n\nCo-authored-by: Jane Doe <jane@example.com>\n",
    expect: "accept",
  },
  {
    name: "the -v diff below the scissors line is not the message",
    message:
      "chore: add the guard\n\n" +
      "# ------------------------ >8 ------------------------\n" +
      "diff --git a/x b/x\n+Co-Authored-By: Claude <noreply@anthropic.com>\n",
    expect: "accept",
  },
  {
    name: "a commented-out trailer in the editor template is not the message",
    message: "chore: something\n\n# Co-Authored-By: Claude <noreply@anthropic.com>\n",
    expect: "accept",
  },
]

/** Which self-test cases the detector currently gets wrong. Empty is the only good answer. */
export function runSelfTest(cases = SELF_TEST_CASES) {
  const broken = []
  for (const testCase of cases) {
    const hits = findAttribution(testCase.message)
    const verdict = hits.length > 0 ? "reject" : "accept"
    if (verdict !== testCase.expect) {
      broken.push(`${testCase.name} — expected to ${testCase.expect}, but it would ${verdict}`)
    }
  }
  return broken
}
