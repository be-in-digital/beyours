/**
 * ESLint rules guarding the Convex authorisation seam.
 *
 * WHY THESE EXIST: the audit did not find 112 independent mistakes, it found one
 * habit repeated 112 times — wrapping a package definition in a bare `query()`
 * or an auth-only `authedMutation()` and moving on. Sprint 2 corrected the call
 * sites; these rules correct the habit, so the next wrapper cannot regress
 * silently.
 *
 * They apply to an app's `convex/**\/*.ts` — the place where a Convex function
 * becomes publicly callable.
 *
 * They live in this package, next to the seam they enforce, rather than inside
 * one app: `apps/reference` and `apps/themes` wrap the same package definitions,
 * so a rule that existed in only one of them would let the client template drift
 * back into exactly the habit the rule exists to stop.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT #445 MEASURED, AND WHY THIS FILE WAS REWRITTEN
 *
 * A synthetic harness of twelve declarations — one control that must error, one
 * control that must pass, ten known evasions — was run against this rule on
 * ESLint 9.39.4. TEN OF THE TWELVE SLIPPED. That is not a rule with gaps; that
 * is a rule whose passing means nothing, and it had 154 markers riding on it.
 *
 * It also produced a real exploit rather than a hypothetical one.
 * `convex/validateIntegration.ts` carried `@guarded-inline: checks settings:read
 * by role` and put the check INSIDE `if (!identity) { … }`, so only
 * unauthenticated callers reached it — and they were rejected on the next line
 * anyway. Every signed-in account, a diner's included, skipped it entirely and
 * could drive credential probes against the restaurant's Uber Eats and
 * Deliveroo credentials. The rule passed the file because the STRINGS
 * `ctx.auth` and `ctx.runQuery(` both appeared somewhere in the declaration.
 *
 * That is the through-line of every evasion: the rule read the declaration as
 * TEXT. `sourceCode.getText()` returns comments and string literals too, so a
 * mention of a guard in prose counted as a guard, a variable merely NAMED
 * `requireFoo` counted as a call to it, and a guard could sit on a branch no
 * real caller takes. The rewrite reads the AST instead, and asks three
 * questions text cannot answer:
 *
 *   1. Is the signal a CALL, or just a name that looks like one? (Case I)
 *   2. Is it in code, or in a comment or a string? (Case C)
 *   3. Does every caller reach it, or only callers on one branch? (The live
 *      exploit, and Case B's cousin.)
 *
 * WHAT IS STILL NOT MACHINE-CHECKABLE, said plainly rather than papered over:
 * a marker's REASON. Case K of the harness — `@public-by-design` with a long
 * but meaningless reason — passes this rule and will keep passing it. A
 * sentence cannot be graded by a linter. The length floor below is a filter for
 * shrugs, not a judgement of honesty, and review remains the only thing that
 * reads the reason. What changed is that the reason is now the ONLY part left
 * to human judgement, instead of being the part everyone trusted while the
 * mechanism underneath it was decorative.
 */

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

/**
 * Every wrapper that makes a definition callable, and what it proves.
 *
 * A map rather than the four Sets this used to keep, because the interesting
 * question turned out to be the one the Sets could not express: is this callee
 * a builder AT ALL? A name absent from all four Sets was silently ignored, so
 * `publicMutation(defs.remove)` — a wrapper somebody adds next week, or a
 * typo — was not "not a builder", it was unreviewed. (Harness case F.)
 */
const BUILDERS = new Map([
  // No authorisation whatsoever.
  ["query", "bare"],
  ["mutation", "bare"],
  // Publicly callable, no `ctx.db`, so it cannot use the store-scoped seam.
  ["action", "action"],
  // No session and no tenant: anyone on the internet with `curl`.
  ["httpAction", "http"],
  // Checks a session, not the tenant.
  ["authedQuery", "authOnly"],
  ["authedMutation", "authOnly"],
  // Checks the tenant, and should also name a permission.
  ["storeQuery", "store"],
  ["storeMutation", "store"],
])

/**
 * Builders that are not reachable by a client at all.
 *
 * `internalQuery`/`internalMutation`/`internalAction` are callable only from
 * other Convex functions, so there is no caller to authorise. They are listed
 * — rather than left to fall through as "unknown" — because 214 of them exist
 * in this repository and every one would otherwise be reported.
 */
const INTERNAL_BUILDERS = new Set(["internalQuery", "internalMutation", "internalAction"])

// ---------------------------------------------------------------------------
// Markers
// ---------------------------------------------------------------------------

/**
 * Three distinct escape hatches, deliberately not one.
 *
 * `@public-by-design` — meant to be reachable by anyone: the storefront
 * catalogue, a token-guarded tracking page.
 *
 * `@guarded-inline` — IS authorised, just not through the seam: the handler
 * derives the caller from the session, or applies a policy the store-scoped
 * builders cannot express.
 *
 * `@unguarded-tracked` — a known hole with an owner, which is the only honest
 * answer for the three OAuth callbacks reachable by anyone and protected by
 * nothing. It must name an issue, so it is a to-do list rather than a shrug.
 */
const ANNOTATION = "@public-by-design"
const GUARDED_ANNOTATION = "@guarded-inline"
const TRACKED_ANNOTATION = "@unguarded-tracked"

/**
 * A marker only counts written as an annotation WITH a reason.
 *
 * It used to count as a substring of any comment, so prose describing the
 * marker — "the `@public-by-design` note below claimed the opposite" — silenced
 * the rule for the declaration underneath it.
 */
const MARKER_PATTERN = /@(public-by-design|guarded-inline|unguarded-tracked):[ \t]*(\S.*)$/m

/** A tracked gap has to name the issue tracking it. */
const ISSUE_PATTERN = /#\d+/

/** Shorter than this is a shrug, not a reason. */
const MIN_REASON_LENGTH = 12

// ---------------------------------------------------------------------------
// AST helpers
// ---------------------------------------------------------------------------

/** Walk up to the `export const …` statement the comments sit above. */
function statementOf(node) {
  let statement = node
  while (statement.parent && statement.parent.type !== "Program") {
    statement = statement.parent
  }
  return statement
}

/** The identifier a callee ultimately names, or null. */
function calleeName(callee) {
  if (callee.type === "Identifier") return callee.name
  // `server.mutation(…)` is `mutation(…)` with extra steps, and it used to be
  // invisible: the rule returned early on any callee that was not an
  // Identifier. (Harness case G.)
  if (callee.type === "MemberExpression" && !callee.computed && callee.property.type === "Identifier") {
    return callee.property.name
  }
  return null
}

/**
 * Follow `const m = mutation` back to `mutation`.
 *
 * One hop, deliberately. A second alias of an alias is not a thing this
 * codebase does, and an unbounded walk would need cycle detection to be safe.
 * An alias chain the rule cannot follow lands in "unknown builder", which
 * reports rather than ignores — the failure direction that matters.
 * (Harness case H.)
 */
function resolveAlias(node, scope) {
  if (node.type !== "Identifier") return null
  let current = scope
  while (current) {
    const variable = current.variables.find((v) => v.name === node.name)
    if (variable) {
      for (const def of variable.defs) {
        const init = def.node?.type === "VariableDeclarator" ? def.node.init : null
        if (init && init.type === "Identifier" && BUILDERS.has(init.name)) return init.name
        if (init && init.type === "Identifier" && INTERNAL_BUILDERS.has(init.name)) return init.name
      }
      return null
    }
    current = current.upper
  }
  return null
}

/**
 * Generic AST walk over real child nodes.
 *
 * `visit` may return `false` to stop descending. Comments are not children of
 * anything in ESTree, so walking the tree — rather than reading the source
 * text — excludes them for free, which is the whole of harness case C.
 */
function walk(node, visit, parent = null) {
  if (!node || typeof node.type !== "string") return
  if (visit(node, parent) === false) return
  for (const key of Object.keys(node)) {
    if (key === "parent" || key === "loc" || key === "range") continue
    const value = node[key]
    if (Array.isArray(value)) {
      for (const child of value) {
        if (child && typeof child.type === "string") walk(child, visit, node)
      }
    } else if (value && typeof value.type === "string") {
      walk(value, visit, node)
    }
  }
}

/**
 * Does this parent/child pair mean the child runs only on some paths?
 *
 * The list is the point of the whole rewrite. A guard the caller may not reach
 * is not a guard, and `validateIntegration` proved it in production: the
 * permission check sat in `if (!identity) { … }`, which every authenticated
 * caller skips.
 *
 * `IfStatement.test` is deliberately absent — a guard called IN the condition
 * (`if (!(await requirePermission(ctx))) …`) runs for everyone. Same for the
 * left of a `&&`: it always evaluates.
 */
function isBranch(parent, child) {
  switch (parent.type) {
    case "IfStatement":
      return child === parent.consequent || child === parent.alternate
    case "ConditionalExpression":
      return child === parent.consequent || child === parent.alternate
    case "LogicalExpression":
      return child === parent.right
    case "SwitchCase":
      return parent.consequent.includes(child)
    case "CatchClause":
      return child === parent.body
    case "ForStatement":
    case "ForInStatement":
    case "ForOfStatement":
    case "WhileStatement":
    case "DoWhileStatement":
      return child === parent.body
    default:
      return false
  }
}

/** Every identifier in a dotted path, `internal.authHelpers.checkPermission`. */
function pathSegments(node) {
  const parts = []
  let current = node
  while (current?.type === "MemberExpression") {
    if (!current.computed && current.property.type === "Identifier") parts.unshift(current.property.name)
    current = current.object
  }
  if (current?.type === "Identifier") parts.unshift(current.name)
  return parts
}

/**
 * Does this `ctx.run*(ref, …)` dispatch into the internal seam?
 *
 * `internal.…` is the whole of the test, and the boundary it draws is the one
 * this rule genuinely cannot cross: a guard that lives in ANOTHER Convex
 * function. `payments.refundPayment` is authorised by
 * `internal.payments.internalLoadForRefund`, `stripeWebhook.handleWebhook` by
 * `internal.stripeWebhookVerify.verify`, `bidStripeWebhook` by
 * `internal.bidSubscription.processWebhookEvent` — all correct, none of it
 * visible from the calling file, and a rule that demanded the guard be inline
 * would report four working handlers and teach everyone to delete the marker.
 *
 * A narrower first draft matched only names that LOOKED like checks
 * (`checkPermission`, `requireX`). It reported all four, which is how the
 * boundary was found: naming is not something a linter may legislate.
 *
 * So the bar is deliberately the documented convention rather than proof —
 * the rule's own message tells authors to "check authorisation with
 * `ctx.runQuery(internal.…)`". What the rule adds over the version that let
 * the exploit through is the two things it CAN check, and they are the two
 * that failed in `validateIntegration`: the dispatch has to be a real call in
 * code rather than a mention in a comment, and it has to sit where every
 * caller reaches it.
 */
function dispatchesToAGuard(node) {
  const [reference] = node.arguments
  if (!reference) return false
  const [root] = pathSegments(reference)
  return root === "internal"
}

/**
 * The variable a branch-bound guard writes its verdict into, if any.
 *
 * `isValid = await verifySignature(…)` → `"isValid"`.
 * `const user = await requireStaff(ctx)` → `"user"`.
 * A bare `await ctx.runQuery(check…)` → `null`, because nothing downstream can
 * depend on a result that was not kept.
 */
function assignedFlagOf(node) {
  let current = node.parent
  // Step over the `await` and any parenthesising.
  while (current && (current.type === "AwaitExpression" || current.type === "TSNonNullExpression")) {
    current = current.parent
  }
  if (!current) return null
  if (current.type === "AssignmentExpression" && current.left.type === "Identifier") {
    return current.left.name
  }
  if (current.type === "VariableDeclarator" && current.id.type === "Identifier") {
    return current.id.name
  }
  return null
}

/**
 * Is this call's result used at all, or thrown away?
 *
 * The only thing separating `getCurrentUser` — which RETURNS the caller's own
 * session user, and is therefore scoped to the caller by construction — from
 * harness case B, which awaits `getUserIdentity()` and ignores it. A call whose
 * enclosing expression is a bare statement produced nothing anyone can act on.
 *
 * The honest limit, stated because the rest of this file states its limits:
 * this asks whether a session lookup is USED, not whether it is used
 * CORRECTLY. A handler that reads an identity, keeps it in a variable and then
 * ignores what it says still passes here, and review is what catches that.
 */
function isConsumed(node) {
  let current = node.parent
  while (current && (current.type === "AwaitExpression" || current.type === "TSNonNullExpression")) {
    current = current.parent
  }
  return Boolean(current) && current.type !== "ExpressionStatement"
}

/**
 * Is this call's value what the handler hands back?
 *
 * `return authComponent.safeGetAuthUser(ctx)` — the function's whole output is
 * the caller's own session user, which no other caller can obtain.
 */
function isReturnedDirectly(node) {
  let current = node.parent
  while (current && (current.type === "AwaitExpression" || current.type === "TSNonNullExpression")) {
    current = current.parent
  }
  return Boolean(current) && (current.type === "ReturnStatement" || current.type === "ArrowFunctionExpression")
}

/**
 * Guard calls, split by how strong the evidence is.
 *
 * STRONG — the call itself rejects: `requireX()`, `assertX()`, `checkX()`,
 * `requireStaff()`, or a `ctx.runQuery(internal.…)` to a checker. These throw,
 * so reaching the next line means the caller passed.
 *
 * WEAK — the call merely OBTAINS an identity: `ctx.auth.getUserIdentity()`,
 * `getAuthUser()`, `safeGetAuthUser()`. Knowing who the caller is authorises
 * nothing on its own; harness case B is exactly this, a bare
 * `getUserIdentity()` whose result is never looked at. A weak signal counts
 * only when the declaration also REFUSES somebody — a `throw`, or a `return`
 * of a refusal — on a branch. That is the shape every honest inline guard in
 * this repository already has:
 *
 *     const user = await getAuthUser(ctx)
 *     if (!hasPermission(user.role, "stores:write")) throw new Error(…)
 *
 * A STRANDED STRONG SIGNAL OVERRIDES BOTH, and this is the case that took a
 * second pass to get right. `validateIntegration` satisfies weak-plus-refusal
 * honestly: it obtains an identity and it refuses the callers who have none.
 * What it does not do is CHECK A PERMISSION for the callers who do — its one
 * `checkPermission` call sits inside `if (!identity)`, the branch that by
 * construction only unauthenticated callers take, and they are rejected on the
 * next line regardless. So a declaration that reaches for a permission check
 * and then puts it somewhere the success path never goes is reported even when
 * the weaker shape would have passed it: the strong signal is evidence the
 * author believed authorisation was needed here, and the branch is evidence it
 * does not happen.
 *
 * This is the difference between "is the caller signed in" and "may the caller
 * do this", which is the whole distinction the seam exists to keep.
 */
function guardEvidence(statement, sourceCode) {
  let strongUnconditional = false
  let strongAnywhere = false
  let weakUnconditional = false
  let anySignal = false
  let refuses = false
  let returnsTheCaller = false
  /** Variables a branch-bound guard wrote its verdict into. */
  const strandedFlags = new Set()
  /** Identifiers read by a test on the path every caller takes. */
  const testedAtTop = new Set()

  const branchDepth = new Map()
  branchDepth.set(statement, 0)

  walk(statement, (node, parent) => {
    const depth = parent
      ? (branchDepth.get(parent) ?? 0) + (isBranch(parent, node) ? 1 : 0)
      : 0
    branchDepth.set(node, depth)

    // A refusal: `throw …`, anywhere. `return { valid: false }` counts too —
    // several handlers refuse by returning rather than throwing.
    if (node.type === "ThrowStatement") refuses = true

    // Every identifier read by an `if (…)` on the unconditional path. The test
    // of an `if` runs for all callers even though its body does not, which is
    // what lets a fail-closed flag rescue a branch-bound guard below.
    if (node.type === "IfStatement" && depth === 0) {
      walk(node.test, (inner) => {
        if (inner.type === "Identifier") testedAtTop.add(inner.name)
      })
    }

    if (node.type !== "CallExpression") return
    const name = calleeName(node.callee)
    if (!name) return

    const isStrong =
      /^_?(require|assert|check|ensure)[A-Z_]/.test(name) ||
      name === "requireStaff" ||
      // Provider-side proof, which is all an `httpAction` has: there is no
      // session to check, so an HMAC over the raw body IS the authorisation.
      /^verify[A-Z_]/.test(name) ||
      name === "timingSafeEqual" ||
      // `ctx.runQuery(internal.authHelpers.checkPermission, …)` is a guard.
      // `ctx.runAction(internal.deliveroo.processOrder, …)` is the work the
      // handler exists to do. Treating every `ctx.run*` as a guard — which the
      // first draft did — read the Deliveroo webhook's order dispatch as its
      // authorisation, so the reference being dispatched to is what decides.
      (/^run(Query|Mutation|Action)$/.test(name) && dispatchesToAGuard(node))
    // `AuthUser` covers getAuthUser, safeGetAuthUser, requireAuthUser and
    // `authComponent.safeGetAuthUser`; `getUserIdentity` is Convex's own.
    const isWeak = /AuthUser$/.test(name) || name === "getUserIdentity"

    if (!isStrong && !isWeak) return
    anySignal = true
    if (isStrong) strongAnywhere = true
    if (depth === 0) {
      if (isStrong) strongUnconditional = true
      else if (isConsumed(node)) {
        weakUnconditional = true
        // A handler whose RESULT IS the session lookup is scoped to its caller
        // by construction — `getCurrentUser` returns
        // `authComponent.safeGetAuthUser(ctx)` and nothing else, so there is
        // nobody left to refuse. Demanding a `throw` there asked for a line
        // that could only ever be dead.
        if (isReturnedDirectly(node)) returnsTheCaller = true
      }
    } else if (isStrong) {
      // A guard on a branch still counts when its VERDICT is tested on the
      // path everybody takes — the fail-closed flag, which is how every
      // signature-verifying webhook in this repository is written:
      //
      //     let isValid = false
      //     if (signature) isValid = await verifySignature(…)
      //     if (!isValid) return new Response("Invalid signature", 401)
      //
      // The distinction from `validateIntegration` is exactly this: there the
      // permission check's result went nowhere, so no later line could depend
      // on it. Here `isValid` carries the verdict out of the branch.
      const flag = assignedFlagOf(node)
      if (flag) strandedFlags.add(flag)
    }
  })

  // A `return` whose argument mentions a falsy `valid`/`ok`/`authorized` flag,
  // or a bare `return null` inside a branch, is how the non-throwing handlers
  // refuse. Looked for only when nothing threw, to keep the common case cheap.
  if (!refuses) {
    walk(statement, (node, parent) => {
      if (node.type !== "ReturnStatement" || !parent) return
      let ancestor = parent
      while (ancestor && ancestor !== statement) {
        if (ancestor.type === "IfStatement" || ancestor.type === "SwitchCase") {
          refuses = true
          return false
        }
        ancestor = ancestor.parent
      }
    })
  }

  // A branch-bound guard whose verdict is tested on the main path is as good
  // as an unconditional one.
  const rescued = [...strandedFlags].some((flag) => testedAtTop.has(flag))
  const strongEffective = strongUnconditional || rescued

  // `stranded` is checked before `sufficient` by the caller: a permission
  // check that exists and cannot be reached is a stronger statement about the
  // declaration than the identity lookup that can.
  return {
    any: anySignal,
    stranded: strongAnywhere && !strongEffective,
    sufficient: strongEffective || (weakUnconditional && (refuses || returnsTheCaller)),
    onlyConditional: anySignal && !strongEffective && !weakUnconditional,
  }
}

/**
 * Is this call shaped like a Convex function definition?
 *
 * Used only to decide whether an UNRECOGNISED builder deserves a report. It
 * has to be narrow: `convex/` files also export `v.union(…)` validators,
 * `httpRouter()`, `cronJobs()` and `defineSchema({ … })`, and reporting those
 * would make the rule unusable and get it turned off — which is the failure
 * mode that matters most here.
 *
 * The two shapes that ARE definitions: `builder({ args, handler })` and
 * `builder(defs.someName)`.
 */
function looksLikeDefinition(node) {
  const [first] = node.arguments
  if (!first) return false
  // `handler`, not `handler` OR `args`: a Convex function is the thing with a
  // handler, and accepting `args` alone would sweep in every options object.
  if (first.type === "ObjectExpression") {
    return first.properties.some(
      (p) => p.type === "Property" && p.key.type === "Identifier" && p.key.name === "handler"
    )
  }
  // The `query(defs.list)` wrapper form. Narrowed to a `…defs` namespace —
  // the convention every wrapper in both apps already follows (`defs`,
  // `blogDefs`, `cmsDefs`) — because "any member expression" also described
  // `createClient(components.betterAuth)`, the Better Auth component client,
  // which is not a Convex function and was reported as an unknown builder.
  if (first.type === "Identifier") return /defs$/i.test(first.name)
  if (first.type === "MemberExpression") {
    const [root] = pathSegments(first)
    return typeof root === "string" && /defs$/i.test(root)
  }
  return false
}

/**
 * The builder name of a call, if this call is plausibly a builder at all.
 *
 * The distinction `calleeName` alone cannot draw, and getting it wrong is not
 * theoretical: reading every `x.query(…)` as the `query` BUILDER reported 56
 * `ctx.db.query("userProfiles")` calls across the real tree — ordinary database
 * reads inside handlers — as unguarded public functions. A rule that shouts at
 * correct code gets switched off, and then it guards nothing at all, which is a
 * worse outcome than the hole it was written to close.
 *
 * So a dotted callee (`server.mutation(…)`) counts as a builder ONLY where a
 * builder can actually appear: as the direct initialiser of an `export const`.
 * `ctx.db.query(…)` inside a handler never is. A bare identifier
 * (`mutation(…)`) is judged on its name as before — that is unambiguous.
 */
function builderNameOf(node) {
  if (node.callee.type === "Identifier") return node.callee.name
  if (!isExportedInitialiser(node)) return null
  return calleeName(node.callee)
}

/**
 * Is this call the DIRECT initialiser of an `export const …`?
 *
 * Direct is the load-bearing word. The first attempt asked `statementOf(node)`
 * whether the enclosing STATEMENT was an export, which is true of every call
 * nested anywhere inside one — so `ctx.runQuery(internal.authHelpers.check…)`
 * in a handler body was read as an exported definition built by an unknown
 * builder named `runQuery`, and three honest declarations were reported. The
 * shape that makes a function publicly callable is `export const x = f(…)` and
 * nothing else.
 */
function isExportedInitialiser(node) {
  const declarator = node.parent
  if (!declarator || declarator.type !== "VariableDeclarator" || declarator.init !== node) return false
  const declaration = declarator.parent
  if (!declaration || declaration.type !== "VariableDeclaration") return false
  const parent = declaration.parent
  return parent?.type === "ExportNamedDeclaration" || parent?.type === "ExportDefaultDeclaration"
}

/**
 * The `permission:` property of an object argument, as a usable value.
 *
 * It used to be a presence check on the KEY, so `permission: undefined` — the
 * key is there, the value authorises nothing — satisfied it completely.
 * (Harness case E.) Now the value has to be a non-empty string literal, which
 * is the only form `storeMutation` can act on anyway.
 */
function permissionValue(node) {
  const [first] = node.arguments
  if (!first || first.type !== "ObjectExpression") return null
  const property = first.properties.find(
    (p) =>
      p.type === "Property" &&
      ((p.key.type === "Identifier" && p.key.name === "permission") ||
        (p.key.type === "Literal" && p.key.value === "permission"))
  )
  if (!property) return { present: false }
  const { value } = property
  if (value.type === "Literal" && typeof value.value === "string" && value.value.length > 0) {
    return { present: true, value: value.value }
  }
  return { present: true, value: null }
}

/** Does this definition delete or write anything? */
function mutatesData(node) {
  let writes = false
  walk(node, (child) => {
    if (child.type !== "CallExpression") return
    const name = calleeName(child.callee)
    if (name === "delete" || name === "insert" || name === "patch" || name === "replace") {
      // `ctx.db.delete(…)` — the object has to be a `db`, not any `.delete()`.
      const object = child.callee.type === "MemberExpression" ? child.callee.object : null
      if (object && object.type === "MemberExpression" && object.property?.name === "db") writes = true
    }
  })
  return writes
}

// ---------------------------------------------------------------------------
// Rule: every exposed function says how it is protected
// ---------------------------------------------------------------------------

export const noUnguardedConvexFunction = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Convex functions exposed from an app must be store-scoped, or explicitly marked public",
    },
    schema: [],
    messages: {
      bare:
        "`{{name}}(…)` exposes this function with no authorisation. Use `storeQuery`/`storeMutation`, " +
        "or add a `// {{annotation}}: <reason>` comment above it if it is genuinely public.",
      authOnly:
        "`{{name}}(…)` only checks that someone is logged in — any account of any restaurant passes. " +
        "Use `storeQuery`/`storeMutation` so the tenant is checked too.",
      bareAction:
        "`action(…)` is publicly callable and this one checks nothing. An action has no `ctx.db`, so " +
        "check authorisation with `ctx.runQuery(internal.…)` and mark it `// {{guarded}}: <reason>` — " +
        "or `// {{annotation}}: <reason>` if it is genuinely open to anyone.",
      bareHttp:
        "`httpAction(…)` answers anyone on the internet — there is no session to check and no tenant " +
        "to scope to. Say what protects it: `// {{guarded}}: <reason>` when the handler verifies a " +
        "signature, consumes a single-use state or reads an unguessable token, or " +
        "`// {{annotation}}: <reason>` when the route is genuinely open to all.",
      missingReason:
        "`{{marker}}` needs a reason after the colon — `// {{marker}}: <why this is safe>`. The marker " +
        "silences the rule; the reason is the only part a reviewer can weigh.",
      guardedWithoutGuard:
        "`{{guarded}}` claims this function authorises the caller itself, but the declaration CALLS " +
        "nothing that could reject one — no `require`/`assert`/`check` call, no " +
        "`ctx.runQuery(internal.…)`, no session lookup. A guard named in a comment or held in a " +
        "variable is not a guard. Either call one, or say `{{annotation}}` if it is open to anyone.",
      guardedOnABranch:
        "`{{guarded}}` claims an inline guard, but every guard call in this declaration sits inside a " +
        "conditional, a loop or a `catch` — so there is a path through the handler that reaches none " +
        "of them. This is the `validateIntegration` defect: the check lived in `if (!identity) {…}`, " +
        "which every signed-in caller skips. Move the guard onto the path every caller takes.",
      guardedWithoutRefusal:
        "`{{guarded}}` claims an inline guard, but the only signal here OBTAINS an identity " +
        "(`getUserIdentity`/`getAuthUser`) and the declaration never refuses anybody — no `throw`, no " +
        "conditional `return`. Knowing who is calling is not authorising them.",
      trackedWithoutIssue:
        "`{{tracked}}` records a known hole, so it has to name the issue that owns it — " +
        "`// {{tracked}}: #123 — <what is missing>`. Without one it is not tracked, it is ignored.",
      unknownBuilder:
        "`{{name}}(…)` is not a builder this rule knows, so nothing here says whether the function it " +
        "exports is authorised. Wrap it with `storeQuery`/`storeMutation` (or one of the `internal*` " +
        "builders if it is not client-callable), or add `{{name}}` to BUILDERS in " +
        "`packages/convex-functions/eslint/convex-auth.mjs` with the guarantee it provides. An " +
        "unrecognised wrapper used to be silently ignored, which is how a wrapper that checks nothing " +
        "would enter unreviewed.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode ?? context.getSourceCode()

    /** Which escape hatch is claimed above this node, and with what reason. */
    function readAnnotation(node) {
      const statement = statementOf(node)
      for (const comment of sourceCode.getCommentsBefore(statement)) {
        const match = MARKER_PATTERN.exec(comment.value)
        if (match) return { marker: match[1], reason: match[2].trim() }
      }
      return null
    }

    /**
     * Does an escape hatch excuse this node?
     *
     * Reports and returns `true` for a marker that is present but not honest.
     * Such a marker still suppresses the "unguarded" message: two errors on one
     * line describing the same problem help nobody, and the one naming the
     * broken claim is the more useful of the two.
     */
    function excused(node) {
      const annotation = readAnnotation(node)
      if (!annotation) return false

      const marker = `@${annotation.marker}`

      if (annotation.reason.length < MIN_REASON_LENGTH) {
        context.report({ node, messageId: "missingReason", data: { marker } })
        return true
      }

      if (annotation.marker === "unguarded-tracked" && !ISSUE_PATTERN.test(annotation.reason)) {
        context.report({
          node,
          messageId: "trackedWithoutIssue",
          data: { tracked: TRACKED_ANNOTATION },
        })
        return true
      }

      if (annotation.marker === "guarded-inline") {
        const evidence = guardEvidence(statementOf(node), sourceCode)
        if (!evidence.any) {
          context.report({
            node,
            messageId: "guardedWithoutGuard",
            data: { guarded: GUARDED_ANNOTATION, annotation: ANNOTATION },
          })
        } else if (evidence.stranded || evidence.onlyConditional) {
          context.report({
            node,
            messageId: "guardedOnABranch",
            data: { guarded: GUARDED_ANNOTATION },
          })
        } else if (!evidence.sufficient) {
          context.report({
            node,
            messageId: "guardedWithoutRefusal",
            data: { guarded: GUARDED_ANNOTATION },
          })
        }
        return true
      }

      return true
    }

    return {
      CallExpression(node) {
        const named = builderNameOf(node)
        if (!named) return

        const scope = sourceCode.getScope ? sourceCode.getScope(node) : context.getScope()
        const resolved =
          BUILDERS.has(named) || INTERNAL_BUILDERS.has(named)
            ? named
            : (resolveAlias(node.callee, scope) ?? named)

        if (INTERNAL_BUILDERS.has(resolved)) return

        const kind = BUILDERS.get(resolved)

        if (!kind) {
          // Only an exported, definition-shaped call is a function this rule
          // has anything to say about. Everything else in a `convex/` file —
          // validators, routers, cron tables, helpers — is not one.
          if (isExportedInitialiser(node) && looksLikeDefinition(node)) {
            context.report({ node, messageId: "unknownBuilder", data: { name: named } })
          }
          return
        }

        if (kind === "store") return

        if (excused(node)) return

        if (kind === "bare") {
          context.report({ node, messageId: "bare", data: { name: resolved, annotation: ANNOTATION } })
        } else if (kind === "action") {
          context.report({
            node,
            messageId: "bareAction",
            data: { annotation: ANNOTATION, guarded: GUARDED_ANNOTATION },
          })
        } else if (kind === "http") {
          context.report({
            node,
            messageId: "bareHttp",
            data: { annotation: ANNOTATION, guarded: GUARDED_ANNOTATION },
          })
        } else if (kind === "authOnly") {
          context.report({ node, messageId: "authOnly", data: { name: resolved } })
        }
      },
    }
  },
}

// ---------------------------------------------------------------------------
// Rule: a store-scoped function names the permission it needs
// ---------------------------------------------------------------------------

export const requireConvexPermission = {
  meta: {
    type: "problem",
    docs: {
      description: "Store-scoped Convex functions must declare the permission they require",
    },
    schema: [],
    messages: {
      missing:
        "`{{name}}(…)` checks that the caller belongs to the restaurant but not what they may do — " +
        'a kitchen account passes. Add `permission: "resource:action"`.',
      notAString:
        "`{{name}}(…)` declares a `permission` that is not a literal string, so there is nothing to " +
        "check against. `permission: undefined` satisfied the old rule and authorised nobody; write " +
        'the permission out — `permission: "orders:write"`.',
      readPermissionOnAWrite:
        '`{{name}}(…)` writes to the database but only asks for `{{permission}}`, a READ permission. ' +
        "A role that may look at this data is not thereby allowed to change it — a waiter holds " +
        "`customers:read`. Name the write permission this operation actually needs.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode ?? context.getSourceCode()
    return {
      CallExpression(node) {
        const named = builderNameOf(node)
        if (!named) return
        const scope = sourceCode.getScope ? sourceCode.getScope(node) : context.getScope()
        const resolved = BUILDERS.has(named) ? named : (resolveAlias(node.callee, scope) ?? named)
        if (BUILDERS.get(resolved) !== "store") return

        const permission = permissionValue(node)
        if (!permission || !permission.present) {
          context.report({ node, messageId: "missing", data: { name: resolved } })
          return
        }
        if (permission.value === null) {
          context.report({ node, messageId: "notAString", data: { name: resolved } })
          return
        }

        // A `:read` permission on a definition that writes. The harness case
        // was `storeMutation` with `permission: "orders:read"` on a delete —
        // syntactically complete, semantically the wrong question.
        if (permission.value.endsWith(":read") && mutatesData(node)) {
          context.report({
            node,
            messageId: "readPermissionOnAWrite",
            data: { name: resolved, permission: permission.value },
          })
        }
      },
    }
  },
}

/** The plugin object an app's flat config registers under `convex/`. */
const convexAuthPlugin = {
  rules: {
    "no-unguarded-convex-function": noUnguardedConvexFunction,
    "require-convex-permission": requireConvexPermission,
  },
}

export default convexAuthPlugin
