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
 * Each rule carries `match`, which decides whether a line is attribution, and
 * `removable`, which decides whether the hook may delete that line outright.
 * The two differ because a trailer IS a line while a session link can sit in
 * the middle of a sentence, and a hook that deletes the sentence around it has
 * corrupted somebody's message to enforce a formatting rule. Where `removable`
 * does not match, the hook refuses the commit and says why instead.
 *
 * The matching is narrow on both axes, because a guard that refuses a commit
 * somebody had every right to write gets deleted rather than fixed:
 *
 *   - A co-author trailer is attribution when it carries an `@anthropic.com`
 *     address or names a model. `Co-authored-by: Claude Dupont <c@…fr>` is a
 *     colleague — Claude is an ordinary French given name — and must pass.
 *   - `anthropic.com` counts only with the `@`, so a commit that adds the
 *     domain to a CSP allowlist is not attribution.
 *   - `claude` never counts when it is `CLAUDE.md`, which commit subjects here
 *     name routinely.
 *
 * `why` is printed to whoever tripped the rule, so it is written for them and
 * not for us. Adding an assistant means adding a row here and a case to
 * `SELF_TEST_CASES`; nothing else in the repository knows these shapes.
 */
export const ATTRIBUTION_RULES = [
  {
    id: "co-author",
    why: "a co-author trailer crediting an AI assistant",
    // Anchored at the start of a line: a trailer is a line, and a body
    // paragraph that quotes one is prose, not a trailer.
    match:
      /^[ \t]*(?:#[ \t]*)?(?:co-authored-by|assisted-by|generated-by|signed-off-by)[ \t]*:.*(?:@anthropic\.com|claude[ -](?:code|opus|sonnet|haiku)|claude-\d)/i,
    // The trailer is the whole line, so removing the line removes exactly it.
    removable: /^[ \t]*(?:#[ \t]*)?(?:co-authored-by|assisted-by|generated-by|signed-off-by)[ \t]*:/i,
  },
  {
    id: "assistant-trailer",
    why: "a Claude-* trailer (Claude-Session, Claude-Model, …)",
    match: /^[ \t]*(?:#[ \t]*)?claude-(?!md\b)[a-z-]+[ \t]*:/i,
    removable: /^[ \t]*(?:#[ \t]*)?claude-(?!md\b)[a-z-]+[ \t]*:/i,
  },
  {
    id: "generated-with",
    why: 'a "generated with" credit',
    match: /generated\s+(?:with|by)\b[^\n]{0,40}\bclaude(?!\.md)/i,
    // The harness footer is its own line, emoji and markdown link included.
    removable: /^[ \t]*(?:[^\p{L}\p{N}\s]{1,3}[ \t]*)?generated\s+(?:with|by)\b[^\n]*$/iu,
  },
  {
    id: "session-link",
    why: "a link to an assistant session or to the assistant's product page",
    match: /(?:claude\.ai\/code|claude\.com\/claude-code|@anthropic\.com)/i,
    // Only a line that is nothing but the link. Anything else is a sentence.
    removable:
      /^[ \t]*(?:[^\p{L}\p{N}\s]{1,3}[ \t]*)?(?:<)?(?:https?:\/\/)?(?:www\.)?claude\.(?:ai\/code|com\/claude-code)\S*(?:>)?[ \t]*$/iu,
  },
]

/**
 * `git commit -v` appends the diff after a scissors line, and git throws that
 * half away itself. A `+Co-Authored-By: …` in a diff of THIS file is not a
 * trailer on the commit being written, and stripping it would edit the diff
 * somebody asked to see.
 *
 * Only the hook splits on it. The CI check reads what git RECORDED, where
 * nothing was thrown away: `--cleanup=verbatim` keeps a scissors line, and a
 * check that stopped reading there would be told what to ignore by the message
 * it is judging.
 */
const SCISSORS = /^[ \t]*(?:#[ \t]*)?-{2,}[ \t]*>8[ \t]*-{2,}/

/** Split a raw message file into the part git keeps and the part it discards. */
export function splitAtScissors(message) {
  const lines = (message ?? "").split("\n")
  const at = lines.findIndex((line) => SCISSORS.test(line))
  if (at === -1) return { head: message ?? "", tail: "" }
  return { head: lines.slice(0, at).join("\n"), tail: lines.slice(at).join("\n") }
}

/**
 * The first rule a line trips, or null. `ATTRIBUTION_RULES` is ordered
 * most-specific-first on purpose: the harness footer trips both
 * `generated-with` and `session-link`, and the reason printed to whoever wrote
 * it should be the sharpest true thing about the line.
 *
 * A `#` line is NOT exempt. `git commit -m` cleans with `whitespace`, which
 * keeps comment lines, so `-m "subject" -m "# Co-Authored-By: Claude <…>"`
 * records the trailer for real — an exemption here would have been a hole in
 * the only layer that cannot be bypassed. Nothing is lost by it: the hook
 * removing a commented-out trailer from an editor template changes a line git
 * was going to drop anyway.
 */
export function matchLine(line) {
  for (const rule of ATTRIBUTION_RULES) {
    if (rule.match.test(line)) return rule
  }
  return null
}

/**
 * Every attributing line in a message, with the 1-based line number git would
 * count. `removable` says whether the hook may delete the line or has to hand
 * it back to its author.
 */
export function findAttribution(message) {
  const found = []
  ;(message ?? "").split("\n").forEach((text, i) => {
    const rule = matchLine(text)
    if (rule) {
      found.push({
        line: i + 1,
        text: text.trim(),
        rule: rule.id,
        why: rule.why,
        removable: rule.removable.test(text),
      })
    }
  })
  return found
}

/**
 * The message with the removable lines gone, and the ones it will not touch
 * reported instead.
 *
 * Removing a trailer block leaves the blank line that separated it from the
 * body, and a message ending in blank lines reads as an accident. So runs of
 * blank lines collapse and the tail is trimmed — but only when something was
 * actually removed, because reformatting a clean message is not this hook's
 * business.
 *
 * `blocked` is attribution inside a sentence — a session link cited mid-body.
 * Deleting that line would take the sentence with it, so the caller refuses the
 * commit and lets its author decide what the paragraph should say.
 *
 * `message` is empty when the message was nothing BUT attribution. The caller
 * decides what to do about that; this function does not invent a subject.
 */
export function stripAttribution(message) {
  const { head, tail } = splitAtScissors(message)
  const kept = []
  const removed = []
  const blocked = []

  head.split("\n").forEach((text, i) => {
    const rule = matchLine(text)
    if (!rule) {
      kept.push(text)
      return
    }
    const hit = { line: i + 1, text: text.trim(), rule: rule.id, why: rule.why }
    if (rule.removable.test(text)) {
      removed.push(hit)
    } else {
      blocked.push(hit)
      kept.push(text)
    }
  })

  if (removed.length === 0) return { message: message ?? "", removed, blocked }

  let body = kept.join("\n").replace(/\n{3,}/g, "\n\n").replace(/\s+$/, "")
  if (body) body += "\n"
  return { message: body + tail, removed, blocked }
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
    name: "a colleague named Claude is not an assistant",
    message: "fix: close the refund path\n\nCo-authored-by: Claude Dupont <c.dupont@beindigital.fr>\n",
    expect: "accept",
  },
  {
    name: "a domain in a commit subject is not an address",
    message: "feat(csp): allow anthropic.com in the connect-src allowlist\n",
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
