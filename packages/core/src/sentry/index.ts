/**
 * Sentry init options, resolved from the environment.
 *
 * One Sentry **project per client**. A restaurant's errors, its quota and its
 * retention belong to it and follow it if it leaves — the same rule that
 * already governs its Convex deployment, its S3 bucket and its Stripe account
 * (`tasks/production-accounts-checklist.md`). Isolation is structural: the DSN
 * is a per-deployment variable, so two clients cannot land in one issue stream
 * unless someone pastes the same DSN twice.
 *
 * Kept free of `@sentry/nextjs` and of every other import — like
 * `aws/media-url` and `aws/folders` — so the browser bundle, the edge runtime
 * and Convex actions can all read it without dragging the package in. It
 * returns plain data; the three `Sentry.init` call sites live in the apps.
 *
 * Returning `null` is the load-bearing part. A deployment with no DSN must not
 * initialise Sentry at all: no transport, no breadcrumb buffer, no
 * `beforeSend`. That is the normal state of a fresh client site, of every CI
 * build and of local development, and it has to cost nothing.
 *
 * See `apps/docs/deployment/sentry.md`.
 *
 * @module sentry
 */

/** Where `Sentry.init` is being called. Only the defaults differ. */
export type SentryRuntime = 'browser' | 'server' | 'edge'

/**
 * The variables read here.
 *
 * Declared as a plain shape rather than read off `process.env` directly: the
 * browser bundle only carries the `NEXT_PUBLIC_` ones, and taking them as an
 * argument is what makes the resolution testable without mutating the
 * process environment.
 */
export interface SentryEnvSource {
  NEXT_PUBLIC_SENTRY_DSN?: string | undefined
  NEXT_PUBLIC_SENTRY_ENVIRONMENT?: string | undefined
  NEXT_PUBLIC_SENTRY_RELEASE?: string | undefined
  NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE?: string | undefined
  NEXT_PUBLIC_SITE_URL?: string | undefined
  NODE_ENV?: string | undefined
  /** Set by Vercel: `production` | `preview` | `development`. */
  VERCEL_ENV?: string | undefined
  /** Set by Vercel. Used as the release when nothing pins one. */
  VERCEL_GIT_COMMIT_SHA?: string | undefined
}

/**
 * What the apps hand to `Sentry.init`.
 *
 * A structural subset of the SDK's own options — declaring it here keeps this
 * module import-free while still type-checking the call sites, since the SDK
 * accepts any object assignable to its options.
 */
export interface SentryOptions {
  dsn: string
  environment: string
  release: string | undefined
  tracesSampleRate: number
  /**
   * Never true. It governs IP address and user attribution, and a restaurant
   * checkout identifies a real customer. It does NOT filter request headers —
   * `scrubSentryEvent` below does that.
   */
  sendDefaultPii: false
  debug: boolean
  initialScope: {
    tags: Record<string, string>
  }
  beforeSend: typeof scrubSentryEvent
  beforeSendTransaction: typeof scrubSentryEvent
}

/**
 * Sample rate for performance traces once the environment is `production`.
 *
 * Tracing every transaction is what a demo does. A restaurant on a Saturday
 * night would spend its free-tier quota before the errors it actually needs to
 * see arrive, and Sentry drops the overflow — so a 100% rate ends up recording
 * *less* than 10%. Raise it per client with
 * `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE`.
 */
export const PRODUCTION_TRACES_SAMPLE_RATE = 0.1

/** Outside production the volume is one developer, so trace everything. */
export const DEVELOPMENT_TRACES_SAMPLE_RATE = 1.0

/**
 * A DSN is `https://<publicKey>@<host>/<projectId>`.
 *
 * The env schema only asks for a URL, because tightening a variable that
 * deployments already carry would turn a wrong value into a refused boot. So
 * the shape is checked here instead, and a value that is not a DSN disables
 * Sentry with a named warning rather than reaching `Sentry.init`.
 */
const DSN_PATTERN = /^https?:\/\/[^@/\s]+@[^/\s]+\/\d+$/

/** True when `value` can be used as a Sentry DSN. */
export function isSentryDsn(value: string | undefined): boolean {
  return typeof value === 'string' && DSN_PATTERN.test(value.trim())
}

/** `''` and whitespace mean "not set" — `.env.example` ships every key empty. */
const clean = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

/**
 * Which environment the events belong to.
 *
 * The second axis of "nothing mixed": within one client's project, its preview
 * deployments must not raise issues against its production. `VERCEL_ENV` gives
 * that for free on the platform every client site is deployed to.
 */
export function resolveSentryEnvironment(env: SentryEnvSource): string {
  return (
    clean(env.NEXT_PUBLIC_SENTRY_ENVIRONMENT) ??
    clean(env.VERCEL_ENV) ??
    clean(env.NODE_ENV) ??
    'development'
  )
}

/**
 * The release the events are attributed to.
 *
 * Also what source maps are matched against: an upload tagged with a release
 * the running code does not report produces minified stack traces and no
 * error, which is the hardest version of this to notice.
 */
export function resolveSentryRelease(env: SentryEnvSource): string | undefined {
  return clean(env.NEXT_PUBLIC_SENTRY_RELEASE) ?? clean(env.VERCEL_GIT_COMMIT_SHA)
}

/** Parses the override; anything outside 0–1 falls back to the default. */
function resolveTracesSampleRate(env: SentryEnvSource, environment: string): number {
  const raw = clean(env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE)
  if (raw !== undefined) {
    const parsed = Number(raw)
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) return parsed
  }

  return environment === 'production'
    ? PRODUCTION_TRACES_SAMPLE_RATE
    : DEVELOPMENT_TRACES_SAMPLE_RATE
}

/**
 * Tags every event with the host the deployment answers on.
 *
 * Redundant while one client means one project — and precisely why it is here.
 * The day a DSN is copied into a second site, or a client runs a second brand
 * off one project, the issue stream stays attributable instead of silently
 * merging two restaurants.
 */
function resolveSiteTag(env: SentryEnvSource): string | undefined {
  const url = clean(env.NEXT_PUBLIC_SITE_URL)
  if (!url) return undefined

  try {
    return new URL(url).host
  } catch {
    return undefined
  }
}

/**
 * The only request headers an event keeps.
 *
 * An allowlist, not a denylist, and that is the whole point: `sendDefaultPii:
 * false` does NOT strip request headers on the Next.js server SDK — it governs
 * IP and user attribution. Verified against a live SDK, an unfiltered event
 * carried `cookie: session=…` and `authorization: Bearer …` straight into the
 * project. A denylist would have to anticipate every header that ever carries a
 * credential; this fails closed instead, and the cost of a missing header is a
 * slightly thinner debugging context.
 */
export const SENTRY_KEPT_HEADERS: readonly string[] = [
  'host',
  'user-agent',
  'accept',
  'accept-language',
  'content-type',
  'content-length',
]

/**
 * Query parameters whose VALUE is replaced before the event leaves.
 *
 * `request.url` is not a header and survives the allowlist above. This product
 * puts real credentials in query strings: `/reset-password?token=…` is a live
 * password reset, and `/order/<id>?token=…` opens one customer's order to
 * whoever holds the link. Neither belongs in a monitoring tool.
 */
export const SENTRY_REDACTED_QUERY_KEYS: readonly string[] = [
  'token',
  'access_token',
  'refresh_token',
  'id_token',
  'code',
  'secret',
  'password',
  'signature',
  'key',
  'api_key',
  'apikey',
]

const REDACTED = '[Filtered]'

/** The shape `scrubSentryEvent` touches — structural, so no SDK import. */
export interface SentryScrubbableEvent {
  request?: {
    url?: string
    headers?: Record<string, string>
    cookies?: Record<string, string> | string
    query_string?: string | Record<string, string> | Array<[string, string]>
  }
}

/** Replaces the value of every sensitive key in a `?a=b&c=d` string. */
function redactQueryString(query: string): string {
  return query
    .split('&')
    .map((pair) => {
      const eq = pair.indexOf('=')
      if (eq === -1) return pair
      const name = pair.slice(0, eq)
      return SENTRY_REDACTED_QUERY_KEYS.includes(decodeURIComponent(name).toLowerCase())
        ? `${name}=${REDACTED}`
        : pair
    })
    .join('&')
}

/**
 * Strips credentials from an event before it is sent.
 *
 * Wired as both `beforeSend` and `beforeSendTransaction`: a transaction carries
 * the same `request` block as an error, so filtering only errors would leak the
 * same cookie on the next traced request.
 */
export function scrubSentryEvent<T extends SentryScrubbableEvent>(event: T): T {
  const request = event.request
  if (!request) return event

  if (request.headers) {
    const kept: Record<string, string> = {}
    for (const [name, value] of Object.entries(request.headers)) {
      if (SENTRY_KEPT_HEADERS.includes(name.toLowerCase())) kept[name] = value
    }
    request.headers = kept
  }

  // Sentry parses these out of the request separately; the allowlist above
  // never sees them.
  if (request.cookies) request.cookies = {}

  if (typeof request.query_string === 'string') {
    request.query_string = redactQueryString(request.query_string)
  } else if (request.query_string) {
    // Object and tuple-array forms: redact by key, keep the shape.
    const q = request.query_string
    request.query_string = Array.isArray(q)
      ? q.map(([k, v]) =>
          SENTRY_REDACTED_QUERY_KEYS.includes(k.toLowerCase())
            ? ([k, REDACTED] as [string, string])
            : ([k, v] as [string, string]),
        )
      : Object.fromEntries(
          Object.entries(q).map(([k, v]) =>
            SENTRY_REDACTED_QUERY_KEYS.includes(k.toLowerCase()) ? [k, REDACTED] : [k, v],
          ),
        )
  }

  if (request.url) {
    const [path, query] = request.url.split('?')
    if (query !== undefined) request.url = `${path}?${redactQueryString(query)}`
  }

  return event
}

/**
 * Builds the `Sentry.init` options for one runtime, or `null` when this
 * deployment has no Sentry project.
 *
 * @param runtime - which of the three init call sites is asking
 * @param env - the environment to read; defaults to `process.env`
 * @param warn - where the "configured but unusable" message goes
 *
 * @example
 * ```ts
 * // instrumentation-client.ts
 * const options = resolveSentryOptions('browser')
 * if (options) Sentry.init({ ...options, integrations: [...] })
 * ```
 */
export function resolveSentryOptions(
  runtime: SentryRuntime,
  env: SentryEnvSource = typeof process !== 'undefined'
    ? (process.env as SentryEnvSource)
    : {},
  warn: (message: string) => void = (message) => console.warn(message),
): SentryOptions | null {
  const dsn = clean(env.NEXT_PUBLIC_SENTRY_DSN)
  if (!dsn) return null

  if (!isSentryDsn(dsn)) {
    // Loud on purpose. Shipping the variable while reporting nothing is the
    // failure this module exists to end: the operator sets the DSN, believes
    // monitoring is live, and no one sees the checkout error.
    warn(
      `[sentry] NEXT_PUBLIC_SENTRY_DSN is set but is not a Sentry DSN ` +
        `(expected https://<key>@<host>/<projectId>). Error reporting is OFF for the ` +
        `${runtime} runtime.`,
    )
    return null
  }

  const environment = resolveSentryEnvironment(env)
  const site = resolveSiteTag(env)

  return {
    dsn,
    environment,
    release: resolveSentryRelease(env),
    tracesSampleRate: resolveTracesSampleRate(env, environment),
    sendDefaultPii: false,
    debug: false,
    initialScope: {
      tags: {
        runtime,
        ...(site ? { site } : {}),
      },
    },
    beforeSend: scrubSentryEvent,
    beforeSendTransaction: scrubSentryEvent,
  }
}
