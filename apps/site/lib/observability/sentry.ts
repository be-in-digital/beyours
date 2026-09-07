/**
 * Error reporting for beyours.fr, resolved from the environment.
 *
 * ## Why this is not `@be-in-digital/core/sentry`
 *
 * That module exists and is well tested, and this one deliberately does not
 * import it. `apps/site` depends on **none** of the engine packages — the rule
 * is in the root `CLAUDE.md` and it is not stylistic: the ten `@be-in-digital/*`
 * packages ship from a private GitHub registry, so a single import here would
 * put a `read:packages` token between this repository and every Vercel build of
 * the commercial site. `lib/env.ts` already carries the same duplication for the
 * same reason and says so in its own header.
 *
 * What that costs is bounded, because this app needs far less than the engine
 * does. The engine reports from one Convex deployment per client with context
 * assembled by a hundred call sites, so it needs a recursive, fail-closed
 * redactor for arbitrarily nested `extra`. Here the reporting call sites are
 * countable — the Stripe webhook and the crons — and `reportError` accepts a
 * FLAT record of primitives, so a one-level key check is the whole guard. The
 * two implementations may drift on shape; they must not drift on the redaction
 * lists, which is why those are named identically and pinned by a test.
 *
 * ## Why the Convex half shares this file rather than the SDK
 *
 * `convex/http.ts` is where the Stripe webhook lives and it cannot be
 * `"use node"` — an `httpAction` never can — so `@sentry/node` is unavailable
 * exactly where the money fails. The wire format is written out instead: three
 * newline-delimited JSON objects and one `fetch`, which the default Convex
 * isolate has. The Next.js half uses the real SDK and reads only
 * `resolveSentryOptions` from here, so a browser error and a webhook error land
 * in one project, tagged the same way, with the same scrubbing.
 *
 * Import-free on purpose, like the engine's equivalent: the browser bundle, the
 * edge runtime and the Convex isolate all pull it in.
 *
 * @module lib/observability/sentry
 */

/* ── Redaction lists ──────────────────────────────────────────────────────── */

/** What replaces a redacted value. */
export const REDACTED = "[Filtered]";

/**
 * Query parameters whose VALUE is replaced before an event leaves.
 *
 * `request.url` is not a header and survives the header allowlist below. This
 * app puts real credentials in query strings: the affiliate portal's magic
 * links and Stripe's `?session_id=` return both identify a person, and a
 * `?token=` is a live credential. None of it belongs in a monitoring tool.
 */
export const SENTRY_REDACTED_QUERY_KEYS: readonly string[] = [
  "token",
  "access_token",
  "refresh_token",
  "id_token",
  "code",
  "secret",
  "password",
  "signature",
  "key",
  "api_key",
  "apikey",
];

/**
 * Context KEYS whose value never leaves — a different list from the one above,
 * on purpose.
 *
 * `code` and `key` are credentials in a URL (`?code=` is an OAuth grant) and
 * ordinary words in an object: `statusCode`, `errorCode` and `idempotencyKey`
 * are exactly what a webhook failure attaches. Matched per segment, and
 * additionally against the whole key with separators removed, so `api_key`,
 * `apiKey` and `apikey` are one entry rather than three — and
 * `stripe_signature_header` is caught even though the credential word is not
 * at the end.
 */
export const SENTRY_REDACTED_CONTEXT_KEYS: readonly string[] = [
  "token",
  "secret",
  "password",
  "passwd",
  "pwd",
  "signature",
  "auth",
  "authorization",
  "credential",
  "credentials",
  "cookie",
  "session",
  "bearer",
  "apikey",
  "privatekey",
  "accesskey",
  "secretkey",
];

/* ── Options ──────────────────────────────────────────────────────────────── */

/**
 * Where `Sentry.init` is being called — or, for `convex`, where an envelope is
 * being built by hand. Only the defaults and the DSN variable differ.
 */
export type SentryRuntime = "browser" | "server" | "edge" | "convex";

/**
 * The variables read here.
 *
 * A plain shape rather than `process.env` directly: the browser bundle only
 * carries the `NEXT_PUBLIC_` ones, and taking them as an argument is what makes
 * the resolution testable without mutating the process environment.
 */
export interface SentryEnvSource {
  NEXT_PUBLIC_SENTRY_DSN?: string | undefined;
  /**
   * The Convex-side name for the same DSN, read only by the `convex` runtime.
   *
   * The Convex deployment holds its OWN environment store — nothing in
   * `.env.local` reaches it — so the DSN has to be set there separately with
   * `npx convex env set`. Naming it `NEXT_PUBLIC_…` in a store Next.js never
   * reads is how an operator ends up setting the one that does nothing.
   */
  SENTRY_DSN?: string | undefined;
  NEXT_PUBLIC_SENTRY_ENVIRONMENT?: string | undefined;
  NEXT_PUBLIC_SENTRY_RELEASE?: string | undefined;
  NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE?: string | undefined;
  NEXT_PUBLIC_SITE_URL?: string | undefined;
  NODE_ENV?: string | undefined;
  /** Set by Vercel: `production` | `preview` | `development`. */
  VERCEL_ENV?: string | undefined;
  /** Set by Vercel. Used as the release when nothing pins one. */
  VERCEL_GIT_COMMIT_SHA?: string | undefined;
}

/**
 * What the app hands to `Sentry.init`.
 *
 * A structural subset of the SDK's own options — declaring it here keeps this
 * module import-free while still type-checking the call sites, since the SDK
 * accepts any object assignable to its options.
 */
export interface SentryOptions {
  dsn: string;
  environment: string;
  release: string | undefined;
  tracesSampleRate: number;
  /**
   * Never true. It governs IP address and user attribution, and a checkout on
   * this site identifies a named restaurateur who is about to be charged. It
   * does NOT filter request headers — `scrubSentryEvent` below does that.
   */
  sendDefaultPii: false;
  debug: boolean;
  initialScope: { tags: Record<string, string> };
  beforeSend: typeof scrubSentryEvent;
  beforeSendTransaction: typeof scrubSentryEvent;
}

/**
 * Sample rate for performance traces once the environment is `production`.
 *
 * Tracing every transaction is what a demo does. Sentry drops the overflow once
 * a project is over quota, so a 100% rate ends up recording *less* than 10% —
 * including the errors this exists to catch. Raise it with
 * `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE`.
 */
export const PRODUCTION_TRACES_SAMPLE_RATE = 0.1;

/** Outside production the volume is one developer, so trace everything. */
export const DEVELOPMENT_TRACES_SAMPLE_RATE = 1.0;

/** `''` and whitespace mean "not set" — an unset Vercel variable arrives empty. */
const clean = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

/**
 * A DSN is `https://<publicKey>@<host>/<projectId>`.
 *
 * Defined as "`parseSentryDsn` can read it" rather than as a second pattern
 * meaning to say the same thing: the two would eventually disagree, and the
 * shape that disagreement takes is a variable that is set, an operator who
 * believes monitoring is live, and a reporter that dies on every event.
 */
export function isSentryDsn(value: string | undefined): boolean {
  return typeof value === "string" && parseSentryDsn(value) !== null;
}

/**
 * Which environment the events belong to.
 *
 * Preview deployments must not raise issues against production. `VERCEL_ENV`
 * gives that for free on the platform this app is deployed to.
 */
export function resolveSentryEnvironment(env: SentryEnvSource): string {
  return (
    clean(env.NEXT_PUBLIC_SENTRY_ENVIRONMENT) ??
    clean(env.VERCEL_ENV) ??
    clean(env.NODE_ENV) ??
    "development"
  );
}

/**
 * The release the events are attributed to, and what source maps are matched
 * against. An upload tagged with a release the running code does not report
 * produces minified stack traces and no error, which is the hardest version of
 * this to notice.
 */
export function resolveSentryRelease(env: SentryEnvSource): string | undefined {
  return clean(env.NEXT_PUBLIC_SENTRY_RELEASE) ?? clean(env.VERCEL_GIT_COMMIT_SHA);
}

/** Parses the override; anything outside 0–1 falls back to the default. */
function resolveTracesSampleRate(env: SentryEnvSource, environment: string): number {
  const raw = clean(env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE);
  if (raw !== undefined) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) return parsed;
  }
  return environment === "production"
    ? PRODUCTION_TRACES_SAMPLE_RATE
    : DEVELOPMENT_TRACES_SAMPLE_RATE;
}

/** Tags every event with the host the deployment answers on. */
function resolveSiteTag(env: SentryEnvSource): string | undefined {
  const url = clean(env.NEXT_PUBLIC_SITE_URL);
  if (!url) return undefined;
  try {
    return new URL(url).host;
  } catch {
    return undefined;
  }
}

/**
 * The only request headers an event keeps.
 *
 * An allowlist, not a denylist, and that is the whole point: `sendDefaultPii:
 * false` does NOT strip request headers on the Next.js server SDK — it governs
 * IP and user attribution. An unfiltered event carries `cookie: session=…` and
 * `authorization: Bearer …` straight into the project. A denylist would have to
 * anticipate every header that ever carries a credential; this fails closed
 * instead, and the cost of a missing header is a thinner debugging context.
 */
export const SENTRY_KEPT_HEADERS: readonly string[] = [
  "host",
  "user-agent",
  "accept",
  "accept-language",
  "content-type",
  "content-length",
];

/** The shape `scrubSentryEvent` touches — structural, so no SDK import. */
export interface SentryScrubbableEvent {
  request?: {
    url?: string;
    headers?: Record<string, string>;
    cookies?: Record<string, string> | string;
    query_string?: string | Record<string, string> | Array<[string, string]>;
  };
}

/** Replaces the value of every sensitive key in a `?a=b&c=d` string. */
function redactQueryString(query: string): string {
  return query
    .split("&")
    .map((pair) => {
      const eq = pair.indexOf("=");
      if (eq === -1) return pair;
      const name = pair.slice(0, eq);
      return SENTRY_REDACTED_QUERY_KEYS.includes(decodeURIComponent(name).toLowerCase())
        ? `${name}=${REDACTED}`
        : pair;
    })
    .join("&");
}

/**
 * Strips credentials from an event before it is sent.
 *
 * Wired as both `beforeSend` and `beforeSendTransaction`: a transaction carries
 * the same `request` block as an error, so filtering only errors would leak the
 * same cookie on the next traced request.
 */
export function scrubSentryEvent<T extends SentryScrubbableEvent>(event: T): T {
  const request = event.request;
  if (!request) return event;

  if (request.headers) {
    const kept: Record<string, string> = {};
    for (const [name, value] of Object.entries(request.headers)) {
      if (SENTRY_KEPT_HEADERS.includes(name.toLowerCase())) kept[name] = value;
    }
    request.headers = kept;
  }

  // Sentry parses these out of the request separately; the allowlist never
  // sees them.
  if (request.cookies) request.cookies = {};

  if (typeof request.query_string === "string") {
    request.query_string = redactQueryString(request.query_string);
  } else if (request.query_string) {
    const q = request.query_string;
    request.query_string = Array.isArray(q)
      ? q.map(([k, value]) =>
          SENTRY_REDACTED_QUERY_KEYS.includes(k.toLowerCase())
            ? ([k, REDACTED] as [string, string])
            : ([k, value] as [string, string]),
        )
      : Object.fromEntries(
          Object.entries(q).map(([k, value]) =>
            SENTRY_REDACTED_QUERY_KEYS.includes(k.toLowerCase()) ? [k, REDACTED] : [k, value],
          ),
        );
  }

  if (request.url) {
    // indexOf, not split: a second '?' is a legal character inside a query
    // value, and splitting on every one would truncate the URL.
    const mark = request.url.indexOf("?");
    if (mark !== -1) {
      request.url =
        request.url.slice(0, mark + 1) + redactQueryString(request.url.slice(mark + 1));
    }
  }

  return event;
}

/**
 * Builds the `Sentry.init` options for one runtime, or `null` when this
 * deployment has no Sentry project.
 *
 * Returning `null` is the load-bearing part: no DSN must mean no transport, no
 * breadcrumb buffer and no `beforeSend`. That is the state of every CI build
 * and of local development, and it has to cost nothing.
 */
export function resolveSentryOptions(
  runtime: SentryRuntime,
  env: SentryEnvSource = typeof process !== "undefined" ? (process.env as SentryEnvSource) : {},
  warn: (message: string) => void = (message) => console.warn(message),
): SentryOptions | null {
  const dsn =
    runtime === "convex"
      ? (clean(env.SENTRY_DSN) ?? clean(env.NEXT_PUBLIC_SENTRY_DSN))
      : clean(env.NEXT_PUBLIC_SENTRY_DSN);
  if (!dsn) return null;

  if (!isSentryDsn(dsn)) {
    // Loud on purpose. Shipping the variable while reporting nothing is the
    // failure this module exists to end.
    warn(
      `[sentry] ${runtime === "convex" ? "SENTRY_DSN" : "NEXT_PUBLIC_SENTRY_DSN"} is set but ` +
        `is not a Sentry DSN (expected https://<key>@<host>/<projectId>). Error reporting is ` +
        `OFF for the ${runtime} runtime.`,
    );
    return null;
  }

  const environment = resolveSentryEnvironment(env);
  const site = resolveSiteTag(env);

  return {
    dsn,
    environment,
    release: resolveSentryRelease(env),
    tracesSampleRate: resolveTracesSampleRate(env, environment),
    sendDefaultPii: false,
    debug: false,
    initialScope: { tags: { runtime, ...(site ? { site } : {}) } },
    beforeSend: scrubSentryEvent,
    beforeSendTransaction: scrubSentryEvent,
  };
}

/* ── DSN ──────────────────────────────────────────────────────────────────── */

/** The pieces of `https://<publicKey>@<host>/<projectId>` an envelope needs. */
export interface SentryDsnParts {
  publicKey: string;
  host: string;
  projectId: string;
  /** The store endpoint an envelope is POSTed to. */
  envelopeUrl: string;
}

/**
 * Splits a DSN into what the ingestion request needs.
 *
 * Returns `null` rather than throwing on anything malformed. A reporter that
 * throws while reporting turns one failed webhook into two, and the second is
 * invisible for exactly the same reason as the first.
 *
 * The path may carry a prefix on a self-hosted Sentry — `/some/path/42` — so
 * the project id is the LAST segment and everything before it belongs to the
 * endpoint. A query or a fragment is refused: a DSN carries neither, and the
 * SDK's own parser would read the project id of `…/4505?x=1` as `4505?x=1`.
 */
export function parseSentryDsn(dsn: string): SentryDsnParts | null {
  let url: URL;
  try {
    url = new URL(dsn.trim());
  } catch {
    return null;
  }

  if (url.search || url.hash) return null;

  const publicKey = url.username;
  const cut = url.pathname.lastIndexOf("/");
  const projectId = url.pathname.slice(cut + 1);
  if (!publicKey || !/^\d+$/.test(projectId)) return null;

  const prefix = url.pathname.slice(0, cut);
  return {
    publicKey,
    host: url.host,
    projectId,
    envelopeUrl: `${url.protocol}//${url.host}${prefix}/api/${projectId}/envelope/`,
  };
}

/**
 * The origin a browser posts events to, for the `connect-src` of the CSP.
 *
 * Without it the browser SDK initialises, captures, and has every send blocked
 * by the policy — a monitoring setup that reports nothing while looking
 * configured. Returns `null` when there is no DSN or it is unreadable, so the
 * policy simply gains no entry.
 */
export function sentryIngestOrigin(dsn: string | undefined): string | null {
  const parsed = clean(dsn) ? parseSentryDsn(clean(dsn) as string) : null;
  if (!parsed) return null;
  try {
    return new URL(parsed.envelopeUrl).origin;
  } catch {
    return null;
  }
}

/** The header that authenticates an envelope. `sentry_version=7` is current. */
export function sentryAuthHeader(parts: SentryDsnParts, client: string): string {
  return `Sentry sentry_version=7, sentry_client=${client}, sentry_key=${parts.publicKey}`;
}

/* ── The event, built by hand ─────────────────────────────────────────────── */

/** One line of a stack trace, in Sentry's shape. */
export interface SentryStackFrame {
  filename?: string;
  function?: string;
  lineno?: number;
  colno?: number;
  in_app: boolean;
}

/** One thrown thing. `type` is what Sentry titles the issue with. */
export interface SentryExceptionValue {
  type: string;
  value: string;
  stacktrace?: { frames: SentryStackFrame[] };
}

/** The event body, i.e. the third line of the envelope. */
export interface SentryErrorEvent {
  event_id: string;
  /** Seconds since the epoch, not milliseconds — Sentry reads it as seconds. */
  timestamp: number;
  platform: "node";
  level: "fatal" | "error" | "warning" | "info";
  logger: string;
  environment: string;
  release?: string;
  tags: Record<string, string>;
  extra?: Record<string, unknown>;
  exception: { values: SentryExceptionValue[] };
}

/**
 * Caps. Sentry's limit is 1 MiB compressed per envelope and it drops the whole
 * thing on overflow — so an oversized field does not produce a truncated
 * report, it produces no report.
 */
export const MAX_MESSAGE_CHARS = 2_000;
export const MAX_EXTRA_VALUE_CHARS = 2_000;
export const MAX_STACK_FRAMES = 50;

const truncate = (value: string, limit: number): string =>
  value.length <= limit ? value : `${value.slice(0, limit)}… [${value.length - limit} more]`;

/**
 * Sentry titles an issue after the topmost `in_app` frame. Marking a dependency
 * as ours produces issues named after `convex/server` rather than after the
 * handler that failed — one grouping for every unrelated fault.
 */
const isAppFrame = (filename: string | undefined): boolean =>
  filename !== undefined && !filename.includes("node_modules");

/**
 * `at fn (file:line:col)` and `at file:line:col` — the two shapes V8 emits, and
 * the only ones the Convex runtime produces.
 *
 * Sentry orders frames oldest-first and draws the last one as the crash site; a
 * stack string is newest-first, hence the reverse. An unparseable line is
 * dropped rather than guessed at: half a stack trace is still a stack trace, and
 * a frame with an invented filename sends whoever reads it to the wrong file.
 */
export function parseStackFrames(stack: string | undefined): SentryStackFrame[] {
  if (!stack) return [];

  const frames: SentryStackFrame[] = [];
  for (const line of stack.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("at ")) continue;

    const named = /^at\s+(.+?)\s+\((.+):(\d+):(\d+)\)$/.exec(trimmed);
    const bare = /^at\s+(.+):(\d+):(\d+)$/.exec(trimmed);

    if (named) {
      frames.push({
        function: named[1],
        filename: named[2],
        lineno: Number(named[3]),
        colno: Number(named[4]),
        in_app: isAppFrame(named[2]),
      });
    } else if (bare) {
      frames.push({
        filename: bare[1],
        lineno: Number(bare[2]),
        colno: Number(bare[3]),
        in_app: isAppFrame(bare[1]),
      });
    }
  }

  return frames.reverse().slice(-MAX_STACK_FRAMES);
}

/** `JSON.stringify` that survives a circular reference and a BigInt. */
function safeStringify(value: unknown): string | undefined {
  try {
    const ancestors: unknown[] = [];
    return JSON.stringify(value, function (this: unknown, _key, item: unknown) {
      if (typeof item === "bigint") return `${item.toString()}n`;
      if (typeof item !== "object" || item === null) return item;
      while (ancestors.length > 0 && ancestors[ancestors.length - 1] !== this) ancestors.pop();
      if (ancestors.includes(item)) return "[Circular]";
      ancestors.push(item);
      return item;
    });
  } catch {
    return undefined;
  }
}

/** What a caught `unknown` turns into. */
export interface DescribedError {
  type: string;
  value: string;
  stack: string | undefined;
}

/**
 * What Sentry titles the issue with.
 *
 * `error.name` alone is not enough: `class TimeoutError extends Error {}` never
 * assigns `this.name`, so it inherits `'Error'` from the prototype and every
 * such class collapses into one undifferentiated `Error` issue. The constructor
 * knows its own name.
 */
function exceptionType(error: Error): string {
  if (error.name && error.name !== "Error") return error.name;
  const constructed: unknown = (error as { constructor?: { name?: unknown } }).constructor?.name;
  return typeof constructed === "string" && constructed ? constructed : "Error";
}

/**
 * Reads a caught value of any shape.
 *
 * `catch (error)` is typed `unknown` and this backend throws four different
 * things through it: `Error`, `ConvexError` (whose `data` carries the refusal
 * code), a bare string, and — from a failed `await response.json()` — a plain
 * object. An issue titled `Object` with the value `[object Object]` is the
 * failure mode this avoids.
 */
export function describeUnknownError(error: unknown): DescribedError {
  if (error instanceof Error) {
    const data = (error as { data?: unknown }).data;
    const detail =
      data === undefined ? undefined : typeof data === "string" ? data : safeStringify(data);

    return {
      type: exceptionType(error),
      value: truncate(detail ? `${error.message} — ${detail}` : error.message, MAX_MESSAGE_CHARS),
      stack: error.stack,
    };
  }

  if (typeof error === "string") {
    return { type: "Error", value: truncate(error, MAX_MESSAGE_CHARS), stack: undefined };
  }

  return {
    type: "Error",
    value: truncate(safeStringify(error) ?? String(error), MAX_MESSAGE_CHARS),
    stack: undefined,
  };
}

/**
 * Splits a key into the words a human wrote into it.
 * `stripe_signature_header` → `['stripe','signature','header']`.
 */
function keySegments(key: string): string[] {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[\s_\-.:]+/)
    .filter(Boolean)
    .map((segment) => segment.toLowerCase());
}

/** `tokens` is `token`. A batch handler names its field in the plural. */
const singular = (word: string): string => (word.endsWith("s") ? word.slice(0, -1) : word);

/**
 * True when any word — or any run of adjacent words — in the key names a
 * credential.
 *
 * Runs, not just single segments, because `x-api-key` is a header name Stripe
 * and the affiliate portal both see: its segments are `x`, `api`, `key`, none of
 * which is `apikey`, and joining adjacent runs finds it.
 */
export function isSensitiveContextKey(key: string): boolean {
  const collapsed = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (SENTRY_REDACTED_CONTEXT_KEYS.includes(singular(collapsed))) return true;

  const segments = keySegments(key);
  for (let start = 0; start < segments.length; start += 1) {
    let run = "";
    for (let end = start; end < segments.length; end += 1) {
      run += segments[end];
      if (SENTRY_REDACTED_CONTEXT_KEYS.includes(singular(run))) return true;
    }
  }
  return false;
}

/**
 * The value a Convex report may attach. FLAT and primitive, deliberately.
 *
 * The engine's reporter takes arbitrary nesting and needs a recursive redactor
 * to be safe. Here the reporting call sites are countable, so the argument
 * validator refuses nesting outright and one pass over the keys is a complete
 * guard — there is no second level for a credential to hide on.
 */
export type SentryExtraValue = string | number | boolean | null;

/**
 * Replaces the value of anything whose key names a credential.
 *
 * This is the guard for the call site that forgot: `{ signature, rawBody }` is a
 * natural thing to attach to a webhook failure, and it must fail closed.
 */
export function redactSentryExtra(
  extra: Record<string, SentryExtraValue>,
): Record<string, SentryExtraValue> {
  const out: Record<string, SentryExtraValue> = {};
  for (const [key, value] of Object.entries(extra)) {
    if (isSensitiveContextKey(key)) {
      out[key] = REDACTED;
      continue;
    }
    out[key] = typeof value === "string" ? truncate(value, MAX_EXTRA_VALUE_CHARS) : value;
  }
  return out;
}

/** Everything the event needs that this module cannot invent for itself. */
export interface SentryErrorEventInput {
  error: unknown;
  /** A stable 32-character lowercase hex id. Sentry rejects a UUID with dashes. */
  eventId: string;
  /** Milliseconds since the epoch, as `Date.now()` gives them. */
  now: number;
  environment: string;
  release?: string | undefined;
  level?: SentryErrorEvent["level"];
  /** What was running: `"stripeWebhook"`, `"saMonitoring.runRound"`. A tag. */
  source: string;
  tags?: Record<string, string>;
  extra?: Record<string, SentryExtraValue>;
}

/** Assembles the event body. Pure — every varying input is an argument. */
export function buildSentryErrorEvent(input: SentryErrorEventInput): SentryErrorEvent {
  const described = describeUnknownError(input.error);
  const frames = parseStackFrames(described.stack);

  return {
    event_id: input.eventId,
    timestamp: Math.floor(input.now / 1000),
    platform: "node",
    level: input.level ?? "error",
    logger: "convex",
    environment: input.environment,
    ...(input.release ? { release: input.release } : {}),
    tags: { runtime: "convex", source: input.source, ...input.tags },
    ...(input.extra ? { extra: redactSentryExtra(input.extra) } : {}),
    exception: {
      values: [
        {
          type: described.type,
          value: described.value,
          ...(frames.length > 0 ? { stacktrace: { frames } } : {}),
        },
      ],
    },
  };
}

/**
 * Frames an event as an envelope: three newline-delimited JSON objects —
 * header, item header, item.
 *
 * `dsn` in the envelope header is what lets Sentry route a request that was
 * proxied; the auth header carries the key regardless. Both are sent because
 * both are cheap and only one of them being wrong is hard to notice.
 */
export function buildSentryEnvelope(
  event: SentryErrorEvent,
  dsn: string,
  sentAt: number,
): string {
  const header = JSON.stringify({
    event_id: event.event_id,
    sent_at: new Date(sentAt).toISOString(),
    dsn,
  });
  const body = safeStringify(event) ?? JSON.stringify({ ...event, extra: undefined });
  const itemHeader = JSON.stringify({
    type: "event",
    content_type: "application/json",
    // BYTES, not characters. Sentry reads exactly this many bytes from the
    // stream and `String.length` counts UTF-16 code units — so a message
    // holding a single `é` declares one byte fewer than it sends and Sentry is
    // handed truncated JSON. Every refusal string this backend throws is in
    // French, so the failure would split cleanly down the middle: ASCII errors
    // reported, accented ones rejected with a 400 nobody reads.
    length: new TextEncoder().encode(body).length,
  });
  return `${header}\n${itemHeader}\n${body}`;
}

/**
 * A Sentry event id: 32 lowercase hex characters, no dashes.
 *
 * Takes the raw bytes rather than calling `crypto`, so the module stays pure and
 * the caller decides where the randomness comes from — a Convex *mutation* may
 * not call `crypto.getRandomValues()` at all.
 */
export function formatSentryEventId(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < 16; i += 1) {
    out += (bytes[i] ?? 0).toString(16).padStart(2, "0");
  }
  return out;
}
