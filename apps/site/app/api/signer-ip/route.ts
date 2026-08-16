/**
 * Returns the caller's IP address, read server-side from the proxy header.
 * Used to stamp the audit trail of the affiliate's electronic signature (the IP
 * is not reachable from a regular Convex action).
 */
export async function GET(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null;
  return Response.json({ ip });
}
