# Sentry — one project per client

> **Decision: every client site reports to its own Sentry project.** A
> restaurant's errors, its event quota and its retention are its own, and they
> follow it if it leaves — the same rule that already governs its Convex
> deployment, its S3 bucket and its Stripe account.

## Why this had to be settled

The variable shipped for months without the integration behind it.
`NEXT_PUBLIC_SENTRY_DSN` was in the schema and in both `.env.example` files,
`packages/core` exported a `createSentryConfig()` nothing called, and
`@sentry/nextjs` was in no `package.json`. An operator filled the DSN in, saw
no error, and believed monitoring was live. A Saturday-night checkout failure
was seen by nobody.

Shipping the variable without the integration is worse than shipping neither:
it buys the confidence without the coverage.

The other half of the decision is isolation. One shared project across the
fleet would mean one client's traffic spending the quota that swallows another
client's checkout error, one retention window for everyone, and a support
engineer reading two restaurants' customer data in one issue stream. Per-client
projects make that structural rather than a matter of discipline.

## What is wired

Both `apps/reference` and `apps/themes` carry the same six files, byte for byte. `apps/themes`
is the one that matters — it is mirrored to `beyours-boilerplate` and cloned
per client, so every client site gets this by construction.

| File | Role |
|---|---|
| `instrumentation-client.ts` | browser `Sentry.init` + App Router navigation tracing |
| `sentry.server.config.ts` | Node runtime `Sentry.init` |
| `sentry.edge.config.ts` | edge runtime `Sentry.init` |
| `instrumentation.ts` | imports the two above, and exports `onRequestError` |
| `app/error.tsx`, `app/global-error.tsx` | capture React render errors, and apologise in French |

The options all three runtimes use come from one place:
[`@be-yours/core/sentry`](../../../packages/core/src/sentry/index.ts). It
has no imports — not even `@sentry/nextjs` — so the browser bundle, the edge
runtime and Convex actions can all read it, and it can be unit-tested without a
network or a process environment.

### With no DSN, nothing happens

`resolveSentryOptions()` returns `null` when `NEXT_PUBLIC_SENTRY_DSN` is unset
or empty, and every call site skips `Sentry.init` entirely — no transport, no
breadcrumb buffer, no `beforeSend`. That is the normal state of local
development, of every CI build, and of a client site whose Sentry project has
not been created yet. It has to cost nothing, and it does.

A DSN that is set but is *not* a DSN — the project page URL pasted instead of
the client key — is refused with a named warning on the console rather than
silently ignored.

## Creating the project for a new client

Do this once per client, after `beyours create` and before the first production
deploy.

1. **Create the Sentry project.** Platform **Next.js**, name it after the client
   (`pizzeria-napoli`). Create it **under the client's own Sentry account** — not
   under `developers@be-yours.fr`. Per
   [`tasks/production-accounts-checklist.md`](../../../tasks/production-accounts-checklist.md),
   Sentry is site-level: it belongs to the restaurant and follows it.
2. **Copy the DSN** into the site's `.env.local` as `NEXT_PUBLIC_SENTRY_DSN`,
   or answer the `Sentry (monitoring)` prompt in `pnpm env:setup`.
3. **Set it on the host too.** The DSN is a `NEXT_PUBLIC_` variable, so it is
   baked in at build time — adding it to Vercel *after* a deploy does nothing
   until the next build.
4. **Optionally enable source maps** — see below. Without them, production stack
   traces point at minified chunks.
5. **Verify.** Deploy, then hit the deployment's `/api/…` with a deliberate
   failure or trigger a client error, and confirm the event appears in the
   project within a minute.

`pnpm env:check` will tell you whether the variables are consistent, not whether
Sentry received anything. Only step 5 does that.

## Source maps

Three variables, read at **build** time, all or none:

| Variable | Value |
|---|---|
| `SENTRY_ORG` | the org slug |
| `SENTRY_PROJECT` | the project slug |
| `SENTRY_AUTH_TOKEN` | an org auth token with `project:releases` |

Half of them uploads nothing, so `SITE_FEATURE_GROUPS` refuses the boot and
names the gap. Set none and the upload is switched off cleanly: no maps are
generated, and no build warns about a token it does not have.

`SENTRY_AUTH_TOKEN` is a secret. It belongs on the build host — a Vercel
environment variable or a CI secret — never in a `NEXT_PUBLIC_` variable and
never in the repository.

## The two axes that keep events apart

**Which client** is the project, decided by the DSN.

**Which deployment** is `environment`, resolved in this order:

1. `NEXT_PUBLIC_SENTRY_ENVIRONMENT`, when set
2. `VERCEL_ENV` — `production` / `preview` / `development`
3. `NODE_ENV`

On Vercel this works with no configuration: a client's preview deploys file
their errors under `preview`, out of the production issue list. Everywhere else,
set `NEXT_PUBLIC_SENTRY_ENVIRONMENT` explicitly.

> **Caveat.** The browser cannot read `VERCEL_ENV`. It reads
> `NEXT_PUBLIC_VERCEL_ENV`, which Vercel only exposes while *Automatically
> expose System Environment Variables* is on — the default. If a project turns
> it off, set `NEXT_PUBLIC_SENTRY_ENVIRONMENT` or client-side errors from
> preview deploys will be filed under `production`.

Every event also carries a `site` tag, taken from the host in
`NEXT_PUBLIC_SITE_URL`, and a `runtime` tag (`browser` / `server` / `edge`).
The `site` tag is redundant while one client means one project — and that is
the point: the day a DSN is copied into a second site, the issue stream stays
attributable instead of quietly merging two restaurants.

## Volume and privacy

`tracesSampleRate` defaults to **0.1 in production** and 1.0 everywhere else.
Tracing every transaction is what a demo does; a restaurant on a Saturday night
would spend its free-tier quota on traces, and Sentry drops the overflow — so a
100% rate ends up recording *less* than 10%. Raise or lower it per client with
`NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE`.

`sendDefaultPii` is **false** and is not configurable here: no IP address and
no user identity on any event.

That flag alone is not enough, and assuming it was would have shipped a leak.
Verified against a live SDK, an event from a failing route carried
`cookie: session=…` and `authorization: Bearer …` in `request.headers`
regardless — `sendDefaultPii` governs IP and user attribution, not headers. So
`scrubSentryEvent` runs as both `beforeSend` and `beforeSendTransaction`:

- **Headers are filtered to an allowlist** — `host`, `user-agent`, `accept`,
  `accept-language`, `content-type`, `content-length`. An allowlist, because a
  denylist has to anticipate every header that ever carries a credential.
- **`request.cookies` is emptied**; Sentry parses it separately and the header
  allowlist never sees it.
- **Sensitive query values are redacted** in `request.url` and
  `request.query_string`. This product puts real credentials there:
  `/reset-password?token=…` is a live password reset, and `/order/<id>?token=…`
  opens one customer's order to whoever holds the link.

A transaction carries the same `request` block as an error, which is why both
hooks are wired — filtering only errors would leak the same cookie on the next
traced request.

## Not included

- **Session Replay.** It records the DOM — a checkout form included — and adds
  weight to a mobile-first storefront. Worth having, worth deciding on its own.
(**Convex used to be on this list**, and so was `apps/site`. Neither is any
more — see the two sections below.)

## The Convex backend

Backend functions used to report nothing here, and that was the largest hole in
this document. Every Stripe, Deliveroo, Uber Eats and SES webhook runs on the
Convex side, along with every order mutation and the whole kitchen path; the
only trace of a failure in any of them was one of 112 `console.error` calls,
landing in the dashboard of ONE client's deployment. With one deployment per
client, a Saturday-night order that failed inside Convex was seen by nobody,
and finding it meant opening each client's console in turn.

It reports to the **same project** as the rest of that client's site. A failed
checkout raises one issue whether it broke in the browser, in the route handler
or in the mutation, and issues carry a `runtime` tag (`browser`, `server`,
`edge`, `convex`) plus a `source` tag naming the handler.

**To turn it on for a deployment**, set the DSN in the Convex environment store
— which is a different store from the one Next.js reads:

```bash
npx convex env set SENTRY_DSN "https://<key>@<org>.ingest.sentry.io/<project>"
npx convex env set NEXT_PUBLIC_SENTRY_ENVIRONMENT production   # optional
```

`SENTRY_DSN`, not `NEXT_PUBLIC_SENTRY_DSN`: the `NEXT_PUBLIC_` prefix means
"inlined into a browser bundle", and a store Next.js never reads is exactly
where that name gets someone to set the wrong variable. The old name still
works as a fallback, so a deployment already carrying it keeps reporting.

Leaving it unset is a supported state and the default one. There is no
transport, no buffer and no cost — `convex/errorReporting.ts` returns
`{ reported: false, reason: "no-dsn" }` and says nothing.

**How it works, and why not `@sentry/node`.** A Convex module is not a Node
program: the default runtime is a V8 isolate with `fetch` and no Node API.
Putting the SDK behind a `"use node"` action would not help either — nothing
outside such a module can import from it, and an `httpAction` cannot be
`"use node"` at all, which is every webhook. So the envelope is built by hand
in [`@be-yours/core/sentry`](../../../packages/core/src/sentry/envelope.ts)
and POSTed with one `fetch`. Same scrubbing as the Next.js runtimes, plus
`redactSentryExtra` for the context a call site attaches by hand.

**How to report from a new call site:**

```ts
} catch (error) {
  console.error("[Stripe Webhook] …", error)
  await captureBackendError(ctx, { error, source: "stripeWebhook", tags: { eventType } })
  return new Response("Processing error", { status: 500 })
}
```

`console.error` stays — the Convex dashboard is still the fastest place to read
a log with a deploy in front of you. This is a second destination, not a
replacement. One trap: from a **mutation** the report is scheduled inside the
mutation's transaction, so a mutation that rethrows rolls its own report back.
Report those from the action or `httpAction` above them.

## beyours.fr — `apps/site`

The commercial site is the app that takes the money, runs the internal ops
console and the affiliate portal, and it had **zero error tracking on either
half**: no dependency, no config, no `error.tsx` anywhere in a tree where
`apps/reference` carries four, and — on the Convex side — a Stripe webhook whose
entire failure record was one `console.error` into a log window that expires. A
renewal charge that failed to record was seen by nobody, and Stripe stops
retrying after three days.

Both halves are wired now, and the shape mirrors the engine's exactly. What
differs is the source of the options.

| File | Role |
|---|---|
| `instrumentation-client.ts` | browser `Sentry.init` + App Router navigation tracing |
| `sentry.server.config.ts` | Node runtime `Sentry.init` |
| `sentry.edge.config.ts` | edge runtime `Sentry.init` |
| `instrumentation.ts` | imports the two above, exports `onRequestError` |
| `app/error.tsx`, `app/global-error.tsx` | root and root-layout boundaries |
| `app/(landing)/error.tsx`, `app/admin/error.tsx`, `app/parrainage/error.tsx` | one per route group whose layout carries chrome |
| `convex/errorReporting.ts` | the backend reporter, wired into both Stripe webhook 500 paths |

### Why it does not import `@be-yours/core/sentry`

Because `apps/site` depends on none of the engine packages, and that rule is not
stylistic: the ten `@be-yours/*` packages ship from a private GitHub
registry, so one import here would put a `read:packages` token between this
repository and every Vercel build of the commercial site. `lib/env.ts` already
carries the same duplication for the same reason.

`lib/observability/sentry.ts` is the local equivalent. It is deliberately
smaller: the engine reports from a hundred call sites and needs a recursive,
fail-closed redactor for arbitrarily nested context, whereas here the reporting
call sites are countable and `reportError` accepts a FLAT record of primitives —
so the argument validator refuses nesting and one pass over the keys is a
complete guard. The two may drift on shape. They must not drift on the redaction
lists, and `tests/convex/errorReporting.test.ts` pins the behaviour that matters.

### One project, not per-client

Everything above about per-client isolation is about *client* deployments.
beyours.fr is one deployment and gets one project, which is also why its
`connect-src` can name the ingest origin: `next.config.ts` derives it from
`NEXT_PUBLIC_SENTRY_DSN` and passes it to `buildContentSecurityPolicy`. Without
that entry the browser SDK initialises, captures, and has every send refused by
the policy — monitoring that looks configured and reports nothing.

### Turning it on

```bash
# Vercel (both halves of the Next.js build)
NEXT_PUBLIC_SENTRY_DSN=https://<key>@<org>.ingest.sentry.io/<project>

# The Convex deployment holds its own store; nothing in .env reaches it
npx convex env set SENTRY_DSN "https://<key>@<org>.ingest.sentry.io/<project>"
```

Unset is a legitimate state and costs nothing. `lib/env.ts` checks the DSN's
*shape* when it is set, because a project page URL pasted in its place is
accepted by every URL validator and reports nothing.

## Liveness

`GET $CONVEX_SITE_URL/health` and `GET https://<site>/api/health`. The second
calls the first and reports both halves, so one URL per client site tells an
uptime monitor whether Vercel is serving *and* whether that client's Convex
deployment is answering. Unauthenticated by design — a monitor cannot hold a
credential — and neither response contains a configuration value: they say
whether Sentry is configured, never what to. `200` healthy, `503` degraded.

A deployment with no Sentry project reports `errorReporting: "off"` and stays
`200`: that is a configuration decision, not an outage, and paging on it would
train whoever carries the pager to ignore the alert.
