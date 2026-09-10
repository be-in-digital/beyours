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
 * What counts is ATTRIBUTION and not the word: a co-author trailer crediting the
 * assistant, a `Claude-*` trailer, a link to a session or to the product, a
 * "generated with" credit. Naming `CLAUDE.md` in a subject — which this
 * repository does routinely — is not attribution and stays legal, and
 * `SELF_TEST_CASES` holds that as an accepted case so it cannot be quietly
 * tightened away. `ATTRIBUTION_RULES` below says where each line is drawn.
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
 * What that narrowing costs, stated rather than discovered later. A trailer
 * reading `Co-authored-by: Claude <claude@example.com>` passes, because nothing
 * in it distinguishes the assistant from a colleague. Nor is any of this a
 * defence against deliberate evasion — a Cyrillic `С` or a zero-width space
 * walks through it, and both were measured doing so. This guards against a
 * harness appending its footer and against an honest mistake, which is what put
 * 17 commits on `main`; an author who wants the credit in can have it.
 *
 * The first four rules enforced "no Anthropic address and no model name", which
 * is narrower than `CLAUDE.md`'s "no reference to the assistant at all" — and
 * an audit measured the gap rather than arguing about it: a robot emoji used as
 * a signature, a bare `Claude Code` in a body line, `AI-generated`, and
 * `Made with Claude` all passed. `assistant-name`, `ai-credit` and
 * `robot-signature` close those, and the verb list of `generated-with` closes
 * the fourth. Each is deliberately whole-line or subject-qualified, because
 * this product has an AI-generated blog and a GPT translation pipeline: those
 * are things a commit here legitimately talks about.
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
      /^[ \t]*(?:#[ \t]*)?(?:co-authored-by|assisted-by|generated-by|signed-off-by)[ \t]*:.*(?:@anthropic\.com|\banthropic\b|claude[ -]?(?:code|ai|opus|sonnet|haiku|\d))/i,
    // A COMPLETE trailer and nothing else, so removing the line removes exactly
    // it. Deciding this on the prefix alone deleted the rest of the sentence
    // when somebody wrote about a trailer in a body paragraph — measured, and
    // the commit still landed with the sentence cut off mid-air.
    removable:
      /^[ \t]*(?:#[ \t]*)?(?:co-authored-by|assisted-by|generated-by|signed-off-by)[ \t]*:[^<>]*<[^<>\s]+>[ \t]*$/i,
  },
  {
    id: "assistant-trailer",
    why: "a Claude-* trailer (Claude-Session, Claude-Model, …)",
    match: /^[ \t]*(?:#[ \t]*)?claude-(?!md\b)[a-z-]+[ \t]*:/i,
    // A one-token value: `Claude-Session: <url>`. A sentence that opens the
    // same way carries spaces and is handed back to its author instead.
    removable: /^[ \t]*(?:#[ \t]*)?claude-(?!md\b)[a-z-]+[ \t]*:[ \t]*\S*[ \t]*$/i,
  },
  {
    id: "generated-with",
    why: 'a "generated with" credit',
    // The verb list is the widening #438's audit asked for: the rule read
    // `generated` alone, so "Made with Claude" and "Built with Claude Code" —
    // the two credits a person types by hand rather than a harness appending
    // its footer — walked straight through it.
    //
    // `\bclaude` within 40 characters is what keeps it honest, and it is not
    // decoration: this repository's own history carries "missed the 200 exports
    // built with `storeQuery`", and a verb list without the subject would refuse
    // that commit. A guard that refuses a commit somebody had every right to
    // write gets deleted rather than fixed.
    match:
      /\b(?:generated|made|built|written|created|authored|produced|crafted)\s+(?:with|by)\b[^\n]{0,40}\bclaude(?!\.md)/i,
    // The harness footer is its own line, emoji and markdown link included —
    // and it is a footer, so it is short. A paragraph that opens with the same
    // words is prose and goes back to its author.
    removable:
      /^[ \t]*(?:[^\p{L}\p{N}\s]{1,3}[ \t]*)?(?:generated|made|built|written|created|authored|produced|crafted)\s+(?:with|by)\b[^\n]{0,80}$/iu,
  },
  {
    id: "assistant-name",
    why: "a bare mention of the assistant by product name",
    // `CLAUDE.md` rule 10 is "no reference to Claude at all", and the four
    // rules above enforced something narrower — no Anthropic address, no
    // trailer, no link, no "generated with". So "Refactored by Claude Code."
    // in a body line, which is the plainest possible violation of the written
    // rule, passed.
    //
    // Narrow on purpose, and each exclusion is a commit somebody may write:
    //   - `CLAUDE.md` is named routinely here, and the separator class does not
    //     admit `.`, so the filename cannot match.
    //   - `Claude Dupont` is a colleague. The second word has to be one of the
    //     product names.
    //   - `claude.ai/code` is already `session-link`'s, whose reason is sharper.
    match: /\bclaude[ \t-]+(?:code|ai|opus|sonnet|haiku)\b/i,
    // Only a line that is nothing BUT the credit — a footer, optionally behind
    // an emoji. "Refactored by Claude Code." is a sentence, and deleting the
    // sentence to enforce a naming rule is not the hook's business: it is
    // handed back to its author.
    removable:
      /^[ \t]*(?:[^\p{L}\p{N}\s]{1,3}[ \t]*)?claude[ \t-]+(?:code|ai|opus|sonnet|haiku)[ \t.!]*$/iu,
  },
  {
    id: "ai-credit",
    why: 'an "AI-generated" credit on the commit itself',
    // Whole-line, and that is the whole design. This product HAS an
    // AI-generated blog (`blogAutoQueue`, `blogAutoConfig`, the GPT translation
    // pipeline), so "AI-generated" is ordinary vocabulary in a subject here:
    // `feat(blog-auto): schedule AI-generated articles for the week` is a
    // commit about a feature, not a credit, and refusing it would get this
    // guard deleted. A line that is NOTHING but the credit is not describing a
    // feature — nobody writes `AI-generated.` on its own line about a blog.
    match:
      /^[ \t]*(?:[^\p{L}\p{N}\s]{1,3}[ \t]*)?(?:this\s+(?:commit|change|patch|code|pull\s+request)\s+(?:was|is)\s+)?ai[ \t-]*(?:generated|assisted|authored|written)(?:\s+(?:with|by)\s[^\n]{0,40})?[ \t.!]*$/iu,
    // It matched the whole line, so removing the line removes exactly it.
    removable:
      /^[ \t]*(?:[^\p{L}\p{N}\s]{1,3}[ \t]*)?(?:this\s+(?:commit|change|patch|code|pull\s+request)\s+(?:was|is)\s+)?ai[ \t-]*(?:generated|assisted|authored|written)(?:\s+(?:with|by)\s[^\n]{0,40})?[ \t.!]*$/iu,
  },
  {
    id: "robot-signature",
    why: "a robot emoji used as a signature",
    // A line whose entire content is 🤖, punctuation and space. The harness
    // footer opens with one and the four rules above catch that footer by its
    // words; strip the words and the emoji alone was a signature nothing read.
    //
    // Whole-line and emoji-only, so it cannot fire on a commit that puts a
    // robot in a sentence — a CHANGELOG entry about the KDS, say.
    match: /^[ \t]*[\p{P}\p{S}\s]*🤖[\p{P}\p{S}\s]*$/u,
    removable: /^[ \t]*[\p{P}\p{S}\s]*🤖[\p{P}\p{S}\s]*$/u,
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
 * Identities that GitHub turns into an attribution trailer of its own.
 *
 * WHY THIS EXISTS, and it is a correction rather than a widening. This module
 * deliberately did not read author or committer identity, on the stated
 * reasoning that "squash-merge drops branch authorship, so refusing it would
 * fail pull requests over commits that never land". That is false, and it was
 * falsified by the commit it was written beside.
 *
 * Measured on #446, whose squash `e5394e5` carries a permanent
 * `Co-authored-by: Claude <noreply@anthropic.com>` on `main`:
 *
 *   - all three branch commits are AUTHORED by `Claude <noreply@anthropic.com>`
 *   - not one of their three messages contains a trailer of any kind
 *   - the squash message ends `---------` then the trailer, which is GitHub's
 *     own synthesis format, not text copied from anywhere
 *
 * Squash-merge does not drop branch authorship. It converts it into a
 * `Co-authored-by` line, credited to every distinct author in the batch. So a
 * message scan alone can read three clean commits and watch the merge write the
 * violation itself, which is exactly what happened — a red CI on `main`, a
 * `Release` and a `Publish mirror` that never started, and history nobody may
 * rewrite.
 *
 * A LIST, NOT A HEURISTIC. Each row is an identity a harness commits as. That
 * is deliberate: `CLAUDE.md` records that Claude is an ordinary French given
 * name, and a guard that refuses a commit from a colleague called Claude gets
 * switched off rather than obeyed. So the address is what decides wherever
 * there is an address to decide on, and the one name rule below is bounded to
 * shapes a person does not have. Adding an assistant means adding a row here
 * and a case to `SELF_TEST_CASES`.
 */
export const IDENTITY_RULES = [
  {
    id: "assistant-address",
    why: "a commit authored by an AI assistant's own account",
    // The decisive signal, and the one #446 took. A person does not hold an
    // address at these domains.
    match: ({ email }) => /@(?:anthropic\.com|openai\.com)$/i.test(email),
  },
  {
    id: "assistant-bot-account",
    why: "a commit authored by an AI assistant's bot account",
    // GitHub's own no-mailbox addresses, which is how Copilot and friends
    // appear. Matched on the local part, since the domain is shared with every
    // human who hides their address.
    match: ({ email }) =>
      /^\d*\+?(?:copilot|devin|claude|cursor|codex)(?:\[bot\])?@users\.noreply\.github\.com$/i.test(
        email
      ),
  },
  {
    id: "assistant-identity",
    why: "a commit authored under the assistant's product name",
    // `Claude`, `Claude Code`, `Claude Opus 5` — a product name, not a person's.
    // Bounded twice, because this is the row that could refuse a colleague:
    // the name must be the product name and NOTHING else (so `Claude Dupont`
    // cannot match), and the address must be one with no mailbox behind it (so
    // a real Claude who receives mail is never asked about it).
    match: ({ name, email }) =>
      /^claude(?:[ \t-]+(?:code|ai|opus|sonnet|haiku|fable)(?:[ \t-]*\d+(?:\.\d+)?)?)?$/i.test(
        name.trim()
      ) && /(?:^noreply@|^no-reply@|\.noreply\.|@users\.noreply\.github\.com$)/i.test(email),
  },
]

/**
 * The first identity rule `{ name, email }` trips, or null.
 *
 * An empty name or address trips nothing: git records both for every commit,
 * and inventing a verdict from a missing field is how a guard starts refusing
 * things nobody can explain.
 */
export function findAttributingIdentity(name, email) {
  const identity = { name: name ?? "", email: email ?? "" }
  if (!identity.email && !identity.name) return null
  for (const rule of IDENTITY_RULES) {
    if (rule.match(identity)) return rule
  }
  return null
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
 * Lines as a reader sees them, not as `split("\\n")` sees them.
 *
 * A lone CR is a line separator to every editor and to `git log`'s own display,
 * and git keeps one in a message. Splitting on "\\n" alone made
 * `subject\\rCo-Authored-By: …` a single line, which no `^`-anchored trailer
 * rule can match — an adversarial pass got a trailer through the CI check that
 * way.
 */
export function splitLines(text) {
  return (text ?? "").split(/\r\n|\r|\n/)
}

/**
 * Every attributing line in a message, with the 1-based line number git would
 * count. `removable` says whether the hook may delete the line or has to hand
 * it back to its author.
 */
export function findAttribution(message) {
  const found = []
  splitLines(message).forEach((text, i) => {
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

  // Rewriting is done on "\n" lines, because those are the ones this function
  // may put back. A CR inside such a line is reported and never rewritten: the
  // detection below sees the CR-separated parts, but deleting the whole "\n"
  // line would take its other parts with it.
  head.split("\n").forEach((text, i) => {
    // A trailing CR is half of a CRLF ending, not a separator inside the line:
    // a message written on Windows must still have its footer stripped rather
    // than handed back.
    const line = text.endsWith("\r") ? text.slice(0, -1) : text
    const parts = line.split("\r")
    const rule = parts.map(matchLine).find(Boolean)
    if (!rule) {
      kept.push(text)
      return
    }
    const hit = { line: i + 1, text: line.trim(), rule: rule.id, why: rule.why }
    if (parts.length === 1 && rule.removable.test(line)) {
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
    name: "a robot emoji alone is a signature",
    message: "feat: a change\n\n🤖\n",
    expect: "reject",
  },
  {
    name: "a bare Claude Code mention in the body is refused",
    message: "feat: a change\n\nRefactored by Claude Code.\n",
    expect: "reject",
  },
  {
    name: 'a "Made with Claude" credit is refused',
    message: "feat: a change\n\nMade with Claude\n",
    expect: "reject",
  },
  {
    name: 'a "Built with Claude Code" credit is refused',
    message: "feat: a change\n\nBuilt with Claude Code\n",
    expect: "reject",
  },
  {
    name: "an AI-generated credit on its own line is refused",
    message: "feat: a change\n\nAI-generated\n",
    expect: "reject",
  },
  {
    name: "a self-referential AI-assisted sentence is refused",
    message: "feat: a change\n\nThis commit was AI-assisted.\n",
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
  {
    // The product's own vocabulary. `blogAutoQueue` writes AI-generated
    // articles, and a commit about that feature is not a credit.
    name: "an AI-generated FEATURE in a subject is not a credit",
    message: "feat(blog-auto): schedule AI-generated articles for the week\n",
    expect: "accept",
  },
  {
    name: "describing the AI translation pipeline is not a credit",
    message: "docs: explain how the AI-assisted translation queue drains\n",
    expect: "accept",
  },
  {
    // This repository's own history: `built with` followed by a code
    // identifier, not by an assistant.
    name: "a credit verb without the assistant is prose",
    message: "fix: count the 200 exports built with storeQuery as public\n",
    expect: "accept",
  },
  {
    name: "an emoji in a sentence is not a signature",
    message: "feat(kds): show a 🤖 badge on tickets an automation created\n",
    expect: "accept",
  },

  /* ── Identity, which is the other way a trailer reaches `main` ─────────── */

  {
    // #446 exactly: three clean messages, and GitHub wrote the trailer from
    // this.
    name: "the assistant's own account authoring a clean message",
    identity: { name: "Claude", email: "noreply@anthropic.com" },
    expect: "reject",
  },
  {
    name: "the assistant's account under a model name",
    identity: { name: "Claude Opus 5", email: "noreply@anthropic.com" },
    expect: "reject",
  },
  {
    name: "an assistant's GitHub bot account",
    identity: { name: "Copilot", email: "198982749+Copilot@users.noreply.github.com" },
    expect: "reject",
  },
  {
    name: "the product name with no mailbox behind it",
    identity: { name: "Claude", email: "12345+claude@users.noreply.github.com" },
    expect: "reject",
  },
  {
    // Reaches `assistant-identity` specifically. The case above cannot: it
    // trips `assistant-bot-account` first, so without this one the name rule
    // was covered by nothing — found by the coverage assertion in
    // `apps/reference/__tests__/commit-attribution.test.ts`, which is what that
    // assertion is for.
    name: "the product name on a no-reply address of our own",
    identity: { name: "Claude Code", email: "no-reply@be-in-digital.fr" },
    expect: "reject",
  },
  {
    // The case that decides whether this guard survives contact with the team.
    // `CLAUDE.md` says it in as many words: Claude is an ordinary French given
    // name. Refusing a colleague's commit gets a guard switched off.
    name: "a colleague called Claude is not an assistant",
    identity: { name: "Claude Dubois", email: "claude.dubois@restaurant.fr" },
    expect: "accept",
  },
  {
    name: "a colleague called Claude hiding their address is still a colleague",
    identity: { name: "Claude Dupont", email: "72397342+claude-dupont@users.noreply.github.com" },
    expect: "accept",
  },
  {
    // Every squash on `main` is committed by this. Refusing it would refuse
    // the entire history.
    name: "GitHub's own committer identity",
    identity: { name: "GitHub", email: "noreply@github.com" },
    expect: "accept",
  },
  {
    name: "a person with a GitHub no-reply address",
    identity: { name: "Mamadou Faye Seck", email: "72397342+doums85@users.noreply.github.com" },
    expect: "accept",
  },
]

/**
 * Which self-test cases the detector currently gets wrong. Empty is the only
 * good answer.
 *
 * A case carries either a `message` or an `identity`, and both kinds run here
 * rather than in two harnesses: `check-commit-attribution.mjs` proves the guard
 * once before trusting it, so a rule that is not covered by THIS function is a
 * rule nothing proves.
 */
export function runSelfTest(cases = SELF_TEST_CASES) {
  const broken = []
  for (const testCase of cases) {
    const verdict = testCase.identity
      ? findAttributingIdentity(testCase.identity.name, testCase.identity.email)
        ? "reject"
        : "accept"
      : findAttribution(testCase.message).length > 0
        ? "reject"
        : "accept"
    if (verdict !== testCase.expect) {
      broken.push(`${testCase.name} — expected to ${testCase.expect}, but it would ${verdict}`)
    }
  }
  return broken
}
