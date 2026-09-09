/**
 * ESLint rules guarding the Convex authorisation seam.
 *
 * WHY THESE EXIST: the audit did not find 112 independent mistakes, it found one
 * habit repeated 112 times — wrapping a package definition in a bare `query()`
 * or an auth-only `authedMutation()` and moving on. Sprint 2 corrected the call
 * sites; these rules correct the habit, so the next wrapper cannot regress
 * silently.
 *
 * They only apply to `convex/*.ts` in an app — the place where a Convex function
 * becomes publicly callable.
 *
 * They live in this package, next to the seam they enforce, rather than inside
 * one app: `apps/reference` and `apps/themes` wrap the same package definitions,
 * so a rule that existed in only one of them would let the client template drift
 * back into exactly the habit the rule exists to stop.
 *
 * THREE WAYS THIS RULE USED TO BE TALKED AROUND, all closed here:
 *
 * 1. `httpAction` was invisible. The rule covered `query`, `mutation` and
 *    `action`, and the HTTP router is the ONE surface reachable without a
 *    Convex client at all — 14 routes taking money, mail and provider
 *    callbacks. Nothing ever required them to say how they were protected, so
 *    nobody had, and the audit could only record their coverage as unknown.
 *
 * 2. The marker was matched as a SUBSTRING of any comment. A line reading
 *    "this is not @public-by-design" opened the gate as wide as the annotation
 *    itself. The check is now anchored to a real annotation with a reason.
 *
 * 3. The two escape hatches were documented as distinct and implemented as
 *    identical — either one satisfied every builder, and neither had to be
 *    true. `@guarded-inline` now has to point at something: a declaration that
 *    claims an inline guard while mentioning no session, no `ctx.runQuery` and
 *    no `require`/`assert`/`check` call is a claim about nothing.
 */

/** Wrappers that expose a function with no authorisation at all. */
const BARE_BUILDERS = new Set(["query", "mutation"]);

/**
 * `action(…)` is just as publicly callable as `query(…)`, and was the rule's
 * blind spot: it covered the two builders the audit had found abused and
 * stopped there, leaving 56 actions — Uber Eats order acceptance, kitchen
 * ticket transitions, Stripe and PayPal calls — reachable by any account.
 *
 * Actions get their own message because the advice differs: an action has no
 * `ctx.db`, so it cannot use the store-scoped builders. It has to check
 * authorisation through `ctx.runQuery(internal.…)` and say so with
 * `@guarded-inline`.
 */
const ACTION_BUILDERS = new Set(["action"]);

/** Wrappers that check a session but not the tenant. */
const AUTH_ONLY_BUILDERS = new Set(["authedQuery", "authedMutation"]);

/** Wrappers that check the tenant, and may also check a permission. */
const STORE_BUILDERS = new Set(["storeQuery", "storeMutation"]);

/**
 * `httpAction(…)` — the surface with no client and no session at all.
 *
 * The rule's second blind spot, and the wider one. A Convex HTTP route is
 * reachable by anyone on the internet with `curl`: there is no identity to
 * check, so the store-scoped builders and `getAuthUser` are meaningless here.
 * What replaces them is a PROVIDER-SIDE proof — an HMAC over the raw body, a
 * single-use OAuth `state`, an unguessable token in the link — and the point of
 * covering `httpAction` is that a route now has to name which one it relies on.
 *
 * Two of the fourteen could not name one when this rule was extended: the SES
 * webhook validated a URL string taken from the unsigned body it was meant to
 * be authenticating, and the unsubscribe link carried a bare document id.
 */
const HTTP_BUILDERS = new Set(["httpAction"]);

/**
 * Two distinct escape hatches, deliberately not one.
 *
 * `@public-by-design` says the function is meant to be reachable by anyone —
 * the storefront catalogue, a token-guarded tracking page.
 *
 * `@guarded-inline` says the function IS authorised, just not through the seam:
 * the handler derives the caller from the session, or applies a policy the
 * store-scoped builders cannot express.
 *
 * Collapsing them into one marker would let a guarded mutation be read as
 * "public", which is exactly the confusion this whole sprint was about.
 */
const ANNOTATION = "@public-by-design";
const GUARDED_ANNOTATION = "@guarded-inline";

/**
 * A third marker, for the answer neither of the other two can give honestly.
 *
 * Extending this rule to `httpAction` surfaced three OAuth callbacks that are
 * reachable by anyone and protected by nothing — no `state`, no signature. They
 * are not `@public-by-design`, because being callable by anyone is precisely
 * the defect; and they are not `@guarded-inline`, because nothing guards them.
 * Marking them either way would be a lie recorded in the source.
 *
 * `@unguarded-tracked: #162 — <what is missing>` says the true thing: this is a
 * known hole with an owner. It has to carry an issue number, so it is a
 * to-do list rather than a shrug, and `grep -rn "@unguarded-tracked"` is the
 * list. Fixing the route means deleting the marker — the rule will insist.
 */
const TRACKED_ANNOTATION = "@unguarded-tracked";

/**
 * A marker only counts written as an annotation WITH a reason.
 *
 * It used to count as a substring of any comment, so prose describing the
 * marker — "the `@public-by-design` note below claimed the opposite" — silenced
 * the rule for the declaration underneath it. Anchoring to `@marker:` plus a
 * reason also enforces what the error messages have always asked for and never
 * checked: say WHY, because the reason is the only part a reviewer can weigh.
 */
const MARKER_PATTERN = new RegExp(
  `@(public-by-design|guarded-inline|unguarded-tracked):[ \\t]*(\\S.*)$`,
  "m"
);

/** A tracked gap has to name the issue tracking it. */
const ISSUE_PATTERN = /#\d+/;

/** Shorter than this is a shrug, not a reason. */
const MIN_REASON_LENGTH = 12;

/**
 * Signals that a handler authorises something itself.
 *
 * `@guarded-inline` is a claim — "this IS checked, just not through the seam" —
 * and a claim nothing tests is a comment. This is deliberately a wide net: a
 * declaration mentioning none of the session, no `ctx.runQuery`/`runMutation`
 * to an internal check, and nothing named `require*`/`assert*`/`check*` is not
 * a guarded function under any style this repo uses. It is meant to catch the
 * marker pasted onto an unguarded wrapper to quiet the rule, not to grade how
 * good the guard is — that is review's job, which is why the reason is
 * mandatory too.
 */
const GUARD_SIGNALS = [
  /\bctx\s*\.\s*auth\b/,
  /\bgetUserIdentity\b/,
  // Any spelling of the session lookup: `getAuthUser`, `safeGetAuthUser`,
  // `requireAuthUser`. Matching the bare name alone missed `getCurrentUser`,
  // which resolves the caller through `authComponent.safeGetAuthUser` and is
  // as session-derived as a function gets.
  //
  // No trailing `\b`, and the boundary is what made this rule unusable on a
  // third app. `apps/site` runs Convex Auth rather than Better Auth, where the
  // session lookup is `getAuthUserId` — "AuthUser" followed by a word
  // character, which `AuthUser\b` does not match. Every one of its 40-odd
  // session-scoped queries therefore read as a `@guarded-inline` claiming
  // something the rule could not see, which is the failure mode that makes a
  // guard get switched off rather than obeyed.
  /AuthUser/,
  /\bctx\s*\.\s*run(Query|Mutation|Action)\s*\(/,
  /\b_?(require|assert|check)[A-Z_]\w*/,
  /\brequireStaff\b/,
];

/** Walk up to the `export const …` statement the comments sit above. */
function statementOf(node) {
  let statement = node;
  while (statement.parent && statement.parent.type !== "Program") {
    statement = statement.parent;
  }
  return statement;
}

/**
 * Which escape hatch is claimed above this node, and with what reason.
 *
 * Returns `null` when none is, `{ marker, reason }` when one is. The marker is
 * returned rather than a boolean because the two hatches say different things
 * and the rule now treats them differently — which is the whole point: they
 * were documented as distinct and enforced as interchangeable.
 */
function readAnnotation(sourceCode, node) {
  const statement = statementOf(node);
  for (const comment of sourceCode.getCommentsBefore(statement)) {
    const match = MARKER_PATTERN.exec(comment.value);
    if (match) {
      return { marker: match[1], reason: match[2].trim(), comment };
    }
  }
  return null;
}

/** Does this declaration show any sign of authorising anything? */
function showsGuardSignal(sourceCode, node) {
  const text = sourceCode.getText(statementOf(node));
  return GUARD_SIGNALS.some((signal) => signal.test(text));
}

/** The `permission:` property of an object argument, if present. */
function hasPermissionProperty(node) {
  const [firstArg] = node.arguments;
  if (!firstArg || firstArg.type !== "ObjectExpression") return false;
  return firstArg.properties.some(
    (property) =>
      property.type === "Property" &&
      ((property.key.type === "Identifier" && property.key.name === "permission") ||
        (property.key.type === "Literal" && property.key.value === "permission"))
  );
}

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
        "`{{guarded}}` claims this function authorises the caller itself, but the declaration mentions " +
        "no session, no `ctx.runQuery(internal.…)` and nothing named `require`/`assert`/`check`. Either " +
        "guard it, or say `{{annotation}}` if it really is open to anyone.",
      trackedWithoutIssue:
        "`{{tracked}}` records a known hole, so it has to name the issue that owns it — " +
        "`// {{tracked}}: #123 — <what is missing>`. Without one it is not tracked, it is ignored.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode ?? context.getSourceCode();

    /**
     * Does an escape hatch excuse this node?
     *
     * Reports and returns `true` for a marker that is present but not honest —
     * missing its reason, or claiming an inline guard the declaration shows no
     * sign of. Such a marker still suppresses the "unguarded" message: two
     * errors on one line describing the same problem help nobody, and the one
     * naming the broken claim is the more useful of the two.
     */
    function excused(node) {
      const annotation = readAnnotation(sourceCode, node);
      if (!annotation) return false;

      const marker = `@${annotation.marker}`;

      if (annotation.reason.length < MIN_REASON_LENGTH) {
        context.report({ node, messageId: "missingReason", data: { marker } });
        return true;
      }

      if (
        annotation.marker === "unguarded-tracked" &&
        !ISSUE_PATTERN.test(annotation.reason)
      ) {
        context.report({
          node,
          messageId: "trackedWithoutIssue",
          data: { tracked: TRACKED_ANNOTATION },
        });
        return true;
      }

      if (
        annotation.marker === "guarded-inline" &&
        !showsGuardSignal(sourceCode, node)
      ) {
        context.report({
          node,
          messageId: "guardedWithoutGuard",
          data: { guarded: GUARDED_ANNOTATION, annotation: ANNOTATION },
        });
        return true;
      }

      return true;
    }

    return {
      CallExpression(node) {
        if (node.callee.type !== "Identifier") return;
        const name = node.callee.name;

        if (BARE_BUILDERS.has(name)) {
          // `query(defs.x)` and `query({ … })` are both reachable publicly.
          if (excused(node)) return;
          context.report({
            node,
            messageId: "bare",
            data: { name, annotation: ANNOTATION },
          });
          return;
        }

        if (ACTION_BUILDERS.has(name)) {
          if (excused(node)) return;
          context.report({
            node,
            messageId: "bareAction",
            data: { annotation: ANNOTATION, guarded: GUARDED_ANNOTATION },
          });
          return;
        }

        if (HTTP_BUILDERS.has(name)) {
          if (excused(node)) return;
          context.report({
            node,
            messageId: "bareHttp",
            data: { annotation: ANNOTATION, guarded: GUARDED_ANNOTATION },
          });
          return;
        }

        if (AUTH_ONLY_BUILDERS.has(name)) {
          if (excused(node)) return;
          context.report({ node, messageId: "authOnly", data: { name } });
        }
      },
    };
  },
};

export const requireConvexPermission = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Store-scoped Convex functions must declare the permission they require",
    },
    schema: [],
    messages: {
      missing:
        "`{{name}}(…)` checks that the caller belongs to the restaurant but not what they may do — " +
        "a kitchen account passes. Add `permission: \"resource:action\"`.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee.type !== "Identifier") return;
        if (!STORE_BUILDERS.has(node.callee.name)) return;
        if (hasPermissionProperty(node)) return;
        context.report({
          node,
          messageId: "missing",
          data: { name: node.callee.name },
        });
      },
    };
  },
};

/** The plugin object an app's flat config registers under `convex/`. */
const convexAuthPlugin = {
  rules: {
    "no-unguarded-convex-function": noUnguardedConvexFunction,
    "require-convex-permission": requireConvexPermission,
  },
};

export default convexAuthPlugin;
