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

/** True when either escape-hatch comment sits above this node. */
function hasPublicAnnotation(sourceCode, node) {
  // Walk up to the statement so the comment lookup starts at `export const …`.
  let statement = node;
  while (statement.parent && statement.parent.type !== "Program") {
    statement = statement.parent;
  }
  return sourceCode
    .getCommentsBefore(statement)
    .some(
      (comment) =>
        comment.value.includes(ANNOTATION) ||
        comment.value.includes(GUARDED_ANNOTATION)
    );
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
    },
  },
  create(context) {
    const sourceCode = context.sourceCode ?? context.getSourceCode();

    return {
      CallExpression(node) {
        if (node.callee.type !== "Identifier") return;
        const name = node.callee.name;

        if (BARE_BUILDERS.has(name)) {
          // `query(defs.x)` and `query({ … })` are both reachable publicly.
          if (hasPublicAnnotation(sourceCode, node)) return;
          context.report({
            node,
            messageId: "bare",
            data: { name, annotation: ANNOTATION },
          });
          return;
        }

        if (ACTION_BUILDERS.has(name)) {
          if (hasPublicAnnotation(sourceCode, node)) return;
          context.report({
            node,
            messageId: "bareAction",
            data: { annotation: ANNOTATION, guarded: GUARDED_ANNOTATION },
          });
          return;
        }

        if (AUTH_ONLY_BUILDERS.has(name)) {
          if (hasPublicAnnotation(sourceCode, node)) return;
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
