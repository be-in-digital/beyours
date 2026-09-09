/* ── The signer's IP, as evidence rather than as a claim ──

   The affiliate contract is signed with a SIMPLE electronic signature (eIDAS
   art. 25): admissible, with the burden of proof on Be in Digital. What that
   burden rests on is the audit trail `convex/affiliateSignature.ts` draws onto
   the « certificat de signature » page — and one row of it used to be a
   number the signer chose.

   `signAffiliateContract` is a PUBLIC Convex action. It took `signerIp` as an
   argument, the page filled it from `/api/signer-ip`, and nothing anywhere
   checked that the two matched: calling the action directly with
   `signerIp: "8.8.8.8"` printed 8.8.8.8 on the certificate and stored it on the
   `contractSignatures` row. A field that any party to a dispute can set to any
   value is not evidence of where they were, and it sat on the document next to
   fields that ARE evidence — which is worse than not having it, because it
   reads the same.

   A Convex action cannot see the request's IP: it arrives over the client's
   WebSocket, not as an HTTP request the function can inspect. The Next server
   CAN see it, from the proxy header. So the observation is made where it is
   observable and carried across the gap in a form the observer can produce and
   the client cannot forge: an HMAC over the exact bytes, keyed on a secret both
   halves hold, with a short life.

   This is the same shape as the engine's transactional-mail bridge, for the
   same reason — Convex holds no AWS credentials, so it POSTs to the app's
   `/api/email/send` and the two halves share one secret. Here the direction is
   reversed: the app holds the observation, Convex holds the record.

   Both halves import THIS module, so the string that is signed and the string
   that is verified cannot drift apart.

   An HMAC alone was only half of it, and the missing half was the half the
   certificate actually claims. The MAC proves INTEGRITY — nobody edited the
   address after minting. The document claims PROVENANCE — « relevé par les
   serveurs de Be in Digital, jamais transmis par le signataire ». The route
   used to read plain `x-forwarded-for`, take its client end, and sign that:
   with no platform edge in front of the request, that header is the caller's
   own text. So an attacker never needed to forge a MAC. They asked this
   oracle for one, and it minted:

       curl -H 'x-forwarded-for: 8.8.8.8' …/api/signer-ip
         -> {"ip":"8.8.8.8", …}   verdict: {"ip":"8.8.8.8","refusal":null}
         -> certificate: « Adresse IP constatée : 8.8.8.8 »

   So the address is now read ONLY from a header the platform edge writes and
   a client cannot reach past it ({@link TRUSTED_SIGNER_IP_HEADERS}), and WHICH
   header it came from is inside the signed bytes — an attestation cannot be
   relabelled as edge-observed after the fact. Nothing else is signed at all:
   with no trusted header the route mints nothing rather than decorating a
   claim, and the certificate says « non établie », which the note beneath it
   already explains correctly.

   Fail-closed, and quietly so on purpose: a deployment with no secret set mints
   nothing, verifies nothing, and records no IP at all. Signing still works —
   the identity, the consent, the server timestamp and the SHA-256 content
   digest are what the signature rests on, and the IP corroborates them. Losing
   a corroboration is a smaller harm than printing « Adresse IP » next to a
   value the signer typed.

   Plain module, dependency-free, Web Crypto only: it is imported by a Next
   route handler AND by a `"use node"` Convex action, and it must be readable
   and testable on its own — same reasoning as convex/stripeMode.ts,
   convex/referralDiscount.ts and convex/affiliateStanding.ts. */

/** Held by the Next server AND by the Convex deployment. Set both, or neither. */
export const SIGNER_IP_SECRET_ENV = 'SIGNER_IP_SECRET'

/** Shortest secret worth having. Below this, minting is refused. */
export const SIGNER_IP_SECRET_MIN_LENGTH = 32

/**
 * How long a minted observation stays usable.
 *
 * The page fetches it and signs within seconds. Five minutes covers a slow
 * form, a re-read of the contract, a retried submit — and bounds the window in
 * which an attestation lifted from one session could be replayed from another
 * network.
 */
export const SIGNER_IP_ATTESTATION_TTL_MS = 5 * 60 * 1000

/**
 * Tolerance for the two clocks disagreeing. Vercel and Convex are both NTP-
 * synced; this is here so a second of skew does not throw away the trail.
 */
export const SIGNER_IP_ATTESTATION_SKEW_MS = 60 * 1000

/** Longest an IPv6 address with a zone id can be, plus room. */
export const MAX_IP_LENGTH = 64

/* ── The one place that decides what counts as an observation ──

   THE deployment-specific decision in this module. Everything else is
   arithmetic; this is a claim about the infrastructure in front of the app,
   and it is wrong on a host that does not make it true.

   On Vercel the edge sets `x-vercel-forwarded-for` and `x-real-ip` from the
   connection it terminated, overwriting whatever the client sent under those
   names — so a value arriving under one of them is an observation. Plain
   `x-forwarded-for` is deliberately NOT here: it is a list a client may
   prepend to, and every hop appends, so its client end is exactly the part
   the signer controls. That is the header this route used to sign.

   Order is descending trust, and only the first header PRESENT is consulted:
   a request carrying both is not an opportunity to pick the nicer answer.

   MOVING OFF VERCEL: add that platform's equivalent header here, and only
   here — a proxy of your own does not qualify unless it STRIPS the header on
   the way in. Removing an entry costs an audit row; adding the wrong one
   silently reinstates the defect above, so it belongs in a review, not in an
   env var. A deployment behind a proxy that sets none of these logs a warning
   on every signature and records « non établie », which is the honest answer. */
export const TRUSTED_SIGNER_IP_HEADERS = [
  'x-vercel-forwarded-for',
  'x-real-ip',
] as const

/** A header from {@link TRUSTED_SIGNER_IP_HEADERS}. */
export type SignerIpSource = (typeof TRUSTED_SIGNER_IP_HEADERS)[number]

/** An address the server saw, and the header it saw it in. */
export interface ObservedSignerIp {
  ip: string
  source: SignerIpSource
}

/** What the Next server observed, in the form Convex can check. */
export interface SignerIpAttestation {
  /** The address, exactly as it was signed. */
  ip: string
  /** When the Next server observed it (ms since epoch). */
  issuedAt: number
  /** HMAC-SHA256 of {@link attestationPayload}, hex. */
  mac: string
  /**
   * Which trusted header the address came from. Inside the signed bytes, so a
   * value read from somewhere else cannot be relabelled as edge-observed.
   */
  source: SignerIpSource
}

/**
 * The shape as it ARRIVES — over a public Convex argument, from a browser.
 *
 * Deliberately looser than {@link SignerIpAttestation}: `source` is a bare
 * string here and optional, because a bundle still holding the v1 shape sends
 * none. Narrowing it is {@link verifySignerIpAttestation}'s job, not the
 * validator's — an unverifiable attestation must cost the trail one row, never
 * the signature.
 */
export interface UnverifiedSignerIpAttestation {
  ip: string
  issuedAt: number
  mac: string
  source?: string
}

/** Why an attestation was not turned into a recorded IP. */
export type AttestationRefusal =
  /** No secret on this side — the deployment cannot check anything. */
  | 'no_secret'
  /** Shape is wrong: empty fields, a non-finite date, an implausible address. */
  | 'malformed'
  /** Minted with another key, or edited after minting. */
  | 'bad_mac'
  /** Older than the TTL. */
  | 'expired'
  /** Dated in the future by more than the skew allowance. */
  | 'not_yet_valid'
  /**
   * Signed, in date — and naming a header this deployment does not treat as an
   * observation. Only reachable through the secret itself or a
   * {@link TRUSTED_SIGNER_IP_HEADERS} entry removed since minting; either way
   * the certificate may not call it « constatée ».
   */
  | 'untrusted_source'

export type AttestationVerdict =
  | { ip: string; source: SignerIpSource; refusal: null }
  | { ip: null; source: null; refusal: AttestationRefusal }

/** Whether `raw` names a header this deployment observes addresses in. */
export function isTrustedSignerIpSource(
  raw: string | null | undefined,
): raw is SignerIpSource {
  return (TRUSTED_SIGNER_IP_HEADERS as readonly string[]).includes(raw ?? '')
}

/**
 * The address the platform edge observed, or `null`.
 *
 * The ONLY reader of request headers in this system. Consults
 * {@link TRUSTED_SIGNER_IP_HEADERS} in order and stops at the first one
 * present, so a caller cannot add a header to be preferred over the edge's.
 *
 * A header the edge writes carries one address, not a chain — but it is split
 * on `,` anyway and the FIRST entry taken, because a proxy chained behind the
 * edge appends its hops to the right and the leftmost entry stays the one the
 * trusted hop wrote. An unsplit chain would fail `normaliseIp` and mint
 * nothing, which is safe but throws the trail away for no reason.
 */
export function observeSignerIp(headers: Headers): ObservedSignerIp | null {
  for (const source of TRUSTED_SIGNER_IP_HEADERS) {
    const raw = headers.get(source)
    if (raw === null) continue
    const ip = normaliseIp(raw.split(',')[0])
    return ip ? { ip, source } : null
  }
  return null
}

/**
 * A plausible IPv4 or IPv6 address, trimmed, or `null`.
 *
 * Even a trusted header is free text on the wire: an address is the only thing
 * worth minting, and an address is short. Anything else — a hostname, a
 * comma-separated chain that was not split, six kilobytes of padding — is
 * refused here rather than signed and then drawn onto a legal document.
 */
export function normaliseIp(raw: string | null | undefined): string | null {
  const ip = raw?.trim() ?? ''
  if (ip.length < 3 || ip.length > MAX_IP_LENGTH) return null
  // Hex digits, dots and colons cover both families; `%` is an IPv6 zone id.
  return /^[0-9a-fA-F.:%]+$/.test(ip) ? ip : null
}

/**
 * The exact bytes both sides authenticate.
 *
 * Versioned, and every field length-delimited, so no two different observations
 * can produce the same payload — an address is not allowed to end up meaning
 * "this address plus part of the date".
 *
 * **v2 adds the source**, and the version bump is the point: an attestation
 * minted before the source existed cannot verify under v2, so a v1 attestation
 * held by a stale bundle degrades to « adresse non établie » rather than being
 * read as though someone had checked where it came from. Signing the source is
 * what stops a value read out of a caller-set header being relabelled as
 * edge-observed — it is inside the MAC, not beside it.
 */
export function attestationPayload(
  ip: string,
  issuedAt: number,
  source: SignerIpSource,
): string {
  return `beyours.signer-ip.v2|${source.length}|${source}|${ip.length}|${ip}|${issuedAt}`
}

/** The secret, or `null` when it is absent or too short to be one. */
export function readSignerIpSecret(
  env: Record<string, string | undefined>,
): string | null {
  const secret = env[SIGNER_IP_SECRET_ENV]?.trim()
  if (!secret || secret.length < SIGNER_IP_SECRET_MIN_LENGTH) return null
  return secret
}

async function hmacHex(secret: string, payload: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

/** Length-independent, value-independent comparison of two hex digests. */
function macsMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/**
 * Sign an observed address. Called by the Next route handler, which is the only
 * half of the system that can see one.
 *
 * Takes what {@link observeSignerIp} returns and nothing else — an
 * {@link ObservedSignerIp} cannot be built without naming the trusted header
 * it came out of, so this function has no way to sign a bare string somebody
 * found lying around. That is the shape the defect turned on: it used to take
 * one.
 *
 * `null` when there is no secret to sign with, or when nothing was observed.
 */
export async function mintSignerIpAttestation(
  observed: ObservedSignerIp | null | undefined,
  opts: { secret: string | null; now: number },
): Promise<SignerIpAttestation | null> {
  if (!observed || !opts.secret) return null
  const ip = normaliseIp(observed.ip)
  if (!ip || !isTrustedSignerIpSource(observed.source)) return null
  const { source } = observed
  return {
    ip,
    issuedAt: opts.now,
    source,
    mac: await hmacHex(opts.secret, attestationPayload(ip, opts.now, source)),
  }
}

/**
 * The address the Next server observed, or the reason this is not one.
 *
 * Called by the Convex action. Never throws: an unverifiable attestation costs
 * the trail one corroborating row, and refusing to sign at all over it would
 * make a missing env var an onboarding outage.
 */
export async function verifySignerIpAttestation(
  attestation: UnverifiedSignerIpAttestation | null | undefined,
  opts: { secret: string | null; now: number },
): Promise<AttestationVerdict> {
  if (!opts.secret) return { ip: null, source: null, refusal: 'no_secret' }
  if (!attestation) return { ip: null, source: null, refusal: 'malformed' }

  const ip = normaliseIp(attestation.ip)
  const { issuedAt, mac, source } = attestation
  if (!ip || !Number.isFinite(issuedAt) || !/^[0-9a-f]{64}$/.test(mac)) {
    return { ip: null, source: null, refusal: 'malformed' }
  }
  /* Checked before the MAC, unlike everything else here, because an untrusted
     source is not a forgery: it is this deployment declining to call a
     correctly-signed observation « constatée ». A v1 attestation — no source
     at all — lands here too and is refused, which is the version bump doing
     its job rather than a MAC failure being reported as one. */
  if (!isTrustedSignerIpSource(source)) {
    return { ip: null, source: null, refusal: 'untrusted_source' }
  }

  /* The MAC is checked BEFORE the clock: `issuedAt` is part of what is signed,
     so an unsigned attestation's date says nothing, and answering « expired »
     to a forgery would tell whoever sent it which half to fix next. */
  const expected = await hmacHex(
    opts.secret,
    attestationPayload(ip, issuedAt, source),
  )
  if (!macsMatch(expected, mac)) {
    return { ip: null, source: null, refusal: 'bad_mac' }
  }

  const age = opts.now - issuedAt
  if (age > SIGNER_IP_ATTESTATION_TTL_MS) {
    return { ip: null, source: null, refusal: 'expired' }
  }
  if (age < -SIGNER_IP_ATTESTATION_SKEW_MS) {
    return { ip: null, source: null, refusal: 'not_yet_valid' }
  }

  return { ip, source, refusal: null }
}

/** What the certificate prints when no address could be established. */
export const IP_NOT_ESTABLISHED = 'non établie'

/** One line for the server log, naming what to fix. */
export function attestationRefusalMessage(refusal: AttestationRefusal): string {
  switch (refusal) {
    case 'no_secret':
      return `${SIGNER_IP_SECRET_ENV} absente ou trop courte sur le déploiement Convex — aucune adresse IP n'est consignée.`
    case 'malformed':
      return "Aucune attestation d'adresse IP exploitable n'accompagne la signature."
    case 'bad_mac':
      return "Attestation d'adresse IP non authentique (signature HMAC invalide) — adresse ignorée."
    case 'expired':
      return "Attestation d'adresse IP expirée — adresse ignorée."
    case 'not_yet_valid':
      return "Attestation d'adresse IP datée dans le futur — adresse ignorée."
    case 'untrusted_source':
      return (
        "Attestation d'adresse IP issue d'un en-tête non fiable : l'adresse " +
        "n'a pas été relevée par nos serveurs et ne peut pas être portée au " +
        'certificat — adresse ignorée.'
      )
  }
}
