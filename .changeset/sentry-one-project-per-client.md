---
"@be-in-digital/core": minor
"@be-in-digital/mcp-server": patch
---

Sentry is wired, and every client site reports to its own project.

`NEXT_PUBLIC_SENTRY_DSN` was in the schema and in both `.env.example` files.
`@sentry/nextjs` was in no `package.json`, `packages/core` exported a
`createSentryConfig()` nothing called, and no app had an error boundary. An
operator filled the DSN in, saw no error, and believed monitoring was live — so
a Saturday-night checkout failure was seen by nobody. Shipping the variable
without the integration buys the confidence without the coverage.

New `@be-in-digital/core/sentry` resolves the `Sentry.init` options for the
three runtimes:

- `resolveSentryOptions(runtime, env?)` returns `null` when the DSN is unset,
  empty, or is not a DSN — a project-page URL pasted instead of the client key
  passes the schema's `.url()` and is refused here, with a warning naming the
  variable. Every call site skips `Sentry.init` on `null`, so a deployment
  without a Sentry project pays nothing: no transport, no breadcrumb buffer.
- `environment` resolves `NEXT_PUBLIC_SENTRY_ENVIRONMENT` → `VERCEL_ENV` →
  `NODE_ENV`, which keeps a client's preview deploys out of its production
  issues with no configuration on Vercel.
- `tracesSampleRate` defaults to **0.1 in production**, 1.0 elsewhere. At 1.0 a
  busy restaurant spends its free-tier quota on traces and Sentry drops the
  overflow, so a 100% rate records *less* than 10%. Override per client with
  `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE`.
- `sendDefaultPii` is `false` and not configurable. That flag is not enough on
  its own: verified against a live SDK, a server event still carried
  `cookie: session=…` and `authorization: Bearer …` in `request.headers`, since
  the flag governs IP and user attribution rather than headers. So
  `scrubSentryEvent` runs as both `beforeSend` and `beforeSendTransaction` —
  headers filtered to an allowlist, `request.cookies` emptied, and sensitive
  query values redacted out of `request.url` and `request.query_string`
  (`/reset-password?token=…` is a live password reset; `/order/<id>?token=…`
  opens one customer's order).
- Events carry a `site` tag (the host of `NEXT_PUBLIC_SITE_URL`) and a
  `runtime` tag, so two deployments sharing a DSN by accident stay
  distinguishable instead of merging.

The module has no imports — not even `@sentry/nextjs` — so the browser bundle,
the edge runtime and Convex actions can all read it, and it is unit-tested
without a process environment. It replaces the unused `createSentryConfig`,
`defaultSentryConfig` and `SentryConfig` exports, which had no call site
anywhere in the workspace.

Four variables are newly declared, and `SENTRY_ORG` / `SENTRY_PROJECT` /
`SENTRY_AUTH_TOKEN` become a `SITE_FEATURE_GROUPS` entry: half a source-map
upload uploads nothing and leaves every production stack trace minified. The
DSN is deliberately **not** in that group — a DSN on its own is a complete,
working configuration.
