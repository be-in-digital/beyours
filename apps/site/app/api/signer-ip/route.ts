import {
  SIGNER_IP_SECRET_ENV,
  mintSignerIpAttestation,
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
 * `attestation: null` is an ordinary answer — no `SIGNER_IP_SECRET`, or no
 * address behind the proxy header. The signature then records no IP rather than
 * an unverified one, and the page signs regardless.
 */
export async function GET(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')
  const observed =
    forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip')

  const secret = readSignerIpSecret(process.env)
  if (!secret) {
    console.warn(
      `[SIGNATURE] ${SIGNER_IP_SECRET_ENV} absente côté Next — la signature de contrat sera consignée sans adresse IP.`,
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
