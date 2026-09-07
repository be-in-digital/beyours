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

/** What the Next server observed, in the form Convex can check. */
export interface SignerIpAttestation {
  /** The address, exactly as it was signed. */
  ip: string
  /** When the Next server observed it (ms since epoch). */
  issuedAt: number
  /** HMAC-SHA256 of {@link attestationPayload}, hex. */
  mac: string
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

export type AttestationVerdict =
  | { ip: string; refusal: null }
  | { ip: null; refusal: AttestationRefusal }

/**
 * A plausible IPv4 or IPv6 address, trimmed, or `null`.
 *
 * `x-forwarded-for` is attacker-influenced ahead of the proxy that rewrites it,
 * and it is free text: an address is the only thing worth minting, and an
 * address is short. Anything else — a hostname, a comma-separated chain that
 * was not split, six kilobytes of padding — is refused here rather than signed
 * and then drawn onto a legal document.
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
 */
export function attestationPayload(ip: string, issuedAt: number): string {
  return `beyours.signer-ip.v1|${ip.length}|${ip}|${issuedAt}`
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
 * `null` when there is no secret to sign with, or when what was observed is not
 * an address.
 */
export async function mintSignerIpAttestation(
  observedIp: string | null | undefined,
  opts: { secret: string | null; now: number },
): Promise<SignerIpAttestation | null> {
  const ip = normaliseIp(observedIp)
  if (!ip || !opts.secret) return null
  return {
    ip,
    issuedAt: opts.now,
    mac: await hmacHex(opts.secret, attestationPayload(ip, opts.now)),
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
  attestation: SignerIpAttestation | null | undefined,
  opts: { secret: string | null; now: number },
): Promise<AttestationVerdict> {
  if (!opts.secret) return { ip: null, refusal: 'no_secret' }
  if (!attestation) return { ip: null, refusal: 'malformed' }

  const ip = normaliseIp(attestation.ip)
  const { issuedAt, mac } = attestation
  if (!ip || !Number.isFinite(issuedAt) || !/^[0-9a-f]{64}$/.test(mac)) {
    return { ip: null, refusal: 'malformed' }
  }

  /* The MAC is checked BEFORE the clock: `issuedAt` is part of what is signed,
     so an unsigned attestation's date says nothing, and answering « expired »
     to a forgery would tell whoever sent it which half to fix next. */
  const expected = await hmacHex(opts.secret, attestationPayload(ip, issuedAt))
  if (!macsMatch(expected, mac)) return { ip: null, refusal: 'bad_mac' }

  const age = opts.now - issuedAt
  if (age > SIGNER_IP_ATTESTATION_TTL_MS) return { ip: null, refusal: 'expired' }
  if (age < -SIGNER_IP_ATTESTATION_SKEW_MS) {
    return { ip: null, refusal: 'not_yet_valid' }
  }

  return { ip, refusal: null }
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
  }
}
