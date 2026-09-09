import {
  SIGNER_IP_SECRET_ENV,
  TRUSTED_SIGNER_IP_HEADERS,
  mintSignerIpAttestation,
  observeSignerIp,
  readSignerIpSecret,
} from '@/lib/security/signer-attestation'

/**
 * The signer's IP address, observed here and signed so Convex can trust it.
 *
 * This route used to return the bare address and the signing page passed it on
 * to `signAffiliateContract` as an argument — which meant the certificate's
 * « Adresse IP » row was whatever the caller sent, this route or not. The
 * address is now returned inside an HMAC-signed attestation the Convex action
 * verifies; see lib/security/signer-attestation.ts for why the observation has
 * to cross the gap this way and what happens when it cannot.
 *
 * The HMAC alone was not enough, and this route is where the gap was. It read
 * plain `x-forwarded-for` and signed its client end — the end the client
 * writes. So forging the certificate's « Adresse IP constatée » row never
 * needed a forged MAC; it needed one curl to this endpoint. What is read now
 * is only what the platform edge wrote (`TRUSTED_SIGNER_IP_HEADERS`), and the
 * header it was read from is inside the signed bytes.
 *
 * `attestation: null` is an ordinary answer — no `SIGNER_IP_SECRET`, or no
 * trusted header on the request. The signature then records no IP rather than
 * an unverified one, and the page signs regardless.
 */
export async function GET(request: Request) {
  /* No fallback to `x-forwarded-for`, deliberately, and this is the fix: an
     address read from a header the caller can set is not an observation, and
     minting one anyway is what made the certificate's note untrue. */
  const observed = observeSignerIp(request.headers)

  const secret = readSignerIpSecret(process.env)
  if (!secret) {
    console.warn(
      `[SIGNATURE] ${SIGNER_IP_SECRET_ENV} absente côté Next — la signature de contrat sera consignée sans adresse IP.`,
    )
  }
  if (!observed && secret) {
    /* Names the deployment problem rather than hiding it behind a « non
       établie » on the certificate: a host whose edge sets none of these
       headers is one where the audit trail silently loses a row. */
    console.warn(
      `[SIGNATURE] Aucun en-tête de confiance sur la requête (${TRUSTED_SIGNER_IP_HEADERS.join(
        ', ',
      )}) — la signature de contrat sera consignée sans adresse IP.`,
    )
  }

  const attestation = await mintSignerIpAttestation(observed, {
    secret,
    now: Date.now(),
  })

  return Response.json(
    { attestation },
    { headers: { 'cache-control': 'no-store' } },
  )
}
