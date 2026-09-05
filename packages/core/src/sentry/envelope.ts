/**
 * A Sentry error event, built and framed by hand.
 *
 * ## Why this is not `@sentry/node`
 *
 * The functions that need to report live in `apps/*\/convex`, and a Convex
 * module is not a Node program. The default Convex runtime is a V8 isolate with
 * `fetch` and no Node API; `@sentry/node` wants `async_hooks`, a global error
 * handler and a background flush timer, none of which exist there. Moving the
 * reporting into a `"use node"` action instead would put every reporting call
 * behind a module boundary that no query, no mutation and no `httpAction` can
 * cross — `httpAction` in particular cannot be `"use node"` at all, and the
 * Stripe, Deliveroo, Uber and SES webhooks are all `httpAction`s. That is the
 * entire surface this exists to cover.
 *
 * So the wire format is written out instead. It is small, it is stable — the
 * envelope has been Sentry's ingestion format since 2019 and is versioned in
 * the request header — and it is one `fetch` with no dependency, which is what
 * makes it usable from the runtime the errors actually happen in.
 *
 * ## Why here
 *
 * `sentry/index.ts` is already import-free for exactly this reason, and already
 * resolves the DSN, the environment and the release for the three Next.js
 * runtimes. Building the event next to it is what keeps a Convex error and a
 * browser error landing in the same project, tagged the same way, with the same
 * scrubbing — rather than in a second stream with its own conventions.
 *
 * Everything here is pure. No clock, no randomness, no I/O: the event id and
 * the timestamp are arguments, because a Convex *mutation* may not call
 * `crypto.randomUUID()` or `Date.now()` and a test may not guess them.
 *
 * See `apps/docs/deployment/sentry.md`.
 *
 * @module sentry/envelope
 */

import { REDACTED, SENTRY_REDACTED_CONTEXT_KEYS } from './redaction-keys'

/** The pieces of `https://<publicKey>@<host>/<projectId>` an envelope needs. */
export interface SentryDsnParts {
  publicKey: string
  host: string
  projectId: string
  /** The store endpoint an envelope is POSTed to. */
  envelopeUrl: string
}

/**
 * Splits a DSN into what the ingestion request needs.
 *
 * Returns `null` rather than throwing on anything malformed. A reporter that
 * throws while reporting turns one failed order into two, and the second one is
 * invisible for the same reason as the first.
 */
export function parseSentryDsn(dsn: string): SentryDsnParts | null {
  let url: URL
  try {
    url = new URL(dsn.trim())
  } catch {
    return null
  }

  // The path may carry a prefix on a self-hosted Sentry — `/some/path/42`. The
  // project id is the LAST segment and everything before it belongs to the
  // endpoint. Reading the whole pathname instead rejected every prefixed DSN,
  // which is the shape a self-hosted Sentry behind a reverse proxy has.
  // A DSN carries neither. Rejecting them keeps this exactly as strict as the
  // regex it replaced: `isSentryDsn` delegates here, so anything accepted
  // reaches `Sentry.init`, and the SDK's own parser would read the project id
  // of `…/4505?x=1` as `4505?x=1`.
  if (url.search || url.hash) return null

  const publicKey = url.username
  const cut = url.pathname.lastIndexOf('/')
  const projectId = url.pathname.slice(cut + 1)
  if (!publicKey || !/^\d+$/.test(projectId)) return null

  const prefix = url.pathname.slice(0, cut)
  return {
    publicKey,
    host: url.host,
    projectId,
    envelopeUrl: `${url.protocol}//${url.host}${prefix}/api/${projectId}/envelope/`,
  }
}

/** The header that authenticates an envelope. `sentry_version=7` is current. */
export function sentryAuthHeader(parts: SentryDsnParts, client: string): string {
  return `Sentry sentry_version=7, sentry_client=${client}, sentry_key=${parts.publicKey}`
}

/** One line of a stack trace, in Sentry's shape. */
export interface SentryStackFrame {
  filename?: string
  function?: string
  lineno?: number
  colno?: number
  in_app: boolean
}

/** One thrown thing. `type` is what Sentry titles the issue with. */
export interface SentryExceptionValue {
  type: string
  value: string
  stacktrace?: { frames: SentryStackFrame[] }
}

/** The event body, i.e. the third line of the envelope. */
export interface SentryErrorEvent {
  event_id: string
  /** Seconds since the epoch, not milliseconds — Sentry reads it as seconds. */
  timestamp: number
  platform: 'node'
  level: 'fatal' | 'error' | 'warning' | 'info'
  logger: string
  environment: string
  release?: string
  tags: Record<string, string>
  extra?: Record<string, unknown>
  exception: { values: SentryExceptionValue[] }
}

/**
 * Caps. Sentry's own limit is 1 MiB compressed per envelope and it drops the
 * whole thing on overflow — so a 200 KB Deliveroo payload in `extra` would not
 * produce a truncated report, it would produce no report. `record` in
 * `platformWebhookFailures` bounds a raw body at 20 000 characters for the same
 * reason; these are tighter because a stack and a message are all that is
 * needed to act.
 */
export const MAX_MESSAGE_CHARS = 2_000
export const MAX_EXTRA_VALUE_CHARS = 2_000
export const MAX_STACK_FRAMES = 50

const truncate = (value: string, limit: number): string =>
  value.length <= limit ? value : `${value.slice(0, limit)}… [${value.length - limit} more]`

/**
 * `at fn (file:line:col)` and `at file:line:col` — the two shapes V8 emits, and
 * the only ones the Convex runtime produces.
 *
 * Sentry orders frames oldest-first and draws the last one as the crash site;
 * a stack string is newest-first, hence the reverse. An unparseable line is
 * dropped rather than guessed at: half a stack trace is still a stack trace,
 * and a frame with a made-up filename sends whoever reads it to the wrong file.
 */
/**
 * Sentry titles an issue after the topmost `in_app` frame. Marking a dependency
 * as ours produces issues named after `convex/server` rather than after the
 * handler that failed, which is one grouping for every unrelated fault.
 */
function isAppFrame(filename: string | undefined): boolean {
  return filename !== undefined && !filename.includes('node_modules')
}

export function parseStackFrames(stack: string | undefined): SentryStackFrame[] {
  if (!stack) return []

  const frames: SentryStackFrame[] = []
  for (const line of stack.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('at ')) continue

    const named = /^at\s+(.+?)\s+\((.+):(\d+):(\d+)\)$/.exec(trimmed)
    const bare = /^at\s+(.+):(\d+):(\d+)$/.exec(trimmed)

    if (named) {
      frames.push({
        function: named[1],
        filename: named[2],
        lineno: Number(named[3]),
        colno: Number(named[4]),
        in_app: isAppFrame(named[2]),
      })
    } else if (bare) {
      frames.push({
        filename: bare[1],
        lineno: Number(bare[2]),
        colno: Number(bare[3]),
        in_app: isAppFrame(bare[1]),
      })
    }
  }

  return frames.reverse().slice(-MAX_STACK_FRAMES)
}

/** What a caught `unknown` turns into. */
export interface DescribedError {
  type: string
  value: string
  stack: string | undefined
}

/**
 * Reads a caught value of any shape.
 *
 * `catch (error)` is typed `unknown` and this repository throws four different
 * things through it: `Error`, `ConvexError` (whose `data` carries the refusal
 * code and is the only part Convex does not redact in production), a bare
 * string, and — from a failed `await response.json()` — a plain object. An
 * issue titled `Object` with the value `[object Object]` is the failure mode
 * this avoids.
 */
export function describeUnknownError(error: unknown): DescribedError {
  if (error instanceof Error) {
    // ConvexError puts the useful part on `data`, and its `message` is often
    // the redacted "Server Error". Read `data` when it is there.
    const data = (error as { data?: unknown }).data
    const detail =
      data === undefined
        ? undefined
        : typeof data === 'string'
          ? data
          : safeStringify(data)

    return {
      type: exceptionType(error),
      value: truncate(detail ? `${error.message} — ${detail}` : error.message, MAX_MESSAGE_CHARS),
      stack: error.stack,
    }
  }

  if (typeof error === 'string') {
    return { type: 'Error', value: truncate(error, MAX_MESSAGE_CHARS), stack: undefined }
  }

  return {
    type: 'Error',
    value: truncate(safeStringify(error) ?? String(error), MAX_MESSAGE_CHARS),
    stack: undefined,
  }
}

/**
 * What Sentry titles the issue with.
 *
 * `error.name` alone is not enough. `class TimeoutError extends Error {}` never
 * assigns `this.name`, so it inherits `'Error'` from the prototype — and every
 * such class in this codebase would collapse into one undifferentiated `Error`
 * issue, which is the state that makes an issue stream unreadable. The
 * constructor knows its own name; built-ins like `TypeError` set `name` on the
 * prototype and are unaffected either way.
 */
function exceptionType(error: Error): string {
  if (error.name && error.name !== 'Error') return error.name
  const constructed: unknown = (error as { constructor?: { name?: unknown } }).constructor?.name
  return typeof constructed === 'string' && constructed ? constructed : 'Error'
}

/**
 * `JSON.stringify` that survives a circular reference and a BigInt.
 *
 * The stack, rather than a flat set, for the same reason `redactValue` deletes
 * on the way out: a cumulative set cannot tell a CYCLE from the same object
 * appearing twice as siblings, and reports the second sibling as `[Circular]`.
 * `JSON.stringify` calls the replacer with the containing object as `this`, so
 * unwinding is a matter of popping everything that is no longer an ancestor.
 */
function safeStringify(value: unknown): string | undefined {
  try {
    const ancestors: unknown[] = []
    return JSON.stringify(value, function (this: unknown, _key, item: unknown) {
      if (typeof item === 'bigint') return `${item.toString()}n`
      if (typeof item !== 'object' || item === null) return item

      while (ancestors.length > 0 && ancestors[ancestors.length - 1] !== this) {
        ancestors.pop()
      }
      if (ancestors.includes(item)) return '[Circular]'
      ancestors.push(item)
      return item
    })
  } catch {
    return undefined
  }
}

/**
 * Splits a key into the words a human wrote into it.
 *
 * `stripe_signature_header` → `['stripe', 'signature', 'header']`;
 * `secretValue` → `['secret', 'value']`; `s3Key` → `['s3', 'key']`.
 */
function keySegments(key: string): string[] {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[\s_\-.:]+/)
    .filter(Boolean)
    .map((segment) => segment.toLowerCase())
}

/** `tokens` is `token`. A batch handler names its field in the plural. */
const singular = (word: string): string => (word.endsWith('s') ? word.slice(0, -1) : word)

/**
 * True when any word — or any run of adjacent words — in the key names a
 * credential.
 *
 * Runs, not just single segments, because `x-api-key` is the header name
 * Deliveroo and Uber actually send: its segments are `x`, `api`, `key`, none of
 * which is `apikey`, and its collapsed form is `xapikey`. Joining adjacent runs
 * finds `apikey` inside it. Plurals are stemmed for the same class of near
 * miss — `{ tokens: [...] }` used to leave in full.
 */
export function isSensitiveContextKey(key: string): boolean {
  const collapsed = key.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (SENTRY_REDACTED_CONTEXT_KEYS.includes(singular(collapsed))) return true

  const segments = keySegments(key)
  for (let start = 0; start < segments.length; start += 1) {
    let run = ''
    for (let end = start; end < segments.length; end += 1) {
      run += segments[end]
      if (SENTRY_REDACTED_CONTEXT_KEYS.includes(singular(run))) return true
    }
  }
  return false
}

/** How deep the walk goes before it stops looking. */
export const MAX_EXTRA_DEPTH = 5

/**
 * Replaces the value of anything whose key names a credential.
 *
 * `scrubSentryEvent` guards the `request` block of a browser or server event;
 * nothing guarded a Convex one, and its context is assembled by hand at the
 * call site — where `{ signature, rawBody }` is a natural thing to attach to a
 * webhook failure. This is the guard for the call site that forgot, so it has
 * to fail CLOSED: a credential the caller did not think about must not be the
 * one that leaves.
 *
 * Recursive, because a flat check is only as good as the shape it is handed.
 * `{ payload: { token } }` is one `JSON.parse` away from any webhook handler in
 * this directory, and a shallow pass sends it verbatim.
 */
export function redactSentryExtra(
  extra: Record<string, unknown>,
  depth = 0,
  seen: WeakSet<object> = new WeakSet(),
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(extra)) {
    if (isSensitiveContextKey(key)) {
      out[key] = REDACTED
      continue
    }
    // Reading the property is where this can throw, not just walking it:
    // `Object.entries` INVOKES getters, and a getter that throws would
    // propagate out through `buildSentryErrorEvent` and be caught by the
    // reporter as "the reporter itself failed" — losing the whole report over
    // one unreadable field. Keys are taken first and read one at a time so the
    // failure is contained to the field that caused it.
    try {
      out[key] = redactValue(extra[key], depth, seen)
    } catch {
      out[key] = '[Unreadable]'
    }
  }
  return out
}

/** True for `{}` and `Object.create(null)`, false for `Date`, `Map`, `Error`. */
const isPlainObject = (value: object): boolean => {
  const proto: unknown = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

function redactValue(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (typeof value === 'string') return truncate(value, MAX_EXTRA_VALUE_CHARS)
  if (value === null || value === undefined) return null

  // `JSON.stringify` throws on a BigInt, and the throw happens later — in
  // `buildSentryEnvelope`, where it is caught as "the reporter itself failed"
  // and the whole report is lost. A price in cents is a plausible thing to
  // attach to a payment failure, so it is converted here rather than trusted.
  if (typeof value === 'bigint') return `${value.toString()}n`
  if (typeof value !== 'object') return value

  // Without this a cycle still terminates — on the depth ceiling — but it is
  // DUPLICATED once per level on the way there, which is multiplicative on a
  // wide object, against a 1 MiB envelope cap and a Convex CPU budget. `seen`
  // is per-BRANCH, not cumulative: entries come out again in the `finally`
  // below, so the same object appearing twice as siblings is still walked twice
  // in full. A cumulative set would report the second sibling as a cycle.
  if (seen.has(value)) return '[Circular]'
  if (depth >= MAX_EXTRA_DEPTH) return REDACTED

  // `Error` and `Date` walk to `{}` — their contents are not enumerable own
  // properties — so they are converted rather than walked. A nested `Error`
  // losing its message is the one that costs most. `Set` and `Map` have the
  // same problem and are handled below, after `seen.add`, because unlike these
  // two they can contain a cycle.
  if (value instanceof Error) return `${value.name}: ${truncate(value.message, MAX_MESSAGE_CHARS)}`
  if (value instanceof Date) return value.toISOString()

  seen.add(value)
  try {
    if (Array.isArray(value)) return value.map((item) => redactValue(item, depth + 1, seen))
    if (value instanceof Set) {
      return [...value].map((item) => redactValue(item, depth + 1, seen))
    }
    if (value instanceof Map) {
      return redactSentryExtra(Object.fromEntries(value), depth + 1, seen)
    }
    if (isPlainObject(value)) {
      return redactSentryExtra(value as Record<string, unknown>, depth + 1, seen)
    }
    // Anything else — a class instance, a typed array. Stringified rather than
    // walked, so it arrives as something rather than as `{}`.
    return safeStringify(value) ?? String(value)
  } finally {
    seen.delete(value)
  }
}

/** Everything the event needs that this module cannot invent for itself. */
export interface SentryErrorEventInput {
  error: unknown
  /** A stable 32-character lowercase hex id. Sentry rejects a UUID with dashes. */
  eventId: string
  /** Milliseconds since the epoch, as `Date.now()` gives them. */
  now: number
  environment: string
  release?: string | undefined
  level?: SentryErrorEvent['level']
  /** What was running: `"stripeWebhook"`, `"orders.create"`. Becomes a tag. */
  source: string
  tags?: Record<string, string>
  extra?: Record<string, unknown>
}

/** Assembles the event body. Pure — every varying input is an argument. */
export function buildSentryErrorEvent(input: SentryErrorEventInput): SentryErrorEvent {
  const described = describeUnknownError(input.error)
  const frames = parseStackFrames(described.stack)

  return {
    event_id: input.eventId,
    timestamp: Math.floor(input.now / 1000),
    platform: 'node',
    level: input.level ?? 'error',
    logger: 'convex',
    environment: input.environment,
    ...(input.release ? { release: input.release } : {}),
    tags: { runtime: 'convex', source: input.source, ...input.tags },
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
  }
}

/**
 * Frames an event as an envelope: three newline-delimited JSON objects —
 * header, item header, item — and no trailing newline requirement.
 *
 * `dsn` in the envelope header is what lets Sentry route a request that was
 * proxied; the auth header carries the key regardless. Both are sent because
 * both are cheap and only one of them being wrong is hard to notice.
 */
export function buildSentryEnvelope(event: SentryErrorEvent, dsn: string, sentAt: number): string {
  const header = JSON.stringify({
    event_id: event.event_id,
    sent_at: new Date(sentAt).toISOString(),
    dsn,
  })
  // `safeStringify`, not `JSON.stringify`: `redactSentryExtra` normalises the
  // values it walks, but a caller can hand `buildSentryErrorEvent` an event it
  // built itself. A `TypeError` raised here is the report being lost entirely.
  const body = safeStringify(event) ?? JSON.stringify({ ...event, extra: undefined })
  const itemHeader = JSON.stringify({
    type: 'event',
    content_type: 'application/json',
    // BYTES, not characters. Sentry reads exactly this many bytes from the
    // stream, and `String.length` counts UTF-16 code units — so a message
    // holding a single `é` declares one byte fewer than it sends and Sentry is
    // handed truncated JSON. Every refusal string this backend throws is in
    // French, so the failure would have split cleanly down the middle: ASCII
    // errors reported, accented ones rejected with a 400 nobody reads.
    length: new TextEncoder().encode(body).length,
  })
  return `${header}\n${itemHeader}\n${body}`
}

/**
 * A Sentry event id: 32 lowercase hex characters, no dashes.
 *
 * Takes the raw bytes rather than calling `crypto`, so the module stays pure and
 * the caller decides where the randomness comes from — a Convex *mutation* may
 * not call `crypto.getRandomValues()` at all.
 */
export function formatSentryEventId(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < 16; i += 1) {
    out += (bytes[i] ?? 0).toString(16).padStart(2, '0')
  }
  return out
}
